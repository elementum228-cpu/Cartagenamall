import { FlaskConical, Square } from 'lucide-react'
import { SPACE_BY_ID } from '../config/mall'
import { isPromotionLive } from '../lib/pricing'
import { useNow } from '../lib/useNow'
import { activateDemoPromotion, endDemoPromotion, isDemoPromotion } from '../promotions/demo'
import { useCatalog } from '../state/catalog'
import { useUI } from '../state/ui'

/**
 * Control de demostración: lanza una promoción relámpago ficticia del 30 % en una tienda del piso 1
 * para ver el evento completo (fachada, visitantes, ficha y carrito). Se puede repetir sin recargar.
 */
export function DemoPromoButton({ className, onDone }: { className: string; onDone?: () => void }) {
  const now = useNow()
  const live = useCatalog((s) => s.promotions.some((p) => isDemoPromotion(p) && isPromotionLive(p, now)))
  const toast = useUI((s) => s.toast)
  if (live)
    return (
      <button
        className={`${className} bg-ink text-white`}
        onClick={() => {
          endDemoPromotion()
          toast('Promoción de prueba finalizada.')
          onDone?.()
        }}
      >
        <Square className="size-4" /> Finalizar prueba
      </button>
    )
  return (
    <button
      className={`${className} bg-white/95`}
      title="Demostración: activa una oferta ficticia del 30 % en una tienda del piso 1"
      onClick={() => {
        const spaceId = activateDemoPromotion()
        if (!spaceId) {
          toast('No hay una tienda abierta en el piso 1 para la prueba.', 'error')
          return
        }
        // Se muestra la tienda y su pasillo (sin abrir ventanas): la oferta se presenta allí.
        const ui = useUI.getState()
        ui.setFloor(SPACE_BY_ID[spaceId].floorId)
        ui.requestFocus({ kind: 'showcase', id: spaceId })
        toast('Promoción de prueba (ficticia) activada: −30 % por 5 minutos.')
        onDone?.()
      }}
    >
      <FlaskConical className="size-4" /> Promo de prueba
    </button>
  )
}
