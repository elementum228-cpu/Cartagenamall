import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Plane, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useUI } from '../state/ui'
import { airportAnchor } from './anchor'

/**
 * Invitación a volar: tarjeta de vidrio que flota sobre el aeropuerto (sigue la cámara) cuando se
 * toca. Propuesta de diseño: «Volar ahora» aún no despega (llega en la siguiente fase).
 */
export function FlyInvite() {
  const open = useUI((s) => s.airportOpen)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      const el = box.current
      if (el) {
        el.style.transform = `translate(${airportAnchor.x}px, ${airportAnchor.y}px) translate(-50%, -100%)`
        el.style.visibility = airportAnchor.visible ? 'visible' : 'hidden'
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [open])
  return (
    <div ref={box} className="pointer-events-none fixed top-0 left-0 z-30">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="pointer-events-auto relative mb-3 w-[272px] origin-bottom rounded-[26px] border border-white/25 bg-[#0d2a3f]/72 px-5 pt-7 pb-5 text-center text-white shadow-[0_18px_50px_rgb(0_0_0/0.35)] backdrop-blur-xl"
          >
            <span className="absolute -top-5 left-1/2 grid h-10 w-[74px] -translate-x-1/2 -rotate-6 place-items-center rounded-lg bg-[#f5c542] text-[#0d2a3f] shadow-[0_6px_18px_rgb(245_197_66/0.45)]" aria-hidden>
              <Plane className="size-5" strokeWidth={2.2} />
            </span>
            <button className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full bg-white/10 text-white/80" aria-label="Cerrar" onClick={() => useUI.getState().openAirport(false)}>
              <X className="size-4" />
            </button>
            <p className="text-[17px] leading-snug font-semibold">¿Estás listo para ir a la</p>
            <p className="text-[19px] leading-snug font-extrabold text-[#f5c542]">Isla de los Descuentos?</p>
            <p className="mt-1 text-[13.5px] text-white/80">Conoce más locales</p>
            <button
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#1fc7b6] to-[#0f8f86] text-[16px] font-semibold shadow-[0_8px_24px_rgb(19_185_173/0.45)] transition active:scale-[0.98]"
              onClick={() => useUI.getState().toast('Propuesta de diseño: el vuelo a Isla Descuento llega en la siguiente fase.')}
            >
              <Plane className="size-5" /> Volar ahora <ChevronRight className="size-5" />
            </button>
            <span className="absolute -bottom-2.5 left-1/2 size-5 -translate-x-1/2 rotate-45 border-r border-b border-white/25 bg-[#0d2a3f]" aria-hidden />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
