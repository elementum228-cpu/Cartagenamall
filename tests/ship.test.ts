import { describe, expect, it } from 'vitest'
import { SEED_PRODUCTS, SEED_STORES } from '../src/data/seed'
import { SHIP_MAX_OFFERS, SHIP_MIN_OFFERS, nextScheduledArrival, scheduledWindow, shipLineup } from '../src/ship/offers'

describe('barco de los descuentos', () => {
  it('llega viernes y sábados a las 7 p. m. y se queda 30 minutos', () => {
    const wed = new Date(2026, 10, 4, 10).getTime() // miércoles
    const next = new Date(nextScheduledArrival(wed))
    expect(next.getDay()).toBe(5)
    expect(next.getHours()).toBe(19)
    const fri = new Date(2026, 10, 6, 19, 10).getTime()
    expect(scheduledWindow(fri)).not.toBeNull()
    expect(scheduledWindow(new Date(2026, 10, 6, 19, 31).getTime())).toBeNull()
    expect(new Date(nextScheduledArrival(fri)).getDay()).toBe(6)
  })

  it('una oferta por local; si faltan, se completa con ejemplos marcados', () => {
    const store = SEED_STORES.find((s) => s.status === 'open')!
    const product = SEED_PRODUCTS.find((p) => p.storeId === store.id && p.active)!
    const real = { storeId: store.id, productId: product.id, discountPercent: 50, units: null }
    const lineup = shipLineup([real, { ...real, discountPercent: 20 }], SEED_STORES, SEED_PRODUCTS)
    expect(lineup.length).toBeGreaterThanOrEqual(SHIP_MIN_OFFERS)
    expect(lineup.length).toBeLessThanOrEqual(SHIP_MAX_OFFERS)
    expect(new Set(lineup.map((o) => o.storeId)).size).toBe(lineup.length)
    expect(lineup[0]).toMatchObject({ storeId: store.id, discountPercent: 50 })
    expect(lineup.slice(1).every((o) => o.demo)).toBe(true)
  })

  it('ignora ofertas de artículos que no son de ese local', () => {
    const [a, b] = SEED_STORES.filter((s) => s.status === 'open')
    const foreign = SEED_PRODUCTS.find((p) => p.storeId === b.id)!
    const lineup = shipLineup([{ storeId: a.id, productId: foreign.id, discountPercent: 60, units: null }], SEED_STORES, SEED_PRODUCTS)
    expect(lineup.some((o) => !o.demo)).toBe(false)
  })
})
