import { create } from 'zustand'
import { BOATS } from './config'
import { PLACEHOLDER_EXPERIENCES } from './data'
import type { BoatId, Experience, ExperienceCategory } from './types'

// Experiencias del muelle. Hoy arranca con datos de ejemplo; cuando haya operadores reales, se
// cargan con setExperiences (desde la base de datos o un panel) sin tocar la interfaz.

interface TourismState {
  experiences: Experience[]
  setExperiences: (list: Experience[]) => void
}

export const useTourism = create<TourismState>()((set) => ({
  experiences: PLACEHOLDER_EXPERIENCES,
  setExperiences: (experiences) => set({ experiences }),
}))

/** Experiencias de una lancha, por categoría y en el orden de la lancha (las agotadas al final). */
export function experiencesFor(list: Experience[], boat: BoatId, category: ExperienceCategory | null) {
  const cats = BOATS[boat].categories
  const rank: Record<Experience['status'], number> = { available: 0, soon: 1, soldout: 2 }
  return list
    .filter((e) => (category ? e.category === category : cats.includes(e.category)))
    .sort((a, b) => cats.indexOf(a.category) - cats.indexOf(b.category) || rank[a.status] - rank[b.status])
}

/** Eventos del muelle para medición o integraciones (window 'cm:harbor'). */
export type HarborEvent =
  | { type: 'boat_open'; boat: BoatId }
  | { type: 'experiences_view'; boat: BoatId; category: ExperienceCategory | null }
  | { type: 'experience_cta'; boat: BoatId; experienceId: string; action: 'whatsapp' | 'booking' }
  | { type: 'close'; boat: BoatId }

export function trackHarbor(event: HarborEvent) {
  window.dispatchEvent(new CustomEvent<HarborEvent>('cm:harbor', { detail: event }))
}
