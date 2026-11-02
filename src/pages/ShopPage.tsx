import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CATEGORY_BY_ID, FLOOR_BY_ID, FLOOR_OF_ZONE, ZONES } from '../config/mall'
import { normalizeText } from '../lib/format'
import type { ZoneId } from '../domain/types'
import { EMPTY_FILTERS, searchProducts, type SearchFilters, type SortMode } from '../lib/search'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { usePricing } from '../state/pricing'
import { useUI } from '../state/ui'
import { Chip, EmptyState, SectionTitle, StoreLogo, input } from '../ui/bits'
import { ProductCard } from '../ui/ProductCard'

const PRICE_RANGES: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Cualquier precio', min: null, max: null },
  { label: 'Hasta $50.000', min: null, max: 50_000 },
  { label: '$50.000 – $100.000', min: 50_000, max: 100_000 },
  { label: '$100.000 – $200.000', min: 100_000, max: 200_000 },
  { label: 'Más de $200.000', min: 200_000, max: null },
]

/** Modo Comprar: marketplace tradicional sobre el mismo catálogo, carrito y promociones. */
export function ShopPage() {
  const [params, setParams] = useSearchParams()
  const products = useCatalog((s) => s.products)
  const stores = useCatalog((s) => s.stores)
  const { storeById } = useCatalogMaps()
  const { priceOf } = usePricing()
  const openStore = useUI((s) => s.openStore)
  const [showFilters, setShowFilters] = useState(false)

  const f: SearchFilters = {
    ...EMPTY_FILTERS,
    query: params.get('q') ?? '',
    zoneId: (params.get('zona') as ZoneId | null) ?? null,
    categoryId: params.get('cat'),
    storeId: params.get('tienda'),
    minPrice: params.get('min') ? Number(params.get('min')) : null,
    maxPrice: params.get('max') ? Number(params.get('max')) : null,
    onlyPromo: params.get('promo') === '1',
    onlyAvailable: params.get('disp') === '1',
  }
  const sort = (params.get('orden') as SortMode | null) ?? 'relevance'

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) v === null || v === '' ? next.delete(k) : next.set(k, v)
    setParams(next, { replace: true })
  }

  const results = useMemo(
    () =>
      searchProducts(
        products,
        {
          stores: storeById,
          categoryName: (id) => CATEGORY_BY_ID[id]?.name ?? '',
          categoryZone: (id) => CATEGORY_BY_ID[id]?.zoneId,
          finalPrice: (p) => priceOf(p).final,
          hasPromo: (p) => !!priceOf(p).promotion,
        },
        f,
        sort,
      ),
    [products, storeById, priceOf, params],
  )

  // Negocios: por zona y, al buscar, los que coinciden por nombre, frase o categoría (en ambos pisos).
  const q = normalizeText(f.query)
  const shownStores = stores.filter(
    (s) =>
      s.status === 'open' &&
      (!f.zoneId || s.zoneId === f.zoneId) &&
      (!q || normalizeText(`${s.name} ${s.tagline} ${CATEGORY_BY_ID[s.categoryId]?.name ?? ''}`).includes(q)),
  )
  const zone = f.zoneId ? ZONES.find((z) => z.id === f.zoneId) : null
  const priceIdx = Math.max(0, PRICE_RANGES.findIndex((r) => r.min === f.minPrice && r.max === f.maxPrice))
  const activeCount = [f.categoryId, f.storeId, f.minPrice ?? f.maxPrice, f.onlyPromo || null, f.onlyAvailable || null].filter((x) => x !== null && x !== undefined).length

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-28 md:pb-10">
      <div className="sticky top-[calc(var(--chrome-top)-6px)] z-20 -mx-4 bg-sand px-4 pt-2 pb-3 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-[var(--chrome-top)] before:bg-sand after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-5 after:bg-gradient-to-b after:from-sand after:to-transparent">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-soft" />
            <input
              className={`${input} pl-11`}
              placeholder="Busca productos, tiendas o comida…"
              value={f.query}
              onChange={(e) => update({ q: e.target.value })}
              type="search"
              aria-label="Buscar productos"
              autoFocus={params.get('foco') === '1'}
            />
          </label>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative grid size-[50px] shrink-0 place-items-center rounded-xl border transition ${showFilters ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
            aria-expanded={showFilters}
            aria-label="Filtros"
          >
            <SlidersHorizontal className="size-5" />
            {activeCount > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-coral text-[11px] font-bold text-white">{activeCount}</span>}
          </button>
        </div>
        <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <Chip active={!f.zoneId} onClick={() => update({ zona: null, cat: null })}>
            Todo el mall
          </Chip>
          {ZONES.map((z) => (
            <Chip key={z.id} color={z.color} active={f.zoneId === z.id} onClick={() => update({ zona: f.zoneId === z.id ? null : z.id, cat: null })}>
              {z.name}
            </Chip>
          ))}
          <Chip active={f.onlyPromo} onClick={() => update({ promo: f.onlyPromo ? null : '1' })}>
            En oferta
          </Chip>
        </div>
        {showFilters && (
          <div className="mt-3 grid gap-3 rounded-3xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold">
              Categoría
              <select className={`${input} mt-1`} value={f.categoryId ?? ''} onChange={(e) => update({ cat: e.target.value || null })}>
                <option value="">Todas{zone ? ` en ${zone.name}` : ''}</option>
                {(zone ? zone.categories : ZONES.flatMap((z) => z.categories)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Precio
              <select
                className={`${input} mt-1`}
                value={priceIdx}
                onChange={(e) => {
                  const r = PRICE_RANGES[Number(e.target.value)]
                  update({ min: r.min?.toString() ?? null, max: r.max?.toString() ?? null })
                }}
              >
                {PRICE_RANGES.map((r, i) => (
                  <option key={r.label} value={i}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Tienda
              <select className={`${input} mt-1`} value={f.storeId ?? ''} onChange={(e) => update({ tienda: e.target.value || null })}>
                <option value="">Todas</option>
                {stores
                  .filter((s) => s.status === 'open')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Ordenar
              <select className={`${input} mt-1`} value={sort} onChange={(e) => update({ orden: e.target.value === 'relevance' ? null : e.target.value })}>
                <option value="relevance">Relevancia</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input type="checkbox" className="size-5 accent-brand" checked={f.onlyAvailable} onChange={(e) => update({ disp: e.target.checked ? '1' : null })} />
              Solo con disponibilidad
            </label>
            <div className="flex items-center justify-end sm:col-span-2">
              <button className="inline-flex items-center gap-1 text-sm font-bold text-brand" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                <X className="size-4" /> Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {!f.storeId && shownStores.length > 0 && (
        <section className="mb-6">
          <SectionTitle>{f.query ? 'Negocios' : zone?.id === 'E' ? 'Restaurantes y cafés' : 'Tiendas y restaurantes'}</SectionTitle>
          <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pt-1 pb-1 md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:overflow-visible md:px-0">
            {shownStores.map((s) => (
                <button key={s.id} onClick={() => openStore(s.id)} className="flex w-56 shrink-0 items-center gap-3 rounded-3xl border md:w-auto md:min-w-0 border-line bg-card p-3 text-left transition active:scale-[0.98]">
                  <StoreLogo store={s} size={48} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{s.name}</span>
                      <span className="shrink-0 rounded-full bg-sand-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{FLOOR_BY_ID[FLOOR_OF_ZONE[s.zoneId]]?.name}</span>
                    </span>
                    <span className="line-clamp-2 text-xs text-ink-soft">{s.tagline}</span>
                  </span>
                </button>
              ))}
          </div>
        </section>
      )}

      <SectionTitle aside={<span className="text-xs text-ink-soft">{results.length} resultados</span>}>
        {f.query ? `Resultados para “${f.query}”` : zone ? `Pasillo ${zone.id} · ${zone.name}` : 'Todos los productos'}
      </SectionTitle>
      {results.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} store={storeById[p.storeId]} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Search className="size-7" />} title="Sin resultados" action={<button className="font-bold text-brand" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Limpiar búsqueda</button>}>
          Prueba con otra palabra o quita algunos filtros.
        </EmptyState>
      )}
      <p className="mt-8 text-center text-[11px] text-ink-soft">
        El orden depende de tu búsqueda y del precio. El tamaño o la ubicación del local no influye en los resultados.
      </p>
    </div>
  )
}
