import { ChevronLeft, ChevronRight, MessageCircle, Minus, Plus, ShoppingBag, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { StoreLogo } from '../ui/bits'
import { useBeta } from '../state/beta'
import { firstTab, interiorProducts, interiorTabs, itemsFor, musicUrlFor, relPos, sceneOf, wrapIndex, type Scene } from './logic'
import { setMusicMuted, startMusic, stopMusic, useInteriorSound } from './music'

// «Entrar al local» (beta): en vez de abrir una ficha, se entra al negocio. El fondo es el del local (el que
// sube el dueño en el estudio de fotos) y lo que vende flota delante; abajo, una barra con lo esencial para
// comprar. Un mismo motor con tres escenarios: tienda (prendas), restaurante (plato) y servicios (reserva).

if (import.meta.env.DEV) (window as unknown as { __cmInterior?: unknown }).__cmInterior = { useUI, useCatalog, useBeta }

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

/** Alto (px, sin la zona segura de arriba) que ocupan el encabezado con el logo y las categorías. */
const TOP_BAR = 128

function Interior({ store, products }: { store: Store; products: Product[] }) {
  const scene = sceneOf(store)
  const close = () => useUI.getState().openInterior(null)
  const night = useIsNight()
  const dark = scene !== 'shop'
  const tabs = useMemo(() => interiorTabs(store, products), [store, products])
  const [tab, setTab] = useState(() => firstTab(interiorTabs(store, products)))
  const items = useMemo(() => itemsFor(store, products, tab), [store, products, tab])
  const [index, setIndex] = useState(0)
  const n = items.length
  const cur = items[wrapIndex(index, n)]
  const go = (d: number) => setIndex((i) => wrapIndex(i + d, n))

  // entrada: las puertas de vidrio se abren solas; con «reducir movimiento» no hay animación
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [doors, setDoors] = useState<'closed' | 'open' | 'gone'>(reduce ? 'gone' : 'closed')
  useEffect(() => {
    if (doors === 'gone') return
    const t1 = window.setTimeout(() => setDoors('open'), 380)
    const t2 = window.setTimeout(() => setDoors('gone'), 380 + 1750)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // música de fondo del local: suave, empieza al entrar y se apaga al salir
  const musicUrl = musicUrlFor(store, import.meta.env.BASE_URL)
  const muted = useInteriorSound((s) => s.muted)
  useEffect(() => {
    startMusic(musicUrl)
    return () => stopMusic()
  }, [musicUrl])

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
  }, [n])

  // deslizar con el dedo o el mouse: la tarjeta sigue al dedo y, al soltar, se acomoda sola
  const drag = useRef<{ x0: number; id: number } | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const bg = store.photoBg?.url
  const pill = dark ? 'border-white/25 bg-white/85 text-[#1d1a16]' : 'border-black/10 bg-[#1d1a16]/85 text-white'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Dentro de ${store.name}`}
      className="fixed inset-0 z-[55] overflow-hidden"
      style={{ background: SCENE_BG[scene], color: dark ? '#f4ede2' : '#1d1a16' }}
    >
      <div className="absolute inset-0 origin-center transition-transform duration-[1800ms] ease-out" style={{ transform: doors === 'closed' ? 'scale(1.06)' : 'scale(1)' }}>
        {bg && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})`, opacity: 0.9 }} />}
        {/* luz del día/noche sobre el local */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: night ? 'rgba(12,22,48,0.42)' : dark ? 'rgba(0,0,0,0.0)' : 'radial-gradient(ellipse at 50% 0%, rgba(255,246,226,0.55), rgba(255,246,226,0) 70%)' }}
        />

        <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 px-4 pt-[max(14px,env(safe-area-inset-top))]">
          <button
            onClick={close}
            aria-label="Salir del local"
            className={`grid size-11 shrink-0 place-items-center rounded-full border backdrop-blur-md ${dark ? 'border-white/20 bg-black/35 text-white' : 'border-white/70 bg-white/60'}`}
          >
            <ChevronLeft className="size-5" />
          </button>
          {/* logo y nombre del local, en una pastilla que contrasta con cualquier fondo */}
          <div className={`flex min-w-0 items-center gap-3 rounded-full border py-1.5 pr-5 pl-1.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] backdrop-blur-xl ${pill}`}>
            <span className="grid shrink-0 place-items-center rounded-full bg-white p-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
              <StoreLogo store={store} size={40} round />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[14px] font-extrabold tracking-[0.14em] uppercase">{store.name}</div>
              {store.tagline && <div className="truncate text-[11px] font-semibold opacity-70">{store.tagline}</div>}
            </div>
          </div>
          {scene === 'service' ? <span className="size-11 shrink-0" /> : <CartButton dark={dark} />}
        </header>

        {tabs.length > 0 && (
          <nav aria-label="Categorías" className="scrollbar-none absolute inset-x-0 top-[calc(max(14px,env(safe-area-inset-top))+68px)] z-10 overflow-x-auto px-4 py-1">
            <div className="mx-auto flex w-max gap-1.5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  aria-pressed={tab === t.id}
                  onClick={() => {
                    setTab(t.id)
                    setIndex(0)
                  }}
                  className={`h-10 shrink-0 rounded-full px-4 text-[13px] font-bold transition ${tab === t.id ? (dark ? 'bg-[#f4ede2] text-[#2a1a0c] shadow-soft' : 'bg-[#1d1a16] text-white shadow-soft') : dark ? 'border border-white/25 bg-black/25 text-[#f1e4d2] backdrop-blur-md' : 'border border-white/80 bg-white/60 text-[#4a4338] backdrop-blur-md'}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </nav>
        )}

        {musicUrl !== null && (
          <button
            onClick={() => setMusicMuted(!muted, musicUrl)}
            aria-label={muted ? 'Activar la música del local' : 'Silenciar la música del local'}
            aria-pressed={!muted}
            className={`absolute left-4 z-10 grid size-11 place-items-center rounded-full border backdrop-blur-md ${dark ? 'border-white/20 bg-black/35 text-white' : 'border-white/70 bg-white/60 text-[#1d1a16]'}`}
            style={{ top: `calc(max(14px, env(safe-area-inset-top)) + ${TOP_BAR + 8}px)` }}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        )}

        {!cur ? (
          <div className="absolute inset-0 grid place-items-center px-8 text-center">
            <p className="text-sm font-semibold opacity-80">Este local todavía no tiene productos publicados.</p>
          </div>
        ) : scene === 'service' ? (
          <ServiceScene store={store} items={items} cur={cur} onPick={(i) => setIndex(i)} index={wrapIndex(index, n)} top={TOP_BAR} />
        ) : (
          <>
            <div
              ref={stageRef}
              className="absolute inset-x-0 bottom-[292px] touch-pan-y select-none"
              style={{ top: `calc(max(14px, env(safe-area-inset-top)) + ${TOP_BAR}px)` }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return
                drag.current = { x0: e.clientX, id: e.pointerId }
                setDragging(true)
              }}
              onPointerMove={(e) => {
                if (drag.current) setDragX(Math.max(-220, Math.min(220, e.clientX - drag.current.x0)))
              }}
              onPointerUp={(e) => {
                if (!drag.current) return
                const dx = e.clientX - drag.current.x0
                drag.current = null
                setDragging(false)
                setDragX(0)
                if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1)
              }}
              onPointerCancel={() => {
                drag.current = null
                setDragging(false)
                setDragX(0)
              }}
            >
              <Stage scene={scene} store={store} items={items} index={wrapIndex(index, n)} onGo={go} dragX={dragX} dragging={dragging} />
              {n > 1 && (
                <>
                  <Arrow side="left" dark={dark} onClick={() => go(-1)} />
                  <Arrow side="right" dark={dark} onClick={() => go(1)} />
                </>
              )}
            </div>
            <Dots n={n} i={wrapIndex(index, n)} dark={dark} />
            <Dock key={cur.id} store={store} product={cur} scene={scene} />
          </>
        )}
      </div>
      {doors !== 'gone' && <GlassDoors open={doors === 'open'} name={store.name} />}
    </div>
  )
}

/** Dos puertas automáticas de vidrio que se abren hacia los lados al entrar al local. */
function GlassDoors({ open, name }: { open: boolean; name: string }) {
  const leaf = (side: 'left' | 'right') => (
    <div
      className="absolute inset-y-0 w-1/2 overflow-hidden"
      style={{
        [side]: 0,
        transform: open ? `translateX(${side === 'left' ? '-101%' : '101%'})` : 'translateX(0)',
        transition: 'transform 1500ms cubic-bezier(0.65, 0, 0.25, 1)',
        background: 'linear-gradient(105deg, rgba(214,236,242,0.62) 0%, rgba(240,250,252,0.34) 45%, rgba(190,222,232,0.55) 100%)',
        backdropFilter: 'blur(5px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(5px) saturate(1.1)',
        boxShadow: `inset ${side === 'left' ? '-' : ''}10px 0 22px rgba(255,255,255,0.35)`,
      }}
    >
      {/* marco de aluminio */}
      <div className="absolute inset-y-0 w-[10px]" style={{ [side === 'left' ? 'left' : 'right']: 0, background: 'linear-gradient(90deg, #aab3ba, #e9eef1, #98a2aa)' }} />
      <div className="absolute inset-y-0 w-[14px]" style={{ [side === 'left' ? 'right' : 'left']: 0, background: 'linear-gradient(90deg, #8f99a1, #dfe6ea, #8f99a1)' }} />
      <div className="absolute inset-x-0 top-[9%] h-[8px]" style={{ background: 'linear-gradient(180deg, #e9eef1, #98a2aa)' }} />
      <div className="absolute inset-x-0 bottom-0 h-[6%]" style={{ background: 'linear-gradient(180deg, #c6ced4, #8c969e)' }} />
      {/* manija vertical */}
      <div
        className="absolute top-[42%] h-[16%] w-[7px] rounded-full"
        style={{ [side === 'left' ? 'right' : 'left']: 30, background: 'linear-gradient(90deg, #8f99a1, #f2f5f7, #8f99a1)', boxShadow: '0 0 6px rgba(0,0,0,0.25)' }}
      />
      {/* reflejo diagonal que cruza el vidrio */}
      <div
        className="absolute inset-y-0 w-[38%] -skew-x-[18deg]"
        style={{ left: side === 'left' ? '18%' : '40%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.28), rgba(255,255,255,0))' }}
      />
    </div>
  )
  return (
    <div className="absolute inset-0 z-40" aria-hidden style={{ pointerEvents: open ? 'none' : 'auto' }}>
      {leaf('left')}
      {leaf('right')}
      {/* rótulo sobre las puertas, que se va con ellas */}
      <div className="absolute inset-x-0 top-[38%] text-center transition-opacity duration-500" style={{ opacity: open ? 0 : 1 }}>
        <span className="inline-block rounded-full bg-[#1d1a16]/80 px-5 py-2 text-[12px] font-extrabold tracking-[0.2em] text-white uppercase backdrop-blur-md">{name}</span>
      </div>
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
      {count > 0 && (
        <span className="absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[11px] leading-[18px] font-extrabold text-white">
          {count}
        </span>
      )}
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
    <div className="absolute inset-x-0 bottom-[276px] z-10 flex justify-center gap-1.5" aria-hidden>
      {Array.from({ length: n }, (_, k) => (
        <span
          key={k}
          className="h-1.5 rounded-full transition-all"
          style={{ width: k === i ? 18 : 6, background: dark ? (k === i ? '#f2a33a' : 'rgba(255,255,255,0.3)') : k === i ? '#1d1a16' : 'rgba(29,26,22,0.25)' }}
        />
      ))}
    </div>
  )
}

/**
 * El escenario: un carrusel de verdad. Las tarjetas cercanas se deslizan juntas, despacio y con suavidad (se
 * mueven, se achican y se desvanecen según su distancia al centro) y siguen al dedo mientras se arrastra;
 * tocar una vecina la trae al centro.
 */
function Stage({
  scene,
  store,
  items,
  index,
  onGo,
  dragX,
  dragging,
}: {
  scene: Scene
  store: Store
  items: Product[]
  index: number
  onGo: (d: number) => void
  dragX: number
  dragging: boolean
}) {
  const plate = scene === 'restaurant'
  const n = items.length
  // las tarjetas que dan la vuelta (de un extremo al otro) se acomodan sin recorrer la pantalla
  const last = useRef(new Map<string, number>())
  const prev = last.current
  const next = new Map<string, number>()
  const nodes = items.map((p, i) => {
    const rel = relPos(i, index, n)
    next.set(p.id, rel)
    const d = Math.abs(rel)
    if (d > 2) return null
    const was = prev.get(p.id)
    const jumped = was !== undefined && Math.abs(rel - was) > 2
    const side = d === 1
    return (
      <div
        key={p.id}
        onClick={side ? () => onGo(rel) : undefined}
        aria-hidden={d !== 0}
        className={`absolute top-1/2 left-1/2 will-change-transform ${plate ? 'rounded-full p-[7%]' : 'rounded-[28px] border border-white/80 bg-white/40 p-1.5 backdrop-blur-xl'}`}
        style={{
          width: 'var(--w)',
          // el plato es siempre un círculo (alto = ancho), aunque la foto sea vertical; la tarjeta, un rectángulo
          ...(plate ? { height: 'var(--w)' } : { aspectRatio: '0.72', maxHeight: '98%' }),
          zIndex: 10 - d,
          opacity: d === 0 ? 1 : d === 1 ? 0.7 : 0,
          transform: `translate(calc(-50% + ${rel} * var(--w) * 0.9 + ${dragX}px), -50%) perspective(1200px) rotateY(${-rel * 14}deg) scale(${d === 0 ? 1 : d === 1 ? 0.8 : 0.62})`,
          transition: dragging || jumped ? 'none' : 'transform 760ms cubic-bezier(0.33, 0, 0.15, 1), opacity 560ms ease-out',
          boxShadow: plate
            ? d === 0
              ? '0 40px 60px -22px rgba(0,0,0,0.75), 0 14px 22px -10px rgba(0,0,0,0.5)'
              : 'none'
            : d === 0
              ? '0 46px 70px -24px rgba(50,40,80,0.55), 0 18px 28px -12px rgba(50,40,80,0.35), inset 0 1px 0 rgba(255,255,255,0.9)'
              : '0 24px 40px -22px rgba(50,40,80,0.35), inset 0 1px 0 rgba(255,255,255,0.7)',
          cursor: side ? 'pointer' : 'default',
          pointerEvents: d === 2 ? 'none' : 'auto',
        }}
      >
        {plate ? (
          <>
            {/* plato: borde de loza, surco y la comida adentro */}
            <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 34% 28%, #ffffff 0%, #f6f0e6 45%, #ddd2bf 100%)' }} />
            <span aria-hidden className="absolute inset-[3.5%] rounded-full border border-black/[0.07]" style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.9)' }} />
            <span className="relative block size-full overflow-hidden rounded-full" style={{ boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.08), inset 0 6px 14px rgba(0,0,0,0.22)' }}>
              <ProductImage product={p} brandColor={store.brandColor} className="absolute inset-0 size-full object-cover" />
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.28), rgba(255,255,255,0) 46%)' }} />
            </span>
          </>
        ) : (
          <ProductImage product={p} brandColor={store.brandColor} className="size-full rounded-[22px] object-contain" />
        )}
        {/* brillo de vidrio sobre la tarjeta */}
        {!plate && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[27px]"
            style={{ background: 'linear-gradient(120deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.18) 100%)' }}
          />
        )}
      </div>
    )
  })
  useLayoutEffect(() => {
    last.current = next
  })
  return (
    <div
      className="relative mx-auto h-full w-full max-w-3xl"
      style={{ ['--w' as string]: plate ? 'min(78vw, calc((100dvh - 440px) * 0.96), 520px)' : 'min(66vw, calc((100dvh - 440px) * 0.7), 470px)' }}
    >
      {nodes}
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
    <div
      className={`absolute inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] z-10 mx-auto max-w-xl animate-[dockIn_.3s_ease-out] rounded-[30px] border p-4 backdrop-blur-xl ${dark ? 'border-white/10 bg-[#f7efe4]/95 text-[#2a1a0c]' : 'border-white/90 bg-white/75 text-[#1d1a16]'}`}
      style={{ boxShadow: '0 20px 44px -14px rgba(0,0,0,0.5)' }}
    >
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
            <button
              key={v.id}
              aria-pressed={variantId === v.id}
              onClick={() => setVariant(v.id)}
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-bold ${variantId === v.id ? 'border-transparent bg-[#1d1a16] text-white' : 'border-black/15 bg-white/70'}`}
            >
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
              <button
                key={s}
                disabled={out}
                aria-pressed={size === s}
                onClick={() => setSize(s)}
                className={`h-11 min-w-11 rounded-[14px] border px-2 text-[13px] font-bold disabled:line-through disabled:opacity-40 ${size === s ? 'border-transparent bg-[#1d1a16] text-white' : 'border-black/15 bg-white'}`}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2.5">
        {scene === 'restaurant' && (
          <div className="flex h-[52px] items-center rounded-full bg-black/[0.07] px-1">
            <button aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-11 place-items-center rounded-full">
              <Minus className="size-4" />
            </button>
            <span className="w-6 text-center text-base font-extrabold">{qty}</span>
            <button aria-label="Más" onClick={() => setQty((q) => Math.min(20, q + 1))} className="grid size-11 place-items-center rounded-full">
              <Plus className="size-4" />
            </button>
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
        <button
          onClick={() => useUI.getState().openProduct(product.id)}
          aria-label="Ver detalles"
          className={`h-[52px] shrink-0 rounded-full border px-4 text-[13px] font-bold ${dark ? 'border-black/20' : 'border-black/15 bg-white/70'}`}
        >
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
    <div
      className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-xl flex-col px-4 pb-[max(14px,env(safe-area-inset-bottom))]"
      style={{ top: `calc(max(14px, env(safe-area-inset-top)) + ${top}px)` }}
    >
      <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#9fb7b8]">ELIGE EL SERVICIO</p>
      <ul className="mt-2.5 flex-1 space-y-2 overflow-y-auto pb-3">
        {items.map((p, i) => {
          const on = i === index
          const price = priceOf(p).final
          return (
            <li key={p.id}>
              <button
                onClick={() => onPick(i)}
                aria-pressed={on}
                className={`flex min-h-[60px] w-full items-center justify-between gap-3 rounded-[20px] px-4 py-2.5 text-left ${on ? 'border-2 border-[#4fd1c1] bg-[#4fd1c1]/15' : 'border border-white/15 bg-white/[0.06]'}`}
              >
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
