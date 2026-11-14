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
export interface SubmitResult {
  awarded: number
  rankWeek: number
  rankTotal: number
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

/** Envía una partida terminada. null = sin conexión, ranking no disponible o envío rechazado. */
export async function submitRun(playerId: string, nickname: string, score: number): Promise<SubmitResult | null> {
  if (!supabase || score <= 0) return null
  try {
    const { data, error } = await supabase.rpc('arcade_submit', { p_player: playerId, p_nickname: nickname, p_score: Math.floor(score) })
    if (error || !data) return null
    const d = data as Record<string, unknown>
    return { awarded: num(d.awarded), rankWeek: num(d.rank_week), rankTotal: num(d.rank_total) }
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
