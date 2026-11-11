import { describe, expect, it } from 'vitest'
import { marginOf, priceForMargin } from '../src/lib/margin'

describe('ganancia de un artículo', () => {
  it('pérdida si se vende por debajo del costo', () => {
    expect(marginOf(30000, 25000)?.level).toBe('loss')
  })
  it('semáforo: bajo, aceptable y bueno', () => {
    expect(marginOf(40000, 45000)?.level).toBe('low') // 11 %
    expect(marginOf(35000, 45000)?.level).toBe('ok') // 22 %
    expect(marginOf(20000, 45000)?.level).toBe('good') // 56 %
  })
  it('calcula ganancia, porcentaje y veces', () => {
    const m = marginOf(20000, 40000)!
    expect(m.profit).toBe(20000)
    expect(m.pct).toBe(50)
    expect(m.times).toBe(2)
  })
  it('sin datos no hay cálculo', () => {
    expect(marginOf(10, 0)).toBeNull()
  })
  it('sugiere un precio que deja el margen pedido', () => {
    const p = priceForMargin(20000, 35)
    expect(marginOf(20000, p)!.pct).toBeGreaterThanOrEqual(35)
  })
})
