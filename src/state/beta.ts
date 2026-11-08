import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

/** Funciones en beta que la administración enciende para todos (se guardan en mall_settings «features»). */
export const useBeta = create<{ interior: boolean; setInterior: (on: boolean) => void }>()(
  persist((set) => ({ interior: false, setInterior: (interior) => set({ interior }) }), { name: 'cm:beta:v1', storage: safeStorage }),
)
