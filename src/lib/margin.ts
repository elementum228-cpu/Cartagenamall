// Ganancia de un artículo: cuánto cuesta, en cuánto se vende y qué tan buena es la diferencia.

export type MarginLevel = 'loss' | 'low' | 'ok' | 'good'

export interface Margin {
  /** Ganancia por unidad en COP (puede ser negativa). */
  profit: number
  /** Margen sobre el precio de venta, en %. */
  pct: number
  /** Veces que el precio cubre el costo (ej. 2 = vendes al doble). */
  times: number
  level: MarginLevel
}

/** Por debajo de este margen la ganancia es floja (rojo); por encima del siguiente es buena (verde). */
export const MARGIN_LOW = 20
export const MARGIN_GOOD = 35

export function marginOf(cost: number, price: number): Margin | null {
  if (!(price > 0) || !(cost >= 0)) return null
  const profit = price - cost
  const pct = (profit / price) * 100
  const level: MarginLevel = profit <= 0 ? 'loss' : pct < MARGIN_LOW ? 'low' : pct < MARGIN_GOOD ? 'ok' : 'good'
  return { profit, pct, times: cost > 0 ? price / cost : 0, level }
}

/** Precio que deja el margen indicado (para sugerir «véndelo en…»). Redondea hacia arriba a la centena. */
export function priceForMargin(cost: number, pct: number): number {
  return Math.ceil(cost / (1 - pct / 100) / 100) * 100
}
