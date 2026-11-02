import type { Store } from '../domain/types'

const FOOD = new Set(['gastronomia', 'comida-local', 'asados', 'mariscos', 'cafe', 'postres', 'internacional'])

/** ¿El local es un restaurante o negocio de comida? Entonces su catálogo es un «Menú» de platos. */
export const isRestaurant = (store: Pick<Store, 'categoryId' | 'zoneId'>) => FOOD.has(store.categoryId) || store.zoneId === 'E'

/** Número de WhatsApp para wa.me (solo dígitos; un celular colombiano de 10 dígitos recibe el 57). */
export function whatsappDigits(raw: string) {
  const d = raw.replace(/\D/g, '')
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d
}

export const whatsappLink = (raw: string, text: string) => `https://wa.me/${whatsappDigits(raw)}?text=${encodeURIComponent(text)}`
