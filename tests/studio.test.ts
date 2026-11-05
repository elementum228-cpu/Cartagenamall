import { describe, expect, it } from 'vitest'
import { clampSlot, DEFAULT_SLOT, placeProduct } from '../src/lib/studio'

describe('estudio de fotos', () => {
  it('apoya el producto centrado sobre la línea del fondo', () => {
    const p = placeProduct(DEFAULT_SLOT, 1000, 400, 800)
    expect(p.cx).toBe(500)
    expect(p.y + p.h).toBeCloseTo(840)
    expect(p.x + p.w / 2).toBeCloseTo(500)
  })
  it('no se sale del espacio máximo: ancho o alto, el que limite primero', () => {
    const ancho = placeProduct(DEFAULT_SLOT, 1000, 2000, 500)
    expect(ancho.w).toBeCloseTo(460)
    const alto = placeProduct(DEFAULT_SLOT, 1000, 300, 1200)
    expect(alto.h).toBeCloseTo(600)
  })
  it('limita valores absurdos del apoyo', () => {
    const s = clampSlot({ x: -1, y: 5, w: 9, h: 0 })
    expect(s.x).toBeGreaterThanOrEqual(0.05)
    expect(s.y).toBeLessThanOrEqual(0.98)
    expect(s.w).toBeLessThanOrEqual(0.95)
    expect(s.h).toBeGreaterThanOrEqual(0.1)
  })
})
