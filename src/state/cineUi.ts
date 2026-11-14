import { create } from 'zustand'

/** Qué vista del cine está abierta: la cartelera (carteles) o el interior (puertas, cadenas y películas). */
export type CineView = 'board' | 'lobby' | null

/** Secciones del lobby (las pestañas de la navegación rápida). */
export type CineTab = 'now' | 'soon' | 'cines' | 'plans' | 'events' | 'promos'

interface CineUiState {
  view: CineView
  open: (view: Exclude<CineView, null>) => void
  close: () => void
  /**
   * Dónde estaba la persona dentro del lobby: al cerrar el cine y volver a abrirlo (o al regresar del detalle) se conserva la pestaña y
   * la película abierta. Solo vive en memoria: una visita nueva empieza en la cartelera.
   */
  tab: CineTab
  movieId: string | null
  /** Asistente de «Crear un plan de cine»: abierto (con una película elegida de antemano, si la hay). */
  wizard: { movieId: string | null } | null
  setTab: (tab: CineTab) => void
  openMovie: (id: string | null) => void
  openWizard: (movieId?: string | null) => void
  closeWizard: () => void
}

export const useCineUi = create<CineUiState>()((set) => ({
  view: null,
  open: (view) => set({ view }),
  close: () => set({ view: null, wizard: null }),
  tab: 'now',
  movieId: null,
  wizard: null,
  setTab: (tab) => set({ tab, movieId: null }),
  openMovie: (movieId) => set({ movieId }),
  openWizard: (movieId = null) => set({ wizard: { movieId } }),
  closeWizard: () => set({ wizard: null }),
}))

// Solo en desarrollo: para abrir el cine desde las pruebas visuales.
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __cmCineUi?: unknown }).__cmCineUi = useCineUi
