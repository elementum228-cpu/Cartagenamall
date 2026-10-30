import { useCallback, useMemo } from 'react'
import type { Product } from '../domain/types'
import { isPromotionLive, priceFor } from '../lib/pricing'
import { useNow } from '../lib/useNow'
import { useCatalog } from './catalog'
import { usePersonal } from './personal'

/** Precio vigente para la persona actual (incluye ofertas escondidas que haya guardado). */
export function usePricing() {
  const promotions = useCatalog((s) => s.promotions)
  const saved = usePersonal((s) => s.savedSecrets)
  const now = useNow()
  // `now` cambia cada segundo; el cálculo de precios solo cambia cuando una promoción empieza o
  // vence, así que se memoriza por el conjunto de promociones vigentes (una oferta nueva aplica
  // en el mismo segundo, sin recalcular listas grandes a cada tick).
  const liveKey = promotions.filter((p) => isPromotionLive(p, now)).map((p) => p.id).join(',')
  const at = useMemo(() => now, [liveKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const priceOf = useCallback((p: Product) => priceFor(p, promotions, at, saved), [promotions, saved, at])
  return { priceOf, now }
}
