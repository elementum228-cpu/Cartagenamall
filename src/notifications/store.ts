import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OrderStatus } from '../domain/types'
import { safeStorage } from '../state/storage'

/** Avisos al cliente cuando el local cambia el estado de su pedido. */
export interface AppNotification {
  id: string
  orderId: string
  storeName: string
  status: OrderStatus
  title: string
  at: string
  read: boolean
}

/** Qué se le dice al cliente en cada estado (los demás estados no generan aviso). */
export const STATUS_NOTICE: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Tu pedido fue confirmado',
  preparing: 'Están preparando tu pedido',
  ready: '¡Tu pedido está listo!',
  delivered: 'Pedido entregado. ¡Buen provecho!',
  cancelled: 'El local canceló tu pedido',
}

interface State {
  items: AppNotification[]
  /** Se incrementa con cada aviso nuevo (hace sonar y mover la campana). */
  rung: number
  push: (n: Omit<AppNotification, 'read'>) => boolean
  markAllRead: () => void
  clear: () => void
}

export const useNotifications = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      rung: 0,
      push: (n) => {
        if (get().items.some((x) => x.id === n.id)) return false
        set((s) => ({ items: [{ ...n, read: false }, ...s.items].slice(0, 40), rung: s.rung + 1 }))
        return true
      },
      markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'cm:notifications:v1', storage: safeStorage, partialize: (s) => ({ items: s.items }) },
  ),
)
