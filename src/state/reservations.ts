import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'
import { remoteEnabled } from '../remote/client'
import { uniqueId } from '../lib/ids'

/** Reserva de la cancha (demostración: sin pago; la cancha confirmaría por WhatsApp). */
export interface CourtReservation {
  id: string
  /** 'AAAA-MM-DD' */
  day: string
  hour: number
  /** Cancha reservada (las reservas anteriores a las dos canchas son de la A). */
  court?: 'A' | 'B' | 'KARTS'
  name: string
  whatsapp: string
  players: number
  price: number
  status: 'pending' | 'cancelled'
  createdAt: string
}

interface ReservationsState {
  reservations: CourtReservation[]
  add: (r: Omit<CourtReservation, 'id' | 'status' | 'createdAt'>) => CourtReservation
  cancel: (id: string) => void
}

export const useReservations = create<ReservationsState>()(
  persist(
    (set, get) => ({
      reservations: [],
      add: (r) => {
        const n = get().reservations.length + 1
        const res: CourtReservation = { ...r, id: remoteEnabled() ? uniqueId('RES') : `RES-${String(n).padStart(3, '0')}`, status: 'pending', createdAt: new Date().toISOString() }
        set((s) => ({ reservations: [res, ...s.reservations] }))
        return res
      },
      cancel: (id) => set((s) => ({ reservations: s.reservations.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)) })),
    }),
    { name: 'cm:reservas:v1', storage: safeStorage },
  ),
)
