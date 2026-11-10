import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

/**
 * Zona de servicios (terraza sobre la joyería, escalera, patio hundido y sus locales) como función que el
 * administrador activa o desactiva para todos. Apagada, el mall queda como antes: la joyería con su muro
 * cerrado y sin los espacios S. Se guarda en mall_settings «features».
 */
export const useServicesFeature = create<{ enabled: boolean; setEnabled: (on: boolean) => void }>()(
  persist((set) => ({ enabled: true, setEnabled: (enabled) => set({ enabled }) }), { name: 'cm:services-feature:v1', storage: safeStorage }),
)

/** ¿Es un espacio de la zona de servicios (terraza)? */
export const isServicesSpace = (sp: { id: string }) => sp.id.startsWith('P1-S')
