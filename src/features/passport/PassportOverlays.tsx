import { AnimatePresence, motion } from 'motion/react'
import { Map as MapIcon, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { playSparkle } from '../../lib/doorSound'
import { HUNT_LENGTH, huntFor } from '../../promotions/hunt'
import { useCatalog } from '../../state/catalog'
import { loyaltyOf, usePassport } from '../../state/passport'
import { useUI } from '../../state/ui'
import { StampSeal, stampInfo } from './ui'

// Lo que aparece sobre el mall al ganar algo: el sello que cae en el pasaporte y la ventana de cada
// pista encontrada en la búsqueda del tesoro.

/** Aviso flotante al ganar un sello (del pasaporte o de la tarjeta de una tienda). */
export function StampToast() {
  const last = usePassport((s) => s.lastStamp)
  const clear = usePassport((s) => s.clearCelebration)
  const store = useCatalog((s) => (last?.kind === 'store' ? s.stores.find((st) => st.id === last.id) : undefined))
  const have = usePassport((s) => (last?.kind === 'store' ? (s.cards[last.id] ?? 0) : 0))

  useEffect(() => {
    if (!last) return
    if (last.kind === 'passport') void playSparkle()
    const t = window.setTimeout(clear, 3200)
    return () => clearTimeout(t)
  }, [last, clear])

  const info = last?.kind === 'passport' ? stampInfo(last.id) : undefined
  const loyalty = loyaltyOf(store)
  return (
    <AnimatePresence>
      {last && (info || (store && loyalty.active)) && (
        <motion.div
          key={`${last.kind}-${last.id}-${last.at}`}
          className="pointer-events-none fixed inset-x-0 top-[calc(var(--chrome-top)+8px)] z-[75] flex justify-center px-3"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          role="status"
        >
          <Link to="/pasaporte" onClick={clear} className="glass-strong pointer-events-auto flex items-center gap-3 rounded-[24px] py-2.5 pr-4 pl-2.5">
            {info ? (
              <StampSeal id={last.id} earned size={48} fresh />
            ) : (
              <span className="grid size-12 place-items-center rounded-full text-lg font-extrabold text-white" style={{ background: store!.brandColor }}>
                {Math.min(have, loyalty.stamps)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-[11.5px] font-semibold text-ink-soft">{info ? '¡Nuevo sello en tu pasaporte!' : `Sello en ${store!.name}`}</span>
              <span className="block text-[15px] leading-tight font-bold">
                {info ? info.name : have >= loyalty.stamps ? '¡Tarjeta llena! Canjea tu premio' : `${have} de ${loyalty.stamps} para tu premio`}
              </span>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Ventana de una pista encontrada: revela la siguiente o celebra el tesoro. */
export function ClueModal() {
  const clue = useUI((s) => s.clue)
  const findClue = usePassport((s) => s.findClue)
  const close = () => useUI.getState().openClue(null)

  useEffect(() => {
    if (!clue) return
    findClue(clue.week, clue.index, HUNT_LENGTH)
    void playSparkle()
  }, [clue, findClue])

  const steps = clue ? huntFor(clue.week) : []
  const last = clue ? clue.index >= HUNT_LENGTH - 1 : false
  const next = clue && !last ? steps[clue.index + 1] : null

  return (
    <AnimatePresence>
      {clue && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center bg-deep/45 p-4 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            role="dialog"
            aria-modal
            aria-label={last ? 'Tesoro encontrado' : 'Pista encontrada'}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong relative w-full max-w-sm rounded-[32px] p-6 text-center"
            initial={{ scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            <button onClick={close} className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-ink/[0.06] text-ink-soft" aria-label="Cerrar">
              <X className="size-4" />
            </button>
            <div className="mx-auto flex justify-center">
              {last ? (
                <StampSeal id="TESORO" earned size={84} fresh />
              ) : (
                <motion.span
                  className="grid size-16 place-items-center rounded-[20px] bg-gradient-to-br from-teal-bright to-teal text-white shadow-[var(--shadow-glow)]"
                  initial={{ rotate: -20, scale: 0.5 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                >
                  <MapIcon className="size-8" strokeWidth={1.8} />
                </motion.span>
              )}
            </div>
            <p className="mt-3 text-[12px] font-semibold text-ink-soft">Búsqueda del tesoro · pista {clue.index + 1} de {HUNT_LENGTH}</p>
            <h2 className="mt-0.5 text-[22px] leading-tight font-bold tracking-[-0.02em]">{last ? '¡Encontraste el tesoro!' : '¡Pista encontrada!'}</h2>
            {next ? (
              <div className="mt-4 rounded-[22px] bg-teal/10 p-4 text-left">
                <p className="text-[11.5px] font-bold tracking-wide text-teal uppercase">Siguiente pista</p>
                <p className="mt-1 text-[15px] leading-snug font-semibold text-ink">{next.clue}</p>
              </div>
            ) : (
              <p className="mt-2 text-[14px] text-ink-soft">Ganaste el sello del tesoro en tu pasaporte. La próxima semana hay una búsqueda nueva.</p>
            )}
            <div className="mt-5 flex gap-2">
              <Link to="/pasaporte" onClick={close} className="flex h-12 flex-1 items-center justify-center rounded-full bg-ink/[0.06] text-[15px] font-semibold">
                Mi pasaporte
              </Link>
              <button onClick={close} className="glass-teal h-12 flex-1 rounded-full text-[15px] font-semibold">
                {last ? 'Genial' : 'A buscar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
