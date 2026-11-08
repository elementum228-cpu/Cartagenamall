import { describe, expect, it } from 'vitest'
import { cleanAddress, directionsUrl, hasAddress, parseMapsUrl, searchUrl } from '../src/lib/maps'

describe('dirección y Google Maps', () => {
  it('acepta los enlaces de Google Maps de siempre', () => {
    for (const u of [
      'https://www.google.com/maps/place/Chucho+Barril/@10.42,-75.55,17z',
      'https://maps.app.goo.gl/AbCdEf123',
      'https://goo.gl/maps/xyz',
      'https://maps.google.com/?q=10.4,-75.5',
      'https://www.google.com.co/maps?q=hola',
      'https://g.page/chucho-barril',
      'google.com/maps/place/Algo',
      '  https://maps.app.goo.gl/xx  ',
    ])
      expect(parseMapsUrl(u), u).toMatch(/^https:\/\//)
  })
  it('rechaza lo que no es Google Maps (y los esquemas peligrosos)', () => {
    for (const u of ['', '   ', 'hola', 'https://example.com/maps', 'https://google.com/search?q=maps', 'javascript:alert(1)', 'https://maps.google.com.evil.com/x', 'https://evil.com/?u=https://maps.google.com', 'ftp://maps.google.com/x', 'https://goo.gl/otra-cosa', 'dos palabras https://maps.app.goo.gl/x'])
      expect(parseMapsUrl(u), u).toBeNull()
  })
  it('un enlace http se guarda como https', () => {
    expect(parseMapsUrl('http://maps.google.com/?q=a')).toMatch(/^https:/)
  })
  it('sin enlace, la búsqueda usa la dirección y agrega la ciudad', () => {
    const u = searchUrl('Calle 5 # 3-20, Getsemaní')
    expect(u).toContain('google.com/maps/search/?api=1&query=')
    expect(decodeURIComponent(u.split('query=')[1])).toBe('Calle 5 # 3-20, Getsemaní, Cartagena, Colombia')
    expect(decodeURIComponent(searchUrl('Calle 5, Cartagena').split('query=')[1])).toBe('Calle 5, Cartagena')
  })
  it('«Cómo llegar»: el enlace del dueño manda; si no, la búsqueda; si no hay nada, nada', () => {
    expect(directionsUrl({ text: 'Calle 5', mapsUrl: 'https://maps.app.goo.gl/x' })).toBe('https://maps.app.goo.gl/x')
    expect(directionsUrl({ text: 'Calle 5', mapsUrl: 'https://example.com' })).toContain('/maps/search/')
    expect(directionsUrl({ text: '', mapsUrl: '' })).toBeNull()
    expect(directionsUrl(undefined)).toBeNull()
    expect(directionsUrl({ text: '', mapsUrl: 'https://maps.app.goo.gl/x' })).toBe('https://maps.app.goo.gl/x')
  })
  it('limpia la dirección que llega del formulario o de la base de datos', () => {
    expect(cleanAddress(undefined)).toBeUndefined()
    expect(cleanAddress({ text: '  ', mapsUrl: 'nada' })).toBeUndefined()
    expect(cleanAddress({ text: ' Calle 5 ', mapsUrl: 'maps.app.goo.gl/x' })).toEqual({ text: 'Calle 5', mapsUrl: 'https://maps.app.goo.gl/x' })
    expect(cleanAddress({ text: 'Calle 5', mapsUrl: 'https://evil.com' })).toEqual({ text: 'Calle 5' })
    expect(cleanAddress({ text: 'x'.repeat(500) })?.text.length).toBe(140)
    expect(hasAddress({ text: '', mapsUrl: 'https://maps.app.goo.gl/x' })).toBe(true)
    expect(hasAddress({ text: ' ' })).toBe(false)
  })
})
