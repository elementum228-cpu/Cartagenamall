import { describe, expect, it } from 'vitest'
import { alphaBounds, maskFromScores } from '../src/lib/cutout'

describe('recorte de fondo', () => {
  it('la máscara separa fondo y producto y endurece los bordes', () => {
    const m = maskFromScores([0.02, 0.1, 0.5, 0.9, 0.98])
    expect(m[0]).toBe(0)
    expect(m[4]).toBe(255)
    expect(m[3]).toBeGreaterThan(m[2])
  })
  it('encuentra la caja del producto dentro de la imagen', () => {
    const w = 6
    const h = 5
    const a = new Uint8Array(w * h)
    for (const [x, y] of [[2, 1], [3, 1], [2, 3], [4, 2]]) a[y * w + x] = 255
    expect(alphaBounds(a, w, h)).toEqual({ x: 2, y: 1, w: 3, h: 3 })
  })
  it('sin producto devuelve null', () => {
    expect(alphaBounds(new Uint8Array(12), 4, 3)).toBeNull()
  })
})
