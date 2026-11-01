import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

/** Barco pirata atracado y quieto en el muelle (en vez de navegar alrededor de la fortaleza). */
export const usePirateShip = create<{ parked: boolean; setParked: (parked: boolean) => void }>()(
  persist((set) => ({ parked: false, setParked: (parked) => set({ parked }) }), { name: 'cm:pirate:v1', storage: safeStorage }),
)
