import { supabase } from '../remote/client'

// Cliente del ranking del Arcade (migración 0026). Todo pasa por funciones del servidor que validan y limitan: aquí solo se
// llaman y se normalizan las respuestas. Si la base no está conectada o la migración aún no se aplicó, las funciones devuelven
// null y el juego sigue funcionando (con el ranking solo del dispositivo).

export type BoardKind = 'week' | 'total' | 'best'

export interface BoardRow {
  rank: number
  nickname: string
  points: number
  best: number
  plays: number
  me: boolean
}
export interface Board {
  rows: BoardRow[]
  /** Mi puesto, aunque no esté entre los primeros (null si aún no he jugado en línea). */
  me: { rank: number; points: number; nickname: string } | null
}

/** Mismo criterio que la base: letras, números, espacio, punto, guion y guion bajo; de 2 a 16 caracteres. */
export function cleanNick(raw: string): string {
  return raw.replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16)
}

/** Apodo inicial estable a partir del identificador del dispositivo: «Jugador4821». */
export function defaultNick(playerId: string): string {
  let n = 0
  for (const ch of playerId) n = (n * 31 + ch.charCodeAt(0)) % 10000
  return `Jugador${String(n).padStart(4, '0')}`
}

export function newPlayerId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    /* sin crypto.randomUUID */
  }
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`
}

const num = (v: unknown) => Number(v ?? 0) || 0

export interface RunTicket {
  runId: string
  seed: number
}
export interface RunResult {
  /** Puntaje que calculó el servidor al repetir la partida (el único que cuenta para el ranking). */
  score: number
  awarded: number
  rankWeek: number | null
  banned: boolean
}

const call = async (body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.functions.invoke('arcade-run', { body })
    if (error || !data || typeof data !== 'object' || 'error' in (data as object)) return null
    return data as Record<string, unknown>
  } catch {
    return null
  }
}

/** Pide al servidor una partida: devuelve la semilla (la elige él). null = sin conexión: se juega sin ranking. */
export async function startRun(playerId: string): Promise<RunTicket | null> {
  const d = await call({ action: 'start', player_id: playerId })
  if (!d || typeof d.run_id !== 'string' || typeof d.seed !== 'number') return null
  return { runId: d.run_id, seed: d.seed }
}

/** Entrega los movimientos de la partida; el servidor la repite y guarda su propio puntaje. null = no se pudo validar. */
export async function finishRun(playerId: string, ticket: RunTicket, nickname: string, inputs: number[]): Promise<RunResult | null> {
  const d = await call({ action: 'finish', run_id: ticket.runId, player_id: playerId, nickname, inputs })
  if (!d) return null
  invalidateBoard()
  return { score: num(d.score), awarded: num(d.awarded), rankWeek: d.rank_week == null ? null : num(d.rank_week), banned: d.banned === true }
}

export interface Winner {
  place: number
  nickname: string
  score: number
  prize: string
}
export interface MyPrize {
  week: string
  place: number
  score: number
  prize: string
  code: string
}

/** Podio de la semana pasada (con el premio de cada puesto). [] si aún no hay; null = no disponible. */
export async function fetchWinners(): Promise<Winner[] | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.rpc('arcade_winners', {})
    if (error) return null
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({ place: num(r.place), nickname: String(r.nickname ?? ''), score: num(r.score), prize: String(r.prize ?? '') }))
  } catch {
    return null
  }
}

export interface HistoryRun {
  score: number
  at: string
  weekStart: string
}
export interface WeekSummary {
  /** Cuántas personas han puntuado esta semana. */
  players: number
  /** Mejor puntaje de la semana (el del líder). */
  leader: number
  /** Mi mejor puntaje esta semana (null si aún no juego). */
  best: number | null
  /** Mi puesto esta semana (null si aún no juego). */
  rank: number | null
  /** Partidas que llevo esta semana. */
  plays: number
}

/** Mis últimas partidas verificadas (guardadas en el servidor, así se ven desde cualquier dispositivo). null = no disponible. */
export async function fetchHistory(playerId: string): Promise<HistoryRun[] | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.rpc('arcade_my_history', { p_player: playerId, p_limit: 40 })
    if (error) return null
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({ score: num(r.score), at: String(r.finished_at ?? ''), weekStart: String(r.week_start ?? '') }))
  } catch {
    return null
  }
}

/** Mi semana frente a todos: puesto, líder y cuánto me falta. null = no disponible. */
export async function fetchWeekSummary(playerId: string): Promise<WeekSummary | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.rpc('arcade_week_summary', { p_player: playerId })
    if (error || !data) return null
    const d = data as Record<string, unknown>
    return { players: num(d.players), leader: num(d.leader), best: d.best == null ? null : num(d.best), rank: d.rank == null || d.best == null ? null : num(d.rank), plays: num(d.plays) }
  } catch {
    return null
  }
}

/** Los tres premios vigentes, por puesto. */
export async function fetchPrizes(): Promise<string[] | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.rpc('arcade_prizes', {})
    if (error || !data) return null
    const rows = data as Record<string, unknown>[]
    return [1, 2, 3].map((p) => String(rows.find((r) => num(r.place) === p)?.prize ?? ''))
  } catch {
    return null
  }
}

/** Si esta persona ganó un puesto la semana pasada: su premio y el código para caja. */
export async function fetchMyPrize(playerId: string): Promise<MyPrize | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.rpc('arcade_my_prize', { p_player: playerId })
    if (error || !data) return null
    const d = data as Record<string, unknown>
    return { week: String(d.week ?? ''), place: num(d.place), score: num(d.score), prize: String(d.prize ?? ''), code: String(d.code ?? '') }
  } catch {
    return null
  }
}

const cache = new Map<BoardKind, { at: number; board: Board }>()
const TTL_MS = 30_000

/** Tabla de líderes (se guarda 30 s para no consultar en cada apertura). null = no disponible. */
export async function fetchBoard(kind: BoardKind, playerId: string, force = false): Promise<Board | null> {
  if (!supabase) return null
  const hit = cache.get(kind)
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.board
  try {
    const [top, me] = await Promise.all([
      supabase.rpc('arcade_top', { p_kind: kind, p_player: playerId, p_limit: 20 }),
      supabase.rpc('arcade_me', { p_player: playerId, p_kind: kind }),
    ])
    if (top.error) return null
    const rows: BoardRow[] = ((top.data as Record<string, unknown>[] | null) ?? []).map((r) => ({
      rank: num(r.rank),
      nickname: String(r.nickname ?? ''),
      points: num(r.points),
      best: num(r.best_score),
      plays: num(r.plays),
      me: r.is_me === true,
    }))
    const m = me.error ? null : (me.data as Record<string, unknown> | null)
    const board: Board = { rows, me: m ? { rank: num(m.rank), points: num(m.points), nickname: String(m.nickname ?? '') } : null }
    cache.set(kind, { at: Date.now(), board })
    return board
  } catch {
    return null
  }
}

/** Fuerza que la próxima consulta vuelva a pedir (tras enviar una partida). */
export const invalidateBoard = () => cache.clear()
