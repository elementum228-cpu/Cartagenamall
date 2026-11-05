import type { Store } from '../domain/types'
import { useUI } from '../state/ui'

const FOOD = new Set(['gastronomia', 'comida-local', 'asados', 'mariscos', 'cafe', 'postres', 'internacional'])

export const isFoodCategory = (id: string) => FOOD.has(id)

/** ¿El local es un restaurante o negocio de comida? Entonces su catálogo es un «Menú» de platos. */
export const isRestaurant = (store: Pick<Store, 'categoryId' | 'zoneId'> & { businessType?: Store['businessType'] }) =>
  store.businessType ? store.businessType === 'restaurant' : FOOD.has(store.categoryId) || store.zoneId === 'E'

/** Palabras del catálogo según el tipo de negocio: restaurante → Menú; tienda → Catálogo; servicios → Catálogo de servicios. */
export function catalogWords(store: Pick<Store, 'categoryId' | 'zoneId'> & { businessType?: Store['businessType'] }) {
  if (isRestaurant(store)) return { tab: 'Menú', title: 'Menú', plural: 'platos', one: 'plato', add: 'Nuevo plato' }
  if (store.businessType === 'service') return { tab: 'Servicios', title: 'Catálogo de servicios', plural: 'servicios', one: 'servicio', add: 'Nuevo servicio' }
  return { tab: 'Catálogo', title: 'Catálogo', plural: 'productos', one: 'producto', add: 'Nuevo producto' }
}

/** Número de WhatsApp para wa.me (solo dígitos; un celular colombiano de 10 dígitos recibe el 57). */
export function whatsappDigits(raw: string) {
  const d = raw.replace(/\D/g, '')
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d
}

export const whatsappLink = (raw: string, text: string) => `https://wa.me/${whatsappDigits(raw)}?text=${encodeURIComponent(text)}`

const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))

/**
 * Abre WhatsApp con el mensaje. En celular se hace en la MISMA pestaña (una pestaña nueva queda en blanco al volver);
 * en computador, en una pestaña nueva para no sacar a la persona del mall. Devuelve si se pudo lanzar.
 */
export function openWhatsApp(url: string): boolean {
  if (isMobile()) {
    window.location.href = url
    return true
  }
  return !!window.open(url, '_blank', 'noopener')
}

export const isService = (store: Pick<Store, 'businessType'>) => store.businessType === 'service'

/** Enlace de WhatsApp para reservar un servicio (los servicios no se agregan al carrito). */
export function bookingLink(store: Pick<Store, 'name' | 'whatsapp'>, serviceName: string, price: string) {
  return whatsappLink(store.whatsapp, `Hola ${store.name}, vengo de MallPlay. Quiero reservar el servicio «${serviceName}» (${price}). ¿Qué horarios tienen disponibles?`)
}

/** Abre WhatsApp para reservar un servicio; avisa si el negocio aún no tiene número configurado. */
export function openBooking(store: Pick<Store, 'name' | 'whatsapp'>, serviceName: string, price: string) {
  if (!whatsappDigits(store.whatsapp ?? '')) {
    useUI.getState().toast(`${store.name} aún no configuró su WhatsApp para reservas.`, 'error')
    return false
  }
  return openWhatsApp(bookingLink(store, serviceName, price))
}
