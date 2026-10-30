import type { Store } from '../domain/types'

/**
 * ¿La tienda se destaca en el mall (cartel grande y luz propia)? Se elige en /admin → Tiendas. Una
 * tienda llamada «Insignia» se destaca por defecto, salvo que el admin lo desactive.
 */
export function isHighlighted(store: Pick<Store, 'name' | 'highlight'>): boolean {
  return store.highlight ?? /insignia/i.test(store.name)
}
