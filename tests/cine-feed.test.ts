import { describe, expect, it } from 'vitest'
import { mergeFeed } from '../supabase/functions/_shared/cine/merge'
import { detectFormat, detectLang, normalizeTitle, toHHMM, toISODay } from '../supabase/functions/_shared/cine/normalize'
import type { ProviderMovie, ProviderResult } from '../supabase/functions/_shared/cine/types'
import { cleanCine, emptyChains, type CineChain, type CineMovie, type CineShow } from '../src/state/cine'
import { cleanFeed, effectiveCine } from '../src/state/cineFeed'

const movie = (externalId: string, title: string, extra: Partial<ProviderMovie> = {}): ProviderMovie => ({ externalId, title, image: null, genre: '', minutes: null, rating: '', synopsis: '', ...extra })
const res = (movies: ProviderMovie[], shows: ProviderResult['shows']): ProviderResult => ({ movies, shows })

describe('normalización de lo que entrega cada cadena', () => {
  it('reconoce el mismo título aunque cada cadena lo escriba distinto', () => {
    const k = normalizeTitle('Avengers: Doomsday')
    expect(normalizeTitle('AVENGERS: DOOMSDAY (3D) - Doblada')).toBe(k)
    expect(normalizeTitle('Avengers Doomsday SUB')).toBe(k)
    expect(normalizeTitle('  Ávéngers:  Doomsday ')).toBe(k)
    expect(normalizeTitle('Avengers')).not.toBe(k)
    expect(normalizeTitle('Misión Caribe (2026)')).toBe('mision caribe')
  })

  it('detecta formato e idioma en el texto libre', () => {
    expect(detectFormat('3D Doblada')).toBe('3D')
    expect(detectFormat('Sala VIP subtitulada')).toBe('VIP')
    expect(detectFormat('2D')).toBe('2D')
    expect(detectFormat('Sala 4')).toBe('')
    expect(detectLang('Doblada al español')).toBe('DOB')
    expect(detectLang('Subtitulada')).toBe('SUB')
    expect(detectLang('SUB')).toBe('SUB')
    expect(detectLang('3D')).toBe('')
  })

  it('lee horas en 12 y 24 horas', () => {
    expect(toHHMM('14:30')).toBe('14:30')
    expect(toHHMM('2:30 PM')).toBe('14:30')
    expect(toHHMM('2:30 p. m.')).toBe('14:30')
    expect(toHHMM('12:05 AM')).toBe('00:05')
    expect(toHHMM('12:05 PM')).toBe('12:05')
    expect(toHHMM('9.05')).toBe('09:05')
    expect(toHHMM('19h45')).toBe('19:45')
    expect(['25:00', '10:75', 'hola', '13:00 PM', ''].map(toHHMM)).toEqual(['', '', '', '', ''])
  })

  it('lee días en ISO y en día/mes/año, y rechaza los imposibles', () => {
    expect(toISODay('2026-11-13')).toBe('2026-11-13')
    expect(toISODay('2026-11-13T10:00:00-05:00')).toBe('2026-11-13')
    expect(toISODay('13/11/2026')).toBe('2026-11-13')
    expect(toISODay('3/1/2026')).toBe('2026-01-03')
    expect(['31/02/2026', '2026-13-01', 'mañana', ''].map(toISODay)).toEqual(['', '', '', ''])
  })
})

describe('unir las tres cadenas', () => {
  const cc = res(
    [movie('c1', 'Avengers: Doomsday (3D)', { genre: 'Acción', minutes: 150, rating: '12+', synopsis: 'Corta.', image: 'https://x/cc.jpg' }), movie('c2', 'Solo en Colombia')],
    [
      { externalMovieId: 'c1', day: '2026-11-13', time: '2:30 PM', label: '3D Doblada' },
      { externalMovieId: 'c1', day: '2026-11-13', time: '2:30 PM', label: '3D Doblada' },
      { externalMovieId: 'c1', day: '2026-11-13', time: '25:00' },
      { externalMovieId: 'zz', day: '2026-11-13', time: '10:00' },
      { externalMovieId: 'c2', day: '14/11/2026', time: '19:00' },
    ],
  )
  const rf = res([movie('r9', 'AVENGERS DOOMSDAY', { genre: 'Aventura', synopsis: 'Una sinopsis bastante más larga que la otra.', image: 'https://x/rf.jpg' })], [{ externalMovieId: 'r9', day: '2026-11-13', time: '17:00', label: 'Subtitulada' }])
  const pr = res([movie('p5', 'Avengers Doomsday SUB'), movie('p6', 'Sin funciones')], [{ externalMovieId: 'p5', day: '2026-11-13', time: '21:00' }])
  const merged = mergeFeed({ 'cine-colombia': cc, 'royal-films': rf, procinal: pr })

  it('una película, tres cadenas', () => {
    const av = merged.movies.find((m) => m.title.startsWith('Avengers'))!
    expect(merged.movies.filter((m) => m.id === av.id)).toHaveLength(1)
    expect(new Set(merged.shows.filter((s) => s.movieId === av.id).map((s) => s.chain))).toEqual(new Set(['cine-colombia', 'royal-films', 'procinal']))
  })

  it('junta datos: primer cartel, género y minutos; sinopsis más larga', () => {
    const av = merged.movies.find((m) => m.title.startsWith('Avengers'))!
    expect(av).toMatchObject({ image: 'https://x/cc.jpg', genre: 'Acción', minutes: 150, rating: '12+', synopsis: 'Una sinopsis bastante más larga que la otra.' })
  })

  it('limpia las funciones: sin repetidas ni inválidas, con formato e idioma', () => {
    const ccShows = merged.shows.filter((s) => s.chain === 'cine-colombia')
    expect(ccShows).toHaveLength(2)
    expect(ccShows.find((s) => s.day === '2026-11-13')).toMatchObject({ time: '14:30', format: '3D', lang: 'DOB' })
    expect(merged.shows.find((s) => s.chain === 'royal-films')).toMatchObject({ time: '17:00', lang: 'SUB' })
    expect(merged.shows.find((s) => s.day === '2026-11-14')).toBeTruthy()
  })

  it('las películas sin funciones no entran, y el resultado es siempre el mismo', () => {
    expect(merged.movies.some((m) => m.title === 'Sin funciones')).toBe(false)
    expect(mergeFeed({ 'cine-colombia': cc, 'royal-films': rf, procinal: pr })).toEqual(merged)
    expect(mergeFeed({})).toEqual({ movies: [], shows: [] })
  })
})

describe('manual o automático por cadena', () => {
  const chains = (modes: Partial<Record<string, 'auto'>>): CineChain[] => emptyChains().map((c) => ({ ...c, mode: modes[c.id] ?? 'manual' }))
  const own: CineMovie = { id: 'm1', title: 'Avengers Doomsday', image: 'mine.jpg', genre: '', minutes: null, rating: '', synopsis: 'Mía', isNew: true }
  const manual = (chain: CineShow['chain'], time: string): CineShow => ({ id: `m1|${chain}|2026-11-13|${time}||`, movieId: 'm1', chain, day: '2026-11-13', time, format: '', lang: '' })
  const feed = cleanFeed({
    chains: {
      procinal: { at: '2026-11-13T10:00:00Z', ok: true, message: 'ok', movies: [movie('p5', 'Avengers Doomsday SUB', { genre: 'Acción', minutes: 150 }), movie('p7', 'Película nueva')], shows: [{ externalMovieId: 'p5', day: '2026-11-13', time: '21:00', label: '' }, { externalMovieId: 'p7', day: '2026-11-13', time: '18:00' }] },
      'cine-colombia': { at: null, ok: false, message: 'falló', movies: [movie('c1', 'Película nueva')], shows: [{ externalMovieId: 'c1', day: '2026-11-13', time: '20:00' }] },
    },
  })

  it('todo en manual: se ve solo lo manual, aunque haya lecturas', () => {
    const e = effectiveCine({ chains: chains({}), movies: [own], shows: [manual('procinal', '16:00')] }, feed)
    expect(e.shows.map((s) => s.time)).toEqual(['16:00'])
    expect(e.movies).toHaveLength(1)
  })

  it('una cadena en automático usa su lectura y deja de mostrar lo manual de esa cadena', () => {
    const e = effectiveCine({ chains: chains({ procinal: 'auto' }), movies: [own], shows: [manual('procinal', '16:00'), manual('royal-films', '15:00')] }, feed)
    const times = e.shows.map((s) => `${s.chain}:${s.time}`).sort()
    expect(times).toEqual(['procinal:18:00', 'procinal:21:00', 'royal-films:15:00'])
  })

  it('una película leída que ya está en el catálogo usa la del catálogo y se completa con la lectura', () => {
    const e = effectiveCine({ chains: chains({ procinal: 'auto' }), movies: [own], shows: [] }, feed)
    const av = e.movies.find((m) => m.id === 'm1')!
    expect(av).toMatchObject({ image: 'mine.jpg', synopsis: 'Mía', genre: 'Acción', minutes: 150, isNew: true })
    expect(e.shows.find((s) => s.time === '21:00')!.movieId).toBe('m1')
    expect(e.movies.filter((m) => m.title === 'Avengers Doomsday SUB')).toHaveLength(0)
    expect(e.movies.find((m) => m.title === 'Película nueva')).toMatchObject({ isNew: false })
  })

  it('con la lectura fallida se siguen mostrando los últimos datos buenos, y sin lectura no se muestra nada de esa cadena', () => {
    const failed = effectiveCine({ chains: chains({ 'cine-colombia': 'auto' }), movies: [], shows: [] }, feed)
    expect(failed.shows.map((s) => s.chain)).toEqual(['cine-colombia'])
    const none = effectiveCine({ chains: chains({ 'royal-films': 'auto' }), movies: [own], shows: [manual('royal-films', '15:00')] }, feed)
    expect(none.shows).toEqual([])
    expect(effectiveCine({ chains: chains({ procinal: 'auto' }), movies: [own], shows: [manual('procinal', '16:00')] }, null).shows.map((s) => s.time)).toEqual([])
  })

  it('el modo se guarda por cadena y por defecto es manual', () => {
    expect(cleanCine(null, new Date()).chains.every((c) => c.mode === 'manual')).toBe(true)
    const c = cleanCine({ chains: [{ id: 'procinal', mode: 'auto' }, { id: 'royal-films', mode: 'raro' }] }, new Date())
    expect(c.chains.map((x) => x.mode)).toEqual(['manual', 'manual', 'auto'])
  })

  it('lo que llega de la base de datos se limpia', () => {
    expect(cleanFeed(null)).toBeNull()
    expect(cleanFeed({})).toBeNull()
    const f = cleanFeed({ chains: { procinal: { ok: 'sí', movies: [{ title: 5 }], shows: 'x' }, otra: {} } })!
    expect(Object.keys(f.chains)).toEqual(['procinal'])
    expect(f.chains.procinal).toMatchObject({ ok: false, at: null })
    expect(f.chains.procinal!.shows).toEqual([])
  })
})
