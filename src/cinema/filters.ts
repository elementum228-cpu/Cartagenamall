import type { Cinema, MovieShowtimes, ProviderBlock, ProviderId, Showtime, ShowtimesResponse } from './api'

/** Una función con todo su contexto (cadena, sede, película): lo que filtra y agrupa la interfaz. */
export interface Row {
  provider: Pick<ProviderBlock, 'id' | 'name' | 'officialUrl'>
  cinema: Pick<Cinema, 'id' | 'name' | 'address'>
  movie: Pick<MovieShowtimes, 'title' | 'posterUrl' | 'durationMinutes' | 'rating'>
  showtime: Showtime
}

export interface Filters {
  provider?: ProviderId
  format?: string
  language?: string
}

export function listRows(resp: ShowtimesResponse): Row[] {
  return resp.providers.flatMap((p) => p.cinemas.flatMap((c) => c.movies.flatMap((m) => m.showtimes.map((s) => ({ provider: { id: p.id, name: p.name, officialUrl: p.officialUrl }, cinema: { id: c.id, name: c.name, address: c.address }, movie: { title: m.title, posterUrl: m.posterUrl, durationMinutes: m.durationMinutes, rating: m.rating }, showtime: s })))))
}

export function applyFilters(rows: Row[], f: Filters): Row[] {
  return rows.filter((r) => (!f.provider || r.provider.id === f.provider) && (!f.format || r.showtime.format === f.format) && (!f.language || r.showtime.language === f.language))
}

/** Opciones de formato e idioma que de verdad existen en la respuesta (para no ofrecer filtros vacíos). */
export function facets(rows: Row[]): { formats: string[]; languages: string[] } {
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort()
  return { formats: uniq(rows.map((r) => r.showtime.format)), languages: uniq(rows.map((r) => r.showtime.language)) }
}

export interface MovieGroup {
  title: string
  posterUrl: string | null
  durationMinutes: number | null
  rating: string | null
  /** Por sede, con sus horas ordenadas. */
  venues: { provider: Row['provider']; cinema: Row['cinema']; showtimes: Showtime[] }[]
}

/** Agrupa por película y, dentro de cada una, por sede (ordenadas por nombre de película y de cadena/sede). */
export function groupByMovie(rows: Row[]): MovieGroup[] {
  const movies = new Map<string, MovieGroup>()
  for (const r of rows) {
    const key = r.movie.title.toLowerCase()
    let g = movies.get(key)
    if (!g) movies.set(key, (g = { title: r.movie.title, posterUrl: r.movie.posterUrl, durationMinutes: r.movie.durationMinutes, rating: r.movie.rating, venues: [] }))
    g.posterUrl ??= r.movie.posterUrl
    g.durationMinutes ??= r.movie.durationMinutes
    g.rating ??= r.movie.rating
    let v = g.venues.find((x) => x.provider.id === r.provider.id && x.cinema.id === r.cinema.id)
    if (!v) g.venues.push((v = { provider: r.provider, cinema: r.cinema, showtimes: [] }))
    v.showtimes.push(r.showtime)
  }
  for (const g of movies.values()) {
    g.venues.sort((a, b) => a.provider.name.localeCompare(b.provider.name) || a.cinema.name.localeCompare(b.cinema.name))
    for (const v of g.venues) v.showtimes.sort((a, b) => a.time.localeCompare(b.time))
  }
  return [...movies.values()].sort((a, b) => a.title.localeCompare(b.title))
}

/** «Actualizado hace 5 min» (null si no hay fecha). */
export function updatedAgo(iso: string | null, now = new Date()): string | null {
  if (!iso) return null
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000))
  if (min < 1) return 'Actualizado hace un momento'
  if (min < 60) return `Actualizado hace ${min} min`
  if (min < 1440) return `Actualizado hace ${Math.round(min / 60)} h`
  return `Actualizado hace ${Math.round(min / 1440)} días`
}
