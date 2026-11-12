import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

/**
 * Cine (isla al norte del piso de comida): la administración lo enciende o apaga para todos y elige las imágenes de la
 * pantalla exterior y de las dos carteleras de la fachada. Se guarda en mall_settings «features».
 */
export interface CineState {
  enabled: boolean
  /** Imagen de la pantalla al aire libre (la película de moda, publicidad…). null = arte por defecto. */
  screen: string | null
  /** Carteleras a los lados de la puerta. */
  posters: [string | null, string | null]
}

export const emptyCine = (): CineState => ({ enabled: true, screen: null, posters: [null, null] })

export const cleanCine = (v: unknown): CineState => {
  const o = (v ?? {}) as Partial<CineState>
  const s = (x: unknown) => (typeof x === 'string' && x ? x : null)
  return { enabled: o.enabled !== false, screen: s(o.screen), posters: [s(o.posters?.[0]), s(o.posters?.[1])] }
}

export const useCine = create<CineState & { set: (patch: Partial<CineState>) => void }>()(
  persist((set) => ({ ...emptyCine(), set: (patch) => set(patch) }), { name: 'cm:cine:v1', storage: safeStorage }),
)
