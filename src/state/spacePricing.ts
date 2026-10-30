import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SPACE_BY_ID, SPACE_TYPES } from '../config/mall'
import type { SpaceSlot, SpaceType } from '../domain/types'
import { safeStorage } from './storage'

/**
 * Precios mensuales de los espacios que fija el dueño del mall: un precio por tipo (isla, local,
 * premium, cancha) y, si hace falta, un precio propio para un espacio puntual. Sin ajustes rige el
 * precio de referencia de SPACE_TYPES.
 */
export interface Pricing {
  types: Partial<Record<SpaceType, number>>
  spaces: Record<string, number>
}

interface SpacePricingState extends Pricing {
  setTypePrice: (type: SpaceType, price: number | null) => void
  setSpacePrice: (spaceId: string, price: number | null) => void
  reset: () => void
}

const EMPTY: Pricing = { types: {}, spaces: {} }

/** Un precio válido: entero positivo (pesos). */
export const validPrice = (n: number) => Number.isFinite(n) && n > 0 && n < 1_000_000_000

export const useSpacePricing = create<SpacePricingState>()(
  persist(
    (set) => ({
      ...EMPTY,
      setTypePrice: (type, price) =>
        set((s) => {
          const types = { ...s.types }
          if (price === null) delete types[type]
          else types[type] = Math.round(price)
          return { types }
        }),
      setSpacePrice: (spaceId, price) =>
        set((s) => {
          const spaces = { ...s.spaces }
          if (price === null) delete spaces[spaceId]
          else spaces[spaceId] = Math.round(price)
          return { spaces }
        }),
      reset: () => set(EMPTY),
    }),
    { name: 'cm:space-prices:v1', storage: safeStorage, partialize: (s) => ({ types: s.types, spaces: s.spaces }) },
  ),
)

/** Precio del tipo (ajustado por el dueño o el de referencia). */
export function typePrice(p: Pricing, type: SpaceType) {
  return p.types[type] ?? SPACE_TYPES[type].monthlyPriceCOP
}

/** Precio mensual vigente de un espacio. */
export function spacePrice(p: Pricing, space: SpaceSlot) {
  return p.spaces[space.id] ?? typePrice(p, space.type)
}

export function useSpacePrice(spaceId: string) {
  return useSpacePricing((s) => {
    const sp = SPACE_BY_ID[spaceId]
    return sp ? spacePrice(s, sp) : 0
  })
}

export function useTypePrice(type: SpaceType) {
  return useSpacePricing((s) => typePrice(s, type))
}
