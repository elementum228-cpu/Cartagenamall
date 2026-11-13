import { describe, expect, it } from 'vitest'
import { CinemaApiError, cinemaDays, cleanShowtimesResponse, endpointUrl, fetchShowtimes } from '../src/cinema/api'
import { applyFilters, facets, groupByMovie, listRows, updatedAgo } from '../src/cinema/filters'

const resp = {
  city: 'Cartagena',
  date: '2026-11-13',
  updatedAt: '2026-11-13T15:00:00.000Z',
  providers: [
    {
      id: 'cinecolombia',
      name: 'Cine Colombia',
      status: 'available',
      officialUrl: 'https://www.cinecolombia.com/cartagena',
      lastUpdatedAt: '2026-11-13T15:00:00.000Z',
      cinemas: [
        { id: 'a', name: 'Caribe Plaza', address: null, movies: [{ title: 'Película', posterUrl: null, durationMinutes: 100, rating: '12+', showtimes: [{ time: '21:00', format: '2D', language: 'Doblada', bookingUrl: 'https://www.cinecolombia.com/x' }, { time: '19:00', format: '3D', language: 'Subtitulada', bookingUrl: 'http://malo.example/x' }] }] },
        { id: 'b', name: 'Bocagrande', address: 'Calle 1', movies: [{ title: 'Película', posterUrl: 'https://img.example/p.jpg', durationMinutes: null, rating: null, showtimes: [{ time: '18:00', format: '2D', language: null, bookingUrl: 'https://www.cinecolombia.com/y' }] }] },
      ],
    },
    { id: 'procinal', name: 'Procinal', status: 'unavailable', officialUrl: 'https://www.procinal.com.co/ciudad/cartagena', lastUpdatedAt: null, message: 'Horarios no disponibles temporalmente', cinemas: [] },
    { id: 'raro', name: 'X', status: 'available', officialUrl: 'https://x.example', cinemas: [] },
    { id: 'royalfilms', name: 'Royal', status: 'available', officialUrl: 'http://sin-https.example', cinemas: [] },
  ],
}

describe('cliente de la API de cine', () => {
  const clean = cleanShowtimesResponse(resp)!

  it('valida la respuesta: descarta cadenas desconocidas o sin enlace oficial https', () => {
    expect(clean.providers.map((p) => p.id)).toEqual(['cinecolombia', 'procinal'])
    expect(cleanShowtimesResponse(null)).toBeNull()
    expect(cleanShowtimesResponse({ providers: 'x' })).toBeNull()
  })

  it('los enlaces de compra siempre son https: uno inseguro se cambia por la cartelera oficial', () => {
    const urls = listRows(clean).map((r) => r.showtime.bookingUrl)
    expect(urls.every((u) => u.startsWith('https://'))).toBe(true)
    expect(urls).toContain('https://www.cinecolombia.com/cartagena')
  })

  it('una cadena no disponible no trae sedes y conserva su mensaje y su enlace oficial', () => {
    const p = clean.providers[1]
    expect(p).toMatchObject({ status: 'unavailable', message: 'Horarios no disponibles temporalmente', cinemas: [], officialUrl: 'https://www.procinal.com.co/ciudad/cartagena' })
  })

  it('arma la URL del endpoint y los días consultables (hoy + 7, hora de Colombia)', () => {
    expect(endpointUrl('2026-11-13', 'https://abc.supabase.co/')).toBe('https://abc.supabase.co/functions/v1/cinema-showtimes?city=cartagena&date=2026-11-13')
    const days = cinemaDays(new Date('2026-11-14T03:00:00Z'))
    expect(days).toHaveLength(8)
    expect(days[0]).toBe('2026-11-13')
    expect(days[7]).toBe('2026-11-20')
  })

  it('filtra por cadena, formato e idioma, y solo ofrece opciones que existen', () => {
    const rows = listRows(clean)
    expect(rows).toHaveLength(3)
    expect(applyFilters(rows, { format: '3D' })).toHaveLength(1)
    expect(applyFilters(rows, { language: 'Doblada' })).toHaveLength(1)
    expect(applyFilters(rows, { provider: 'procinal' })).toHaveLength(0)
    expect(applyFilters(rows, {})).toHaveLength(3)
    expect(facets(rows)).toEqual({ formats: ['2D', '3D'], languages: ['Doblada', 'Subtitulada'] })
  })

  it('agrupa por película y sede, con las horas ordenadas', () => {
    const g = groupByMovie(listRows(clean))
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ title: 'Película', posterUrl: 'https://img.example/p.jpg', durationMinutes: 100, rating: '12+' })
    expect(g[0].venues.map((v) => v.cinema.name)).toEqual(['Bocagrande', 'Caribe Plaza'])
    expect(g[0].venues[1].showtimes.map((s) => s.time)).toEqual(['19:00', '21:00'])
  })

  it('«Actualizado hace X min»', () => {
    const now = new Date('2026-11-13T15:30:00Z')
    expect(updatedAgo('2026-11-13T15:00:00Z', now)).toBe('Actualizado hace 30 min')
    expect(updatedAgo('2026-11-13T15:29:40Z', now)).toBe('Actualizado hace un momento')
    expect(updatedAgo('2026-11-13T12:30:00Z', now)).toBe('Actualizado hace 3 h')
    expect(updatedAgo(null, now)).toBeNull()
  })
})

describe('consulta al endpoint', () => {
  const base = { baseUrl: 'https://abc.supabase.co', anonKey: 'anon' }
  const json = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it('devuelve la respuesta validada y manda la llave pública (nunca una secreta)', async () => {
    let headers: Headers | null = null
    const f = (async (_u: string, init: RequestInit) => {
      headers = new Headers(init.headers)
      return new Response(JSON.stringify(resp), { status: 200 })
    }) as unknown as typeof fetch
    const out = await fetchShowtimes('2026-11-13', { ...base, fetchImpl: f })
    expect(out.providers).toHaveLength(2)
    expect(headers!.get('apikey')).toBe('anon')
  })

  it('traduce los fallos a mensajes para el usuario, sin detalles técnicos', async () => {
    await expect(fetchShowtimes('2026-11-13', { ...base, fetchImpl: json({ error: { code: 'x', message: 'La fecha debe tener el formato AAAA-MM-DD.' } }, 400) })).rejects.toThrow('La fecha debe tener el formato')
    await expect(fetchShowtimes('2026-11-13', { ...base, fetchImpl: json({ error: { message: 'stack interno' } }, 503) })).rejects.toThrow(/por ahora/)
    await expect(fetchShowtimes('2026-11-13', { ...base, fetchImpl: json({ nada: true }) })).rejects.toBeInstanceOf(CinemaApiError)
    const down = (async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
    await expect(fetchShowtimes('2026-11-13', { ...base, fetchImpl: down })).rejects.toThrow(/conexión/)
    await expect(fetchShowtimes('2026-11-13', { fetchImpl: json(resp), baseUrl: '', anonKey: '' })).rejects.toBeInstanceOf(CinemaApiError)
  })
})
