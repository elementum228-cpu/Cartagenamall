import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '../domain/types'
import { stockKey } from '../lib/inventory'
import { safeStorage } from './storage'

interface CartState {
  items: CartItem[]
  add: (input: Omit<CartItem, 'key' | 'qty'>, qty?: number) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

export const cartKey = (productId: string, variantId: string | null, size: string | null) =>
  `${productId}::${stockKey(variantId, size)}`

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (input, qty = 1) =>
        set((s) => {
          const key = cartKey(input.productId, input.variantId, input.size)
          const existing = s.items.find((i) => i.key === key)
          if (existing) return { items: s.items.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i)) }
          return { items: [...s.items, { ...input, key, qty }] }
        }),
      setQty: (key, qty) =>
        set((s) => ({ items: qty <= 0 ? s.items.filter((i) => i.key !== key) : s.items.map((i) => (i.key === key ? { ...i, qty } : i)) })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'cm:cart:v1', storage: safeStorage },
  ),
)

export const useCartCount = () => useCart((s) => s.items.reduce((a, i) => a + i.qty, 0))
