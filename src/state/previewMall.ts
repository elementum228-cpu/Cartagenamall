import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SPACES, ZONES } from '../config/mall'
import { buildPreviewFill } from '../data/previewMall'
import type { Product, Store } from '../domain/types'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { useCatalog } from './catalog'
import { safeStorage } from './storage'

/**
 * «Mall lleno»: prueba de la administración que llena con negocios inventados todos los espacios libres para ver el mall completo.
 * Solo se ve en este dispositivo (no toca el catálogo ni la base de datos) y solo la activan los administradores
 * (en la demostración sin cuentas, cualquiera).
 */
export const usePreviewMall = create<{ full: boolean; setFull: (v: boolean) => void }>()(
  persist((set) => ({ full: false, setFull: (full) => set({ full }) }), { name: 'cm:preview-full:v1', storage: safeStorage, version: 1 }),
)

/** ¿Quien mira puede usar el modo de prueba? */
export const canPreview = () => useSession.getState().isAdmin || !remoteEnabled()

/** El catálogo que dibuja el mundo 3D: el real y, con el modo prueba encendido, los negocios inventados en los espacios libres. */
export function useWorldCatalog() {
  const stores = useCatalog((s) => s.stores)
  const products = useCatalog((s) => s.products)
  const assignments = useCatalog((s) => s.assignments)
  const full = usePreviewMall((s) => s.full)
  const isAdmin = useSession((s) => s.isAdmin)
  const on = full && (isAdmin || !remoteEnabled())
  return useMemo(() => {
    let allStores: Store[] = stores
    let allProducts: Product[] = products
    let allAssignments = assignments
    if (on) {
      const fill = buildPreviewFill(SPACES, ZONES, stores, assignments)
      allStores = [...stores, ...fill.stores]
      allProducts = [...products, ...fill.products]
      allAssignments = { ...assignments, ...fill.assignments }
    }
    const storeById: Record<string, Store> = Object.fromEntries(allStores.map((s) => [s.id, s]))
    const spaceByStore: Record<string, string> = Object.fromEntries(Object.entries(allAssignments).map(([sp, st]) => [st, sp]))
    return { on, stores: allStores, products: allProducts, assignments: allAssignments, storeById, spaceByStore }
  }, [on, stores, products, assignments])
}
