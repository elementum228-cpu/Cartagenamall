// Los dos juegos nuevos de la Zona Arcade: «Cangrejos Locos» (reflejos) y «Bolos de coco» (lanzamiento, como el Skee-Ball). Cada uno es
// una definición pura (estado, avance, dibujo y toques) que el marco `MiniGame` mueve en un lienzo 2D. No usan servidor: los puntos
// se suman en este dispositivo, igual que en Nave Caribe sin conexión.

import { liveTickets } from '../store'

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
  score(s: S): number
  done(s: S): boolean
}

const FONT = '"Press Start 2P", monospace'

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.font = `${size}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.strokeStyle = '#07031a'
  ctx.strokeText(s, x, y)
  ctx.fillStyle = color
  ctx.fillText(s, x, y)
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

function drawCrab(ctx: CanvasRenderingContext2D, x: number, y: number, kind: CrabKind, k: number, t: number) {
  const body = kind === 'gold' ? '#ffc72e' : kind === 'octo' ? '#7a4fd1' : '#e0414f'
  const dark = kind === 'gold' ? '#b8860b' : kind === 'octo' ? '#4a2a8f' : '#8f1f2b'
  const light = kind === 'gold' ? '#fff3a8' : kind === 'octo' ? '#c3a8ff' : '#ff9aa6'
  ctx.save()
  ctx.translate(x, y - 38 * k)
  ctx.beginPath()
  ctx.rect(-70, -96, 140, 96 + 38 * k - 5)
  ctx.clip()
  ctx.rotate(Math.sin(t * 9) * 0.05)
  const grad = (cx: number, cy: number, r: number) => {
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r)
    g.addColorStop(0, light)
    g.addColorStop(0.45, body)
    g.addColorStop(1, dark)
    return g
  }
  ctx.lineWidth = 3
  ctx.strokeStyle = '#07031a'
  if (kind === 'octo') {
    // pulpo malo: cabeza grande con cejas enojadas y tentáculos que se mueven
    ctx.lineCap = 'round'
    for (const sx of [-1, 0, 1]) {
      ctx.strokeStyle = dark
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.moveTo(sx * 16, 8)
      ctx.quadraticCurveTo(sx * 34, 20 + Math.sin(t * 8 + sx) * 5, sx * 28, 40)
      ctx.stroke()
    }
    ctx.lineWidth = 3
    ctx.strokeStyle = '#07031a'
    ctx.fillStyle = grad(0, -8, 34)
    ctx.beginPath()
    ctx.ellipse(0, -8, 32, 30, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(sx * 12, -8, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#07031a'
      ctx.beginPath()
      ctx.arc(sx * 12, -6, 3.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(-24, -26)
    ctx.lineTo(-6, -16)
    ctx.moveTo(24, -26)
    ctx.lineTo(6, -16)
    ctx.stroke()
  } else {
    // pinzas que abren y cierran
    for (const sx of [-1, 1]) {
      const open = Math.sin(t * 10 + sx) * 0.25
      ctx.save()
      ctx.translate(sx * 38, -20)
      ctx.rotate(sx * (0.5 + open))
      ctx.fillStyle = grad(0, 0, 18)
      ctx.beginPath()
      ctx.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#07031a'
      ctx.beginPath()
      ctx.moveTo(sx * 4, -4)
      ctx.lineTo(sx * 18, -12 - open * 12)
      ctx.lineTo(sx * 16, 0)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    // patas
    ctx.strokeStyle = dark
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    for (const sx of [-1, 1])
      for (const j of [0, 1, 2]) {
        ctx.beginPath()
        ctx.moveTo(sx * 20, 6 + j * 4)
        ctx.lineTo(sx * (34 + j * 4), 16 + j * 5 + Math.sin(t * 12 + j) * 2)
        ctx.stroke()
      }
    // caparazón
    ctx.lineWidth = 3
    ctx.strokeStyle = '#07031a'
    ctx.fillStyle = grad(0, -4, 34)
    ctx.beginPath()
    ctx.ellipse(0, -2, 33, 25, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // manchitas
    ctx.fillStyle = dark
    for (const [dx, dy] of [[-14, 6], [10, 8], [0, 12]]) {
      ctx.beginPath()
      ctx.arc(dx, dy, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    // ojos en tallos
    for (const sx of [-1, 1]) {
      ctx.strokeStyle = dark
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(sx * 11, -20)
      ctx.lineTo(sx * 12, -30)
      ctx.stroke()
      ctx.strokeStyle = '#07031a'
      ctx.lineWidth = 2.5
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(sx * 12, -34, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#07031a'
      ctx.beginPath()
      ctx.arc(sx * 12 + 1, -33, 3.4, 0, Math.PI * 2)
      ctx.fill()
    }
    // sonrisa
    ctx.strokeStyle = '#07031a'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, -6, 9, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
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
    const sx = s.shake > 0 ? (Math.random() - 0.5) * 8 : 0
    const txt = (v: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'left') => text(ctx, v, x, y, size, fill, align)
    ctx.save()
    ctx.translate(sx, 0)
    // ── atardecer caribeño: cielo, sol con reflejo, palmeras de silueta y mar ──
    const sky = ctx.createLinearGradient(0, 0, 0, 170)
    sky.addColorStop(0, '#2a1a73')
    sky.addColorStop(0.55, '#c8456f')
    sky.addColorStop(1, '#ffa05c')
    ctx.fillStyle = sky
    ctx.fillRect(-10, 0, CW + 20, 170)
    ctx.fillStyle = '#ffe08a'
    ctx.beginPath()
    ctx.arc(CW - 76, 128, 32, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,224,138,.35)'
    ctx.beginPath()
    ctx.arc(CW - 76, 128, 44, 0, Math.PI * 2)
    ctx.fill()
    const sea = ctx.createLinearGradient(0, 136, 0, 180)
    sea.addColorStop(0, '#1d7ea0')
    sea.addColorStop(1, '#0f4d73')
    ctx.fillStyle = sea
    ctx.fillRect(-10, 136, CW + 20, 44)
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(255,255,255,.28)'
      ctx.fillRect(40 + i * 56 + Math.sin(t * 1.5 + i) * 6, 148 + (i % 3) * 9, 22, 2)
    }
    ctx.fillStyle = '#1a0f45'
    for (const px of [34, CW - 34]) {
      ctx.fillRect(px - 2, 84, 5, 56)
      for (let k = 0; k < 5; k++) {
        const a = -0.9 + k * 0.45
        ctx.beginPath()
        ctx.ellipse(px + Math.sin(a) * 15, 84 - Math.cos(a) * 7, 15, 4.5, a, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // ── arena ──
    const sand = ctx.createLinearGradient(0, 176, 0, CH)
    sand.addColorStop(0, '#f1d49b')
    sand.addColorStop(1, '#d4a965')
    ctx.fillStyle = sand
    ctx.fillRect(-10, 176, CW + 20, CH)
    ctx.fillStyle = 'rgba(160,110,50,.35)'
    for (let i = 0; i < 28; i++) ctx.fillRect((i * 97) % CW, 190 + ((i * 53) % 360), 7, 2)
    // conchitas
    for (const [cx, cy] of [[22, 262], [CW - 24, 390], [30, 520], [CW - 30, 250]]) {
      ctx.fillStyle = '#fff3e0'
      ctx.beginPath()
      ctx.arc(cx, cy, 6, Math.PI, 0)
      ctx.fill()
    }
    // ── agujeros (montículos de arena) ──
    for (const h of s.holes) {
      ctx.fillStyle = '#9b6e32'
      ctx.beginPath()
      ctx.ellipse(h.x, h.y + 8, 56, 23, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#c99a55'
      ctx.beginPath()
      ctx.ellipse(h.x, h.y + 5, 52, 20, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2a1a08'
      ctx.beginPath()
      ctx.ellipse(h.x, h.y + 4, 43, 15, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // ── cangrejos, con el borde del agujero por delante ──
    for (const h of s.holes) {
      if (!h.kind) continue
      const u = h.age / h.dur
      const k = u < 0.18 ? u / 0.18 : u > 0.82 ? Math.max(0, (1 - u) / 0.18) : 1
      drawCrab(ctx, h.x, h.y, h.kind, k, t)
      ctx.fillStyle = '#c99a55'
      ctx.beginPath()
      ctx.ellipse(h.x, h.y + 12, 52, 11, 0, 0, Math.PI)
      ctx.fill()
      ctx.strokeStyle = '#9b6e32'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(h.x, h.y + 12, 52, 11, 0, 0, Math.PI)
      ctx.stroke()
    }
    // ── destellos de acierto y mazos ──
    for (const b of s.bursts) {
      const u = b.age / 0.5
      ctx.globalAlpha = 1 - u
      ctx.strokeStyle = b.color
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(b.x, b.y, 12 + u * 38, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = b.color
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        ctx.fillRect(b.x + Math.cos(a) * (10 + u * 46) - 2.5, b.y + Math.sin(a) * (10 + u * 46) - 2.5, 5, 5)
      }
    }
    ctx.globalAlpha = 1
    for (const m of s.mallets) {
      const u = m.age / 0.3
      const ang = -1.0 + Math.min(1, u * 3) * 1.15
      ctx.save()
      ctx.globalAlpha = 1 - Math.max(0, u - 0.5) * 2
      ctx.translate(m.x + 8, m.y - 6)
      ctx.rotate(ang)
      ctx.fillStyle = '#8a5a2b'
      ctx.fillRect(-4, -4, 8, 62)
      ctx.strokeStyle = '#07031a'
      ctx.lineWidth = 2
      ctx.strokeRect(-4, -4, 8, 62)
      ctx.fillStyle = '#ffd34e'
      ctx.fillRect(-22, -24, 44, 26)
      ctx.strokeRect(-22, -24, 44, 26)
      ctx.fillStyle = '#ffeb99'
      ctx.fillRect(-18, -21, 36, 6)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    for (const p of s.pops) {
      ctx.globalAlpha = 1 - p.age / 0.8
      txt(p.text, p.x, p.y - p.age * 44, 15, p.color, 'center')
    }
    ctx.globalAlpha = 1
    ctx.restore()
    // ── luces de feria a los lados del campo ──
    for (let i = 0; i < 16; i++) {
      const y = 62 + i * 31
      const on = (i + Math.floor(t * 7)) % 3 === 0
      ctx.fillStyle = on ? ['#ffd400', '#ff2bd6', '#00f0ff'][i % 3] : '#3a2a70'
      ctx.beginPath()
      ctx.arc(7, y, 3, 0, Math.PI * 2)
      ctx.arc(CW - 7, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    // ── marcador arriba: tiquetes, racha y tiempo ──
    ctx.fillStyle = '#07031a'
    ctx.fillRect(0, 0, CW, 50)
    ctx.fillStyle = '#ff2bd6'
    ctx.fillRect(0, 50, CW, 3)
    txt('TIQUETES', 12, 15, 8, '#00f0ff')
    txt(String(liveTickets(s.score)), 12, 34, 14, '#ffd400')
    const mult = Math.min(5, 1 + Math.floor(s.combo / 4))
    txt(s.combo > 1 ? `RACHA ${s.combo}` : 'RACHA', CW / 2, 15, 8, '#7dffa6', 'center')
    // medidor de racha: cuatro aciertos suben el multiplicador
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < s.combo % 4 || mult === 5 ? '#7dffa6' : '#2a2160'
      ctx.fillRect(CW / 2 - 38 + i * 20, 24, 17, 9)
    }
    txt(`x${mult}`, CW / 2, 41, 8, mult > 1 ? '#ffd400' : '#9fb3ff', 'center')
    txt('TIEMPO', CW - 12, 15, 8, s.left < 10 ? '#ff5c8a' : '#00f0ff', 'right')
    txt(`${Math.ceil(s.left)}s`, CW - 12, 34, 14, s.left < 10 ? '#ff5c8a' : '#ffffff', 'right')
    ctx.fillStyle = s.left < 10 ? '#ff5c8a' : '#00f0ff'
    ctx.fillRect(0, 47, (CW * s.left) / TIME, 3)
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
  { x: 40, y: 100, r: 18, v: 100 },
  { x: BW - 40, y: 100, r: 18, v: 100 },
]
const START = { x: BW / 2, y: 500 }
const RAMP_Y = 246
const LANE = { l: 92, r: BW - 92 }
const BALLS = 9
/** Fuerza del deslizamiento (px/s del campo): por debajo de MIN el coco no llega a la rampa; en ~1900 cae al centro; MAX es el tope. */
const MIN_POWER = 700
const MAX_POWER = 3300

type BPhase = 'aim' | 'roll' | 'fly' | 'rest'
interface Landed {
  x: number
  y: number
  v: number
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
  fly: { t: number; sx: number; sy: number; ex: number; ey: number } | null
  landed: Landed[]
  rest: number
  msg: { text: string; age: number; color: string } | null
  trail: { x: number; y: number; t: number }[]
  /** Destellos al caer un coco (aro iluminado y chispas). */
  bursts: { x: number; y: number; age: number; color: string; big: boolean }[]
  drag: { x: number; y: number; t: number }[]
}

function ringValue(x: number, y: number): number {
  for (const h of HOLES) if (Math.hypot(x - h.x, y - h.y) < h.r) return h.v
  const d = Math.hypot(x - BOARD.x, y - BOARD.y)
  for (let i = RINGS.length - 1; i >= 0; i--) if (d < RINGS[i].r) return RINGS[i].v
  return 0
}

function coconut(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#6b4423'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8a5a2b'
  ctx.beginPath()
  ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2a170a'
  for (const [dx, dy] of [[-0.2, 0.1], [0.2, 0.1], [0, 0.4]]) {
    ctx.beginPath()
    ctx.arc(x + dx * r, y + dy * r, r * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#07031a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
}

export const BOWLS: GameDef<BowlsState> = {
  id: 'bolos',
  name: 'Bolos de coco',
  W: BW,
  H: BH,
  how: 'Desliza el dedo hacia arriba para lanzar el coco. Más rápido llega más lejos. Apunta al centro: 50 puntos, y las esquinas dan 100.',
  create: () => ({ left: BALLS, score: 0, phase: 'aim', x: START.x, y: START.y, vx: 0, vy: 0, power: 0, fly: null, landed: [], rest: 0, msg: null, trail: [], bursts: [], drag: [] }),
  update(s, dt) {
    if (s.msg) {
      s.msg.age += dt
      if (s.msg.age > 1.2) s.msg = null
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
        s.msg = { text: '¡MUY SUAVE!', age: 0, color: '#ff9aa6' }
      } else if (s.y <= RAMP_Y) {
        const k = Math.min(1, Math.max(0, (s.power - MIN_POWER) / (MAX_POWER - MIN_POWER)))
        const landY = RAMP_Y - 6 - k * 190
        s.fly = { t: 0, sx: s.x, sy: s.y, ex: BOARD.x + (s.x - BW / 2) * 1.1 + s.vx * 0.15, ey: landY }
        s.phase = 'fly'
      }
    } else if (s.phase === 'fly' && s.fly) {
      s.fly.t += dt / 0.55
      if (s.fly.t >= 1) {
        const { ex, ey } = s.fly
        const v = ringValue(ex, ey)
        s.score += v
        s.landed.push({ x: ex, y: ey, v })
        s.bursts.push({ x: ex, y: ey, age: 0, color: v >= 100 ? '#ffe36b' : v >= 40 ? '#7dffa6' : v > 0 ? '#00f0ff' : '#ff9aa6', big: v >= 40 })
        s.fly = null
        s.phase = 'rest'
        s.rest = 0.9
        s.left--
        s.msg = v > 0 ? { text: `+${v}`, age: 0, color: v >= 100 ? '#ffe36b' : v >= 40 ? '#7dffa6' : '#00f0ff' } : { text: '¡FALLASTE!', age: 0, color: '#ff9aa6' }
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
    s.trail = s.trail.filter((p) => p.t < 0.35)
    for (const b of s.bursts) b.age += dt
    s.bursts = s.bursts.filter((b) => b.age < 0.7)
  },
  pointer(s, kind, x, y, t) {
    if (s.phase !== 'aim') return
    if (kind === 'down') s.drag = [{ x, y, t }]
    else if (kind === 'move' && s.drag.length) {
      s.drag.push({ x, y, t })
      if (s.drag.length > 8) s.drag.shift()
    } else if (kind === 'up' && s.drag.length > 1) {
      s.drag.push({ x, y, t })
      const a = s.drag[0]
      const b = s.drag[s.drag.length - 1]
      const dtm = Math.max(0.04, (b.t - a.t) / 1000)
      const vx = (b.x - a.x) / dtm
      const vy = (b.y - a.y) / dtm
      s.drag = []
      if (vy > -300) return // no fue hacia arriba: se ignora y puede volver a intentar
      s.power = Math.min(MAX_POWER, -vy)
      s.vx = Math.max(-240, Math.min(240, vx * 0.12))
      s.vy = -(420 + Math.min(MAX_POWER, -vy) * 0.28)
      s.phase = 'roll'
      return { sfx: 'pop' }
    } else if (kind === 'up') s.drag = []
  },
  draw(s, ctx, t) {
    const lamp = (i: number, on: boolean) => (on ? ['#ffd400', '#ff2bd6', '#00f0ff'][i % 3] : '#2a2160')
    // ── fondo: interior de la máquina, con paneles y estrellitas ──
    const bg = ctx.createLinearGradient(0, 0, 0, BH)
    bg.addColorStop(0, '#1a0f55')
    bg.addColorStop(1, '#0a0624')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, BW, BH)
    for (let i = 0; i < 26; i++) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i))
      ctx.globalAlpha = tw * 0.7
      ctx.fillStyle = i % 3 === 0 ? '#ff2bd6' : i % 3 === 1 ? '#00f0ff' : '#ffd400'
      ctx.fillRect((i * 83) % BW, 270 + ((i * 47) % 280), 3, 3)
    }
    ctx.globalAlpha = 1
    // paneles laterales con franjas de colores
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
    // flechas que suben (guían el lanzamiento)
    for (let i = 0; i < 4; i++) {
      const u = ((t * 0.5 + i / 4) % 1)
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
    // rampa: labio iluminado donde el coco salta hacia el tablero
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
      const u = i / nl
      const x = 22 + u * (BW - 44)
      const on = (i + Math.floor(t * 8)) % 3 === 0
      ctx.fillStyle = lamp(i, on)
      ctx.beginPath()
      ctx.arc(x, 60, 2.6, 0, Math.PI * 2)
      ctx.arc(x, 242, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const r of RINGS) {
      ctx.fillStyle = r.c
      ctx.beginPath()
      ctx.arc(BOARD.x, BOARD.y, r.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#07031a'
      ctx.lineWidth = 3
      ctx.stroke()
      // brillo del borde de arriba a la izquierda
      ctx.strokeStyle = r.hi
      ctx.globalAlpha = 0.65
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(BOARD.x, BOARD.y, r.r - 3, Math.PI * 1.05, Math.PI * 1.55)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    // valores claros en la línea de cada aro (a la derecha del centro, uno por aro)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = (v: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'center') => {
      ctx.textAlign = align
      ctx.font = `${size}px ${FONT}`
      ctx.lineWidth = 3
      ctx.strokeStyle = '#07031a'
      ctx.strokeText(v, x, y)
      ctx.fillStyle = fill
      ctx.fillText(v, x, y)
    }
    const mids = [81.5, 61, 41.5, 23.5]
    RINGS.slice(0, 4).forEach((r, i) => label(String(r.v), BOARD.x + mids[i] * 0.72, BOARD.y - mids[i] * 0.69, 10, '#ffffff'))
    label('50', BOARD.x, BOARD.y + 1, 9, '#1a0f55')
    // portales de 100 en las esquinas
    for (const h of HOLES) {
      ctx.fillStyle = '#07031a'
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r + 4, 0, Math.PI * 2)
      ctx.fill()
      const g = ctx.createRadialGradient(h.x - 4, h.y - 4, 2, h.x, h.y, h.r)
      g.addColorStop(0, '#fff3a0')
      g.addColorStop(1, '#ffb000')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2)
      ctx.fill()
      label('100', h.x, h.y + 1, 9, '#2a1405')
    }
    // destellos de los aciertos
    for (const b of s.bursts) {
      const u = b.age / 0.7
      ctx.globalAlpha = 1 - u
      ctx.strokeStyle = b.color
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(b.x, b.y, 10 + u * (b.big ? 46 : 28), 0, Math.PI * 2)
      ctx.stroke()
      if (b.big)
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2
          ctx.fillStyle = b.color
          ctx.fillRect(b.x + Math.cos(a) * (14 + u * 54) - 2, b.y + Math.sin(a) * (14 + u * 54) - 2, 4, 4)
        }
    }
    ctx.globalAlpha = 1
    // cocos ya caídos en el tablero
    for (const l of s.landed) coconut(ctx, l.x, l.y, 9)

    // ── estela y coco en juego (con sombra sobre el carril) ──
    for (const p of s.trail) {
      ctx.globalAlpha = Math.max(0, 0.5 - p.t * 1.4)
      ctx.fillStyle = '#ffd36b'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    const shadow = (x: number, y: number, r: number) => {
      ctx.fillStyle = 'rgba(0,0,0,.35)'
      ctx.beginPath()
      ctx.ellipse(x + 3, y + r * 0.9, r * 0.95, r * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    if (s.phase === 'fly' && s.fly) {
      const f = s.fly
      const u = f.t
      const x = f.sx + (f.ex - f.sx) * u
      const gy = f.sy + (f.ey - f.sy) * u
      const y = gy - Math.sin(u * Math.PI) * 46
      shadow(x, gy + 8, 14 - u * 5)
      coconut(ctx, x, y, 17 - u * 8)
    } else if (s.phase === 'aim' || s.phase === 'roll') {
      shadow(s.x, s.y, 22)
      coconut(ctx, s.x, s.y, 22)
    }
    if (s.phase === 'aim') {
      const k = (t % 1.2) / 1.2
      ctx.globalAlpha = 0.9 * (1 - k)
      label('DESLIZA ARRIBA', BW / 2, BH - 20, 9, '#ffffff')
      ctx.globalAlpha = 1
    }

    // ── marcador arriba: tiquetes y cocos que quedan ──
    ctx.fillStyle = '#07031a'
    ctx.fillRect(0, 0, BW, 44)
    ctx.fillStyle = '#ff2bd6'
    ctx.fillRect(0, 44, BW, 3)
    label('TIQUETES', 12, 15, 8, '#00f0ff', 'left')
    label(String(liveTickets(s.score)), 12, 33, 14, '#ffd400', 'left')
    for (let i = 0; i < BALLS; i++) {
      const used = i >= s.left
      ctx.globalAlpha = used ? 0.25 : 1
      coconut(ctx, BW - 20 - (BALLS - 1 - i) * 17, 28, 6.5)
    }
    ctx.globalAlpha = 1
    label('COCOS', BW - 12, 12, 8, '#ffd400', 'right')
    if (s.msg) {
      ctx.globalAlpha = Math.max(0, 1 - s.msg.age / 1.2)
      label(s.msg.text, BW / 2, 150 - s.msg.age * 14, 20, s.msg.color)
      ctx.globalAlpha = 1
    }
  },
  score: (s) => s.score,
  done: (s) => s.left <= 0 && s.phase === 'rest' && s.rest <= 0,
}
