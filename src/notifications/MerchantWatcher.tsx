import { useEffect } from 'react'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { refreshOrders } from '../remote/sync'
import { formatCOP } from '../lib/format'
import { useOrders } from '../state/orders'
import { useUI } from '../state/ui'
import { useNotifications } from './store'
import { playTing } from './ting'

const POLL_MS = 8000
const FRESH_MS = 5 * 60_000

/**
 * Avisos para la cuenta del dueño del local (o administrador): cuando llega un pedido nuevo a una tienda que administra,
 * suena la campanita y queda el aviso con acceso directo a su pestaña de Pedidos. El pedido igual llega por WhatsApp.
 */
export function MerchantWatcher() {
  const manager = useSession((s) => s.isAdmin || s.storeIds.length > 0)
  useEffect(() => {
    if (!manager) return
    const known = new Set<string>()
    for (const o of useOrders.getState().orders) for (const s of o.subOrders) known.add(s.id)

    const unsub = useOrders.subscribe((state) => {
      const { isAdmin, storeIds } = useSession.getState()
      for (const o of state.orders)
        for (const sub of o.subOrders) {
          if (known.has(sub.id)) continue
          known.add(sub.id)
          const mine = isAdmin || storeIds.includes(sub.storeId)
          // solo pedidos recientes y todavía sin atender (al abrir la app no se avisa de pedidos viejos)
          if (!mine || Date.now() - Date.parse(o.createdAt) > FRESH_MS || (sub.status !== 'pending_confirmation' && sub.status !== 'received')) continue
          const fresh = useNotifications.getState().push({
            id: `new:${sub.id}`,
            orderId: o.id,
            storeName: sub.storeName,
            status: sub.status,
            title: `Nuevo pedido · ${formatCOP(sub.subtotal)}`,
            at: new Date().toISOString(),
            link: `/mi-negocio?tienda=${sub.storeId}&tab=pedidos`,
          })
          if (!fresh) continue
          void playTing(true)
          navigator.vibrate?.([80, 60, 80])
          useUI.getState().toast(`Nuevo pedido en ${sub.storeName}: ${o.customer.name} · ${formatCOP(sub.subtotal)}`, 'success')
        }
    })

    const poll = () => {
      if (!document.hidden && remoteEnabled()) void refreshOrders()
    }
    poll()
    const t = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      unsub()
      clearInterval(t)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [manager])
  return null
}
