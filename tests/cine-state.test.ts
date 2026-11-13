import { describe, expect, it } from 'vitest'
import { CHAINS, MAX_MOVIES, MAX_SHOWTIMES, cleanCine, emptyCine, parseShowtimes } from '../src/state/cine'

describe('estado del cine', () => {
  it('por defecto: cuatro carteles, las tres cadenas en orden y las dos interacciones encendidas', () => {
    const c = emptyCine()
    expect(c.posters).toHaveLength(4)
    expect(c.chains.map((x) => x.id)).toEqual(CHAINS.map((x) => x.id))
    expect(c.chains.map((x) => x.id)).toEqual(['cine-colombia', 'royal-films', 'procinal'])
    expect(c.boardOn && c.lobbyOn && c.enabled).toBe(true)
  })

  it('convierte lo guardado antes (tres pantallas + dos afiches) en cuatro carteles', () => {
    const c = cleanCine({ enabled: true, screens: ['a', 'b', 'c'], posters: ['d', 'e'] })
    expect(c.posters.map((p) => p.image)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('rellena lo que falte y descarta basura', () => {
    expect(cleanCine(null)).toEqual(emptyCine())
    const c = cleanCine({ chains: [{ id: 'procinal', enabled: false, movies: [{ title: '  Hola  ', minutes: -3, showtimes: ['14:30', '', 5] }, 7] }, { id: 'otra' }] })
    expect(c.chains.map((x) => x.id)).toEqual(['cine-colombia', 'royal-films', 'procinal'])
    const p = c.chains[2]
    expect(p.enabled).toBe(false)
    expect(p.movies[0]).toMatchObject({ title: 'Hola', minutes: null, showtimes: ['14:30'] })
    expect(p.movies).toHaveLength(2)
  })

  it('respeta los interruptores apagados y limita la cantidad de películas', () => {
    const many = Array.from({ length: MAX_MOVIES + 5 }, (_, i) => ({ id: `m${i}`, title: `P${i}` }))
    const c = cleanCine({ boardOn: false, lobbyOn: false, enabled: false, chains: [{ id: 'cine-colombia', movies: many }] })
    expect([c.enabled, c.boardOn, c.lobbyOn]).toEqual([false, false, false])
    expect(c.chains[0].movies).toHaveLength(MAX_MOVIES)
  })

  it('los horarios se separan por comas y se limitan', () => {
    expect(parseShowtimes('14:30, 17:00 ;20:15\n  ')).toEqual(['14:30', '17:00', '20:15'])
    expect(parseShowtimes(Array.from({ length: 20 }, (_, i) => `1${i}:00`).join(','))).toHaveLength(MAX_SHOWTIMES)
  })
})
