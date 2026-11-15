import { useMemo } from 'react'
import { mergeFeed } from '../../supabase/functions/_shared/cine/merge'
import { normalizeTitle } from '../../supabase/functions/_shared/cine/normalize'
import type { FeedDoc, ProviderMovie, ProviderShow } from '../../supabase/functions/_shared/cine/types'
import { useCineFeed } from './cineFeedStore'
import { isoDay, useCine, type CineState, type CineChain, type CineMovie, type CineShow, type ChainId } from './cine'
import { exampleCine } from './cineExample'

export { cleanFeed, useCineFeed } from './cineFeedStore'

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
      movies.push({ id: m.id, title: m.title, image: m.image, genre: m.genre, minutes: m.minutes, rating: m.rating, synopsis: m.synopsis, links: {}, release: '', soon: false, isNew: false })
    }
  }
  const liveShows: CineShow[] = merged.shows.map((s) => {
    const movieId = remap.get(s.movieId) ?? s.movieId
    return { ...s, movieId, id: `${movieId}|${s.chain}|${s.day}|${s.time}|${s.format}|${s.lang}` }
  })
  return { movies, shows: [...manualShows, ...liveShows] }
}

/**
 * Reparte las películas entre «Cartelera» y «Pronto». Una película está en cartelera salvo que se marque «Próximamente» o su
 * fecha de estreno sea futura (el día del estreno pasa sola a cartelera): no
 * hace falta cargar horarios (el botón lleva al sitio oficial). Con una cadena elegida, se muestran las que tienen funciones
 * o enlace en esa cadena y las que no se sabe en cuál están (sin funciones ni enlaces). Estrenos primero, luego por título.
 */
export function partitionMovies(movies: CineMovie[], shows: CineShow[], visible: ChainId[], pick: ChainId | 'all', today = isoDay(new Date())): { nowPlaying: CineMovie[]; soon: CineMovie[] } {
  const upcoming = (m: CineMovie) => m.soon || (m.release !== '' && m.release > today)
  const shown = pick === 'all' ? visible : visible.filter((c) => c === pick)
  const inChain = (m: CineMovie, ids: ChainId[]) => shows.some((s) => s.movieId === m.id && ids.includes(s.chain)) || ids.some((c) => !!m.links[c])
  // los carteles cargados conservan su orden (el primero de la cartelera del frente es el destacado); el resto, por título
  const order = (a: CineMovie, b: CineMovie) => Number(b.isNew) - Number(a.isNew) || (a.id.startsWith('cartel-') && b.id.startsWith('cartel-') ? a.id.localeCompare(b.id) : a.title.localeCompare(b.title))
  return {
    nowPlaying: movies.filter((m) => !upcoming(m) && (inChain(m, shown) || !inChain(m, visible))).sort(order),
    soon: movies.filter(upcoming).sort((a, b) => (a.release || '9').localeCompare(b.release || '9') || order(a, b)),
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

/**
 * Los carteles de la cartelera del frente (los que la administración ya cargó) también son películas en cartelera dentro del cine: si el
 * catálogo está vacío, cada cartel con imagen o título se vuelve una película (sin horarios: su ficha manda al cine oficial). Así el
 * lobby usa lo que ya está cargado en vez del ejemplo.
 */
export function postersAsMovies(posters: CineState['posters']): { movies: CineMovie[]; shows: CineShow[] } {
  const movies: CineMovie[] = []
  posters.forEach((p, i) => {
    if (!p.image && !p.title) return
    movies.push({ id: `cartel-${i + 1}`, title: p.title || 'Próximo estreno', image: p.image, genre: '', minutes: null, rating: '', synopsis: p.synopsis ?? '', ...(p.trailer ? { trailer: p.trailer } : {}), links: {}, release: '', soon: false, isNew: false })
  })
  return { movies, shows: [] }
}

/** Una película del catálogo sin imagen toma la del cartel que se llama igual (si lo hay). */
export function mergePosterArt(movies: CineMovie[], posters: CineState['posters']): CineMovie[] {
  const art = new Map(posters.filter((p) => p.image && p.title).map((p) => [normalizeTitle(p.title), p]))
  return movies.map((m) => {
    const p = art.get(normalizeTitle(m.title))
    return m.image && m.synopsis && m.trailer ? m : { ...m, image: m.image ?? p?.image ?? null, synopsis: m.synopsis || p?.synopsis || '', ...(m.trailer || p?.trailer ? { trailer: m.trailer || p?.trailer } : {}) }
  })
}

/** Catálogo y funciones tal como se ven en la app (manual + automático, los carteles cargados, o el ejemplo si no hay nada). */
export function useEffectiveCine() {
  const chains = useCine((s) => s.chains)
  const movies = useCine((s) => s.movies)
  const shows = useCine((s) => s.shows)
  const demo = useCine((s) => s.demo)
  const feed = useCineFeed((s) => s.doc)
  const posters = useCine((s) => s.posters)
  return useMemo(() => {
    const base = effectiveCine({ chains, movies, shows }, feed)
    return withDemo(demo, base.movies.length ? { ...base, movies: mergePosterArt(base.movies, posters) } : postersAsMovies(posters))
  }, [chains, movies, shows, feed, posters, demo])
}

/** Los cuatro carteles que se ven (los cargados, o los del ejemplo). */
export function useEffectivePosters(): CineState['posters'] {
  const posters = useCine((s) => s.posters)
  const demo = useCine((s) => s.demo)
  return useMemo(() => withDemoPosters(demo, posters), [posters, demo])
}
