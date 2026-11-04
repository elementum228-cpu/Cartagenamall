import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import App from '../App'
import { useAirportFeature } from '../state/airportFeature'
import { useEntertainmentFeature } from '../state/entertainmentFeature'
import { startPassport } from '../state/passport'

// La app completa dentro de la presentación privada: navegable, con datos de demostración que viven solo
// en este navegador (no toca la base de datos real). La marca de agua con el nombre del invitado va
// encima de todo (ver DemoApp). Se puede volver a la presentación con el botón de abajo.

let started = false

export default function DemoMall({ onExit }: { onExit: () => void }) {
  useEffect(() => {
    if (started) return
    started = true
    // pasaporte: sellos por visitar pasillos, encontrar gemas y comprar
    startPassport()
    // para presentar: la isla de entretenimiento y el aeropuerto visibles
    useEntertainmentFeature.setState({ enabled: true })
    useAirportFeature.setState({ enabled: true })
  }, [])
  return (
    <>
      <App />
      <button
        onClick={onExit}
        className="fixed bottom-[max(0.6rem,env(safe-area-inset-bottom))] left-1/2 z-[2147482000] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-deep/85 px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg backdrop-blur"
      >
        <ArrowLeft className="size-3.5" /> Volver a la presentación
      </button>
    </>
  )
}
