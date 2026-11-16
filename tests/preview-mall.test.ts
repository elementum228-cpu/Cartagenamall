import { describe, expect, it } from 'vitest'
import { SPACES, ZONES } from '../src/config/mall'
import { SEED_ASSIGNMENTS, SEED_STORES } from '../src/data/seed'
import { PREVIEW_PREFIX, buildPreviewFill, isPreviewStoreId } from '../src/data/previewMall'

describe('modo mall lleno (prueba)', () => {
  const real = buildPreviewFill(SPACES, ZONES, SEED_STORES, SEED_ASSIGNMENTS)
  it('llena todos los espacios libres y no toca los que ya tienen tienda', () => {
    const taken = new Set(Object.keys(SEED_ASSIGNMENTS).filter((sp) => SEED_STORES.some((s) => s.id === SEED_ASSIGNMENTS[sp])))
    for (const sp of SPACES) {
      if (sp.label === 'D-05') expect(real.assignments[sp.id]).toBeUndefined() // tienda ancla propia
      else if (taken.has(sp.id)) expect(real.assignments[sp.id]).toBeUndefined()
      else expect(real.assignments[sp.id], sp.id).toBeTruthy()
    }
  })
  it('cubre todas las zonas, con ids únicos y productos para cada local', () => {
    expect(new Set(real.stores.map((s) => s.id)).size).toBe(real.stores.length)
    expect(new Set(real.products.map((p) => p.id)).size).toBe(real.products.length)
    const zones = new Set(real.stores.map((s) => s.zoneId))
    for (const z of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) expect(zones.has(z as never), z).toBe(true)
    for (const st of real.stores) {
      expect(isPreviewStoreId(st.id)).toBe(true)
      expect(real.products.filter((p) => p.storeId === st.id).length).toBeGreaterThanOrEqual(2)
      expect(st.name.length).toBeGreaterThan(2)
    }
  })
  it('las categorías son de la zona de cada local y los restaurantes están en gastronomía', () => {
    for (const st of real.stores) {
      const zone = ZONES.find((z) => z.id === st.zoneId)!
      expect(zone.categories.some((c) => c.id === st.categoryId) || st.categoryId === 'servicios').toBe(true)
      if (st.zoneId === 'E') expect(st.businessType).toBe('restaurant')
    }
  })
  it('es determinista y no repite nombres dentro de una zona', () => {
    const again = buildPreviewFill(SPACES, ZONES, SEED_STORES, SEED_ASSIGNMENTS)
    expect(again.stores.map((s) => s.name)).toEqual(real.stores.map((s) => s.name))
    for (const z of ['A', 'B', 'E']) {
      const names = real.stores.filter((s) => s.zoneId === z).map((s) => s.name)
      expect(new Set(names).size).toBe(names.length)
    }
    expect(PREVIEW_PREFIX).toBe('PREVIEW-')
  })
})
