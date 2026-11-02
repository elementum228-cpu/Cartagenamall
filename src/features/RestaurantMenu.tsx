import { Plus, ShoppingBag } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATEGORY_BY_ID } from '../config/mall'
import type { Product, Store } from '../domain/types'
import { needsOptions, totalStock } from '../lib/inventory'
import { addToCart } from '../state/actions'
import { useCart } from '../state/cart'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { Price, PromoBadge, SectionTitle } from '../ui/bits'
import { ProductImage } from '../ui/ProductImage'

/** Menú del restaurante para el cliente: platos agrupados por tipo, con precio y botón para agregar al pedido. */
export function RestaurantMenu({ store, products }: { store: Store; products: Product[] }) {
  const open = store.status === 'open'
  const groups = useMemo(() => {
    const by = new Map<string, Product[]>()
    for (const p of products) by.set(p.categoryId, [...(by.get(p.categoryId) ?? []), p])
    return [...by.entries()]
  }, [products])
  const inCart = useCart((s) => s.items.filter((i) => i.storeId === store.id).reduce((a, i) => a + i.qty, 0))
  const navigate = useNavigate()

  return (
    <section className="space-y-4">
      <SectionTitle aside={<span className="text-xs text-ink-soft">{products.length} platos</span>}>Menú</SectionTitle>
      {!open && (
        <p className="rounded-2xl bg-amber-100 px-3.5 py-2.5 text-xs font-semibold text-amber-900">Este local está cerrado ahora: puedes ver el menú, pero no recibe pedidos.</p>
      )}
      {!products.length && <p className="rounded-2xl bg-sand p-4 text-sm text-ink-soft">Este restaurante aún no ha publicado su menú.</p>}
      {groups.map(([cat, items]) => (
        <div key={cat}>
          {groups.length > 1 && <p className="mb-1.5 text-[12px] font-bold tracking-wide text-ink-soft uppercase">{CATEGORY_BY_ID[cat]?.name ?? cat}</p>}
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card">
            {items.map((p) => (
              <Dish key={p.id} product={p} store={store} open={open} />
            ))}
          </ul>
        </div>
      ))}
      {inCart > 0 && (
        <button
          className="sticky bottom-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3.5 text-sm font-bold text-white shadow-soft transition active:scale-[0.98]"
          onClick={() => {
            useUI.getState().selectSpace(null)
            useUI.getState().openStore(null)
            navigate('/carrito')
          }}
        >
          <ShoppingBag className="size-4" /> Ver mi pedido · {inCart} {inCart === 1 ? 'plato' : 'platos'}
        </button>
      )}
    </section>
  )
}

function Dish({ product, store, open }: { product: Product; store: Store; open: boolean }) {
  const { priceOf } = usePricing()
  const info = priceOf(product)
  const openProduct = useUI((s) => s.openProduct)
  const soldOut = totalStock(product) === 0
  const options = needsOptions(product)
  return (
    <li className="flex gap-3 p-3">
      <button onClick={() => openProduct(product.id)} className="shrink-0" aria-label={`Ver ${product.name}`}>
        <ProductImage product={product} brandColor={store.brandColor} className="size-20 rounded-2xl" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-1.5">
          <button onClick={() => openProduct(product.id)} className="min-w-0 flex-1 text-left text-[14.5px] leading-snug font-bold">
            {product.name}
          </button>
          <PromoBadge info={info} />
        </div>
        {product.description && <p className="line-clamp-2 text-xs leading-snug text-ink-soft">{product.description}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <Price info={info} size="sm" />
          {soldOut ? (
            <span className="rounded-full bg-ink/[0.07] px-2.5 py-1 text-[11px] font-bold text-ink-soft">Agotado</span>
          ) : (
            <button
              onClick={() => (options ? openProduct(product.id) : addToCart(product, null, null))}
              disabled={!open}
              className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-soft transition active:scale-95 disabled:opacity-35"
              aria-label={options ? `Elegir opciones de ${product.name}` : `Agregar ${product.name} al pedido`}
            >
              <Plus className="size-4" /> {options ? 'Opciones' : 'Agregar'}
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
