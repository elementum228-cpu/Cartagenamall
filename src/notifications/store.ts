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
  /** Cuándo se abrió la campanita viendo este aviso (ms). Desaparece SEEN_TTL_MS después. */
  seenAt?: number
  subId?: string
  /** Destino al tocar el aviso (por defecto, el seguimiento del pedido). */
  link?: string
  /** Texto bajo el título (en lugar de «tienda · hace x min»). */
  subtitle?: string
  /** No se borra solo: espera a que la persona lo toque. */
  sticky?: boolean
  /** Al tocarlo no navega: abre la bienvenida del dueño de un local. */
  action?: 'welcome' | 'ship'
}

/** Un aviso es solo eso: se borra solo 40 s después de que la persona abre la campanita y lo ve. */
export const SEEN_TTL_MS = 40_000

/** Qué se le dice al cliente en cada estado (los demás estados no generan aviso). */
export const STATUS_NOTICE: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Tu pedido fue confirmado',
  preparing: 'Están preparando tu pedido',
  ready: '¡Tu pedido está listo!',
  on_the_way: 'Tu pedido va en camino',
  delivered: 'Pedido entregado. ¡Buen provecho!',
  cancelled: 'El local canceló tu pedido',
}

interface State {
  items: AppNotification[]
  /** Se incrementa con cada aviso nuevo (hace sonar y mover la campana). */
  rung: number
  push: (n: Omit<AppNotification, 'read'>) => boolean
  /** La persona abrió la campanita: marca los avisos como vistos (empieza su cuenta atrás). */
  markSeen: () => void
  /** Quita los avisos vistos hace más de 40 s. */
  prune: () => void
  remove: (id: string) => void
  clear: () => void
}

export const useNotifications = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      rung: 0,
      push: (n) => {
        if (get().items.some((x) => x.id === n.id)) return false
        // un aviso nuevo de la misma tienda reemplaza al anterior: la barra no se llena de historial
        set((s) => ({ items: [{ ...n, read: false }, ...s.items.filter((x) => !n.subId || x.subId !== n.subId)].slice(0, 10), rung: s.rung + 1 }))
        return true
      },
      markSeen: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true, seenAt: i.seenAt ?? Date.now() })) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      prune: () => {
        const now = Date.now()
        const keep = get().items.filter((i) => i.sticky || !i.seenAt || now - i.seenAt < SEEN_TTL_MS)
        if (keep.length !== get().items.length) set({ items: keep })
      },
      clear: () => set({ items: [] }),
    }),
    { name: 'cm:notifications:v1', storage: safeStorage, partialize: (s) => ({ items: s.items }) },
  ),
)
