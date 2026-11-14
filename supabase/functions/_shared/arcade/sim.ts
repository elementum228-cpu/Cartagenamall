// Simulación del minijuego «Nave Caribe»: una nave que dispara sola y destruye puntitos que caen. Pensado para gastar muy poco:
// lógica pura con piscinas de objetos (sin crear objetos mientras se juega) y paso de simulación fijo. No toca el DOM ni React.
//
// IMPORTANTE: este archivo lo ejecutan DOS lugares, el navegador (para jugar) y el servidor (para repetir la partida y decidir el
// puntaje real: supabase/functions/arcade-run). Por eso debe ser DETERMINISTA: mismas semilla y entradas → mismo resultado, en
// cualquier motor de JavaScript. Solo usa sumas, restas, productos, divisiones y comparaciones (exactas en IEEE-754); nada de
// Math.sin/cos/random ni del reloj dentro de la lógica (Math.sin da resultados distintos entre motores). El azar viene de la semilla.

/** Tamaño lógico del campo (el canvas lo escala a la pantalla). */
export const W = 360
export const H = 720

const MAX_BULLETS = 90
const MAX_PICKUPS = 6
const MAX_ENEMIES = 22
const MAX_PARTS = 36
const STARS = 36

export const SHIP_Y = 628
export const SHIP_R = 13
const FIRE_EVERY = 0.2
/** Cadencia con el premio «rápido». */
const FIRE_RAPID = 0.115
/** Nivel máximo del arma (1 disparo, 2 paralelos, 3 abanico, 5 en abanico) y duración del premio «rápido». */
export const MAX_WEAPON = 4
export const RAPID_SECONDS = 9
/** Premio que cae: velocidad y radio de recogida. */
const PICKUP_VY = 78
const PICKUP_R = 15
const BULLET_SPEED = 560
export const LIVES = 3
/** Duración de una ronda: sesiones cortas y acotadas (también cuidan la batería). */
export const ROUND_SECONDS = 90
const INVULN = 1.6
const SHIP_MAX_SPEED = 900
const KEY_SPEED = 400

export type EnemyKind = 0 | 1 | 2
/** 0 puntito (1 golpe) · 1 rombo (3 golpes) · 2 dorado (rápido, vale más). */
export const KIND_SCORE: Record<EnemyKind, number> = { 0: 10, 1: 30, 2: 50 }
const KIND_HP: Record<EnemyKind, number> = { 0: 1, 1: 3, 2: 1 }
export const KIND_R: Record<EnemyKind, number> = { 0: 11, 1: 17, 2: 10 }
export const KIND_COLOR: Record<EnemyKind, string> = { 0: '#ff5c8a', 1: '#8b5cff', 2: '#ffc83d' }

interface Bullet { on: boolean; x: number; y: number; vx: number }
/** 0 = arma (sube de nivel) · 1 = cadencia rápida por unos segundos. */
export type PickupKind = 0 | 1
interface Pickup { on: boolean; kind: PickupKind; x: number; y: number; phase: number }
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
  /** Nivel del arma (1..MAX_WEAPON): sube con los premios y baja un nivel al recibir un golpe. */
  weapon: number
  /** Segundos que le quedan al premio de cadencia rápida. */
  rapid: number
  /** Enemigos destruidos desde el último premio (para que el premio no tarde demasiado en salir). */
  sinceDrop: number
  /** Premios recogidos (estadística). */
  picked: number
  /** Parpadeo de la nave al recoger un premio (solo para dibujar). */
  glow: number
  bullets: Bullet[]
  pickups: Pickup[]
  enemies: Enemy[]
  parts: Part[]
  stars: { x: number; y: number; s: number; v: number }[]
  rand: () => number
}

/** Seno determinista (parábola con corrección, error < 0,1 %): solo operaciones exactas, igual en todos los motores. */
export function fsin(x: number): number {
  const TWO_PI = 6.283185307179586
  let t = x - TWO_PI * Math.floor(x / TWO_PI + 0.5) // a [-π, π]
  const B = 1.2732395447351628
  const C = -0.4052847345693511
  const y = B * t + C * t * (t < 0 ? -t : t)
  return 0.225 * (y * (y < 0 ? -y : y) - y) + y
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
    weapon: 1,
    rapid: 0,
    sinceDrop: 0,
    picked: 0,
    glow: 0,
    bullets: Array.from({ length: MAX_BULLETS }, () => ({ on: false, x: 0, y: 0, vx: 0 })),
    pickups: Array.from({ length: MAX_PICKUPS }, () => ({ on: false, kind: 0 as PickupKind, x: 0, y: 0, phase: 0 })),
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
    p.vx = fsin(a + 1.5707963) * s
    p.vy = fsin(a) * s
    p.life = 0.35 + g.rand() * 0.25
    p.color = color
  }
}

/** Dispara según el nivel del arma: 1 recto · 2 paralelos · 3 abanico · 4 abanico de cinco. */
function fire(g: Game) {
  const y = SHIP_Y - SHIP_R
  const shots: [number, number][] =
    g.weapon <= 1
      ? [[0, 0]]
      : g.weapon === 2
        ? [[-7, 0], [7, 0]]
        : g.weapon === 3
          ? [[0, 0], [-9, -70], [9, 70]]
          : [[0, 0], [-9, -60], [9, 60], [-16, -135], [16, 135]]
  for (const [dx, vx] of shots) {
    const b = g.bullets.find((x) => !x.on)
    if (!b) return
    b.on = true
    b.x = g.shipX + dx
    b.y = y
    b.vx = vx
  }
}

/** Al destruir un enemigo puede soltar un premio: los dorados siempre, los rombos casi siempre y los puntitos a veces. */
function maybeDrop(g: Game, kind: EnemyKind, x: number, y: number) {
  g.sinceDrop += 1
  const chance = kind === 2 ? 1 : kind === 1 ? 0.45 : 0.13
  const roll = g.rand()
  // «piedad»: si pasan muchos enemigos sin premio, el siguiente lo suelta sí o sí
  if (roll >= chance && g.sinceDrop < 8) return
  const k = g.pickups.find((q) => !q.on)
  if (!k) return
  g.sinceDrop = 0
  k.on = true
  // arma mientras no esté al máximo (en 2 de cada 3); si no, cadencia rápida
  k.kind = g.weapon < MAX_WEAPON && g.rand() < 0.66 ? 0 : 1
  k.x = Math.max(PICKUP_R, Math.min(W - PICKUP_R, x))
  k.y = y
  k.phase = 0
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

  g.rapid = Math.max(0, g.rapid - dt)
  g.glow = Math.max(0, g.glow - dt)

  // disparo automático: el nivel del arma decide cuántos disparos salen (y en qué abanico)
  g.fireIn -= dt
  if (g.fireIn <= 0) {
    g.fireIn += g.rapid > 0 ? FIRE_RAPID : FIRE_EVERY
    fire(g)
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
    b.x += b.vx * dt
    if (b.y < -10 || b.x < -12 || b.x > W + 12) b.on = false
  }

  // premios que caen: recogerlos con la nave
  for (const k of g.pickups) {
    if (!k.on) continue
    k.y += PICKUP_VY * dt
    k.phase += dt * 4
    if (k.y > H + 20) {
      k.on = false
      continue
    }
    const dx = g.shipX - k.x
    const dy = SHIP_Y - k.y
    if (dx * dx + dy * dy <= (PICKUP_R + SHIP_R) * (PICKUP_R + SHIP_R)) {
      k.on = false
      g.picked += 1
      g.glow = 0.5
      if (k.kind === 0) {
        if (g.weapon < MAX_WEAPON) g.weapon += 1
        else g.score += 25 // arma al máximo: el premio se vuelve puntos
      } else g.rapid = RAPID_SECONDS
      burst(g, k.x, k.y, k.kind === 0 ? '#5dff9b' : '#ffb347', 10)
    }
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
    e.x = e.baseX + fsin(e.phase) * e.amp
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
          maybeDrop(g, e.kind, e.x, e.y)
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
        // un golpe cuesta un nivel de arma y la cadencia rápida
        if (g.weapon > 1) g.weapon -= 1
        g.rapid = 0
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

// ── Repetición de una partida (la usa el servidor para verificar el puntaje) ────────────────────────────────────────────────

/** Paso fijo de la simulación (segundos). */
export const STEP = 1 / 60
/** Registro de entradas: tríos [paso, objetivo, dirección]; objetivo = -1 si no hay puntero. Cada trío rige desde ese paso. */
export type InputLog = number[]
/** Tope de pasos de una partida: ronda completa más un margen. */
export const MAX_STEPS = Math.ceil(ROUND_SECONDS / STEP) + 120

export interface ReplayResult {
  score: number
  kills: number
  lives: number
  over: boolean
  steps: number
  /** Segundos de juego simulados. */
  seconds: number
}

/** Anota los cambios de entrada paso a paso (lo usa el navegador mientras se juega). */
export function createRecorder() {
  const log: InputLog = []
  let lastT = -2
  let lastD = 99
  return {
    log,
    /** Llamar antes de cada `update` con el número de paso y la entrada vigente. */
    push(step: number, input: Input) {
      const t = input.targetX === null ? -1 : Math.round(input.targetX)
      if (t !== lastT || input.dir !== lastD) {
        log.push(step, t, input.dir)
        lastT = t
        lastD = input.dir
      }
    },
  }
}

/** Repite la partida con la semilla y las entradas dadas. Devuelve null si el registro es inválido. */
export function replay(seed: number, log: InputLog): ReplayResult | null {
  if (!Number.isInteger(seed) || log.length % 3 !== 0 || log.length > 3 * 6000) return null
  for (let i = 0; i < log.length; i += 3) {
    const [f, t, d] = [log[i], log[i + 1], log[i + 2]]
    if (!Number.isInteger(f) || f < 0 || f > MAX_STEPS || !Number.isInteger(t) || t < -1 || t > W || (d !== -1 && d !== 0 && d !== 1)) return null
    if (i >= 3 && f < log[i - 3]) return null
  }
  const g = createGame(makeRand(seed))
  const input: Input = { targetX: null, dir: 0 }
  let k = 0
  let steps = 0
  while (!g.over && steps < MAX_STEPS) {
    while (k < log.length && log[k] <= steps) {
      input.targetX = log[k + 1] === -1 ? null : log[k + 1]
      input.dir = log[k + 2]
      k += 3
    }
    update(g, STEP, input)
    steps++
  }
  return { score: g.score, kills: g.kills, lives: g.lives, over: g.over, steps, seconds: g.time }
}
