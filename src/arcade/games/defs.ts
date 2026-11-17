// Los dos juegos nuevos de la Zona Arcade: «Cangrejos Locos» (reflejos) y «Bolos de coco» (lanzamiento, como el Skee-Ball). Cada uno es
// una definición pura (estado, avance, dibujo y toques) que el marco `MiniGame` mueve en un lienzo 2D. No usan servidor: los puntos
// se suman en este dispositivo, igual que en Nave Caribe sin conexión.

import { TICKET_SCALE, liveTickets } from '../store'
import fondoUrl from '../../assets/cangrejos/fondo.webp'
import agujeroUrl from '../../assets/cangrejos/agujero.webp'
import cangrejoUrl from '../../assets/cangrejos/cangrejo.webp'
import doradoUrl from '../../assets/cangrejos/dorado.webp'
import golpeadoUrl from '../../assets/cangrejos/golpeado.webp'

export type MiniGameId = 'cangrejos' | 'bolos'
export type PointerKind = 'down' | 'move' | 'up'

export interface GameDef<S> {
  id: MiniGameId
  name: string
  /** Tamaño del campo (el lienzo lo escala). */
  W: number
  H: number
  /** Cómo se juega, en una frase. */
  how: string
  create(): S
  update(s: S, dt: number): void
  draw(s: S, ctx: CanvasRenderingContext2D, t: number): void
  pointer(s: S, kind: PointerKind, x: number, y: number, t: number): { sfx?: 'pop' | 'power' | 'hurt' | 'coin' } | void
  /** Sonidos que el juego produjo solo (al caer un coco, por ejemplo): se piden y se vacían después de cada avance. */
  takeSounds?(s: S): ('pop' | 'power' | 'hurt' | 'coin')[]
  score(s: S): number
  done(s: S): boolean
}

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ── Cangrejos Locos ──────────────────────────────────────────────────────────────────────────────

const CW = 360
const CH = 560
const TIME = 45
const COLS = [70, 180, 290]
const ROWS = [200, 325, 450]

type CrabKind = 'crab' | 'gold' | 'octo'
interface Hole {
  x: number
  y: number
  kind: CrabKind | null
  /** Segundos desde que asomó. */
  age: number
  /** Cuánto se queda afuera. */
  dur: number
  hit: boolean
}
interface Pop {
  x: number
  y: number
  text: string
  color: string
  age: number
}
export interface CrabsState {
  holes: Hole[]
  left: number
  elapsed: number
  nextSpawn: number
  score: number
  combo: number
  best: number
  pops: Pop[]
  /** Mazos que golpean donde se tocó, y destellos de los aciertos. */
  mallets: { x: number; y: number; age: number }[]
  bursts: { x: number; y: number; age: number; color: string }[]
  shake: number
  seed: number
}

function rnd(s: { seed: number }) {
  s.seed = (s.seed * 1664525 + 1013904223) >>> 0
  return s.seed / 4294967296
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rad = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
  }
  ctx.closePath()
  ctx.fill()
}

// ── arte de Cangrejos Locos (ilustraciones 3D suaves, WebP con transparencia) ───────────────────────────────────────────────────────

const ART: Partial<Record<'fondo' | 'agujero' | 'cangrejo' | 'dorado' | 'golpeado', HTMLImageElement>> = {}
if (typeof Image !== 'undefined')
  for (const [k, url] of Object.entries({ fondo: fondoUrl, agujero: agujeroUrl, cangrejo: cangrejoUrl, dorado: doradoUrl, golpeado: golpeadoUrl })) {
    const im = new Image()
    im.decoding = 'async'
    im.src = url
    ART[k as keyof typeof ART] = im
  }
const ready = (im?: HTMLImageElement): im is HTMLImageElement => !!im && im.complete && im.naturalWidth > 0

/** Letra limpia de la app para el marcador (con una sombra suave que la despega del fondo). */
function ui(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'left', weight = 800) {
  ctx.font = `${weight} ${size}px Manrope, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(40,20,70,.35)'
  ctx.fillText(s, x + 0.8, y + 1.4)
  ctx.fillStyle = fill
  ctx.fillText(s, x, y)
}

/** Hueco de arena: la mitad de atrás va detrás de la criatura y la de adelante (el labio) por encima, así sale de adentro. */
const HOLE_W = 126
function holeSprite(ctx: CanvasRenderingContext2D, x: number, y: number, front: boolean) {
  const im = ART.agujero
  if (!ready(im)) return
  const h = (HOLE_W * im.naturalHeight) / im.naturalWidth
  const top = y - h / 2
  if (!front) ctx.drawImage(im, x - HOLE_W / 2, top, HOLE_W, h)
  else {
    // solo la mitad de abajo (el labio delantero)
    const sy = im.naturalHeight * 0.5
    ctx.drawImage(im, 0, sy, im.naturalWidth, im.naturalHeight - sy, x - HOLE_W / 2, y, HOLE_W, h / 2)
  }
}

/** Pulpo malo, dibujado con degradados suaves y sin contornos para que combine con las ilustraciones. */
function drawOcto(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, hit: boolean) {
  ctx.save()
  ctx.translate(x, y)
  if (hit) ctx.scale(1.18, 0.7)
  // tentáculos
  ctx.lineCap = 'round'
  for (const sx of [-1, -0.34, 0.34, 1]) {
    const wob = Math.sin(t * 7 + sx * 3) * 4
    ctx.strokeStyle = '#6a3fd0'
    ctx.lineWidth = 11
    ctx.beginPath()
    ctx.moveTo(sx * 18, 6)
    ctx.quadraticCurveTo(sx * 36 + wob, 16, sx * 32 + wob * 1.4, 34)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.25)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(sx * 16 - 2, 4)
    ctx.quadraticCurveTo(sx * 34 + wob - 2, 14, sx * 30 + wob * 1.4 - 2, 30)
    ctx.stroke()
  }
  const g = ctx.createRadialGradient(-12, -30, 4, 0, -14, 46)
  g.addColorStop(0, '#c7a6ff')
  g.addColorStop(0.45, '#8657e6')
  g.addColorStop(1, '#5a33b8')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, -14, 34, 32, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.4)'
  ctx.beginPath()
  ctx.ellipse(-14, -34, 12, 6, -0.6, 0, Math.PI * 2)
  ctx.fill()
  // ojos grandes con luz y cejas enojadas
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(sx * 13, -14, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2a1608'
    ctx.beginPath()
    ctx.arc(sx * 13 - sx, -12, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(sx * 13 - sx * 2.5, -14.5, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#3a1d86'
  ctx.lineWidth = 4.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-25, -31)
  ctx.lineTo(-6, -22)
  ctx.moveTo(25, -31)
  ctx.lineTo(6, -22)
  ctx.stroke()
  if (hit) {
    ctx.fillStyle = '#ffe36b'
    for (let i = 0; i < 3; i++) {
      const a = t * 9 + (i * Math.PI * 2) / 3
      star(ctx, Math.cos(a) * 26, -52 + Math.sin(a) * 6, 6)
    }
  }
  ctx.restore()
}

/**
 * La criatura asomando de su hueco: el sprite sube desde la línea del centro del hueco (por debajo queda recortado), con un pequeño
 * estirón al salir; golpeada, cambia a la imagen mareada (o se aplasta, según el tipo).
 */
function drawCreature(ctx: CanvasRenderingContext2D, x: number, y: number, kind: CrabKind, k: number, t: number, hit: boolean) {
  if (k <= 0.001) return
  const line = y + 4 // centro del hueco
  ctx.save()
  ctx.beginPath()
  ctx.rect(x - 90, line - 130, 180, 130)
  ctx.clip()
  if (kind === 'octo') {
    ctx.translate(x, line + 34 - 74 * k)
    drawOcto(ctx, 0, 0, t, hit)
  } else {
    const im = hit && kind === 'crab' ? ART.golpeado : kind === 'gold' ? ART.dorado : ART.cangrejo
    if (ready(im)) {
      const w = hit && kind === 'crab' ? 128 : 112
      const h = (w * im.naturalHeight) / im.naturalWidth
      const bulge = Math.sin(Math.min(1, k) * Math.PI)
      const sw = w * (1 - 0.05 * bulge)
      const sh = h * (1 + 0.09 * bulge)
      const squash = hit && kind === 'gold' ? 0.72 : 1
      const top = line - h * 0.8 * k + (h - sh * squash) * 0.2
      ctx.drawImage(im, x - (hit && kind === 'gold' ? sw * 1.14 : sw) / 2, top, hit && kind === 'gold' ? sw * 1.14 : sw, sh * squash)
      if (hit && kind === 'gold') {
        ctx.fillStyle = '#ffe36b'
        for (let i = 0; i < 3; i++) {
          const a = t * 9 + (i * Math.PI * 2) / 3
          star(ctx, x + Math.cos(a) * 28, top - 6 + Math.sin(a) * 6, 6)
        }
      }
    }
  }
  ctx.restore()
}

export const CRABS: GameDef<CrabsState> = {
  id: 'cangrejos',
  name: 'Cangrejos Locos',
  W: CW,
  H: CH,
  how: 'Toca los cangrejos antes de que se escondan. El dorado vale triple. ¡Cuidado con el pulpo!',
  create: () => ({
    holes: ROWS.flatMap((y) => COLS.map((x) => ({ x, y, kind: null, age: 0, dur: 1, hit: false }))),
    left: TIME,
    elapsed: 0,
    nextSpawn: 0.6,
    score: 0,
    combo: 0,
    best: 0,
    pops: [],
    mallets: [],
    bursts: [],
    shake: 0,
    seed: (Date.now() & 0xffffffff) >>> 0,
  }),
  update(s, dt) {
    if (s.left <= 0) return
    s.left = Math.max(0, s.left - dt)
    s.elapsed += dt
    s.shake = Math.max(0, s.shake - dt)
    for (const h of s.holes) {
      if (!h.kind) continue
      h.age += dt
      if (h.age >= h.dur) {
        // se escondió sin que lo tocaran: un cangrejo perdido corta la racha
        if (!h.hit && h.kind !== 'octo') s.combo = 0
        h.kind = null
      }
    }
    for (const p of s.pops) p.age += dt
    s.pops = s.pops.filter((p) => p.age < 0.8)
    for (const m of s.mallets) m.age += dt
    s.mallets = s.mallets.filter((m) => m.age < 0.3)
    for (const b of s.bursts) b.age += dt
    s.bursts = s.bursts.filter((b) => b.age < 0.5)
    s.nextSpawn -= dt
    if (s.nextSpawn <= 0) {
      const level = Math.min(1, s.elapsed / TIME)
      const free = s.holes.filter((h) => !h.kind)
      if (free.length) {
        const h = free[Math.floor(rnd(s) * free.length)]
        const r = rnd(s)
        h.kind = r < 0.1 ? 'octo' : r < 0.19 ? 'gold' : 'crab'
        h.age = 0
        h.hit = false
        h.dur = (1.15 - level * 0.6) * (h.kind === 'gold' ? 0.8 : 1)
      }
      s.nextSpawn = 0.75 - level * 0.4 + rnd(s) * 0.15
    }
  },
  pointer(s, kind, x, y) {
    if (kind !== 'down' || s.left <= 0) return
    s.mallets.push({ x, y, age: 0 })
    for (const h of s.holes) {
      if (!h.kind || h.hit) continue
      if (Math.abs(x - h.x) < 52 && y < h.y + 14 && y > h.y - 84) {
        h.hit = true
        const kindHit = h.kind
        h.age = Math.max(h.age, h.dur - 0.12) // se hunde enseguida
        s.bursts.push({ x: h.x, y: h.y - 30, age: 0, color: kindHit === 'octo' ? '#ff5c8a' : kindHit === 'gold' ? '#ffe36b' : '#7dffa6' })
        if (kindHit === 'octo') {
          s.score = Math.max(0, s.score - 20)
          s.combo = 0
          s.shake = 0.3
          s.pops.push({ x: h.x, y: h.y - 60, text: '-20', color: '#ff5c8a', age: 0 })
          return { sfx: 'hurt' }
        }
        s.combo++
        const mult = Math.min(5, 1 + Math.floor(s.combo / 4))
        const pts = (kindHit === 'gold' ? 30 : 10) * mult
        s.score += pts
        s.best = Math.max(s.best, s.combo)
        s.pops.push({ x: h.x, y: h.y - 60, text: `+${pts}`, color: kindHit === 'gold' ? '#ffe36b' : '#7dffa6', age: 0 })
        return { sfx: kindHit === 'gold' ? 'power' : 'pop' }
      }
    }
    // tocar en vacío corta la racha (para que no se gane golpeando a ciegas)
    s.combo = 0
  },
  draw(s, ctx, t) {
    const sx = s.shake > 0 ? (Math.random() - 0.5) * 7 : 0
    ctx.save()
    ctx.translate(sx, 0)
    // ── fondo: playa al atardecer (ilustración); sin ella, un degradado suave mientras carga ──
    if (ready(ART.fondo)) ctx.drawImage(ART.fondo, -6, 0, CW + 12, CH)
    else {
      const sky = ctx.createLinearGradient(0, 0, 0, CH)
      sky.addColorStop(0, '#8a7be6')
      sky.addColorStop(0.3, '#ff9a8a')
      sky.addColorStop(0.32, '#e8b878')
      sky.addColorStop(1, '#e9b983')
      ctx.fillStyle = sky
      ctx.fillRect(-6, 0, CW + 12, CH)
    }
    // ── huecos: la parte de atrás, luego las criaturas y encima el labio delantero ──
    for (const h of s.holes) holeSprite(ctx, h.x, h.y + 6, false)
    for (const h of s.holes) {
      if (h.kind) {
        const u = h.age / h.dur
        const k = u < 0.18 ? u / 0.18 : u > 0.82 ? Math.max(0, (1 - u) / 0.18) : 1
        drawCreature(ctx, h.x, h.y, h.kind, k, t, h.hit)
      }
      holeSprite(ctx, h.x, h.y + 6, true)
    }
    // ── destellos de acierto: onda suave, chispas y arena que salta y cae ──
    for (const b of s.bursts) {
      const u = b.age / 0.5
      ctx.globalAlpha = (1 - u) * 0.9
      ctx.strokeStyle = b.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(b.x, b.y, 12 + u * 38, 0, Math.PI * 2)
      ctx.stroke()
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + 0.2
        const sp = 70 + (k % 3) * 26
        const px = b.x + Math.cos(a) * sp * b.age
        const py = b.y + Math.sin(a) * sp * b.age * 0.7 + 320 * b.age * b.age - 22 * b.age
        ctx.fillStyle = k % 2 ? b.color : k % 4 === 0 ? '#f3d29c' : '#d6a766'
        ctx.beginPath()
        ctx.arc(px, py, k % 2 ? 2.4 : 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    // ── mazo: madera con cabeza amarilla, sin contornos duros ──
    for (const m of s.mallets) {
      const u = m.age / 0.3
      const ang = -1.0 + Math.min(1, u * 3) * 1.15
      ctx.save()
      ctx.globalAlpha = 1 - Math.max(0, u - 0.5) * 2
      ctx.translate(m.x + 8, m.y - 6)
      ctx.rotate(ang)
      const wood = ctx.createLinearGradient(-4, 0, 4, 0)
      wood.addColorStop(0, '#9a6532')
      wood.addColorStop(0.5, '#c88c4a')
      wood.addColorStop(1, '#8a5a2b')
      ctx.fillStyle = wood
      rr(ctx, -4.5, -4, 9, 62, 4)
      ctx.fill()
      const head = ctx.createLinearGradient(0, -26, 0, 2)
      head.addColorStop(0, '#ffe58a')
      head.addColorStop(1, '#f0b429')
      ctx.fillStyle = head
      rr(ctx, -23, -26, 46, 28, 10)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,.55)'
      rr(ctx, -17, -22, 28, 5, 2.5)
      ctx.fill()
      ctx.fillStyle = '#e8651f'
      ctx.fillRect(-23, -15, 46, 4)
      ctx.restore()
      if (u > 0.2 && u < 0.7) {
        ctx.save()
        ctx.globalAlpha = 1 - (u - 0.2) / 0.5
        ctx.fillStyle = '#fff6b8'
        star(ctx, m.x, m.y, 14 + (u - 0.2) * 30)
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1
    for (const p of s.pops) {
      ctx.globalAlpha = 1 - p.age / 0.8
      ui(ctx, p.text, p.x, p.y - p.age * 44, 20, p.color, 'center', 900)
    }
    ctx.globalAlpha = 1
    ctx.restore()
    // ── marcador minimalista: tiquetes, racha y tiempo sobre un degradado suave ──
    const hud = ctx.createLinearGradient(0, 0, 0, 96)
    hud.addColorStop(0, 'rgba(46,30,110,.62)')
    hud.addColorStop(1, 'rgba(46,30,110,0)')
    ctx.fillStyle = hud
    ctx.fillRect(0, 0, CW, 96)
    ui(ctx, 'Tiquetes', 16, 17, 12, 'rgba(255,255,255,.82)', 'left', 700)
    // icono de tiquete dorado
    ctx.save()
    ctx.translate(26, 42)
    ctx.rotate(-0.25)
    const tg = ctx.createLinearGradient(0, -9, 0, 9)
    tg.addColorStop(0, '#ffe36b')
    tg.addColorStop(1, '#f5a912')
    ctx.fillStyle = tg
    rr(ctx, -12, -8, 24, 16, 4)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    star(ctx, 0, 0, 4)
    ctx.restore()
    ui(ctx, String(liveTickets(s.score, TICKET_SCALE.cangrejos)), 46, 42, 24, '#fff', 'left', 900)
    const mult = Math.min(5, 1 + Math.floor(s.combo / 4))
    ui(ctx, s.combo > 1 ? `Racha ${s.combo}` : 'Racha', CW / 2, 17, 12, 'rgba(255,255,255,.82)', 'center', 700)
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < s.combo % 4 || mult === 5 ? '#b78cff' : 'rgba(255,255,255,.28)'
      rr(ctx, CW / 2 - 52 + i * 27, 28, 24, 9, 4.5)
      ctx.fill()
    }
    ui(ctx, `x${mult}`, CW / 2, 52, 13, mult > 1 ? '#ffe36b' : 'rgba(255,255,255,.8)', 'center', 800)
    ui(ctx, 'Tiempo', CW - 16, 17, 12, s.left < 10 ? '#ffb4c4' : 'rgba(255,255,255,.82)', 'right', 700)
    ui(ctx, `${Math.ceil(s.left)}`, CW - 30, 42, 28, s.left < 10 ? '#ffb4c4' : '#fff', 'right', 900)
    ui(ctx, 's', CW - 16, 46, 15, s.left < 10 ? '#ffb4c4' : 'rgba(255,255,255,.85)', 'right', 800)
    // barra de tiempo finita
    ctx.fillStyle = 'rgba(255,255,255,.22)'
    ctx.fillRect(0, 0, CW, 3)
    ctx.fillStyle = s.left < 10 ? '#ff8aa6' : '#ffe36b'
    ctx.fillRect(0, 0, (CW * s.left) / TIME, 3)
  },
  score: (s) => s.score,
  done: (s) => s.left <= 0,
}

// ── Bolos de coco ─────────────────────────────────────────────────────────────────────────────────

const BW = 360
const BH = 560
const BOARD = { x: BW / 2, y: 152 }
const RINGS: { r: number; v: number; c: string; hi: string }[] = [
  { r: 92, v: 10, c: '#3f8fd8', hi: '#7cc4ff' },
  { r: 71, v: 20, c: '#35b5a0', hi: '#7fe3d0' },
  { r: 51, v: 30, c: '#f0b530', hi: '#ffe08a' },
  { r: 32, v: 40, c: '#e0525f', hi: '#ff9aa6' },
  { r: 15, v: 50, c: '#f7f2e6', hi: '#ffffff' },
]
const HOLES: { x: number; y: number; r: number; v: number }[] = [
  { x: 40, y: 100, r: 22, v: 100 },
  { x: BW - 40, y: 100, r: 22, v: 100 },
]
/** Imán de las esquinas: si el coco iba a caer a menos de esto de un hueco de 100, se «pega» y entra (ayuda a quien casi acierta). */
const HOLE_PULL = 24
/** Cuánto se abre el lanzamiento a los lados: el centro del carril llega al centro del tablero y los bordes, a las esquinas. */
const LATERAL = 1.4
/** Cuánto empuja el efecto (la velocidad lateral del dedo al soltar) sobre dónde cae el coco. */
const SPIN = 0.3
const START = { x: BW / 2, y: 500 }
const RAMP_Y = 246
const LANE = { l: 92, r: BW - 92 }
const BALLS = 9
/** Fuerza del deslizamiento (px/s del campo): por debajo de MIN el coco no llega a la rampa; en ~1900 cae al centro; MAX es el tope. */
const MIN_POWER = 700
const MAX_POWER = 3300
const SWEET = 1900
/** Letra de los números: gruesa y de sistema, para que se lean nítidos incluso pequeños. */
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'

type BPhase = 'aim' | 'roll' | 'fly' | 'rest'
type Snd = 'pop' | 'power' | 'hurt' | 'coin'
interface Landed {
  x: number
  y: number
  v: number
  age: number
}
interface Aim {
  power: number
  tx: number
  ty: number
  /** Efecto del lanzamiento (velocidad lateral): curva el trayecto. */
  bend: number
}
export interface BowlsState {
  left: number
  score: number
  phase: BPhase
  x: number
  y: number
  vx: number
  vy: number
  power: number
  fly: { t: number; sx: number; sy: number; ex: number; ey: number; bend: number } | null
  landed: Landed[]
  rest: number
  msg: { text: string; age: number; color: string } | null
  trail: { x: number; y: number; t: number }[]
  /** Destellos al caer un coco: aro iluminado, onda y chispas. */
  bursts: { x: number; y: number; v: number; age: number; color: string; big: boolean }[]
  drag: { x: number; y: number; t: number }[]
  /** Mientras se arrastra: fuerza estimada y dónde caería el coco. */
  aim: Aim | null
  /** Dónde caerá el coco lanzado: lo que mostraba la mira al soltar (así lo que ves es lo que pasa, aunque ruede pegado a la pared). */
  target: Aim | null
  /** Sonidos pendientes (caída del coco). */
  sounds: Snd[]
}

function ringValue(x: number, y: number): number {
  for (const h of HOLES) if (Math.hypot(x - h.x, y - h.y) < h.r) return h.v
  const d = Math.hypot(x - BOARD.x, y - BOARD.y)
  for (let i = RINGS.length - 1; i >= 0; i--) if (d < RINGS[i].r) return RINGS[i].v
  return 0
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** Velocidad lateral que se le da al coco según el deslizamiento (poca, para que la puntería sea fácil de controlar). */
const sideSpeed = (vx: number) => clamp(vx * 0.08, -140, 140)
/** Velocidad con que rueda por el carril: más fuerza, más rápido (pero siempre visible). */
const rollSpeed = (power: number) => 380 + power * 0.16

/** Dónde caería el coco con esta posición y fuerza (lo usa la mira mientras se arrastra). */
function predict(x: number, y: number, power: number, vxl: number): Aim {
  const t = Math.max(0, (y - RAMP_Y) / rollSpeed(power))
  const xe = clamp(x + vxl * t, LANE.l + 12, LANE.r - 12)
  const k = clamp((power - MIN_POWER) / (MAX_POWER - MIN_POWER), 0, 1)
  const raw = BOARD.x + (xe - BW / 2) * LATERAL + vxl * SPIN
  const ty = RAMP_Y - 6 - k * 190
  // el imán se mide sobre el punto sin recortar: pasarse de largo hacia el costado también es fallar
  const hole = HOLES.find((h) => Math.hypot(raw - h.x, ty - h.y) < HOLE_PULL)
  return hole ? { power, tx: hole.x, ty: hole.y, bend: vxl } : { power, tx: clamp(raw, 12, BW - 12), ty, bend: vxl }
}

/** Velocidad del deslizamiento en los últimos ~120 ms (px/s del campo). */
function swipe(drag: { x: number; y: number; t: number }[]) {
  const last = drag[drag.length - 1]
  let first = drag[0]
  for (const d of drag) {
    if (last.t - d.t <= 120) {
      first = d
      break
    }
  }
  const dt = Math.max(0.03, (last.t - first.t) / 1000)
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
}

function numText(ctx: CanvasRenderingContext2D, v: string, x: number, y: number, size: number, fill: string, outline?: string) {
  ctx.font = `900 ${size}px ${SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (outline) {
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(3, size * 0.3)
    ctx.strokeStyle = outline
    ctx.strokeText(v, x, y)
  }
  ctx.fillStyle = fill
  ctx.fillText(v, x, y)
}

function coconut(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
  g.addColorStop(0, '#a8743c')
  g.addColorStop(0.55, '#6b4423')
  g.addColorStop(1, '#3b2310')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  // los tres «ojos» del coco giran con el coco
  ctx.fillStyle = '#1f1208'
  for (const [dx, dy] of [[-0.28, -0.05], [0.28, -0.05], [0, 0.36]]) {
    const c = Math.cos(rot)
    const sn = Math.sin(rot)
    ctx.beginPath()
    ctx.arc(x + (dx * c - dy * sn) * r, y + (dx * sn + dy * c) * r, r * 0.13, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,.22)'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#07031a'
  ctx.lineWidth = Math.max(1.5, r * 0.1)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
}

export const BOWLS: GameDef<BowlsState> = {
  id: 'bolos',
  name: 'Bolos de coco',
  W: BW,
  H: BH,
  how: 'Arrastra el coco hacia arriba y suéltalo: la mira te muestra dónde caerá. Más rápido llega más lejos. Para las esquinas (100) arrástralo hacia un lado y suéltalo con un movimiento en curva.',
  create: () => ({ left: BALLS, score: 0, phase: 'aim', x: START.x, y: START.y, vx: 0, vy: 0, power: 0, fly: null, landed: [], rest: 0, msg: null, trail: [], bursts: [], drag: [], aim: null, target: null, sounds: [] }),
  takeSounds(s) {
    const q = s.sounds
    s.sounds = []
    return q
  },
  update(s, dt) {
    if (s.msg) {
      s.msg.age += dt
      if (s.msg.age > 1.3) s.msg = null
    }
    if (s.phase === 'roll') {
      s.x += s.vx * dt
      s.y += s.vy * dt
      if (s.x < LANE.l + 12) {
        s.x = LANE.l + 12
        s.vx = Math.abs(s.vx) * 0.6
      } else if (s.x > LANE.r - 12) {
        s.x = LANE.r - 12
        s.vx = -Math.abs(s.vx) * 0.6
      }
      s.trail.push({ x: s.x, y: s.y, t: 0 })
      if (s.power < MIN_POWER && s.y < 380) {
        // se quedó sin fuerza antes de la rampa: se detiene y se pierde el lanzamiento
        s.phase = 'rest'
        s.rest = 0.9
        s.left--
        s.sounds.push('hurt')
        s.msg = { text: '¡MUY SUAVE!', age: 0, color: '#ff9aa6' }
      } else if (s.y <= RAMP_Y) {
        const a = s.target ?? predict(s.x, RAMP_Y, s.power, s.vx)
        s.fly = { t: 0, sx: s.x, sy: s.y, ex: a.tx, ey: a.ty, bend: clamp(a.bend * 0.3, -36, 36) }
        s.phase = 'fly'
      }
    } else if (s.phase === 'fly' && s.fly) {
      s.fly.t += dt / 0.62
      if (s.fly.t >= 1) {
        const { ex, ey } = s.fly
        const v = ringValue(ex, ey)
        s.score += v
        s.landed.push({ x: ex, y: ey, v, age: 0 })
        s.bursts.push({ x: ex, y: ey, v, age: 0, color: v >= 100 ? '#ffe36b' : v >= 40 ? '#7dffa6' : v > 0 ? '#00f0ff' : '#ff9aa6', big: v >= 40 })
        s.sounds.push(v >= 40 ? 'power' : v > 0 ? 'pop' : 'hurt')
        s.fly = null
        s.phase = 'rest'
        s.rest = 1
        s.left--
        s.msg = v > 0 ? { text: v >= 100 ? `¡+${v}!` : `+${v}`, age: 0, color: v >= 100 ? '#ffe36b' : v >= 40 ? '#7dffa6' : '#00f0ff' } : { text: '¡FALLASTE!', age: 0, color: '#ff9aa6' }
      }
    } else if (s.phase === 'rest') {
      s.rest -= dt
      if (s.rest <= 0 && s.left > 0) {
        s.phase = 'aim'
        s.x = START.x
        s.y = START.y
        s.vx = s.vy = 0
        s.trail = []
        s.landed = s.landed.slice(-9)
      }
    }
    for (const p of s.trail) p.t += dt
    s.trail = s.trail.filter((p) => p.t < 0.4)
    for (const b of s.bursts) b.age += dt
    s.bursts = s.bursts.filter((b) => b.age < 0.8)
    for (const l of s.landed) l.age += dt
  },
  pointer(s, kind, x, y, t) {
    if (s.phase !== 'aim') return
    const back = () => {
      s.drag = []
      s.aim = null
      s.x = START.x
      s.y = START.y
    }
    if (kind === 'down') {
      s.drag = [{ x, y, t }]
    } else if (kind === 'move' && s.drag.length) {
      s.drag.push({ x, y, t })
      if (s.drag.length > 12) s.drag.shift()
      // el coco sigue al dedo (un poco): se siente que lo agarras
      const o = s.drag[0]
      s.x = clamp(START.x + (x - o.x) * 0.55, LANE.l + 30, LANE.r - 30)
      s.y = START.y - clamp(o.y - y, 0, 90) * 0.5
      const v = swipe(s.drag)
      s.aim = v.vy < -150 ? predict(s.x, s.y, Math.min(MAX_POWER, -v.vy), sideSpeed(v.vx)) : null
    } else if (kind === 'up' && s.drag.length > 1) {
      s.drag.push({ x, y, t })
      const v = swipe(s.drag)
      if (v.vy > -300) return back() // no fue hacia arriba: el coco vuelve y puede intentar de nuevo
      s.power = Math.min(MAX_POWER, -v.vy)
      s.vx = sideSpeed(v.vx)
      s.vy = -rollSpeed(s.power)
      s.target = predict(s.x, s.y, s.power, s.vx)
      s.phase = 'roll'
      s.drag = []
      s.aim = null
      return { sfx: 'pop' }
    } else if (kind === 'up') back()
  },
  draw(s, ctx, t) {
    const lamp = (i: number, on: boolean) => (on ? ['#ffd400', '#ff2bd6', '#00f0ff'][i % 3] : '#2a2160')
    ctx.imageSmoothingEnabled = true
    // ── fondo: interior de la máquina, con paneles y estrellitas ──
    const bg = ctx.createLinearGradient(0, 0, 0, BH)
    bg.addColorStop(0, '#1a0f55')
    bg.addColorStop(1, '#0a0624')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, BW, BH)
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = (0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i))) * 0.7
      ctx.fillStyle = i % 3 === 0 ? '#ff2bd6' : i % 3 === 1 ? '#00f0ff' : '#ffd400'
      ctx.fillRect((i * 83) % BW, 270 + ((i * 47) % 280), 3, 3)
    }
    ctx.globalAlpha = 1
    for (const side of [0, 1]) {
      const x0 = side ? LANE.r + 22 : 0
      const w = side ? BW - (LANE.r + 22) : LANE.l - 22
      ctx.fillStyle = '#150a45'
      ctx.fillRect(x0, RAMP_Y + 8, w, BH - RAMP_Y)
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = ['#ff2bd6', '#00f0ff', '#ffd400'][k % 3]
        ctx.globalAlpha = 0.5
        ctx.fillRect(x0 + (side ? 4 : w - 10), RAMP_Y + 24 + k * 54, 6, 38)
      }
      ctx.globalAlpha = 1
    }
    // ── carril de madera con perspectiva, rieles de neón y flechas que suben ──
    const lane = (inset: number, color: string) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(LANE.l - 18 + inset, BH)
      ctx.lineTo(LANE.l + 34 + inset, RAMP_Y)
      ctx.lineTo(LANE.r - 34 - inset, RAMP_Y)
      ctx.lineTo(LANE.r + 18 - inset, BH)
      ctx.closePath()
      ctx.fill()
    }
    lane(0, '#ff2bd6')
    lane(5, '#1a0f55')
    const wood = ctx.createLinearGradient(0, RAMP_Y, 0, BH)
    wood.addColorStop(0, '#8d5a26')
    wood.addColorStop(1, '#c98f4c')
    ctx.fillStyle = wood
    ctx.beginPath()
    ctx.moveTo(LANE.l - 8, BH)
    ctx.lineTo(LANE.l + 40, RAMP_Y)
    ctx.lineTo(LANE.r - 40, RAMP_Y)
    ctx.lineTo(LANE.r + 8, BH)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(60,30,8,.45)'
    ctx.lineWidth = 2
    for (let i = 1; i < 6; i++) {
      const k = i / 6
      ctx.beginPath()
      ctx.moveTo(LANE.l - 8 + (LANE.r - LANE.l + 16) * k, BH)
      ctx.lineTo(LANE.l + 40 + (LANE.r - LANE.l - 80) * k, RAMP_Y)
      ctx.stroke()
    }
    if (s.phase === 'aim' && !s.aim)
      for (let i = 0; i < 4; i++) {
        const u = (t * 0.5 + i / 4) % 1
        const y = BH - 60 - u * (BH - RAMP_Y - 90)
        const w = 16 - u * 6
        ctx.globalAlpha = 0.5 * (1 - u)
        ctx.fillStyle = '#ffe9a8'
        ctx.beginPath()
        ctx.moveTo(BW / 2, y - w)
        ctx.lineTo(BW / 2 + w, y + w * 0.4)
        ctx.lineTo(BW / 2, y + w * 0.1)
        ctx.lineTo(BW / 2 - w, y + w * 0.4)
        ctx.closePath()
        ctx.fill()
      }
    ctx.globalAlpha = 1
    const lip = ctx.createLinearGradient(0, RAMP_Y - 14, 0, RAMP_Y + 16)
    lip.addColorStop(0, '#ffe08a')
    lip.addColorStop(1, '#a8651f')
    ctx.fillStyle = lip
    ctx.beginPath()
    ctx.moveTo(LANE.l + 34, RAMP_Y + 14)
    ctx.quadraticCurveTo(BW / 2, RAMP_Y - 22, LANE.r - 34, RAMP_Y + 14)
    ctx.lineTo(LANE.r - 40, RAMP_Y + 16)
    ctx.quadraticCurveTo(BW / 2, RAMP_Y - 6, LANE.l + 40, RAMP_Y + 16)
    ctx.closePath()
    ctx.fill()

    // ── tablero: marco con luces corredoras y aros con brillo ──
    ctx.fillStyle = '#07031a'
    rr(ctx, 8, 48, BW - 16, 206, 26)
    ctx.fill()
    ctx.fillStyle = '#1d2250'
    rr(ctx, 13, 53, BW - 26, 196, 22)
    ctx.fill()
    const nl = 30
    for (let i = 0; i < nl; i++) {
      const x = 22 + (i / nl) * (BW - 44)
      const on = (i + Math.floor(t * 8)) % 3 === 0
      ctx.fillStyle = lamp(i, on)
      ctx.beginPath()
      ctx.arc(x, 60, 2.6, 0, Math.PI * 2)
      ctx.arc(x, 242, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    // el aro (o portal) donde cayó el último coco se ilumina
    const lit = (v: number) => s.bursts.filter((b) => b.v === v).reduce((m, b) => Math.max(m, 1 - b.age / 0.8), 0)
    for (const r of RINGS) {
      ctx.fillStyle = r.c
      ctx.beginPath()
      ctx.arc(BOARD.x, BOARD.y, r.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#07031a'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.strokeStyle = r.hi
      ctx.globalAlpha = 0.65
      ctx.beginPath()
      ctx.arc(BOARD.x, BOARD.y, r.r - 3, Math.PI * 1.05, Math.PI * 1.55)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    for (const r of RINGS) {
      const f = lit(r.v)
      if (f > 0) {
        ctx.strokeStyle = '#ffffff'
        ctx.globalAlpha = f
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(BOARD.x, BOARD.y, r.r - 2, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
    // números nítidos, uno por aro, en una columna sobre el centro del tablero
    const mids = [81.5, 61, 41.5, 23.5]
    RINGS.slice(0, 4).forEach((r, i) => numText(ctx, String(r.v), BOARD.x, BOARD.y - mids[i], 13, '#ffffff', '#0b0630'))
    numText(ctx, '50', BOARD.x, BOARD.y, 13, '#1a0f55')
    for (const h of HOLES) {
      const f = lit(h.v)
      ctx.fillStyle = '#07031a'
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r + 4, 0, Math.PI * 2)
      ctx.fill()
      const g = ctx.createRadialGradient(h.x - 5, h.y - 5, 2, h.x, h.y, h.r)
      g.addColorStop(0, '#fff6b8')
      g.addColorStop(1, '#ffb000')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2)
      ctx.fill()
      if (f > 0) {
        ctx.strokeStyle = '#ffffff'
        ctx.globalAlpha = f
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(h.x, h.y, h.r + 2, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      numText(ctx, '100', h.x, h.y + 0.5, 12, '#3a2100')
      if (s.phase === 'aim') {
        // aro que late: las esquinas son el objetivo grande
        ctx.strokeStyle = '#ffe36b'
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 4 + h.x)
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(h.x, h.y, h.r + 7 + Math.sin(t * 4 + h.x) * 2, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
    // ondas y chispas de los aciertos
    for (const b of s.bursts) {
      const u = b.age / 0.8
      ctx.globalAlpha = 1 - u
      ctx.strokeStyle = b.color
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(b.x, b.y, 10 + u * (b.big ? 52 : 30), 0, Math.PI * 2)
      ctx.stroke()
      if (b.big)
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + 0.3
          ctx.fillStyle = b.color
          ctx.fillRect(b.x + Math.cos(a) * (12 + u * 62) - 2, b.y + Math.sin(a) * (12 + u * 62) - 2, 4, 4)
        }
    }
    ctx.globalAlpha = 1
    // cocos ya caídos: rebotan un poquito al caer y se asientan
    for (const l of s.landed) {
      const bounce = l.age < 0.4 ? Math.abs(Math.sin(l.age * 14)) * 12 * (1 - l.age / 0.4) : 0
      ctx.fillStyle = 'rgba(0,0,0,.28)'
      ctx.beginPath()
      ctx.ellipse(l.x + 2, l.y + 8, 8, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      coconut(ctx, l.x, l.y - bounce, 9, l.x)
    }

    // ── mira mientras se arrastra: dónde caerá y con qué fuerza ──
    const ready = s.phase === 'aim' && s.aim
    if (ready && s.aim) {
      const a = s.aim
      const soft = a.power < MIN_POWER
      const col = soft ? '#ff6f8e' : ringValue(a.tx, a.ty) >= 40 ? '#7dffa6' : '#ffd400'
      if (!soft) {
        ctx.strokeStyle = col
        ctx.globalAlpha = 0.5
        ctx.setLineDash([5, 7])
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(s.x, s.y - 20)
        ctx.quadraticCurveTo((s.x + a.tx) / 2 + clamp(a.bend * 0.3, -36, 36) * 1.6, (s.y + a.ty) / 2, a.tx, a.ty + 14)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
        const pr = 13 + Math.sin(t * 8) * 2.5
        ctx.strokeStyle = col
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(a.tx, a.ty, pr, 0, Math.PI * 2)
        ctx.moveTo(a.tx - pr - 6, a.ty)
        ctx.lineTo(a.tx - pr + 5, a.ty)
        ctx.moveTo(a.tx + pr - 5, a.ty)
        ctx.lineTo(a.tx + pr + 6, a.ty)
        ctx.moveTo(a.tx, a.ty - pr - 6)
        ctx.lineTo(a.tx, a.ty - pr + 5)
        ctx.moveTo(a.tx, a.ty + pr - 5)
        ctx.lineTo(a.tx, a.ty + pr + 6)
        ctx.stroke()
      }
    }

    // ── estela y coco en juego: se achica al alejarse, gira y proyecta sombra ──
    for (const p of s.trail) {
      ctx.globalAlpha = Math.max(0, 0.45 - p.t * 1.1)
      ctx.fillStyle = '#ffd36b'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6 + (p.y - RAMP_Y) / 40, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    const radiusAt = (y: number) => 12 + 11 * clamp((y - RAMP_Y) / (START.y - RAMP_Y), 0, 1)
    const shadow = (x: number, y: number, r: number, a = 0.35) => {
      ctx.fillStyle = `rgba(0,0,0,${a})`
      ctx.beginPath()
      ctx.ellipse(x + 3, y + r * 0.9, r * 0.95, r * 0.38, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    if (s.phase === 'fly' && s.fly) {
      const f = s.fly
      const u = f.t
      const x = f.sx + (f.ex - f.sx) * u + f.bend * Math.sin(u * Math.PI) * (1 - u)
      const gy = f.sy + (f.ey - f.sy) * u
      const h = Math.sin(u * Math.PI) * 54
      const r = 15 - u * 5
      shadow(x, gy, r, 0.3 * (1 - h / 80))
      coconut(ctx, x, gy - h, r, u * 14)
    } else if (s.phase === 'aim' || s.phase === 'roll') {
      const r = radiusAt(s.y)
      shadow(s.x, s.y, r)
      coconut(ctx, s.x, s.y, r, (START.y - s.y) * 0.07)
      if (s.phase === 'aim' && s.drag.length) {
        ctx.strokeStyle = 'rgba(255,255,255,.85)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(s.x, s.y, r + 5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // ── medidor de fuerza a la derecha: en la franja verde cae cerca del centro ──
    const mx = BW - 30
    const my0 = 300
    const my1 = 520
    const fy = (p: number) => my1 - ((clamp(p, 0, MAX_POWER) / MAX_POWER) * (my1 - my0))
    ctx.fillStyle = '#07031a'
    rr(ctx, mx - 9, my0 - 6, 18, my1 - my0 + 12, 6)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,111,142,.75)'
    ctx.fillRect(mx - 6, fy(MIN_POWER), 12, my1 - fy(MIN_POWER))
    ctx.fillStyle = 'rgba(255,212,0,.5)'
    ctx.fillRect(mx - 6, my0, 12, fy(SWEET + 450) - my0)
    ctx.fillStyle = 'rgba(125,255,166,.8)'
    ctx.fillRect(mx - 6, fy(SWEET + 450), 12, fy(SWEET - 450) - fy(SWEET + 450))
    ctx.fillStyle = 'rgba(255,212,0,.5)'
    ctx.fillRect(mx - 6, fy(SWEET - 450), 12, fy(MIN_POWER) - fy(SWEET - 450))
    // franja de las esquinas (100): la fuerza con que el coco llega a la altura de los huecos
    {
      const k = (RAMP_Y - 6 - HOLES[0].y) / 190
      const p = MIN_POWER + k * (MAX_POWER - MIN_POWER)
      const half = (HOLE_PULL / 190) * (MAX_POWER - MIN_POWER)
      ctx.fillStyle = '#ffe36b'
      ctx.fillRect(mx - 10, fy(p + half), 3, fy(p - half) - fy(p + half))
      numText(ctx, '100', mx - 22, (fy(p + half) + fy(p - half)) / 2, 9, '#ffe36b', '#07031a')
    }
    if (s.aim) {
      const y = fy(s.aim.power)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(mx - 14, y - 6)
      ctx.lineTo(mx - 5, y)
      ctx.lineTo(mx - 14, y + 6)
      ctx.closePath()
      ctx.fill()
    }
    ctx.font = `7px "Press Start 2P", monospace`
    ctx.textAlign = 'center'
    ctx.fillStyle = '#9fb3ff'
    ctx.fillText('FUERZA', mx, my0 - 16)

    if (s.phase === 'aim') {
      if (s.aim) {
        const soft = s.aim.power < MIN_POWER
        numText(ctx, soft ? 'MÁS FUERTE' : s.aim.power > SWEET + 1000 ? '¡MUY FUERTE!' : 'SUELTA', BW / 2, BH - 20, 14, soft ? '#ff9aa6' : '#ffffff', '#07031a')
      } else if (!s.drag.length) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5)
        numText(ctx, 'ARRASTRA Y SUELTA', BW / 2, BH - 20, 14, '#ffffff', '#07031a')
        ctx.globalAlpha = 1
      }
    }

    // ── marcador arriba: tiquetes y cocos que quedan ──
    const label = (v: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign) => {
      ctx.font = `${size}px "Press Start 2P", monospace`
      ctx.textAlign = align
      ctx.textBaseline = 'middle'
      ctx.fillStyle = fill
      ctx.fillText(v, x, y)
    }
    ctx.fillStyle = '#07031a'
    ctx.fillRect(0, 0, BW, 44)
    ctx.fillStyle = '#ff2bd6'
    ctx.fillRect(0, 44, BW, 3)
    label('TIQUETES', 12, 15, 8, '#00f0ff', 'left')
    numText(ctx, String(liveTickets(s.score, TICKET_SCALE.bolos)), 12 + String(liveTickets(s.score, TICKET_SCALE.bolos)).length * 8.5, 33, 20, '#ffd400', '#07031a')
    label('COCOS', BW - 12, 12, 8, '#ffd400', 'right')
    for (let i = 0; i < BALLS; i++) {
      ctx.globalAlpha = i >= s.left ? 0.25 : 1
      coconut(ctx, BW - 20 - (BALLS - 1 - i) * 17, 28, 6.5)
    }
    ctx.globalAlpha = 1
    if (s.msg) {
      const k = s.msg.age / 1.3
      ctx.globalAlpha = Math.max(0, 1 - k * k)
      numText(ctx, s.msg.text, BW / 2, 150 - s.msg.age * 16 + 6, 30 + Math.max(0, 0.3 - s.msg.age) * 40, s.msg.color, '#07031a')
      ctx.globalAlpha = 1
    }
  },
  score: (s) => s.score,
  done: (s) => s.left <= 0 && s.phase === 'rest' && s.rest <= 0,
}
