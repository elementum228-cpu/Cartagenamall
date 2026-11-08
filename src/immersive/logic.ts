import type { Product, Store } from '../domain/types'
import { isRestaurant, isService } from '../lib/restaurant'
import { groupOf, groupsWithProducts } from '../lib/storeCategories'

// «Entrar al local» (beta): reglas sin interfaz, para poder probarlas.

export type Scene = 'shop' | 'restaurant' | 'service'

/** Escenario según el tipo de negocio: tienda (prendas sobre el fondo), restaurante (plato) o servicios. */
export const sceneOf = (store: Store): Scene => (isRestaurant(store) ? 'restaurant' : isService(store) ? 'service' : 'shop')

/** ¿Se puede entrar a este local? Con la beta encendida por la administración y el local habilitado. */
export const canEnter = (betaOn: boolean, store: Pick<Store, 'interior'> | undefined | null): boolean => betaOn && store?.interior === true

export interface InteriorTab {
  id: string
  name: string
}

/** Productos que se muestran adentro: los activos del local. */
export const interiorProducts = (store: Pick<Store, 'id'>, products: Product[]) => products.filter((p) => p.storeId === store.id && p.active)

/**
 * Categorías de arriba: «Todo» y una por cada categoría del local con productos (las propias del dueño en su
 * orden, y luego las del rubro general). Con una sola categoría solo se muestra esa. Sin productos, ninguna.
 */
export function interiorTabs(store: Pick<Store, 'categories'>, products: Product[]): InteriorTab[] {
  const groups = groupsWithProducts(store, products)
  if (groups.length === 0) return []
  if (groups.length === 1) return [{ id: groups[0].id, name: groups[0].name }]
  return [{ id: 'all', name: 'Todo' }, ...groups.map((g) => ({ id: g.id, name: g.name }))]
}

/** Pestaña con la que se empieza: «Todo», o la única categoría si es solo una. */
export const firstTab = (tabs: InteriorTab[]) => tabs[0]?.id ?? 'all'

/** Los productos de una pestaña (los destacados primero, sin cambiar el orden del resto). */
export function itemsFor(store: Pick<Store, 'categories'>, products: Product[], tab: string): Product[] {
  const list = tab === 'all' ? products : products.filter((p) => groupOf(store, p).id === tab)
  return [...list.filter((p) => p.featured), ...list.filter((p) => !p.featured)]
}

/** Índice circular: pasar del último al primero y al revés. */
export const wrapIndex = (i: number, n: number) => (n <= 0 ? 0 : ((i % n) + n) % n)

/** Posición relativa (circular) de un producto respecto al que está al centro: 0 centro, ±1 vecinos. */
export function relPos(i: number, index: number, n: number): number {
  const r = (((i - index) % n) + n) % n
  return r > n / 2 ? r - n : r
}
