import { CheckCircle2, ClipboardList, Copy, Info, MessageCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { remoteEnabled } from '../remote/client'
import { refreshOrderTracking } from '../remote/sync'
import type { Order, OrderStatus, SubOrder } from '../domain/types'
import { copyText } from '../lib/clipboard'
import { whatsappLink } from '../lib/restaurant'
import { formatCOP, formatDateTime } from '../lib/format'
import { ORDER_FLOW, ORDER_STATUS_LABEL, overallStatus, subOrderMessage } from '../services/orders'
import { useCatalogMaps } from '../state/catalog'
import { useOrders } from '../state/orders'
import { useUI } from '../state/ui'
import { EmptyState, StoreLogo, btn } from '../ui/bits'

const TONE: Record<OrderStatus, string> = {
  received: 'bg-sky-100 text-sky-800',
  pending_confirmation: 'bg-amber-100 text-amber-900',
  confirmed: 'bg-teal-100 text-teal-800',
  preparing: 'bg-indigo-100 text-indigo-800',
  ready: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-emerald-600 text-white',
  cancelled: 'bg-red-100 text-red-700',
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${TONE[status]}`}>{ORDER_STATUS_LABEL[status]}</span>
}

export function OrdersPage() {
  const orders = useOrders((s) => s.orders)
  if (!orders.length)
    return (
      <EmptyState icon={<ClipboardList className="size-7" />} title="Aún no tienes pedidos" action={<Link to="/comprar" className={btn.primary}>Ir a comprar</Link>}>
        Cuando envíes un pedido, aquí verás el estado de cada tienda.
      </EmptyState>
    )
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 pt-5 pb-28 md:pb-10">
      <h1 className="text-2xl font-extrabold tracking-tight">Mis pedidos</h1>
      {orders.map((o) => (
        <Link key={o.id} to={`/pedidos/${o.id}`} className="block rounded-3xl border border-line bg-card p-4 transition hover:shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-extrabold">{o.id}</p>
              <p className="text-xs text-ink-soft">
                {formatDateTime(o.createdAt)} · {o.subOrders.length} {o.subOrders.length === 1 ? 'tienda' : 'tiendas'}
              </p>
            </div>
            <StatusPill status={overallStatus(o)} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex -space-x-2">
              {o.subOrders.map((s) => (
                <SubLogo key={s.id} storeId={s.storeId} />
              ))}
            </div>
            <span className="font-extrabold">{formatCOP(o.estimatedTotal)}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function SubLogo({ storeId }: { storeId: string }) {
  const { storeById } = useCatalogMaps()
  const s = storeById[storeId]
  return s ? (
    <div className="rounded-2xl ring-2 ring-card">
      <StoreLogo store={s} size={32} />
    </div>
  ) : null
}

export function OrderDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const order = useOrders((s) => s.orders.find((o) => o.id === id))
  const waSent = ((useLocation().state as { waSent?: string[] } | null)?.waSent ?? []) as string[]
  const toast = useUI((s) => s.toast)
  const seen = useRef<Record<string, string>>({})
  const finished = !!order && order.subOrders.every((x) => x.status === 'delivered' || x.status === 'cancelled')
  const live = remoteEnabled() && !!order && !finished
  // Seguimiento en vivo: cada pocos segundos pregunta el estado de cada tienda y avisa cuando cambia.
  useEffect(() => {
    if (!live || !id) return
    const tick = () => {
      if (!document.hidden) void refreshOrderTracking(id)
    }
    tick()
    const t = setInterval(tick, 5000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [live, id])
  useEffect(() => {
    for (const sub of order?.subOrders ?? []) {
      const prev = seen.current[sub.id]
      if (prev && prev !== sub.status) {
        toast(`${sub.storeName}: ${ORDER_STATUS_LABEL[sub.status]}`, sub.status === 'cancelled' ? 'error' : 'success')
        navigator.vibrate?.(40)
      }
      seen.current[sub.id] = sub.status
    }
  }, [order, toast])
  if (!order)
    return (
      <EmptyState icon={<ClipboardList className="size-7" />} title="Pedido no encontrado" action={<Link to="/pedidos" className={btn.secondary}>Ver mis pedidos</Link>}>
        Los pedidos de demostración se guardan solo en este navegador.
      </EmptyState>
    )
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-5 pb-28 md:pb-10">
      {params.get('nuevo') && (
        <div className="flex gap-3 rounded-3xl bg-brand p-4 text-white shadow-soft">
          <CheckCircle2 className="size-7 shrink-0" />
          <div>
            <p className="font-extrabold">¡Pedido enviado!</p>
            <p className="text-sm opacity-90">
              {waSent.length === order.subOrders.length
                ? 'Le escribimos por WhatsApp a la tienda. Aquí abajo sigues el estado de tu pedido.'
                : 'Si WhatsApp no se abrió, toca «Enviar por WhatsApp» en cada tienda para que le llegue su pedido. Aquí abajo sigues el estado.'}
            </p>
          </div>
        </div>
      )}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ink-soft">Orden principal</p>
          <h1 className="font-mono text-2xl font-extrabold">{order.id}</h1>
          <p className="text-xs text-ink-soft">
            {formatDateTime(order.createdAt)} · {order.customer.name} · {order.delivery.mode === 'pickup' ? 'Recoger en el local' : `Domicilio: ${order.delivery.address}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill status={overallStatus(order)} />
          {live && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
              <span className="size-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" /> En vivo
            </span>
          )}
        </div>
      </header>
      <p className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Pago: <b>no realizado</b>. Precios, inventario y entrega deben ser confirmados por cada comerciante antes de cualquier cobro.
        </span>
      </p>
      {order.notes && <p className="rounded-2xl bg-card p-3 text-sm text-ink-soft">Notas: {order.notes}</p>}
      {order.subOrders.map((s) => (
        <SubOrderCard key={s.id} order={order} sub={s} sent={waSent.includes(s.id)} />
      ))}
      <div className="flex items-end justify-between rounded-3xl border border-line bg-card p-5">
        <span className="font-bold">Total estimado</span>
        <span className="text-2xl font-extrabold">{formatCOP(order.estimatedTotal)}</span>
      </div>
    </div>
  )
}

function SubOrderCard({ order, sub, sent }: { order: Order; sub: SubOrder; sent: boolean }) {
  const { storeById } = useCatalogMaps()
  const store = storeById[sub.storeId]
  const toast = useUI((s) => s.toast)
  const stepIdx = ORDER_FLOW.indexOf(sub.status)
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-card">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        {store && <StoreLogo store={store} size={36} />}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-bold text-ink-soft">
            {sub.id} · {sub.storeId}
          </p>
          <p className="truncate font-bold">{sub.storeName}</p>
        </div>
        <StatusPill status={sub.status} />
      </header>
      <ul className="divide-y divide-line px-4">
        {sub.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3 py-2.5 text-sm">
            <span>
              {l.qty} × {l.name}
              <span className="block text-xs text-ink-soft">
                {[l.variantName, l.size && `Talla ${l.size}`, l.promoCode && `Código ${l.promoCode}`].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="text-right font-semibold whitespace-nowrap">
              {formatCOP(l.lineTotal)}
              {l.unitPrice !== l.originalUnitPrice && <span className="block text-xs font-normal text-ink-soft line-through">{formatCOP(l.originalUnitPrice * l.qty)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {sub.status !== 'cancelled' && (
        <ol className="scrollbar-none flex gap-1 overflow-x-auto px-4 pt-2 pb-3" aria-label="Progreso">
          {ORDER_FLOW.map((st, i) => (
            <li key={st} className="flex min-w-[76px] flex-1 flex-col gap-1">
              <span className={`h-1.5 rounded-full ${i <= stepIdx ? 'bg-brand' : 'bg-line'}`} />
              <span className={`text-[10px] leading-tight ${i <= stepIdx ? 'font-bold text-ink' : 'text-ink-soft'}`}>{ORDER_STATUS_LABEL[st]}</span>
            </li>
          ))}
        </ol>
      )}
      {store?.whatsapp && sub.status !== 'cancelled' && (
        <div className="px-4 pb-3">
          <a
            href={whatsappLink(store.whatsapp, subOrderMessage(order, sub, formatCOP))}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[0.98] ${sent ? 'border border-line bg-card text-ink' : 'bg-[#1faa59] text-white shadow-soft'}`}
          >
            <MessageCircle className="size-4" /> {sent ? `Enviado a ${sub.storeName} · volver a abrir WhatsApp` : `Enviar pedido por WhatsApp a ${sub.storeName}`}
          </a>
        </div>
      )}
      <footer className="flex items-center justify-between gap-2 bg-sand/60 px-4 py-3">
        <button
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand"
          onClick={async () => toast((await copyText(subOrderMessage(order, sub, formatCOP))) ? 'Mensaje copiado: pégalo en el WhatsApp de la tienda.' : 'No se pudo copiar.')}
        >
          <Copy className="size-3.5" /> Copiar mensaje para {sub.storeName}
        </button>
        <span className="text-sm font-extrabold">{formatCOP(sub.subtotal)}</span>
      </footer>
    </section>
  )
}
