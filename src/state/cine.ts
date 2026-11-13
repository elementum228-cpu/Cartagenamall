import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

/**
 * Cine (isla al norte del piso de comida). La administración lo enciende o apaga para todos y gestiona sus dos
 * interacciones: la cartelera del frente (4 carteles que se abren en una vista tipo sala) y la entrada al cine (puertas que
 * se abren a las tres cadenas con sus películas y horarios). Más adelante las películas vendrán de una API en tiempo real;
 * por ahora se cargan a mano. Se guarda en mall_settings «features».
 */

export type ChainId = 'cine-colombia' | 'royal-films' | 'procinal'

/** Las tres cadenas del cine. Los colores son de acento de la app (no logotipos). */
export const CHAINS: { id: ChainId; name: string; color: string; tagline: string }[] = [
  { id: 'cine-colombia', name: 'Cine Colombia', color: '#d7263d', tagline: 'Estrenos y cine para toda la familia' },
  { id: 'royal-films', name: 'Royal Films', color: '#8a5cf6', tagline: 'Salas y funciones para disfrutar' },
  { id: 'procinal', name: 'Procinal', color: '#0f9d8a', tagline: 'Tu cine en la ciudad' },
]

export interface CinePoster {
  title: string
  /** null = arte por defecto «Próximo estreno». */
  image: string | null
}

export interface CineMovie {
  id: string
  title: string
  image: string | null
  genre: string
  /** Duración en minutos (null = sin dato). */
  minutes: number | null
  /** Clasificación: «7+», «12+», «15+»… */
  rating: string
  /** Horas de función («14:30»). */
  showtimes: string[]
}

export interface CineChain {
  id: ChainId
  /** Si se apaga, la cadena no aparece dentro del cine. */
  enabled: boolean
  movies: CineMovie[]
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
}

export const MAX_MOVIES = 12
export const MAX_SHOWTIMES = 8

const emptyPoster = (): CinePoster => ({ title: '', image: null })
export const emptyChains = (): CineChain[] => CHAINS.map((c) => ({ id: c.id, enabled: true, movies: [] }))
export const emptyCine = (): CineState => ({
  enabled: true,
  boardOn: true,
  lobbyOn: true,
  posters: [emptyPoster(), emptyPoster(), emptyPoster(), emptyPoster()],
  chains: emptyChains(),
})

export const newMovie = (): CineMovie => ({ id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: '', image: null, genre: '', minutes: null, rating: '', showtimes: [] })

const str = (x: unknown, max = 120) => (typeof x === 'string' ? x.trim().slice(0, max) : '')
const img = (x: unknown) => (typeof x === 'string' && x ? x : null)

/** Horas separadas por comas, espacios o saltos de línea → lista sin vacíos (la hora se deja como la escribió el administrador). */
export const parseShowtimes = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_SHOWTIMES)

const cleanMovie = (v: unknown, i: number): CineMovie => {
  const o = (v ?? {}) as Partial<CineMovie>
  const minutes = typeof o.minutes === 'number' && Number.isFinite(o.minutes) && o.minutes > 0 ? Math.round(o.minutes) : null
  return {
    id: str(o.id, 40) || `m${i}`,
    title: str(o.title),
    image: img(o.image),
    genre: str(o.genre, 40),
    minutes,
    rating: str(o.rating, 8),
    showtimes: Array.isArray(o.showtimes) ? o.showtimes.map((t) => str(t, 12)).filter(Boolean).slice(0, MAX_SHOWTIMES) : [],
  }
}

/**
 * Normaliza lo guardado (también la versión anterior: tres pantallas + dos afiches → cuatro carteles) y garantiza que
 * estén siempre las tres cadenas, en orden.
 */
export const cleanCine = (v: unknown): CineState => {
  const o = (v ?? {}) as Record<string, unknown>
  const old = o as { screens?: unknown[]; screen?: unknown; posters?: unknown[] }
  const rawPosters: unknown[] = Array.isArray(old.posters) && old.posters.some((p) => p && typeof p === 'object') ? old.posters : [old.screens?.[0] ?? old.screen, old.screens?.[1], old.screens?.[2], old.posters?.[0]]
  const poster = (p: unknown): CinePoster => (p && typeof p === 'object' ? { title: str((p as CinePoster).title, 60), image: img((p as CinePoster).image) } : { title: '', image: img(p) })
  const p = [0, 1, 2, 3].map((i) => poster(rawPosters[i])) as CineState['posters']
  const rawChains = Array.isArray(o.chains) ? (o.chains as Partial<CineChain>[]) : []
  const chains = CHAINS.map((c) => {
    const saved = rawChains.find((x) => x?.id === c.id)
    return { id: c.id, enabled: saved?.enabled !== false, movies: Array.isArray(saved?.movies) ? saved.movies.slice(0, MAX_MOVIES).map(cleanMovie) : [] }
  })
  return { enabled: o.enabled !== false, boardOn: o.boardOn !== false, lobbyOn: o.lobbyOn !== false, posters: p, chains }
}

export const useCine = create<CineState & { set: (patch: Partial<CineState>) => void }>()(
  persist((set) => ({ ...emptyCine(), set: (patch) => set(patch) }), {
    name: 'cm:cine:v3',
    storage: safeStorage,
    // Lo guardado en el navegador se normaliza al cargar (por si faltan campos o cadenas).
    merge: (saved, current) => ({ ...current, ...cleanCine(saved) }),
  }),
)
