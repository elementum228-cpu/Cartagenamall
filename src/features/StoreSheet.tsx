import { AtSign, Heart, MapPin, MessageCircle, Sparkles, Stamp, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CATEGORY_BY_ID, FLOOR_BY_ID, FLOOR_OF_ZONE, SPACE_BY_ID, SPACE_TYPES, ZONE_BY_ID } from '../config/mall'
import type { Promotion, Store } from '../domain/types'
import { copyText } from '../lib/clipboard'
import { formatCOP } from '../lib/format'
import { discounted, isPromotionLive } from '../lib/pricing'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { usePersonal } from '../state/personal'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { Chip, Countdown, SectionTitle, StoreLogo, btn } from '../ui/bits'
import { ProductImage } from '../ui/ProductImage'
import { addToCart } from '../state/actions'
import { isDemoPromotion } from '../promotions/demo'
import { ProductCard } from '../ui/ProductCard'
import { RestaurantMenu } from './RestaurantMenu'
import { catalogWords, isRestaurant, whatsappLink } from '../lib/restaurant'
import { remoteEnabled } from '../remote/client'
import { Sheet } from '../ui/Sheet'
import { loyaltyOf, usePassport } from '../state/passport'

/** Ficha comercial de una tienda: se abre al tocarla en el mapa o desde el modo Comprar. */
export function StoreSheet() {
  const selectedSpaceId = useUI((s) => (s.peek ? null : s.selectedSpaceId))
  const openStoreId = useUI((s) => s.openStoreId)
  const assignments = useCatalog((s) => s.assignments)
  const { storeById } = useCatalogMaps()
  const storeId = openStoreId ?? (selectedSpaceId ? assignments[selectedSpaceId] : undefined)
  const store = storeId ? storeById[storeId] : undefined
  const close = () => {
    useUI.getState().selectSpace(null)
    useUI.getState().openStore(null)
  }
  return (
    <Sheet open={!!store} onClose={close} title={store ? `Tienda ${store.name}` : 'Tienda'} header={store && <StoreHeader store={store} />}>
      {store && <StoreBody key={store.id} store={store} />}
    </Sheet>
  )
}

function StoreHeader({ store }: { store: Store }) {
  const { spaceByStore } = useCatalogMaps()
  const space = SPACE_BY_ID[spaceByStore[store.id]]
  const zone = ZONE_BY_ID[store.zoneId]
  return (
    <div className="px-5 pt-3 pb-4" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${store.brandColor} 9%, transparent), transparent)` }}>
      <div className="flex items-center gap-3.5 pr-12">
        <StoreLogo store={store} size={56} />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-extrabold tracking-tight">{store.name}</h2>
          <p className="truncate text-[13px] text-ink-soft">{store.tagline}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <span className="rounded-full bg-ink px-2 py-0.5 text-white">{FLOOR_BY_ID[FLOOR_OF_ZONE[zone.id]].name}</span>
            <span className="rounded-full px-2 py-0.5 text-white" style={{ background: zone.color }}>
              {zone.id === 'E' ? zone.name : `Pasillo ${zone.id} · ${zone.name}`}
            </span>
            {space && <span className="rounded-full bg-white/80 px-2 py-0.5 text-ink-soft">{SPACE_TYPES[space.type].name} {space.label}</span>}
            <span className={`rounded-full px-2 py-0.5 ${store.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {store.status === 'open' ? 'Abierto' : 'Cerrado'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StoreBody({ store }: { store: Store }) {
  const products = useCatalog((s) => s.products)
  const promotions = useCatalog((s) => s.promotions)
  const { productById, spaceByStore } = useCatalogMaps()
  const discovered = usePersonal((s) => s.discovered)
  const fav = usePersonal((s) => s.favoriteStores.includes(store.id))
  const toggleFav = usePersonal((s) => s.toggleFavoriteStore)
  const { now } = usePricing()
  const toast = useUI((s) => s.toast)
  const navigate = useNavigate()
  const location = useLocation()
  const [cat, setCat] = useState<string | null>(null)

  const mine = useMemo(() => products.filter((p) => p.storeId === store.id && p.active), [products, store.id])
  const categories = useMemo(() => [...new Set(mine.map((p) => p.categoryId))], [mine])
  const featured = mine.filter((p) => p.featured)
  const shown = cat ? mine.filter((p) => p.categoryId === cat) : mine
  const promos = promotions.filter(
    (p) => p.storeId === store.id && isPromotionLive(p, now) && (p.type !== 'secret' || discovered.includes(p.id)),
  )
  const food = isRestaurant(store)
  const onMap = location.pathname === '/'
  // La oferta relámpago más reciente va arriba, con precio, vigencia y botón de carrito.
  const flashNow = promos.filter((p) => p.type === 'flash').sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0]

  return (
    <div className="space-y-6 px-5 pt-4 pb-8">
      {flashNow && productById[flashNow.productId] && <FlashOffer promo={flashNow} store={store} />}
      <p className="text-[14px] leading-relaxed text-ink-soft">{store.description}</p>
      <LoyaltyStrip store={store} />

      <div className="flex flex-wrap gap-2">
        <button onClick={() => toggleFav(store.id)} className={btn.secondary} aria-pressed={fav}>
          <Heart className={`size-4 ${fav ? 'text-coral' : ''}`} fill={fav ? 'currentColor' : 'none'} />
          {fav ? 'Guardada' : 'Guardar tienda'}
        </button>
        <button
          onClick={async () => {
            if (remoteEnabled()) return void window.open(whatsappLink(store.whatsapp, `Hola ${store.name}, vengo de MallPlay 👋`), '_blank', 'noopener')
            const ok = await copyText(`${store.whatsapp} — Hola ${store.name}, te escribo desde MallPlay.`)
            toast(ok ? `Número de demostración copiado: ${store.whatsapp}` : `WhatsApp de demostración: ${store.whatsapp}`)
          }}
          className={btn.secondary}
        >
          <MessageCircle className="size-4 text-emerald-600" />
          WhatsApp
        </button>
        {!onMap && spaceByStore[store.id] && (
          <button
            onClick={() => {
              const sp = spaceByStore[store.id]
              navigate('/')
              useUI.getState().setFloor(SPACE_BY_ID[sp].floorId)
              useUI.getState().selectSpace(sp)
              useUI.getState().requestFocus({ kind: 'space', id: sp })
            }}
            className={btn.secondary}
          >
            <MapPin className="size-4 text-brand" />
            Ver en el mapa
          </button>
        )}
      </div>
      <p className="-mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
        <AtSign className="size-3.5" /> {store.instagram} · {store.whatsapp}
        <span className="rounded bg-sand-2 px-1.5 py-0.5 text-[10px] font-bold">DEMO</span>
        <button
          className="ml-auto font-bold text-brand underline-offset-2 hover:underline"
          onClick={() => {
            useUI.getState().selectSpace(null)
            useUI.getState().openStore(null)
            navigate(`/mi-negocio?tienda=${store.id}`)
          }}
        >
          ¿Es tu negocio?
        </button>
      </p>

      {promos.length > 0 && (
        <section>
          <SectionTitle>Promociones</SectionTitle>
          <div className="space-y-2">
            {promos.map((p) => {
              const product = productById[p.productId]
              return product ? <PromoRow key={p.id} promo={p} productName={product.name} price={product.price} /> : null
            })}
          </div>
        </section>
      )}

      {!food && featured.length > 0 && (
        <section>
          <SectionTitle>Destacados</SectionTitle>
          <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} store={store} compact />
            ))}
          </div>
        </section>
      )}

      {food ? (
        <RestaurantMenu store={store} products={mine} />
      ) : (
      <section>
        <SectionTitle aside={<span className="text-xs text-ink-soft">{shown.length} {catalogWords(store).plural}</span>}>{catalogWords(store).title}</SectionTitle>
        {categories.length > 1 && (
          <div className="scrollbar-none -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
            <Chip active={!cat} onClick={() => setCat(null)}>Todo</Chip>
            {categories.map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                {CATEGORY_BY_ID[c]?.name ?? c}
              </Chip>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} store={store} />
          ))}
        </div>
      </section>
      )}
    </div>
  )
}

function PromoRow({ promo, productName, price }: { promo: Promotion; productName: string; price: number }) {
  const openProduct = useUI((s) => s.openProduct)
  const Icon = promo.type === 'flash' ? Zap : Sparkles
  const tone = promo.type === 'flash' ? 'bg-sun/20 border-sun/50' : promo.type === 'secret' ? 'bg-ink text-white border-ink' : 'bg-coral/10 border-coral/30'
  return (
    <button onClick={() => openProduct(promo.productId)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${tone}`}>
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/70 text-ink">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{promo.title}</p>
        <p className="truncate text-xs opacity-75">
          {productName} · {formatCOP(discounted(price, promo.discountPercent))} <span className="line-through">{formatCOP(price)}</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-sm font-extrabold">−{promo.discountPercent}%</span>
        {promo.endsAt && <Countdown endsAt={promo.endsAt} />}
      </div>
    </button>
  )
}

/** Oferta relámpago activa de la tienda: producto, precio original y promocional, vigencia y carrito. */
function FlashOffer({ promo, store }: { promo: Promotion; store: Store }) {
  const { productById } = useCatalogMaps()
  const { priceOf } = usePricing()
  const openProduct = useUI((s) => s.openProduct)
  const product = productById[promo.productId]
  const info = priceOf(product)
  const needsChoice = product.variants.length > 0 || product.sizes.length > 0
  const demo = isDemoPromotion(promo)
  return (
    <section aria-label="Oferta relámpago activa" className="rounded-3xl border border-sun/60 bg-sun/15 p-3">
      <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-extrabold text-ink">
        <span className="flex items-center gap-1 rounded-full bg-sun px-2 py-0.5">
          <Zap className="size-3.5" /> Oferta relámpago −{promo.discountPercent}%
        </span>
        <span className="flex items-center gap-1 font-bold text-ink-soft">
          Termina en <Countdown endsAt={promo.endsAt} />
        </span>
        {demo && <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] text-white">DEMO · ficticia</span>}
      </p>
      <div className="flex items-center gap-3">
        <button onClick={() => openProduct(product.id)} className="shrink-0" aria-label={`Ver ${product.name}`}>
          <ProductImage product={product} brandColor={store.brandColor} className="size-16 rounded-2xl" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-tight font-bold">{product.name}</p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-lg font-extrabold">{formatCOP(info.final)}</span>
            {info.final < info.original && <span className="text-xs text-ink-soft line-through">{formatCOP(info.original)}</span>}
          </p>
        </div>
        <button
          className={`${btn.primary} shrink-0 px-3.5`}
          onClick={() => (needsChoice ? openProduct(product.id) : addToCart(product, null, null))}
        >
          {needsChoice ? 'Elegir' : 'Agregar'}
        </button>
      </div>
    </section>
  )
}

/** Tarjeta de sellos de la tienda en su ficha: cuánto lleva la persona y qué gana al llenarla. */
function LoyaltyStrip({ store }: { store: Store }) {
  const have = usePassport((s) => s.cards[store.id] ?? 0)
  const l = loyaltyOf(store)
  if (!l.active) return null
  return (
    <Link to="/pasaporte" className="flex items-center gap-3 rounded-[22px] bg-ink/[0.04] p-3 transition active:scale-[0.99]">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl text-white" style={{ background: store.brandColor }}>
        <Stamp className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">
          Tarjeta de sellos · {Math.min(have, l.stamps)}/{l.stamps}
        </span>
        <span className="block truncate text-[12px] text-ink-soft">Premio: {l.reward}</span>
      </span>
      <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-ink/10">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(1, have / l.stamps) * 100}%`, background: store.brandColor }} />
      </span>
    </Link>
  )
}
