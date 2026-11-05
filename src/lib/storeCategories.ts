import { CATEGORY_BY_ID } from '../config/mall'
import type { Product, Store, StoreCategory } from '../domain/types'
import { isRestaurant } from './restaurant'

// Categorías propias de cada tienda: el dueño las crea (Champú, Tratamientos, Platos fuertes...) y las
// personas filtran por ellas. Los productos sin categoría propia se agrupan por su rubro general.

export interface ProductGroup {
  id: string
  name: string
}

export const storeCategories = (store: Pick<Store, 'categories'>): StoreCategory[] => store.categories ?? []

/** Grupo al que pertenece un producto: su categoría propia, o su rubro general si no tiene. */
export function groupOf(store: Pick<Store, 'categories'>, product: Pick<Product, 'shopCategory' | 'categoryId'>): ProductGroup {
  const own = storeCategories(store).find((c) => c.id === product.shopCategory)
  if (own) return own
  return { id: `g:${product.categoryId}`, name: CATEGORY_BY_ID[product.categoryId]?.name ?? 'Otros' }
}

/** Grupos con productos, en orden: primero las categorías propias (como las acomodó el dueño), luego los rubros generales. */
export function groupsWithProducts(store: Pick<Store, 'categories'>, products: Product[]): ProductGroup[] {
  const present = new Map<string, ProductGroup>()
  for (const p of products) {
    const g = groupOf(store, p)
    if (!present.has(g.id)) present.set(g.id, g)
  }
  const own = storeCategories(store).filter((c) => present.has(c.id))
  const rest = [...present.values()].filter((g) => !own.some((c) => c.id === g.id))
  return [...own, ...rest]
}

/** Productos agrupados (para mostrar con títulos de sección). */
export function groupProducts(store: Pick<Store, 'categories'>, products: Product[]): { group: ProductGroup; items: Product[] }[] {
  return groupsWithProducts(store, products).map((group) => ({ group, items: products.filter((p) => groupOf(store, p).id === group.id) }))
}

/** Cómo se llaman las categorías según el tipo de negocio. */
export function categoryWords(store: Pick<Store, 'categoryId' | 'zoneId'> & { businessType?: Store['businessType'] }) {
  if (isRestaurant(store)) return { title: 'Categorías del menú', one: 'categoría del menú', placeholder: 'Ej. Platos fuertes' }
  if (store.businessType === 'service') return { title: 'Categorías de servicios', one: 'categoría de servicios', placeholder: 'Ej. Cortes' }
  return { title: 'Categorías de productos', one: 'categoría de productos', placeholder: 'Ej. Champú' }
}

/** Ideas para crear categorías con un toque, según el tipo y el rubro del negocio. */
export function suggestedCategories(store: Pick<Store, 'categoryId' | 'zoneId'> & { businessType?: Store['businessType'] }): string[] {
  if (isRestaurant(store)) {
    if (store.categoryId === 'cafe' || store.categoryId === 'postres') return ['Cafés', 'Bebidas frías', 'Postres', 'Panadería', 'Combos']
    return ['Entradas', 'Platos fuertes', 'Acompañamientos', 'Bebidas', 'Postres', 'Combos']
  }
  if (store.businessType === 'service') return ['Cortes', 'Barba', 'Tratamientos', 'Paquetes', 'Asesorías']
  switch (store.zoneId) {
    case 'A':
      return ['Camisas', 'Vestidos', 'Pantalones', 'Calzado', 'Accesorios']
    case 'B':
      return ['Celulares', 'Audio', 'Accesorios', 'Computación', 'Wearables']
    case 'C':
      return ['Champú', 'Tratamientos', 'Maquillaje', 'Cuidado de la piel', 'Perfumes']
    case 'G':
      return ['Videojuegos', 'Consolas', 'Accesorios', 'Regalos', 'Boletas']
    default:
      return ['Hogar', 'Decoración', 'Regalos', 'Accesorios', 'Novedades']
  }
}

export const newCategoryId = (name: string, taken: string[]) => {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat'
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}
