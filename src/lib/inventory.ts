import type { Product } from '../domain/types'

export const stockKey = (variantId: string | null, size: string | null) => `${variantId ?? '_'}|${size ?? '_'}`

export function stockFor(product: Product, variantId: string | null, size: string | null): number {
  return product.inventory[stockKey(variantId, size)] ?? 0
}

export function totalStock(product: Product): number {
  return Object.values(product.inventory).reduce((a, b) => a + b, 0)
}

/** El producto requiere elegir variante o talla antes de agregarse. */
export const needsOptions = (p: Product) => p.variants.length > 0 || p.sizes.length > 0
