import { create } from 'zustand'
import { usePassport } from '../state/passport'
import { playCabinChime, playTakeoffEngine } from './sounds'
import { useUI } from '../state/ui'

// Viaje a Isla Descuento: terminal (tiquete gratis) → pase de abordar → despegue del avión en la
// pista → pantalla de vuelo (cargando, pero volando) → llegada a la isla. Y el regreso al mall.

export type FlightStep = 'terminal' | 'pass' | 'takeoff' | 'flying' | 'arrived'
export interface BoardingPass {
  name: string
  flight: string
  gate: string
  seat: string
  time: string
  code: string
}

interface FlightState {
  step: FlightStep | null
  /** Dónde está la persona: el mall o la isla. */
  world: 'mall' | 'island'
  /** Sentido del vuelo en curso (para la pantalla de vuelo). */
  direction: 'to' | 'back'
  pass: BoardingPass | null
  /** Cuándo empezó el despegue (ms de performance.now), para animar el avión. */
  takeoffAt: number
  start: () => void
  getTicket: (name: string) => void
  takeoff: () => void
  explore: () => void
  flyBack: () => void
  cancel: () => void
}

/** Duraciones (ms): despegue en la pista y vuelo. */
/** Despegue: rodaje hasta la cabecera de la pista y giro (TAXI_FRAC del tiempo), luego la carrera. */
export const TAKEOFF_MS = 13000
export const TAXI_FRAC = 0.5
export const FLYING_MS = 4600
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
let timers: number[] = []
const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
const clear = () => {
  timers.forEach(clearTimeout)
  timers = []
}

export const useFlight = create<FlightState>()((set, get) => ({
  step: null,
  world: 'mall',
  direction: 'to',
  pass: null,
  takeoffAt: 0,
  start: () => {
    clear()
    useUI.getState().openAirport(false)
    set({ step: 'terminal', direction: 'to' })
    void playCabinChime()
  },
  getTicket: (name) => {
    const seat = `${1 + Math.floor(Math.random() * 24)}${'ABCDEF'[Math.floor(Math.random() * 6)]}`
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    const time = new Date(Date.now() + 5 * 60_000).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    set({ step: 'pass', pass: { name: name.trim() || 'Viajero', flight: 'CM 001', gate: 'A1', seat, time, code } })
  },
  takeoff: () => {
    clear()
    const r = reduced()
    useUI.getState().requestFocus({ kind: 'airport' })
    set({ step: 'takeoff', takeoffAt: performance.now() })
    // ding-dong de cabina y, enseguida, los motores
    void playCabinChime()
    if (!r) later(900, () => void playTakeoffEngine(((TAKEOFF_MS - 900) / 1000) * TAXI_FRAC, (TAKEOFF_MS - 900) / 1000))
    later(r ? 300 : TAKEOFF_MS, () => {
      set({ step: 'flying' })
      // con la pantalla de vuelo encima, la cámara ya se pasa a la isla
      later(700, () => {
        set({ world: 'island' })
        useUI.setState({ overview: false, activeFloor: 'P1', selectedSpaceId: null, openStoreId: null, peek: false })
        useUI.getState().requestFocus({ kind: 'island' })
      })
      later(r ? 1200 : FLYING_MS, () => {
        set({ step: 'arrived' })
        usePassport.getState().stamp('ISLA')
      })
    })
  },
  explore: () => set({ step: null }),
  flyBack: () => {
    clear()
    set({ step: 'flying', direction: 'back' })
    later(700, () => {
      set({ world: 'mall' })
      useUI.setState({ selectedSpaceId: null, openStoreId: null, peek: false })
      useUI.getState().requestFocus({ kind: 'airport' })
    })
    later(reduced() ? 1200 : 3200, () => set({ step: null }))
  },
  cancel: () => {
    clear()
    set({ step: null, world: get().world })
  },
}))
