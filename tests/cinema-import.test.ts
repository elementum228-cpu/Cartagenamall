import { describe, expect, it } from 'vitest'
import { CINE_COLOMBIA_SNAPSHOT } from '../src/cinema/cineColombiaSnapshot'
import { MAX_MOVIES, cleanMovie, isOfficialLink, newMovie, type CineMovie } from '../src/state/cine'
import { partitionMovies } from '../src/state/cineFeed'
import { importMovies, parseMovieList } from '../src/state/cineImport'
import { normalizeTitle } from '../supabase/functions/_shared/cine/normalize'

const mk = (extra: Partial<CineMovie>): CineMovie => ({ ...newMovie(), ...extra })

describe('leer una lista de películas', () => {
  it('líneas con «|»: solo el título es obligatorio; ignora vacías y comentarios', () => {
    const p = parseMovieList(`# cartelera\nAvengers: Doomsday | Acción | 166 | 12+ | no | 2026-12-17 | https://www.cinecolombia.com/peliculas/avengers-doomsday\n\nEncanto\n | Sin título | 90\n`)
    expect(p.items).toHaveLength(2)
    expect(p.items[0]).toMatchObject({ title: 'Avengers: Doomsday', genre: 'Acción', minutes: 166, rating: '12+', isNew: false, release: '2026-12-17', links: { 'cine-colombia': 'https://www.cinecolombia.com/peliculas/avengers-doomsday' } })
    expect(p.items[1]).toMatchObject({ title: 'Encanto', minutes: null })
    expect(p.errors).toEqual(['Línea 5: falta el título.'])
  })
  it('«sí» marca estreno', () => {
    expect(parseMovieList('A | | | | sí').items[0].isNew).toBe(true)
    expect(parseMovieList('A | | | | no').items[0].isNew).toBe(false)
  })
  it('JSON: una lista o un solo objeto; un JSON roto da un aviso, no un error', () => {
    expect(parseMovieList('[{"title":"A"},{"title":"B"}]').items).toHaveLength(2)
    expect(parseMovieList('{"title":"A"}').items).toHaveLength(1)
    expect(parseMovieList('[{"title":').errors[0]).toMatch(/JSON/)
    expect(parseMovieList('   ')).toEqual({ items: [], errors: [] })
  })
})

describe('importar al catálogo', () => {
  it('suma las nuevas y reconoce las que ya existen aunque cambien tildes o mayúsculas', () => {
    const r = importMovies([mk({ id: 'x', title: 'Misión Caribe' })], [{ title: 'MISION CARIBE (3D)' }, { title: 'Encanto' }])
    expect(r).toMatchObject({ added: 1, updated: 1, skipped: 0 })
    expect(r.movies.map((m) => m.title)).toEqual(['Misión Caribe', 'Encanto'])
  })

  it('no pisa lo que la administración cargó: cartel, sinopsis, enlaces y datos escritos se conservan; solo se completan vacíos', () => {
    const mine = mk({ id: 'x', title: 'Encanto', image: 'https://img/mio.jpg', synopsis: 'Mía', genre: '', rating: 'TP', links: { procinal: 'https://www.procinal.com.co/mia' } })
    const { movies } = importMovies([mine], [{ title: 'Encanto', genre: 'Animación', rating: '7+', synopsis: 'De la lista', minutes: 102, links: { 'cine-colombia': 'https://www.cinecolombia.com/peliculas/encanto', procinal: 'https://www.procinal.com.co/otra' } }])
    expect(movies[0]).toMatchObject({ id: 'x', image: 'https://img/mio.jpg', synopsis: 'Mía', rating: 'TP', genre: 'Animación', minutes: 102 })
    expect(movies[0].links).toEqual({ 'cine-colombia': 'https://www.cinecolombia.com/peliculas/encanto', procinal: 'https://www.procinal.com.co/mia' })
  })

  it('la fecha de estreno y la etiqueta «Estreno» sí se renuevan', () => {
    const { movies } = importMovies([mk({ title: 'A', release: '2026-11-19', isNew: false })], [{ title: 'A', release: '2026-11-26', isNew: true }])
    expect(movies[0]).toMatchObject({ release: '2026-11-26', isNew: true })
    expect(importMovies([mk({ title: 'A', isNew: true })], [{ title: 'A' }]).movies[0].isNew).toBe(true)
  })

  it('importar dos veces lo mismo no duplica nada', () => {
    const once = importMovies([], CINE_COLOMBIA_SNAPSHOT)
    const twice = importMovies(once.movies, CINE_COLOMBIA_SNAPSHOT)
    expect(twice.added).toBe(0)
    expect(twice.updated).toBe(CINE_COLOMBIA_SNAPSHOT.length)
    expect(twice.movies).toHaveLength(once.movies.length)
  })

  it('respeta el máximo del catálogo y avisa', () => {
    const items = Array.from({ length: MAX_MOVIES + 3 }, (_, i) => ({ title: `Película ${i}` }))
    const r = importMovies([], items)
    expect(r.movies).toHaveLength(MAX_MOVIES)
    expect(r).toMatchObject({ added: MAX_MOVIES, skipped: 3 })
    expect(r.errors[0]).toMatch(/máximo/)
  })

  it('omite lo que no tiene título', () => {
    expect(importMovies([], [{ title: '  ' }, {}]).skipped).toBe(2)
  })
})

describe('foto de la cartelera de Cine Colombia', () => {
  it('trae las películas con datos completos, sin repetidas y con enlaces oficiales', () => {
    expect(CINE_COLOMBIA_SNAPSHOT.length).toBeGreaterThanOrEqual(10)
    const keys = CINE_COLOMBIA_SNAPSHOT.map((m) => normalizeTitle(String(m.title)))
    expect(new Set(keys).size).toBe(keys.length)
    for (const m of CINE_COLOMBIA_SNAPSHOT) {
      expect(m.title).toBeTruthy()
      expect(m.minutes).toBeGreaterThan(60)
      expect(m.release).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(m.rating).toMatch(/^(\d+\+|TP)$/)
      expect(String(m.synopsis).length).toBeLessThanOrEqual(400)
      expect(isOfficialLink('cine-colombia', m.links!['cine-colombia']!)).toBe(true)
      const clean = cleanMovie({ ...m, id: 'x' }, 0)
      expect(clean.links).toEqual(m.links)
      expect(clean.release).toBe(m.release)
    }
  })
})

describe('estreno por fecha', () => {
  const movies = [mk({ id: 'a', title: 'A', release: '2026-11-12' }), mk({ id: 'b', title: 'B', release: '2026-11-19' }), mk({ id: 'c', title: 'C', release: '2026-12-17' }), mk({ id: 'd', title: 'D' }), mk({ id: 'e', title: 'E', soon: true })]
  const ids = (xs: CineMovie[]) => xs.map((m) => m.id)

  it('antes de su fecha va a «Pronto» (ordenadas por estreno); desde ese día, a «Cartelera»', () => {
    const before = partitionMovies(movies, [], ['procinal'], 'all', '2026-11-13')
    expect(ids(before.nowPlaying)).toEqual(['a', 'd'])
    expect(ids(before.soon)).toEqual(['b', 'c', 'e'])
    const onDay = partitionMovies(movies, [], ['procinal'], 'all', '2026-11-19')
    expect(ids(onDay.nowPlaying)).toEqual(['a', 'b', 'd'])
    expect(ids(onDay.soon)).toEqual(['c', 'e'])
  })
})
