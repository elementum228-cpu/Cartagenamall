import type { OrderStatus } from '../domain/types'

/**
 * Colores del estado de un pedido, para que se note el avance y no todo parezca una advertencia:
 * espera = ámbar, confirmado/preparando = azul, listo/entregado = verde, cancelado = rojo.
 */
export const STATUS_PILL: Record<OrderStatus, string> = {
  received: 'bg-slate-100 text-slate-700',
  pending_confirmation: 'bg-amber-100 text-amber-900',
  confirmed: 'bg-sky-100 text-sky-800',
  preparing: 'bg-blue-100 text-blue-800',
  ready: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-emerald-600 text-white',
  cancelled: 'bg-red-100 text-red-700',
}

/** Color de la barra de progreso según el estado actual. */
export const STATUS_BAR: Record<OrderStatus, string> = {
  received: 'bg-slate-400',
  pending_confirmation: 'bg-amber-400',
  confirmed: 'bg-sky-500',
  preparing: 'bg-blue-600',
  ready: 'bg-emerald-500',
  delivered: 'bg-emerald-600',
  cancelled: 'bg-red-500',
}
