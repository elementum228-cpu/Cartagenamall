// Los dos juegos nuevos de la Zona Arcade: «Cangrejos Locos» (reflejos) y «Bolos de coco» (lanzamiento, como el Skee-Ball). Cada uno es
// una definición pura (estado, avance, dibujo y toques) que el marco `MiniGame` mueve en un lienzo 2D. No usan servidor: los puntos
// se suman en este dispositivo, igual que en Nave Caribe sin conexión.

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
  shake: number
  seed: number
}

function rnd(s: { seed: number }) {
  s.seed = (s.seed * 1664525 + 1013904223) >>> 0
  return s.seed / 4294967296
}

function drawCrab(ctx: CanvasRenderingContext2D, x: number, y: number, kind: CrabKind, k: number, t: number) {
  const body = kind === 'gold' ? '#ffcf3d' : kind === 'octo' ? '#7a4fd1' : '#e0525f'
  const light = kind === 'gold' ? '#fff0a8' : kind === 'octo' ? '#b99cff' : '#ff9aa6'
  ctx.save()
  ctx.translate(x, y - 34 * k)
  ctx.beginPath()
  ctx.rect(-60, -80, 120, 80 + 34 * k - 6)
  ctx.clip()
  const sway = Math.sin(t * 9) * 0.05
  ctx.rotate(sway)
  if (kind === 'octo') {
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.ellipse(0, -6, 30, 28, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = light
    ctx.beginPath()
    ctx.ellipse(-9, -14, 8, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = body
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(sx * 22, 12)
      ctx.quadraticCurveTo(sx * 40, 22 + Math.sin(t * 8) * 4, sx * 34, 38)
      ctx.stroke()
    }
    // cara enojada: cejas
    ctx.strokeStyle = '#07031a'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-18, -14)
    ctx.lineTo(-6, -8)
    ctx.moveTo(18, -14)
    ctx.lineTo(6, -8)
    ctx.stroke()
  } else {
    // pinzas
    ctx.fillStyle = body
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(sx * 36, -22 + Math.sin(t * 10 + sx) * 3, 15, 12, sx * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#07031a'
      ctx.beginPath()
      ctx.moveTo(sx * 36, -22)
      ctx.lineTo(sx * 46, -30)
      ctx.lineTo(sx * 44, -18)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = body
    }
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.ellipse(0, -6, 30, 24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = light
    ctx.beginPath()
    ctx.ellipse(-8, -14, 9, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    // ojos
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(sx * 11, -26, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#07031a'
      ctx.beginPath()
      ctx.arc(sx * 11, -25, 3.2, 0, Math.PI * 2)
      ctx.fill()
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
    for (const h of s.holes) {
      if (!h.kind || h.hit) continue
      if (Math.abs(x - h.x) < 52 && y < h.y + 14 && y > h.y - 84) {
        h.hit = true
        const kindHit = h.kind
        h.age = Math.max(h.age, h.dur - 0.12) // se hunde enseguida
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
    ctx.save()
    ctx.translate(sx, 0)
    // cielo y mar
    const sky = ctx.createLinearGradient(0, 0, 0, 150)
    sky.addColorStop(0, '#1b2a6b')
    sky.addColorStop(1, '#ff8a5c')
    ctx.fillStyle = sky
    ctx.fillRect(-10, 0, CW + 20, 150)
    ctx.fillStyle = '#ffd36b'
    ctx.beginPath()
    ctx.arc(CW - 70, 112, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1f6f8f'
    ctx.fillRect(-10, 120, CW + 20, 40)
    // arena
    ctx.fillStyle = '#e6c88c'
    ctx.fillRect(-10, 150, CW + 20, CH)
    ctx.fillStyle = '#d4b377'
    for (let i = 0; i < 26; i++) ctx.fillRect(((i * 97) % CW), 165 + ((i * 53) % 390), 6, 2)
    // agujeros
    for (const h of s.holes) {
      ctx.fillStyle = '#7a5b30'
      ctx.beginPath()
      ctx.ellipse(h.x, h.y + 6, 50, 20, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2c1b0a'
      ctx.beginPath()
      ctx.ellipse(h.x, h.y + 4, 42, 15, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // cangrejos (de atrás hacia adelante para que se tapen bien)
    for (const h of s.holes) {
      if (!h.kind) continue
      const u = h.age / h.dur
      const k = u < 0.18 ? u / 0.18 : u > 0.82 ? Math.max(0, (1 - u) / 0.18) : 1
      drawCrab(ctx, h.x, h.y, h.kind, k, t)
      // borde frontal del agujero encima del cangrejo
      ctx.fillStyle = '#7a5b30'
      ctx.beginPath()
      ctx.ellipse(h.x, h.y + 12, 50, 12, 0, 0, Math.PI)
      ctx.fill()
    }
    for (const p of s.pops) {
      ctx.globalAlpha = 1 - p.age / 0.8
      text(ctx, p.text, p.x, p.y - p.age * 40, 14, p.color, 'center')
    }
    ctx.globalAlpha = 1
    ctx.restore()
    // marcador
    ctx.fillStyle = 'rgba(7,3,26,.72)'
    ctx.fillRect(0, 0, CW, 54)
    text(ctx, `PTS ${s.score}`, 12, 20, 12, '#ffd400')
    text(ctx, `${Math.ceil(s.left)}s`, CW - 12, 20, 12, s.left < 10 ? '#ff5c8a' : '#00f0ff', 'right')
    const mult = Math.min(5, 1 + Math.floor(s.combo / 4))
    text(ctx, s.combo > 1 ? `RACHA ${s.combo}  x${mult}` : 'RACHA 0', 12, 40, 9, '#7dffa6')
    ctx.fillStyle = '#00f0ff'
    ctx.fillRect(0, 51, (CW * s.left) / TIME, 3)
  },
  score: (s) => s.score,
  done: (s) => s.left <= 0,
}

// ── Bolos de coco ─────────────────────────────────────────────────────────────────────────────────

const BW = 360
const BH = 560
const BOARD = { x: BW / 2, y: 112 }
const RINGS: { r: number; v: number; c: string }[] = [
  { r: 74, v: 10, c: '#3f8fd8' },
  { r: 56, v: 20, c: '#5fc9b8' },
  { r: 40, v: 30, c: '#f0b530' },
  { r: 25, v: 40, c: '#e0525f' },
  { r: 11, v: 50, c: '#ffffff' },
]
const HOLES: { x: number; y: number; r: number; v: number }[] = [
  { x: 42, y: 80, r: 15, v: 100 },
  { x: BW - 42, y: 80, r: 15, v: 100 },
]
const START = { x: BW / 2, y: 500 }
const RAMP_Y = 205
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
  create: () => ({ left: BALLS, score: 0, phase: 'aim', x: START.x, y: START.y, vx: 0, vy: 0, power: 0, fly: null, landed: [], rest: 0, msg: null, trail: [], drag: [] }),
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
  draw(s, ctx) {
    // fondo del salón
    ctx.fillStyle = '#10153a'
    ctx.fillRect(0, 0, BW, BH)
    // carril en perspectiva
    ctx.fillStyle = '#7a4a1f'
    ctx.beginPath()
    ctx.moveTo(LANE.l - 14, BH)
    ctx.lineTo(LANE.l + 30, RAMP_Y)
    ctx.lineTo(LANE.r - 30, RAMP_Y)
    ctx.lineTo(LANE.r + 14, BH)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#b57a3a'
    ctx.beginPath()
    ctx.moveTo(LANE.l, BH)
    ctx.lineTo(LANE.l + 36, RAMP_Y)
    ctx.lineTo(LANE.r - 36, RAMP_Y)
    ctx.lineTo(LANE.r, BH)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.12)'
    ctx.lineWidth = 2
    for (let i = 1; i < 5; i++) {
      const k = i / 5
      ctx.beginPath()
      ctx.moveTo(LANE.l + (LANE.r - LANE.l) * k, BH)
      ctx.lineTo(LANE.l + 36 + (LANE.r - LANE.l - 72) * k, RAMP_Y)
      ctx.stroke()
    }
    // tablero con aros
    ctx.fillStyle = '#1d2250'
    rr(ctx, 12, 14, BW - 24, 178, 22)
    ctx.fill()
    ctx.strokeStyle = '#07031a'
    ctx.lineWidth = 4
    ctx.stroke()
    for (const r of RINGS) {
      ctx.fillStyle = r.c
      ctx.beginPath()
      ctx.arc(BOARD.x, BOARD.y, r.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#07031a'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.fillStyle = '#07031a'
    for (const [i, r] of RINGS.entries()) text(ctx, String(r.v), BOARD.x, BOARD.y - r.r + (i === 4 ? 11 : 9), i === 4 ? 6 : 8, r.c === '#ffffff' || r.c === '#f0b530' ? '#07031a' : '#ffffff', 'center')
    for (const h of HOLES) {
      ctx.fillStyle = '#07031a'
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r + 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffd400'
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r - 3, 0, Math.PI * 2)
      ctx.fill()
      text(ctx, '100', h.x, h.y + 1, 7, '#07031a', 'center')
    }
    // cocos ya caídos en el tablero
    for (const l of s.landed) {
      coconut(ctx, l.x, l.y, 7)
    }
    // estela
    for (const p of s.trail) {
      ctx.globalAlpha = Math.max(0, 0.5 - p.t * 1.4)
      ctx.fillStyle = '#ffd36b'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    // coco en juego
    if (s.phase === 'fly' && s.fly) {
      const f = s.fly
      const u = f.t
      const x = f.sx + (f.ex - f.sx) * u
      const y = f.sy + (f.ey - f.sy) * u - Math.sin(u * Math.PI) * 38
      coconut(ctx, x, y, 14 - u * 5)
    } else if (s.phase === 'aim' || s.phase === 'roll') {
      coconut(ctx, s.x, s.y, 17)
    }
    // guía de lanzamiento
    if (s.phase === 'aim') {
      const t = (performance.now() % 1200) / 1200
      ctx.globalAlpha = 0.6 * (1 - t)
      text(ctx, '^', START.x, START.y - 40 - t * 60, 18, '#ffffff', 'center')
      ctx.globalAlpha = 1
      text(ctx, 'DESLIZA ARRIBA', START.x, BH - 22, 9, '#ffffff', 'center')
    }
    // marcador
    ctx.fillStyle = 'rgba(7,3,26,.78)'
    ctx.fillRect(0, BH - 56, 0, 0)
    text(ctx, `PTS ${s.score}`, 18, 218, 12, '#ffd400')
    text(ctx, `COCOS ${Math.max(0, s.left)}`, BW - 18, 218, 10, '#00f0ff', 'right')
    if (s.msg) {
      ctx.globalAlpha = Math.max(0, 1 - s.msg.age / 1.2)
      text(ctx, s.msg.text, BW / 2, 250 - s.msg.age * 20, 18, s.msg.color, 'center')
      ctx.globalAlpha = 1
    }
  },
  score: (s) => s.score,
  done: (s) => s.left <= 0 && s.phase === 'rest' && s.rest <= 0,
}
