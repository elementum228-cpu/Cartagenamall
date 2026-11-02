import { Bell, BellRing, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { SubOrder } from '../domain/types'
import { ORDER_FLOW, ORDER_STATUS_LABEL } from '../services/orders'
import { useOrders } from '../state/orders'
import { STATUS_BAR, STATUS_PILL } from '../ui/orderTone'
import { useNotifications } from './store'

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`
}

/** Campanita de la barra superior: avisos del pedido y estado de los pedidos activos. */
export function BellButton({ className }: { className: string }) {
  const items = useNotifications((s) => s.items)
  const rung = useNotifications((s) => s.rung)
  const markAllRead = useNotifications((s) => s.markAllRead)
  const orders = useOrders((s) => s.orders)
  const [open, setOpen] = useState(false)
  const [wiggle, setWiggle] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const unread = items.filter((i) => !i.read).length
  const active = orders.flatMap((o) => o.subOrders.filter((s) => s.status !== 'delivered' && s.status !== 'cancelled').map((s) => ({ o, s })))

  useEffect(() => setOpen(false), [pathname])
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
  if (!orders.length && !items.length) return null

  const Icon = unread ? BellRing : Bell
  return (
    <div ref={ref} className="relative">
      <button
        className={className}
        aria-label={unread ? `Notificaciones, ${unread} nuevas` : 'Notificaciones'}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
          if (open) markAllRead()
        }}
      >
        <Icon className={`size-[21px] ${wiggle ? 'origin-top motion-safe:animate-[bell-ring_1.2s_ease-in-out]' : ''}`} strokeWidth={1.8} />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] leading-5 font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="border border-line bg-card fixed inset-x-3 top-[calc(var(--chrome-top)-4px)] z-[80] max-h-[70dvh] overflow-y-auto rounded-3xl p-3 shadow-[0_18px_50px_rgb(6_44_66/0.25)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[360px]" role="dialog" aria-label="Notificaciones">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="font-extrabold">Notificaciones</p>
            {items.length > 0 && (
              <button className="text-xs font-bold text-brand" onClick={markAllRead}>
                Marcar como leídas
              </button>
            )}
          </div>

          {active.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="px-1 text-[11px] font-bold tracking-wide text-ink-soft uppercase">Tus pedidos ahora</p>
              {active.map(({ o, s }) => (
                <ActiveOrder key={s.id} orderId={o.id} sub={s} />
              ))}
            </div>
          )}

          <p className="px-1 pb-1 text-[11px] font-bold tracking-wide text-ink-soft uppercase">Avisos</p>
          {items.length === 0 ? (
            <p className="rounded-2xl bg-sand p-3 text-sm text-ink-soft">Cuando un local confirme o prepare tu pedido, te avisamos aquí con un «ting».</p>
          ) : (
            <ul className="space-y-1.5">
              {items.slice(0, 12).map((n) => (
                <li key={n.id}>
                  <Link to={`/pedidos/${n.orderId}`} className={`flex items-start gap-2.5 rounded-2xl p-2.5 text-left transition hover:bg-sand ${n.read ? '' : 'bg-brand/[0.07]'}`}>
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-coral'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug font-bold">{n.title}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {n.storeName} · {ago(n.at)}
                      </span>
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-ink-soft" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function ActiveOrder({ orderId, sub }: { orderId: string; sub: SubOrder }) {
  const idx = Math.max(0, ORDER_FLOW.indexOf(sub.status))
  return (
    <Link to={`/pedidos/${orderId}`} className="block rounded-2xl border border-line bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold">{sub.storeName}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_PILL[sub.status]}`}>{ORDER_STATUS_LABEL[sub.status]}</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {ORDER_FLOW.map((st, i) => (
          <span key={st} className={`h-1.5 flex-1 rounded-full ${i <= idx ? STATUS_BAR[sub.status] : 'bg-line'}`} />
        ))}
      </div>
    </Link>
  )
}
