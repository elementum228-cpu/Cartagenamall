import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OrderLine, Product, Promotion, Store } from '../domain/types'
import { SEED_ASSIGNMENTS, SEED_PRODUCTS, SEED_STORES, createSeedPromotions } from '../data/seed'
import { stockKey } from '../lib/inventory'
import { safeStorage } from './storage'

interface CatalogState {
  stores: Store[]
  products: Product[]
  promotions: Promotion[]
  /** spaceId → storeId */
  assignments: Record<string, string>
  upsertStore: (store: Store) => void
  /** Elimina la tienda con sus productos, promociones y el espacio que ocupaba. */
  deleteStore: (storeId: string) => void
  upsertProduct: (product: Product) => void
  deleteProduct: (productId: string) => void
  upsertPromotion: (promo: Promotion) => void
  deletePromotion: (promoId: string) => void
  setPromotionActive: (promoId: string, active: boolean) => void
  /** (Re)abre la ventana de una oferta relámpago o escondida desde ahora. */
  restartPromotionWindow: (promoId: string) => void
  assignSpace: (spaceId: string, storeId: string | null) => void
  commitStock: (lines: OrderLine[], direction: 1 | -1) => void
  reset: () => void
}

const seed = () => ({
  stores: SEED_STORES,
  products: SEED_PRODUCTS,
  promotions: createSeedPromotions(Date.now()),
  assignments: SEED_ASSIGNMENTS,
})

type SeedShape = Pick<CatalogState, 'stores' | 'products' | 'promotions' | 'assignments'>

/** Agrega del seed lo que falte, por id; nunca sobrescribe datos existentes. */
export function mergeSeed(old: SeedShape, now = Date.now()): SeedShape {
  const fresh = { ...seed(), promotions: createSeedPromotions(now) }
  const has = <T extends { id: string }>(list: T[]) => new Set(list.map((x) => x.id))
  const stores = has(old.stores)
  const products = has(old.products)
  const promos = has(old.promotions)
  const takenSpaces = new Set(Object.keys(old.assignments))
  const placedStores = new Set(Object.values(old.assignments))
  const assignments = { ...old.assignments }
  for (const [space, store] of Object.entries(fresh.assignments))
    if (!takenSpaces.has(space) && !placedStores.has(store) && !stores.has(store)) assignments[space] = store
  return {
    stores: [...old.stores, ...fresh.stores.filter((s) => !stores.has(s.id))],
    products: [...old.products, ...fresh.products.filter((p) => !products.has(p.id))],
    promotions: [...old.promotions, ...fresh.promotions.filter((p) => !promos.has(p.id))],
    assignments,
  }
}

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

export const useCatalog = create<CatalogState>()(
  persist(
    (set) => ({
      ...seed(),
      upsertStore: (store) => set((s) => ({ stores: upsert(s.stores, store) })),
      deleteStore: (id) =>
        set((s) => ({
          stores: s.stores.filter((x) => x.id !== id),
          products: s.products.filter((p) => p.storeId !== id),
          promotions: s.promotions.filter((p) => p.storeId !== id),
          assignments: Object.fromEntries(Object.entries(s.assignments).filter(([, st]) => st !== id)),
        })),
      upsertProduct: (product) => set((s) => ({ products: upsert(s.products, product) })),
      deleteProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id), promotions: s.promotions.filter((p) => p.productId !== id) })),
      upsertPromotion: (promo) => set((s) => ({ promotions: upsert(s.promotions, promo) })),
      deletePromotion: (id) => set((s) => ({ promotions: s.promotions.filter((p) => p.id !== id) })),
      setPromotionActive: (id, active) =>
        set((s) => ({ promotions: s.promotions.map((p) => (p.id === id ? { ...p, active } : p)) })),
      restartPromotionWindow: (id) =>
        set((s) => ({
          promotions: s.promotions.map((p) => {
            if (p.id !== id) return p
            const now = Date.now()
            const hours = p.durationHours ?? 6
            return { ...p, active: true, startsAt: new Date(now).toISOString(), endsAt: new Date(now + hours * 3_600_000).toISOString() }
          }),
        })),
      assignSpace: (spaceId, storeId) =>
        set((s) => {
          const next: Record<string, string> = {}
          // Una tienda ocupa un solo espacio: si ya tenía otro, se libera.
          for (const [sp, st] of Object.entries(s.assignments)) if (sp !== spaceId && st !== storeId) next[sp] = st
          if (storeId) next[spaceId] = storeId
          return { assignments: next }
        }),
      commitStock: (lines, direction) =>
        set((s) => ({
          products: s.products.map((p) => {
            const mine = lines.filter((l) => l.productId === p.id)
            if (!mine.length) return p
            const inventory = { ...p.inventory }
            for (const l of mine) {
              const k = stockKey(l.variantId, l.size)
              inventory[k] = Math.max(0, (inventory[k] ?? 0) - direction * l.qty)
            }
            return { ...p, inventory }
          }),
        })),
      reset: () => set(seed()),
    }),
    {
      name: 'cm:catalog:v1',
      storage: safeStorage,
      version: 2,
      // v1 → v2 (Piso 2): se agregan los negocios, productos, promociones y espacios nuevos sin
      // tocar nada de lo que la persona ya tenía (ediciones del admin, tiendas aprobadas, inventario).
      migrate: (persisted, version) => (version < 2 ? mergeSeed(persisted as SeedShape) : persisted) as CatalogState,
    },
  ),
)

/** Mapas derivados memoizados (evitan recalcular en cada render). */
export function useCatalogMaps() {
  const stores = useCatalog((s) => s.stores)
  const products = useCatalog((s) => s.products)
  const assignments = useCatalog((s) => s.assignments)
  return useMemo(() => {
    const storeById: Record<string, Store> = Object.fromEntries(stores.map((s) => [s.id, s]))
    const productById: Record<string, Product> = Object.fromEntries(products.map((p) => [p.id, p]))
    const spaceByStore: Record<string, string> = Object.fromEntries(Object.entries(assignments).map(([sp, st]) => [st, sp]))
    return { storeById, productById, spaceByStore }
  }, [stores, products, assignments])
}
