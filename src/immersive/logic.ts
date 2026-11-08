import type { Product, Store } from '../domain/types'
import { isRestaurant, isService } from '../lib/restaurant'

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

/** Pestañas: «Todo» y cada categoría propia del local que tenga productos, en el orden del dueño. */
export function interiorTabs(store: Pick<Store, 'categories'>, products: Product[]): InteriorTab[] {
  const tabs: InteriorTab[] = []
  for (const c of store.categories ?? []) if (products.some((p) => p.shopCategory === c.id)) tabs.push({ id: c.id, name: c.name })
  // sin categorías propias no hay pestañas: se ve todo seguido
  return tabs.length > 1 ? [{ id: 'all', name: 'Todo' }, ...tabs] : []
}

/** Los productos de una pestaña (los destacados primero, sin cambiar el orden del resto). */
export function itemsFor(products: Product[], tab: string): Product[] {
  const list = tab === 'all' ? products : products.filter((p) => p.shopCategory === tab)
  return [...list.filter((p) => p.featured), ...list.filter((p) => !p.featured)]
}

/** Índice circular: pasar del último al primero y al revés. */
export const wrapIndex = (i: number, n: number) => (n <= 0 ? 0 : ((i % n) + n) % n)

/** Los vecinos que asoman a los lados de la tarjeta central (el carrusel da la vuelta). Con 1 o 2 productos no se repiten. */
export function neighbors(index: number, n: number): { prev: number | null; next: number | null } {
  if (n <= 1) return { prev: null, next: null }
  if (n === 2) return { prev: null, next: wrapIndex(index + 1, n) }
  return { prev: wrapIndex(index - 1, n), next: wrapIndex(index + 1, n) }
}
