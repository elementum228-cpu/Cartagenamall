import { create } from 'zustand'
import type { FloorId } from '../domain/types'
import { appClock } from '../lib/clock'
import { useCatalog } from '../state/catalog'
import { syncPromotionEvents, type PromotionEvent } from './events'

interface PromoEventsState {
  events: PromotionEvent[]
  /** Recalcula los eventos con el reloj de la aplicación (lo llama PromotionEventDriver cada segundo). */
  sync: (visibleFloor: FloorId | null) => void
}

/** Eventos de la sesión (no se guardan: cada visita presenta de nuevo las ofertas vigentes). */
export const usePromoEvents = create<PromoEventsState>()((set, get) => ({
  events: [],
  sync: (visibleFloor) => {
    const { promotions, assignments } = useCatalog.getState()
    const events = syncPromotionEvents(get().events, { promotions, assignments, now: appClock.now(), visibleFloor })
    if (events !== get().events) set({ events })
  },
}))
