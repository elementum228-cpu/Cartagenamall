import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useMemo } from 'react'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { uniqueId } from '../lib/ids'
import { ticketCode, soldFromTickets, type Sold } from '../stadium/logic'
import type { StadiumEvent, Ticket, TicketStatus } from '../stadium/types'
import { safeStorage } from './storage'

/** Quién opera el estadio (un negocio que vende las boletas) y qué evento está «en escena» ahora. Se sincroniza con todos. */
export const useStadiumConfig = create<{ operatorStoreId: string | null; activeEventId: string | null; set: (p: Partial<{ operatorStoreId: string | null; activeEventId: string | null }>) => void }>()(
  persist((set) => ({ operatorStoreId: null, activeEventId: null, set: (p) => set(p) }), { name: 'cm:stadium-config:v1', storage: safeStorage }),
)

/** Eventos del estadio. Con base de datos, los publicados los ve todo el mundo; los borradores, solo quien administra. */
export const useStadiumEvents = create<{ events: StadiumEvent[]; upsert: (e: StadiumEvent) => void; remove: (id: string) => void }>()(
  persist(
    (set) => ({
      events: [],
      upsert: (e) => set((s) => ({ events: s.events.some((x) => x.id === e.id) ? s.events.map((x) => (x.id === e.id ? e : x)) : [...s.events, e] })),
      remove: (id) => set((s) => ({ events: s.events.filter((x) => x.id !== id) })),
    }),
    { name: 'cm:stadium-events:v1', storage: safeStorage },
  ),
)

interface NewTicket {
  event: StadiumEvent
  tierId: string
  qty: number
  buyerName: string
  whatsapp: string
}

/**
 * Boletas. En el navegador de quien compra quedan las suyas; quien administra (o el negocio que opera el
 * estadio) recibe todas desde la base de datos.
 */
export const useTickets = create<{ tickets: Ticket[]; add: (n: NewTicket) => Ticket | null; setStatus: (id: string, status: TicketStatus) => void }>()(
  persist(
    (set, get) => ({
      tickets: [],
      add: ({ event, tierId, qty, buyerName, whatsapp }) => {
        const tier = event.tiers.find((t) => t.id === tierId)
        if (!tier) return null
        const t: Ticket = {
          id: remoteEnabled() ? uniqueId('TK') : `TK-${String(get().tickets.length + 1).padStart(3, '0')}`,
          eventId: event.id,
          eventTitle: event.title,
          startsAt: event.startsAt,
          tierId,
          tierName: tier.name,
          qty,
          unitPrice: tier.price,
          total: tier.price * qty,
          buyerName: buyerName.trim(),
          whatsapp: whatsapp.trim(),
          status: 'pending',
          code: ticketCode(),
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ tickets: [t, ...s.tickets] }))
        return t
      },
      setStatus: (id, status) => set((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? { ...t, status } : t)) })),
    }),
    { name: 'cm:tickets:v1', storage: safeStorage },
  ),
)

/** Boletas vendidas por tipo según la base de datos (visible para todos), para mostrar cuántas quedan. */
export const useRemoteSold = create<{ sold: Sold | null }>()(() => ({ sold: null }))

/** Vendidas por tipo: lo que dice la base de datos; sin ella (demostración), lo que hay en este navegador. */
export function useSold(): Sold {
  const remote = useRemoteSold((s) => s.sold)
  const tickets = useTickets((s) => s.tickets)
  return useMemo(() => (remote && remoteEnabled() ? remote : soldFromTickets(tickets)), [remote, tickets])
}

/** ¿Quien consulta puede gestionar los eventos? El administrador o miembro del negocio que opera el estadio. */
export function useCanManageStadium(): boolean {
  const { isAdmin, storeIds } = useSession()
  const operator = useStadiumConfig((s) => s.operatorStoreId)
  // sin base de datos (demostración) cualquiera que abra la administración puede
  if (!remoteEnabled()) return true
  return isAdmin || (!!operator && storeIds.includes(operator))
}

/** Evento que está en escena ahora (el que el administrador puso), si sigue existiendo. */
export function useActiveEvent(): StadiumEvent | null {
  const id = useStadiumConfig((s) => s.activeEventId)
  const events = useStadiumEvents((s) => s.events)
  return useMemo(() => events.find((e) => e.id === id) ?? null, [events, id])
}

export const newEventId = () => uniqueId('EV')
