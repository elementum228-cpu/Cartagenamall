// Marcador en vivo del partido: lo maneja la administración (gol a gol, tiempos) y lo ve todo el mundo en la
// pantalla del estadio. Cada gol del equipo local dispara los fuegos artificiales. Sin tiempo real externo: el
// reloj corre solo desde la hora en que se inició el tiempo, así todos ven el mismo minuto.

export type MatchStatus = 'pre' | 'live' | 'half' | 'final'

export type Side = 'home' | 'away'

export interface MatchState {
  status: MatchStatus
  home: number
  away: number
  /** Minuto en el que arrancó el tiempo que corre (0 al inicio, 45 en el segundo tiempo). */
  baseMinute: number
  /** Hora (ms) en que arrancó el tiempo que corre; null si el reloj está detenido. */
  since: number | null
  /** Último gol: de quién, número de gol (cambia con cada gol) y la hora. */
  goal: { side: Side; n: number; at: number } | null
}

export const emptyMatch = (): MatchState => ({ status: 'pre', home: 0, away: 0, baseMinute: 0, since: null, goal: null })

/** Cuánto dura el aviso de «¡GOL!» y los fuegos artificiales (ms). */
export const GOAL_SHOW_MS = 9000
/** Los fuegos artificiales arrancan después del grito de gol (así está mezclado el audio): segundos tras el gol. */
export const FIREWORKS_DELAY_S = 6

/** Minuto del partido a esta hora. */
export function matchMinute(m: MatchState, now: number): number {
  if (m.status !== 'live' || m.since === null) return m.baseMinute
  return m.baseMinute + Math.max(0, Math.floor((now - m.since) / 60_000))
}

/** Segundos transcurridos del partido a esta hora (el reloj corre en vivo mientras el juego está en marcha). */
export function matchSeconds(m: MatchState, now: number): number {
  const base = m.baseMinute * 60
  if (m.status !== 'live' || m.since === null) return base
  return base + Math.max(0, Math.floor((now - m.since) / 1000))
}

/** Reloj del partido como «78:23». */
export function matchClock(m: MatchState, now: number): string {
  const s = matchSeconds(m, now)
  const mm = Math.floor(s / 60)
  return `${String(mm).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Texto corto del estado para la pantalla. */
export function matchLabel(m: MatchState, now: number): string {
  switch (m.status) {
    case 'pre':
      return 'POR EMPEZAR'
    case 'live':
      return `EN VIVO · ${matchClock(m, now)}`
    case 'half':
      return 'MEDIO TIEMPO · 45:00'
    case 'final':
      return `FINAL · ${matchClock(m, now)}`
  }
}

export const startMatch = (m: MatchState, now: number): MatchState => ({ ...m, status: 'live', baseMinute: 0, since: now })
export const pauseHalf = (m: MatchState, _now: number): MatchState => ({ ...m, status: 'half', baseMinute: 45, since: null })
export const resumeMatch = (m: MatchState, now: number): MatchState => ({ ...m, status: 'live', baseMinute: Math.max(45, m.baseMinute), since: now })
export const finishMatch = (m: MatchState, now: number): MatchState => ({ ...m, status: 'final', baseMinute: matchMinute(m, now), since: null })

/** Suma un gol (con aviso y fuegos artificiales si es del local). */
export function scoreGoal(m: MatchState, side: Side, now: number): MatchState {
  return { ...m, [side]: m[side] + 1, goal: { side, n: (m.goal?.n ?? 0) + 1, at: now } }
}

/** Anula un gol (corrección): baja el marcador sin avisos ni fuegos. */
export function undoGoal(m: MatchState, side: Side): MatchState {
  return { ...m, [side]: Math.max(0, m[side] - 1) }
}

/** Mueve el minuto del partido (corrección del reloj). */
export function nudgeMinute(m: MatchState, now: number, delta: number): MatchState {
  const cur = matchMinute(m, now)
  const next = Math.max(0, Math.min(130, cur + delta))
  return { ...m, baseMinute: next, since: m.status === 'live' ? now : null }
}

/** ¿Hay un gol reciente que mostrar? (para el aviso «¡GOL!») */
export const goalActive = (m: MatchState, now: number): Side | null => (m.goal && now - m.goal.at >= 0 && now - m.goal.at < GOAL_SHOW_MS ? m.goal.side : null)

/** Normaliza lo que llega de la base de datos. */
export function cleanMatch(raw: unknown): MatchState {
  const r = (raw ?? {}) as Partial<MatchState>
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(99, Math.floor(v))) : d)
  const status: MatchStatus = r.status === 'live' || r.status === 'half' || r.status === 'final' ? r.status : 'pre'
  const g = r.goal
  return {
    status,
    home: n(r.home, 0),
    away: n(r.away, 0),
    baseMinute: n(r.baseMinute, 0),
    since: status === 'live' && typeof r.since === 'number' && Number.isFinite(r.since) ? r.since : null,
    goal: g && (g.side === 'home' || g.side === 'away') && typeof g.n === 'number' && typeof g.at === 'number' ? { side: g.side, n: g.n, at: g.at } : null,
  }
}
