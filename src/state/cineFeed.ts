import { useMemo } from 'react'
import { create } from 'zustand'
import { mergeFeed } from '../../supabase/functions/_shared/cine/merge'
import { normalizeTitle } from '../../supabase/functions/_shared/cine/normalize'
import { CHAIN_IDS, type FeedChainDoc, type FeedDoc, type ProviderMovie, type ProviderShow } from '../../supabase/functions/_shared/cine/types'
import { useCine, type CineState, type CineChain, type CineMovie, type CineShow, type ChainId } from './cine'
import { exampleCine } from './cineExample'

/**
 * Programación leída automáticamente de los sitios de las cadenas (la escribe la función `cine-sync` en mall_settings
 * «cine_feed»; todos la leen). Cada cadena en modo «Automático» usa estos datos; en «Manual», lo que carga la administración.
 */
export const useCineFeed = create<{ doc: FeedDoc | null; set: (doc: FeedDoc | null) => void }>()((set) => ({ doc: null, set: (doc) => set({ doc }) }))

const str = (x: unknown, max = 400) => (typeof x === 'string' ? x.slice(0, max) : '')

function cleanChainDoc(v: unknown): FeedChainDoc | null {
  const o = (v ?? null) as Partial<FeedChainDoc> | null
  if (!o || typeof o !== 'object') return null
  const movies: ProviderMovie[] = (Array.isArray(o.movies) ? o.movies : []).slice(0, 80).map((m: Partial<ProviderMovie>) => ({
    externalId: str(m?.externalId, 80),
    title: str(m?.title, 120),
    image: typeof m?.image === 'string' && m.image ? m.image : null,
    genre: str(m?.genre, 40),
    minutes: typeof m?.minutes === 'number' && m.minutes > 0 ? Math.round(m.minutes) : null,
    rating: str(m?.rating, 8),
    synopsis: str(m?.synopsis),
  }))
  const shows: ProviderShow[] = (Array.isArray(o.shows) ? o.shows : []).slice(0, 1500).map((s: Partial<ProviderShow>) => ({ externalMovieId: str(s?.externalMovieId, 80), day: str(s?.day, 12), time: str(s?.time, 12), label: str(s?.label, 60), theater: str(s?.theater, 80) }))
  return { at: typeof o.at === 'string' ? o.at : null, ok: o.ok === true, message: str(o.message, 200), movies, shows }
}

/** Normaliza lo que viene de la base de datos. */
export function cleanFeed(v: unknown): FeedDoc | null {
  const o = (v ?? null) as { chains?: Record<string, unknown> } | null
  if (!o || typeof o !== 'object' || !o.chains) return null
  const chains: FeedDoc['chains'] = {}
  for (const id of CHAIN_IDS) {
    const c = cleanChainDoc(o.chains[id])
    if (c) chains[id] = c
  }
  return { chains }
}

/**
 * Lo que ve el visitante: las funciones manuales de las cadenas en «Manual» más las leídas de las cadenas en «Automático».
 * Una película leída que coincide por título con una del catálogo manual usa la del catálogo (cartel y sinopsis que la
 * administración cuidó), completando con lo que falte desde la lectura.
 */
export function effectiveCine(cine: { chains: CineChain[]; movies: CineMovie[]; shows: CineShow[] }, feed: FeedDoc | null): { movies: CineMovie[]; shows: CineShow[] } {
  const auto = new Set(cine.chains.filter((c) => c.mode === 'auto').map((c) => c.id))
  const manualShows = cine.shows.filter((s) => !auto.has(s.chain))
  if (!auto.size || !feed) return { movies: cine.movies, shows: manualShows }
  const read: Partial<Record<ChainId, { movies: ProviderMovie[]; shows: ProviderShow[] }>> = {}
  for (const id of auto) {
    const c = feed.chains[id]
    if (c) read[id] = { movies: c.movies, shows: c.shows }
  }
  const merged = mergeFeed(read)
  const byKey = new Map(cine.movies.map((m) => [normalizeTitle(m.title), m]))
  const movies = [...cine.movies]
  const remap = new Map<string, string>()
  for (const m of merged.movies) {
    const own = byKey.get(normalizeTitle(m.title))
    if (own) {
      remap.set(m.id, own.id)
      const i = movies.findIndex((x) => x.id === own.id)
      movies[i] = { ...own, image: own.image || m.image, genre: own.genre || m.genre, minutes: own.minutes ?? m.minutes, rating: own.rating || m.rating, synopsis: own.synopsis || m.synopsis }
    } else {
      movies.push({ id: m.id, title: m.title, image: m.image, genre: m.genre, minutes: m.minutes, rating: m.rating, synopsis: m.synopsis, links: {}, soon: false, isNew: false })
    }
  }
  const liveShows: CineShow[] = merged.shows.map((s) => {
    const movieId = remap.get(s.movieId) ?? s.movieId
    return { ...s, movieId, id: `${movieId}|${s.chain}|${s.day}|${s.time}|${s.format}|${s.lang}` }
  })
  return { movies, shows: [...manualShows, ...liveShows] }
}

/**
 * Reparte las películas entre «Cartelera» y «Pronto». Una película está en cartelera salvo que se marque «Próximamente»: no
 * hace falta cargar horarios (el botón lleva al sitio oficial). Con una cadena elegida, se muestran las que tienen funciones
 * o enlace en esa cadena y las que no se sabe en cuál están (sin funciones ni enlaces). Estrenos primero, luego por título.
 */
export function partitionMovies(movies: CineMovie[], shows: CineShow[], visible: ChainId[], pick: ChainId | 'all'): { nowPlaying: CineMovie[]; soon: CineMovie[] } {
  const shown = pick === 'all' ? visible : visible.filter((c) => c === pick)
  const inChain = (m: CineMovie, ids: ChainId[]) => shows.some((s) => s.movieId === m.id && ids.includes(s.chain)) || ids.some((c) => !!m.links[c])
  const order = (a: CineMovie, b: CineMovie) => Number(b.isNew) - Number(a.isNew) || a.title.localeCompare(b.title)
  return {
    nowPlaying: movies.filter((m) => !m.soon && (inChain(m, shown) || !inChain(m, visible))).sort(order),
    soon: movies.filter((m) => m.soon).sort(order),
  }
}

/**
 * Si no hay nada que mostrar (ni catálogo manual ni lectura automática) y la administración dejó el ejemplo encendido, se
 * muestra la programación de ejemplo (siempre de hoy en adelante). `demo` avisa a la interfaz para rotularlo.
 */
export function withDemo(demoOn: boolean, base: { movies: CineMovie[]; shows: CineShow[] }, now = new Date()): { movies: CineMovie[]; shows: CineShow[]; demo: boolean } {
  if (!demoOn || base.movies.length > 0) return { ...base, demo: false }
  const ex = exampleCine(now)
  return { movies: ex.movies, shows: ex.shows, demo: true }
}

/** Carteles de la cartelera: si no se cargó ninguno y el ejemplo está encendido, los del ejemplo. */
export function withDemoPosters(demoOn: boolean, posters: CineState['posters'], now = new Date()): CineState['posters'] {
  return demoOn && posters.every((p) => !p.image && !p.title) ? exampleCine(now).posters : posters
}

/** Catálogo y funciones tal como se ven en la app (manual + automático, o el ejemplo si no hay nada). */
export function useEffectiveCine() {
  const chains = useCine((s) => s.chains)
  const movies = useCine((s) => s.movies)
  const shows = useCine((s) => s.shows)
  const demo = useCine((s) => s.demo)
  const feed = useCineFeed((s) => s.doc)
  return useMemo(() => withDemo(demo, effectiveCine({ chains, movies, shows }, feed)), [chains, movies, shows, feed, demo])
}

/** Los cuatro carteles que se ven (los cargados, o los del ejemplo). */
export function useEffectivePosters(): CineState['posters'] {
  const posters = useCine((s) => s.posters)
  const demo = useCine((s) => s.demo)
  return useMemo(() => withDemoPosters(demo, posters), [posters, demo])
}
