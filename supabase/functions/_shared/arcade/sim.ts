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
const MAX_EBULLETS = 64
const MAX_PARTS = 64
const STARS = 36

export const SHIP_Y = 628
export const SHIP_R = 13
const FIRE_EVERY = 0.24
/** Cadencia con el premio «rápido». */
const FIRE_RAPID = 0.13
/** Nivel máximo del arma (1 disparo, 2 paralelos, 3 abanico, 4 abanico de cinco, 5 abanico de cinco + dos paralelos) y duración del premio «rápido». */
export const MAX_WEAPON = 5
export const RAPID_SECONDS = 9
/** Premio que cae: velocidad y radio de recogida. */
const PICKUP_VY = 78
const PICKUP_R = 15
const BULLET_SPEED = 560
/** Disparos de los cañoneros (enemigos que disparan). */
const EBULLET_SPEED = 205
export const EBULLET_R = 5
export const LIVES = 3
/** Tope de seguridad de una partida (el juego no termina por tiempo: sigue mientras la nave aguante; esto solo acota la repetición del servidor). */
export const MAX_SECONDS = 420
const INVULN = 1.6
const SHIP_MAX_SPEED = 900
const KEY_SPEED = 400

export type EnemyKind = 0 | 1 | 2 | 3
/** 0 puntito (1 golpe) · 1 rombo (3 golpes) · 2 dorado (rápido, vale más) · 3 cañonero (8 golpes, dispara hacia la nave). */
export const KIND_SCORE: Record<EnemyKind, number> = { 0: 6, 1: 18, 2: 30, 3: 72 }
export const KIND_HP: Record<EnemyKind, number> = { 0: 1, 1: 3, 2: 1, 3: 8 }
export const KIND_R: Record<EnemyKind, number> = { 0: 11, 1: 17, 2: 10, 3: 20 }
export const KIND_COLOR: Record<EnemyKind, string> = { 0: '#ff5c8a', 1: '#8b5cff', 2: '#ffc83d', 3: '#ff7a45' }
/** Duración de cada oleada (sube el ritmo y se anuncia en pantalla). Tras la oleada BOSS_EVERY, 2·BOSS_EVERY… llega un jefe. */
export const WAVE_SECONDS = 18
export const BOSS_EVERY = 5
export const BOSS_R = 46
const BOSS_Y = 118

// ── Dificultad elegible ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** 0 Fácil · 1 Normal · 2 Difícil · 3 Extremo. A más dificultad todo baja más rápido y aparece más seguido, pero el puntaje se multiplica. */
export type Difficulty = 0 | 1 | 2 | 3
export interface DifficultyDef {
  id: Difficulty
  name: string
  /** Multiplicador del puntaje en porcentaje (entero: así el puntaje es exacto en cualquier motor). */
  mult: number
  /** Factor de la velocidad de caída. */
  speed: number
  /** Factor de la frecuencia de apariciones. */
  spawn: number
  /** Desde qué segundo aparecen cañoneros. */
  gunnerFrom: number
  /** Cada cuántos segundos llega una formación en V. */
  formationEvery: number
  /** Factor de la velocidad de los disparos enemigos. */
  bulletSpeed: number
  /** Factor de la probabilidad de que un enemigo suelte premio. */
  drops: number
  /** Factor de la vida del jefe. */
  bossHp: number
}
export const DIFFICULTIES: DifficultyDef[] = [
  { id: 0, name: 'Fácil', mult: 70, speed: 0.7, spawn: 0.72, gunnerFrom: 108, formationEvery: 30, bulletSpeed: 0.8, drops: 1.5, bossHp: 0.75 },
  { id: 1, name: 'Normal', mult: 100, speed: 1, spawn: 1, gunnerFrom: 36, formationEvery: 22, bulletSpeed: 1, drops: 1, bossHp: 1 },
  { id: 2, name: 'Difícil', mult: 160, speed: 1.3, spawn: 1.3, gunnerFrom: 22, formationEvery: 16, bulletSpeed: 1.15, drops: 0.9, bossHp: 1.25 },
  { id: 3, name: 'Extremo', mult: 240, speed: 1.65, spawn: 1.7, gunnerFrom: 10, formationEvery: 12, bulletSpeed: 1.3, drops: 0.8, bossHp: 1.5 },
]
export const DEFAULT_DIFFICULTY: Difficulty = 1

interface Bullet { on: boolean; x: number; y: number; vx: number }
/** 0 = arma (sube de nivel) · 1 = cadencia rápida por unos segundos. */
export type PickupKind = 0 | 1
interface Pickup { on: boolean; kind: PickupKind; x: number; y: number; phase: number }
interface Enemy { on: boolean; kind: EnemyKind; x: number; y: number; baseX: number; vy: number; hp: number; phase: number; amp: number; flash: number; shoot: number }
/** El jefe: un monstruo grande que entra por arriba, se mueve de lado a lado y dispara en ráfagas apuntadas y en abanico. */
export interface Boss {
  on: boolean
  /** Número de jefe (1 el primero, 2 el segundo…): cada uno trae más vida y más disparos. */
  num: number
  x: number
  y: number
  hp: number
  maxHp: number
  age: number
  flash: number
  aimIn: number
  fanIn: number
  addsIn: number
  /** Próximos umbrales de vida (fracción) en los que suelta un premio. */
  dropAt: number
}
interface EBullet { on: boolean; x: number; y: number; vx: number; vy: number }
interface Part { on: boolean; x: number; y: number; vx: number; vy: number; life: number; color: string }

export interface Game {
  time: number
  /** Puntaje con el multiplicador de la dificultad (entero). */
  score: number
  /** Puntaje sin multiplicador. */
  raw: number
  diff: DifficultyDef
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
  /** Cuándo (segundos de juego) llega la próxima formación de puntitos en V. */
  formationAt: number
  /** Oleada actual (1…): cada 5 hay un jefe. */
  wave: number
  /** Segundos que lleva la oleada actual (no avanza durante el jefe). */
  waveT: number
  /** Progreso de dificultad en segundos equivalentes: avanza solo cuando no hay jefe. */
  prog: number
  /** Jefes derrotados. */
  bosses: number
  boss: Boss
  /** Aviso en pantalla: 0 nada · 1 jefe llegando · 2 jefe derrotado. */
  msg: number
  msgT: number
  bullets: Bullet[]
  ebullets: EBullet[]
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

export function createGame(rand: () => number = Math.random, difficulty: Difficulty = DEFAULT_DIFFICULTY): Game {
  return {
    time: 0,
    score: 0,
    raw: 0,
    diff: DIFFICULTIES[difficulty] ?? DIFFICULTIES[DEFAULT_DIFFICULTY],
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
    formationAt: DIFFICULTIES[difficulty]?.formationEvery ?? 20,
    wave: 1,
    waveT: 0,
    prog: 0,
    bosses: 0,
    boss: { on: false, num: 1, x: W / 2, y: -80, hp: 0, maxHp: 1, age: 0, flash: 0, aimIn: 0, fanIn: 0, addsIn: 0, dropAt: 0.66 },
    msg: 0,
    msgT: 0,
    bullets: Array.from({ length: MAX_BULLETS }, () => ({ on: false, x: 0, y: 0, vx: 0 })),
    ebullets: Array.from({ length: MAX_EBULLETS }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0 })),
    pickups: Array.from({ length: MAX_PICKUPS }, () => ({ on: false, kind: 0 as PickupKind, x: 0, y: 0, phase: 0 })),
    enemies: Array.from({ length: MAX_ENEMIES }, () => ({ on: false, kind: 0 as EnemyKind, x: 0, y: 0, baseX: 0, vy: 0, hp: 0, phase: 0, amp: 0, flash: 0, shoot: 0 })),
    parts: Array.from({ length: MAX_PARTS }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '#fff' })),
    stars: Array.from({ length: STARS }, () => ({ x: rand() * W, y: rand() * H, s: rand() < 0.2 ? 2 : 1, v: 14 + rand() * 40 })),
    rand,
  }
}

/** Segundos entre apariciones: baja con el tiempo hasta un mínimo (la partida se pone cada vez más intensa). */
export const spawnGap = (t: number) => Math.max(0.26 - Math.min(0.08, Math.max(0, t - 100) * 0.0004), 0.85 - t * 0.0105)
/** Velocidad base de caída. */
export const fallSpeed = (t: number) => Math.min(245, 85 + t * 1.5) + Math.min(120, Math.max(0, t - 105) * 0.45)

/** Suma puntos base: el puntaje final es el base por el multiplicador de la dificultad (división entera: exacto en cualquier motor). */
function addScore(g: Game, base: number) {
  g.raw += base
  g.score = Math.floor((g.raw * g.diff.mult) / 100)
}

function pickKind(g: Game): EnemyKind {
  const t = g.prog
  const r = g.rand()
  // cañoneros: aparecen a partir de los ~22 s, uno a la vez (dos pasados los ~55 s)
  let guns = 0
  for (const e of g.enemies) if (e.on && e.kind === 3) guns++
  const from = g.diff.gunnerFrom
  const pGun = t > from && guns < (t > from + 33 ? (t > from + 150 ? 3 : 2) : 1) ? 0.05 + Math.min(0.06, (t - from) * 0.0015) : 0
  if (r < pGun) return 3
  const pGold = t > 8 ? 0.06 : 0
  if (r < pGun + pGold) return 2
  const pDia = t > 12 ? Math.min(0.34, 0.1 + (t - 12) * 0.006) : 0
  if (r < pGun + pGold + pDia) return 1
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
  e.vy = fallSpeed(g.prog) * g.diff.speed * (kind === 3 ? 0.32 : kind === 2 ? 1.6 : kind === 1 ? 0.7 : 0.85 + g.rand() * 0.4)
  e.phase = g.rand() * 6.28
  e.amp = kind === 0 ? g.rand() * 26 : kind === 2 ? 40 : kind === 3 ? 16 : 0
  e.flash = 0
  e.shoot = 1.1 + g.rand() * 0.7
}

/** Formación en V de puntitos que baja de golpe: rompe el ritmo y obliga a moverse (cada 20 s). */
function formation(g: Game) {
  const n = g.prog < 50 ? 5 : g.prog < 130 ? 7 : 9
  const mid = (n - 1) / 2
  const cx = 60 + g.rand() * (W - 120)
  for (let i = 0; i < n; i++) {
    const e = g.enemies.find((x) => !x.on)
    if (!e) return
    const d = i - mid
    e.on = true
    e.kind = 0
    e.hp = 1
    e.baseX = Math.max(20, Math.min(W - 20, cx + d * 34))
    e.x = e.baseX
    e.y = -KIND_R[0] - (d < 0 ? -d : d) * 24
    e.vy = fallSpeed(g.prog) * g.diff.speed * 0.95
    e.phase = 0
    e.amp = 0
    e.flash = 0
    e.shoot = 0
  }
}

/** Un cañonero dispara hacia donde está la nave (más disparos en abanico pasada la mitad de la ronda). */
function enemyFire(g: Game, e: Enemy) {
  const dy = SHIP_Y - e.y
  const aim = Math.max(-95, Math.min(95, (g.shipX - e.x) / (dy / (EBULLET_SPEED * g.diff.bulletSpeed))))
  const vxs = g.prog > 50 ? [aim, aim - 55, aim + 55] : [aim]
  for (const vx of vxs) {
    const b = g.ebullets.find((x) => !x.on)
    if (!b) return
    b.on = true
    b.x = e.x
    b.y = e.y + KIND_R[3]
    b.vx = vx
    b.vy = EBULLET_SPEED * g.diff.bulletSpeed
  }
}

/** Empieza el combate con el jefe: vida según su número y la dificultad. */
function startBoss(g: Game) {
  const b = g.boss
  const n = g.bosses + 1
  b.on = true
  b.num = n
  b.maxHp = Math.round((110 + 60 * (n - 1)) * g.diff.bossHp)
  b.hp = b.maxHp
  b.x = W / 2
  b.y = -BOSS_R - 20
  b.age = 0
  b.flash = 0
  b.aimIn = 2.4
  b.fanIn = 3.6
  b.addsIn = 4
  b.dropAt = 0.66
  g.msg = 1
  g.msgT = 2.6
}

function ebullet(g: Game, x: number, y: number, vx: number, vy: number) {
  const b = g.ebullets.find((q) => !q.on)
  if (!b) return
  b.on = true
  b.x = x
  b.y = y
  b.vx = vx
  b.vy = vy
}

/** Movimiento y ataques del jefe: ráfaga apuntada, abanico y, ya herido, más rápido y con refuerzos. */
function updateBoss(g: Game, dt: number) {
  const b = g.boss
  b.age += dt
  b.flash = Math.max(0, b.flash - dt)
  const enraged = b.hp * 2 < b.maxHp
  const sp = g.diff.bulletSpeed
  // entra por arriba y después patrulla de lado a lado
  if (b.y < BOSS_Y) b.y = Math.min(BOSS_Y, b.y + 70 * dt)
  const sway = enraged ? 1.35 : 0.9
  b.x = W / 2 + fsin(b.age * sway) * (W / 2 - 72)
  if (b.y < BOSS_Y - 4) return // todavía llegando: no dispara
  b.aimIn -= dt
  if (b.aimIn <= 0) {
    b.aimIn += enraged ? 1.0 : 1.5
    const dy = SHIP_Y - b.y
    const aim = Math.max(-110, Math.min(110, (g.shipX - b.x) / (dy / (EBULLET_SPEED * sp))))
    for (const dv of [0, -42, 42]) ebullet(g, b.x, b.y + BOSS_R - 8, aim + dv, EBULLET_SPEED * sp)
  }
  b.fanIn -= dt
  if (b.fanIn <= 0) {
    b.fanIn += enraged ? 2.3 : 3.3
    const n = Math.min(11, 5 + b.num)
    for (let i = 0; i < n; i++) ebullet(g, b.x, b.y + BOSS_R - 8, (i - (n - 1) / 2) * 40, EBULLET_SPEED * sp * 0.92)
  }
  // refuerzos: puntitos que caen desde el jefe cuando está herido
  if (enraged) {
    b.addsIn -= dt
    if (b.addsIn <= 0) {
      b.addsIn += 3.2
      const e = g.enemies.find((x) => !x.on)
      if (e) {
        e.on = true
        e.kind = 0
        e.hp = 1
        e.baseX = b.x
        e.x = b.x
        e.y = b.y + BOSS_R
        e.vy = fallSpeed(g.prog) * g.diff.speed * 0.9
        e.phase = 0
        e.amp = 0
        e.flash = 0
        e.shoot = 0
      }
    }
  }
}

function dropPickup(g: Game, kind: PickupKind, x: number, y: number) {
  const k = g.pickups.find((q) => !q.on)
  if (!k) return
  k.on = true
  k.kind = kind
  k.x = Math.max(PICKUP_R, Math.min(W - PICKUP_R, x))
  k.y = y
  k.phase = 0
}

/** El jefe cae: puntos grandes, premios, una vida de regalo y la siguiente oleada. */
function defeatBoss(g: Game) {
  const b = g.boss
  b.on = false
  g.bosses += 1
  addScore(g, 250 + 150 * b.num)
  g.kills += 1
  for (let i = 0; i < 4; i++) burst(g, b.x + (i - 1.5) * 18, b.y + (i % 2) * 12, i % 2 ? '#ffc83d' : '#ff7a45', 12)
  dropPickup(g, g.weapon < MAX_WEAPON ? 0 : 1, b.x - 20, b.y + 30)
  dropPickup(g, 1, b.x + 20, b.y + 30)
  if (g.lives < LIVES) g.lives += 1
  for (const eb of g.ebullets) eb.on = false
  g.wave += 1
  g.waveT = 0
  g.formationAt = g.prog + g.diff.formationEvery
  g.spawnIn = Math.max(g.spawnIn, 2.2)
  g.msg = 2
  g.msgT = 2.6
}

/** Un golpe a la nave: una vida, invulnerabilidad breve y un nivel de arma. */
function hitShip(g: Game) {
  g.lives -= 1
  g.invuln = INVULN
  g.hurt = 0.4
  if (g.weapon > 1) g.weapon -= 1
  g.rapid = 0
  if (g.lives <= 0) {
    g.over = true
    burst(g, g.shipX, SHIP_Y, '#4de1ff', 14)
  }
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

/** Dispara según el nivel del arma: 1 recto · 2 paralelos · 3 abanico · 4 abanico de cinco · 5 abanico de cinco y dos paralelos. */
function fire(g: Game) {
  const y = SHIP_Y - SHIP_R
  const shots: [number, number][] =
    g.weapon <= 1
      ? [[0, 0]]
      : g.weapon === 2
        ? [[-7, 0], [7, 0]]
        : g.weapon === 3
          ? [[0, 0], [-9, -70], [9, 70]]
          : g.weapon === 4
            ? [[0, 0], [-9, -60], [9, 60], [-16, -135], [16, 135]]
            : [[0, 0], [-9, -60], [9, 60], [-16, -135], [16, 135], [-21, 0], [21, 0]]
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
  const chance = kind === 3 ? 1 : (kind === 2 ? 0.5 : kind === 1 ? 0.28 : 0.06) * g.diff.drops
  const roll = g.rand()
  // «piedad»: si pasan muchos enemigos sin premio, el siguiente lo suelta sí o sí
  if (roll >= chance && g.sinceDrop < 16) return
  const k = g.pickups.find((q) => !q.on)
  if (!k) return
  g.sinceDrop = 0
  k.on = true
  // arma mientras no esté al máximo (en 3 de cada 5); si no, cadencia rápida
  k.kind = g.weapon < MAX_WEAPON && g.rand() < 0.6 ? 0 : 1
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
  g.msgT = Math.max(0, g.msgT - dt)
  if (g.msgT === 0) g.msg = 0

  // oleadas: cada 18 s sube el ritmo; al terminar la 5, la 10, la 15… llega el jefe y el reloj de oleadas se detiene hasta vencerlo
  if (!g.boss.on) {
    g.waveT += dt
    g.prog += dt
    if (g.waveT >= WAVE_SECONDS) {
      g.waveT -= WAVE_SECONDS
      if (g.wave % BOSS_EVERY === 0) startBoss(g)
      else g.wave += 1
    }
  }

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

  // formaciones en V cada 20 s
  if (!g.boss.on && g.prog >= g.formationAt) {
    g.formationAt += g.diff.formationEvery
    formation(g)
  }

  // apariciones
  g.spawnIn -= dt
  while (g.spawnIn <= 0) {
    g.spawnIn += (spawnGap(g.prog) / g.diff.spawn) * (g.boss.on ? 2.6 : 1)
    spawn(g)
  }

  for (const b of g.bullets) {
    if (!b.on) continue
    b.y -= BULLET_SPEED * dt
    b.x += b.vx * dt
    if (b.y < -10 || b.x < -12 || b.x > W + 12) b.on = false
  }

  // disparos enemigos: si alcanzan la nave cuentan como un golpe
  for (const b of g.ebullets) {
    if (!b.on) continue
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.y > H + 10 || b.x < -10 || b.x > W + 10) {
      b.on = false
      continue
    }
    if (g.invuln <= 0) {
      const dx = g.shipX - b.x
      const dy = SHIP_Y - b.y
      const rr = EBULLET_R + SHIP_R - 4
      if (dx * dx + dy * dy <= rr * rr) {
        b.on = false
        burst(g, b.x, b.y, '#ffffff', 6)
        hitShip(g)
        if (g.over) return
      }
    }
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
        else addScore(g, 15) // arma al máximo: el premio se vuelve puntos
      } else g.rapid = RAPID_SECONDS
      burst(g, k.x, k.y, k.kind === 0 ? '#5dff9b' : '#ffb347', 10)
    }
  }

  for (const e of g.enemies) {
    if (!e.on) continue
    e.y += e.vy * dt
    e.phase += dt * 2.4
    // con el tiempo, los puntitos y rombos se van acercando a la nave: quedarse quieto en una esquina no sirve
    if (e.kind === 0 || e.kind === 1) {
      const drift = Math.min(45, Math.max(0, g.prog - 10) * 1.2)
      const d = g.shipX - e.baseX
      e.baseX += (Math.abs(d) < drift * dt ? d : Math.sign(d) * drift * dt)
    }
    e.x = e.baseX + fsin(e.phase) * e.amp
    e.flash = Math.max(0, e.flash - dt)
    if (e.kind === 3 && e.y > 24 && e.y < SHIP_Y - 150) {
      e.shoot -= dt
      if (e.shoot <= 0) {
        e.shoot += Math.max(0.7, 1.7 - g.prog * 0.009)
        enemyFire(g, e)
      }
    }
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
          addScore(g, KIND_SCORE[e.kind])
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
        hitShip(g)
      }
    }
  }

  if (g.boss.on) {
    updateBoss(g, dt)
    const bs = g.boss
    for (const b of g.bullets) {
      if (!b.on) continue
      const dx = b.x - bs.x
      const dy = b.y - bs.y
      if (dx * dx + dy * dy <= (BOSS_R + 3) * (BOSS_R + 3)) {
        b.on = false
        bs.hp -= 1
        bs.flash = 0.06
        if (bs.hp <= 0) {
          defeatBoss(g)
          break
        }
        if (bs.hp <= bs.maxHp * bs.dropAt && bs.dropAt > 0) {
          bs.dropAt = bs.dropAt > 0.5 ? 0.33 : 0
          dropPickup(g, g.weapon < MAX_WEAPON ? 0 : 1, bs.x, bs.y + BOSS_R)
          burst(g, bs.x, bs.y + 20, '#5dff9b', 8)
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

  if (g.time >= MAX_SECONDS) g.over = true

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
export const MAX_STEPS = Math.ceil(MAX_SECONDS / STEP) + 120

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
export function replay(seed: number, log: InputLog, difficulty: number = DEFAULT_DIFFICULTY): ReplayResult | null {
  if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty >= DIFFICULTIES.length) return null
  if (!Number.isInteger(seed) || log.length % 3 !== 0 || log.length > 3 * (MAX_STEPS + 10)) return null
  for (let i = 0; i < log.length; i += 3) {
    const [f, t, d] = [log[i], log[i + 1], log[i + 2]]
    if (!Number.isInteger(f) || f < 0 || f > MAX_STEPS || !Number.isInteger(t) || t < -1 || t > W || (d !== -1 && d !== 0 && d !== 1)) return null
    if (i >= 3 && f < log[i - 3]) return null
  }
  const g = createGame(makeRand(seed), difficulty as Difficulty)
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
