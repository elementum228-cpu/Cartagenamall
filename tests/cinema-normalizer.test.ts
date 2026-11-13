import { describe, expect, it } from 'vitest'
import { hostAllowed, normalizeCinemas, normalizeFormat, normalizeLanguage, safeUrl } from '../supabase/functions/_shared/cinema/normalizer'

const OFFICIAL = 'https://www.cinecolombia.com/cartagena'
const opts = { allowedHosts: ['cinecolombia.com'], officialUrl: OFFICIAL }

describe('formato e idioma', () => {
  it('reconoce los formatos del texto libre', () => {
    expect(normalizeFormat('3D')).toBe('3D')
    expect(normalizeFormat('Sala VIP')).toBe('VIP')
    expect(normalizeFormat('IMAX 3D')).toBe('IMAX')
    expect(normalizeFormat('4 DX')).toBe('4DX')
    expect(normalizeFormat('2d')).toBe('2D')
    expect(normalizeFormat('Sala 4')).toBeNull()
    expect(normalizeFormat(undefined)).toBeNull()
    expect(normalizeFormat(7)).toBeNull()
  })

  it('reconoce el idioma', () => {
    expect(normalizeLanguage('Doblada')).toBe('Doblada')
    expect(normalizeLanguage('DOB')).toBe('Doblada')
    expect(normalizeLanguage('Subtitulada')).toBe('Subtitulada')
    expect(normalizeLanguage('Inglés SUB')).toBe('Subtitulada')
    expect(normalizeLanguage('Español')).toBe('Español')
    expect(normalizeLanguage('Inglés')).toBe('Inglés')
    expect(normalizeLanguage('3D')).toBeNull()
    expect(normalizeLanguage(null)).toBeNull()
  })
})

describe('enlaces', () => {
  it('solo acepta https de los dominios oficiales (y sus subdominios), sin credenciales', () => {
    expect(hostAllowed('tickets.cinecolombia.com', ['cinecolombia.com'])).toBe(true)
    expect(hostAllowed('cinecolombia.com.evil.co', ['cinecolombia.com'])).toBe(false)
    expect(hostAllowed('evilcinecolombia.com', ['cinecolombia.com'])).toBe(false)
    expect(safeUrl('https://www.cinecolombia.com/comprar/123', ['cinecolombia.com'])).toBe('https://www.cinecolombia.com/comprar/123')
    expect(safeUrl('http://www.cinecolombia.com/comprar', ['cinecolombia.com'])).toBeNull()
    expect(safeUrl('https://otro-sitio.com/comprar', ['cinecolombia.com'])).toBeNull()
    expect(safeUrl('https://user:pass@www.cinecolombia.com/', ['cinecolombia.com'])).toBeNull()
    expect(safeUrl('javascript:alert(1)', ['cinecolombia.com'])).toBeNull()
    expect(safeUrl('no es una url', ['cinecolombia.com'])).toBeNull()
    expect(safeUrl(undefined, ['cinecolombia.com'])).toBeNull()
  })
})

describe('normalizar lo que entrega una fuente', () => {
  const raw = {
    cinemas: [
      {
        id: 'caribe-plaza',
        name: '  Caribe   Plaza ',
        address: 'Cra. 5',
        movies: [
          {
            title: 'Misión Caribe',
            posterUrl: 'https://img.example/p.jpg',
            durationMinutes: '118 min',
            rating: '12+',
            showtimes: [
              { time: '7:30 PM', format: '3D Doblada', bookingUrl: 'https://www.cinecolombia.com/comprar/1' },
              { time: '14:30', format: '2D', language: 'SUB', bookingUrl: 'https://otro-sitio.com/x' },
              { time: '14:30', format: '2D', language: 'Subtitulada' },
              { time: '25:00' },
              { time: 'pronto' },
              null,
            ],
          },
          { title: '', showtimes: [{ time: '10:00' }] },
          { title: 'Sin funciones', showtimes: [] },
        ],
      },
      { name: '', movies: [] },
    ],
  }
  const { cinemas, dropped } = normalizeCinemas(raw, opts)

  it('limpia sedes y películas, y descarta lo que no sirve contando lo descartado', () => {
    expect(cinemas).toHaveLength(1)
    expect(cinemas[0]).toMatchObject({ id: 'caribe-plaza', name: 'Caribe Plaza', address: 'Cra. 5' })
    expect(cinemas[0].movies.map((m) => m.title)).toEqual(['Misión Caribe'])
    // hora imposible, hora no válida, null, película sin título, sede sin nombre
    expect(dropped).toBe(5)
  })

  it('normaliza horas, formato e idioma, sin repetidas y ordenadas', () => {
    const m = cinemas[0].movies[0]
    expect(m.durationMinutes).toBe(118)
    expect(m.showtimes.map((s) => s.time)).toEqual(['14:30', '19:30'])
    expect(m.showtimes[0]).toMatchObject({ format: '2D', language: 'Subtitulada' })
    expect(m.showtimes[1]).toMatchObject({ format: '3D', language: 'Doblada' })
  })

  it('el enlace de compra siempre es oficial: el válido se respeta y el ajeno o ausente se cambia por la cartelera oficial', () => {
    const m = cinemas[0].movies[0]
    expect(m.showtimes[1].bookingUrl).toBe('https://www.cinecolombia.com/comprar/1')
    expect(m.showtimes[0].bookingUrl).toBe(OFFICIAL)
    for (const s of m.showtimes) expect(new URL(s.bookingUrl).hostname.endsWith('cinecolombia.com')).toBe(true)
  })

  it('el cartel solo vale si es https', () => {
    expect(cinemas[0].movies[0].posterUrl).toBe('https://img.example/p.jpg')
    const r = normalizeCinemas({ cinemas: [{ name: 'S', movies: [{ title: 'A', posterUrl: 'http://x/p.jpg', showtimes: [{ time: '10:00' }] }] }] }, opts)
    expect(r.cinemas[0].movies[0].posterUrl).toBeNull()
  })

  it('una respuesta rara da menos datos, nunca un error', () => {
    for (const junk of [null, undefined, 'texto', 42, [], {}, { cinemas: 'x' }, { cinemas: [null, 7, 'x'] }, { cinemas: [{ name: 'S', movies: 'x' }] }]) {
      expect(() => normalizeCinemas(junk, opts)).not.toThrow()
      expect(normalizeCinemas(junk, opts).cinemas).toEqual([])
    }
  })

  it('pone tope al tamaño de la respuesta', () => {
    const many = { cinemas: Array.from({ length: 50 }, (_, i) => ({ name: `Sede ${i}`, movies: [{ title: 'A', showtimes: [{ time: '10:00' }] }] })) }
    expect(normalizeCinemas(many, opts).cinemas.length).toBeLessThanOrEqual(20)
  })
})
