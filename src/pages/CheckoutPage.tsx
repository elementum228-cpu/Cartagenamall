import { Info, Store as StoreIcon, Truck } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { DeliveryMode } from '../domain/types'
import { formatCOP } from '../lib/format'
import { buildOrder, subOrderMessage } from '../services/orders'
import { openWhatsApp, whatsappLink } from '../lib/restaurant'
import { remoteEnabled } from '../remote/client'
import { useBuyer, useProfile } from '../remote/profile'
import { uniqueId } from '../lib/ids'
import { useCart } from '../state/cart'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useOrders } from '../state/orders'
import { usePersonal } from '../state/personal'
import { useUI } from '../state/ui'
import { StoreLogo, btn, input } from '../ui/bits'
import { useCartSummary } from './CartPage'

export function CheckoutPage() {
  const { groups, total, issues, items } = useCartSummary()
  const { productById, storeById } = useCatalogMaps()
  const promotions = useCatalog((s) => s.promotions)
  const saved = usePersonal((s) => s.savedSecrets)
  const nextNumber = useOrders((s) => s.nextNumber)
  const addOrder = useOrders((s) => s.add)
  const clearCart = useCart((s) => s.clear)
  const toast = useUI((s) => s.toast)
  const navigate = useNavigate()
  const { waiting, needLogin } = useBuyer()

  const profile = useProfile.getState()
  const [name, setName] = useState(profile.fullName)
  const [whatsapp, setWhatsapp] = useState(profile.phone)
  // si alguna tienda del pedido no tiene punto físico, solo se puede pedir a domicilio
  const pickupOk = groups.every((g) => !g.store?.deliveryOnly)
  const [pickedMode, setMode] = useState<DeliveryMode>('pickup')
  const mode: DeliveryMode = pickupOk ? pickedMode : 'delivery'
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (needLogin) return <Navigate to="/login?redirect=/checkout" replace />
  if (waiting) return <p className="p-6 text-sm text-ink-soft">Verificando tu cuenta…</p>
  if (!items.length && !submitting) return <Navigate to="/carrito" replace />

  const errors = {
    name: name.trim().length < 3 ? 'Escribe tu nombre.' : null,
    whatsapp: !/^3\d{9}$/.test(whatsapp.replace(/\D/g, '').replace(/^57/, '')) ? 'Celular colombiano de 10 dígitos (empieza por 3).' : null,
    address: mode === 'delivery' && address.trim().length < 8 ? 'Escribe la dirección completa (barrio, calle, número).' : null,
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const err = (k: keyof typeof errors) => (touched && errors[k] ? <p className="mt-1 text-xs font-semibold text-red-600">{errors[k]}</p> : null)

  const submit = () => {
    setTouched(true)
    if (hasErrors) return
    const result = buildOrder({
      orderNumber: nextNumber,
      orderId: remoteEnabled() ? uniqueId('ORD') : undefined,
      items,
      catalog: { products: productById, stores: storeById, promotions },
      customer: { name: name.trim(), whatsapp: whatsapp.trim() },
      delivery: { mode, address: mode === 'delivery' ? address.trim() : null },
      notes: notes.trim(),
      now: Date.now(),
      unlockedSecretIds: saved,
    })
    if (!result.ok) {
      toast(result.issues[0]?.message ?? 'Revisa tu carrito.', 'error')
      navigate('/carrito')
      return
    }
    setSubmitting(true)
    addOrder(result.order)
    clearCart()
    // El pedido le llega solo al WhatsApp del local. Primero se deja la pantalla del pedido como destino (a ella se vuelve desde WhatsApp)
    // y luego se abre WhatsApp. Con varias tiendas solo se abre la primera; las demás quedan con su botón en la pantalla del pedido.
    const first = result.order.subOrders[0]
    const wa = first && storeById[first.storeId]?.whatsapp
    const link = first && wa ? whatsappLink(wa, subOrderMessage(result.order, first, formatCOP, storeById[first.storeId])) : null
    navigate(`/pedidos/${result.order.id}?nuevo=1`, { replace: true, state: { waSent: link ? [first.id] : [] } })
    if (link) openWhatsApp(link)
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 pt-5 pb-32 md:grid-cols-[1fr_360px] md:pb-10">
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Enviar pedido</h1>
          <p className="text-sm text-ink-soft">Pedido de demostración. Cada tienda recibe solo sus productos.</p>
        </div>
        <section className="space-y-4 rounded-3xl border border-line bg-card p-5">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nombre</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            {err('name')}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">WhatsApp</span>
            <input className={input} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="300 123 4567" autoComplete="tel" />
            {err('whatsapp')}
          </label>
        </section>
        <section className="space-y-3 rounded-3xl border border-line bg-card p-5">
          <p className="text-sm font-semibold">Modalidad de entrega</p>
          <div className={`grid gap-2 ${pickupOk ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {(
              [
                ['pickup', 'Recoger en el local', StoreIcon],
                ['delivery', 'Domicilio', Truck],
              ] as const
            )
              .filter(([m]) => pickupOk || m === 'delivery')
              .map(([m, label, Icon]) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`flex items-center gap-2 rounded-2xl border p-3.5 text-left text-sm font-bold transition ${mode === m ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : 'border-line bg-white'}`}
              >
                <Icon className="size-5 text-brand" /> {label}
              </button>
            ))}
          </div>
          {!pickupOk && (
            <p className="rounded-2xl bg-sand p-3 text-xs font-semibold text-ink-soft">
              {groups.filter((g) => g.store?.deliveryOnly).map((g) => g.store.name).join(', ')} {groups.filter((g) => g.store?.deliveryOnly).length === 1 ? 'no tiene' : 'no tienen'} punto físico: este pedido es solo a domicilio.
            </p>
          )}
          {mode === 'delivery' && (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Dirección</span>
              <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Barrio, calle, número, referencia" autoComplete="street-address" />
              {err('address')}
              <span className="mt-1 block text-xs text-ink-soft">El costo del domicilio lo confirma cada tienda.</span>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Notas del pedido (opcional)</span>
            <textarea className={`${input} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: envolver para regalo" />
          </label>
        </section>
        <button type="submit" className={`${btn.primary} w-full max-md:hidden`} disabled={issues.length > 0}>
          Enviar solicitud de pedido
        </button>
      </form>

      <aside className="space-y-3 md:sticky md:top-[calc(var(--chrome-top)+8px)] md:self-start">
        <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
          <p className="text-sm font-bold">Tu pedido se dividirá en {groups.length} {groups.length === 1 ? 'suborden' : 'subórdenes'}</p>
          {groups.map((g, i) => (
            <div key={g.store?.id} className="flex items-center gap-3 rounded-2xl bg-sand/70 p-2.5">
              {g.store && <StoreLogo store={g.store} size={32} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  Suborden {String.fromCharCode(65 + i)} · {g.store?.name}
                </p>
                <p className="text-xs text-ink-soft">{g.lines.reduce((a, l) => a + l.it.qty, 0)} productos</p>
              </div>
              <span className="text-sm font-bold">{formatCOP(g.subtotal)}</span>
            </div>
          ))}
          <div className="flex items-end justify-between border-t border-line pt-3">
            <span className="font-bold">Total estimado</span>
            <span className="text-2xl font-extrabold">{formatCOP(total)}</span>
          </div>
          <p className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Esto no es un pago. Tu pedido quedará <b>pendiente de confirmación</b> de cada comerciante, que validará precio, inventario y entrega antes de cualquier cobro.
            </span>
          </p>
        </div>
        <button className={`${btn.primary} w-full md:hidden`} onClick={submit} disabled={issues.length > 0}>
          Enviar solicitud de pedido
        </button>
      </aside>
    </div>
  )
}
