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
      className="pointer-events-none absolute top-1/2 left-1/2 z-20 flex flex-col items-center gap-3"
      style={{ opacity: on ? 1 : 0, transform: `translate(-50%, -50%) scale(${on ? 1 : 0.85})`, transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 1.4, 0.4, 1)' }}
      aria-hidden={!on}
      role="status"
    >
      <div className="relative grid size-32 place-items-center rounded-full bg-ink/35 backdrop-blur-sm">
        <span className="pinch-ring absolute inset-0 rounded-full border-2 border-white/60" />
        <PinchHand />
      </div>
      <p className="rounded-full bg-white/95 px-4 py-2 text-sm font-extrabold text-ink shadow-float">{desktop ? 'Usa la rueda o pellizca para acercarte' : 'Pellizca para acercarte'}</p>
    </div>
  )
}

/** Mano con pulgar e índice que se separan (gesto de zoom), con los toques marcados en la punta. */
function PinchHand() {
  return (
    <svg viewBox="0 0 100 100" className="size-24 overflow-visible drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)]" aria-hidden>
      {/* flechas que indican «abrir» */}
      <g className="pinch-arrows" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 22 L10 14 M10 14 L10 23 M10 14 L19 14" />
        <path d="M82 22 L90 14 M90 14 L90 23 M90 14 L81 14" />
      </g>
      {/* dedos (giran sobre su base: se abren y se cierran) */}
      <g className="pinch-index" style={{ transformOrigin: '56px 64px' }}>
        <rect x="50" y="22" width="13" height="46" rx="6.5" fill="#fff" stroke="#1f1b16" strokeWidth="3" />
        <circle className="pinch-tap" cx="56.5" cy="27" r="9" fill="none" stroke="#f5c35c" strokeWidth="3" />
      </g>
      <g className="pinch-thumb" style={{ transformOrigin: '44px 70px' }}>
        <rect x="22" y="44" width="13" height="34" rx="6.5" fill="#fff" stroke="#1f1b16" strokeWidth="3" transform="rotate(-48 28 61)" />
        <circle className="pinch-tap" cx="17" cy="51" r="9" fill="none" stroke="#f5c35c" strokeWidth="3" />
      </g>
      {/* palma */}
      <path d="M38 62 C38 56 46 54 52 58 L66 60 C74 61 78 68 76 78 C74 90 64 96 52 95 C42 94 34 86 35 74 Z" fill="#fff" stroke="#1f1b16" strokeWidth="3" strokeLinejoin="round" />
      <path d="M63 64 L66 70 M69 66 L71 72" stroke="#1f1b16" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
    </svg>
  )
}
