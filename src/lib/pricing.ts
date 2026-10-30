import type { Product, Promotion } from '../domain/types'

export function isPromotionLive(p: Promotion, now: number): boolean {
  if (!p.active) return false
  if (Date.parse(p.startsAt) > now) return false
  return p.endsAt === null || Date.parse(p.endsAt) > now
}

/**
 * Promociones que aplican hoy a un producto. Las escondidas solo cuentan si la persona ya las
 * descubrió y guardó en el mundo 3D (`unlockedSecretIds`).
 */
export function applicablePromotions(product: Product, promos: Promotion[], now: number, unlockedSecretIds: string[]) {
  return promos.filter(
    (p) =>
      p.productId === product.id &&
      isPromotionLive(p, now) &&
      (p.type !== 'secret' || unlockedSecretIds.includes(p.id)),
  )
}

/** Precio redondeado a la centena, como se cobra en efectivo en Colombia. */
export const discounted = (price: number, percent: number) => Math.round((price * (1 - percent / 100)) / 100) * 100

export interface PriceInfo {
  original: number
  final: number
  promotion: Promotion | null
}

/** Una sola promoción por producto (la de mayor descuento). No se acumulan. */
export function priceFor(product: Product, promos: Promotion[], now: number, unlockedSecretIds: string[]): PriceInfo {
  const best = applicablePromotions(product, promos, now, unlockedSecretIds).reduce<Promotion | null>(
    (acc, p) => (!acc || p.discountPercent > acc.discountPercent ? p : acc),
    null,
  )
  return { original: product.price, final: best ? discounted(product.price, best.discountPercent) : product.price, promotion: best }
}
