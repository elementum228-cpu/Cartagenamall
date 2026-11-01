import { describe, expect, it } from 'vitest'
import { SPACES, SPACE_TYPES } from '../src/config/mall'
import { SEED_ASSIGNMENTS, SEED_PRODUCTS, SEED_STORES, createSeedPromotions } from '../src/data/seed'
import { mergeSeed } from '../src/state/catalog'
import type { CartItem } from '../src/domain/types'
import { cartKey } from '../src/state/cart'
import { stockKey } from '../src/lib/inventory'
import { discounted, priceFor } from '../src/lib/pricing'
import { EMPTY_FILTERS, searchProducts } from '../src/lib/search'
import { CATEGORY_BY_ID } from '../src/config/mall'
import { buildOrder, overallStatus, validateCart, type CatalogSnapshot } from '../src/services/orders'

const NOW = Date.parse('2026-10-29T12:00:00Z')
const promos = createSeedPromotions(NOW)
const catalog: CatalogSnapshot = {
  products: Object.fromEntries(SEED_PRODUCTS.map((p) => [p.id, p])),
  stores: Object.fromEntries(SEED_STORES.map((s) => [s.id, s])),
  promotions: promos,
}
const item = (productId: string, variantId: string | null, size: string | null, qty = 1): CartItem => ({
  key: cartKey(productId, variantId, size),
  productId,
  storeId: catalog.products[productId].storeId,
  variantId,
  size,
  qty,
})

describe('mall layout', () => {
  it('genera los espacios desde configuración: 20 en los pasillos y 4 en servicios (piso 1), 10 en el piso 2', () => {
    expect(SPACES.filter((s) => s.floorId === 'P1' && s.zoneId !== 'I')).toHaveLength(24)
    expect(SPACES.filter((s) => s.zoneId === 'I')).toHaveLength(14)
    expect(SPACES.filter((s) => s.zoneId === 'F')).toHaveLength(4)
    expect(SPACES.filter((s) => s.floorId === 'P2')).toHaveLength(10)
    for (const z of ['A', 'B', 'C', 'D']) expect(SPACES.filter((s) => s.zoneId === z)).toHaveLength(5)
    expect(new Set(SPACES.map((s) => s.id)).size).toBe(SPACES.length)
  })
  it('ningún espacio se solapa con otro del mismo piso', () => {
    for (const a of SPACES)
      for (const b of SPACES) {
        if (a === b || a.floorId !== b.floorId) continue
        const d = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1])
        expect(d).toBeGreaterThan((Math.min(...a.size) + Math.min(...b.size)) / 2 - 0.01)
      }
  })
  it('piso 1 conserva 5 tiendas y 19 espacios libres (4 de servicios); piso 2 tiene 6 negocios y 4 libres', () => {
    const p1 = SPACES.filter((s) => s.floorId === 'P1' && s.zoneId !== 'I')
    const p2 = SPACES.filter((s) => s.floorId === 'P2')
    expect(p1.filter((s) => SEED_ASSIGNMENTS[s.id])).toHaveLength(5)
    expect(p1.filter((s) => !SEED_ASSIGNMENTS[s.id])).toHaveLength(19)
    expect(p2.filter((s) => SEED_ASSIGNMENTS[s.id])).toHaveLength(6)
    expect(p2.filter((s) => !SEED_ASSIGNMENTS[s.id])).toHaveLength(4)
    expect(SPACE_TYPES.premium.monthlyPriceCOP).toBe(180_000)
    // Isla Descuento: 14 espacios, todos disponibles
    expect(SPACES.filter((s) => s.zoneId === 'I' && !SEED_ASSIGNMENTS[s.id])).toHaveLength(14)
  })
  it('cada negocio del piso 2 tiene menú', () => {
    for (const st of SEED_STORES.filter((s) => s.zoneId === 'E')) expect(SEED_PRODUCTS.filter((p) => p.storeId === st.id).length).toBeGreaterThanOrEqual(3)
  })
})

describe('migración de datos guardados (v1 → v2)', () => {
  it('agrega el piso 2 sin tocar ediciones, tiendas nuevas ni asignaciones previas', () => {
    const v1Stores = SEED_STORES.filter((s) => s.zoneId !== 'E').map((s) => (s.id === 'STORE-001' ? { ...s, name: 'Brisa (editada)' } : s))
    const approved = { ...v1Stores[0], id: 'STORE-006', name: 'Tienda aprobada por admin', zoneId: 'B' as const }
    // Un dato viejo que ya usaba el espacio P2-E1 (p. ej. asignado a mano) se respeta.
    const old = {
      stores: [...v1Stores, approved],
      products: SEED_PRODUCTS.filter((p) => !p.storeId.startsWith('STORE-1')).map((p) => (p.id === 'P-101' ? { ...p, price: 1 } : p)),
      promotions: createSeedPromotions(NOW).filter((p) => !['PROMO-N4', 'PROMO-F3', 'PROMO-S4'].includes(p.id)),
      assignments: { 'P1-A5': 'STORE-001', 'P1-B3': 'STORE-006', 'P2-E1': 'STORE-005' },
    }
    const m = mergeSeed(old, NOW)
    expect(m.stores.find((s) => s.id === 'STORE-001')?.name).toBe('Brisa (editada)')
    expect(m.stores.find((s) => s.id === 'STORE-006')?.name).toBe('Tienda aprobada por admin')
    expect(m.products.find((p) => p.id === 'P-101')?.price).toBe(1)
    expect(m.assignments['P1-B3']).toBe('STORE-006')
    // El espacio ya ocupado se respeta; los demás negocios del piso 2 sí aparecen.
    expect(m.assignments['P2-E1']).toBe('STORE-005')
    expect(m.assignments['P2-E2']).toBe('STORE-102')
    expect(m.stores.some((s) => s.id === 'STORE-101')).toBe(true)
    expect(m.stores.some((s) => s.id === 'STORE-106')).toBe(true)
    expect(m.promotions.some((p) => p.id === 'PROMO-S4')).toBe(true)
  })
})

describe('precios y promociones', () => {
  it('aplica la promoción normal y redondea a la centena', () => {
    const p = catalog.products['P-102']
    expect(priceFor(p, promos, NOW, []).final).toBe(discounted(129_000, 15))
    expect(discounted(129_000, 15) % 100).toBe(0)
  })
  it('la oferta escondida solo aplica si fue guardada', () => {
    const p = catalog.products['P-201']
    expect(priceFor(p, promos, NOW, []).final).toBe(120_000)
    expect(priceFor(p, promos, NOW, ['PROMO-S1']).final).toBe(96_000)
  })
  it('la oferta relámpago vence', () => {
    const p = catalog.products['P-202']
    expect(priceFor(p, promos, NOW, []).promotion?.id).toBe('PROMO-F2')
    expect(priceFor(p, promos, NOW + 4 * 3_600_000, []).promotion).toBeNull()
  })
})

describe('búsqueda', () => {
  const ctx = {
    stores: catalog.stores,
    categoryName: (id: string) => CATEGORY_BY_ID[id]?.name ?? '',
    categoryZone: (id: string) => CATEGORY_BY_ID[id]?.zoneId,
    finalPrice: (p: (typeof SEED_PRODUCTS)[number]) => p.price,
    hasPromo: () => false,
  }
  it('encuentra camisetas de dos tiendas distintas, sin acentos', () => {
    const r = searchProducts(SEED_PRODUCTS, ctx, { ...EMPTY_FILTERS, query: 'camiseta' }, 'relevance')
    expect(new Set(r.map((p) => p.storeId)).size).toBe(2)
  })
  it('filtra por precio y ordena ascendente', () => {
    const r = searchProducts(SEED_PRODUCTS, ctx, { ...EMPTY_FILTERS, maxPrice: 60_000 }, 'price_asc')
    expect(r.every((p) => p.price <= 60_000)).toBe(true)
    expect(r.map((p) => p.price)).toEqual([...r.map((p) => p.price)].sort((a, b) => a - b))
  })
})

describe('carrito y pedido dividido', () => {
  const items = [item('P-101', 'blanco', 'M'), item('P-104', 'crudo', 'M'), item('P-201', 'cafe', '40'), item('P-301', 'negro', null)]

  it('divide la orden en una suborden por tienda con solo sus productos', () => {
    const r = buildOrder({
      orderNumber: 1,
      items,
      catalog,
      customer: { name: 'Ana', whatsapp: '3001234567' },
      delivery: { mode: 'pickup', address: null },
      notes: '',
      now: NOW,
      unlockedSecretIds: [],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.order.id).toBe('ORDER-001')
    expect(r.order.subOrders.map((s) => s.storeId)).toEqual(['STORE-001', 'STORE-002', 'STORE-003'])
    expect(r.order.subOrders[0].lines.map((l) => l.productId)).toEqual(['P-101', 'P-104'])
    expect(r.order.subOrders[0].subtotal).toBe(60_000 + 95_000)
    expect(r.order.estimatedTotal).toBe(r.order.subOrders.reduce((a, s) => a + s.subtotal, 0))
    expect(r.order.payment).toBe('not_charged')
    expect(r.order.subOrders.every((s) => s.status === 'pending_confirmation')).toBe(true)
    expect(overallStatus(r.order)).toBe('pending_confirmation')
  })

  it('bloquea cantidades por encima del inventario mock y variantes agotadas', () => {
    const p = catalog.products['P-101']
    const max = p.inventory[stockKey('blanco', 'M')]
    expect(validateCart([item('P-101', 'blanco', 'M', max + 1)], catalog)[0].available).toBe(max)
    expect(validateCart([item('P-101', 'azul', 'XL')], catalog)[0].available).toBe(0)
  })
})
