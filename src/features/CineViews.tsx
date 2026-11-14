import { AnimatePresence, motion } from 'motion/react'
import { Clapperboard, X } from 'lucide-react'
import { Suspense, lazy, useEffect, useState, type CSSProperties } from 'react'
import { useCine } from '../state/cine'
import { useCineUi } from '../state/cineUi'
import { useEffectivePosters } from '../state/cineFeed'
import { PosterArt } from '../cinema/ui'

// El lobby (MallPlay Cinema) es otra experiencia: se descarga aparte, solo cuando se entra al cine.
const Lobby = lazy(() => import('../cinema/Lobby'))

// Las dos interacciones del cine. «Cartelera»: al tocar los carteles del frente se abre una vista tipo sala (cortinas,
// foco de luz) con los cuatro carteles. «Entrar al cine»: al tocar el edificio las puertas se abren y se ven las tres
// cadenas; al elegir una, sus películas con horarios. Lo que se ve lo carga la administración (pestaña Cine).

const EASE = [0.65, 0, 0.25, 1] as const
const GOLD = '#f3c969'
const VELVET = 'repeating-linear-gradient(90deg, #7a1020 0 16px, #5c0c18 16px 32px)'

function Poster({ image, title, hue }: { image: string | null; title?: string; hue?: number }) {
  return image ? <img src={image} alt={title || 'Cartel de película'} className="size-full object-cover" loading="lazy" draggable={false} /> : <PosterArt title={title} hue={hue} />
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])
}

/** Fila de bombillos dorados (marquesina). */
function Bulbs({ n = 14 }: { n?: number }) {
  return (
    <div className="flex justify-center gap-2.5" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="size-1.5 rounded-full" style={{ background: GOLD, boxShadow: `0 0 8px ${GOLD}`, opacity: i % 2 ? 0.55 : 1 }} />
      ))}
    </div>
  )
}

/** Escenario de sala: fondo oscuro, foco de luz y cortinas de terciopelo a los lados. */
function Theatre({ children, onClose, label, bare = false }: { children: React.ReactNode; onClose: () => void; label: string; bare?: boolean }) {
  const stage: CSSProperties = bare
    ? { background: 'radial-gradient(120% 40% at 50% 100%, rgba(30,120,80,0.22), transparent 70%), #050507' }
    : { background: 'radial-gradient(90% 55% at 50% 0%, rgba(255,214,150,0.32), transparent 62%), linear-gradient(180deg,#1b0f1d 0%,#0b0710 100%)' }
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[70] overflow-y-auto text-white"
      style={stage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {!bare && (
        <>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[7%] min-w-[18px] md:w-[11%]" style={{ background: VELVET, boxShadow: '12px 0 28px rgba(0,0,0,.55)' }} aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[7%] min-w-[18px] md:w-[11%]" style={{ background: VELVET, boxShadow: '-12px 0 28px rgba(0,0,0,.55)' }} aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-6" style={{ background: 'linear-gradient(#4a0a14,#7a1020)', boxShadow: '0 8px 20px rgba(0,0,0,.5)' }} aria-hidden />
        </>
      )}
      <button onClick={onClose} aria-label="Cerrar" className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition active:scale-95">
        <X className="size-5" />
      </button>
      <div className={bare ? 'relative mx-auto min-h-full w-full max-w-md' : 'relative mx-auto min-h-full w-full max-w-4xl px-[calc(9%+4px)] pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] md:px-[14%]'}>{children}</div>
    </motion.div>
  )
}

function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center">
      <Bulbs />
      <h2 className="mt-3 text-[28px] font-black tracking-[0.14em]" style={{ color: '#fff3c4', textShadow: `0 0 18px ${GOLD}, 0 0 4px #ff5fa8` }}>
        {children}
      </h2>
      {sub && <p className="mt-1 text-[13px] text-white/70">{sub}</p>}
    </div>
  )
}

// ── Interacción 1: la cartelera ───────────────────────────────────────────────────────────────────

function Board() {
  const posters = useEffectivePosters()
  const lobbyOn = useCine((s) => s.lobbyOn)
  const [zoom, setZoom] = useState<number | null>(null)
  const close = () => useCineUi.getState().close()
  useEscape(zoom === null, close)
  return (
    <Theatre onClose={close} label="Cartelera del cine">
      <Title sub="En cartelera">CARTELERA</Title>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
        {posters.map((p, i) => (
          <button key={i} onClick={() => setZoom(i)} className="group text-left" aria-label={`Ver el cartel ${p.title || i + 1}`}>
            <div className="aspect-[2/3] overflow-hidden rounded-md transition group-active:scale-[0.97]" style={{ boxShadow: `0 0 0 3px #1b2247, 0 0 0 5px ${GOLD}, 0 10px 28px rgba(0,0,0,.55)` }}>
              <Poster image={p.image} title={p.title} hue={i} />
            </div>
            <p className="mt-3 line-clamp-2 text-center text-[13px] font-bold leading-tight text-white/90">{p.title || 'Próximo estreno'}</p>
          </button>
        ))}
      </div>
      {lobbyOn && (
        <div className="mt-8 flex justify-center">
          <button onClick={() => useCineUi.getState().open('lobby')} className="flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-[#2a1405] shadow-lg transition active:scale-95" style={{ background: `linear-gradient(180deg,#ffe19a,${GOLD})` }}>
            <Clapperboard className="size-5" /> Entrar al cine
          </button>
        </div>
      )}
      <AnimatePresence>
        {zoom !== null && (
          <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)}>
            <motion.div className="w-full max-w-[min(78vw,340px)]" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
              <div className="aspect-[2/3] overflow-hidden rounded-lg" style={{ boxShadow: `0 0 0 4px ${GOLD}, 0 20px 50px rgba(0,0,0,.6)` }}>
                <Poster image={posters[zoom].image} title={posters[zoom].title} hue={zoom} />
              </div>
              <p className="mt-4 text-center text-lg font-extrabold">{posters[zoom].title || 'Próximo estreno'}</p>
              <p className="mt-1 text-center text-xs text-white/60">Toca para cerrar</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Theatre>
  )
}

/** Monta la vista abierta del cine (si la administración dejó la interacción encendida). */
export function CineHost() {
  const view = useCineUi((s) => s.view)
  const boardOn = useCine((s) => s.boardOn)
  const lobbyOn = useCine((s) => s.lobbyOn)
  const enabled = useCine((s) => s.enabled)
  const shown = enabled && ((view === 'board' && boardOn) || (view === 'lobby' && lobbyOn)) ? view : null
  return <AnimatePresence mode="wait">{shown === 'board' ? <Board key="board" /> : shown === 'lobby' ? (
        <Suspense key="lobby" fallback={<div className="fixed inset-0 z-[70] bg-[#081827]" aria-busy="true" aria-label="Abriendo el cine" />}>
          <Lobby />
        </Suspense>
      ) : null}</AnimatePresence>
}
