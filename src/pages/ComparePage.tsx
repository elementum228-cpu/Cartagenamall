import { Scale, X } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { totalStock } from '../lib/inventory'
import { toggleCompare } from '../state/actions'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { MAX_COMPARE, usePersonal } from '../state/personal'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { Countdown, EmptyState, Price, PromoBadge, SectionTitle, btn } from '../ui/bits'
import { ProductCard } from '../ui/ProductCard'
import { ProductImage } from '../ui/ProductImage'

export function ComparePage() {
  const ids = usePersonal((s) => s.compare)
  const clear = usePersonal((s) => s.clearCompare)
  const products = useCatalog((s) => s.products)
  const { productById, storeById } = useCatalogMaps()
  const { priceOf } = usePricing()
  const openProduct = useUI((s) => s.openProduct)
  const items = ids.map((id) => productById[id]).filter(Boolean)

  const suggestions = useMemo(() => {
    const groups = new Set(items.map((p) => p.compareGroup).filter(Boolean))
    return products.filter((p) => p.active && !ids.includes(p.id) && p.compareGroup && groups.has(p.compareGroup)).slice(0, 8)
  }, [items, products, ids])

  if (!items.length)
    return (
      <EmptyState icon={<Scale className="size-7" />} title="Compara productos" action={<Link to="/comprar?q=camiseta" className={btn.primary}>Comparar camisetas</Link>}>
        Toca el ícono de balanza en hasta {MAX_COMPARE} productos para verlos lado a lado.
      </EmptyState>
    )

  const rows: { label: string; render: (i: number) => ReactNode }[] = [
    { label: 'Precio', render: (i) => <Price info={priceOf(items[i])} /> },
    { label: 'Tienda', render: (i) => <span className="font-semibold" style={{ color: storeById[items[i].storeId]?.brandColor }}>{storeById[items[i].storeId]?.name}</span> },
    {
      label: 'Promoción',
      render: (i) => {
        const info = priceOf(items[i])
        return info.promotion ? (
          <div className="space-y-1">
            <PromoBadge info={info} />
            {info.promotion.endsAt && <Countdown endsAt={info.promotion.endsAt} className="block" />}
          </div>
        ) : (
          <span className="text-ink-soft">—</span>
        )
      },
    },
    { label: 'Variantes', render: (i) => <span>{items[i].variants.map((v) => v.name).join(', ') || '—'}</span> },
    { label: 'Tallas', render: (i) => <span>{items[i].sizes.join(', ') || '—'}</span> },
    {
      label: 'Disponibilidad',
      render: (i) => {
        const n = totalStock(items[i])
        return <span className={n ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>{n ? `${n} unidades` : 'Agotado'}</span>
      },
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 pb-28 md:pb-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Comparador</h1>
          <p className="text-sm text-ink-soft">
            {items.length} de {MAX_COMPARE} productos
          </p>
        </div>
        <button className={btn.ghost} onClick={clear}>
          Vaciar
        </button>
      </div>
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4">
        <table style={{ maxWidth: 120 + items.length * 260 }} className="w-full min-w-[560px] table-fixed border-separate border-spacing-0 overflow-hidden rounded-3xl border border-line bg-card text-sm">
          <thead>
            <tr>
              <th className="w-28 p-3" />
              {items.map((p) => (
                <th key={p.id} className="p-3 text-left align-top font-normal">
                  <div className="relative">
                    <button onClick={() => openProduct(p.id)} className="block w-full">
                      <ProductImage product={p} brandColor={storeById[p.storeId]?.brandColor ?? '#888'} className="aspect-[4/3] w-full rounded-2xl" />
                    </button>
                    <button onClick={() => toggleCompare(p.id)} className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-white/90 shadow-soft" aria-label={`Quitar ${p.name}`}>
                      <X className="size-4" />
                    </button>
                  </div>
                  <button onClick={() => openProduct(p.id)} className="mt-2 line-clamp-2 text-left text-[13px] font-bold">
                    {p.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th className="border-t border-line bg-sand/50 p-3 text-left text-xs font-bold text-ink-soft">{r.label}</th>
                {items.map((p, i) => (
                  <td key={p.id} className="border-t border-line p-3 align-top">
                    {r.render(i)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th className="border-t border-line bg-sand/50 p-3" />
              {items.map((p) => (
                <td key={p.id} className="border-t border-line p-3">
                  <button className={`${btn.primary} w-full px-3 py-2.5 text-xs`} onClick={() => openProduct(p.id)} disabled={!totalStock(p)}>
                    Elegir y agregar
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {suggestions.length > 0 && items.length < MAX_COMPARE && (
        <section className="mt-8">
          <SectionTitle>Similares para agregar al comparador</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {suggestions.map((p) => (
              <ProductCard key={p.id} product={p} store={storeById[p.storeId]} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
