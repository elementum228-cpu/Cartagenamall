import { Gem, Lock, MapPin, Sparkles, Zap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { FLOOR_BY_ID, FLOOR_OF_ZONE, ZONE_BY_ID } from '../config/mall'
import type { Promotion } from '../domain/types'
import { formatCOP } from '../lib/format'
import { discounted, isPromotionLive } from '../lib/pricing'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { usePersonal } from '../state/personal'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { Countdown, EmptyState, SectionTitle } from '../ui/bits'
import { ProductImage } from '../ui/ProductImage'

export function OffersPage() {
  const promotions = useCatalog((s) => s.promotions)
  const { now } = usePricing()
  const discovered = usePersonal((s) => s.discovered)
  const saved = usePersonal((s) => s.savedSecrets)
  const live = promotions.filter((p) => isPromotionLive(p, now))
  const flash = live.filter((p) => p.type === 'flash')
  const normal = live.filter((p) => p.type === 'normal')
  const secret = live.filter((p) => p.type === 'secret')

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pt-5 pb-28 md:pb-10">
      <h1 className="text-2xl font-extrabold tracking-tight">Ofertas</h1>

      <section>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="size-4 text-sun" /> Relámpago
          </span>
        </SectionTitle>
        {flash.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {flash.map((p) => (
              <OfferCard key={p.id} promo={p} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-card p-4 text-sm text-ink-soft">No hay ofertas relámpago activas en este momento.</p>
        )}
      </section>

      <section>
        <SectionTitle
          aside={
            <span className="text-xs font-bold text-ink-soft">
              {secret.filter((p) => discovered.includes(p.id)).length}/{secret.length} descubiertas
            </span>
          }
        >
          <span className="inline-flex items-center gap-1.5">
            <Gem className="size-4 text-brand" /> Ofertas secretas
          </span>
        </SectionTitle>
        <p className="-mt-1 mb-3 text-sm text-ink-soft">Solo aparecen explorando el mall en 3D: acércate a las tiendas y busca la gema dorada.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {secret.map((p) => (discovered.includes(p.id) ? <OfferCard key={p.id} promo={p} saved={saved.includes(p.id)} /> : <LockedSecret key={p.id} promo={p} />))}
        </div>
      </section>

      <section>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-4 text-coral" /> En tiendas
          </span>
        </SectionTitle>
        {normal.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {normal.map((p) => (
              <OfferCard key={p.id} promo={p} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Sparkles className="size-7" />} title="Sin promociones por ahora" />
        )}
      </section>
      <p className="text-center text-xs text-ink-soft">
        ¿Tienes una tienda o administras el mall?{' '}
        <Link to="/admin" className="font-bold text-brand">
          Abrir panel de administración (demo)
        </Link>
      </p>
    </div>
  )
}

function OfferCard({ promo, saved }: { promo: Promotion; saved?: boolean }) {
  const { productById, storeById } = useCatalogMaps()
  const product = productById[promo.productId]
  const store = storeById[promo.storeId]
  const openProduct = useUI((s) => s.openProduct)
  const openSecret = useUI((s) => s.openSecret)
  if (!product || !store) return null
  const dark = promo.type === 'secret'
  return (
    <button
      onClick={() => (promo.type === 'secret' && !saved ? openSecret(promo.id) : openProduct(product.id))}
      className={`flex gap-3 rounded-3xl border p-3 text-left transition active:scale-[0.99] ${dark ? 'border-ink bg-ink text-white' : promo.type === 'flash' ? 'border-sun/60 bg-sun/15' : 'border-line bg-card'}`}
    >
      <ProductImage product={product} brandColor={store.brandColor} className="size-24 shrink-0 rounded-2xl" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[11px] font-bold uppercase" style={{ color: dark ? '#f5b544' : store.brandColor }}>
          {store.name} {promo.code && `· ${promo.code}`}
        </p>
        <p className="line-clamp-2 text-sm leading-snug font-bold">{product.name}</p>
        <p className="mt-auto text-lg font-extrabold">
          {formatCOP(discounted(product.price, promo.discountPercent))} <span className="text-xs font-medium opacity-60 line-through">{formatCOP(product.price)}</span>
        </p>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="rounded-full bg-coral px-2 py-0.5 font-bold text-white">−{promo.discountPercent}%</span>
          {promo.endsAt && <Countdown endsAt={promo.endsAt} />}
        </div>
        {dark && <p className="mt-1 text-[11px] font-semibold text-sun">{saved ? '✓ Guardada: se aplica en tu carrito' : 'Toca para guardarla'}</p>}
      </div>
    </button>
  )
}

function LockedSecret({ promo }: { promo: Promotion }) {
  const { storeById, spaceByStore } = useCatalogMaps()
  const navigate = useNavigate()
  const store = storeById[promo.storeId]
  const zone = store ? ZONE_BY_ID[store.zoneId] : null
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line bg-card/70 p-5 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-sand-2 text-ink-soft">
        <Lock className="size-5" />
      </div>
      <p className="text-sm font-bold">Oferta por descubrir</p>
      {zone && <p className="text-xs text-ink-soft">Pista: busca en {FLOOR_BY_ID[FLOOR_OF_ZONE[zone.id]].name} · {zone.name}</p>}
      {zone && (
        <button
          className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand"
          onClick={() => {
            navigate('/')
            useUI.getState().setFloor(FLOOR_OF_ZONE[zone.id])
            useUI.getState().selectSpace(null)
            useUI.getState().requestFocus({ kind: 'zone', id: zone.id })
          }}
        >
          <MapPin className="size-3.5" /> Ir a la zona
        </button>
      )}
      {!spaceByStore[promo.storeId] && <p className="text-[11px] text-ink-soft">(La tienda no tiene local asignado)</p>}
    </div>
  )
}
