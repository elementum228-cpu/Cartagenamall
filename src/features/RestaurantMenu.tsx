import { Plus, ShoppingBag } from 'lucide-react'
import { productDesc } from '../lib/desc'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product, Store } from '../domain/types'
import { needsOptions, totalStock } from '../lib/inventory'
import { groupProducts } from '../lib/storeCategories'
import { addToCart } from '../state/actions'
import { useCart } from '../state/cart'
import { useCatalog } from '../state/catalog'
import { formatCOP } from '../lib/format'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { Price, PromoBadge, SectionTitle } from '../ui/bits'
import { ProductImage } from '../ui/ProductImage'

/** Menú del restaurante para el cliente: platos agrupados por tipo, con precio y botón para agregar al pedido. */
export function RestaurantMenu({ store, products, hideTitle = false }: { store: Store; products: Product[]; hideTitle?: boolean }) {
  const open = store.status === 'open'
  // categorías propias del restaurante (Entradas, Platos fuertes...) o, sin ellas, su rubro
  const groups = useMemo(() => groupProducts(store, products), [store, products])
  const cartItems = useCart((s) => s.items)
  const all = useCatalog((s) => s.products)
  const { priceOf } = usePricing()
  const mine = cartItems.filter((i) => i.storeId === store.id)
  const inCart = mine.reduce((a, i) => a + i.qty, 0)
  // total del pedido de este restaurante, con las promociones vigentes
  const total = mine.reduce((sum, i) => {
    const prod = all.find((p) => p.id === i.productId)
    return prod ? sum + priceOf(prod).final * i.qty : sum
  }, 0)
  const navigate = useNavigate()

  return (
    <section className="space-y-4">
      {!hideTitle && <SectionTitle aside={<span className="text-xs text-ink-soft">{products.length} platos</span>}>Menú</SectionTitle>}
      {!open && (
        <p className="rounded-2xl bg-amber-100 px-3.5 py-2.5 text-xs font-semibold text-amber-900">Este local está cerrado ahora: puedes ver el menú, pero no recibe pedidos.</p>
      )}
      {!products.length && <p className="rounded-2xl bg-sand p-4 text-sm text-ink-soft">Este restaurante aún no ha publicado su menú.</p>}
      {groups.map(({ group, items }) => (
        <div key={group.id}>
          {groups.length > 1 && <p className="mb-0.5 text-[11.5px] font-extrabold tracking-[0.1em] text-ink-soft uppercase">{group.name}</p>}
          <ul className="divide-y divide-line">
            {items.map((p) => (
              <Dish key={p.id} product={p} store={store} open={open} />
            ))}
          </ul>
        </div>
      ))}
      {inCart > 0 && (
        <button
          className="sticky bottom-2 flex h-[58px] w-full items-center rounded-full bg-brand pr-2 pl-5 text-white shadow-[0_16px_30px_-10px_rgba(15,118,110,0.7)] transition active:scale-[0.98]"
          onClick={() => {
            useUI.getState().selectSpace(null)
            useUI.getState().openStore(null)
            navigate('/carrito')
          }}
        >
          <span className="flex flex-1 items-center gap-2.5 text-[15px] font-extrabold">
            <span className="grid size-[26px] place-items-center rounded-full bg-white/25 text-[13px]">{inCart}</span>
            <ShoppingBag className="size-4" /> Ver mi pedido
          </span>
          <span className="grid h-[42px] place-items-center rounded-full bg-white px-[18px] text-[15.5px] font-extrabold text-brand">{formatCOP(total)}</span>
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
    <li className="flex items-center gap-3.5 py-3.5">
      <button onClick={() => openProduct(product.id)} className="shrink-0 rounded-full ring-[3px] ring-sand" aria-label={`Ver ${product.name}`}>
        <ProductImage product={product} brandColor={store.brandColor} className="size-[68px] rounded-full" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <div className="flex items-start gap-1.5">
          <button onClick={() => openProduct(product.id)} className="min-w-0 flex-1 text-left text-[15px] leading-snug font-extrabold">
            {product.name}
          </button>
          <PromoBadge info={info} />
        </div>
        {productDesc(product) && <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-soft">{productDesc(product)}</p>}
        <div className="mt-1.5">
          {soldOut ? (
            <span className="text-[12.5px] font-bold text-ink-soft">Agotado hoy</span>
          ) : (
            <span className="text-brand [&_*]:text-brand">
              <Price info={info} size="sm" />
            </span>
          )}
        </div>
      </div>
      {!soldOut && (
        <button
          onClick={() => (options ? openProduct(product.id) : addToCart(product, null, null))}
          disabled={!open}
          className={`grid h-10 shrink-0 place-items-center rounded-full border-2 border-brand text-brand transition active:scale-95 disabled:opacity-35 ${options ? 'px-3.5 text-[12.5px] font-extrabold' : 'w-10'}`}
          aria-label={options ? `Elegir opciones de ${product.name}` : `Agregar ${product.name} al pedido`}
        >
          {options ? 'Opciones' : <Plus className="size-[18px]" strokeWidth={2.8} />}
        </button>
      )}
    </li>
  )
}
