import type { Product } from '../domain/types'
import { stockFor } from '../lib/inventory'
import { useCart } from './cart'
import { useCatalog } from './catalog'
import { usePersonal, MAX_COMPARE } from './personal'
import { useUI } from './ui'

/** Agrega al carrito validando inventario mock (incluye lo que ya está en el carrito). */
export function addToCart(product: Product, variantId: string | null, size: string | null, qty = 1): boolean {
  const { toast } = useUI.getState()
  const store = useCatalog.getState().stores.find((s) => s.id === product.storeId)
  if (!store || store.status !== 'open') {
    toast('Esta tienda no está recibiendo pedidos por ahora.', 'error')
    return false
  }
  if (product.variants.length && !variantId) {
    toast('Elige una opción antes de agregar.', 'error')
    return false
  }
  if (product.sizes.length && !size) {
    toast('Elige una talla antes de agregar.', 'error')
    return false
  }
  const available = stockFor(product, variantId, size)
  const inCart = useCart.getState().items.find((i) => i.productId === product.id && i.variantId === variantId && i.size === size)?.qty ?? 0
  if (available - inCart < qty) {
    toast(available === 0 ? 'Agotado en esta opción.' : `Solo hay ${available} disponibles${inCart ? ` y ya tienes ${inCart} en el carrito` : ''}.`, 'error')
    return false
  }
  useCart.getState().add({ productId: product.id, storeId: product.storeId, variantId, size }, qty)
  toast(`Agregado: ${product.name}`, 'success')
  return true
}

export function toggleCompare(productId: string) {
  const ok = usePersonal.getState().toggleCompare(productId)
  if (!ok) useUI.getState().toast(`Puedes comparar hasta ${MAX_COMPARE} productos.`, 'error')
}
