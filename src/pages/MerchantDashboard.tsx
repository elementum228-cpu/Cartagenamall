import { AlertTriangle, ArrowLeft, ArrowRight, ClipboardPlus, Minus, Package, Plus, Receipt, Search, ShoppingBag, TrendingDown, TrendingUp, Trash2, Wallet, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Customer, Order, OrderLine, OrderStatus, Product, Store, SubOrder } from '../domain/types'
import { formatCOP, formatDateTime } from '../lib/format'
import { uniqueId } from '../lib/ids'
import { needsOptions, stockFor, totalStock } from '../lib/inventory'
import { isService } from '../lib/restaurant'
import { useCatalog } from '../state/catalog'
import { useOrders } from '../state/orders'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'
import { ProductImage } from '../ui/ProductImage'

// Mini dashboard del negocio: cómo se han movido las ventas (pedidos de la app y pedidos que el dueño
// registra a mano al sacarlos del inventario), qué se vende más y qué se está agotando.

/** Estados que cuentan como venta (confirmada). Los pendientes se muestran aparte y los cancelados no cuentan. */
const SOLD: OrderStatus[] = ['confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']
const PENDING: OrderStatus[] = ['pending_confirmation', 'received']
const DAY = 86_400_000
const WEEKDAY = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const card = 'rounded-3xl border border-line bg-card p-4'

interface Sale {
  order: Order
  sub: SubOrder
  at: number
}

function useSales(store: Store): Sale[] {
  const orders = useOrders((s) => s.orders)
  return useMemo(
    () =>
      orders
        .flatMap((order) => order.subOrders.filter((sub) => sub.storeId === store.id).map((sub) => ({ order, sub, at: Date.parse(order.createdAt) })))
        .sort((a, b) => b.at - a.at),
    [orders, store.id],
  )
}

export function MerchantDashboard({ store, goTab }: { store: Store; goTab: (t: 'pedidos' | 'articulos') => void }) {
  const [registering, setRegistering] = useState(false)
  const sales = useSales(store)
  const products = useCatalog((s) => s.products)
  const [days, setDays] = useState<7 | 30>(7)
  const [pick, setPick] = useState<number | null>(null)
  const service = isService(store)

  const data = useMemo(() => {
    const today = startOfDay(Date.now())
    const from = today - (days - 1) * DAY
    const prevFrom = from - days * DAY
    const sold = sales.filter((x) => SOLD.includes(x.sub.status))
    const cur = sold.filter((x) => x.at >= from)
    const prev = sold.filter((x) => x.at >= prevFrom && x.at < from)
    const sum = (list: Sale[]) => list.reduce((a, x) => a + x.sub.subtotal, 0)
    const buckets = Array.from({ length: days }, (_, i) => {
      const t = from + i * DAY
      const inDay = cur.filter((x) => x.at >= t && x.at < t + DAY)
      const online = inDay.filter((x) => !x.sub.manual)
      const manual = inDay.filter((x) => x.sub.manual)
      return { t, online: sum(online), manual: sum(manual), count: inDay.length }
    })
    const byProduct = new Map<string, { name: string; qty: number; revenue: number }>()
    // Ganancia real: solo de lo vendido cuyo costo el negocio ya registró en el artículo.
    const costOf = new Map(products.filter((p) => p.storeId === store.id && p.cost).map((p) => [p.id, p.cost as number]))
    let profit = 0
    let costedRevenue = 0
    let uncosted = 0
    for (const x of cur)
      for (const l of x.sub.lines) {
        const c = costOf.get(l.productId)
        if (c !== undefined) {
          profit += l.lineTotal - c * l.qty
          costedRevenue += l.lineTotal
        } else uncosted += l.lineTotal
        const e = byProduct.get(l.productId) ?? { name: l.name, qty: 0, revenue: 0 }
        e.qty += l.qty
        e.revenue += l.lineTotal
        byProduct.set(l.productId, e)
      }
    const revenue = sum(cur)
    return {
      revenue,
      profit,
      costedRevenue,
      uncosted,
      prevRevenue: sum(prev),
      count: cur.length,
      prevCount: prev.length,
      avg: cur.length ? Math.round(revenue / cur.length) : 0,
      buckets,
      max: Math.max(1, ...buckets.map((b) => b.online + b.manual)),
      top: [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
      online: cur.filter((x) => !x.sub.manual),
      manual: cur.filter((x) => x.sub.manual),
      pending: sales.filter((x) => PENDING.includes(x.sub.status)).length,
      total: sold.length,
    }
  }, [sales, days, products, store.id])

  const low = useMemo(
    () => (service ? [] : products.filter((p) => p.storeId === store.id && p.active && totalStock(p) <= 3).sort((a, b) => totalStock(a) - totalStock(b)).slice(0, 4)),
    [products, store.id, service],
  )

  if (registering) return <RegisterOrder store={store} onDone={() => setRegistering(false)} />

  const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)
  const dRev = delta(data.revenue, data.prevRevenue)
  const dCount = delta(data.count, data.prevCount)
  const picked = pick !== null ? data.buckets[pick] : null
  const fullDate = (t: number) => new Date(t).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })

  return (
    <div className="space-y-4">
      {/* encabezado con acción principal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Resumen de ventas</h2>
          <p className="text-[13px] text-ink-soft">Cómo se ha movido {store.name}: pedidos de la app y los que registras tú.</p>
        </div>
        <button className={`${btn.primary} gap-2`} onClick={() => setRegistering(true)}>
          <ClipboardPlus className="size-[18px]" /> Registrar pedido
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-sand p-1 sm:inline-grid sm:w-56" role="tablist" aria-label="Periodo">
        {([7, 30] as const).map((d) => (
          <button key={d} role="tab" aria-selected={days === d} onClick={() => { setDays(d); setPick(null) }} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${days === d ? 'bg-white text-brand shadow-soft' : 'text-ink-soft'}`}>
            {d} días
          </button>
        ))}
      </div>

      {/* indicadores */}
      {data.costedRevenue > 0 ? (
        <div className={`rounded-3xl border p-4 ${data.profit <= 0 ? 'border-red-300 bg-red-50' : data.profit / data.costedRevenue < 0.2 ? 'border-red-300 bg-red-50' : data.profit / data.costedRevenue < 0.35 ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
          <p className="text-[12px] font-bold text-ink-soft">Lo que realmente te quedó</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{data.profit < 0 ? '−' : ''}{formatCOP(Math.abs(data.profit))}</p>
          <p className="mt-0.5 text-[13px] font-semibold text-ink-soft">
            De {formatCOP(data.costedRevenue)} vendidos, te quedó el {Math.round((data.profit / data.costedRevenue) * 100)}% después de lo que te costaron los artículos.
          </p>
          {data.uncosted > 0 && <p className="mt-1 text-[11px] text-ink-soft">No incluye {formatCOP(data.uncosted)} de artículos sin costo. Agrégalo al editarlos para ver la ganancia completa.</p>}
        </div>
      ) : (
        data.revenue > 0 && (
          <p className="rounded-2xl bg-sand px-3 py-2.5 text-[12px] text-ink-soft">
            Para ver cuánto te queda de cada venta, agrega «¿Cuánto te cuesta?» a tus artículos (en Artículos → Editar).
          </p>
        )
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Wallet className="size-[18px]" />} label="Ventas" value={formatCOP(data.revenue)} delta={dRev} color={store.brandColor} />
        <Kpi icon={<Receipt className="size-[18px]" />} label="Pedidos" value={String(data.count)} delta={dCount} color={store.brandColor} />
        <Kpi icon={<ShoppingBag className="size-[18px]" />} label="Pedido promedio" value={data.count ? formatCOP(data.avg) : '—'} color={store.brandColor} />
        <button onClick={() => goTab('pedidos')} className={`${card} text-left transition active:scale-[0.99] ${data.pending ? 'border-amber-300 bg-amber-50' : ''}`}>
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink-soft">
            <ClipboardPlus className="size-[18px]" /> Por confirmar
          </p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight">{data.pending}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold text-brand">
            Ver pedidos <ArrowRight className="size-3.5" />
          </p>
        </button>
      </div>

      {/* gráfico */}
      <section className={card} aria-label="Ventas por día">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-extrabold">Ventas por día</p>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-ink-soft">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm" style={{ background: store.brandColor }} /> Pedidos de la app
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-teal" /> Registrados
            </span>
          </div>
        </div>
        <div className="mt-4 flex h-36 items-end gap-1" role="group" aria-label="Barras de ventas por día">
          {data.buckets.map((b, i) => {
            const total = b.online + b.manual
            const h = (total / data.max) * 100
            const isToday = i === data.buckets.length - 1
            return (
              <button
                key={b.t}
                onClick={() => setPick(pick === i ? null : i)}
                className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                aria-label={`${fullDate(b.t)}: ${formatCOP(total)}, ${b.count} ${b.count === 1 ? 'pedido' : 'pedidos'}`}
                aria-pressed={pick === i}
              >
                <div className={`flex w-full flex-col justify-end overflow-hidden rounded-t-md transition ${pick === i ? 'opacity-100 ring-2 ring-ink/30' : 'opacity-90 group-hover:opacity-100'}`} style={{ height: `${Math.max(total ? 4 : 1.5, h)}%`, background: total ? undefined : 'rgb(0 0 0 / 0.08)' }}>
                  {b.manual > 0 && <span className="block w-full bg-teal" style={{ height: `${(b.manual / total) * 100}%` }} />}
                  {b.online > 0 && <span className="block w-full" style={{ height: `${(b.online / total) * 100}%`, background: store.brandColor }} />}
                </div>
                <span className={`mt-1 truncate text-center text-[10px] font-semibold ${isToday ? 'text-ink' : 'text-ink-soft'}`}>
                  {days === 7 ? WEEKDAY[new Date(b.t).getDay()] : i % 5 === 0 || isToday ? new Date(b.t).getDate() : ''}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 min-h-5 text-center text-[12.5px] font-semibold text-ink-soft" aria-live="polite">
          {picked ? (
            <>
              <span className="capitalize">{fullDate(picked.t)}</span> · <b className="text-ink">{formatCOP(picked.online + picked.manual)}</b> · {picked.count} {picked.count === 1 ? 'pedido' : 'pedidos'}
            </>
          ) : data.count ? (
            'Toca una barra para ver el detalle del día.'
          ) : (
            'Aún no hay ventas en este periodo.'
          )}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* más vendidos */}
        <section className={card} aria-label="Lo más vendido">
          <p className="text-sm font-extrabold">Lo más vendido</p>
          {!data.top.length ? (
            <p className="mt-2 text-[13px] text-ink-soft">Cuando haya ventas verás aquí qué se mueve más.</p>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {data.top.map((t, i) => (
                <li key={t.name}>
                  <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                    <span className="min-w-0 truncate font-bold">
                      <span className="mr-1.5 text-ink-soft">{i + 1}.</span>
                      {t.name}
                    </span>
                    <span className="shrink-0 text-ink-soft">
                      {t.qty} {t.qty === 1 ? 'unidad' : 'unidades'} · <b className="text-ink">{formatCOP(t.revenue)}</b>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                    <div className="h-full rounded-full" style={{ width: `${(t.qty / data.top[0].qty) * 100}%`, background: store.brandColor }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* origen de las ventas + inventario bajo */}
        <div className="space-y-4">
          <section className={card} aria-label="De dónde vienen las ventas">
            <p className="text-sm font-extrabold">De dónde vienen</p>
            {!data.count ? (
              <p className="mt-2 text-[13px] text-ink-soft">Aún no hay ventas en este periodo.</p>
            ) : (
              <>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-ink/[0.07]">
                  <span style={{ width: `${(data.online.length / data.count) * 100}%`, background: store.brandColor }} />
                  <span className="bg-teal" style={{ width: `${(data.manual.length / data.count) * 100}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
                  <p>
                    <span className="font-bold">App de MallPlay</span>
                    <br />
                    <span className="text-ink-soft">{data.online.length} pedidos · {formatCOP(data.online.reduce((a, x) => a + x.sub.subtotal, 0))}</span>
                  </p>
                  <p>
                    <span className="font-bold">Registrados por ti</span>
                    <br />
                    <span className="text-ink-soft">{data.manual.length} pedidos · {formatCOP(data.manual.reduce((a, x) => a + x.sub.subtotal, 0))}</span>
                  </p>
                </div>
              </>
            )}
          </section>
          {low.length > 0 && (
            <section className={`${card} border-amber-300 bg-amber-50`} aria-label="Inventario bajo">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-amber-900">
                <AlertTriangle className="size-4" /> Se está agotando
              </p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {low.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    <span className="shrink-0 font-bold text-amber-900">{totalStock(p) === 0 ? 'Agotado' : `${totalStock(p)} ${totalStock(p) === 1 ? 'unidad' : 'unidades'}`}</span>
                  </li>
                ))}
              </ul>
              <button className="mt-2 text-[12.5px] font-bold text-brand underline-offset-2 hover:underline" onClick={() => goTab('articulos')}>
                Reponer inventario
              </button>
            </section>
          )}
        </div>
      </div>

      {/* últimos pedidos */}
      <section className={card} aria-label="Últimos pedidos">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold">Últimos pedidos</p>
          {data.total > 0 && (
            <button className="text-[12.5px] font-bold text-brand underline-offset-2 hover:underline" onClick={() => goTab('pedidos')}>
              Ver todos
            </button>
          )}
        </div>
        {!sales.length ? (
          <div className="mt-3 rounded-2xl bg-sand p-4 text-center">
            <Package className="mx-auto size-6 text-ink-soft" />
            <p className="mt-1.5 text-sm font-bold">Todavía no hay pedidos</p>
            <p className="text-[13px] text-ink-soft">Registra el primero cuando salga algo de tu inventario, o espera los pedidos de la app.</p>
            <button className={`${btn.primary} mt-3`} onClick={() => setRegistering(true)}>
              <ClipboardPlus className="size-4" /> Registrar mi primer pedido
            </button>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {sales.slice(0, 6).map(({ order, sub }) => (
              <li key={sub.id} className="flex items-center gap-3 py-2.5">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white ${sub.manual ? 'bg-teal' : ''}`} style={sub.manual ? undefined : { background: store.brandColor }}>
                  {order.customer.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{order.customer.name}</span>
                  <span className="block truncate text-[12px] text-ink-soft">
                    {formatDateTime(order.createdAt)} · {sub.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}
                  </span>
                </span>
                <span className="text-right">
                  <span className={`block text-[14px] font-extrabold ${sub.status === 'cancelled' ? 'text-ink-soft line-through' : ''}`}>{formatCOP(sub.subtotal)}</span>
                  <span className="block text-[10.5px] font-bold text-ink-soft">{sub.status === 'cancelled' ? 'Cancelado' : sub.manual ? 'Registrado' : PENDING.includes(sub.status) ? 'Por confirmar' : 'App'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Kpi({ icon, label, value, delta, color }: { icon: React.ReactNode; label: string; value: string; delta?: number | null; color: string }) {
  return (
    <div className={card}>
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink-soft">
        <span style={{ color }}>{icon}</span> {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
      <p className={`mt-0.5 flex min-h-4 items-center gap-1 text-[12px] font-bold ${delta == null ? 'text-ink-soft' : delta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
        {delta == null ? (
          <span className="font-semibold">&nbsp;</span>
        ) : (
          <>
            {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {delta >= 0 ? '+' : ''}
            {delta}% vs. antes
          </>
        )}
      </p>
    </div>
  )
}

interface Line {
  key: string
  product: Product
  variantId: string | null
  size: string | null
  qty: number
}

const CHANNELS = ['En el local', 'Por WhatsApp', 'Domicilio', 'Otro'] as const

/** Registrar un pedido a mano: sale del inventario, queda a nombre de la persona y alimenta el resumen. */
function RegisterOrder({ store, onDone }: { store: Store; onDone: () => void }) {
  const products = useCatalog((s) => s.products)
  const addManual = useOrders((s) => s.addManual)
  const { priceOf } = usePricing()
  const toast = useUI((s) => s.toast)
  const service = isService(store)
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('En el local')
  const [note, setNote] = useState('')
  const [q, setQ] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [opts, setOpts] = useState<Record<string, { v: string; s: string }>>({})
  const mine = useMemo(() => products.filter((p) => p.storeId === store.id && p.active), [products, store.id])
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return n ? mine.filter((p) => p.name.toLowerCase().includes(n)) : mine
  }, [mine, q])
  const total = lines.reduce((a, l) => a + priceOf(l.product).final * l.qty, 0)
  const cap = (l: { product: Product; variantId: string | null; size: string | null }) => (service ? 99 : stockFor(l.product, l.variantId, l.size))

  const add = (product: Product) => {
    const o = opts[product.id]
    const variantId = product.variants.length ? (o?.v ?? null) : null
    const size = product.sizes.length ? (o?.s ?? null) : null
    if ((product.variants.length && !variantId) || (product.sizes.length && !size)) return toast('Elige primero las opciones del artículo.', 'error')
    const key = `${product.id}|${variantId ?? '_'}|${size ?? '_'}`
    const max = cap({ product, variantId, size })
    const have = lines.find((l) => l.key === key)?.qty ?? 0
    if (have >= max) return toast(max === 0 ? 'Ese artículo está agotado.' : `Solo quedan ${max} en inventario.`, 'error')
    setLines((ls) => (ls.some((l) => l.key === key) ? ls.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { key, product, variantId, size, qty: 1 }]))
  }
  const setQty = (key: string, qty: number) =>
    setLines((ls) => ls.flatMap((l) => (l.key !== key ? [l] : qty <= 0 ? [] : [{ ...l, qty: Math.min(qty, cap(l)) }])))

  const valid = name.trim().length > 1 && lines.length > 0

  const save = () => {
    if (!valid) return
    const now = new Date().toISOString()
    const orderLines: OrderLine[] = lines.map((l) => {
      const info = priceOf(l.product)
      return {
        productId: l.product.id,
        name: l.product.name,
        variantId: l.variantId,
        variantName: l.product.variants.find((v) => v.id === l.variantId)?.name ?? null,
        size: l.size,
        qty: l.qty,
        originalUnitPrice: info.original,
        unitPrice: info.final,
        promotionId: info.promotion?.id ?? null,
        promoCode: info.promotion?.code ?? null,
        lineTotal: info.final * l.qty,
      }
    })
    const id = uniqueId('REG')
    const customer: Customer = { name: name.trim(), whatsapp: whatsapp.trim() }
    const order: Order = {
      id,
      createdAt: now,
      customer,
      delivery: { mode: channel === 'Domicilio' ? 'delivery' : 'pickup', address: channel === 'Domicilio' ? 'Registrado a mano' : null },
      notes: `Registrado a mano · ${channel}${note.trim() ? ` · ${note.trim()}` : ''}`,
      subOrders: [
        {
          id: `${id}-A`,
          orderId: id,
          storeId: store.id,
          storeName: store.name,
          lines: orderLines,
          subtotal: orderLines.reduce((a, l) => a + l.lineTotal, 0),
          status: 'delivered',
          history: [{ status: 'delivered', at: now }],
          stockCommitted: !service,
          manual: true,
        },
      ],
      estimatedTotal: orderLines.reduce((a, l) => a + l.lineTotal, 0),
      payment: 'not_charged',
    }
    addManual(order, !service)
    toast(`Pedido de ${customer.name} registrado · ${formatCOP(order.estimatedTotal)}${service ? '' : '. Salió del inventario.'}`, 'success')
    onDone()
  }

  return (
    <div className="space-y-4">
      <button onClick={onDone} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand">
        <ArrowLeft className="size-4" /> Volver al resumen
      </button>
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">Registrar pedido</h2>
        <p className="text-[13px] text-ink-soft">{service ? 'Anota el servicio que prestaste y a quién.' : 'Anota lo que salió: se descuenta del inventario y queda en tu resumen de ventas.'}</p>
      </div>

      <section className={`${card} space-y-3`}>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nombre de la persona</span>
          <input className={input} value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Ej. María Pérez" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">WhatsApp (opcional)</span>
            <input className={input} inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="300 123 4567" />
          </label>
          <div>
            <span className="mb-1 block text-sm font-semibold">¿Cómo salió?</span>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => (
                <button key={c} type="button" onClick={() => setChannel(c)} aria-pressed={channel === c} className={`rounded-full border px-3 py-2 text-[13px] font-bold transition ${channel === c ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${card} space-y-3`}>
        <p className="text-sm font-extrabold">{service ? 'Servicios' : 'Productos que salieron'}</p>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <Search className="size-4 text-ink-soft" />
          <input className="h-11 w-full bg-transparent text-[15px] outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar producto" />
        </label>
        {!mine.length && <p className="rounded-2xl bg-sand p-3 text-sm text-ink-soft">Primero agrega artículos a tu catálogo para poder registrar pedidos.</p>}
        <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
          {shown.map((p) => {
            const stock = totalStock(p)
            const out = !service && stock === 0
            const o = opts[p.id]
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-2.5 p-2.5">
                <ProductImage product={p} brandColor={store.brandColor} className="size-12 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">{p.name}</p>
                  <p className="text-[12px] text-ink-soft">
                    {formatCOP(priceOf(p).final)}
                    {!service && <> · {out ? 'Agotado' : `${stock} en inventario`}</>}
                  </p>
                </div>
                {needsOptions(p) && !out && (
                  <div className="flex gap-1.5">
                    {p.variants.length > 0 && (
                      <select className="rounded-lg border border-line bg-white px-2 py-1.5 text-[13px]" value={o?.v ?? ''} onChange={(e) => setOpts((x) => ({ ...x, [p.id]: { v: e.target.value, s: x[p.id]?.s ?? '' } }))} aria-label={`Opción de ${p.name}`}>
                        <option value="">Opción</option>
                        {p.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {p.sizes.length > 0 && (
                      <select className="rounded-lg border border-line bg-white px-2 py-1.5 text-[13px]" value={o?.s ?? ''} onChange={(e) => setOpts((x) => ({ ...x, [p.id]: { v: x[p.id]?.v ?? '', s: e.target.value } }))} aria-label={`Talla de ${p.name}`}>
                        <option value="">Talla</option>
                        {p.sizes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <button onClick={() => add(p)} disabled={out} className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-white shadow-soft transition active:scale-90 disabled:opacity-35" aria-label={`Agregar ${p.name}`}>
                  <Plus className="size-5" />
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {lines.length > 0 && (
        <section className={`${card} space-y-2.5`} aria-label="Pedido">
          <p className="text-sm font-extrabold">El pedido</p>
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">{l.product.name}</p>
                  <p className="text-[12px] text-ink-soft">
                    {[l.variantId && l.product.variants.find((v) => v.id === l.variantId)?.name, l.size && `talla ${l.size}`].filter(Boolean).join(' · ') || formatCOP(priceOf(l.product).final)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button className="grid size-8 place-items-center rounded-full border border-line" onClick={() => setQty(l.key, l.qty - 1)} aria-label="Quitar una unidad">
                    {l.qty === 1 ? <Trash2 className="size-3.5 text-red-600" /> : <Minus className="size-3.5" />}
                  </button>
                  <span className="w-7 text-center text-[14px] font-extrabold">{l.qty}</span>
                  <button className="grid size-8 place-items-center rounded-full border border-line disabled:opacity-30" disabled={l.qty >= cap(l)} onClick={() => setQty(l.key, l.qty + 1)} aria-label="Agregar una unidad">
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <span className="w-24 text-right text-[14px] font-extrabold">{formatCOP(priceOf(l.product).final * l.qty)}</span>
              </li>
            ))}
          </ul>
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold">Nota (opcional)</span>
            <input className={input} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Pagó en efectivo" />
          </label>
          <div className="flex items-center justify-between border-t border-line pt-2.5">
            <span className="text-sm font-semibold text-ink-soft">Total</span>
            <span className="text-2xl font-extrabold">{formatCOP(total)}</span>
          </div>
        </section>
      )}

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-10 flex gap-2 md:bottom-4">
        <button className={`${btn.secondary} bg-white`} onClick={onDone}>
          <X className="size-4" /> Cancelar
        </button>
        <button className={`${btn.primary} flex-1`} disabled={!valid} onClick={save}>
          <ClipboardPlus className="size-[18px]" /> Registrar pedido{lines.length ? ` · ${formatCOP(total)}` : ''}
        </button>
      </div>
    </div>
  )
}
