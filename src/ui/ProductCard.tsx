import { Heart, Plus, Scale } from 'lucide-react'
import type { Product, Store } from '../domain/types'
import { needsOptions, totalStock } from '../lib/inventory'
import { addToCart, toggleCompare } from '../state/actions'
import { usePersonal } from '../state/personal'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { Price, PromoBadge } from './bits'
import { ProductImage } from './ProductImage'
import { DEMO } from '../demo/flag'

export function ProductCard({ product, store, compact = false }: { product: Product; store: Store; compact?: boolean }) {
  const { priceOf } = usePricing()
  const info = priceOf(product)
  const openProduct = useUI((s) => s.openProduct)
  const fav = usePersonal((s) => s.favoriteProducts.includes(product.id))
  const comparing = usePersonal((s) => s.compare.includes(product.id))
  const toggleFav = usePersonal((s) => s.toggleFavoriteProduct)
  const soldOut = totalStock(product) === 0

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-card ${compact ? 'w-40 shrink-0' : ''}`}>
      <button onClick={() => openProduct(product.id)} className="text-left" aria-label={`Ver ${product.name}`}>
        <ProductImage product={product} brandColor={store.brandColor} className="aspect-[4/3] w-full" />
      </button>
      <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
        {!DEMO && <PromoBadge info={info} />}
        {soldOut && <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-bold text-white">Agotado</span>}
      </div>
      {!DEMO && <div className="absolute top-2 right-2 flex flex-col gap-1.5">
        <button
          onClick={() => toggleFav(product.id)}
          className={`grid size-8 place-items-center rounded-full bg-white/90 shadow-soft backdrop-blur transition active:scale-90 ${fav ? 'text-coral' : 'text-ink-soft'}`}
          aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          aria-pressed={fav}
        >
          <Heart className="size-4" fill={fav ? 'currentColor' : 'none'} />
        </button>
        {!compact && (
          <button
            onClick={() => toggleCompare(product.id)}
            className={`grid size-8 place-items-center rounded-full shadow-soft backdrop-blur transition active:scale-90 ${comparing ? 'bg-ink text-white' : 'bg-white/90 text-ink-soft'}`}
            aria-label={comparing ? 'Quitar del comparador' : 'Agregar al comparador'}
            aria-pressed={comparing}
          >
            <Scale className="size-4" />
          </button>
        )}
      </div>}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate text-[11px] font-bold tracking-wide uppercase" style={{ color: store.brandColor }}>
          {store.name}
        </p>
        <button onClick={() => openProduct(product.id)} className="line-clamp-2 text-left text-[13.5px] leading-snug font-semibold">
          {product.name}
        </button>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price info={info} size="sm" />
          {!DEMO && <button
            onClick={() => (needsOptions(product) ? openProduct(product.id) : addToCart(product, null, null))}
            disabled={soldOut}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white shadow-soft transition hover:bg-brand-dark active:scale-90 disabled:opacity-35"
            aria-label={needsOptions(product) ? `Elegir opciones de ${product.name}` : `Agregar ${product.name} al carrito`}
          >
            <Plus className="size-5" />
          </button>}
        </div>
      </div>
    </article>
  )
}
