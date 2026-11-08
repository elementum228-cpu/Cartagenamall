import { CheckCircle2, ClipboardList, Copy, MessageCircle, Store } from 'lucide-react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { remoteEnabled } from '../remote/client'
import type { Order, OrderStatus, SubOrder } from '../domain/types'
import { copyText } from '../lib/clipboard'
import { openWhatsApp, whatsappLink } from '../lib/restaurant'
import { formatCOP, formatDateTime } from '../lib/format'
import { ORDER_STATUS_LABEL, overallStatus, stepIndex, stepsFor, subOrderMessage } from '../services/orders'
import { useCatalogMaps } from '../state/catalog'
import { useOrders } from '../state/orders'
import { useUI } from '../state/ui'
import { EmptyState, StoreLogo, btn } from '../ui/bits'
import { STATUS_BAR, STATUS_PILL } from '../ui/orderTone'


export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${STATUS_PILL[status]}`}>{ORDER_STATUS_LABEL[status]}</span>
}

export function OrdersPage() {
  const orders = useOrders((s) => s.orders)
  const removeOrder = useOrders((s) => s.removeOrder)
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
        <div key={o.id}>
          <Link to={`/pedidos/${o.id}`} className="block rounded-3xl border border-line bg-card p-4 transition hover:shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold">Pedido #{o.id.slice(-4)}</p>
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
          {o.subOrders.every((x) => x.status === 'delivered' || x.status === 'cancelled') && (
            <button className="mt-1 ml-auto flex items-center gap-1 px-2 py-1 text-xs font-bold text-ink-soft underline-offset-2 hover:underline" onClick={() => removeOrder(o.id)}>
              Quitar de mi lista
            </button>
          )}
        </div>
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
  const finished = !!order && order.subOrders.every((x) => x.status === 'delivered' || x.status === 'cancelled')
  // El seguimiento y los avisos (campanita) los maneja OrderWatcher en toda la app.
  const live = remoteEnabled() && !!order && !finished
  if (!order)
    return (
      <EmptyState icon={<ClipboardList className="size-7" />} title="Pedido no encontrado" action={<Link to="/pedidos" className={btn.secondary}>Ver mis pedidos</Link>}>
        Los pedidos de demostración se guardan solo en este navegador.
      </EmptyState>
    )
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-5 pb-28 md:pb-10">
      {params.get('nuevo') && (
        <div className="flex items-start gap-3 rounded-3xl border border-brand/20 bg-brand/8 p-4">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand" />
          <div>
            <p className="font-extrabold">¡Pedido enviado!</p>
            <p className="text-sm text-ink-soft">
              {waSent.length === order.subOrders.length
                ? 'Le escribimos por WhatsApp a la tienda. Aquí abajo sigues el estado de tu pedido.'
                : 'Si WhatsApp no se abrió, toca «Enviar por WhatsApp» en cada tienda para que le llegue su pedido. Aquí abajo sigues el estado.'}
            </p>
          </div>
        </div>
      )}
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight">Tu pedido</h1>
          <StatusPill status={overallStatus(order)} />
          {live && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
              <span className="size-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" /> En vivo
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Pedido #{order.id.slice(-4)} · {formatDateTime(order.createdAt)} · {order.delivery.mode === 'pickup' ? 'Recoger en el local' : `Domicilio: ${order.delivery.address}`}
        </p>
      </header>
      {order.notes && <p className="rounded-2xl bg-card p-3 text-sm text-ink-soft">Notas: {order.notes}</p>}
      {order.subOrders.map((s) => (
        <SubOrderCard key={s.id} order={order} sub={s} sent={waSent.includes(s.id)} single={order.subOrders.length === 1} />
      ))}
      <div className="flex items-end justify-between rounded-3xl border border-line bg-card p-5">
        <span className="font-bold">Total estimado</span>
        <span className="text-2xl font-extrabold">{formatCOP(order.estimatedTotal)}</span>
      </div>
      {params.get('nuevo') && (
        <Link to="/" className={`${btn.secondary} w-full`}>
          <Store className="size-4" /> Seguir en el mall
        </Link>
      )}
    </div>
  )
}

function SubOrderCard({ order, sub, sent, single }: { order: Order; sub: SubOrder; sent: boolean; single: boolean }) {
  const { storeById } = useCatalogMaps()
  const store = storeById[sub.storeId]
  const toast = useUI((s) => s.toast)
  const steps = stepsFor(order.delivery.mode)
  const stepIdx = stepIndex(order.delivery.mode, sub.status)
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-card">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        {store && <StoreLogo store={store} size={36} />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{sub.storeName}</p>
        </div>
        {!single && <StatusPill status={sub.status} />}
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
        <ol className="grid gap-1 px-3 pt-3 pb-3" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Progreso">
          {steps.map(({ label }, i) => (
            <li key={label} className="flex flex-col gap-1">
              <span className={`h-1.5 rounded-full ${i <= stepIdx ? STATUS_BAR[sub.status] : 'bg-line'}`} />
              <span className={`text-center leading-tight ${steps.length > 5 ? 'text-[9.5px] tracking-tight' : 'text-[10.5px]'} ${i === stepIdx ? 'font-bold text-ink' : 'text-ink-soft'}`}>{label}</span>
            </li>
          ))}
        </ol>
      )}
      {store?.whatsapp && sub.status !== 'cancelled' && (
        <div className="px-4 pb-3">
          <a
            href={whatsappLink(store.whatsapp, subOrderMessage(order, sub, formatCOP, store))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault()
              openWhatsApp(whatsappLink(store.whatsapp, subOrderMessage(order, sub, formatCOP, store)))
            }}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[0.98] ${sent ? 'border border-line bg-card text-ink' : 'bg-[#1faa59] text-white shadow-soft'}`}
          >
            <MessageCircle className="size-4" /> {sent ? 'Enviado · reenviar por WhatsApp' : `Enviar pedido por WhatsApp a ${sub.storeName}`}
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
