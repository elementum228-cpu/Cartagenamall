import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FloorId, ZoneId } from '../domain/types'
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
  /** Espacio seleccionado (tienda activa o local disponible). */
  selectedSpaceId: string | null
  /** Tienda abierta en ficha sin pasar por el mapa (modo Comprar). */
  openStoreId: string | null
  productSheetId: string | null
  secretPromoId: string | null
  /** Panel de la cancha sintética abierto. */
  courtOpen: boolean
  openCourt: (open: boolean) => void
  focus: FocusRequest | null
  toasts: Toast[]
  selectSpace: (id: string | null) => void
  openStore: (id: string | null) => void
  openProduct: (id: string | null) => void
  openSecret: (id: string | null) => void
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
  enterMall: () => set({ overview: false, activeFloor: 'P1', selectedSpaceId: null, focus: { kind: 'enter', nonce: Date.now() + Math.random() } }),
  setOverview: (on) => set({ overview: on, selectedSpaceId: null, focus: { kind: on ? 'overview' : 'home', nonce: Date.now() + Math.random() } }),
  selectedSpaceId: null,
  openStoreId: null,
  productSheetId: null,
  secretPromoId: null,
  focus: null,
  toasts: [],
  selectSpace: (id) => set(id ? { selectedSpaceId: id, openStoreId: null, courtOpen: false } : { selectedSpaceId: null, openStoreId: null }),
  openStore: (id) => set(id ? { openStoreId: id, selectedSpaceId: null, courtOpen: false } : { openStoreId: null, selectedSpaceId: null }),
  courtOpen: false,
  openCourt: (open) => set(open ? { courtOpen: true, selectedSpaceId: null, openStoreId: null } : { courtOpen: false }),
  openProduct: (id) => set({ productSheetId: id }),
  openSecret: (id) => set({ secretPromoId: id }),
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
      stepDownQuality: () =>
        set((s) => (s.qualityLocked ? s : { quality: s.quality === 'high' ? 'medium' : 'low' })),
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
