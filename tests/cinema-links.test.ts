import { describe, expect, it } from 'vitest'
import { CINEMA_DIRECTORY, movieLink } from '../src/cinema/venues'
import { OFFICIAL_CINEMAS } from '../src/cinema/official'
import { CHAINS, OFFICIAL_HOSTS, cleanCine, isOfficialLink } from '../src/state/cine'
import { effectiveCine } from '../src/state/cineFeed'

const NOW = new Date(2026, 10, 13, 9, 0)

describe('enlaces oficiales', () => {
  it('solo valen https de los dominios de esa cadena (o sus subdominios), sin credenciales', () => {
    expect(isOfficialLink('cine-colombia', 'https://www.cinecolombia.com/peliculas/avengers-doomsday')).toBe(true)
    expect(isOfficialLink('procinal', 'https://www.procinal.com.co/pelicula/x')).toBe(true)
    expect(isOfficialLink('royal-films', 'https://cinemasroyal.com/cartelera/cartagena')).toBe(true)
    expect(isOfficialLink('cine-colombia', 'http://www.cinecolombia.com/x')).toBe(false)
    expect(isOfficialLink('cine-colombia', 'https://www.procinal.com.co/x')).toBe(false)
    expect(isOfficialLink('cine-colombia', 'https://cinecolombia.com.evil.co/x')).toBe(false)
    expect(isOfficialLink('cine-colombia', 'https://user:pw@www.cinecolombia.com/x')).toBe(false)
    expect(isOfficialLink('cine-colombia', 'javascript:alert(1)')).toBe(false)
    expect(isOfficialLink('cine-colombia', 'no es un enlace')).toBe(false)
  })

  it('al normalizar lo guardado se descartan los enlaces que no son oficiales', () => {
    const c = cleanCine({ movies: [{ id: 'a', title: 'A', links: { 'cine-colombia': 'https://www.cinecolombia.com/peliculas/a', procinal: 'https://otro-sitio.com/a', 'royal-films': 5, inventada: 'https://x.com' } }, { id: 'b', title: 'B', links: 'raro' }] }, NOW)
    expect(c.movies[0].links).toEqual({ 'cine-colombia': 'https://www.cinecolombia.com/peliculas/a' })
    expect(c.movies[1].links).toEqual({})
    expect(cleanCine({ movies: [{ id: 'a', title: 'A' }] }, NOW).movies[0].links).toEqual({})
  })

  it('el botón de una película lleva a su enlace oficial; sin él, a la cartelera de la cadena en Cartagena', () => {
    expect(movieLink('cine-colombia', { 'cine-colombia': 'https://www.cinecolombia.com/peliculas/a' })).toEqual({ url: 'https://www.cinecolombia.com/peliculas/a', direct: true })
    expect(movieLink('procinal', {})).toEqual({ url: 'https://www.procinal.com.co/ciudad/cartagena', direct: false })
    expect(movieLink('royal-films', undefined).direct).toBe(false)
  })

  it('las películas leídas automáticamente conservan los enlaces del catálogo', () => {
    const own = { id: 'm1', title: 'Avengers', image: null, genre: '', minutes: null, rating: '', synopsis: '', links: { procinal: 'https://www.procinal.com.co/pelicula/a' }, isNew: false }
    const chains = CHAINS.map((c) => ({ id: c.id, enabled: true, mode: 'manual' as const }))
    expect(effectiveCine({ chains, movies: [own], shows: [] }, null).movies[0].links).toEqual(own.links)
  })
})

describe('guía de salas', () => {
  it('trae las tres cadenas con su cartelera oficial de Cartagena, en https y de sus dominios', () => {
    expect(CINEMA_DIRECTORY.map((d) => d.id)).toEqual(CHAINS.map((c) => c.id))
    for (const d of CINEMA_DIRECTORY) {
      expect(isOfficialLink(d.id, d.url)).toBe(true)
      for (const v of d.venues) expect(isOfficialLink(d.id, v.url)).toBe(true)
    }
  })

  it('coincide con las carteleras que usa el resto de la integración', () => {
    const byId: Record<string, string> = { 'cine-colombia': 'cinecolombia', 'royal-films': 'royalfilms', procinal: 'procinal' }
    for (const d of CINEMA_DIRECTORY) expect(d.url).toBe(OFFICIAL_CINEMAS.find((o) => o.id === byId[d.id])!.url)
  })

  it('solo lista las salas verificadas (las tres de Cine Colombia, con dirección); las otras cadenas, solo su cartelera', () => {
    const cc = CINEMA_DIRECTORY.find((d) => d.id === 'cine-colombia')!
    expect(cc.venues.map((v) => v.name)).toEqual(['Caribe Plaza', 'Paseo La Castellana', 'Plaza Bocagrande'])
    expect(cc.venues.every((v) => v.address.length > 5)).toBe(true)
    expect(CINEMA_DIRECTORY.find((d) => d.id === 'royal-films')!.venues).toEqual([])
    expect(CINEMA_DIRECTORY.find((d) => d.id === 'procinal')!.venues).toEqual([])
  })

  it('cada cadena tiene sus dominios oficiales definidos', () => {
    for (const c of CHAINS) expect(OFFICIAL_HOSTS[c.id].length).toBeGreaterThan(0)
  })
})

import { partitionMovies } from '../src/state/cineFeed'
import type { CineMovie, CineShow } from '../src/state/cine'

describe('cartelera y pronto (sin necesidad de horarios)', () => {
  const mk = (id: string, extra: Partial<CineMovie> = {}): CineMovie => ({ id, title: id.toUpperCase(), image: null, genre: '', minutes: null, rating: '', synopsis: '', links: {}, soon: false, isNew: false, ...extra })
  const show = (movieId: string, chain: CineShow['chain']): CineShow => ({ id: `${movieId}|${chain}`, movieId, chain, day: '2026-11-13', time: '19:00', format: '', lang: '' })
  const all = CHAINS.map((c) => c.id)

  it('una película cargada sin horarios está en cartelera; solo va a «Pronto» si se marca como próximamente', () => {
    const { nowPlaying, soon } = partitionMovies([mk('a'), mk('b', { soon: true })], [], all, 'all')
    expect(nowPlaying.map((m) => m.id)).toEqual(['a'])
    expect(soon.map((m) => m.id)).toEqual(['b'])
  })

  it('estrenos primero y luego por título', () => {
    const { nowPlaying } = partitionMovies([mk('c'), mk('a'), mk('b', { isNew: true })], [], all, 'all')
    expect(nowPlaying.map((m) => m.id)).toEqual(['b', 'a', 'c'])
  })

  it('con una cadena elegida: las que tienen funciones o enlace ahí, y las que no se sabe en cuál están', () => {
    const movies = [mk('a'), mk('b'), mk('c', { links: { procinal: 'https://www.procinal.com.co/x' } }), mk('d')]
    const shows = [show('a', 'cine-colombia'), show('b', 'royal-films')]
    expect(partitionMovies(movies, shows, all, 'cine-colombia').nowPlaying.map((m) => m.id)).toEqual(['a', 'd'])
    expect(partitionMovies(movies, shows, all, 'procinal').nowPlaying.map((m) => m.id)).toEqual(['c', 'd'])
    expect(partitionMovies(movies, shows, all, 'all').nowPlaying.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('una cadena oculta no cuenta', () => {
    const movies = [mk('a')]
    expect(partitionMovies(movies, [show('a', 'royal-films')], ['cine-colombia', 'procinal'], 'cine-colombia').nowPlaying.map((m) => m.id)).toEqual(['a'])
  })

  it('«próximamente» se guarda al normalizar', () => {
    expect(cleanCine({ movies: [{ id: 'a', title: 'A', soon: true }, { id: 'b', title: 'B', soon: 'sí' }] }, NOW).movies.map((m) => m.soon)).toEqual([true, false])
  })
})
