import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

/**
 * Negocio que se administra desde «Mi negocio». Es una sesión de demostración: no hay cuentas,
 * cualquiera en este navegador puede elegir una tienda y editarla.
 */
interface MerchantState {
  storeId: string | null
  setStoreId: (id: string | null) => void
}

export const useMerchant = create<MerchantState>()(
  persist((set) => ({ storeId: null, setStoreId: (storeId) => set({ storeId }) }), { name: 'cm:merchant:v1', storage: safeStorage }),
)
