// Motor del minijuego «Nave Caribe»: una nave que dispara sola y destruye puntitos que caen. Pensado para gastar muy poco:
// lógica pura con piscinas de objetos (sin crear objetos mientras se juega), paso de simulación fijo y dibujo en un solo
// canvas 2D con formas simples (sin imágenes, sin degradados por cuadro, sin sombras). El módulo no toca el DOM ni React,
// así se puede probar con un reloj y un generador de azar falsos.

/** Tamaño lógico del campo (el canvas lo escala a la pantalla). */
export const W = 360
export const H = 640

const MAX_BULLETS = 36
const MAX_ENEMIES = 22
const MAX_PARTS = 36
const STARS = 36

const SHIP_Y = 548
const SHIP_R = 13
const FIRE_EVERY = 0.2
const BULLET_SPEED = 560
const LIVES = 3
/** Duración de una ronda: sesiones cortas y acotadas (también cuidan la batería). */
export const ROUND_SECONDS = 90
const INVULN = 1.6
const SHIP_MAX_SPEED = 900
const KEY_SPEED = 400

export type EnemyKind = 0 | 1 | 2
/** 0 puntito (1 golpe) · 1 rombo (3 golpes) · 2 dorado (rápido, vale más). */
export const KIND_SCORE: Record<EnemyKind, number> = { 0: 10, 1: 30, 2: 50 }
const KIND_HP: Record<EnemyKind, number> = { 0: 1, 1: 3, 2: 1 }
const KIND_R: Record<EnemyKind, number> = { 0: 11, 1: 17, 2: 10 }
const KIND_COLOR: Record<EnemyKind, string> = { 0: '#ff5c8a', 1: '#8b5cff', 2: '#ffc83d' }

interface Bullet { on: boolean; x: number; y: number }
interface Enemy { on: boolean; kind: EnemyKind; x: number; y: number; baseX: number; vy: number; hp: number; phase: number; amp: number; flash: number }
interface Part { on: boolean; x: number; y: number; vx: number; vy: number; life: number; color: string }

export interface Game {
  time: number
  score: number
  lives: number
  over: boolean
  kills: number
  shipX: number
  invuln: number
  fireIn: number
  spawnIn: number
  /** Cuánto lleva el último golpe recibido (para el parpadeo del marcador). */
  hurt: number
  bullets: Bullet[]
  enemies: Enemy[]
  parts: Part[]
  stars: { x: number; y: number; s: number; v: number }[]
  rand: () => number
}

/** Generador de azar pequeño y repetible (mulberry32). */
export function makeRand(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createGame(rand: () => number = Math.random): Game {
  return {
    time: 0,
    score: 0,
    lives: LIVES,
    over: false,
    kills: 0,
    shipX: W / 2,
    invuln: 0,
    fireIn: 0.25,
    spawnIn: 0.8,
    hurt: 0,
    bullets: Array.from({ length: MAX_BULLETS }, () => ({ on: false, x: 0, y: 0 })),
    enemies: Array.from({ length: MAX_ENEMIES }, () => ({ on: false, kind: 0 as EnemyKind, x: 0, y: 0, baseX: 0, vy: 0, hp: 0, phase: 0, amp: 0, flash: 0 })),
    parts: Array.from({ length: MAX_PARTS }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '#fff' })),
    stars: Array.from({ length: STARS }, () => ({ x: rand() * W, y: rand() * H, s: rand() < 0.2 ? 2 : 1, v: 14 + rand() * 40 })),
    rand,
  }
}

/** Segundos entre apariciones: baja con el tiempo hasta un mínimo (la partida se pone más intensa, sin volverse imposible). */
export const spawnGap = (t: number) => Math.max(0.3, 0.95 - t * 0.011)
/** Velocidad base de caída. */
export const fallSpeed = (t: number) => Math.min(190, 78 + t * 1.3)

function pickKind(g: Game): EnemyKind {
  const r = g.rand()
  if (g.time > 8 && r < 0.07) return 2
  if (g.time > 18 && r < 0.07 + Math.min(0.3, (g.time - 18) * 0.006)) return 1
  return 0
}

function spawn(g: Game) {
  const e = g.enemies.find((x) => !x.on)
  if (!e) return
  const kind = pickKind(g)
  const r = KIND_R[kind]
  e.on = true
  e.kind = kind
  e.hp = KIND_HP[kind]
  e.baseX = r + 10 + g.rand() * (W - 2 * (r + 10))
  e.x = e.baseX
  e.y = -r
  e.vy = fallSpeed(g.time) * (kind === 2 ? 1.6 : kind === 1 ? 0.7 : 0.85 + g.rand() * 0.4)
  e.phase = g.rand() * 6.28
  e.amp = kind === 0 ? g.rand() * 26 : kind === 2 ? 40 : 0
  e.flash = 0
}

function burst(g: Game, x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const p = g.parts.find((q) => !q.on)
    if (!p) return
    const a = g.rand() * 6.283
    const s = 40 + g.rand() * 110
    p.on = true
    p.x = x
    p.y = y
    p.vx = Math.cos(a) * s
    p.vy = Math.sin(a) * s
    p.life = 0.35 + g.rand() * 0.25
    p.color = color
  }
}

export interface Input {
  /** Posición objetivo de la nave (toque o ratón), en coordenadas lógicas; null = sin puntero. */
  targetX: number | null
  /** -1 izquierda, 0, 1 derecha (teclado). */
  dir: number
}

/** Avanza la simulación `dt` segundos (paso fijo de ~1/60). */
export function update(g: Game, dt: number, input: Input) {
  if (g.over) return
  g.time += dt
  g.invuln = Math.max(0, g.invuln - dt)
  g.hurt = Math.max(0, g.hurt - dt)

  // nave: el puntero la arrastra con suavidad; el teclado la mueve a velocidad fija
  if (input.dir) g.shipX += input.dir * KEY_SPEED * dt
  else if (input.targetX !== null) {
    const d = input.targetX - g.shipX
    const max = SHIP_MAX_SPEED * dt
    g.shipX += Math.abs(d) < max ? d : Math.sign(d) * max
  }
  g.shipX = Math.max(SHIP_R, Math.min(W - SHIP_R, g.shipX))

  // disparo automático
  g.fireIn -= dt
  if (g.fireIn <= 0) {
    g.fireIn += FIRE_EVERY
    const b = g.bullets.find((x) => !x.on)
    if (b) {
      b.on = true
      b.x = g.shipX
      b.y = SHIP_Y - SHIP_R
    }
  }

  // apariciones
  g.spawnIn -= dt
  while (g.spawnIn <= 0) {
    g.spawnIn += spawnGap(g.time)
    spawn(g)
  }

  for (const b of g.bullets) {
    if (!b.on) continue
    b.y -= BULLET_SPEED * dt
    if (b.y < -10) b.on = false
  }

  for (const e of g.enemies) {
    if (!e.on) continue
    e.y += e.vy * dt
    e.phase += dt * 2.4
    // con el tiempo, los puntitos y rombos se van acercando a la nave: quedarse quieto en una esquina no sirve
    if (e.kind !== 2) {
      const drift = Math.min(45, Math.max(0, g.time - 10) * 1.2)
      const d = g.shipX - e.baseX
      e.baseX += (Math.abs(d) < drift * dt ? d : Math.sign(d) * drift * dt)
    }
    e.x = e.baseX + Math.sin(e.phase) * e.amp
    e.flash = Math.max(0, e.flash - dt)
    const r = KIND_R[e.kind]
    if (e.y > H + r) {
      e.on = false
      continue
    }
    // balas
    for (const b of g.bullets) {
      if (!b.on) continue
      const dx = b.x - e.x
      const dy = b.y - e.y
      if (dx * dx + dy * dy <= (r + 3) * (r + 3)) {
        b.on = false
        e.hp -= 1
        e.flash = 0.08
        if (e.hp <= 0) {
          e.on = false
          g.score += KIND_SCORE[e.kind]
          g.kills += 1
          burst(g, e.x, e.y, KIND_COLOR[e.kind], e.kind === 1 ? 9 : 6)
        }
        break
      }
    }
    if (!e.on) continue
    // choque con la nave
    if (g.invuln <= 0) {
      const dx = g.shipX - e.x
      const dy = SHIP_Y - e.y
      const rr = r + SHIP_R - 3
      if (dx * dx + dy * dy <= rr * rr) {
        e.on = false
        burst(g, e.x, e.y, '#ffffff', 8)
        g.lives -= 1
        g.invuln = INVULN
        g.hurt = 0.4
        if (g.lives <= 0) {
          g.over = true
          burst(g, g.shipX, SHIP_Y, '#4de1ff', 14)
        }
      }
    }
  }

  for (const p of g.parts) {
    if (!p.on) continue
    p.life -= dt
    if (p.life <= 0) {
      p.on = false
      continue
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
  }

  if (g.time >= ROUND_SECONDS) g.over = true

  for (const s of g.stars) {
    s.y += s.v * dt
    if (s.y > H) {
      s.y = 0
      s.x = g.rand() * W
    }
  }
}

/** Dibuja el cuadro. `ctx` ya viene escalado para que 1 unidad = 1 unidad lógica. */
export function draw(g: Game, ctx: CanvasRenderingContext2D, reduceMotion = false) {
  ctx.fillStyle = '#070b24'
  ctx.fillRect(0, 0, W, H)

  // estrellas (un solo trazo por tamaño)
  ctx.fillStyle = '#9fb3ff'
  for (const s of g.stars) if (s.s === 1) ctx.fillRect(s.x, s.y, 1, 1)
  ctx.fillStyle = '#e6ecff'
  for (const s of g.stars) if (s.s === 2) ctx.fillRect(s.x, s.y, 2, 2)

  // balas
  ctx.fillStyle = '#4de1ff'
  for (const b of g.bullets) if (b.on) ctx.fillRect(b.x - 1.5, b.y - 8, 3, 12)

  // enemigos
  for (const e of g.enemies) {
    if (!e.on) continue
    const r = KIND_R[e.kind]
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : KIND_COLOR[e.kind]
    if (e.kind === 1) {
      ctx.beginPath()
      ctx.moveTo(e.x, e.y - r)
      ctx.lineTo(e.x + r, e.y)
      ctx.lineTo(e.x, e.y + r)
      ctx.lineTo(e.x - r, e.y)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#2a1466'
      ctx.fillRect(e.x - 4, e.y - 4, 8, 8)
    } else {
      ctx.beginPath()
      ctx.arc(e.x, e.y, r, 0, 6.2832)
      ctx.fill()
      ctx.fillStyle = e.kind === 2 ? '#fff3bf' : '#ffd0de'
      ctx.beginPath()
      ctx.arc(e.x - r * 0.3, e.y - r * 0.3, r * 0.3, 0, 6.2832)
      ctx.fill()
    }
  }

  // partículas
  for (const p of g.parts) {
    if (!p.on) continue
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
  }

  // nave (parpadea mientras es invulnerable)
  if (!g.over && (g.invuln <= 0 || Math.floor(g.time * 14) % 2 === 0)) {
    const x = g.shipX
    const y = SHIP_Y
    ctx.fillStyle = '#4de1ff'
    ctx.beginPath()
    ctx.moveTo(x, y - SHIP_R - 4)
    ctx.lineTo(x + SHIP_R, y + SHIP_R)
    ctx.lineTo(x, y + SHIP_R - 5)
    ctx.lineTo(x - SHIP_R, y + SHIP_R)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 2, y - 6, 4, 8)
    // llama del motor
    if (!reduceMotion) {
      ctx.fillStyle = Math.floor(g.time * 30) % 2 ? '#ffb347' : '#ff7a3d'
      ctx.fillRect(x - 3, y + SHIP_R - 4, 6, 6 + (Math.floor(g.time * 30) % 3))
    }
  }

  // tiempo restante: una barra fina arriba
  ctx.fillStyle = '#4de1ff'
  ctx.fillRect(0, 0, W * Math.max(0, 1 - g.time / ROUND_SECONDS), 3)

  // marcador
  ctx.font = '700 18px Manrope, system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(g.score), 14, 12)
  ctx.textAlign = 'right'
  for (let i = 0; i < LIVES; i++) {
    ctx.fillStyle = i < g.lives ? (g.hurt > 0 && i === g.lives ? '#ffffff' : '#ff5c8a') : '#33385f'
    ctx.beginPath()
    ctx.arc(W - 18 - i * 22, 22, 7, 0, 6.2832)
    ctx.fill()
  }
}
