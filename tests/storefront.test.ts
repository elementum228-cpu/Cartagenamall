import { beforeEach, describe, expect, it } from 'vitest'
import { SEED_PRODUCTS, SEED_STORES } from '../src/data/seed'
import type { Order, Store } from '../src/domain/types'
import { instagramHandle, instagramUrl } from '../src/lib/instagram'
import { groupOf, groupProducts, groupsWithProducts, newCategoryId, suggestedCategories } from '../src/lib/storeCategories'
import { useCatalog } from '../src/state/catalog'
import { useOrders } from '../src/state/orders'

describe('instagram', () => {
  it('acepta @usuario, usuario y el enlace del perfil', () => {
    expect(instagramHandle('@brisatextil.demo')).toBe('brisatextil.demo')
    expect(instagramHandle('  minegocio ')).toBe('minegocio')
    expect(instagramHandle('https://www.instagram.com/coral_belleza/?hl=es')).toBe('coral_belleza')
    expect(instagramUrl('@coral')).toBe('https://www.instagram.com/coral/')
  })
  it('ignora vacíos y el valor pendiente', () => {
    expect(instagramHandle('')).toBeNull()
    expect(instagramHandle('@por.definir')).toBeNull()
    expect(instagramHandle('hola mundo')).toBeNull()
    expect(instagramUrl(undefined)).toBeNull()
  })
})

describe('categorías propias de la tienda', () => {
  const beauty = SEED_STORES.find((s) => s.id === 'STORE-004')!
  const mine = SEED_PRODUCTS.filter((p) => p.storeId === beauty.id)
  it('agrupa por categoría propia, en el orden del dueño', () => {
    const groups = groupsWithProducts(beauty, mine)
    expect(groups.map((g) => g.id)).toEqual(['tratamientos', 'maquillaje', 'fragancias'])
    const grouped = groupProducts(beauty, mine)
    expect(grouped.reduce((n, g) => n + g.items.length, 0)).toBe(mine.length)
  })
  it('sin categoría propia cae en el rubro general', () => {
    const bare: Store = { ...beauty, categories: [] }
    const g = groupOf(bare, mine[0])
    expect(g.id.startsWith('g:')).toBe(true)
    const orphan = { ...mine[0], shopCategory: 'borrada' }
    expect(groupOf(beauty, orphan).id.startsWith('g:')).toBe(true)
  })
  it('ids únicos y sugerencias por tipo', () => {
    expect(newCategoryId('Champú y cabello', [])).toBe('champu-y-cabello')
    expect(newCategoryId('Champú', ['champu'])).toBe('champu-2')
    expect(suggestedCategories({ categoryId: 'gastronomia', zoneId: 'E' })).toContain('Platos fuertes')
    expect(suggestedCategories({ categoryId: 'x', zoneId: 'F', businessType: 'service' })).toContain('Cortes')
  })
})

describe('pedido registrado a mano', () => {
  beforeEach(() => {
    useCatalog.getState().reset()
    useOrders.getState().reset()
  })
  const manualOrder = (qty: number): Order => {
    const p = useCatalog.getState().products.find((x) => x.id === 'P-401')!
    return {
      id: 'REG-1',
      createdAt: new Date().toISOString(),
      customer: { name: 'Ana', whatsapp: '' },
      delivery: { mode: 'pickup', address: null },
      notes: 'Registrado a mano',
      estimatedTotal: p.price * qty,
      payment: 'not_charged',
      subOrders: [
        {
          id: 'REG-1-A',
          orderId: 'REG-1',
          storeId: p.storeId,
          storeName: 'Coral Belleza',
          lines: [{ productId: p.id, name: p.name, variantId: null, variantName: null, size: null, qty, originalUnitPrice: p.price, unitPrice: p.price, promotionId: null, promoCode: null, lineTotal: p.price * qty }],
          subtotal: p.price * qty,
          status: 'delivered',
          history: [],
          stockCommitted: false,
        },
      ],
    }
  }
  it('descuenta el inventario y no cuenta como pedido propio del navegador', () => {
    const before = useCatalog.getState().products.find((x) => x.id === 'P-401')!.inventory['_|_']
    useOrders.getState().addManual(manualOrder(2), true)
    expect(useCatalog.getState().products.find((x) => x.id === 'P-401')!.inventory['_|_']).toBe(before - 2)
    expect(useOrders.getState().mine).toHaveLength(0)
    expect(useOrders.getState().orders[0].subOrders[0].manual).toBe(true)
  })
  it('anularlo devuelve las unidades al inventario', () => {
    const before = useCatalog.getState().products.find((x) => x.id === 'P-401')!.inventory['_|_']
    useOrders.getState().addManual(manualOrder(3), true)
    useOrders.getState().setSubOrderStatus('REG-1-A', 'cancelled')
    expect(useCatalog.getState().products.find((x) => x.id === 'P-401')!.inventory['_|_']).toBe(before)
  })
  it('sin ajuste de inventario (servicios) no lo toca', () => {
    const before = useCatalog.getState().products.find((x) => x.id === 'P-401')!.inventory['_|_']
    useOrders.getState().addManual(manualOrder(1), false)
    expect(useCatalog.getState().products.find((x) => x.id === 'P-401')!.inventory['_|_']).toBe(before)
  })
})
