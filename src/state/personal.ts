import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

// Estado de la persona compradora: favoritos, comparador y descubrimientos del mundo 3D.

export const MAX_COMPARE = 4

interface PersonalState {
  favoriteStores: string[]
  favoriteProducts: string[]
  compare: string[]
  /** Ofertas escondidas encontradas en el mundo. */
  discovered: string[]
  /** Ofertas escondidas guardadas: estas aplican descuento en el carrito. */
  savedSecrets: string[]
  toggleFavoriteStore: (id: string) => void
  toggleFavoriteProduct: (id: string) => void
  /** Devuelve false si el comparador ya está lleno. */
  toggleCompare: (id: string) => boolean
  clearCompare: () => void
  discover: (promoId: string) => void
  saveSecret: (promoId: string) => void
  resetDiscoveries: () => void
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

export const usePersonal = create<PersonalState>()(
  persist(
    (set, get) => ({
      favoriteStores: [],
      favoriteProducts: [],
      compare: [],
      discovered: [],
      savedSecrets: [],
      toggleFavoriteStore: (id) => set((s) => ({ favoriteStores: toggle(s.favoriteStores, id) })),
      toggleFavoriteProduct: (id) => set((s) => ({ favoriteProducts: toggle(s.favoriteProducts, id) })),
      toggleCompare: (id) => {
        const { compare } = get()
        if (!compare.includes(id) && compare.length >= MAX_COMPARE) return false
        set({ compare: toggle(compare, id) })
        return true
      },
      clearCompare: () => set({ compare: [] }),
      discover: (id) => set((s) => (s.discovered.includes(id) ? s : { discovered: [...s.discovered, id] })),
      saveSecret: (id) =>
        set((s) => ({
          discovered: s.discovered.includes(id) ? s.discovered : [...s.discovered, id],
          savedSecrets: s.savedSecrets.includes(id) ? s.savedSecrets : [...s.savedSecrets, id],
        })),
      resetDiscoveries: () => set({ discovered: [], savedSecrets: [] }),
    }),
    { name: 'cm:personal:v1', storage: safeStorage },
  ),
)
