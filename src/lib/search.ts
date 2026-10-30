import type { Product, Store, ZoneId } from '../domain/types'
import { normalizeText } from './format'
import { totalStock } from './inventory'

export interface SearchFilters {
  query: string
  zoneId: ZoneId | null
  categoryId: string | null
  storeId: string | null
  minPrice: number | null
  maxPrice: number | null
  onlyPromo: boolean
  onlyAvailable: boolean
}

export type SortMode = 'relevance' | 'price_asc' | 'price_desc'

export const EMPTY_FILTERS: SearchFilters = {
  query: '',
  zoneId: null,
  categoryId: null,
  storeId: null,
  minPrice: null,
  maxPrice: null,
  onlyPromo: false,
  onlyAvailable: false,
}

function relevance(product: Product, store: Store | undefined, categoryName: string, tokens: string[]): number {
  if (!tokens.length) return 1
  const name = normalizeText(product.name)
  const tags = product.tags.map(normalizeText)
  const rest = normalizeText(`${product.description} ${categoryName} ${store?.name ?? ''}`)
  let score = 0
  for (const t of tokens) {
    let s = 0
    if (name.split(/\s+/).some((w) => w.startsWith(t))) s = 5
    else if (name.includes(t)) s = 3
    else if (tags.some((x) => x.includes(t))) s = 2
    else if (rest.includes(t)) s = 1
    if (s === 0) return 0 // cada palabra buscada debe aparecer en algún lado
    score += s
  }
  return score
}

/**
 * Búsqueda del modo Comprar.
 *
 * Neutralidad: el orden depende solo de la coincidencia con la búsqueda y del precio. El tipo o
 * tamaño del local (isla, local, premium) NO entra en el cálculo, para no favorecer a quien paga
 * un espacio más grande. Los empates se resuelven por nombre, nunca por tienda.
 */
export function searchProducts(
  products: Product[],
  ctx: {
    stores: Record<string, Store>
    categoryName: (id: string) => string
    categoryZone: (id: string) => ZoneId | undefined
    finalPrice: (p: Product) => number
    hasPromo: (p: Product) => boolean
  },
  f: SearchFilters,
  sort: SortMode,
): Product[] {
  const tokens = normalizeText(f.query).split(/\s+/).filter(Boolean)
  const scored: { p: Product; score: number; price: number }[] = []
  for (const p of products) {
    if (!p.active) continue
    const store = ctx.stores[p.storeId]
    if (!store || store.status !== 'open') continue
    if (f.storeId && p.storeId !== f.storeId) continue
    if (f.categoryId && p.categoryId !== f.categoryId) continue
    if (f.zoneId && ctx.categoryZone(p.categoryId) !== f.zoneId) continue
    const price = ctx.finalPrice(p)
    if (f.minPrice !== null && price < f.minPrice) continue
    if (f.maxPrice !== null && price > f.maxPrice) continue
    if (f.onlyPromo && !ctx.hasPromo(p)) continue
    if (f.onlyAvailable && totalStock(p) === 0) continue
    const score = relevance(p, store, ctx.categoryName(p.categoryId), tokens)
    if (score === 0) continue
    scored.push({ p, score, price })
  }
  scored.sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price || a.p.name.localeCompare(b.p.name)
    if (sort === 'price_desc') return b.price - a.price || a.p.name.localeCompare(b.p.name)
    return b.score - a.score || a.price - b.price || a.p.name.localeCompare(b.p.name)
  })
  return scored.map((x) => x.p)
}
