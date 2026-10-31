import { Gem, MapPin, Pause, Play, Plus, RotateCcw, Tag, Trash2, X, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SPACE_BY_ID } from '../config/mall'
import type { HideSpot, Promotion, PromotionType, Store } from '../domain/types'
import { appClock } from '../lib/clock'
import { formatCOP, formatDateTime } from '../lib/format'
import { discounted, isPromotionLive } from '../lib/pricing'
import { useNow } from '../lib/useNow'
import { MAX_DISCOUNT, MIN_DISCOUNT, PROMO_TYPE_NAME, buildPromotion, validatePromotion } from '../promotions/build'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useUI } from '../state/ui'
import { Countdown, EmptyState, btn, input } from '../ui/bits'
import { describeHideSpot } from '../promotions/hideSpot'
import { HideSpotPicker } from './HideSpotPicker'

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

export function MerchantPromotions({ store }: { store: Store }) {
  const promotions = useCatalog((s) => s.promotions)
  const mine = useMemo(() => promotions.filter((p) => p.storeId === store.id), [promotions, store.id])
  const [creating, setCreating] = useState(false)
  const now = useNow()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">
          {mine.filter((p) => isPromotionLive(p, now)).length} activas · {mine.length} en total
        </p>
        {!creating && (
          <button className={btn.primary} onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Nueva promoción
          </button>
        )}
      </div>
      {creating && <PromotionForm store={store} onDone={() => setCreating(false)} />}
      {!mine.length && !creating && (
        <EmptyState icon={<Zap className="size-6" />} title="Aún no tienes promociones">
          Lanza una oferta relámpago: tu local se ilumina en el mall y los visitantes se acercan a tu vitrina.
        </EmptyState>
      )}
      <ul className="space-y-2">
        {[...mine]
          .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
          .map((p) => (
            <PromotionRow key={p.id} promo={p} store={store} now={now} />
          ))}
      </ul>
    </div>
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

function PromotionForm({ store, onDone }: { store: Store; onDone: () => void }) {
  const products = useCatalog((s) => s.products)
  const promotions = useCatalog((s) => s.promotions)
  const upsert = useCatalog((s) => s.upsertPromotion)
  const toast = useUI((s) => s.toast)
  const showInMall = useShowInMall(store)
  const { spaceByStore } = useCatalogMaps()
  const mine = useMemo(() => products.filter((p) => p.storeId === store.id && p.active), [products, store.id])
  const [type, setType] = useState<PromotionType>('flash')
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
        Primero agrega un artículo visible en la pestaña Artículos: la promoción se aplica sobre uno de tus productos.
        <button className={`${btn.ghost} ml-1`} onClick={onDone}>
          Cerrar
        </button>
      </div>
    )

  return (
    <div className="space-y-4 rounded-3xl border border-line bg-card p-4 ring-2 ring-brand/15">
      <div className="flex items-center justify-between">
        <p className="text-lg font-extrabold">Nueva promoción</p>
        <button className={btn.ghost} onClick={onDone} aria-label="Cerrar">
          <X className="size-5" />
        </button>
      </div>
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
