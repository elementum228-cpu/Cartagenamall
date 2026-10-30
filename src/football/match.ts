import { COURT, HALF_L, HALF_W, FENCE_X, FENCE_Z } from './config'

// Simulación visual de fútbol 5 (sin física ni IA competitiva): un controlador central con estados
// y posiciones de formación. El balón siempre tiene un dueño (conducción) o va en una trayectoria
// interpolada (pase, remate, despeje); las acciones de los jugadores se disparan al ritmo del
// balón. Determinística a partir de una semilla. Coordenadas de la cancha: x a lo largo (el equipo 0
// ataca hacia +x), z a lo ancho, origen en el centro del campo.

export type Anim = 'idle' | 'jog' | 'run' | 'kick' | 'keeper' | 'celebrate'
type Pt = [number, number]

export interface Player {
  team: 0 | 1
  keeper: boolean
  /** Índice dentro del equipo (0 = arquero, 1–2 defensas, 3–4 delanteros). */
  slot: number
  x: number
  z: number
  vx: number
  vz: number
  heading: number
  anim: Anim
  /** Fase del ciclo de carrera (cada jugador distinta: no se mueven al unísono). */
  phase: number
  /** Tiempo restante del gesto de patada (0 = sin patear). */
  kickT: number
  target: Pt | null
  speed: number
}

export interface Ball {
  x: number
  z: number
  y: number
  /** Dueño (conduce el balón) o null si va en el aire / rodando. */
  owner: number | null
  /** Trayectoria en curso. */
  from: Pt
  to: Pt
  t: number
  dur: number
  arc: number
  /** Ángulo acumulado de rodadura y su eje (perpendicular al movimiento). */
  roll: number
  rollAxis: Pt
}

export type Phase = 'play' | 'goal' | 'reset'
type Flight = { kind: 'pass' | 'shot' | 'clear' | 'retrieve'; receiver: number; outcome?: 'goal' | 'save' | 'miss' }

export const KICK_TIME = 0.4
const RELEASE_AT = 0.2 // segundos restantes del gesto cuando sale el balón
const JOG = 1.25
const RUN = 2.5
const DRIBBLE = 1.9

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Formación base del equipo 0 (ataca hacia +x); el equipo 1 la usa espejada. */
const FORMATION: Pt[] = [
  [-HALF_L + 0.55, 0],
  [-3.6, -1.9],
  [-3.6, 1.9],
  [1.2, -2.2],
  [1.8, 2.0],
]

export class MatchSim {
  players: Player[] = []
  ball: Ball
  phase: Phase = 'reset'
  phaseT = 0
  /** Último equipo que marcó (celebra) y el que saca. */
  scorer: 0 | 1 = 0
  kickoffTeam: 0 | 1 = 0
  /** Contador de goles de la demostración (solo para variar las jugadas; no se muestra). */
  goals = 0
  time = 0
  private rnd: () => number
  private flight: Flight | null = null
  private pending: { kind: 'pass' | 'shot'; target: Pt; receiver: number; outcome?: 'goal' | 'save' | 'miss' } | null = null
  private dribbleT = 0
  private dribbleTo: Pt = [0, 0]
  private holdT = 0
  private passes = 0
  private presser = -1

  constructor(seed = 7) {
    this.rnd = mulberry(seed)
    for (let team = 0 as 0 | 1; team < 2; team = (team + 1) as 0 | 1)
      FORMATION.forEach(([fx, fz], slot) => {
        const s = team === 0 ? 1 : -1
        this.players.push({
          team,
          keeper: slot === 0,
          slot,
          x: fx * s,
          z: fz * s,
          vx: 0,
          vz: 0,
          heading: team === 0 ? Math.PI / 2 : -Math.PI / 2,
          anim: 'idle',
          phase: this.rnd() * Math.PI * 2,
          kickT: 0,
          target: null,
          speed: 0,
        })
      })
    this.ball = { x: 0, z: 0, y: 0, owner: null, from: [0, 0], to: [0, 0], t: 0, dur: 0, arc: 0, roll: 0, rollAxis: [1, 0] }
    this.startReset()
  }

  /** Dirección de ataque del equipo (+1 hacia +x). */
  private dir(team: 0 | 1) {
    return team === 0 ? 1 : -1
  }
  private teammates(i: number) {
    const p = this.players[i]
    return this.players.map((_, j) => j).filter((j) => j !== i && this.players[j].team === p.team && !this.players[j].keeper)
  }
  private opponents(team: 0 | 1) {
    return this.players.map((_, j) => j).filter((j) => this.players[j].team !== team)
  }
  private keeperOf(team: 0 | 1) {
    return this.players.findIndex((p) => p.team === team && p.keeper)
  }

  private startReset() {
    this.phase = 'reset'
    this.phaseT = 2.2
    this.flight = null
    this.pending = null
    this.ball.owner = null
    this.ball.from = [this.ball.x, this.ball.z]
    this.ball.to = [0, 0]
    this.ball.t = 0
    this.ball.dur = 0.9
    this.ball.arc = 0.4
    this.passes = 0
  }

  private giveBall(i: number) {
    this.ball.owner = i
    this.flight = null
    const p = this.players[i]
    const s = this.dir(p.team)
    if (p.keeper) {
      this.holdT = 0.9 + this.rnd() * 0.6
      this.dribbleT = 0
    } else {
      // conduce unos metros hacia el arco rival, con un desvío lateral
      this.dribbleT = 0.9 + this.rnd() * 1.4
      this.dribbleTo = [clamp(p.x + s * (2 + this.rnd() * 3), -HALF_L + 1.2, HALF_L - 1.2), clamp(p.z + (this.rnd() - 0.5) * 3, -HALF_W + 0.6, HALF_W - 0.6)]
    }
  }

  /** Inicia el gesto de patada; el balón sale cuando el pie llega adelante. */
  private kick(i: number, kind: 'pass' | 'shot', target: Pt, receiver: number, outcome?: 'goal' | 'save' | 'miss') {
    const p = this.players[i]
    p.kickT = KICK_TIME
    p.heading = Math.atan2(target[0] - p.x, target[1] - p.z)
    this.pending = { kind, target, receiver, outcome }
  }

  private launch(kind: Flight['kind'], to: Pt, receiver: number, speed: number, arc: number, outcome?: Flight['outcome']) {
    const b = this.ball
    b.owner = null
    b.from = [b.x, b.z]
    b.to = to
    b.t = 0
    b.dur = Math.max(0.35, dist(b.from, to) / speed)
    b.arc = arc
    this.flight = { kind, receiver, outcome }
  }

  private decide(i: number) {
    const p = this.players[i]
    const s = this.dir(p.team)
    const goalX = s * HALF_L
    const toGoal = Math.abs(goalX - p.x)
    if (!p.keeper && toGoal < 5.2 && (this.passes >= 2 || this.rnd() < 0.5)) {
      // remate: gol, atajada o desviado
      const r = this.rnd()
      const outcome = r < 0.42 ? 'goal' : r < 0.82 ? 'save' : 'miss'
      const gw = COURT.goal.width / 2
      const z = outcome === 'miss' ? (this.rnd() < 0.5 ? -1 : 1) * (gw + 0.6 + this.rnd() * 0.8) : (this.rnd() * 2 - 1) * (gw - 0.35)
      this.kick(i, 'shot', [s * (HALF_L + (outcome === 'goal' ? 0.45 : outcome === 'miss' ? COURT.runoff - 0.35 : 0)), z], this.keeperOf(p.team === 0 ? 1 : 0), outcome)
      return
    }
    // pase: prefiere un compañero más adelantado
    const mates = this.teammates(i)
    mates.sort((a, b) => s * (this.players[b].x - this.players[a].x) + (this.rnd() - 0.5) * 3)
    const r = mates[Math.min(mates.length - 1, Math.floor(this.rnd() * 2))]
    const q = this.players[r]
    const receive: Pt = [clamp(q.x + s * (0.6 + this.rnd()), -HALF_L + 0.8, HALF_L - 0.8), clamp(q.z + (this.rnd() - 0.5) * 1.2, -HALF_W + 0.4, HALF_W - 0.4)]
    this.kick(i, 'pass', receive, r)
  }

  step(dt: number) {
    this.time += dt
    const b = this.ball
    const P = this.players

    // ── fases ──
    if (this.phase === 'goal') {
      this.phaseT -= dt
      if (this.phaseT <= 0) {
        this.kickoffTeam = this.scorer === 0 ? 1 : 0
        this.startReset()
      }
    } else if (this.phase === 'reset') {
      this.phaseT -= dt
      if (this.phaseT <= 0) {
        this.phase = 'play'
        // saque del centro: un delantero del equipo que saca
        const taker = P.findIndex((p) => p.team === this.kickoffTeam && p.slot === 3)
        P[taker].x = -this.dir(this.kickoffTeam) * 0.35
        P[taker].z = 0
        b.x = 0
        b.z = 0
        this.giveBall(taker)
        this.dribbleT = 0.3
      }
    }

    // ── balón ──
    if (b.owner !== null) {
      const o = P[b.owner]
      // pegado al pie, adelante, rodando con el jugador
      const fx = o.x + Math.sin(o.heading) * 0.34
      const fz = o.z + Math.cos(o.heading) * 0.34
      const moved = Math.hypot(fx - b.x, fz - b.z)
      if (moved > 1e-4) b.rollAxis = [(fz - b.z) / moved, -(fx - b.x) / moved]
      b.roll += moved / 0.11
      b.x = fx
      b.z = fz
      b.y = 0
      if (this.pending && o.kickT > 0 && o.kickT - dt <= KICK_TIME - RELEASE_AT) {
        const k = this.pending
        this.pending = null
        if (k.kind === 'shot') this.launch('shot', k.target, k.receiver, 9, 0.25 + this.rnd() * 0.35, k.outcome)
        else {
          // ¿la corta un rival? (decidido al patear; el defensor corre hacia la línea del pase)
          const mid: Pt = [(b.x + k.target[0]) / 2, (b.z + k.target[1]) / 2]
          const opp = this.opponents(o.team).filter((j) => !P[j].keeper)
          const def = opp.sort((a, c) => dist([P[a].x, P[a].z], mid) - dist([P[c].x, P[c].z], mid))[0]
          if (def !== undefined && dist([P[def].x, P[def].z], mid) < 2.6 && this.rnd() < 0.25) {
            P[def].target = mid
            this.launch('pass', mid, def, 6.5, 0.05)
          } else {
            this.passes++
            P[k.receiver].target = k.target
            this.launch('pass', k.target, k.receiver, 6.5, 0.05 + this.rnd() * 0.25)
          }
        }
      }
    } else {
      b.t += dt
      const u = Math.min(1, b.dur > 0 ? b.t / b.dur : 1)
      // rodado: rápido al salir y frenando al llegar
      const e = 1 - (1 - u) * (1 - u)
      const nx = b.from[0] + (b.to[0] - b.from[0]) * e
      const nz = b.from[1] + (b.to[1] - b.from[1]) * e
      const moved = Math.hypot(nx - b.x, nz - b.z)
      if (moved > 1e-4) b.rollAxis = [(nz - b.z) / moved, -(nx - b.x) / moved]
      b.roll += moved / 0.11
      b.x = nx
      b.z = nz
      b.y = b.arc * 4 * u * (1 - u)
      if (u >= 1 && this.flight) {
        const f = this.flight
        this.flight = null
        if (f.kind === 'shot' && f.outcome === 'goal') {
          this.phase = 'goal'
          this.phaseT = 2.8
          this.goals++
          this.scorer = P[f.receiver].team === 0 ? 1 : 0
        } else if (f.kind === 'shot' && f.outcome === 'miss') {
          // se fue afuera: el arquero la recupera
          this.launch('retrieve', [P[f.receiver].x, P[f.receiver].z], f.receiver, 3.5, 0.15)
          this.passes = 0
        } else {
          if (f.kind !== 'pass') this.passes = 0
          this.giveBall(f.receiver)
        }
      }
    }

    // ── objetivos de cada jugador ──
    const ownerTeam = b.owner !== null ? P[b.owner].team : null
    const shift = clamp(b.x * 0.45, -2.5, 2.5)
    // un rival presiona al que lleva el balón
    if (b.owner !== null && !P[b.owner].keeper) {
      const o = P[b.owner]
      const opp = this.opponents(o.team).filter((j) => !P[j].keeper)
      this.presser = opp.sort((a, c) => dist([P[a].x, P[a].z], [o.x, o.z]) - dist([P[c].x, P[c].z], [o.x, o.z]))[0]
    } else this.presser = -1

    P.forEach((p, i) => {
      const s = this.dir(p.team)
      let goal: Pt
      let speed = JOG
      if (this.phase === 'goal') {
        if (p.team === this.scorer && !p.keeper) {
          // celebran juntos cerca del que marcó
          goal = [s * (HALF_L - 3.5) + Math.sin(i * 2.1) * 1.1, Math.cos(i * 1.7) * 1.1]
          speed = RUN
        } else goal = [p.x, p.z]
      } else if (this.phase === 'reset') {
        const [fx, fz] = FORMATION[p.slot]
        goal = [fx * s + (p.slot >= 3 ? -s * 0.8 : 0), fz * s]
        speed = RUN
      } else if (p.keeper) {
        const gw = COURT.goal.width / 2 - 0.25
        const shotZ = this.flight?.kind === 'shot' && this.flight.receiver === i ? this.flight.outcome === 'save' ? b.to[1] : b.to[1] * 0.35 : null
        goal = [-s * (HALF_L - 0.55), clamp(shotZ ?? b.z * 0.55, -gw, gw)]
        speed = shotZ !== null ? 3.2 : 1.6
      } else if (b.owner === i) {
        goal = this.dribbleTo
        speed = DRIBBLE
      } else if (p.target && this.flight && this.flight.receiver === i) {
        goal = p.target
        speed = RUN
      } else if (i === this.presser) {
        const o = P[b.owner!]
        const d = Math.hypot(o.x - p.x, o.z - p.z)
        goal = d > 0.9 ? [o.x - ((o.x - p.x) / d) * 0.9, o.z - ((o.z - p.z) / d) * 0.9] : [p.x, p.z]
        speed = RUN * 0.8
      } else {
        // formación desplazada hacia el balón; adelantan si su equipo ataca
        const [fx, fz] = FORMATION[p.slot]
        const push = ownerTeam === p.team ? 1.6 : ownerTeam === null ? 0 : -1
        const sway = Math.sin(this.time * 0.6 + p.phase) * 0.6
        goal = [fx * s + shift + s * push, fz * s + b.z * 0.25 + sway]
      }

      // movimiento
      const dx = goal[0] - p.x
      const dz = goal[1] - p.z
      const d = Math.hypot(dx, dz)
      const want = d > 0.15 ? Math.min(speed, d * 2.2) : 0
      const ax = d > 1e-4 ? (dx / d) * want : 0
      const az = d > 1e-4 ? (dz / d) * want : 0
      const k = Math.min(1, dt * 6)
      p.vx += (ax - p.vx) * k
      p.vz += (az - p.vz) * k
      if (p.kickT > 0) {
        p.vx *= 0.5
        p.vz *= 0.5
      }
      p.x += p.vx * dt
      p.z += p.vz * dt
      if (b.owner === i && this.phase === 'play' && !this.pending) {
        if (p.keeper) {
          this.holdT -= dt
          if (this.holdT <= 0) this.decide(i)
        } else {
          this.dribbleT -= dt
          if (this.dribbleT <= 0 || d < 0.4) this.decide(i)
        }
      }
    })

    // ── separación: nadie se encima ──
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++) {
        const a = P[i]
        const c = P[j]
        const dx = c.x - a.x
        const dz = c.z - a.z
        const d = Math.hypot(dx, dz)
        const min = this.phase === 'goal' ? 0.45 : 0.6
        if (d > 1e-3 && d < min) {
          const push = (min - d) / 2
          a.x -= (dx / d) * push
          a.z -= (dz / d) * push
          c.x += (dx / d) * push
          c.z += (dz / d) * push
        }
      }

    // ── límites: dentro del cerramiento y nunca dentro de los arcos ──
    for (const p of P) {
      const lim = p.keeper ? HALF_L - 0.3 : HALF_L - 0.35
      p.x = clamp(p.x, -lim, lim)
      p.z = clamp(p.z, -(HALF_W + 0.5), HALF_W + 0.5)
    }

    // ── animación y orientación ──
    P.forEach((p) => {
      p.speed = Math.hypot(p.vx, p.vz)
      if (p.kickT > 0) p.kickT = Math.max(0, p.kickT - dt)
      let face: number
      if (p.speed > 0.35) face = Math.atan2(p.vx, p.vz)
      else face = Math.atan2(b.x - p.x, b.z - p.z)
      if (p.kickT > 0) face = p.heading
      const dh = Math.atan2(Math.sin(face - p.heading), Math.cos(face - p.heading))
      p.heading += clamp(dh, -dt * 7, dt * 7)
      p.phase += dt * (p.speed > 1.8 ? 13 : 9) * Math.min(1, p.speed / 1.2)
      if (this.phase === 'goal' && p.team === this.scorer && !p.keeper) p.anim = 'celebrate'
      else if (p.kickT > 0) p.anim = 'kick'
      else if (p.keeper && p.speed > 0.2) p.anim = 'keeper'
      else if (p.speed > 1.8) p.anim = 'run'
      else if (p.speed > 0.25) p.anim = 'jog'
      else p.anim = 'idle'
    })

    // el balón nunca sale del cerramiento
    b.x = clamp(b.x, -(FENCE_X - 0.25), FENCE_X - 0.25)
    b.z = clamp(b.z, -(FENCE_Z - 0.25), FENCE_Z - 0.25)
  }
}
