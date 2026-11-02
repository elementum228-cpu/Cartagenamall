import { Bell, BellRing, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { DeliveryMode, SubOrder } from '../domain/types'
import { ORDER_STATUS_LABEL, stepIndex, stepsFor } from '../services/orders'
import { formatCOP } from '../lib/format'
import { useSession } from '../remote/session'
import { useOrders } from '../state/orders'
import { STATUS_BAR, STATUS_PILL } from '../ui/orderTone'
import { useWelcome } from '../features/OwnerWelcome'
import { useNotifications } from './store'

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`
}

/** Campanita de la barra superior: avisos del pedido y estado de los pedidos activos. */
export function BellButton({ className }: { className: string }) {
  const items = useNotifications((s) => s.items)
  const rung = useNotifications((s) => s.rung)
  const markSeen = useNotifications((s) => s.markSeen)
  const prune = useNotifications((s) => s.prune)
  const remove = useNotifications((s) => s.remove)
  const allOrders = useOrders((s) => s.orders)
  const mineIds = useOrders((s) => s.mine)
  const { isAdmin, storeIds } = useSession()
  const orders = allOrders.filter((o) => mineIds.includes(o.id))
  // pedidos que llegaron a las tiendas que administra esta cuenta y aún no atendió
  const toAttend = allOrders.flatMap((o) => o.subOrders.filter((s) => (isAdmin || storeIds.includes(s.storeId)) && (s.status === 'pending_confirmation' || s.status === 'received')).map((s) => ({ o, s })))
  const [open, setOpen] = useState(false)
  const [wiggle, setWiggle] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const unread = items.filter((i) => !i.read).length
  const active = orders.flatMap((o) => o.subOrders.filter((s) => s.status !== 'delivered' && s.status !== 'cancelled').map((s) => ({ o, s })))

  useEffect(() => setOpen(false), [pathname])
  // los avisos vistos se borran solos a los 40 s
  useEffect(() => {
    prune()
    const t = setInterval(prune, 1000)
    return () => clearInterval(t)
  }, [prune])
  useEffect(() => {
    if (!rung) return
    setWiggle(true)
    const t = setTimeout(() => setWiggle(false), 1400)
    return () => clearTimeout(t)
  }, [rung])
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  if (!orders.length && !items.length && !toAttend.length) return null

  const Icon = unread ? BellRing : Bell
  return (
    <div ref={ref} className="relative">
      <button
        className={className}
        aria-label={unread ? `Notificaciones, ${unread} nuevas` : 'Notificaciones'}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
          if (!open) {
            prune()
            markSeen()
          }
        }}
      >
        <Icon className={`size-[21px] ${wiggle ? 'origin-top motion-safe:animate-[bell-ring_1.2s_ease-in-out]' : ''}`} strokeWidth={1.8} />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] leading-5 font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="border border-line bg-card fixed inset-x-3 top-[calc(var(--chrome-top)-4px)] z-[80] max-h-[70dvh] overflow-y-auto rounded-3xl p-3 shadow-[0_18px_50px_rgb(6_44_66/0.25)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[360px]" role="dialog" aria-label="Notificaciones">
          <p className="px-1 pb-2 font-extrabold">Notificaciones</p>

          {toAttend.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="px-1 text-[11px] font-bold tracking-wide text-ink-soft uppercase">Pedidos por atender</p>
              {toAttend.slice(0, 6).map(({ o, s }) => (
                <Link key={s.id} to={`/mi-negocio?tienda=${s.storeId}&tab=pedidos`} className="block rounded-2xl border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold">
                      {s.storeName} · {o.customer.name}
                    </p>
                    <span className="shrink-0 text-sm font-extrabold">{formatCOP(s.subtotal)}</span>
                  </div>
                  <p className="text-xs text-ink-soft">
                    {s.lines.reduce((a, l) => a + l.qty, 0)} productos · {o.delivery.mode === 'delivery' ? 'Domicilio' : 'Recoge en el local'} · {ago(o.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {active.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="px-1 text-[11px] font-bold tracking-wide text-ink-soft uppercase">Tus pedidos ahora</p>
              {active.map(({ o, s }) => (
                <ActiveOrder key={s.id} orderId={o.id} sub={s} mode={o.delivery.mode} />
              ))}
            </div>
          )}

          {items.length > 0 && (
            <>
              <p className="px-1 pb-1 text-[11px] font-bold tracking-wide text-ink-soft uppercase">Avisos</p>
              <ul className="space-y-1.5">
                {items.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    {n.action === 'welcome' ? (
                      <button
                        onClick={() => {
                          setOpen(false)
                          remove(n.id)
                          useWelcome.getState().reopen()
                        }}
                        className="flex w-full items-start gap-2.5 rounded-2xl bg-brand p-3 text-left text-white shadow-soft transition active:scale-[0.98]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug font-bold">🎉 {n.title}</span>
                          <span className="block text-xs font-semibold opacity-90">{n.subtitle}</span>
                        </span>
                        <ChevronRight className="mt-1 size-4 shrink-0" />
                      </button>
                    ) : (
                      <Link to={n.link ?? `/pedidos/${n.orderId}`} className="flex items-start gap-2.5 rounded-2xl bg-brand/[0.07] p-2.5 text-left transition hover:bg-sand">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug font-bold">{n.title}</span>
                          <span className="block truncate text-xs text-ink-soft">
                            {n.subtitle ?? `${n.storeName} · ${ago(n.at)}`}
                          </span>
                        </span>
                        <ChevronRight className="mt-1 size-4 shrink-0 text-ink-soft" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {items.length === 0 && active.length === 0 && toAttend.length === 0 && <p className="rounded-2xl bg-sand p-3 text-sm text-ink-soft">Sin novedades por ahora. Te avisaremos con un «ting» cuando un local mueva tu pedido.</p>}
        </div>
      )}
    </div>
  )
}

function ActiveOrder({ orderId, sub, mode }: { orderId: string; sub: SubOrder; mode: DeliveryMode }) {
  const idx = stepIndex(mode, sub.status)
  return (
    <Link to={`/pedidos/${orderId}`} className="block rounded-2xl border border-line bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold">{sub.storeName}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_PILL[sub.status]}`}>{ORDER_STATUS_LABEL[sub.status]}</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {stepsFor(mode).map((st, i) => (
          <span key={st.label} className={`h-1.5 flex-1 rounded-full ${i <= idx ? STATUS_BAR[sub.status] : 'bg-line'}`} />
        ))}
      </div>
    </Link>
  )
}
