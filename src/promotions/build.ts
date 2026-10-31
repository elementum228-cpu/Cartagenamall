import type { HideSpot, Promotion, PromotionType } from '../domain/types'

/** Datos que llena un comerciante (o el admin) para lanzar una promoción. */
export interface PromotionDraft {
  type: PromotionType
  storeId: string
  productId: string
  productName: string
  discountPercent: number
  title: string
  /** Duración en minutos (relámpago y escondida). Las normales no vencen. */
  minutes: number
  code?: string
  /** Escondite de una promoción escondida; sin él, junto al local. */
  hideAt?: HideSpot | null
}

export const PROMO_TYPE_NAME: Record<PromotionType, string> = { normal: 'Normal', flash: 'Relámpago', secret: 'Escondida' }
export const MIN_DISCOUNT = 5
export const MAX_DISCOUNT = 70

export function validatePromotion(d: PromotionDraft): string | null {
  if (!d.productId) return 'Elige un artículo.'
  if (!Number.isFinite(d.discountPercent) || d.discountPercent < MIN_DISCOUNT || d.discountPercent > MAX_DISCOUNT)
    return `El descuento debe estar entre ${MIN_DISCOUNT} % y ${MAX_DISCOUNT} %.`
  if (d.type !== 'normal' && (!Number.isFinite(d.minutes) || d.minutes < 5)) return 'La duración mínima es de 5 minutos.'
  if (d.type === 'secret' && (d.code ?? '').trim().length < 3) return 'El código secreto necesita al menos 3 caracteres.'
  return null
}

/** Promoción lista para guardar; empieza ahora (así se presenta en el mall). */
export function buildPromotion(d: PromotionDraft, now: number, takenIds: Set<string>): Promotion {
  let id = `PROMO-${d.type[0].toUpperCase()}-${now.toString(36)}`
  for (let i = 2; takenIds.has(id); i++) id = `PROMO-${d.type[0].toUpperCase()}-${now.toString(36)}-${i}`
  return {
    id,
    type: d.type,
    storeId: d.storeId,
    productId: d.productId,
    title: d.title.trim() || `${PROMO_TYPE_NAME[d.type]}: ${d.productName}`,
    description: '',
    discountPercent: Math.round(d.discountPercent),
    code: d.type === 'secret' ? d.code!.trim().toUpperCase() : undefined,
    ...(d.type === 'secret' && d.hideAt ? { hideAt: d.hideAt } : {}),
    startsAt: new Date(now).toISOString(),
    endsAt: d.type === 'normal' ? null : new Date(now + d.minutes * 60_000).toISOString(),
    durationHours: d.type === 'normal' ? undefined : d.minutes / 60,
    active: true,
  }
}
