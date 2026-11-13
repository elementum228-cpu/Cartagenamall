import { bogotaToday, MAX_DAYS_AHEAD } from '../../supabase/functions/_shared/cinema/service'
import type { Cinema, MovieShowtimes, ProviderBlock, ProviderId, ProviderStatus, Showtime, ShowtimesResponse } from '../../supabase/functions/_shared/cinema/types'

// Cliente del endpoint de horarios de cine (función de Supabase `cinema-showtimes`). El navegador solo habla con esta función:
// nunca consulta a las cadenas. Las respuestas se validan aquí porque son datos de afuera (solo se aceptan enlaces https).

export type { Cinema, MovieShowtimes, ProviderBlock, ProviderId, Showtime, ShowtimesResponse }
export const CITY = 'cartagena'

/** Falla de la consulta, con un mensaje que se puede mostrar tal cual al usuario. */
export class CinemaApiError extends Error {}

export interface ApiOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  /** Para pruebas; por defecto, las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. */
  baseUrl?: string
  anonKey?: string
}

export function endpointUrl(date: string, baseUrl: string): string {
  const u = new URL(`${baseUrl.replace(/\/$/, '')}/functions/v1/cinema-showtimes`)
  u.searchParams.set('city', CITY)
  u.searchParams.set('date', date)
  return u.toString()
}

/** Hoy y los siguientes días consultables (hora de Colombia, la misma que usa el servidor). */
export function cinemaDays(now = new Date()): string[] {
  const [y, m, d] = bogotaToday(now).split('-').map(Number)
  return Array.from({ length: MAX_DAYS_AHEAD + 1 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10))
}

const isHttps = (s: unknown): s is string => {
  try {
    return typeof s === 'string' && new URL(s).protocol === 'https:'
  } catch {
    return false
  }
}
const str = (x: unknown, max = 200) => (typeof x === 'string' ? x.slice(0, max) : '')
const STATUSES: ProviderStatus[] = ['available', 'unavailable', 'partial']
const IDS: ProviderId[] = ['cinecolombia', 'procinal', 'royalfilms']

/** Valida la respuesta del servidor; lo que no cumple se descarta (una cadena sin enlace oficial https no se muestra). */
export function cleanShowtimesResponse(raw: unknown): ShowtimesResponse | null {
  const o = (raw ?? null) as Partial<ShowtimesResponse> | null
  if (!o || typeof o !== 'object' || !Array.isArray(o.providers)) return null
  const providers: ProviderBlock[] = []
  for (const p of o.providers as Partial<ProviderBlock>[]) {
    if (!p || !IDS.includes(p.id as ProviderId) || !isHttps(p.officialUrl)) continue
    const official = p.officialUrl
    const cinemas: Cinema[] = (Array.isArray(p.cinemas) ? p.cinemas : []).flatMap((c: Partial<Cinema>) => {
      const movies: MovieShowtimes[] = (Array.isArray(c?.movies) ? c.movies : []).flatMap((m: Partial<MovieShowtimes>) => {
        const showtimes = (Array.isArray(m?.showtimes) ? m.showtimes : [])
          .filter((s) => s && /^\d{2}:\d{2}$/.test(String(s.time)))
          .map((s) => ({ time: String(s.time), format: str(s.format, 20) || null, language: str(s.language, 30) || null, bookingUrl: isHttps(s.bookingUrl) ? s.bookingUrl : official }))
        return str(m?.title) && showtimes.length
          ? [{ title: str(m.title), posterUrl: isHttps(m.posterUrl) ? m.posterUrl : null, durationMinutes: typeof m.durationMinutes === 'number' && m.durationMinutes > 0 ? m.durationMinutes : null, rating: str(m.rating, 12) || null, showtimes }]
          : []
      })
      return str(c?.name) && movies.length ? [{ id: str(c.id, 60) || str(c.name), name: str(c.name), address: str(c.address) || null, movies }] : []
    })
    const status = STATUSES.includes(p.status as ProviderStatus) ? (p.status as ProviderStatus) : 'unavailable'
    providers.push({ id: p.id as ProviderId, name: str(p.name, 60) || String(p.id), status, officialUrl: official, lastUpdatedAt: typeof p.lastUpdatedAt === 'string' ? p.lastUpdatedAt : null, ...(p.message ? { message: str(p.message, 160) } : {}), cinemas: status === 'unavailable' ? [] : cinemas })
  }
  return { city: str(o.city, 60) || 'Cartagena', date: str(o.date, 10), updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(), providers }
}

/** Pide los horarios de un día. Lanza `CinemaApiError` (con mensaje para el usuario) si no se pudo. */
export async function fetchShowtimes(date: string, opts: ApiOptions = {}): Promise<ShowtimesResponse> {
  const baseUrl = opts.baseUrl ?? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  const anonKey = opts.anonKey ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  if (!baseUrl || !anonKey) throw new CinemaApiError('La cartelera necesita la conexión a la base de datos.')
  let res: Response
  try {
    res = await (opts.fetchImpl ?? fetch)(endpointUrl(date, baseUrl), { signal: opts.signal, headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, accept: 'application/json' } })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
    throw new CinemaApiError('No pudimos consultar la cartelera. Revisa tu conexión e intenta de nuevo.')
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } } | null)?.error?.message
    throw new CinemaApiError(res.status === 400 && msg ? msg : 'No pudimos consultar la cartelera por ahora. Intenta de nuevo en unos minutos.')
  }
  const clean = cleanShowtimesResponse(body)
  if (!clean) throw new CinemaApiError('La cartelera llegó incompleta. Intenta de nuevo en unos minutos.')
  return clean
}
