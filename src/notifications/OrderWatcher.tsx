import { useEffect } from 'react'
import type { OrderStatus } from '../domain/types'
import { remoteEnabled } from '../remote/client'
import { refreshOrderTracking } from '../remote/sync'
import { ORDER_STATUS_LABEL } from '../services/orders'
import { useOrders } from '../state/orders'
import { useUI } from '../state/ui'
import { STATUS_NOTICE, useNotifications } from './store'
import { playTing } from './ting'

const POLL_MS = 6000
const FINAL: OrderStatus[] = ['delivered', 'cancelled']

/**
 * Vigila los pedidos del cliente en toda la app: consulta el estado a las tiendas (con base de datos),
 * y cuando un local cambia el estado crea el aviso, hace sonar la campanita y vibra.
 */
export function OrderWatcher() {
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __cmOrders?: typeof useOrders }).__cmOrders = useOrders
    // estado conocido: lo que ya existe al abrir la app no genera avisos
    const known = new Map<string, OrderStatus>()
    for (const o of useOrders.getState().orders) for (const s of o.subOrders) known.set(s.id, s.status)

    const unsub = useOrders.subscribe((state) => {
      for (const o of state.orders)
        for (const sub of o.subOrders) {
          const prev = known.get(sub.id)
          known.set(sub.id, sub.status)
          const title = STATUS_NOTICE[sub.status]
          if (!prev || prev === sub.status || !title) continue
          const fresh = useNotifications.getState().push({ id: `${sub.id}:${sub.status}`, subId: sub.id, orderId: o.id, storeName: sub.storeName, status: sub.status, title, at: new Date().toISOString() })
          if (!fresh) continue
          void playTing(sub.status === 'ready')
          navigator.vibrate?.(sub.status === 'ready' ? [60, 50, 60] : 40)
          useUI.getState().toast(`${sub.storeName}: ${ORDER_STATUS_LABEL[sub.status]}`, sub.status === 'cancelled' ? 'error' : 'success')
        }
    })

    const poll = () => {
      if (document.hidden || !remoteEnabled()) return
      const recent = Date.now() - 48 * 3_600_000
      for (const o of useOrders.getState().orders)
        if (Date.parse(o.createdAt) > recent && o.subOrders.some((s) => !FINAL.includes(s.status))) void refreshOrderTracking(o.id)
    }
    poll()
    const t = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      unsub()
      clearInterval(t)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [])
  return null
}
