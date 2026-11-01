import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

/**
 * Aeropuerto e Isla Tecnología como función opcional (para mostrarla aparte): apagado, el mall
 * queda sin aeropuerto, sin isla y sin vuelos. Se recuerda en este dispositivo.
 */
export const useAirportFeature = create<{ enabled: boolean; setEnabled: (on: boolean) => void }>()(
  persist((set) => ({ enabled: false, setEnabled: (enabled) => set({ enabled }) }), { name: 'cm:airport-feature:v1', storage: safeStorage }),
)
