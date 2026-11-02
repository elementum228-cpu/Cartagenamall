import { useEffect } from 'react'
import { useCatalog } from '../state/catalog'
import { useUI } from '../state/ui'
import { usePromoEvents } from './store'

/**
 * Mantiene los eventos al día con el reloj de la aplicación (cada segundo y al cambiar el catálogo,
 * el piso o la vista). Solo se presentan ofertas en el piso que se está explorando.
 */
export function PromotionEventDriver({ exploring }: { exploring: boolean }) {
  const activeFloor = useUI((s) => s.activeFloor)
  const overview = useUI((s) => s.overview)
  const promotions = useCatalog((s) => s.promotions)
  const assignments = useCatalog((s) => s.assignments)
  // en la vista general (todo el mall) las ofertas también se presentan: el local se ilumina aunque nadie haya entrado a su piso
  const visible = exploring ? (overview ? ('all' as const) : activeFloor) : null
  useEffect(() => {
    const tick = () => usePromoEvents.getState().sync(visible)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [visible, promotions, assignments])
  return null
}
