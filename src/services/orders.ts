import type { CartItem, Customer, DeliveryMode, Order, OrderLine, OrderStatus, Product, Promotion, Store, SubOrder } from '../domain/types'
import { stockFor } from '../lib/inventory'
import { priceFor } from '../lib/pricing'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Solicitud recibida',
  pending_confirmation: 'Pendiente de confirmación',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo',
  on_the_way: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

/** Flujo normal de una suborden (cancelado queda aparte). */
export const ORDER_FLOW: OrderStatus[] = ['received', 'pending_confirmation', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']

/** Pasos que ve el cliente. «En camino» solo existe en pedidos a domicilio; «Solicitud recibida» y «Pendiente» son un solo paso. */
export function stepsFor(mode: DeliveryMode): { label: string; statuses: OrderStatus[] }[] {
  const steps = [
    { label: 'Enviado', statuses: ['received', 'pending_confirmation'] as OrderStatus[] },
    { label: 'Confirmado', statuses: ['confirmed'] as OrderStatus[] },
    { label: 'Preparando', statuses: ['preparing'] as OrderStatus[] },
    { label: 'Listo', statuses: ['ready'] as OrderStatus[] },
  ]
  if (mode === 'delivery') steps.push({ label: 'En camino', statuses: ['on_the_way'] })
  steps.push({ label: 'Entregado', statuses: ['delivered'] })
  return steps
}

export function stepIndex(mode: DeliveryMode, status: OrderStatus): number {
  const i = stepsFor(mode).findIndex((s) => s.statuses.includes(status))
  return i < 0 ? 0 : i
}

/** Estados que el comercio puede poner a un pedido (sin «En camino» si el cliente recoge en el local). */
export const statusOptions = (mode: DeliveryMode): OrderStatus[] =>
  (['received', 'pending_confirmation', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled'] as OrderStatus[]).filter((s) => s !== 'on_the_way' || mode === 'delivery')

export interface CatalogSnapshot {
  products: Record<string, Product>
  stores: Record<string, Store>
  promotions: Promotion[]
}

export interface CartIssue {
  key: string
  message: string
  /** Cantidad máxima disponible hoy (0 si no se puede pedir). */
  available: number
}

/** Revisa el carrito contra el catálogo/inventario mock actual. */
export function validateCart(items: CartItem[], catalog: CatalogSnapshot): CartIssue[] {
  const issues: CartIssue[] = []
  for (const it of items) {
    const product = catalog.products[it.productId]
    const store = catalog.stores[it.storeId]
    if (!product || !product.active) {
      issues.push({ key: it.key, message: 'Este producto ya no está disponible.', available: 0 })
      continue
    }
    if (!store || store.status !== 'open') {
      issues.push({ key: it.key, message: 'La tienda no está recibiendo pedidos por ahora.', available: 0 })
      continue
    }
    const available = stockFor(product, it.variantId, it.size)
    if (available === 0) issues.push({ key: it.key, message: 'Agotado en esta variante.', available: 0 })
    else if (it.qty > available) issues.push({ key: it.key, message: `Solo quedan ${available} disponibles.`, available })
  }
  return issues
}

export interface StoreGroup {
  storeId: string
  items: CartItem[]
}

/** Agrupa por tienda manteniendo el orden en que se agregaron. */
export function groupByStore(items: CartItem[]): StoreGroup[] {
  const map = new Map<string, CartItem[]>()
  for (const it of items) {
    const list = map.get(it.storeId) ?? []
    list.push(it)
    map.set(it.storeId, list)
  }
  return [...map.entries()].map(([storeId, items]) => ({ storeId, items }))
}

export function formatOrderId(n: number) {
  return `ORDER-${String(n).padStart(3, '0')}`
}

export interface BuildOrderInput {
  orderNumber: number
  /** Id ya generado (con base de datos compartida: único entre navegadores). */
  orderId?: string
  items: CartItem[]
  catalog: CatalogSnapshot
  customer: Customer
  delivery: { mode: DeliveryMode; address: string | null }
  notes: string
  now: number
  unlockedSecretIds: string[]
}

/**
 * Crea la orden principal y la divide en una suborden por tienda. Cada comercio recibe solo sus
 * líneas. No hay cobro: el estado inicial de cada suborden es "pendiente de confirmación".
 */
export function buildOrder(input: BuildOrderInput): { ok: true; order: Order } | { ok: false; issues: CartIssue[] } {
  const issues = validateCart(input.items, input.catalog)
  if (issues.length) return { ok: false, issues }
  if (!input.items.length) return { ok: false, issues: [{ key: '', message: 'El carrito está vacío.', available: 0 }] }

  const orderId = input.orderId ?? formatOrderId(input.orderNumber)
  const at = new Date(input.now).toISOString()
  const subOrders: SubOrder[] = groupByStore(input.items).map((g, i) => {
    const store = input.catalog.stores[g.storeId]
    const lines: OrderLine[] = g.items.map((it) => {
      const product = input.catalog.products[it.productId]
      const price = priceFor(product, input.catalog.promotions, input.now, input.unlockedSecretIds)
      return {
        productId: product.id,
        name: product.name,
        variantId: it.variantId,
        variantName: product.variants.find((v) => v.id === it.variantId)?.name ?? null,
        size: it.size,
        qty: it.qty,
        originalUnitPrice: price.original,
        unitPrice: price.final,
        promotionId: price.promotion?.id ?? null,
        promoCode: price.promotion?.code ?? null,
        lineTotal: price.final * it.qty,
      }
    })
    return {
      id: `${orderId}-${String.fromCharCode(65 + i)}`,
      orderId,
      storeId: store.id,
      storeName: store.name,
      lines,
      subtotal: lines.reduce((a, l) => a + l.lineTotal, 0),
      status: 'pending_confirmation',
      history: [
        { status: 'received', at },
        { status: 'pending_confirmation', at },
      ],
      stockCommitted: false,
    }
  })

  return {
    ok: true,
    order: {
      id: orderId,
      createdAt: at,
      customer: input.customer,
      delivery: input.delivery,
      notes: input.notes,
      subOrders,
      estimatedTotal: subOrders.reduce((a, s) => a + s.subtotal, 0),
      payment: 'not_charged',
    },
  }
}

/** Estado resumido de la orden principal a partir de sus subórdenes. */
export function overallStatus(order: Order): OrderStatus {
  const live = order.subOrders.filter((s) => s.status !== 'cancelled')
  if (!live.length) return 'cancelled'
  const idx = Math.min(...live.map((s) => ORDER_FLOW.indexOf(s.status)))
  return ORDER_FLOW[idx]
}

/** Mensaje que la persona puede enviar a cada tienda por WhatsApp. */
export function subOrderMessage(order: Order, sub: SubOrder, formatPrice: (n: number) => string) {
  const lines = sub.lines.map(
    (l) => `• ${l.qty} × ${l.name}${l.variantName ? ` (${l.variantName})` : ''}${l.size ? ` talla ${l.size}` : ''} — ${formatPrice(l.lineTotal)}${l.promoCode ? ` [código ${l.promoCode}]` : ''}`,
  )
  return [
    `Hola ${sub.storeName}, vengo de MallPlay. Me gustaría hacer este pedido (${sub.id}):`,
    ...lines,
    `Subtotal estimado: ${formatPrice(sub.subtotal)}`,
    `Entrega: ${order.delivery.mode === 'pickup' ? 'Recojo en el local' : `Domicilio — ${order.delivery.address}`}`,
    `A nombre de ${order.customer.name} (${order.customer.whatsapp}).`,
    '¿Me confirman el pedido, el valor y el tiempo de entrega? ¡Gracias!',
  ].join('\n')
}
