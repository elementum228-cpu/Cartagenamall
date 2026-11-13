import { normalizeTitle } from '../../supabase/functions/_shared/cine/normalize'
import { MAX_MOVIES, cleanMovie, newMovie, type ChainId, type CineMovie } from './cine'

/**
 * Importación de películas a la cartelera. Acepta dos formatos:
 *  - una lista JSON: `[{ "title": "…", "genre": "…", "minutes": 120, "rating": "12+", "synopsis": "…", "isNew": true,
 *    "release": "2026-12-17", "links": { "cine-colombia": "https://…" } }]`
 *  - líneas separadas por «|»: `Título | Género | Minutos | Clasificación | Estreno (sí/no) | Fecha AAAA-MM-DD | Enlace Cine Colombia | Enlace Royal Films | Enlace Procinal`
 *    (solo el título es obligatorio; las líneas que empiezan con # se ignoran).
 */
export interface ParsedList {
  items: Partial<CineMovie>[]
  errors: string[]
}

const YES = /^(s[ií]|s|x|1|true|yes)$/i

export function parseMovieList(text: string): ParsedList {
  const t = text.trim()
  if (!t) return { items: [], errors: [] }
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as unknown
      const arr = Array.isArray(j) ? j : [j]
      return { items: arr.filter((x) => x && typeof x === 'object') as Partial<CineMovie>[], errors: [] }
    } catch {
      return { items: [], errors: ['El JSON no es válido: revisa comas y comillas.'] }
    }
  }
  const items: Partial<CineMovie>[] = []
  const errors: string[] = []
  t.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const c = line.split('|').map((x) => x.trim())
    if (!c[0]) {
      errors.push(`Línea ${i + 1}: falta el título.`)
      return
    }
    const links: Partial<Record<ChainId, string>> = {}
    if (c[6]) links['cine-colombia'] = c[6]
    if (c[7]) links['royal-films'] = c[7]
    if (c[8]) links.procinal = c[8]
    items.push({ title: c[0], genre: c[1] ?? '', minutes: Number(c[2]?.replace(/\D/g, '')) || null, rating: c[3] ?? '', isNew: YES.test(c[4] ?? ''), release: c[5] ?? '', links })
  })
  return { items, errors }
}

export interface ImportResult {
  movies: CineMovie[]
  added: number
  updated: number
  skipped: number
  errors: string[]
}

const idFor = (title: string) => `i-${normalizeTitle(title).replace(/ /g, '-').slice(0, 40)}`

/**
 * Suma las películas importadas al catálogo. Una que ya existe (mismo título, sin importar tildes ni mayúsculas) se actualiza
 * sin pisar lo que la administración cargó (cartel, sinopsis, enlaces y datos ya escritos se conservan; solo se completan los
 * vacíos), salvo la fecha de estreno y la etiqueta «Estreno», que se renuevan. Se respeta el máximo del catálogo.
 */
export function importMovies(existing: CineMovie[], items: Partial<CineMovie>[]): ImportResult {
  const movies = existing.map((m) => ({ ...m }))
  const byKey = new Map(movies.map((m, i) => [normalizeTitle(m.title), i]))
  let added = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []
  for (const raw of items) {
    const incoming = cleanMovie({ ...raw, id: idFor(String(raw.title ?? '')) }, movies.length)
    const key = normalizeTitle(incoming.title)
    if (!key) {
      skipped++
      errors.push('Una película sin título se omitió.')
      continue
    }
    const at = byKey.get(key)
    if (at !== undefined) {
      const cur = movies[at]
      movies[at] = {
        ...cur,
        genre: cur.genre || incoming.genre,
        minutes: cur.minutes ?? incoming.minutes,
        rating: cur.rating || incoming.rating,
        synopsis: cur.synopsis || incoming.synopsis,
        links: { ...incoming.links, ...cur.links },
        release: incoming.release || cur.release,
        isNew: raw.isNew === undefined ? cur.isNew : incoming.isNew,
      }
      updated++
    } else if (movies.length >= MAX_MOVIES) {
      skipped++
      if (!errors.some((e) => e.startsWith('Se llegó'))) errors.push(`Se llegó al máximo de ${MAX_MOVIES} películas: las demás se omitieron.`)
    } else {
      movies.push({ ...newMovie(), ...incoming })
      byKey.set(key, movies.length - 1)
      added++
    }
  }
  return { movies, added, updated, skipped, errors }
}
