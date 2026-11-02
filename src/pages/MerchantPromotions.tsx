import { Clock, Gem, Heart, MapPin, Pause, Play, RotateCcw, Ship, Sparkles, Stamp, Star, Tag, Trash2, Users, X, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SPACE_BY_ID } from '../config/mall'
import type { HideSpot, Promotion, PromotionType, Store } from '../domain/types'
import { appClock } from '../lib/clock'
import { formatCOP, formatDateTime } from '../lib/format'
import { discounted, isPromotionLive } from '../lib/pricing'
import { useNow } from '../lib/useNow'
import { MAX_DISCOUNT, MIN_DISCOUNT, PROMO_TYPE_NAME, buildPromotion, validatePromotion } from '../promotions/build'
import { catalogWords } from '../lib/restaurant'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useUI } from '../state/ui'
import { MAX_LOYALTY_STAMPS, MIN_LOYALTY_STAMPS, loyaltyOf } from '../state/passport'
import { Countdown, btn, input } from '../ui/bits'
import { describeHideSpot } from '../promotions/hideSpot'
import { HideSpotPicker } from './HideSpotPicker'
import { MerchantShipEditor } from '../ship/MerchantShipEditor'
import { isShipPromotion, useDiscountShip } from '../ship/offers'

// Promociones del comerciante: las crea, pausa, relanza y borra para su propia tienda. Una oferta
// relámpago nueva se presenta en el mall (local iluminado, cartel grande y visitantes que acuden).

const DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: '15 minutos' },
  { minutes: 30, label: '30 minutos' },
  { minutes: 60, label: '1 hora' },
  { minutes: 180, label: '3 horas' },
  { minutes: 360, label: '6 horas' },
  { minutes: 1440, label: '1 día' },
  { minutes: 4320, label: '3 días' },
]

const TYPE_HELP: Record<PromotionType, string> = {
  flash: 'Con contador. Al lanzarla, tu local se ilumina en el mall y los visitantes se acercan.',
  normal: 'Descuento en tu tienda, sin vencimiento hasta que la pauses.',
  secret: 'No se muestra: la escondes donde quieras del mall y se revela cuando alguien la encuentra.',
}

const TYPE_ICON = { flash: Zap, normal: Tag, secret: Gem } as const

type Mode = PromotionType | 'ship' | 'loyalty'
type Goal = 'sell' | 'visits' | 'loyalty'

const GOALS: { id: Goal; name: string; icon: typeof Zap }[] = [
  { id: 'sell', name: 'Vender hoy', icon: Zap },
  { id: 'visits', name: 'Atraer visitas', icon: Users },
  { id: 'loyalty', name: 'Fidelizar clientes', icon: Heart },
]

const CATALOG: { mode: Mode; goal: Goal; name: string; tag: string; help: string; meta: string; how: string; icon: typeof Zap; recommended?: boolean }[] = [
  {
    mode: 'flash', goal: 'sell', name: 'Oferta relámpago', tag: 'Vender hoy', icon: Zap, recommended: true,
    help: 'Crea urgencia y destaca tu local durante unas horas.', meta: '2 min · Dura 2 h',
    how: 'Eliges un artículo y un descuento. Mientras dura, tu local se ilumina en el mall y la oferta aparece con contador. Al terminar se apaga sola.',
  },
  {
    mode: 'normal', goal: 'sell', name: 'Descuento en producto', tag: 'Mover inventario', icon: Tag,
    help: 'Reduce el precio de un artículo y mantenlo activo.', meta: '1 min · Sin vencimiento',
    how: 'Rebajas el precio de un artículo. Se ve tachado en tu ficha y en Comprar hasta que lo pauses.',
  },
  {
    mode: 'secret', goal: 'visits', name: 'Promoción escondida', tag: 'Atraer visitas', icon: Gem,
    help: 'Premia a quien explore y encuentre tu oferta.', meta: '3 min · Se ve en el mall',
    how: 'Escondes la oferta en el mall (junto a tu local o donde quieras) con un código. Quien la encuentre la desbloquea.',
  },
  {
    mode: 'ship', goal: 'visits', name: 'Barco de descuentos', tag: 'Máxima visibilidad', icon: Ship,
    help: 'Aparece en el muelle y avisa a los visitantes.', meta: '3 min · Notificación incluida',
    how: 'Subes un descuento al barco que llega al muelle viernes y sábados. Los visitantes reciben el aviso y ven tu oferta a bordo.',
  },
  {
    mode: 'loyalty', goal: 'loyalty', name: 'Tarjeta de sellos', tag: 'Fidelizar', icon: Stamp,
    help: 'Premia compras recurrentes con un beneficio final.', meta: '4 min · Clientes recurrentes',
    how: 'Cada compra da un sello al cliente; al juntar los sellos canjea tu premio con un código. Tú defines cuántos y cuál.',
  },
]

export function MerchantPromotions({ store }: { store: Store }) {
  const promotions = useCatalog((s) => s.promotions)
  const mine = useMemo(() => promotions.filter((p) => p.storeId === store.id && !isShipPromotion(p)), [promotions, store.id])
  const shipOn = useDiscountShip((s) => s.offers.some((o) => o.storeId === store.id && !o.demo))
  const [goal, setGoal] = useState<Goal | 'all'>('sell')
  const [open, setOpen] = useState<Mode | null>(null)
  const [how, setHow] = useState<Mode | null>(null)
  const now = useNow()
  const liveOf = (t: PromotionType) => mine.filter((p) => p.type === t && isPromotionLive(p, now)).length
  const isOn = (m: Mode) => (m === 'ship' ? shipOn : m === 'loyalty' ? loyaltyOf(store).active : liveOf(m) > 0)
  const activeCount = CATALOG.filter((c) => isOn(c.mode)).length
  const shownCards = CATALOG.filter((c) => goal === 'all' || c.goal === goal)

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2.5">
          <p className="text-2xl font-extrabold tracking-tight">Promociones</p>
          <span className="rounded-full bg-ink/[0.07] px-3 py-1 text-xs font-bold text-ink-soft">{activeCount} {activeCount === 1 ? 'activa' : 'activas'}</span>
        </div>
        <p className="text-sm text-ink-soft">¿Qué quieres conseguir hoy? Elige una promoción según tu objetivo.</p>
      </div>

      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1" role="tablist" aria-label="Objetivo de la promoción">
        {[{ id: 'all' as const, name: 'Todas', icon: Sparkles }, ...GOALS].map((g) => {
          const Icon = g.icon
          const sel = goal === g.id
          return (
            <button
              key={g.id}
              role="tab"
              aria-selected={sel}
              onClick={() => setGoal(g.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition active:scale-[0.98] ${sel ? 'border-brand bg-brand text-white' : 'border-line bg-card text-ink hover:bg-sand'}`}
            >
              <Icon className="size-4" /> {g.name}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-ink-soft">Puedes configurarla ahora y activarla después de revisarla.</p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {shownCards.map((c) => {
          const on = isOn(c.mode)
          const Icon = c.icon
          const selected = open === c.mode
          return (
            <li key={c.mode} className={`flex flex-col gap-2 rounded-3xl border bg-card p-4 ${selected || (c.recommended && goal === 'sell' && !open) ? 'border-brand ring-2 ring-brand/15' : 'border-line'}`}>
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand" aria-hidden>
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[17px] leading-tight font-extrabold">{c.name}</p>
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">{c.tag}</span>
                    {on && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Activa</span>}
                  </div>
                  {c.recommended && !on && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
                      <Star className="size-3" /> Recomendada para hoy
                    </span>
                  )}
                  <p className="mt-1 text-sm leading-snug text-ink-soft">{c.help}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
                    <Clock className="size-3.5" /> {c.meta}
                  </p>
                </div>
              </div>
              {how === c.mode && <p className="rounded-2xl bg-sand p-3 text-xs leading-relaxed text-ink-soft">{c.how}</p>}
              <div className="mt-auto flex items-center justify-between gap-2">
                <button className="text-sm font-semibold text-brand underline underline-offset-2" onClick={() => setHow(how === c.mode ? null : c.mode)}>
                  {how === c.mode ? 'Ocultar' : 'Ver cómo funciona'}
                </button>
                <button className={`${btn.primary} min-w-32`} onClick={() => setOpen(selected ? null : c.mode)}>
                  {selected ? 'Cerrar' : 'Configurar'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {open === 'ship' && <MerchantShipEditor key={`b${store.id}`} store={store} />}
      {open === 'loyalty' && <LoyaltyEditor key={store.id} store={store} />}
      {open && open !== 'ship' && open !== 'loyalty' && <PromotionForm key={open} store={store} initialType={open} onDone={() => setOpen(null)} />}

      {mine.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-ink-soft">
            {mine.filter((p) => isPromotionLive(p, now)).length} activas · {mine.length} en total
          </p>
          <ul className="space-y-2">
            {[...mine]
              .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
              .map((p) => (
                <PromotionRow key={p.id} promo={p} store={store} now={now} />
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Tarjeta de sellos de la tienda: cuántas compras pide y qué premio da al llenarla. */
function LoyaltyEditor({ store }: { store: Store }) {
  const upsertStore = useCatalog((s) => s.upsertStore)
  const toast = useUI((s) => s.toast)
  const current = loyaltyOf(store)
  const [stamps, setStamps] = useState(current.stamps)
  const [reward, setReward] = useState(current.reward)
  const dirty = stamps !== current.stamps || reward.trim() !== current.reward
  const save = (patch: Partial<typeof current>) => upsertStore({ ...store, loyalty: { ...current, ...patch } })
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal" aria-hidden>
          <Stamp className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Tarjeta de sellos</p>
          <p className="text-xs text-ink-soft">Cada compra en tu tienda le da un sello al cliente en su pasaporte. Al llenarla canjea tu premio con un código.</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-bold">
          <input type="checkbox" className="size-4 accent-brand" checked={current.active} onChange={(e) => save({ active: e.target.checked })} />
          {current.active ? 'Activa' : 'Apagada'}
        </label>
      </div>
      {current.active && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Sellos para el premio</span>
            <select className={input} value={stamps} onChange={(e) => setStamps(Number(e.target.value))}>
              {Array.from({ length: MAX_LOYALTY_STAMPS - MIN_LOYALTY_STAMPS + 1 }, (_, i) => MIN_LOYALTY_STAMPS + i).map((n) => (
                <option key={n} value={n}>
                  {n} compras
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Premio</span>
            <input className={input} value={reward} maxLength={70} onChange={(e) => setReward(e.target.value)} placeholder="Un café gratis, 15 % de descuento…" />
          </label>
          <button
            className={btn.primary}
            disabled={!dirty || reward.trim().length < 3}
            onClick={() => {
              save({ stamps, reward: reward.trim() })
              toast('Tarjeta de sellos actualizada.', 'success')
            }}
          >
            Guardar
          </button>
        </div>
      )}
    </section>
  )
}

function PromotionRow({ promo, store, now }: { promo: Promotion; store: Store; now: number }) {
  const { productById } = useCatalogMaps()
  const setActive = useCatalog((s) => s.setPromotionActive)
  const restart = useCatalog((s) => s.restartPromotionWindow)
  const remove = useCatalog((s) => s.deletePromotion)
  const toast = useUI((s) => s.toast)
  const showInMall = useShowInMall(store)
  const [armed, setArmed] = useState(false)
  const [moving, setMoving] = useState(false)
  const upsert = useCatalog((s) => s.upsertPromotion)
  const product = productById[promo.productId]
  const live = isPromotionLive(promo, now)
  const expired = !!promo.endsAt && Date.parse(promo.endsAt) <= now
  const status = live ? 'Activa' : expired ? 'Vencida' : promo.active ? 'Programada' : 'Pausada'
  const Icon = TYPE_ICON[promo.type]
  return (
    <li className="rounded-2xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${promo.type === 'flash' ? 'bg-sun/30' : promo.type === 'secret' ? 'bg-ink text-sun' : 'bg-coral/15 text-coral'}`}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-bold">
            {promo.title} <span className="whitespace-nowrap">· −{promo.discountPercent}%</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {PROMO_TYPE_NAME[promo.type]} · {product?.name ?? 'Artículo eliminado'}
            {product && (
              <>
                {' '}
                · {formatCOP(discounted(product.price, promo.discountPercent))} <span className="line-through">{formatCOP(product.price)}</span>
              </>
            )}
            {promo.code && <span className="font-mono"> · código {promo.code}</span>}
          </p>
          {promo.type === 'secret' && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
              <Gem className="size-3 text-amber" /> {promo.hideAt ? describeHideSpot(promo.hideAt) : 'Junto a tu local'}
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-bold ${live ? 'bg-emerald-100 text-emerald-800' : 'bg-sand-2 text-ink-soft'}`}>{status}</span>
            {live && promo.endsAt && (
              <span className="flex items-center gap-1 text-ink-soft">
                termina en <Countdown endsAt={promo.endsAt} />
              </span>
            )}
            {!live && promo.endsAt && <span className="text-ink-soft">hasta {formatDateTime(promo.endsAt)}</span>}
          </p>
        </div>
      </div>
      {moving && (
        <div className="mt-3 rounded-2xl bg-sand p-3">
          <HideSpotPicker
            storeId={store.id}
            value={promo.hideAt ?? null}
            onChange={(spot) => upsert({ ...promo, hideAt: spot ?? undefined })}
          />
          <div className="mt-2 flex justify-end">
            <button className={btn.secondary} onClick={() => setMoving(false)}>
              Listo
            </button>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
        {promo.type === 'secret' && !moving && (
          <button className={btn.ghost} onClick={() => setMoving(true)}>
            <MapPin className="size-4 text-brand" /> Cambiar escondite
          </button>
        )}
        {live && promo.type === 'flash' && (
          <button className={btn.ghost} onClick={showInMall}>
            <MapPin className="size-4 text-brand" /> Ver en el mall
          </button>
        )}
        {promo.type !== 'normal' && (
          <button
            className={btn.ghost}
            onClick={() => {
              restart(promo.id)
              toast(promo.type === 'flash' ? 'Oferta relanzada: se presenta de nuevo en el mall.' : 'Oferta relanzada desde ahora.', 'success')
            }}
            title={`Abre una nueva ventana de ${Math.round((promo.durationHours ?? 6) * 60)} minutos desde ahora`}
          >
            <RotateCcw className="size-4" /> Relanzar
          </button>
        )}
        {!expired && (
          <button className={btn.ghost} onClick={() => setActive(promo.id, !promo.active)}>
            {promo.active ? <Pause className="size-4" /> : <Play className="size-4" />} {promo.active ? 'Pausar' : 'Reanudar'}
          </button>
        )}
        <button
          className={`${btn.ghost} text-red-600 hover:text-red-700 ${armed ? 'bg-red-50' : ''}`}
          onClick={() => (armed ? remove(promo.id) : setArmed(true))}
          onBlur={() => setArmed(false)}
          aria-label={armed ? `Confirmar: eliminar ${promo.title}` : `Eliminar ${promo.title}`}
        >
          <Trash2 className="size-4" /> {armed ? '¿Seguro?' : 'Eliminar'}
        </button>
      </div>
    </li>
  )
}

function PromotionForm({ store, onDone, initialType }: { store: Store; onDone: () => void; initialType?: PromotionType }) {
  const products = useCatalog((s) => s.products)
  const promotions = useCatalog((s) => s.promotions)
  const upsert = useCatalog((s) => s.upsertPromotion)
  const toast = useUI((s) => s.toast)
  const showInMall = useShowInMall(store)
  const { spaceByStore } = useCatalogMaps()
  const mine = useMemo(() => products.filter((p) => p.storeId === store.id && p.active), [products, store.id])
  const [type, setType] = useState<PromotionType>(initialType ?? 'flash')
  const [productId, setProductId] = useState(mine[0]?.id ?? '')
  const [discount, setDiscount] = useState('20')
  const [minutes, setMinutes] = useState(30)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [hideAt, setHideAt] = useState<HideSpot | null>(null)
  const product = mine.find((p) => p.id === productId)
  const draft = {
    type,
    storeId: store.id,
    productId: product?.id ?? '',
    productName: product?.name ?? '',
    discountPercent: Number(discount),
    title,
    minutes: type === 'normal' ? 0 : minutes,
    code,
    hideAt,
  }
  const placed = !!spaceByStore[store.id]
  const error = validatePromotion(draft) ?? (type === 'secret' && !hideAt && !placed ? 'Elige en el mapa dónde esconderla.' : null)

  if (!mine.length)
    return (
      <div className="rounded-3xl border border-dashed border-line bg-card p-4 text-sm text-ink-soft">
        Primero agrega un {catalogWords(store).one} visible en la pestaña {catalogWords(store).tab}: la promoción se aplica sobre uno de ellos.
        <button className={`${btn.ghost} ml-1`} onClick={onDone}>
          Cerrar
        </button>
      </div>
    )

  return (
    <div className="space-y-4 rounded-3xl border border-line bg-card p-4 ring-2 ring-brand/15">
      <div className="flex items-center justify-between">
        <p className="text-lg font-extrabold">{initialType ? PROMO_TYPE_NAME[initialType] : 'Nueva promoción'}</p>
        <button className={btn.ghost} onClick={onDone} aria-label="Cerrar">
          <X className="size-5" />
        </button>
      </div>
      {initialType ? (
        <p className="-mt-2 text-xs text-ink-soft">{TYPE_HELP[initialType]}</p>
      ) : (
      <fieldset>
        <legend className="mb-1 text-xs font-bold text-ink-soft">Tipo</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['flash', 'normal', 'secret'] as PromotionType[]).map((t) => {
            const Icon = TYPE_ICON[t]
            return (
              <label
                key={t}
                className={`flex cursor-pointer flex-col gap-1 rounded-2xl border p-3 text-sm transition ${type === t ? 'border-brand bg-brand/5' : 'border-line hover:bg-sand'}`}
              >
                <span className="flex items-center gap-2 font-bold">
                  <input type="radio" name="promo-type" className="accent-brand" checked={type === t} onChange={() => setType(t)} />
                  <Icon className="size-4" /> {PROMO_TYPE_NAME[t]}
                </span>
                <span className="text-[11px] leading-snug text-ink-soft">{TYPE_HELP[t]}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-soft">Artículo</span>
          <select className={input} value={product?.id ?? ''} onChange={(e) => setProductId(e.target.value)}>
            {mine.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatCOP(p.price)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-soft">
            Descuento (%) · entre {MIN_DISCOUNT} y {MAX_DISCOUNT}
          </span>
          <input className={input} inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          {product && !error && (
            <span className="mt-1 block text-[11px] text-ink-soft">
              Quedará en <b>{formatCOP(discounted(product.price, Number(discount)))}</b> (antes {formatCOP(product.price)})
            </span>
          )}
        </label>
        {type !== 'normal' && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Duración</span>
            <select className={input} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d.minutes} value={d.minutes}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-soft">Título (opcional)</span>
          <input className={input} value={title} maxLength={48} onChange={(e) => setTitle(e.target.value)} placeholder={`${PROMO_TYPE_NAME[type]}: ${product?.name ?? ''}`} />
        </label>
        {type === 'secret' && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Código secreto</span>
            <input className={input} value={code} maxLength={16} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="BAHIA20" />
          </label>
        )}
      </div>
      {type === 'secret' && <HideSpotPicker storeId={store.id} value={hideAt} onChange={setHideAt} />}
      {!placed && !(type === 'secret' && hideAt) && <p className="rounded-2xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">Tu tienda aún no tiene local en el mall: la oferta se verá en tu ficha y en Comprar, pero no en el mapa.</p>}
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className={btn.secondary} onClick={onDone}>
          Cancelar
        </button>
        <button
          className={btn.primary}
          disabled={!!error}
          onClick={() => {
            const promo = buildPromotion(draft, appClock.now(), new Set(promotions.map((p) => p.id)))
            upsert(promo)
            onDone()
            if (type === 'flash' && placed) {
              toast('¡Oferta relámpago lanzada! Tu local se ilumina en el mall.', 'success')
              showInMall()
            } else if (type === 'secret') toast(hideAt ? `Oferta escondida en ${describeHideSpot(hideAt)}. ¡A ver quién la encuentra!` : 'Oferta escondida junto a tu local.', 'success')
            else toast('Promoción creada y activa.', 'success')
          }}
        >
          {type === 'flash' ? 'Lanzar oferta' : 'Crear promoción'}
        </button>
      </div>
    </div>
  )
}

/** Lleva al mall, al piso de la tienda, con la cámara sobre el local (sin abrir su ficha). */
function useShowInMall(store: Store) {
  const navigate = useNavigate()
  const { spaceByStore } = useCatalogMaps()
  return () => {
    const sp = spaceByStore[store.id]
    if (!sp) return
    navigate('/')
    const ui = useUI.getState()
    ui.setFloor(SPACE_BY_ID[sp].floorId)
    ui.requestFocus({ kind: 'showcase', id: sp })
  }
}
