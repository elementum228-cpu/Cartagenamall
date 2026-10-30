import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCatalogMaps } from '../state/catalog'
import { usePersonal } from '../state/personal'
import { useUI } from '../state/ui'
import { EmptyState, SectionTitle, StoreLogo, btn } from '../ui/bits'
import { ProductCard } from '../ui/ProductCard'

export function FavoritesPage() {
  const favStores = usePersonal((s) => s.favoriteStores)
  const favProducts = usePersonal((s) => s.favoriteProducts)
  const { storeById, productById } = useCatalogMaps()
  const openStore = useUI((s) => s.openStore)
  const stores = favStores.map((id) => storeById[id]).filter(Boolean)
  const products = favProducts.map((id) => productById[id]).filter(Boolean)

  if (!stores.length && !products.length)
    return (
      <EmptyState icon={<Heart className="size-7" />} title="Nada guardado todavía" action={<Link to="/" className={btn.primary}>Explorar tiendas</Link>}>
        Usa el corazón en tiendas y productos para encontrarlos rápido.
      </EmptyState>
    )

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-5 pb-28 md:pb-10">
      <h1 className="text-2xl font-extrabold tracking-tight">Favoritos</h1>
      {stores.length > 0 && (
        <section>
          <SectionTitle>Tiendas guardadas</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => (
              <button key={s.id} onClick={() => openStore(s.id)} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-3 text-left">
                <StoreLogo store={s} size={48} />
                <span>
                  <span className="block font-bold">{s.name}</span>
                  <span className="text-xs text-ink-soft">{s.tagline}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {products.length > 0 && (
        <section>
          <SectionTitle>Productos guardados</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} store={storeById[p.storeId]} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
