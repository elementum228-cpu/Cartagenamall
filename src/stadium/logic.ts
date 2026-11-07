import type { StadiumEvent, Ticket, TicketTier } from './types'

// Reglas de eventos y boletas, sin interfaz: así se pueden probar.

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/** Código de boleta legible (sin letras que se confunden): EST-7K3Q9X. */
export function ticketCode(rand: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < 6; i++) out += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]
  return `EST-${out}`
}

/** Vendidas por tipo de boleta: boletas no canceladas. */
export type Sold = Record<string, Record<string, number>>

export function soldFromTickets(tickets: Pick<Ticket, 'eventId' | 'tierId' | 'qty' | 'status'>[]): Sold {
  const out: Sold = {}
  for (const t of tickets) {
    if (t.status === 'cancelled') continue
    ;((out[t.eventId] ??= {})[t.tierId] ??= 0)
    out[t.eventId][t.tierId] += t.qty
  }
  return out
}

/** Cuántas boletas quedan de un tipo. */
export const tierLeft = (tier: TicketTier, sold: Sold, eventId: string) => Math.max(0, tier.capacity - (sold[eventId]?.[tier.id] ?? 0))

/** El evento se puede comprar: publicado y que no haya empezado hace más de 3 horas. */
export function onSale(ev: StadiumEvent, now: number): boolean {
  return ev.status === 'published' && Date.parse(ev.startsAt) + 3 * 3600_000 > now
}

/** Eventos publicados que aún no terminan, del más próximo al más lejano. */
export const upcoming = (events: StadiumEvent[], now: number) => events.filter((e) => onSale(e, now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt))

/** Precio más bajo entre los tipos que aún tienen boletas. */
export function fromPrice(ev: StadiumEvent, sold: Sold): number | null {
  const open = ev.tiers.filter((t) => tierLeft(t, sold, ev.id) > 0)
  return open.length ? Math.min(...open.map((t) => t.price)) : null
}

export const isSoldOut = (ev: StadiumEvent, sold: Sold) => ev.tiers.length > 0 && ev.tiers.every((t) => tierLeft(t, sold, ev.id) === 0)

/** Validación de un evento antes de guardarlo; devuelve el primer problema o null. */
export function validateEvent(ev: Pick<StadiumEvent, 'title' | 'startsAt' | 'tiers'>): string | null {
  if (ev.title.trim().length < 3) return 'Ponle un nombre al evento.'
  if (Number.isNaN(Date.parse(ev.startsAt))) return 'Elige la fecha y la hora.'
  if (!ev.tiers.length) return 'Agrega al menos un tipo de boleta.'
  for (const t of ev.tiers) {
    if (t.name.trim().length < 2) return 'Cada tipo de boleta necesita un nombre.'
    if (!(t.price >= 0)) return 'El precio no puede ser negativo.'
    if (!(t.capacity >= 1)) return `«${t.name}» necesita al menos 1 boleta.`
  }
  return null
}

/** Estado más reciente al que puede pasar una boleta (para los botones del organizador). */
export const NEXT_TICKET_STATUS: Record<Ticket['status'], Ticket['status'][]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['used', 'cancelled'],
  used: [],
  cancelled: [],
}
