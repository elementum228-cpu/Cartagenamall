import { toHHMM } from '../cine/normalize.ts'
import type { Cinema, MovieShowtimes, Showtime } from './types.ts'

/** Tope de seguridad contra respuestas desbordadas. */
const MAX_CINEMAS = 20
const MAX_MOVIES = 60
const MAX_SHOWTIMES = 40

const text = (x: unknown, max = 160): string => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Formatos reconocidos (en el orden en que se prefieren si un texto menciona varios). */
const FORMATS: [RegExp, string][] = [
  [/\bimax\b/i, 'IMAX'],
  [/\b4\s?dx\b/i, '4DX'],
  [/\bvip\b|\bprime\b|\bgold\b/i, 'VIP'],
  [/\bxd\b/i, 'XD'],
  [/\b3\s?d\b/i, '3D'],
  [/\b2\s?d\b/i, '2D'],
]

/** Formato a partir del texto libre de la fuente («3D», «Sala VIP», «IMAX 3D»…), o null. */
export function normalizeFormat(raw: unknown): string | null {
  const t = text(raw, 60)
  if (!t) return null
  for (const [re, name] of FORMATS) if (re.test(t)) return name
  return null
}

/** Idioma a partir del texto libre («Doblada», «DOB», «SUB», «Español», «Inglés subtitulada»…), o null. */
export function normalizeLanguage(raw: unknown): string | null {
  const t = text(raw, 60)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (!t) return null
  if (/\bsub(titulad[ao]s?)?\b/.test(t)) return 'Subtitulada'
  if (/\bdob(lad[ao]s?)?\b/.test(t)) return 'Doblada'
  if (/\bespanol\b|\bcastellano\b/.test(t)) return 'Español'
  if (/\bingles\b|\benglish\b/.test(t)) return 'Inglés'
  return null
}

/** ¿El host de la URL es uno de los permitidos (o un subdominio de ellos)? */
export function hostAllowed(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase()
  return allowed.some((a) => h === a || h.endsWith('.' + a))
}

/** URL https de un sitio permitido, sin credenciales; si no, null. */
export function safeUrl(raw: unknown, allowedHosts: string[]): string | null {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' || u.username || u.password || !hostAllowed(u.hostname, allowedHosts)) return null
    return u.toString()
  } catch {
    return null
  }
}

/** Cartel: una URL https cualquiera (es solo una imagen), sin credenciales. */
function posterUrl(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim() : ''
  try {
    const u = new URL(s)
    return u.protocol === 'https:' && !u.username && !u.password ? u.toString() : null
  } catch {
    return null
  }
}

const toInt = (x: unknown): number | null => {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.replace(/\D/g, '')) : NaN
  return Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n) : null
}

export interface NormalizeOptions {
  /** Hosts oficiales de la cadena: los enlaces de compra solo valen si son de aquí. */
  allowedHosts: string[]
  /** Se usa como enlace de compra cuando la función no trae uno válido. */
  officialUrl: string
}

/**
 * Convierte lo que entrega una fuente autorizada (JSON `{ cinemas: [...] }`, con campos de texto libres) en sedes limpias:
 * horas «HH:MM», formato e idioma normalizados, enlaces de compra solo oficiales, sin repetidas y ordenadas. Lo que no sirve
 * (película sin título, hora imposible, sede sin nombre) se descarta y se cuenta, para poder marcar la cadena como «parcial».
 * Nunca lanza: una respuesta rara da menos datos, no un error.
 */
export function normalizeCinemas(raw: unknown, opts: NormalizeOptions): { cinemas: Cinema[]; dropped: number } {
  let dropped = 0
  const root = (raw ?? {}) as { cinemas?: unknown }
  const rawCinemas = Array.isArray(root.cinemas) ? root.cinemas : []
  const cinemas: Cinema[] = []
  const seenCinema = new Set<string>()
  for (const c of rawCinemas.slice(0, MAX_CINEMAS)) {
    const o = (c ?? {}) as Record<string, unknown>
    const name = text(o.name)
    if (!name) {
      dropped++
      continue
    }
    const id = text(o.id, 60) || slug(name)
    if (seenCinema.has(id)) continue
    seenCinema.add(id)
    const movies: MovieShowtimes[] = []
    const rawMovies = Array.isArray(o.movies) ? o.movies : []
    for (const m of rawMovies.slice(0, MAX_MOVIES)) {
      const mo = (m ?? {}) as Record<string, unknown>
      const title = text(mo.title)
      if (!title) {
        dropped++
        continue
      }
      const byKey = new Map<string, Showtime>()
      for (const s of (Array.isArray(mo.showtimes) ? mo.showtimes : []).slice(0, MAX_SHOWTIMES)) {
        const so = (s ?? {}) as Record<string, unknown>
        const time = toHHMM(typeof so.time === 'string' ? so.time : '')
        if (!time) {
          dropped++
          continue
        }
        const format = normalizeFormat(so.format)
        // el idioma a veces viene mezclado con el formato («3D Doblada»)
        const language = normalizeLanguage(so.language) ?? normalizeLanguage(so.format)
        byKey.set(`${time}|${format}|${language}`, { time, format, language, bookingUrl: safeUrl(so.bookingUrl, opts.allowedHosts) ?? opts.officialUrl })
      }
      if (!byKey.size) continue
      const dur = toInt(mo.durationMinutes)
      movies.push({
        title,
        posterUrl: posterUrl(mo.posterUrl),
        durationMinutes: dur,
        rating: text(mo.rating, 12) || null,
        showtimes: [...byKey.values()].sort((a, b) => a.time.localeCompare(b.time)),
      })
    }
    if (!movies.length) continue
    cinemas.push({ id, name, address: text(o.address, 200) || null, movies: movies.sort((a, b) => a.title.localeCompare(b.title)) })
  }
  return { cinemas: cinemas.sort((a, b) => a.name.localeCompare(b.name)), dropped }
}
