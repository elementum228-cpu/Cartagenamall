import { useEffect, useState } from 'react'
import { useIsDesktop } from '../lib/useMedia'
import { useUI } from '../state/ui'

// Invitación a hacer zoom: una mano con dos dedos que se abren (pellizcar) sobre el mapa. Aparece
// unos segundos, se esconde y vuelve a invitar, hasta que la persona hace zoom por primera vez
// (pellizco, rueda del mouse o botones +/−); desde ahí no vuelve en esta visita. No bloquea el mapa.

const LEARNED_KEY = 'cm:pinch-learned'
const SHOW_MS = 7000
const PAUSE_MS = 22000
const FIRST_DELAY_MS = 1200

function learnedBefore() {
  try {
    return sessionStorage.getItem(LEARNED_KEY) === '1'
  } catch {
    return false
  }
}

export function PinchHint({ hidden }: { hidden: boolean }) {
  const desktop = useIsDesktop()
  const tour = useUI((s) => s.tourStep !== null)
  const [learned, setLearned] = useState(learnedBefore)
  const [visible, setVisible] = useState(false)

  // ¿ya hizo zoom? pellizco con dos dedos, rueda/trackpad sobre el mapa o los botones +/−
  useEffect(() => {
    if (learned) return
    const done = () => {
      setLearned(true)
      try {
        sessionStorage.setItem(LEARNED_KEY, '1')
      } catch {
        /* sin almacenamiento: vale solo mientras la página siga abierta */
      }
    }
    const onWheel = (e: WheelEvent) => (e.target as HTMLElement)?.tagName === 'CANVAS' && done()
    const onTouch = (e: TouchEvent) => e.touches.length >= 2 && done()
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouch, { passive: true })
    const unsub = useUI.subscribe((s, prev) => s.focus !== prev.focus && s.focus?.kind === 'zoom' && done())
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouch)
      unsub()
    }
  }, [learned])

  // ciclo: aparece, se esconde, vuelve a aparecer
  useEffect(() => {
    if (learned) return setVisible(false)
    let t: number
    const show = () => {
      setVisible(true)
      t = window.setTimeout(hide, SHOW_MS)
    }
    const hide = () => {
      setVisible(false)
      t = window.setTimeout(show, PAUSE_MS)
    }
    t = window.setTimeout(show, FIRST_DELAY_MS)
    return () => clearTimeout(t)
  }, [learned])

  const on = visible && !learned && !hidden && !tour
  return (
    <div
      className="pointer-events-none absolute top-1/2 left-1/2 z-20 flex flex-col items-center gap-1.5 text-white"
      style={{ opacity: on ? 1 : 0, transform: `translate(-50%, -50%) scale(${on ? 1 : 0.92})`, transition: 'opacity 0.6s ease, transform 0.6s ease' }}
      aria-hidden={!on}
      role="status"
    >
      <PinchIcon />
      <p className="text-[13px] font-semibold tracking-wide [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]">{desktop ? 'Rueda o pellizca para acercarte' : 'Pellizca para acercarte'}</p>
    </div>
  )
}

/** Ícono de línea clásico del gesto de zoom: mano con índice y pulgar en V, toques en las puntas y
 * flechas que salen hacia afuera («abre los dedos para acercar»). */
function PinchIcon() {
  return (
    <svg viewBox="0 0 64 64" className="size-[76px] overflow-visible drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M33 34 L39 10 A3.6 3.6 0 0 1 46 11.6 L43 33 C47.5 32.4 52.5 34.6 52.5 39.5 L52.5 47 C52.5 55 47 60 40 60 L36.5 60 C32.5 60 30 57.8 28.8 54.6 L12.6 32.6 A3.6 3.6 0 0 1 18.2 28 L31 40 Z" />
      <path d="M43 33 L43.4 40.5 M48 33.8 L48 41" strokeWidth="2" opacity="0.75" />
      {/* toques en las puntas */}
      <circle className="pinch-tap" cx="42.6" cy="10.4" r="5.6" strokeWidth="1.6" />
      <circle className="pinch-tap" cx="15.2" cy="30" r="5.6" strokeWidth="1.6" />
      {/* flechas hacia afuera */}
      <g className="pinch-out-r" strokeWidth="2">
        <path d="M50 4.5 L56 -1.5 M56 -1.5 L50.8 -1.5 M56 -1.5 L56 3.7" />
      </g>
      <g className="pinch-out-l" strokeWidth="2">
        <path d="M9 24.5 L3 18.5 M3 18.5 L3 23.7 M3 18.5 L8.2 18.5" />
      </g>
    </svg>
  )
}
