import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Order, OrderStatus } from '../domain/types'
import { useCatalog } from './catalog'
import { safeStorage } from './storage'

interface OrdersState {
  orders: Order[]
  /** Pedidos hechos desde este navegador (como cliente). Los demás los ve el comercio. */
  mine: string[]
  nextNumber: number
  add: (order: Order) => void
  /** Pedido que registra el comercio a mano (venta en el local o por WhatsApp): no es «mío» como cliente y descuenta el inventario. */
  addManual: (order: Order, adjustStock: boolean) => void
  setSubOrderStatus: (subOrderId: string, status: OrderStatus) => void
  /** El comercio quita de su lista un pedido entregado o cancelado. */
  archiveSubOrder: (subOrderId: string) => void
  /** El cliente quita de su lista un pedido que ya terminó. */
  removeOrder: (orderId: string) => void
  reset: () => void
}

/** El inventario mock se descuenta cuando el comercio confirma, y se devuelve si luego cancela. */
const COMMITTED: OrderStatus[] = ['confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      mine: [],
      nextNumber: 1,
      add: (order) => set((s) => ({ orders: [order, ...s.orders], mine: [order.id, ...s.mine].slice(0, 200), nextNumber: s.nextNumber + 1 })),
      addManual: (order, adjustStock) => {
        if (adjustStock) for (const sub of order.subOrders) useCatalog.getState().commitStock(sub.lines, 1)
        set((s) => ({ orders: [{ ...order, subOrders: order.subOrders.map((x) => ({ ...x, manual: true, stockCommitted: adjustStock })) }, ...s.orders] }))
      },
      archiveSubOrder: (subId) =>
        set((s) => ({ orders: s.orders.map((o) => ({ ...o, subOrders: o.subOrders.map((x) => (x.id === subId ? { ...x, archived: true } : x)) })) })),
      removeOrder: (orderId) => set((s) => ({ orders: s.orders.filter((o) => o.id !== orderId), mine: s.mine.filter((id) => id !== orderId) })),
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
      reset: () => set({ orders: [], mine: [], nextNumber: 1 }),
    }),
    {
      name: 'cm:orders:v1',
      storage: safeStorage,
      version: 1,
      // los pedidos guardados antes de existir «mine» se hicieron desde este navegador
      migrate: (persisted, version) => {
        const st = persisted as Partial<OrdersState>
        return (version < 1 ? { ...st, mine: (st.orders ?? []).map((o) => o.id) } : st) as OrdersState
      },
    },
  ),
)
