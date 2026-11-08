import { describe, expect, it } from 'vitest'
import { clearBorderWhite, hasTransparentCorners } from '../src/lib/whiteCutout'

/** Imagen de prueba: fondo blanco, un escudo rojo con un círculo blanco adentro. */
function crestImage(w = 40, h = 40) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const dx = x - w / 2
      const dy = y - h / 2
      const r = Math.hypot(dx, dy)
      const inShield = r < 15
      const inCore = r < 6
      const [R, G, B] = inCore ? [255, 255, 255] : inShield ? [200, 30, 40] : [255, 255, 255]
      d.set([R, G, B, 255], i)
    }
  return { d, w, h }
}

describe('quitar el fondo blanco de un escudo', () => {
  it('borra el blanco de afuera y conserva el de adentro', () => {
    const { d, w, h } = crestImage()
    const removed = clearBorderWhite(d, w, h)
    const a = (x: number, y: number) => d[(y * w + x) * 4 + 3]
    expect(removed).toBeGreaterThan(w * h * 0.3)
    expect(a(0, 0)).toBe(0)
    expect(a(w - 1, h - 1)).toBe(0)
    expect(a(w / 2 + 10, h / 2)).toBeGreaterThan(200) // el escudo rojo sigue
    expect(a(w / 2, h / 2)).toBe(255) // el círculo blanco de adentro se conserva
  })
  it('no toca una imagen sin fondo claro', () => {
    const w = 10
    const h = 10
    const d = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) d.set([20, 60, 160, 255], i * 4)
    expect(clearBorderWhite(d, w, h)).toBe(0)
  })
  it('detecta imágenes que ya son transparentes', () => {
    const { d, w, h } = crestImage()
    expect(hasTransparentCorners(d, w, h)).toBe(false)
    clearBorderWhite(d, w, h)
    expect(hasTransparentCorners(d, w, h)).toBe(true)
  })
})
