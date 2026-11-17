import { describe, expect, it } from 'vitest'
import { BUSINESS_STORES, GEORGES_PRODUCTS, GEORGES_STORE_ID } from '../src/data/businesses'
import { SPACES } from '../src/config/mall'
import { isRestaurant, catalogWords } from '../src/lib/restaurant'
import { mergeSeed } from '../src/state/catalog'
import { SEED_ASSIGNMENTS, SEED_STORES } from '../src/data/seed'

describe("George's como negocio real", () => {
  const store = BUSINESS_STORES.find((s) => s.id === GEORGES_STORE_ID)!
  it('es un restaurante de la zona de comida con su menú por secciones', () => {
    expect(store.zoneId).toBe('E')
    expect(isRestaurant(store)).toBe(true)
    expect(catalogWords(store).tab).toBe('Menú')
    expect(GEORGES_PRODUCTS.length).toBeGreaterThanOrEqual(12)
    const cats = new Set(store.categories!.map((c) => c.id))
    for (const p of GEORGES_PRODUCTS) {
      expect(p.storeId).toBe(GEORGES_STORE_ID)
      expect(p.active && p.price > 0 && cats.has(p.shopCategory!)).toBe(true)
    }
    expect(new Set(GEORGES_PRODUCTS.map((p) => p.id)).size).toBe(GEORGES_PRODUCTS.length)
  })
  it('el SQL de carga apunta a un espacio que existe en el Piso 2', () => {
    expect(SPACES.some((s) => s.id === 'P2-E2' && s.floorId === 'P2' && s.zoneId === 'E')).toBe(true)
  })
  it('un catálogo guardado antes recibe a George\'s sin perder nada', () => {
    const old = { stores: SEED_STORES, products: [], promotions: [], assignments: { ...SEED_ASSIGNMENTS } }
    const merged = mergeSeed(old)
    expect(merged.stores.some((s) => s.id === GEORGES_STORE_ID)).toBe(true)
    expect(merged.assignments['P2-E3']).toBe(GEORGES_STORE_ID)
    expect(merged.assignments['P2-E1']).toBe(SEED_ASSIGNMENTS['P2-E1'])
  })
})
