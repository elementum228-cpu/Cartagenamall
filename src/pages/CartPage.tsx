import { AlertCircle, Info, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { formatCOP } from '../lib/format'
import { stockFor } from '../lib/inventory'
import { groupByStore, validateCart } from '../services/orders'
import { useCart } from '../state/cart'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { usePricing } from '../state/pricing'
import { EmptyState, PromoBadge, StoreLogo, btn } from '../ui/bits'
import { ProductImage } from '../ui/ProductImage'

/** Hook compartido por carrito y checkout: agrupa, valida y totaliza. */
export function useCartSummary() {
  const items = useCart((s) => s.items)
  const promotions = useCatalog((s) => s.promotions)
  const { productById, storeById } = useCatalogMaps()
  const { priceOf } = usePricing()
  return useMemo(() => {
    const issues = validateCart(items, { products: productById, stores: storeById, promotions })
    const issueByKey = Object.fromEntries(issues.map((i) => [i.key, i]))
    const groups = groupByStore(items).map((g) => {
      const lines = g.items.map((it) => {
        const product = productById[it.productId]
        const price = product ? priceOf(product) : null
        return { it, product, price, total: (price?.final ?? 0) * it.qty, issue: issueByKey[it.key] }
      })
      return { store: storeById[g.storeId], lines, subtotal: lines.reduce((a, l) => a + l.total, 0) }
    })
    const savings = groups.flatMap((g) => g.lines).reduce((a, l) => a + (l.price ? (l.price.original - l.price.final) * l.it.qty : 0), 0)
    return { items, groups, issues, total: groups.reduce((a, g) => a + g.subtotal, 0), savings }
  }, [items, promotions, productById, storeById, priceOf])
}

export function CartPage() {
  const { groups, issues, total, savings, items } = useCartSummary()
  const navigate = useNavigate()

  if (!items.length)
    return (
      <EmptyState
        icon={<ShoppingBag className="size-7" />}
        title="Tu carrito está vacío"
        action={
          <div className="flex gap-2">
            <Link to="/" className={btn.secondary}>
              Explorar el mall
            </Link>
            <Link to="/comprar" className={btn.primary}>
              Ir a comprar
            </Link>
          </div>
        }
      >
        Agrega productos de distintas tiendas: todo llega a un solo carrito.
      </EmptyState>
    )

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 pt-5 pb-32 md:grid-cols-[1fr_340px] md:pb-10">
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Carrito universal</h1>
        <p className="-mt-2 text-sm text-ink-soft">
          {items.reduce((a, i) => a + i.qty, 0)} productos de {groups.length} {groups.length === 1 ? 'tienda' : 'tiendas'}
        </p>
        {groups.map((g) => (
          <section key={g.store?.id ?? 'x'} className="overflow-hidden rounded-3xl border border-line bg-card">
            <header className="flex items-center gap-3 border-b border-line px-4 py-3" style={{ background: g.store ? `${g.store.accentColor}` : undefined }}>
              {g.store && <StoreLogo store={g.store} size={36} />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{g.store?.name ?? 'Tienda no disponible'}</p>
                <p className="text-xs text-ink-soft">Suborden independiente · la tienda confirma su parte</p>
              </div>
            </header>
            <ul className="divide-y divide-line">
              {g.lines.map((l) => (
                <CartLine key={l.it.key} {...l} brandColor={g.store?.brandColor ?? '#888'} />
              ))}
            </ul>
            <footer className="flex items-center justify-between bg-sand/60 px-4 py-3 text-sm">
              <span className="text-ink-soft">Subtotal {g.store?.name}</span>
              <span className="font-extrabold">{formatCOP(g.subtotal)}</span>
            </footer>
          </section>
        ))}
      </div>

      <aside className="md:sticky md:top-[calc(var(--chrome-top)+8px)] md:self-start">
        <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
          {groups.map((g) => (
            <div key={g.store?.id} className="flex justify-between text-sm">
              <span className="text-ink-soft">{g.store?.name}</span>
              <span className="font-semibold">{formatCOP(g.subtotal)}</span>
            </div>
          ))}
          {savings > 0 && (
            <div className="flex justify-between text-sm font-semibold text-brand">
              <span>Ahorro por promociones</span>
              <span>−{formatCOP(savings)}</span>
            </div>
          )}
          <div className="flex items-end justify-between border-t border-line pt-3">
            <span className="font-bold">Total estimado</span>
            <span className="text-2xl font-extrabold tracking-tight">{formatCOP(total)}</span>
          </div>
          <p className="flex gap-2 rounded-2xl bg-sand p-3 text-xs text-ink-soft">
            <Info className="mt-0.5 size-4 shrink-0" /> No se realiza ningún cobro. Cada tienda confirmará precio, inventario y entrega antes de cobrar.
          </p>
          {issues.length > 0 && (
            <p className="flex gap-2 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> Ajusta los productos marcados para continuar.
            </p>
          )}
          <button className={`${btn.primary} w-full`} disabled={issues.length > 0} onClick={() => navigate('/checkout')}>
            Continuar con el pedido
          </button>
        </div>
      </aside>
    </div>
  )
}

function CartLine({ it, product, price, total, issue, brandColor }: ReturnType<typeof useCartSummary>['groups'][number]['lines'][number] & { brandColor: string }) {
  const setQty = useCart((s) => s.setQty)
  const remove = useCart((s) => s.remove)
  if (!product || !price)
    return (
      <li className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="text-ink-soft">Producto no disponible</span>
        <button className={btn.ghost} onClick={() => remove(it.key)}>
          Quitar
        </button>
      </li>
    )
  const max = stockFor(product, it.variantId, it.size)
  const variant = product.variants.find((v) => v.id === it.variantId)
  return (
    <li className="flex gap-3 px-4 py-3.5">
      <ProductImage product={product} brandColor={brandColor} className="size-[72px] shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-snug font-semibold">{product.name}</p>
          <button onClick={() => remove(it.key)} className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-ink/5" aria-label={`Eliminar ${product.name}`}>
            <Trash2 className="size-4" />
          </button>
        </div>
        <p className="text-xs text-ink-soft">
          {[variant?.name, it.size && `Talla ${it.size}`].filter(Boolean).join(' · ') || 'Única'}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <PromoBadge info={price} />
          <span className="text-xs text-ink-soft">{formatCOP(price.final)} c/u</span>
        </div>
        {issue && <p className="mt-1 text-xs font-semibold text-red-600">{issue.message}</p>}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center rounded-xl border border-line bg-white">
            <button className="grid size-9 place-items-center" onClick={() => setQty(it.key, it.qty - 1)} aria-label="Restar uno">
              <Minus className="size-4" />
            </button>
            <span className="w-7 text-center text-sm font-bold tabular-nums">{it.qty}</span>
            <button className="grid size-9 place-items-center disabled:opacity-30" onClick={() => setQty(it.key, it.qty + 1)} disabled={it.qty >= max} aria-label="Sumar uno">
              <Plus className="size-4" />
            </button>
          </div>
          {issue && issue.available > 0 && (
            <button className="text-xs font-bold text-brand" onClick={() => setQty(it.key, issue.available)}>
              Ajustar a {issue.available}
            </button>
          )}
          <span className="font-extrabold">{formatCOP(total)}</span>
        </div>
      </div>
    </li>
  )
}

