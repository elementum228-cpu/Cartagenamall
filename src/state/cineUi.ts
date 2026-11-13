import { create } from 'zustand'

/** Qué vista del cine está abierta: la cartelera (carteles) o el interior (puertas, cadenas y películas). */
export type CineView = 'board' | 'lobby' | null

export const useCineUi = create<{ view: CineView; open: (view: Exclude<CineView, null>) => void; close: () => void }>()((set) => ({
  view: null,
  open: (view) => set({ view }),
  close: () => set({ view: null }),
}))
