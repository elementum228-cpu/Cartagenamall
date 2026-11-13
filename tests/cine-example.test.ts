import { describe, expect, it } from 'vitest'
import { CHAINS, DAYS_AHEAD, cleanCine, nextDays, showsOf } from '../src/state/cine'
import { exampleCine } from '../src/state/cineExample'
import { withDemo, withDemoPosters } from '../src/state/cineFeed'

const NOW = new Date(2026, 10, 13, 9, 0)

describe('ejemplo del cine', () => {
  const ex = exampleCine(NOW)
  const days = nextDays(DAYS_AHEAD, NOW)

  it('trae películas, cuatro carteles con título y funciones de toda la semana', () => {
    expect(ex.movies.length).toBe(6)
    expect(ex.posters.map((p) => p.title)).toEqual(ex.movies.slice(0, 4).map((m) => m.title))
    for (const d of days) expect(ex.shows.some((s) => s.day === d)).toBe(true)
  })

  it('las películas traen cartel, sinopsis y algunas son estreno', () => {
    expect(ex.movies.every((m) => m.image?.startsWith('data:image/svg+xml') && m.synopsis.length > 20)).toBe(true)
    expect(ex.movies.some((m) => m.isNew)).toBe(true)
    expect(ex.movies.some((m) => !m.isNew)).toBe(true)
    expect(ex.posters.every((p, i) => p.image === ex.movies[i].image)).toBe(true)
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

  it('sin datos y con el ejemplo encendido se muestra el ejemplo (avisando); con datos reales o apagado, no', () => {
    const empty = { movies: [], shows: [] }
    const on = withDemo(true, empty, NOW)
    expect(on.demo).toBe(true)
    expect(on.movies.length).toBe(6)
    expect(on.shows.some((s) => s.day === days[0])).toBe(true)
    expect(withDemo(false, empty, NOW)).toEqual({ ...empty, demo: false })
    const own = { movies: [{ ...ex.movies[0], id: 'mio' }], shows: [] }
    expect(withDemo(true, own, NOW)).toEqual({ ...own, demo: false })
  })

  it('el ejemplo siempre arranca hoy: al cambiar el día, las funciones se corren', () => {
    const tomorrow = new Date(2026, 10, 14, 9, 0)
    expect(withDemo(true, { movies: [], shows: [] }, tomorrow).shows.every((s) => s.day >= '2026-11-14')).toBe(true)
  })

  it('los carteles del ejemplo salen solo si no hay ninguno cargado', () => {
    const none = [0, 1, 2, 3].map(() => ({ title: '', image: null })) as ReturnType<typeof exampleCine>['posters']
    expect(withDemoPosters(true, none, NOW).map((p) => p.title)).toEqual(ex.posters.map((p) => p.title))
    expect(withDemoPosters(false, none, NOW)).toBe(none)
    const mine = [{ title: 'Mía', image: null }, ...none.slice(1)] as typeof none
    expect(withDemoPosters(true, mine, NOW)).toBe(mine)
  })
})
