import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

/**
 * Isla de Entretenimiento (locales, pista de karts, puente y zona) como función opcional que solo el
 * administrador activa o desactiva, para todos: apagada, el mall queda sin la isla, sin su zona y sin
 * sus espacios. Se guarda en mall_settings «features» y se recuerda en este dispositivo.
 */
export const useEntertainmentFeature = create<{ enabled: boolean; setEnabled: (on: boolean) => void }>()(
  persist((set) => ({ enabled: false, setEnabled: (enabled) => set({ enabled }) }), { name: 'cm:entertainment-feature:v1', storage: safeStorage }),
)
