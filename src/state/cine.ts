import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

/**
 * Cine (isla al norte del piso de comida). La administración lo enciende o apaga para todos y gestiona sus dos
 * interacciones: la cartelera del frente (4 carteles que se abren en una vista tipo sala) y la entrada al cine (puertas que
 * se abren a las tres cadenas). Las películas viven en un catálogo único y las funciones (película + cadena + día + hora)
 * cuelgan de él: así una misma película muestra sus horarios en cada cadena. Más adelante las películas vendrán de una API en tiempo real;
 * por ahora se cargan a mano. Se guarda en mall_settings «features».
 */

export type ChainId = 'cine-colombia' | 'royal-films' | 'procinal'

/** Las tres cadenas del cine. Los colores son de acento de la app (no logotipos). */
export const CHAINS: { id: ChainId; name: string; color: string; tagline: string }[] = [
  { id: 'cine-colombia', name: 'Cine Colombia', color: '#d7263d', tagline: 'Estrenos y cine para toda la familia' },
  { id: 'royal-films', name: 'Royal Films', color: '#8a5cf6', tagline: 'Salas y funciones para disfrutar' },
  { id: 'procinal', name: 'Procinal', color: '#0f9d8a', tagline: 'Tu cine en la ciudad' },
]

/** Dominios oficiales de cada cadena: un enlace de película o de sala solo vale si es https de uno de ellos. */
export const OFFICIAL_HOSTS: Record<ChainId, string[]> = {
  'cine-colombia': ['cinecolombia.com'],
  'royal-films': ['cinemasroyal.com', 'cinemasroyalfilms.com', 'royal-films.com'],
  procinal: ['procinal.com.co'],
}

/** ¿Es un enlace https, sin credenciales, de un dominio oficial de esa cadena (o subdominio)? */
export function isOfficialLink(chain: ChainId, url: string): boolean {
  try {
    const u = new URL(url.trim())
    const h = u.hostname.toLowerCase()
    return u.protocol === 'https:' && !u.username && !u.password && OFFICIAL_HOSTS[chain].some((o) => h === o || h.endsWith('.' + o))
  } catch {
    return false
  }
}

export interface CinePoster {
  title: string
  /** null = arte por defecto «Próximo estreno». */
  image: string | null
}

/** Una película del catálogo (se carga una sola vez, las funciones cuelgan de ella). */
export interface CineMovie {
  id: string
  title: string
  image: string | null
  genre: string
  /** Duración en minutos (null = sin dato). */
  minutes: number | null
  /** Clasificación: «7+», «12+», «15+»… */
  rating: string
  synopsis: string
  /** Enlace oficial de esta película en el sitio de cada cadena (opcional). Sin él, el botón lleva a la cartelera de la cadena en Cartagena. */
  links: Partial<Record<ChainId, string>>
  /** Próximamente: aún no está en cartelera (va a la pestaña «Pronto»). Sin marcar, la película está en cartelera aunque no tenga horarios cargados. */
  soon: boolean
  /** Estreno: sale primero en el cine y lleva la etiqueta «Estreno». */
  isNew: boolean
}

export type ShowFormat = '' | '2D' | '3D' | 'VIP'
export type ShowLang = '' | 'DOB' | 'SUB'

/** Una función: una película, en una cadena, un día y una hora. */
export interface CineShow {
  id: string
  movieId: string
  chain: ChainId
  /** Día local, «AAAA-MM-DD». */
  day: string
  /** Hora, «HH:MM». */
  time: string
  format: ShowFormat
  lang: ShowLang
}

/** Cómo se llena la programación de una cadena: a mano (Administración) o leída automáticamente de su sitio. */
export type ChainMode = 'manual' | 'auto'

export interface CineChain {
  id: ChainId
  /** Si se apaga, la cadena no aparece dentro del cine. */
  enabled: boolean
  mode: ChainMode
}

export interface CineState {
  /** Interruptor general: sin él nadie ve la isla del cine. */
  enabled: boolean
  /** Interacción 1: tocar la cartelera abre la vista de los carteles. */
  boardOn: boolean
  /** Interacción 2: tocar el cine abre las puertas y muestra las cadenas con sus películas. */
  lobbyOn: boolean
  /** Los cuatro carteles de la cartelera del frente (y, los dos primeros, de la fachada). */
  posters: [CinePoster, CinePoster, CinePoster, CinePoster]
  chains: CineChain[]
  movies: CineMovie[]
  shows: CineShow[]
  /** Mientras no haya programación cargada (ni leída), se muestra el ejemplo, avisando que lo es. */
  demo: boolean
}

export const MAX_MOVIES = 20
export const MAX_SHOWS = 600
/** Funciones por película, cadena y día. */
export const MAX_PER_DAY = 8
/** Días hacia adelante que se pueden cargar (hoy incluido). */
export const DAYS_AHEAD = 7

const emptyPoster = (): CinePoster => ({ title: '', image: null })
export const emptyChains = (): CineChain[] => CHAINS.map((c) => ({ id: c.id, enabled: true, mode: 'manual' as ChainMode }))
export const emptyCine = (): CineState => ({
  enabled: true,
  boardOn: true,
  lobbyOn: true,
  posters: [emptyPoster(), emptyPoster(), emptyPoster(), emptyPoster()],
  chains: emptyChains(),
  movies: [],
  shows: [],
  demo: true,
})

export const newMovie = (): CineMovie => ({ id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: '', image: null, genre: '', minutes: null, rating: '', synopsis: '', links: {}, soon: false, isNew: false })

// ── días y horas ──────────────────────────────────────────────────────────────────────────────────

const two = (n: number) => String(n).padStart(2, '0')
/** «AAAA-MM-DD» en hora local. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
/** Hoy y los días siguientes (por defecto, los que se pueden cargar). */
export const nextDays = (n = DAYS_AHEAD, from = new Date()): string[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    return isoDay(d)
  })
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
/** Etiqueta corta de un día: «Hoy», «Mañana» o «mié 13». */
export function dayLabel(day: string, today = isoDay(new Date())): string {
  if (day === today) return 'Hoy'
  const [y, m, d] = day.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000)
  if (diff === 1) return 'Mañana'
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

const TIME_RE = /(\d{1,2})[:.h](\d{2})/
const fmt = (t: string): ShowFormat => (t === '2D' || t === '3D' || t === 'VIP' ? t : '')
const lng = (t: string): ShowLang => (t === 'DOB' || t === 'SUB' ? t : '')
const showId = (s: Omit<CineShow, 'id'>) => `${s.movieId}|${s.chain}|${s.day}|${s.time}|${s.format}|${s.lang}`

/**
 * Horas escritas por el administrador → funciones. Cada hora puede llevar formato e idioma:
 * «14:30, 17:00 3D, 20:15 VIP SUB». Sin repetidas, ordenadas, máximo MAX_PER_DAY.
 */
export function parseShows(text: string): { time: string; format: ShowFormat; lang: ShowLang }[] {
  const out = new Map<string, { time: string; format: ShowFormat; lang: ShowLang }>()
  for (const raw of text.split(/[,;\n]/)) {
    const m = TIME_RE.exec(raw)
    if (!m) continue
    const h = Number(m[1])
    const min = Number(m[2])
    if (h > 23 || min > 59) continue
    const words = raw.replace(TIME_RE, ' ').toUpperCase().split(/[^A-Z0-9]+/)
    const format = fmt(words.find((w) => fmt(w)) ?? '')
    const lang = lng(words.map((w) => w.slice(0, 3)).find((w) => lng(w)) ?? '')
    const time = `${two(h)}:${two(min)}`
    out.set(`${time}|${format}|${lang}`, { time, format, lang })
  }
  return [...out.values()].sort((a, b) => a.time.localeCompare(b.time)).slice(0, MAX_PER_DAY)
}

/** Funciones → el mismo texto que se escribe en el panel («14:30, 17:00 3D»). */
export const formatShows = (shows: Pick<CineShow, 'time' | 'format' | 'lang'>[]) => shows.map((s) => [s.time, s.format, s.lang].filter(Boolean).join(' ')).join(', ')

/** Funciones de una película en una cadena y un día, ordenadas por hora. */
export const showsOf = (shows: CineShow[], movieId: string, chain: ChainId, day: string) =>
  shows.filter((s) => s.movieId === movieId && s.chain === chain && s.day === day).sort((a, b) => a.time.localeCompare(b.time))

/** Reemplaza las funciones de una película en una cadena y un día por las del texto. */
export function withShows(shows: CineShow[], movieId: string, chain: ChainId, day: string, text: string): CineShow[] {
  const rest = shows.filter((s) => !(s.movieId === movieId && s.chain === chain && s.day === day))
  const next = parseShows(text).map((p) => {
    const base = { movieId, chain, day, ...p }
    return { id: showId(base), ...base }
  })
  return [...rest, ...next]
}

/** Repite en los demás días las funciones que una cadena tiene en `from` (lo que había en esos días se reemplaza). */
export function repeatWeek(shows: CineShow[], chain: ChainId, from: string, days: string[]): CineShow[] {
  const src = shows.filter((s) => s.chain === chain && s.day === from)
  const keep = shows.filter((s) => s.chain !== chain || !days.includes(s.day) || s.day === from)
  const copies = days
    .filter((d) => d !== from)
    .flatMap((day) =>
      src.map((s) => {
        const base = { movieId: s.movieId, chain, day, time: s.time, format: s.format, lang: s.lang }
        return { id: showId(base), ...base }
      }),
    )
  return [...keep, ...copies].slice(0, MAX_SHOWS)
}

// ── normalización ─────────────────────────────────────────────────────────────────────────────────

const str = (x: unknown, max = 120) => (typeof x === 'string' ? x.trim().slice(0, max) : '')
const img = (x: unknown) => (typeof x === 'string' && x ? x : null)

/** Solo se guardan enlaces oficiales (https de los dominios de la cadena); el resto se descarta. */
function cleanLinks(v: unknown): Partial<Record<ChainId, string>> {
  const o = (v ?? {}) as Record<string, unknown>
  const out: Partial<Record<ChainId, string>> = {}
  for (const c of CHAINS) {
    const raw = typeof o[c.id] === 'string' ? (o[c.id] as string).trim().slice(0, 400) : ''
    if (raw && isOfficialLink(c.id, raw)) out[c.id] = raw
  }
  return out
}

const cleanMovie = (v: unknown, i: number): CineMovie => {
  const o = (v ?? {}) as Partial<CineMovie>
  const minutes = typeof o.minutes === 'number' && Number.isFinite(o.minutes) && o.minutes > 0 ? Math.round(o.minutes) : null
  return { id: str(o.id, 40) || `m${i}`, title: str(o.title), image: img(o.image), genre: str(o.genre, 40), minutes, rating: str(o.rating, 8), synopsis: str(o.synopsis, 400), links: cleanLinks(o.links), soon: o.soon === true, isNew: o.isNew === true }
}

const cleanShow = (v: unknown): CineShow | null => {
  const o = (v ?? {}) as Partial<CineShow>
  const t = typeof o.time === 'string' ? TIME_RE.exec(o.time) : null
  if (!t || Number(t[1]) > 23 || Number(t[2]) > 59) return null
  if (typeof o.day !== 'string' || !DAY_RE.test(o.day) || typeof o.movieId !== 'string' || !CHAINS.some((c) => c.id === o.chain)) return null
  const base = { movieId: o.movieId, chain: o.chain as ChainId, day: o.day, time: `${two(Number(t[1]))}:${t[2]}`, format: fmt(String(o.format ?? '')), lang: lng(String(o.lang ?? '')) }
  return { id: showId(base), ...base }
}

/** Versión anterior: cada cadena traía sus películas con horarios (de hoy). Se pasa al catálogo único + funciones de hoy. */
function fromLegacyChains(chains: { id?: string; movies?: unknown[] }[], today: string): { movies: CineMovie[]; shows: CineShow[] } {
  const movies: CineMovie[] = []
  const shows: CineShow[] = []
  for (const c of chains) {
    if (!CHAINS.some((x) => x.id === c.id) || !Array.isArray(c.movies)) continue
    for (const raw of c.movies) {
      const m = cleanMovie(raw, movies.length)
      if (!m.title) continue
      const found = movies.find((x) => x.title.toLowerCase() === m.title.toLowerCase())
      const movie = found ?? m
      if (!found) movies.push(movie)
      const times = (raw as { showtimes?: unknown }).showtimes
      if (Array.isArray(times)) for (const t of times) shows.push(...parseShows(String(t)).map((p) => ({ id: showId({ movieId: movie.id, chain: c.id as ChainId, day: today, ...p }), movieId: movie.id, chain: c.id as ChainId, day: today, ...p })))
    }
  }
  return { movies, shows }
}

/**
 * Normaliza lo guardado (también las versiones anteriores: tres pantallas + dos afiches → cuatro carteles; películas por
 * cadena → catálogo único con funciones) y garantiza que estén siempre las tres cadenas, en orden. Las funciones de días
 * que ya pasaron se descartan.
 */
export const cleanCine = (v: unknown, now = new Date()): CineState => {
  const o = (v ?? {}) as Record<string, unknown>
  const today = isoDay(now)
  const old = o as { screens?: unknown[]; screen?: unknown; posters?: unknown[] }
  const rawPosters: unknown[] = Array.isArray(old.posters) && old.posters.some((p) => p && typeof p === 'object') ? old.posters : [old.screens?.[0] ?? old.screen, old.screens?.[1], old.screens?.[2], old.posters?.[0]]
  const poster = (p: unknown): CinePoster => (p && typeof p === 'object' ? { title: str((p as CinePoster).title, 60), image: img((p as CinePoster).image) } : { title: '', image: img(p) })
  const p = [0, 1, 2, 3].map((i) => poster(rawPosters[i])) as CineState['posters']
  const rawChains = Array.isArray(o.chains) ? (o.chains as { id?: string; enabled?: boolean; mode?: string; movies?: unknown[] }[]) : []
  const chains = CHAINS.map((c) => {
    const saved = rawChains.find((x) => x?.id === c.id)
    return { id: c.id, enabled: saved?.enabled !== false, mode: (saved?.mode === 'auto' ? 'auto' : 'manual') as ChainMode }
  })
  let movies: CineMovie[]
  let shows: CineShow[]
  if (Array.isArray(o.movies)) {
    movies = o.movies.slice(0, MAX_MOVIES).map(cleanMovie)
    const ids = new Set(movies.map((m) => m.id))
    const seen = new Set<string>()
    shows = (Array.isArray(o.shows) ? o.shows : [])
      .map(cleanShow)
      .filter((s): s is CineShow => !!s && s.day >= today && ids.has(s.movieId) && !seen.has(s.id) && !!seen.add(s.id))
      .slice(0, MAX_SHOWS)
  } else ({ movies, shows } = fromLegacyChains(rawChains, today))
  return { enabled: o.enabled !== false, boardOn: o.boardOn !== false, lobbyOn: o.lobbyOn !== false, posters: p, chains, movies, shows, demo: o.demo !== false }
}

export const useCine = create<CineState & { set: (patch: Partial<CineState>) => void }>()(
  persist((set) => ({ ...emptyCine(), set: (patch) => set(patch) }), {
    name: 'cm:cine:v3',
    storage: safeStorage,
    // Lo guardado en el navegador se normaliza al cargar (por si faltan campos o cadenas).
    merge: (saved, current) => ({ ...current, ...cleanCine(saved) }),
  }),
)
