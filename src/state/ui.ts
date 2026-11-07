import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FloorId, ZoneId } from '../domain/types'
import type { BoatId } from '../tourism/types'
import type { ShowroomId } from '../district/showrooms'
import { safeStorage } from './storage'

export type FocusInput =
  | { kind: 'home' }
  /** Cambio de piso: conserva el encuadre (x, z) y el zoom. */
  | { kind: 'floor' }
  | { kind: 'overview' }
  /** Entrar: cámara a la puerta de la fortaleza y luego a la plaza del piso 1. */
  | { kind: 'enter' }
  | { kind: 'space'; id: string }
  /** Encuadra un local centrado, sin dejar lugar para su ficha (p. ej. para ver una oferta que se presenta). */
  | { kind: 'showcase'; id: string }
  /** Encuadra la cancha sintética (con espacio para su panel). */
  | { kind: 'court' }
  | { kind: 'zone'; id: ZoneId }
  | { kind: 'zoom'; factor: number }
  /** Acerca un poco la cámara al muelle turístico, sin perder el mall de vista. */
  | { kind: 'harbor' }
  /** El barco de los descuentos atracado (con o sin su ficha abierta). */
  | { kind: 'ship' }
  /** El aeropuerto (con su invitación a volar a Isla Tecnología). */
  | { kind: 'airport' }
  /** El estadio en obra, al norte de la fortaleza. */
  | { kind: 'stadium' }
  /** Isla Tecnología completa (al aterrizar o al volver al inicio estando allá). */
  | { kind: 'island' }
  /** La pista y el aeropuerto de la isla (para ver el aterrizaje). */
  | { kind: 'islandRunway' }
  /** Encuadra una vitrina de la zona de servicios (con lugar para su ficha). */
  | { kind: 'showroom'; id: ShowroomId }

export type FocusRequest = FocusInput & { nonce: number }

export interface Toast {
  id: number
  message: string
  tone: 'default' | 'success' | 'error'
}

interface UIState {
  /** Piso que se explora en detalle. */
  activeFloor: FloorId
  /** Vista general con ambos pisos a la vez. */
  overview: boolean
  setFloor: (id: FloorId) => void
  setOverview: (on: boolean) => void
  /** Desde la vista de la fortaleza: entrar al piso 1 pasando por la puerta. */
  enterMall: () => void
  /** Tras la puerta: la cámara cruza el portón y termina en la vista general del mall. */
  arriveMall: () => void
  /** Cambia cada vez que se pide ver de nuevo el portón de bienvenida. */
  doorNonce: number
  showDoor: () => void
  /** Paso del recorrido guiado (null: sin recorrido). */
  tourStep: number | null
  setTourStep: (step: number | null) => void
  /** Espacio seleccionado (tienda activa o local disponible). */
  selectedSpaceId: string | null
  /** Tienda abierta en ficha sin pasar por el mapa (modo Comprar). */
  openStoreId: string | null
  productSheetId: string | null
  secretPromoId: string | null
  /** Lancha del muelle turístico abierta y qué muestra su ficha. */
  harbor: { boat: BoatId; view: 'card' | 'list' } | null
  /** Vitrina de marca aliada abierta (Planly, GrowDesk). */
  showroom: ShowroomId | null
  /** Ficha del barco de los descuentos abierta. */
  shipOpen: boolean
  openShip: (open: boolean) => void
  /** Aeropuerto seleccionado: se muestra la invitación a volar. */
  airportOpen: boolean
  openAirport: (open: boolean) => void
  /** Pista de la búsqueda del tesoro recién encontrada (abre su ventana). */
  clue: { week: number; index: number } | null
  /** Panel de la cancha sintética abierto. */
  courtOpen: boolean
  openCourt: (open: boolean) => void
  /** Panel de reservas de la pista de karts abierto. */
  trackOpen: boolean
  /** Ventana del estadio: eventos y boletas. */
  stadiumOpen: boolean
  openStadium: (open: boolean) => void
  openTrack: (open: boolean) => void
  focus: FocusRequest | null
  toasts: Toast[]
  selectSpace: (id: string | null) => void
  /**
   * En celulares, tocar un local en el mapa muestra primero una ficha breve (`peek`) sobre el mapa;
   * `openPeek` abre la ficha completa. En escritorio la ficha completa se abre directo.
   */
  peek: boolean
  peekSpace: (id: string) => void
  openPeek: () => void
  openStore: (id: string | null) => void
  openProduct: (id: string | null) => void
  openSecret: (id: string | null) => void
  openHarbor: (boat: BoatId | null) => void
  setHarborView: (view: 'card' | 'list') => void
  openShowroom: (id: ShowroomId | null) => void
  openClue: (clue: { week: number; index: number } | null) => void
  requestFocus: (f: FocusInput) => void
  toast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export const useUI = create<UIState>()((set, get) => ({
  activeFloor: 'P1',
  // Se abre en la vista general de la fortaleza (estado inicial de la cámara).
  overview: true,
  setFloor: (id) => {
    const { activeFloor, overview } = get()
    if (id === activeFloor && !overview) return
    // La cámara se entera por `focus`; si a continuación se pide enfocar un espacio, esa
    // petición reemplaza a esta (ver CameraRig).
    set({ activeFloor: id, overview: false, selectedSpaceId: null, focus: { kind: 'floor', nonce: Date.now() + Math.random() } })
  },
  doorNonce: 0,
  tourStep: null,
  setTourStep: (step) => set(step === null ? { tourStep: null } : { tourStep: step, selectedSpaceId: null, openStoreId: null, courtOpen: false, trackOpen: false }),
  // de vuelta a la vista de la fortaleza: al abrir la puerta otra vez la cámara entra de nuevo
  showDoor: () =>
    set({ doorNonce: Date.now(), overview: true, activeFloor: 'P1', selectedSpaceId: null, openStoreId: null, courtOpen: false, trackOpen: false, focus: { kind: 'overview', nonce: Date.now() + Math.random() } }),
  arriveMall: () => set({ overview: true, activeFloor: 'P1', selectedSpaceId: null, focus: { kind: 'enter', nonce: Date.now() + Math.random() } }),
  enterMall: () => set({ overview: false, activeFloor: 'P1', selectedSpaceId: null, focus: { kind: 'enter', nonce: Date.now() + Math.random() } }),
  setOverview: (on) => set({ overview: on, selectedSpaceId: null, focus: { kind: on ? 'overview' : 'home', nonce: Date.now() + Math.random() } }),
  selectedSpaceId: null,
  openStoreId: null,
  productSheetId: null,
  secretPromoId: null,
  harbor: null,
  showroom: null,
  clue: null,
  focus: null,
  toasts: [],
  selectSpace: (id) => set(id ? { selectedSpaceId: id, openStoreId: null, courtOpen: false, trackOpen: false, peek: false, harbor: null, showroom: null } : { selectedSpaceId: null, openStoreId: null, peek: false }),
  peek: false,
  peekSpace: (id) => set({ selectedSpaceId: id, openStoreId: null, courtOpen: false, trackOpen: false, peek: true, harbor: null, showroom: null }),
  openPeek: () => set({ peek: false }),
  openStore: (id) => set(id ? { openStoreId: id, selectedSpaceId: null, courtOpen: false, trackOpen: false, harbor: null, showroom: null, shipOpen: false } : { openStoreId: null, selectedSpaceId: null }),
  courtOpen: false,
  stadiumOpen: false,
  openStadium: (open) => set(open ? { stadiumOpen: true, trackOpen: false, courtOpen: false, selectedSpaceId: null, openStoreId: null, harbor: null, showroom: null, shipOpen: false } : { stadiumOpen: false }),
  trackOpen: false,
  openTrack: (open) => set(open ? { trackOpen: true, courtOpen: false, selectedSpaceId: null, openStoreId: null, harbor: null, showroom: null, shipOpen: false } : { trackOpen: false }),
  openCourt: (open) => set(open ? { courtOpen: true, trackOpen: false, selectedSpaceId: null, openStoreId: null, harbor: null, showroom: null, shipOpen: false } : { courtOpen: false, trackOpen: false }),
  openProduct: (id) => set({ productSheetId: id }),
  openSecret: (id) => set({ secretPromoId: id }),
  openHarbor: (boat) =>
    set(
      boat
        ? { airportOpen: false, harbor: { boat, view: 'card' }, shipOpen: false, showroom: null, selectedSpaceId: null, openStoreId: null, courtOpen: false, trackOpen: false, peek: false, focus: { kind: 'harbor', nonce: Date.now() + Math.random() } }
        : { harbor: null },
    ),
  airportOpen: false,
  openAirport: (open) =>
    set(
      open
        ? { airportOpen: true, shipOpen: false, harbor: null, showroom: null, selectedSpaceId: null, openStoreId: null, courtOpen: false, trackOpen: false, peek: false, focus: { kind: 'airport', nonce: Date.now() + Math.random() } }
        : { airportOpen: false },
    ),
  shipOpen: false,
  openShip: (open) =>
    set(
      open
        ? { airportOpen: false, shipOpen: true, harbor: null, showroom: null, selectedSpaceId: null, openStoreId: null, courtOpen: false, trackOpen: false, peek: false, focus: { kind: 'ship', nonce: Date.now() + Math.random() } }
        : { shipOpen: false },
    ),
  openShowroom: (id) =>
    set(
      id
        ? { airportOpen: false, showroom: id, shipOpen: false, harbor: null, selectedSpaceId: null, openStoreId: null, courtOpen: false, trackOpen: false, peek: false, focus: { kind: 'showroom', id, nonce: Date.now() + Math.random() } }
        : { showroom: null },
    ),
  setHarborView: (view) => set((s) => (s.harbor ? { harbor: { ...s.harbor, view } } : s)),
  openClue: (clue) => set({ clue }),
  requestFocus: (f) => set({ focus: { ...f, nonce: Date.now() + Math.random() } }),
  toast: (message, tone = 'default') => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2800)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export type TimeMode = 'auto' | 'day' | 'night'

export type Quality = 'high' | 'medium' | 'low'

interface PrefsState {
  timeMode: TimeMode
  setTimeMode: (m: TimeMode) => void
  force2D: boolean
  hintSeen: boolean
  /** Calidad gráfica: alta (todo), media (sin sombras ni ambiente lejano), baja (menos decoración). */
  quality: Quality
  /** La persona eligió la calidad a mano: el ajuste automático ya no la cambia. */
  qualityLocked: boolean
  setForce2D: (v: boolean) => void
  setHintSeen: () => void
  /** Ajuste automático (rendimiento): no actúa si la persona eligió a mano. */
  stepDownQuality: () => void
  chooseQuality: (q: Quality) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      timeMode: 'auto',
      setTimeMode: (timeMode) => set({ timeMode }),
      force2D: false,
      hintSeen: false,
      quality: 'high',
      qualityLocked: false,
      setForce2D: (force2D) => set({ force2D }),
      setHintSeen: () => set({ hintSeen: true }),
      stepDownQuality: () => set((s) => (s.qualityLocked ? s : { quality: s.quality === 'high' ? 'medium' : 'low' })),
      chooseQuality: (quality) => set({ quality, qualityLocked: true }),
    }),
    {
      name: 'cm:prefs:v1',
      storage: safeStorage,
      version: 1,
      // v0 guardaba `lowQuality: boolean`; se traduce a los tres niveles.
      migrate: (old, version) => {
        const o = old as Partial<PrefsState> & { lowQuality?: boolean }
        if (version < 1) return { ...o, quality: o.lowQuality ? 'low' : 'high' } as PrefsState
        return o as PrefsState
      },
    },
  ),
)
