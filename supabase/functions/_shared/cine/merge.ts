import { detectFormat, detectLang, normalizeTitle, toHHMM, toISODay } from './normalize.ts'
import { CHAIN_IDS, type ChainId, type MergedMovie, type MergedShow, type ProviderResult } from './types.ts'

/** Tope de funciones por lectura (defensa ante una respuesta desbordada). */
export const MAX_FEED_SHOWS = 2000

/**
 * Une las lecturas de las cadenas: reconoce la misma película aunque cada cadena la nombre distinto (por título
 * normalizado), junta sus datos (primer cartel, género, minutos y clasificación que aparezcan; la sinopsis más larga) y
 * deja las funciones limpias (hora «HH:MM», día «AAAA-MM-DD», formato e idioma), sin repetidas y ordenadas.
 */
export function mergeFeed(results: Partial<Record<ChainId, ProviderResult>>): { movies: MergedMovie[]; shows: MergedShow[] } {
  const movies = new Map<string, MergedMovie>()
  const shows = new Map<string, MergedShow>()
  for (const chain of CHAIN_IDS) {
    const res = results[chain]
    if (!res) continue
    // id de la cadena → id unificado
    const idOf = new Map<string, string>()
    for (const m of res.movies) {
      const key = normalizeTitle(m.title)
      if (!key) continue
      const id = `api-${key.replace(/ /g, '-')}`
      idOf.set(m.externalId, id)
      const prev = movies.get(id)
      if (!prev) {
        movies.set(id, { id, title: m.title.trim(), image: m.image || null, genre: m.genre.trim(), minutes: m.minutes && m.minutes > 0 ? Math.round(m.minutes) : null, rating: m.rating.trim(), synopsis: m.synopsis.trim() })
      } else {
        movies.set(id, {
          ...prev,
          image: prev.image || m.image || null,
          genre: prev.genre || m.genre.trim(),
          minutes: prev.minutes ?? (m.minutes && m.minutes > 0 ? Math.round(m.minutes) : null),
          rating: prev.rating || m.rating.trim(),
          synopsis: m.synopsis.trim().length > prev.synopsis.length ? m.synopsis.trim() : prev.synopsis,
        })
      }
    }
    for (const s of res.shows) {
      const movieId = idOf.get(s.externalMovieId)
      const time = toHHMM(s.time)
      const day = toISODay(s.day)
      if (!movieId || !time || !day) continue
      const label = s.label ?? ''
      const format = detectFormat(label)
      const lang = detectLang(label)
      const id = `${movieId}|${chain}|${day}|${time}|${format}|${lang}`
      if (!shows.has(id) && shows.size < MAX_FEED_SHOWS) shows.set(id, { id, movieId, chain, day, time, format, lang })
    }
  }
  const used = new Set([...shows.values()].map((s) => s.movieId))
  return {
    movies: [...movies.values()].filter((m) => used.has(m.id)).sort((a, b) => a.title.localeCompare(b.title)),
    shows: [...shows.values()].sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time)),
  }
}
