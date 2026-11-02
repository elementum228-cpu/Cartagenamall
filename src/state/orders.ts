import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Order, OrderStatus } from '../domain/types'
import { useCatalog } from './catalog'
import { safeStorage } from './storage'

interface OrdersState {
  orders: Order[]
  nextNumber: number
  add: (order: Order) => void
  setSubOrderStatus: (subOrderId: string, status: OrderStatus) => void
  reset: () => void
}

/** El inventario mock se descuenta cuando el comercio confirma, y se devuelve si luego cancela. */
const COMMITTED: OrderStatus[] = ['confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      nextNumber: 1,
      add: (order) => set((s) => ({ orders: [order, ...s.orders], nextNumber: s.nextNumber + 1 })),
      setSubOrderStatus: (subId, status) =>
        set((s) => ({
          orders: s.orders.map((o) => ({
            ...o,
            subOrders: o.subOrders.map((sub) => {
              if (sub.id !== subId || sub.status === status) return sub
              let stockCommitted = sub.stockCommitted
              if (COMMITTED.includes(status) && !stockCommitted) {
                useCatalog.getState().commitStock(sub.lines, 1)
                stockCommitted = true
              } else if (status === 'cancelled' && stockCommitted) {
                useCatalog.getState().commitStock(sub.lines, -1)
                stockCommitted = false
              }
              return { ...sub, status, stockCommitted, history: [...sub.history, { status, at: new Date().toISOString() }] }
            }),
          })),
        })),
      reset: () => set({ orders: [], nextNumber: 1 }),
    }),
    { name: 'cm:orders:v1', storage: safeStorage },
  ),
)
