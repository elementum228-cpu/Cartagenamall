import type { Store } from '../domain/types'

/** Mensajes de WhatsApp que cada negocio puede personalizar. Se guardan en el documento de la tienda (sin SQL nuevo). */
export type MessageKey = 'greeting' | 'orderIntro' | 'orderOutro' | 'booking' | 'toCustomer'

export const MESSAGE_DEFAULTS: Record<MessageKey, string> = {
  greeting: 'Hola {tienda}, vengo de MallPlay.',
  orderIntro: 'Hola {tienda}, vengo de MallPlay. Me gustaría hacer este pedido ({pedido}):',
  orderOutro: '¿Me confirman el pedido, el valor y el tiempo de entrega? Gracias.',
  booking: 'Hola {tienda}, vengo de MallPlay. Quiero reservar el servicio «{servicio}» ({precio}). ¿Qué horarios tienen disponibles?',
  toCustomer: 'Hola {cliente}, te escribimos de {tienda} por tu pedido.',
}

export const MESSAGE_FIELDS: { key: MessageKey; label: string; hint: string; vars: string[]; rows: number }[] = [
  { key: 'greeting', label: 'Cuando un cliente te escribe desde tu ficha', hint: 'Es el primer mensaje que te llega por WhatsApp.', vars: ['tienda'], rows: 2 },
  { key: 'orderIntro', label: 'Pedido: inicio del mensaje', hint: 'Después de este texto va la lista de productos, el subtotal y la entrega.', vars: ['tienda', 'pedido'], rows: 2 },
  { key: 'orderOutro', label: 'Pedido: cierre del mensaje', hint: 'Va al final, después de los datos del cliente.', vars: ['tienda'], rows: 2 },
  { key: 'booking', label: 'Reserva de un servicio', hint: 'Solo aplica a servicios (no al carrito).', vars: ['tienda', 'servicio', 'precio'], rows: 3 },
  { key: 'toCustomer', label: 'Cuando tú le escribes a un cliente por su pedido', hint: 'Sale en el botón "Escribir al cliente".', vars: ['tienda', 'cliente'], rows: 2 },
]

export function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m)).replace(/[ \t]+\n/g, '\n').trim()
}

export type WithMessages = Pick<Store, 'name'> & { messages?: Partial<Record<MessageKey, string>> }

/** Texto de la tienda si lo personalizó; si no, el de MallPlay. */
export function messageFor(store: WithMessages | undefined, key: MessageKey, vars: Record<string, string>) {
  const custom = store?.messages?.[key]?.trim()
  return fillTemplate(custom || MESSAGE_DEFAULTS[key], { tienda: store?.name ?? '', ...vars })
}
