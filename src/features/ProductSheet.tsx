import { Heart, Minus, Plus, Scale, ShoppingBag, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CATEGORY_BY_ID } from '../config/mall'
import type { Product } from '../domain/types'
import { stockFor, totalStock } from '../lib/inventory'
import { addToCart, toggleCompare } from '../state/actions'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { usePersonal } from '../state/personal'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { Countdown, Price, PromoBadge, SectionTitle, StoreLogo, btn } from '../ui/bits'
import { ProductCard } from '../ui/ProductCard'
import { ProductImage } from '../ui/ProductImage'
import { Sheet } from '../ui/Sheet'

export function ProductSheet() {
  const id = useUI((s) => s.productSheetId)
  const { productById } = useCatalogMaps()
  const product = id ? productById[id] : undefined
  return (
    <Sheet open={!!product} onClose={() => useUI.getState().openProduct(null)} title={product?.name ?? 'Producto'} modal z={60} desktopWidth={460}>
      {product && <Body key={product.id} product={product} />}
    </Sheet>
  )
}

function Body({ product }: { product: Product }) {
  const { storeById } = useCatalogMaps()
  const products = useCatalog((s) => s.products)
  const store = storeById[product.storeId]
  const { priceOf } = usePricing()
  const info = priceOf(product)
  const [variantId, setVariant] = useState<string | null>(product.variants[0]?.id ?? null)
  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const fav = usePersonal((s) => s.favoriteProducts.includes(product.id))
  const comparing = usePersonal((s) => s.compare.includes(product.id))
  const toggleFav = usePersonal((s) => s.toggleFavoriteProduct)
  const openStore = useUI((s) => s.openStore)
  const selectedSpaceId = useUI((s) => s.selectedSpaceId)

  const needsSize = product.sizes.length > 0
  const available = needsSize && !size ? null : stockFor(product, variantId, size)
  const similar = useMemo(
    () =>
      products
        .filter((p) => p.id !== product.id && p.active && p.storeId !== product.storeId && (p.compareGroup ? p.compareGroup === product.compareGroup : p.categoryId === product.categoryId))
        .slice(0, 6),
    [products, product],
  )

  return (
    <div className="pb-8">
      <div className="relative">
        <ProductImage product={product} brandColor={store.brandColor} className="aspect-[16/10] w-full" />
        <div className="absolute top-3 left-3">
          <PromoBadge info={info} />
        </div>
      </div>
      <div className="space-y-5 px-5 pt-4">
        <div>
          <button
            className="mb-2 flex items-center gap-2 text-left"
            onClick={() => {
              // Desde el mapa la ficha de la tienda ya está debajo; en Comprar se abre.
              if (!selectedSpaceId) openStore(store.id)
              useUI.getState().openProduct(null)
            }}
          >
            <StoreLogo store={store} size={28} />
            <span className="text-sm font-bold" style={{ color: store.brandColor }}>
              {store.name}
            </span>
            <span className="text-xs text-ink-soft">· {CATEGORY_BY_ID[product.categoryId]?.name}</span>
          </button>
          <h2 className="text-xl leading-tight font-extrabold tracking-tight">{product.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Price info={info} size="lg" />
            {info.promotion?.type === 'flash' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sun/25 px-2.5 py-1 text-xs font-bold">
                <Zap className="size-3.5" /> <Countdown endsAt={info.promotion.endsAt} />
              </span>
            )}
          </div>
          {info.promotion?.code && <p className="mt-1 text-xs font-semibold text-ink-soft">Código guardado: {info.promotion.code}</p>}
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">{product.description}</p>

        {product.variants.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold">
              Opción: <span className="font-medium text-ink-soft">{product.variants.find((v) => v.id === variantId)?.name}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => {
                const out = product.sizes.length ? product.sizes.every((s) => stockFor(product, v.id, s) === 0) : stockFor(product, v.id, null) === 0
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setVariant(v.id)
                      setQty(1)
                    }}
                    aria-pressed={variantId === v.id}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-semibold transition ${variantId === v.id ? 'border-ink bg-ink text-white' : 'border-line bg-white'} ${out ? 'opacity-45' : ''}`}
                  >
                    {v.swatch && <span className="size-4 rounded-full border border-black/10" style={{ background: v.swatch }} />}
                    {v.name}
                    {out && <span className="text-[10px]">(agotado)</span>}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {needsSize && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Talla</legend>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => {
                const n = stockFor(product, variantId, s)
                return (
                  <button
                    key={s}
                    disabled={n === 0}
                    onClick={() => {
                      setSize(s)
                      setQty(1)
                    }}
                    aria-pressed={size === s}
                    className={`min-w-12 rounded-xl border px-3 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:line-through disabled:opacity-35 ${size === s ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <p className="text-xs font-semibold text-ink-soft">
          {totalStock(product) === 0
            ? 'Agotado'
            : available === null
              ? 'Elige una talla para ver disponibilidad.'
              : available === 0
                ? 'Agotado en esta opción.'
                : available <= 3
                  ? `¡Últimas ${available} unidades!`
                  : `${available} disponibles (inventario de demostración)`}
        </p>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-2xl border border-line bg-white">
            <button className="grid size-11 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Restar uno">
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center font-bold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button className="grid size-11 place-items-center" onClick={() => setQty((q) => Math.min(available ?? 1, q + 1))} aria-label="Sumar uno" disabled={!available || qty >= available}>
              <Plus className="size-4" />
            </button>
          </div>
          <button
            className={`${btn.primary} flex-1`}
            disabled={!available}
            onClick={() => {
              if (addToCart(product, variantId, size, qty)) useUI.getState().openProduct(null)
            }}
          >
            <ShoppingBag className="size-4" /> Agregar al carrito
          </button>
        </div>
        <div className="flex gap-2">
          <button className={`${btn.secondary} flex-1`} onClick={() => toggleFav(product.id)} aria-pressed={fav}>
            <Heart className={`size-4 ${fav ? 'text-coral' : ''}`} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'Guardado' : 'Favorito'}
          </button>
          <button className={`${btn.secondary} flex-1`} onClick={() => toggleCompare(product.id)} aria-pressed={comparing}>
            <Scale className="size-4" /> {comparing ? 'En comparador' : 'Comparar'}
          </button>
        </div>

        {similar.length > 0 && (
          <section className="pt-2">
            <SectionTitle>Similares en otras tiendas</SectionTitle>
            <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {similar.map((p) => (
                <ProductCard key={p.id} product={p} store={storeById[p.storeId]} compact />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
