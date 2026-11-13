import { describe, expect, it } from 'vitest'
import { CHAINS, DAYS_AHEAD, MAX_MOVIES, MAX_PER_DAY, cleanCine, dayLabel, emptyCine, formatShows, isoDay, nextDays, parseShows, repeatWeek, showsOf, withShows } from '../src/state/cine'

const NOW = new Date(2026, 10, 13, 12, 0) // viernes 13 de noviembre de 2026
const TODAY = '2026-11-13'

describe('estado del cine', () => {
  it('por defecto: cuatro carteles, las tres cadenas en orden, sin películas y las dos interacciones encendidas', () => {
    const c = emptyCine()
    expect(c.posters).toHaveLength(4)
    expect(c.chains.map((x) => x.id)).toEqual(['cine-colombia', 'royal-films', 'procinal'])
    expect(c.movies).toEqual([])
    expect(c.shows).toEqual([])
    expect(c.boardOn && c.lobbyOn && c.enabled).toBe(true)
  })

  it('convierte lo guardado antes (tres pantallas + dos afiches) en cuatro carteles', () => {
    const c = cleanCine({ enabled: true, screens: ['a', 'b', 'c'], posters: ['d', 'e'] }, NOW)
    expect(c.posters.map((p) => p.image)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('convierte las películas por cadena de antes en catálogo único + funciones de hoy', () => {
    const c = cleanCine(
      {
        chains: [
          { id: 'cine-colombia', movies: [{ id: 'x', title: 'Avengers', showtimes: ['14:30', '17:00'] }] },
          { id: 'royal-films', movies: [{ id: 'y', title: 'avengers', showtimes: ['15:10'] }, { id: 'z', title: 'Otra', showtimes: [] }] },
        ],
      },
      NOW,
    )
    expect(c.movies.map((m) => m.title)).toEqual(['Avengers', 'Otra'])
    const av = c.movies[0].id
    expect(showsOf(c.shows, av, 'cine-colombia', TODAY).map((s) => s.time)).toEqual(['14:30', '17:00'])
    expect(showsOf(c.shows, av, 'royal-films', TODAY).map((s) => s.time)).toEqual(['15:10'])
    expect(c.chains.map((x) => x.id)).toEqual(CHAINS.map((x) => x.id))
  })

  it('descarta funciones de días pasados, de películas que no existen, repetidas o mal escritas', () => {
    const base = { movieId: 'a', chain: 'procinal', format: '', lang: '' }
    const c = cleanCine(
      {
        movies: [{ id: 'a', title: 'A' }],
        shows: [{ ...base, day: '2026-11-12', time: '10:00' }, { ...base, day: TODAY, time: '9:05' }, { ...base, day: TODAY, time: '09:05' }, { ...base, movieId: 'nada', day: TODAY, time: '10:00' }, { ...base, day: TODAY, time: '25:00' }, { ...base, chain: 'otra', day: TODAY, time: '10:00' }],
      },
      NOW,
    )
    expect(c.shows.map((s) => s.time)).toEqual(['09:05'])
  })

  it('respeta los interruptores apagados y limita el catálogo', () => {
    const many = Array.from({ length: MAX_MOVIES + 5 }, (_, i) => ({ id: `m${i}`, title: `P${i}` }))
    const c = cleanCine({ boardOn: false, lobbyOn: false, enabled: false, movies: many, chains: [{ id: 'procinal', enabled: false }] }, NOW)
    expect([c.enabled, c.boardOn, c.lobbyOn]).toEqual([false, false, false])
    expect(c.movies).toHaveLength(MAX_MOVIES)
    expect(c.chains[2].enabled).toBe(false)
    expect(c.chains[0].enabled).toBe(true)
  })
})

describe('horarios', () => {
  it('se escriben en una línea, con formato e idioma opcionales', () => {
    expect(parseShows('14:30, 17:00 3D, 20:15 VIP SUB')).toEqual([
      { time: '14:30', format: '', lang: '' },
      { time: '17:00', format: '3D', lang: '' },
      { time: '20:15', format: 'VIP', lang: 'SUB' },
    ])
    expect(formatShows(parseShows('20:15 vip sub, 9:05 doblada'))).toBe('09:05 DOB, 20:15 VIP SUB')
  })

  it('sin repetidas, sin horas imposibles y con límite por día', () => {
    expect(parseShows('10:00, 10:00, 24:00, 12:60, hola')).toEqual([{ time: '10:00', format: '', lang: '' }])
    expect(parseShows(Array.from({ length: 20 }, (_, i) => `${String(i).padStart(2, '0')}:00`).join(','))).toHaveLength(MAX_PER_DAY)
  })

  it('una película muestra su hora en cada cadena y se pueden reemplazar por día', () => {
    let shows = withShows([], 'avengers', 'cine-colombia', TODAY, '14:30, 17:00')
    shows = withShows(shows, 'avengers', 'royal-films', TODAY, '15:10')
    shows = withShows(shows, 'avengers', 'procinal', TODAY, '16:00 3D')
    expect(CHAINS.map((c) => showsOf(shows, 'avengers', c.id, TODAY).map((s) => s.time).join('|'))).toEqual(['14:30|17:00', '15:10', '16:00'])
    shows = withShows(shows, 'avengers', 'cine-colombia', TODAY, '')
    expect(showsOf(shows, 'avengers', 'cine-colombia', TODAY)).toEqual([])
    expect(showsOf(shows, 'avengers', 'royal-films', TODAY)).toHaveLength(1)
  })

  it('repetir en la semana copia las funciones de una cadena a los demás días sin tocar a las otras', () => {
    const days = nextDays(DAYS_AHEAD, NOW)
    let shows = withShows([], 'a', 'procinal', TODAY, '16:00')
    shows = withShows(shows, 'a', 'royal-films', days[3], '11:00')
    const out = repeatWeek(shows, 'procinal', TODAY, days)
    expect(days.every((d) => showsOf(out, 'a', 'procinal', d).map((s) => s.time).join() === '16:00')).toBe(true)
    expect(showsOf(out, 'a', 'royal-films', days[3]).map((s) => s.time)).toEqual(['11:00'])
    expect(out).toHaveLength(DAYS_AHEAD + 1)
  })

  it('los días: hoy primero, siete días y etiquetas legibles', () => {
    const days = nextDays(DAYS_AHEAD, NOW)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe(TODAY)
    expect(days[6]).toBe('2026-11-19')
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dayLabel(days[0], TODAY)).toBe('Hoy')
    expect(dayLabel(days[1], TODAY)).toBe('Mañana')
    expect(dayLabel(days[2], TODAY)).toMatch(/15/)
  })
})
