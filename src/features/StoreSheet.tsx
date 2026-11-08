import { messageFor } from '../lib/messages'
import { productDesc } from '../lib/desc'
import { absoluteUrl, localPath } from '../lib/links'
import { ArrowLeft, ArrowRight, ArrowUpDown, Check, ChevronDown, DoorOpen, Heart, Share2, MapPin, MessageCircle, Search, Sparkles, Stamp, X, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FLOOR_BY_ID, FLOOR_OF_ZONE, SPACE_BY_ID, ZONE_BY_ID } from '../config/mall'
import type { Product, Promotion, Store } from '../domain/types'
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
import { catalogWords, isRestaurant, isService, whatsappLink } from '../lib/restaurant'
import { instagramUrl } from '../lib/instagram'
import { groupOf, groupsWithProducts } from '../lib/storeCategories'
import { InstagramIcon } from '../ui/InstagramIcon'
import { remoteEnabled } from '../remote/client'
import { Sheet } from '../ui/Sheet'
import { useBeta } from '../state/beta'
import { canEnter } from '../immersive/logic'
import { directionsUrl, hasAddress } from '../lib/maps'
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
  if (isRestaurant(store)) return <RestaurantCover store={store} />
  return <PlainHeader store={store} />
}

/**
 * Portada del restaurante: el local es lo primero que se ve (fondo de la tienda o su color), con logo, nombre y estado.
 * Si el local tiene «Entrar al local», el botón de vidrio va sobre la portada: la portada es la entrada.
 */
function RestaurantCover({ store }: { store: Store }) {
  const betaOn = useBeta((s) => s.interior)
  const hasMenu = useCatalog((s) => s.products.some((p) => p.storeId === store.id && p.active))
  const enter = canEnter(betaOn, store) && hasMenu
  const bg = store.photoBg?.url
  const open = store.status === 'open'
  return (
    <div className={`relative overflow-hidden ${enter ? 'h-[236px]' : 'h-[176px]'}`} style={{ background: `radial-gradient(ellipse at 72% 24%, color-mix(in srgb, ${store.brandColor} 52%, #2a1a10) 0%, #2a1a10 62%, #170e09 100%)` }}>
      {bg && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})` }} />}
      <div className="absolute inset-0 opacity-60" style={{ background: 'repeating-linear-gradient(100deg, rgba(255,255,255,0.035) 0 2px, rgba(0,0,0,0) 2px 26px)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(20,12,8,0.5) 0%, rgba(20,12,8,0.05) 40%, rgba(20,12,8,0.78) 100%)' }} />
      <div className={`absolute inset-x-5 flex items-center gap-3 text-white ${enter ? 'bottom-[76px]' : 'bottom-4'}`}>
        <span className="grid shrink-0 place-items-center rounded-full bg-white p-[3px] shadow-[0_4px_14px_rgba(0,0,0,0.4)]">
          <StoreLogo store={store} size={52} round />
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="truncate text-[23px] font-extrabold tracking-tight">{store.name}</h2>
          <p className="mt-1 flex items-center gap-2 text-[12.5px] font-semibold text-white/90">
            <span className={`size-2 shrink-0 rounded-full ${open ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="truncate">
              {open ? 'Abierto' : 'Cerrado'} · {store.tagline || 'Restaurante'}
            </span>
          </p>
        </div>
      </div>
      {enter && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => useUI.getState().openInterior(store.id)}
          className="absolute inset-x-5 bottom-4 flex h-[52px] items-center justify-between rounded-full bg-white/92 pr-2 pl-5 text-ink shadow-[0_12px_26px_-10px_rgba(0,0,0,0.6)] backdrop-blur transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-2.5">
            <DoorOpen className="size-5" />
            <span className="text-[15px] font-extrabold">Entrar al local</span>
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-white">BETA</span>
          </span>
          <span className="grid size-[38px] place-items-center rounded-full bg-brand text-white">
            <ArrowRight className="size-[18px]" />
          </span>
        </button>
      )}
    </div>
  )
}

function PlainHeader({ store }: { store: Store }) {
  const { spaceByStore } = useCatalogMaps()
  const space = SPACE_BY_ID[spaceByStore[store.id]]
  const zone = ZONE_BY_ID[store.zoneId]
  const open = store.status === 'open'
  return (
    <div className="px-5 pt-3 pb-3" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${store.brandColor} 9%, transparent), transparent)` }}>
      <div className="flex items-center gap-3.5 pr-12">
        <span className="grid shrink-0 place-items-center rounded-full bg-white p-[3px] shadow-[0_4px_12px_rgba(0,0,0,0.16)]">
          <StoreLogo store={store} size={52} round />
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="truncate text-xl font-extrabold tracking-tight">{store.name}</h2>
          <p className="mt-1 flex items-center gap-2 text-[12.5px] font-semibold text-ink-soft">
            <span className={`flex shrink-0 items-center gap-1.5 ${open ? 'text-emerald-700' : 'text-amber-700'}`}>
              <span className={`size-2 rounded-full ${open ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {open ? 'Abierto' : 'Cerrado'}
            </span>
            <span className="text-ink-soft/50">·</span>
            <span className="truncate">
              {zone.id === 'E' ? zone.name : `Pasillo ${zone.id} · ${zone.name}`} · {FLOOR_BY_ID[FLOOR_OF_ZONE[zone.id]].name}
              {space ? ` · ${space.label}` : ''}
            </span>
          </p>
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
  const [view, setView] = useState<'ficha' | 'catalogo'>('ficha')

  const mine = useMemo(() => products.filter((p) => p.storeId === store.id && p.active), [products, store.id])
  const groups = useMemo(() => groupsWithProducts(store, mine), [store, mine])
  const featured = mine.filter((p) => p.featured)
  const shown = cat ? mine.filter((p) => groupOf(store, p).id === cat) : mine
  const instagram = instagramUrl(store.instagram)
  const promos = promotions.filter((p) => p.storeId === store.id && isPromotionLive(p, now) && (p.type !== 'secret' || discovered.includes(p.id)))
  const food = isRestaurant(store)
  const betaOn = useBeta((s) => s.interior)
  // restaurantes: acciones como pastillas finas en una sola fila (la jerarquía la llevan la portada, el menú y el pedido)
  const act = food
    ? 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[12.5px] font-bold text-ink transition active:scale-[0.97]'
    : 'flex h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-line bg-white text-[11px] font-bold text-ink-soft transition active:scale-[0.97]'
  const onMap = location.pathname === '/'
  // cuántos botones hay en la fila de iconos (para repartir el ancho)
  const tiles = 3 + (instagram ? 1 : 0) + (!onMap && spaceByStore[store.id] ? 1 : 0)
  // La oferta relámpago más reciente va arriba, con precio, vigencia y botón de carrito.
  const flashNow = promos.filter((p) => p.type === 'flash').sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0]

  if (view === 'catalogo') return <FullCatalog store={store} products={mine} onBack={() => setView('ficha')} />

  return (
    <div className="space-y-6 px-5 pt-4 pb-8">
      {flashNow && productById[flashNow.productId] && <FlashOffer promo={flashNow} store={store} />}
      <p className="text-[14px] leading-relaxed text-ink-soft">{store.description}</p>
      <LoyaltyStrip store={store} />

      {!food && canEnter(betaOn, store) && mine.length > 0 && (
        <button
          onClick={() => useUI.getState().openInterior(store.id)}
          className="group relative flex h-[128px] w-full items-end justify-between overflow-hidden rounded-[28px] p-5 text-left text-white shadow-[0_22px_36px_-18px_rgba(15,118,110,0.7)] transition active:scale-[0.99]"
          style={{ background: 'linear-gradient(120deg, #0f766e 0%, #0b5e57 100%)' }}
        >
          <span aria-hidden className="absolute -top-9 -right-9 size-[150px] rounded-full bg-white/10" />
          <span className="absolute top-[18px] left-5 rounded-full bg-white/20 px-2.5 py-1 text-[10.5px] font-extrabold tracking-widest">BETA</span>
          <span className="relative leading-tight">
            <span className="block text-[22px] font-extrabold">Entrar al local</span>
            <span className="mt-0.5 block text-[12.5px] opacity-85">Recórrelo como si estuvieras adentro</span>
          </span>
          {/* productos que asoman */}
          <span aria-hidden className="absolute top-[26px] right-[72px] flex">
            {mine.slice(0, 2).map((p, i) => (
              <span key={p.id} className="overflow-hidden rounded-full border-[3px] border-white bg-white" style={{ marginLeft: i ? -16 : 0 }}>
                <ProductImage product={p} brandColor={store.brandColor} className="size-[50px]" />
              </span>
            ))}
          </span>
          <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-white text-brand transition group-hover:translate-x-0.5">
            <ArrowRight className="size-5" strokeWidth={2.6} />
          </span>
        </button>
      )}

      <div className={food ? 'scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5' : `grid gap-2 ${tiles === 5 ? 'grid-cols-5' : tiles === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <button
          onClick={async () => {
            const url = absoluteUrl(localPath(store, SPACE_BY_ID[spaceByStore[store.id]]))
            // en el celular se abre el menú de compartir; en el computador se copia el enlace
            if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
              try {
                await navigator.share({ title: store.name, text: `Visita ${store.name} en MallPlay`, url })
                return
              } catch {
                /* canceló: no se copia */ return
              }
            }
            toast((await copyText(url)) ? 'Enlace copiado. Quien lo abra llega directo a este local.' : url)
          }}
          className={act}
          aria-label={`Compartir el enlace de ${store.name}`}
        >
          <Share2 className="size-[18px]" /> Compartir
        </button>
        <button onClick={() => toggleFav(store.id)} className={act} aria-pressed={fav}>
          <Heart className={`size-[18px] ${fav ? 'text-coral' : ''}`} fill={fav ? 'currentColor' : 'none'} />
          {fav ? 'Guardada' : food ? 'Guardar tienda' : 'Guardar'}
        </button>
        <button
          onClick={async () => {
            if (remoteEnabled()) return void window.open(whatsappLink(store.whatsapp, messageFor(store, 'greeting', {})), '_blank', 'noopener')
            const ok = await copyText(`${store.whatsapp} — Hola ${store.name}, te escribo desde MallPlay.`)
            toast(ok ? `Número de demostración copiado: ${store.whatsapp}` : `WhatsApp de demostración: ${store.whatsapp}`)
          }}
          className={act}
        >
          <MessageCircle className="size-[18px] text-emerald-600" />
          WhatsApp
        </button>
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className={act} aria-label={`Instagram de ${store.name}`}>
            <InstagramIcon className="size-[18px]" />
            Instagram
          </a>
        )}
        {!onMap && spaceByStore[store.id] && (
          <button
            onClick={() => {
              const sp = spaceByStore[store.id]
              navigate('/')
              useUI.getState().setFloor(SPACE_BY_ID[sp].floorId)
              useUI.getState().selectSpace(sp)
              useUI.getState().requestFocus({ kind: 'space', id: sp })
            }}
            className={act}
          >
            <MapPin className="size-[18px] text-brand" />
            {food ? 'Ver en el mapa' : 'Mapa'}
          </button>
        )}
      </div>
      <AddressRow store={store} />
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
        <div className="space-y-3">
          <CategoryChips groups={groups} cat={cat} onPick={setCat} products={mine} store={store} variant="tabs" />
          <RestaurantMenu store={store} products={shown} hideTitle />
        </div>
      ) : (
        <section>
          <SectionTitle
            aside={
              !isService(store) && mine.length > 0 ? (
                <button onClick={() => setView('catalogo')} className="inline-flex items-center gap-1 text-[13px] font-bold text-brand">
                  Ver todo y filtrar <ArrowRight className="size-3.5" strokeWidth={2.6} />
                </button>
              ) : (
                <span className="text-xs text-ink-soft">
                  {shown.length} {catalogWords(store).plural}
                </span>
              )
            }
          >
            {catalogWords(store).title}
          </SectionTitle>
          <CategoryChips groups={groups} cat={cat} onPick={setCat} products={mine} store={store} className="mb-3" variant="soft" />
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

/** Dirección del local con «Cómo llegar» (abre Google Maps). Solo aparece si el dueño la puso. */
function AddressRow({ store }: { store: Store }) {
  if (!hasAddress(store.address)) return null
  const href = directionsUrl(store.address)
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
        <MapPin className="size-5" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[11px] font-extrabold tracking-wider text-ink-soft uppercase">Dirección</p>
        <p className="mt-0.5 text-[13.5px] font-bold">{store.address?.text || 'Ubicación en Google Maps'}</p>
      </div>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-extrabold text-white transition active:scale-[0.97]" aria-label={`Cómo llegar a ${store.name} en Google Maps`}>
          Cómo llegar
        </a>
      )}
    </div>
  )
}

/** Filtro por categorías propias de la tienda (solo si hay más de una). */
function CategoryChips({
  groups,
  cat,
  onPick,
  products,
  store,
  className = '',
  variant = 'chips',
}: {
  variant?: 'chips' | 'tabs' | 'soft'
  groups: { id: string; name: string }[]
  cat: string | null
  onPick: (id: string | null) => void
  products: { shopCategory?: string; categoryId: string }[]
  store: Store
  className?: string
}) {
  if (groups.length < 2) return null
  const count = (id: string) => products.filter((p) => groupOf(store, p).id === id).length
  if (variant === 'tabs')
    return (
      <div className={`scrollbar-none -mx-5 flex gap-6 overflow-x-auto border-b border-line px-5 ${className}`} role="tablist" aria-label="Categorías del menú">
        {[{ id: null as string | null, name: 'Todo', n: products.length }, ...groups.map((g) => ({ id: g.id as string | null, name: g.name, n: count(g.id) }))].map((t) => {
          const on = cat === t.id
          return (
            <button key={t.id ?? 'all'} role="tab" aria-selected={on} onClick={() => onPick(t.id)} className={`-mb-px flex h-12 shrink-0 items-center gap-1.5 border-b-[3px] text-[14px] transition ${on ? 'border-brand font-extrabold text-brand' : 'border-transparent font-bold text-ink-soft'}`}>
              {t.name}
              <span className={`text-[12px] font-bold ${on ? 'text-ink-soft' : 'text-ink-soft/70'}`}>{t.n}</span>
            </button>
          )
        })}
      </div>
    )
  if (variant === 'soft')
    return (
      <div className={`scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 ${className}`} role="group" aria-label="Filtrar por categoría">
        {[{ id: null as string | null, name: 'Todo' }, ...groups.map((g) => ({ id: g.id as string | null, name: g.name }))].map((t) => {
          const on = cat === t.id
          return (
            <button key={t.id ?? 'all'} aria-pressed={on} onClick={() => onPick(t.id)} className={`h-9 shrink-0 rounded-full px-4 text-[13px] transition ${on ? 'bg-brand/15 font-extrabold text-brand' : 'border border-line font-bold text-ink-soft'}`}>
              {t.name}
            </button>
          )
        })}
      </div>
    )
  return (
    <div className={`scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 ${className}`} role="group" aria-label="Filtrar por categoría">
      <Chip active={!cat} onClick={() => onPick(null)}>
        Todo · {products.length}
      </Chip>
      {groups.map((g) => (
        <Chip key={g.id} active={cat === g.id} onClick={() => onPick(g.id)}>
          {g.name} · {count(g.id)}
        </Chip>
      ))}
    </div>
  )
}

type Sort = 'destacados' | 'menor' | 'mayor' | 'nombre'

const SORTS: { id: Sort; label: string; short: string }[] = [
  { id: 'destacados', label: 'Destacados primero', short: 'Destacados' },
  { id: 'menor', label: 'Precio: menor a mayor', short: 'Menor precio' },
  { id: 'mayor', label: 'Precio: mayor a menor', short: 'Mayor precio' },
  { id: 'nombre', label: 'Nombre A–Z', short: 'A–Z' },
]

/** Selector de orden: botón tipo pastilla con menú propio (en vez del desplegable nativo). */
function SortMenu({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  const [open, setOpen] = useState(false)
  const cur = SORTS.find((x) => x.id === value) ?? SORTS[0]
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white/90 pr-2.5 pl-3 text-[12.5px] font-bold text-ink shadow-soft transition active:scale-[0.97]"
      >
        <ArrowUpDown className="size-3.5 text-brand" />
        {cur.short}
        <ChevronDown className={`size-3.5 text-ink-soft transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Cerrar" className="fixed inset-0 z-20 cursor-default" onClick={() => setOpen(false)} />
          <ul role="listbox" aria-label="Ordenar por" className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-2xl border border-line bg-card p-1 shadow-soft">
            {SORTS.map((o) => (
              <li key={o.id} role="option" aria-selected={o.id === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[13.5px] ${o.id === value ? 'bg-brand/10 font-bold text-brand' : 'font-semibold text-ink active:bg-sand'}`}
                >
                  {o.label}
                  {o.id === value && <Check className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** Menú o catálogo completo de la tienda: búsqueda, categorías y orden, con todo lo que vende. */
function FullCatalog({ store, products, onBack }: { store: Store; products: Product[]; onBack: () => void }) {
  const food = isRestaurant(store)
  const words = catalogWords(store)
  const { priceOf } = usePricing()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('destacados')
  const groups = useMemo(() => groupsWithProducts(store, products), [store, products])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = products.filter((p) => (!cat || groupOf(store, p).id === cat) && (!needle || `${p.name} ${productDesc(p)}`.toLowerCase().includes(needle)))
    if (sort === 'menor') list = [...list].sort((a, b) => priceOf(a).final - priceOf(b).final)
    else if (sort === 'mayor') list = [...list].sort((a, b) => priceOf(b).final - priceOf(a).final)
    else if (sort === 'nombre') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    else list = [...list].sort((a, b) => Number(b.featured) - Number(a.featured))
    return list
  }, [products, store, q, cat, sort, priceOf])

  return (
    <div className="px-5 pt-3 pb-8">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
        <ArrowLeft className="size-4" /> Volver a {store.name}
      </button>
      <h3 className="text-xl font-extrabold tracking-tight">{food ? 'Menú completo' : 'Catálogo completo'}</h3>
      <p className="text-[13px] text-ink-soft">
        {products.length} {products.length === 1 ? words.one : words.plural}
        {groups.length > 1 ? ` en ${groups.length} categorías` : ''}
      </p>

      <label className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-white px-3.5 focus-within:border-teal focus-within:ring-4 focus-within:ring-teal/15">
        <Search className="size-4 shrink-0 text-ink-soft" />
        <input
          className="h-11 w-full bg-transparent text-[15px] outline-none"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Buscar ${food ? 'en el menú' : 'en el catálogo'}…`}
          aria-label="Buscar"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Borrar búsqueda" className="text-ink-soft">
            <X className="size-4" />
          </button>
        )}
      </label>

      <div className="sticky top-0 z-10 -mx-5 mt-3 bg-gradient-to-b from-card via-card to-card/0 px-5 pt-1 pb-3">
        <CategoryChips groups={groups} cat={cat} onPick={setCat} products={products} store={store} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-soft">
            {shown.length} {shown.length === 1 ? words.one : words.plural}
          </p>
          <SortMenu value={sort} onChange={setSort} />
        </div>
      </div>

      {!shown.length ? (
        <p className="rounded-2xl bg-sand p-4 text-sm text-ink-soft">No encontramos {words.plural} con eso. Prueba con otra palabra o categoría.</p>
      ) : food ? (
        <RestaurantMenu store={store} products={shown} hideTitle />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} store={store} />
          ))}
        </div>
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
        <button className={`${btn.primary} shrink-0 px-3.5`} onClick={() => (needsChoice ? openProduct(product.id) : addToCart(product, null, null))}>
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
        <span
          className="block h-full rounded-full"
          style={{
            width: `${Math.min(1, have / l.stamps) * 100}%`,
            background: store.brandColor,
          }}
        />
      </span>
    </Link>
  )
}
