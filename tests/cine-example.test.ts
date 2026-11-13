import { describe, expect, it } from 'vitest'
import { CHAINS, DAYS_AHEAD, cleanCine, nextDays, showsOf } from '../src/state/cine'
import { exampleCine } from '../src/state/cineExample'

const NOW = new Date(2026, 10, 13, 9, 0)

describe('ejemplo del cine', () => {
  const ex = exampleCine(NOW)
  const days = nextDays(DAYS_AHEAD, NOW)

  it('trae películas, cuatro carteles con título y funciones de toda la semana', () => {
    expect(ex.movies.length).toBe(6)
    expect(ex.posters.map((p) => p.title)).toEqual(ex.movies.slice(0, 4).map((m) => m.title))
    for (const d of days) expect(ex.shows.some((s) => s.day === d)).toBe(true)
  })

  it('cada cadena tiene funciones cada día y varias películas comparten cadenas distintas', () => {
    for (const c of CHAINS) for (const d of days) expect(ex.shows.filter((s) => s.chain === c.id && s.day === d).length).toBeGreaterThan(3)
    const multi = ex.movies.filter((m) => CHAINS.filter((c) => showsOf(ex.shows, m.id, c.id, days[0]).length).length >= 2)
    expect(multi.length).toBeGreaterThan(2)
  })

  it('pasa la normalización sin perder nada y es siempre el mismo', () => {
    const c = cleanCine({ ...ex }, NOW)
    expect(c.movies).toHaveLength(ex.movies.length)
    expect(c.shows).toHaveLength(ex.shows.length)
    expect(exampleCine(NOW).shows).toEqual(ex.shows)
  })
})
