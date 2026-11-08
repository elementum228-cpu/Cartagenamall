import { ChevronLeft, ChevronRight, MessageCircle, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product, Store } from '../domain/types'
import { stockFor } from '../lib/inventory'
import { formatCOP } from '../lib/format'
import { openBooking } from '../lib/restaurant'
import { useIsNight } from '../lib/useIsNight'
import { addToCart } from '../state/actions'
import { useCart } from '../state/cart'
import { useCatalog } from '../state/catalog'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { ProductImage } from '../ui/ProductImage'
import { interiorProducts, interiorTabs, itemsFor, neighbors, sceneOf, wrapIndex, type Scene } from './logic'

// «Entrar al local» (beta): en vez de abrir una ficha, se entra al negocio. El fondo es el del local (el que
// sube el dueño en el estudio de fotos) y lo que vende flota delante; abajo, una barra con lo esencial para
// comprar. Un mismo motor con tres escenarios: tienda (prendas), restaurante (plato) y servicios (reserva).

export function StoreInterior() {
  const id = useUI((s) => s.interiorStoreId)
  const store = useCatalog((s) => s.stores.find((x) => x.id === id))
  const products = useCatalog((s) => s.products)
  if (!store) return null
  return <Interior key={store.id} store={store} products={interiorProducts(store, products)} />
}

const SCENE_BG: Record<Scene, string> = {
  shop: 'linear-gradient(180deg, #e9d9c3 0%, #ddc7ab 58%, #cbb192 100%)',
  restaurant: 'radial-gradient(ellipse at 50% 34%, #5a3b27 0%, #36231a 55%, #1f140f 100%)',
  service: 'linear-gradient(180deg, #1c2a30 0%, #16222a 60%, #101a20 100%)',
}

function Interior({ store, products }: { store: Store; products: Product[] }) {
  const scene = sceneOf(store)
  const close = () => useUI.getState().openInterior(null)
  const night = useIsNight()
  const dark = scene !== 'shop'
  const tabs = useMemo(() => interiorTabs(store, products), [store, products])
  const [tab, setTab] = useState('all')
  const items = useMemo(() => itemsFor(products, tab), [products, tab])
  const [index, setIndex] = useState(0)
  const cur = items[wrapIndex(index, items.length)]
  const nb = neighbors(wrapIndex(index, items.length), items.length)
  const go = (d: number) => setIndex((i) => wrapIndex(i + d, items.length))

  // cerrar con Escape y flechas del teclado
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  // deslizar con el dedo o el mouse
  const drag = useRef<number | null>(null)
  const bg = store.photoBg?.url

  return (
    <div role="dialog" aria-modal="true" aria-label={`Dentro de ${store.name}`} className="fixed inset-0 z-[55] overflow-hidden" style={{ background: SCENE_BG[scene], color: dark ? '#f4ede2' : '#1d1a16' }}>
      {bg && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})`, opacity: 0.9 }} />}
      {/* luz del día/noche sobre el local */}
      <div className="pointer-events-none absolute inset-0" style={{ background: night ? 'rgba(12,22,48,0.42)' : dark ? 'rgba(0,0,0,0.0)' : 'radial-gradient(ellipse at 50% 0%, rgba(255,246,226,0.55), rgba(255,246,226,0) 70%)' }} />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <button onClick={close} aria-label="Salir del local" className={`grid size-11 place-items-center rounded-full border backdrop-blur-md ${dark ? 'border-white/20 bg-black/30 text-white' : 'border-white/70 bg-white/55'}`}>
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-center leading-tight" style={{ textShadow: dark ? '0 1px 8px rgba(0,0,0,0.5)' : 'none' }}>
          <div className="text-[15px] font-extrabold tracking-[0.18em] uppercase">{store.name}</div>
          <div className="mt-0.5 text-[11px] font-semibold opacity-75">{store.tagline}</div>
        </div>
        {scene === 'service' ? <span className="size-11" /> : <CartButton dark={dark} />}
      </header>

      {tabs.length > 0 && (
        <nav aria-label="Categorías" className="scrollbar-none absolute inset-x-0 top-[calc(max(14px,env(safe-area-inset-top))+62px)] z-10 flex gap-1.5 overflow-x-auto px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              aria-pressed={tab === t.id}
              onClick={() => {
                setTab(t.id)
                setIndex(0)
              }}
              className={`h-10 shrink-0 rounded-full px-4 text-[13px] font-bold transition ${tab === t.id ? (dark ? 'bg-[#f4ede2] text-[#2a1a0c]' : 'bg-white text-ink shadow-soft') : dark ? 'border border-white/25 bg-white/10 text-[#f1e4d2]' : 'border border-white/70 bg-white/45 text-ink-soft'}`}
            >
              {t.name}
            </button>
          ))}
        </nav>
      )}

      {!cur ? (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <p className="text-sm font-semibold opacity-80">Este local todavía no tiene productos publicados.</p>
        </div>
      ) : scene === 'service' ? (
        <ServiceScene store={store} items={items} cur={cur} onPick={(i) => setIndex(i)} index={wrapIndex(index, items.length)} top={tabs.length ? 124 : 80} />
      ) : (
        <>
          <div
            className="absolute inset-x-0 top-[calc(max(14px,env(safe-area-inset-top))+(var(--tabs,0px))+82px)] bottom-[250px] touch-pan-y select-none"
            style={{ ['--tabs' as string]: tabs.length ? '50px' : '0px' }}
            onPointerDown={(e) => (drag.current = e.clientX)}
            onPointerUp={(e) => {
              if (drag.current === null) return
              const dx = e.clientX - drag.current
              drag.current = null
              if (Math.abs(dx) > 42) go(dx < 0 ? 1 : -1)
            }}
            onPointerCancel={() => (drag.current = null)}
          >
            <Stage scene={scene} store={store} cur={cur} prev={nb.prev !== null ? items[nb.prev] : null} next={nb.next !== null ? items[nb.next] : null} />
            {items.length > 1 && (
              <>
                <Arrow side="left" dark={dark} onClick={() => go(-1)} />
                <Arrow side="right" dark={dark} onClick={() => go(1)} />
              </>
            )}
          </div>
          <Dots n={items.length} i={wrapIndex(index, items.length)} dark={dark} />
          <Dock key={cur.id} store={store} product={cur} scene={scene} />
        </>
      )}
    </div>
  )
}

function CartButton({ dark }: { dark: boolean }) {
  const count = useCart((s) => s.items.reduce((a, i) => a + i.qty, 0))
  const navigate = useNavigate()
  return (
    <button
      aria-label={`Carrito, ${count} artículos`}
      onClick={() => {
        useUI.getState().openInterior(null)
        navigate('/carrito')
      }}
      className={`relative grid size-11 place-items-center rounded-full border backdrop-blur-md ${dark ? 'border-white/20 bg-black/30 text-white' : 'border-white/70 bg-white/55'}`}
    >
      <ShoppingBag className="size-5" />
      {count > 0 && <span className="absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[11px] leading-[18px] font-extrabold text-white">{count}</span>}
    </button>
  )
}

function Arrow({ side, dark, onClick }: { side: 'left' | 'right'; dark: boolean; onClick: () => void }) {
  return (
    <button
      aria-label={side === 'left' ? 'Anterior' : 'Siguiente'}
      onClick={onClick}
      className={`absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border backdrop-blur-md ${side === 'left' ? 'left-2' : 'right-2'} ${dark ? 'border-white/20 bg-black/35 text-white' : 'border-white/70 bg-white/55 text-ink'}`}
    >
      {side === 'left' ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  )
}

function Dots({ n, i, dark }: { n: number; i: number; dark: boolean }) {
  if (n < 2 || n > 12) return null
  return (
    <div className="absolute inset-x-0 bottom-[236px] z-10 flex justify-center gap-1.5" aria-hidden>
      {Array.from({ length: n }, (_, k) => (
        <span key={k} className="h-1.5 rounded-full transition-all" style={{ width: k === i ? 18 : 6, background: dark ? (k === i ? '#f2a33a' : 'rgba(255,255,255,0.3)') : k === i ? '#1d1a16' : 'rgba(29,26,22,0.25)' }} />
      ))}
    </div>
  )
}

/** El escenario del centro: tarjeta con la prenda (tienda) o plato visto desde arriba (restaurante), con vecinos que asoman. */
function Stage({ scene, store, cur, prev, next }: { scene: Scene; store: Store; cur: Product; prev: Product | null; next: Product | null }) {
  const plate = scene === 'restaurant'
  return (
    <div className="relative mx-auto h-full max-w-3xl">
      {[prev, next].map((p, k) =>
        p ? (
          <div
            key={`${k}-${p.id}`}
            className={`absolute top-[14%] hidden h-[70%] w-[30%] overflow-hidden opacity-70 sm:block ${plate ? 'rounded-full' : 'rounded-[26px] border border-white/60 bg-white/35 backdrop-blur-md'}`}
            style={{ [k === 0 ? 'left' : 'right']: '-2%' }}
            aria-hidden
          >
            <ProductImage product={p} brandColor={store.brandColor} className={`size-full ${plate ? 'rounded-full' : 'object-contain p-5'}`} />
          </div>
        ) : null,
      )}
      <div
        key={cur.id}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[fadeUp_.28s_ease-out] ${plate ? 'aspect-square h-[88%] max-h-[330px] rounded-full' : 'h-[96%] max-h-[420px] w-[min(72vw,280px)] rounded-[32px] border border-white/80 bg-white/60 p-4 backdrop-blur-xl'}`}
        style={{ boxShadow: plate ? '0 30px 50px -20px rgba(0,0,0,0.7)' : '0 28px 50px -18px rgba(70,45,15,0.45)' }}
      >
        <ProductImage product={cur} brandColor={store.brandColor} className={`size-full ${plate ? 'rounded-full border-[6px] border-[#fffaf1]' : 'rounded-2xl object-contain'}`} />
      </div>
    </div>
  )
}

/** Barra inferior: nombre, precio, opción y talla, y el botón para agregar. */
function Dock({ store, product, scene }: { store: Store; product: Product; scene: Scene }) {
  const { priceOf } = usePricing()
  const info = priceOf(product)
  const dark = scene === 'restaurant'
  const [variantId, setVariant] = useState<string | null>(product.variants[0]?.id ?? null)
  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const needsSize = product.sizes.length > 0
  const unit = info.final
  return (
    <div className={`absolute inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] z-10 mx-auto max-w-xl rounded-[30px] border p-4 backdrop-blur-xl ${dark ? 'border-white/10 bg-[#f7efe4]/95 text-[#2a1a0c]' : 'border-white/90 bg-white/75 text-[#1d1a16]'}`} style={{ boxShadow: '0 20px 44px -14px rgba(0,0,0,0.5)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] leading-tight font-extrabold">{product.name}</h2>
        <div className="text-right">
          {info.final < info.original && <span className="mr-1.5 text-xs font-semibold line-through opacity-60">{formatCOP(info.original)}</span>}
          <span className="text-[17px] font-extrabold">{formatCOP(unit)}</span>
        </div>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[12.5px] font-medium opacity-70">{product.description}</p>
      {product.variants.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Opción">
          {product.variants.map((v) => (
            <button key={v.id} aria-pressed={variantId === v.id} onClick={() => setVariant(v.id)} className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-bold ${variantId === v.id ? 'border-transparent bg-[#1d1a16] text-white' : 'border-black/15 bg-white/70'}`}>
              {v.swatch && <span className="size-3.5 rounded-full border border-black/15" style={{ background: v.swatch }} />}
              {v.name}
            </button>
          ))}
        </div>
      )}
      {needsSize && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Talla">
          <span className="mr-1 text-[11px] font-bold tracking-wider opacity-60">TALLA</span>
          {product.sizes.map((s) => {
            const out = stockFor(product, variantId, s) === 0
            return (
              <button key={s} disabled={out} aria-pressed={size === s} onClick={() => setSize(s)} className={`h-11 min-w-11 rounded-[14px] border px-2 text-[13px] font-bold disabled:line-through disabled:opacity-40 ${size === s ? 'border-transparent bg-[#1d1a16] text-white' : 'border-black/15 bg-white'}`}>
                {s}
              </button>
            )
          })}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2.5">
        {scene === 'restaurant' && (
          <div className="flex h-[52px] items-center rounded-full bg-black/[0.07] px-1">
            <button aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-11 place-items-center rounded-full"><Minus className="size-4" /></button>
            <span className="w-6 text-center text-base font-extrabold">{qty}</span>
            <button aria-label="Más" onClick={() => setQty((q) => Math.min(20, q + 1))} className="grid size-11 place-items-center rounded-full"><Plus className="size-4" /></button>
          </div>
        )}
        <button
          onClick={() => {
            if (addToCart(product, variantId, size, qty)) useUI.getState().toast(`${product.name} agregado al carrito.`, 'success')
          }}
          className="h-[52px] flex-1 rounded-full bg-[#0f766e] text-[15px] font-extrabold text-white active:scale-[0.99]"
        >
          Agregar · {formatCOP(unit * qty)}
        </button>
        <button onClick={() => useUI.getState().openProduct(product.id)} aria-label="Ver detalles" className={`h-[52px] shrink-0 rounded-full border px-4 text-[13px] font-bold ${dark ? 'border-black/20' : 'border-black/15 bg-white/70'}`}>
          Detalles
        </button>
      </div>
      <span className="sr-only">{store.name}</span>
    </div>
  )
}

/** Servicios: se elige el servicio y se reserva por WhatsApp (los servicios no van al carrito). */
function ServiceScene({ store, items, cur, onPick, index, top }: { store: Store; items: Product[]; cur: Product; onPick: (i: number) => void; index: number; top: number }) {
  const { priceOf } = usePricing()
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-xl flex-col px-4 pb-[max(14px,env(safe-area-inset-bottom))]" style={{ top: `calc(max(14px, env(safe-area-inset-top)) + ${top}px)` }}>
      <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#9fb7b8]">ELIGE EL SERVICIO</p>
      <ul className="mt-2.5 flex-1 space-y-2 overflow-y-auto pb-3">
        {items.map((p, i) => {
          const on = i === index
          const price = priceOf(p).final
          return (
            <li key={p.id}>
              <button onClick={() => onPick(i)} aria-pressed={on} className={`flex min-h-[60px] w-full items-center justify-between gap-3 rounded-[20px] px-4 py-2.5 text-left ${on ? 'border-2 border-[#4fd1c1] bg-[#4fd1c1]/15' : 'border border-white/15 bg-white/[0.06]'}`}>
                <span className="min-w-0">
                  <span className="block text-[14px] font-extrabold">{p.name}</span>
                  {p.description && <span className="block truncate text-[12px] font-medium text-[#b7cfd0]">{p.description}</span>}
                </span>
                <span className="shrink-0 text-[14px] font-extrabold">{formatCOP(price)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button
        onClick={() => openBooking(store, cur.name, formatCOP(priceOf(cur).final))}
        className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[#eef3f2] text-[15px] font-extrabold text-[#10242a]"
      >
        <MessageCircle className="size-5" /> Reservar por WhatsApp · {formatCOP(priceOf(cur).final)}
      </button>
    </div>
  )
}
