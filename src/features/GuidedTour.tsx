import {
  Anchor,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Film,
  Footprints,
  Gamepad2,
  Landmark,
  Layers,
  LayoutGrid,
  MapPin,
  Mouse,
  Move,
  Plane,
  Scissors,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Trophy,
  Utensils,
  Zap,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AIRPORT_FOCUS } from '../airport/config'
import { COURT_SPACE, FLOOR_OF_ZONE, MALL, SPACES, SPACE_BY_ID, ZONE_BY_ID } from '../config/mall'
import { STADIUM } from '../config/stadium'
import type { ZoneId } from '../domain/types'
import { COURT_COLOR } from '../football/open'
import { playSparkle, playWhoosh } from '../lib/doorSound'
import { formatCOP } from '../lib/format'
import { isPromotionLive } from '../lib/pricing'
import { useIsDesktop } from '../lib/useMedia'
import { useUse3D } from '../lib/view3d'
import { useAirportFeature } from '../state/airportFeature'
import { useCine } from '../state/cine'
import { useEntertainmentFeature } from '../state/entertainmentFeature'
import { isServicesSpace, useServicesFeature } from '../state/servicesFeature'
import { ENT_COLOR } from '../entertainment/config'
import { HARBOR_FOCUS } from '../tourism/config'
import { BX, BZ, DECK, DX } from '../world/cinemaLayout'
import { cameraState } from '../world/cameraState'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { spacePrice, useSpacePricing } from '../state/spacePricing'
import { usePrefs, useUI } from '../state/ui'
import { markDone } from './tourState'

// Recorrido de bienvenida, en dos partes:
//  1) «Cómo moverte»: te enseña a usar la plataforma sobre la propia pantalla (mover y acercar el mapa —con prueba en vivo—, y un foco
//     sobre Categorías, Descubre, los pisos y la barra de navegación).
//  2) «Qué encontrarás»: la cámara vuela por las zonas del mall (pasillos, comidas, servicios, cine, entretenimiento, deportes, estadio,
//     aeropuerto y muelle) y marca cada una con un aro y su nombre.
// Se muestra la primera vez (después del portón) y se puede repetir desde «Recorrido guiado» en las opciones del mapa.

const STEP_MS = 6000

export { startTour, tourDone } from './tourState'

type StepType = 'story' | 'coach' | 'demo'
type DemoKind = 'drag' | 'pinch' | 'wheel'

interface Step {
  key: string
  type: StepType
  icon: LucideIcon
  color: string
  kicker: string
  title: string
  body: ReactNode
  chips?: string[]
  /** Mueve la cámara a esta parada. */
  go?: () => void
  /** coach: valor de `data-tour` del elemento que se resalta. */
  target?: string
  /** demo: gesto que se muestra y que la persona puede probar de verdad sobre el mapa. */
  demo?: DemoKind
  /** story: nombre que se escribe sobre el aro que marca la zona. */
  mark?: string
}

/** Resorte de las apps nativas: arranca ágil y se asienta sin rebote. */
const SPRING = {
  type: 'spring',
  stiffness: 360,
  damping: 34,
  mass: 0.9,
} as const
/** Distancia (px) o velocidad para que un deslizamiento lateral cambie de parada. */
const SWIPE_PX = 60
const SWIPE_V = 450

export function GuidedTour() {
  const step = useUI((s) => s.tourStep)
  const steps = useTourSteps()
  const use3D = useUse3D()
  const timer = useRef<number | null>(null)
  const startedAt = useRef(0)
  const remaining = useRef(STEP_MS)
  const [paused, setPaused] = useState(false)
  const pressedAt = useRef(0)
  const [dir, setDir] = useState(1)
  const [demoDone, setDemoDone] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const current = step === null ? null : steps[Math.min(step, steps.length - 1)]
  const last = step !== null && step >= steps.length - 1
  const type: StepType = current?.type ?? 'story'
  // Solo en desarrollo, `?tourfreeze`: sin avance automático (para fotografiar cada parada con calma)
  const freeze = import.meta.env.DEV && new URLSearchParams(location.search).has('tourfreeze')
  const auto = type === 'story' && !last && !freeze

  const finish = () => {
    markDone()
    // quien ya hizo el recorrido no necesita la tarjeta «Cómo explorar» ni el botón de entrada: el mapa queda limpio
    usePrefs.getState().setHintSeen()
    usePrefs.getState().setCtaSeen()
    useUI.getState().setTourStep(null)
    useUI.getState().setOverview(true)
  }
  /** Fue un toque breve (no mantener presionado para pausar). */
  const tapped = () => performance.now() - pressedAt.current < 350
  const goto = (n: number) => {
    if (n < 0 || step === null) return
    if (n >= steps.length) return finish()
    setDir(n > step ? 1 : -1)
    setPaused(false)
    useUI.getState().setTourStep(n)
  }

  // cada parada: mover la cámara y sonar
  useEffect(() => {
    if (step === null || !current) return
    setDemoDone(false)
    setRect(null)
    current.go?.()
    if (last) void playSparkle()
    else if (step > 0) void playWhoosh()
    remaining.current = STEP_MS
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // avance automático (solo en las paradas de «Qué encontrarás»); mantener presionado lo pausa y al soltar sigue donde iba
  useEffect(() => {
    if (step === null || !auto) return
    if (paused) {
      remaining.current = Math.max(0, remaining.current - (performance.now() - startedAt.current))
      return
    }
    startedAt.current = performance.now()
    timer.current = window.setTimeout(() => goto(step + 1), remaining.current)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paused, auto])

  // prueba en vivo: si la persona mueve o acerca el mapa de verdad, se celebra y se pasa a la siguiente
  const demoKind = current?.demo
  useEffect(() => {
    if (step === null || type !== 'demo' || !demoKind || demoDone) return
    const z0 = cameraState.zoom
    const x0 = cameraState.target.x
    const y0 = cameraState.target.z
    const kind = demoKind
    const id = window.setInterval(() => {
      const moved = Math.hypot(cameraState.target.x - x0, cameraState.target.z - y0) * cameraState.zoom
      const zoomed = Math.abs(Math.log(cameraState.zoom / z0))
      if ((kind === 'drag' && moved > 45) || (kind !== 'drag' && zoomed > 0.2)) {
        window.clearInterval(id)
        setDemoDone(true)
      }
    }, 150)
    return () => window.clearInterval(id)
  }, [step, type, demoKind, demoDone])
  useEffect(() => {
    if (!demoDone || step === null) return
    const id = window.setTimeout(() => goto(step + 1), 1300)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoDone])

  // la interfaz del mall se aparta solo en las paradas de recorrido por el mapa; al enseñar la interfaz hay que verla
  const hideUi = step !== null && type === 'story'
  useEffect(() => {
    document.documentElement.classList.toggle('tour-on', hideUi)
    return () => document.documentElement.classList.remove('tour-on')
  }, [hideUi])

  // teclado: flechas para moverse, Escape para salir
  useEffect(() => {
    if (step === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goto(step + 1)
      else if (e.key === 'ArrowLeft') goto(step - 1)
      else if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // la tarjeta sube si lo que se resalta está abajo (la barra de navegación)
  const cardOnTop = type === 'coach' && !!rect && rect.top > window.innerHeight * 0.55
  const mark = use3D && type === 'story' ? current?.mark : undefined

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {step !== null && current && (
          <motion.div
            key="tour"
            className={`fixed inset-0 z-[55] select-none ${type === 'demo' ? 'pointer-events-none' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            role="dialog"
            aria-label="Recorrido guiado por el centro comercial"
          >
            {type === 'story' && (
              /* toques sobre el mapa: izquierda vuelve, derecha avanza; mantener presionado pausa */
              <div
                className="absolute inset-0"
                onPointerDown={() => {
                  pressedAt.current = performance.now()
                  setPaused(true)
                }}
                onPointerUp={() => setPaused(false)}
                onPointerCancel={() => setPaused(false)}
                onPointerLeave={() => setPaused(false)}
              >
                <button type="button" className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize" aria-label="Parada anterior" onClick={() => tapped() && goto(step - 1)} />
                <button type="button" className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize" aria-label="Siguiente parada" onClick={() => tapped() && goto(step + 1)} />
              </div>
            )}
            {type === 'coach' && <Spotlight target={current.target} onRect={setRect} />}
            {/* velo suave abajo para leer la tarjeta sobre el mapa */}
            {type !== 'coach' && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-deep/70 via-deep/25 to-transparent" />}
            {type === 'demo' && current.demo && <GestureDemo kind={current.demo} done={demoDone} />}
            {mark && <ZoneMark label={mark} color={current.color} icon={current.icon} />}

            {/* arriba: contador y salir, en vidrio (solo en las paradas del mapa; al enseñar la interfaz ahí está su barra) */}
            {type === 'story' && (
              <motion.div
                className="pointer-events-auto absolute inset-x-3 top-[max(12px,env(safe-area-inset-top))] flex items-center justify-between md:inset-x-6"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...SPRING, delay: 0.1 }}
              >
                <span className="glass rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink tabular-nums">
                  {step + 1} de {steps.length}
                </span>
                <button
                  type="button"
                  onClick={finish}
                  className="glass touch-hit relative rounded-full px-4 py-1.5 text-[13px] font-semibold text-ink transition active:scale-[0.96]"
                >
                  Saltar
                </button>
              </motion.div>
            )}

            {/* tarjeta: se queda en su sitio y solo cambia su contenido; se desliza de lado para cambiar de parada */}
            <div
              className={`pointer-events-none absolute inset-x-3 flex justify-center md:inset-x-0 ${cardOnTop ? 'top-[calc(max(12px,env(safe-area-inset-top))+52px)] md:top-20' : 'bottom-[max(16px,env(safe-area-inset-bottom))] md:bottom-8'}`}
            >
              <motion.div
                className="glass-strong pointer-events-auto w-full max-w-[460px] touch-pan-y overflow-hidden rounded-[32px]"
                initial={{ y: cardOnTop ? -60 : 80, opacity: 0, scale: 0.94 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={SPRING}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.35}
                onDragStart={() => setPaused(true)}
                onDragEnd={(_, info) => {
                  setPaused(false)
                  if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_V) goto(step + 1)
                  else if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_V) goto(step - 1)
                }}
                layout
              >
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div
                    key={current.key}
                    custom={dir}
                    variants={{
                      enter: (d: number) => ({
                        x: d * 70,
                        opacity: 0,
                        filter: 'blur(8px)',
                      }),
                      center: { x: 0, opacity: 1, filter: 'blur(0px)' },
                      exit: (d: number) => ({
                        x: d * -70,
                        opacity: 0,
                        filter: 'blur(8px)',
                      }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={SPRING}
                    className="px-5 pt-5 pb-1"
                  >
                    <div className="flex items-center gap-3.5">
                      <motion.span
                        className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-[18px] text-white"
                        style={{
                          background: `linear-gradient(145deg, ${current.color}, color-mix(in srgb, ${current.color} 70%, #062c42))`,
                          boxShadow: `0 10px 24px -10px ${current.color}`,
                        }}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 18,
                          delay: 0.06,
                        }}
                      >
                        {/* brillo de vidrio arriba del ícono */}
                        <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
                        <motion.span
                          initial={{ y: 6 }}
                          animate={{ y: [6, -3, 0] }}
                          transition={{
                            duration: 0.55,
                            delay: 0.12,
                            ease: 'easeOut',
                          }}
                        >
                          <current.icon className="relative size-7" strokeWidth={1.8} />
                        </motion.span>
                      </motion.span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-ink-soft">{current.kicker}</p>
                        <h2 className="text-[24px] leading-[1.1] font-bold tracking-[-0.02em] text-ink">{current.title}</h2>
                      </div>
                    </div>
                    <div className="mt-3 text-[15px] leading-snug text-ink-soft">{current.body}</div>
                    {type === 'demo' && (
                      <p className={`mt-2.5 flex items-center gap-1.5 text-[13px] font-bold ${demoDone ? 'text-teal' : 'text-ink-soft'}`} aria-live="polite">
                        {demoDone ? (
                          <>
                            <Check className="size-4" strokeWidth={3} /> ¡Eso es!
                          </>
                        ) : (
                          'Pruébalo ahora sobre el mapa'
                        )}
                      </p>
                    )}
                    {current.chips && current.chips.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {current.chips.map((c, i) => (
                          <motion.span
                            key={c}
                            className="rounded-full bg-ink/[0.06] px-3 py-1 text-[12.5px] font-semibold text-ink"
                            initial={{ opacity: 0, y: 8, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ ...SPRING, delay: 0.12 + i * 0.05 }}
                          >
                            {c}
                          </motion.span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="px-5 pt-4 pb-5">
                  {/* indicador de páginas: la actual es una cápsula; en las paradas del mapa se llena con el tiempo */}
                  <div className="mb-4 flex items-center justify-center gap-1" aria-hidden>
                    {steps.map((s, i) => (
                      <motion.span key={s.key} className="relative h-[6px] overflow-hidden rounded-full bg-ink/15" animate={{ width: i === step ? 22 : 6 }} transition={SPRING}>
                        {i === step && (
                          <span
                            key={`fill-${step}`}
                            className="absolute inset-y-0 left-0 rounded-full bg-teal"
                            style={
                              auto
                                ? {
                                    animation: `tour-fill ${STEP_MS}ms linear forwards`,
                                    animationPlayState: paused ? 'paused' : 'running',
                                  }
                                : { width: '100%' }
                            }
                          />
                        )}
                        {i < step && <span className="absolute inset-0 rounded-full bg-ink/35" />}
                      </motion.span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <AnimatePresence initial={false}>
                      {step > 0 && (
                        <motion.button
                          type="button"
                          onClick={() => goto(step - 1)}
                          className="grid size-[52px] shrink-0 place-items-center rounded-full bg-ink/[0.06] text-ink transition active:scale-[0.95]"
                          aria-label="Anterior"
                          initial={{ opacity: 0, scale: 0.6, width: 0 }}
                          animate={{ opacity: 1, scale: 1, width: 52 }}
                          exit={{ opacity: 0, scale: 0.6, width: 0 }}
                          transition={SPRING}
                        >
                          <ChevronLeft className="size-5" strokeWidth={2} />
                        </motion.button>
                      )}
                    </AnimatePresence>
                    <motion.button
                      type="button"
                      layout
                      onClick={() => goto(step + 1)}
                      className="glass-teal flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full text-[16px] font-semibold tracking-[-0.01em] transition active:scale-[0.98]"
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={last ? 'fin' : 'sig'}
                          className="flex items-center gap-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={SPRING}
                        >
                          {last ? (
                            <>
                              <Compass className="size-5" strokeWidth={1.9} /> Empezar a explorar
                            </>
                          ) : (
                            <>
                              {step === 0 ? 'Comenzar' : 'Continuar'} <ChevronRight className="size-5" strokeWidth={2} />
                            </>
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </motion.button>
                  </div>
                  {type === 'story' ? (
                    <p className="mt-3 text-center text-[11.5px] text-ink-soft max-md:block md:hidden">Desliza la tarjeta o toca el mapa para avanzar</p>
                  ) : (
                    <button type="button" onClick={finish} className="mx-auto mt-2 block min-h-11 px-4 text-[13px] font-semibold text-ink-soft underline underline-offset-2">
                      Saltar recorrido
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
            {last && <Sparks />}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}

/**
 * Foco sobre un elemento real de la interfaz (marcado con `data-tour`): todo se oscurece menos él, con un aro que late.
 * Si el elemento no está en pantalla (otra versión del diseño), solo queda el velo y la tarjeta explica.
 */
function Spotlight({ target, onRect }: { target?: string; onRect: (r: DOMRect | null) => void }) {
  const [r, setR] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!target) return
    let raf = 0
    let until = performance.now() + 900 // las barras se acomodan con una transición: se mide unos instantes
    const measure = () => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].find((e) => {
        const b = e.getBoundingClientRect()
        return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'
      })
      const b = el ? el.getBoundingClientRect() : null
      setR((old) => (old && b && old.x === b.x && old.y === b.y && old.width === b.width && old.height === b.height ? old : b))
      onRect(b)
      if (performance.now() < until) raf = requestAnimationFrame(measure)
    }
    measure()
    const onResize = () => {
      until = performance.now() + 400
      cancelAnimationFrame(raf)
      measure()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [target, onRect])
  if (!r) return <div className="absolute inset-0 bg-deep/60" />
  const pad = 8
  return (
    <div className="absolute inset-0" aria-hidden>
      {/* el hueco: una sombra enorme alrededor del elemento oscurece todo lo demás */}
      <div
        className="absolute rounded-[24px] border-2 border-white/90"
        style={{
          left: r.left - pad,
          top: r.top - pad,
          width: r.width + pad * 2,
          height: r.height + pad * 2,
          boxShadow: '0 0 0 100vmax rgb(3 14 24 / 0.62)',
        }}
      />
      <motion.div
        className="absolute rounded-[28px] border-2 border-teal-bright"
        style={{
          left: r.left - pad,
          top: r.top - pad,
          width: r.width + pad * 2,
          height: r.height + pad * 2,
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.9, 0, 0.9] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      />
    </div>
  )
}

/** Animación del gesto (arrastrar, pellizcar o rueda) sobre el mapa; el mapa sigue tocable debajo. */
function GestureDemo({ kind, done }: { kind: DemoKind; done: boolean }) {
  const finger = 'absolute size-12 rounded-full border-2 border-white bg-white/35 shadow-[0_0_24px_rgb(255_255_255/0.55)]'
  return (
    <div className="pointer-events-none absolute top-[30%] left-1/2 h-40 w-56 -translate-x-1/2" aria-hidden>
      <div className="absolute inset-0 rounded-[28px] bg-deep/35" />
      {kind === 'drag' && (
        <>
          <motion.span
            className={`${finger} top-[calc(50%-24px)]`}
            initial={{ left: 24 }}
            animate={{ left: [24, 152, 24], opacity: done ? 0 : [0.9, 1, 0.9] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Move className="absolute top-3 right-3 size-6 text-white/80" strokeWidth={1.8} />
        </>
      )}
      {kind === 'pinch' && (
        <>
          <motion.span
            className={finger}
            initial={{ left: 86, top: 62 }}
            animate={{ left: [86, 40, 86], top: [62, 94, 62] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            className={finger}
            initial={{ left: 118, top: 44 }}
            animate={{ left: [118, 164, 118], top: [44, 12, 44] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <ZoomIn className="absolute top-3 left-3 size-6 text-white/80" strokeWidth={1.8} />
        </>
      )}
      {kind === 'wheel' && (
        <motion.div
          className="absolute inset-0 grid place-items-center text-white"
          animate={{ y: [0, -8, 0, 8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Mouse className="size-14" strokeWidth={1.4} />
        </motion.div>
      )}
      {done && (
        <motion.span
          className="absolute inset-0 grid place-items-center"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 16 }}
        >
          <span className="grid size-16 place-items-center rounded-full bg-teal text-white shadow-[0_10px_30px_-8px_rgb(0_141_135/0.8)]">
            <Check className="size-9" strokeWidth={3} />
          </span>
        </motion.span>
      )}
    </div>
  )
}

/** Marca de la zona que la cámara está mostrando: un aro que late en el punto enfocado y su nombre. */
function ZoneMark({ label, color, icon: Icon }: { label: string; color: string; icon: LucideIcon }) {
  return (
    <div className="pointer-events-none absolute top-[34%] left-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <div className="relative grid size-[120px] place-items-center">
        {[0, 0.7].map((d) => (
          <motion.span
            key={d}
            className="absolute inset-0 rounded-full border-[3px]"
            style={{ borderColor: color }}
            initial={{ scale: 0.55, opacity: 0.9 }}
            animate={{ scale: [0.55, 1.25], opacity: [0.9, 0] }}
            transition={{
              duration: 1.9,
              repeat: Infinity,
              delay: d,
              ease: 'easeOut',
            }}
          />
        ))}
        <span
          className="size-3 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 0 4px #fff, 0 0 18px ${color}`,
          }}
        />
      </div>
      <motion.div
        className="absolute bottom-full left-1/2 mb-1 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-white shadow-[0_8px_22px_-8px_rgb(0_0_0/0.6)]"
        style={{ background: color }}
        initial={{ y: 10, opacity: 0, scale: 0.85 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay: 0.35 }}
      >
        <Icon className="size-4" strokeWidth={2.2} />
        {label}
      </motion.div>
    </div>
  )
}

/** Destellos turquesa y ámbar que se abren suavemente al final del recorrido. */
function Sparks() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        i,
        x: (Math.random() - 0.5) * 460,
        y: -140 - Math.random() * 300,
        d: Math.random() * 0.25,
        s: 4 + Math.random() * 6,
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute bottom-56 left-1/2" aria-hidden>
      {sparks.map((p) => {
        const c = p.i % 3 === 0 ? '#13b9ad' : p.i % 3 === 1 ? '#f7b34b' : '#ffffff'
        return (
          <motion.span
            key={p.i}
            className="absolute rounded-full"
            style={{
              width: p.s,
              height: p.s,
              background: c,
              boxShadow: `0 0 10px ${c}`,
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
            animate={{
              x: p.x,
              y: [0, p.y, p.y + 110],
              opacity: [0, 1, 0],
              scale: [0.3, 1, 0.5],
            }}
            transition={{ duration: 1.8, delay: p.d, ease: [0.2, 0.8, 0.2, 1] }}
          />
        )
      })}
    </div>
  )
}

/** Paradas del recorrido, con datos reales del mall (tiendas, precios, ofertas, espacios libres) y solo lo que está activado. */
function useTourSteps(): Step[] {
  const assignments = useCatalog((s) => s.assignments)
  const promotions = useCatalog((s) => s.promotions)
  const { storeById, spaceByStore } = useCatalogMaps()
  const pricing = useSpacePricing()
  const entOn = useEntertainmentFeature((s) => s.enabled)
  const svcOn = useServicesFeature((s) => s.enabled)
  const airportOn = useAirportFeature((s) => s.enabled)
  const cineOn = useCine((s) => s.enabled)
  const desktop = useIsDesktop()
  const use3D = useUse3D()

  return useMemo(() => {
    const ui = () => useUI.getState()
    /** Para los puntos lejanos (cine, estadio, aeropuerto, muelle) se abre la vista general: ahí la cámara puede llegar. */
    const far = (focus: Parameters<ReturnType<typeof ui>['requestFocus']>[0]) => {
      ui().setOverview(true)
      ui().requestFocus(focus)
    }
    const storesIn = (zone: ZoneId) =>
      SPACES.filter((sp) => sp.zoneId === zone && assignments[sp.id])
        .map((sp) => storeById[assignments[sp.id]]?.name)
        .filter(Boolean) as string[]
    const tourSpaces = SPACES.filter((sp) => (entOn || sp.zoneId !== 'G') && (svcOn || !isServicesSpace(sp)))
    const freeSpaces = tourSpaces.filter((sp) => !assignments[sp.id])
    const totalStores = tourSpaces.filter((sp) => assignments[sp.id]).length
    const serviceIds = SPACES.filter(isServicesSpace).map((sp) => sp.id)
    const serviceStores = SPACES.filter(isServicesSpace)
      .map((sp) => storeById[assignments[sp.id]]?.name)
      .filter(Boolean) as string[]

    // ── Parte 1 · Cómo moverte ──────────────────────────────────────────────────────────────────────────────
    const coach: Step[] = [
      {
        key: 'bienvenida',
        type: 'coach',
        icon: MapPin,
        color: '#008d87',
        kicker: 'Bienvenido a',
        title: MALL.name,
        body: <>Un centro comercial para recorrer, descubrir y jugar. En menos de dos minutos te enseñamos a moverte y te mostramos qué hay en cada zona.</>,
        chips: [`${totalStores} tiendas`, '2 pisos', ...(entOn ? ['Entretenimiento'] : []), 'Ofertas escondidas'],
        go: () => ui().setOverview(true),
      },
      ...(use3D
        ? ([
            {
              key: 'mover',
              type: 'demo',
              demo: 'drag',
              icon: Move,
              color: '#3b82a6',
              kicker: 'Cómo moverte · 1',
              title: 'Recorre el mapa',
              body: desktop ? (
                <>Arrastra con el mouse para moverte por el mall (también puedes mantener Espacio y arrastrar).</>
              ) : (
                <>Desliza un dedo sobre el mapa para recorrer el mall.</>
              ),
            },
            {
              key: 'acercar',
              type: 'demo',
              demo: desktop ? 'wheel' : 'pinch',
              icon: ZoomIn,
              color: '#d99a1f',
              kicker: 'Cómo moverte · 2',
              title: 'Acerca y aleja',
              body: desktop ? (
                <>Usa la rueda del mouse para acercarte a una tienda o alejarte y verlo todo.</>
              ) : (
                <>Pellizca con dos dedos: sepáralos para acercar y júntalos para alejar. Así ves cada tienda de cerca.</>
              ),
            },
          ] as Step[])
        : []),
      {
        key: 'categorias',
        type: 'coach',
        target: 'categorias',
        icon: LayoutGrid,
        color: '#c2607f',
        kicker: 'Cómo moverte · 3',
        title: 'Categorías',
        body: <>Toca aquí para ir directo a Moda, Tecnología, Gastronomía, Cine… {desktop ? '' : 'Desliza la hoja hacia arriba y verás los locales de cada una.'}</>,
      },
      ...(desktop
        ? []
        : ([
            {
              key: 'descubre',
              type: 'coach',
              target: 'descubre',
              icon: Sparkles,
              color: '#e0558a',
              kicker: 'Cómo moverte · 4',
              title: 'Descubre',
              body: <>Tu pasaporte de sellos, las ofertas escondidas, el periódico MallPlay Hoy y el Arcade, todo en un solo lugar.</>,
            },
          ] as Step[])),
      {
        key: 'pisos',
        type: 'coach',
        target: 'pisos',
        icon: Layers,
        color: '#008d87',
        kicker: 'Cómo moverte · 5',
        title: 'Pisos',
        body: <>Cambia entre el piso 1 y el 2. «Todo» te muestra el mall completo, con todo lo que lo rodea.</>,
      },
      {
        key: 'navegacion',
        type: 'coach',
        target: 'nav',
        icon: ShoppingBag,
        color: '#5f9a6e',
        kicker: 'Cómo moverte · 6',
        title: desktop ? 'Explorar y comprar' : 'Tu barra de navegación',
        body: desktop ? (
          <>Cambia entre explorar el mapa y comprar productos de todas las tiendas en un solo lugar.</>
        ) : (
          <>Explora el mapa, compra productos de todas las tiendas, mira las ofertas relámpago y revisa tu carrito.</>
        ),
      },
    ]

    // ── Parte 2 · Qué encontrarás ───────────────────────────────────────────────────────────────────────────
    const names = (zone: ZoneId) => storesIn(zone)
    const lanes = (['A', 'B', 'C', 'D'] as ZoneId[]).map((id) => ZONE_BY_ID[id].name)
    const flash = promotions.find((p) => p.type === 'flash' && isPromotionLive(p, Date.now()) && spaceByStore[p.storeId] && SPACE_BY_ID[spaceByStore[p.storeId]])
    const secrets = promotions.filter((p) => p.type === 'secret' && isPromotionLive(p, Date.now())).length
    const court = assignments[COURT_SPACE.id] ? storeById[assignments[COURT_SPACE.id]] : null
    const free = freeSpaces.find((sp) => sp.floorId === 'P1' && sp.type === 'local') ?? freeSpaces[0]
    const food = ZONE_BY_ID.E

    const story: Step[] = [
      {
        key: 'pasillos',
        type: 'story',
        icon: StoreIcon,
        color: '#e0735f',
        kicker: 'Qué encontrarás · Piso 1',
        title: 'Cuatro pasillos de tiendas',
        body: <>Moda, tecnología, belleza y lifestyle alrededor de la plaza central. Toca cualquier tienda para ver sus productos y hacer tu pedido.</>,
        chips: [...lanes, ...names('A').slice(0, 1), ...names('B').slice(0, 1)].slice(0, 5),
        mark: 'Pasillos',
        go: () => {
          ui().setOverview(false)
          ui().setFloor('P1')
          ui().requestFocus({ kind: 'home' })
        },
      },
      {
        key: 'comidas',
        type: 'story',
        icon: Utensils,
        color: food.color,
        kicker: 'Qué encontrarás · Piso 2',
        title: food.name,
        body: <>Sube por las escaleras eléctricas: comida local, mariscos, café y postres con vista a la fortaleza.</>,
        chips: names('E').slice(0, 4),
        mark: 'Zona de comida',
        go: () => {
          ui().setFloor(FLOOR_OF_ZONE.E)
          ui().requestFocus({ kind: 'zone', id: 'E' })
        },
      },
      ...(svcOn && serviceIds.length
        ? ([
            {
              key: 'servicios',
              type: 'story',
              icon: Scissors,
              color: ZONE_BY_ID.F.color,
              kicker: 'Qué encontrarás · Nuevo',
              title: 'Zona de servicios',
              body: <>Una terraza sobre la joyería, con escalera y patio hundido, para barberías, belleza y otros servicios. Reserva y pregunta directo por WhatsApp.</>,
              chips: serviceStores.slice(0, 3).concat(['Barberías', 'Belleza']).slice(0, 4),
              mark: 'Servicios',
              go: () => {
                ui().setOverview(false)
                ui().setFloor('P1')
                ui().requestFocus({
                  kind: 'spaces',
                  ids: serviceIds,
                  zoom: 1.9,
                })
              },
            },
          ] as Step[])
        : []),
      ...(cineOn
        ? ([
            {
              key: 'cine',
              type: 'story',
              icon: Film,
              color: '#6b4fd1',
              kicker: 'Qué encontrarás · Nuevo',
              title: 'Cine',
              body: <>Toca la cartelera para ver las películas en cartel y entra por las puertas para elegir la cadena y sus horarios en Cartagena.</>,
              chips: ['Cartelera', 'Cine Colombia', 'Royal Films', 'Procinal'],
              mark: 'Cine',
              go: () => far({ kind: 'point', x: BX + DX, z: BZ + 3, y: DECK, zoom: 1.6 }),
            },
          ] as Step[])
        : []),
      ...(entOn
        ? ([
            {
              key: 'entretenimiento',
              type: 'story',
              icon: Gamepad2,
              color: ENT_COLOR,
              kicker: 'Qué encontrarás · Isla',
              title: 'Entretenimiento',
              body: (
                <>
                  Cruza el puente: una isla con pista de karts, locales de videojuegos y comida. En el óvalo verde hay una máquina de{' '}
                  <b className="font-semibold text-ink">Arcade</b>: juega, suma puntos y gana premios.
                </>
              ),
              chips: [...names('G').slice(0, 2), 'Pista de karts', 'Arcade'],
              mark: 'Entretenimiento',
              go: () => {
                ui().setOverview(false)
                ui().setFloor('P1')
                ui().requestFocus({ kind: 'zone', id: 'G' })
              },
            },
          ] as Step[])
        : []),
      {
        key: 'cancha',
        type: 'story',
        icon: Trophy,
        color: COURT_COLOR,
        kicker: 'Qué encontrarás · Piso 1',
        title: 'Zona de deportes',
        body: court ? (
          <>
            Una cancha de fútbol 5 y una de pádel, con iluminación nocturna, operadas por <b className="font-semibold text-ink">{court.name}</b>. Reserva la que esté libre desde el
            mall.
          </>
        ) : (
          <>Una cancha de fútbol 5 y una de pádel, con iluminación nocturna, listas para un negocio que las opere: {formatCOP(spacePrice(pricing, COURT_SPACE))}/mes.</>
        ),
        mark: 'Deportes',
        go: () => {
          ui().setOverview(false)
          ui().setFloor('P1')
          ui().requestFocus({ kind: 'spaces', ids: [COURT_SPACE.id], zoom: 2.1 })
        },
      },
      {
        key: 'estadio',
        type: 'story',
        icon: Landmark,
        color: '#2e6f4a',
        kicker: 'Qué encontrarás · Próximamente',
        title: 'Estadio',
        body: <>Estamos construyendo el estadio al norte de la fortaleza. Toca la obra para ver los eventos, comprar boletas y escuchar cómo avanza.</>,
        mark: 'Estadio',
        go: () =>
          far({
            kind: 'point',
            x: STADIUM.center[0],
            z: STADIUM.center[1],
            zoom: 1.6,
          }),
      },
      ...(airportOn
        ? ([
            {
              key: 'aeropuerto',
              type: 'story',
              icon: Plane,
              color: '#5b8cff',
              kicker: 'Qué encontrarás · Viaje',
              title: 'Aeropuerto',
              body: <>Toca el aeropuerto para volar a la Isla Tecnología, con sus propias tiendas. ¡Y volver cuando quieras!</>,
              mark: 'Aeropuerto',
              go: () =>
                far({
                  kind: 'point',
                  x: AIRPORT_FOCUS[0],
                  z: AIRPORT_FOCUS[1],
                  zoom: 1.5,
                }),
            },
          ] as Step[])
        : []),
      {
        key: 'muelle',
        type: 'story',
        icon: Anchor,
        color: '#16325c',
        kicker: 'Qué encontrarás · Muelle',
        title: 'Muelle turístico',
        body: <>Paseos en lancha, el barco pirata y el barco de los descuentos cuando atraca. Toca una lancha para reservar.</>,
        mark: 'Muelle',
        go: () =>
          far({
            kind: 'point',
            x: HARBOR_FOCUS[0],
            z: HARBOR_FOCUS[1],
            zoom: 1.4,
          }),
      },
    ]
    if (flash) {
      const sp = SPACE_BY_ID[spaceByStore[flash.storeId]]
      story.push({
        key: 'ofertas',
        type: 'story',
        icon: Zap,
        color: '#e39a2d',
        kicker: 'Ofertas',
        title: `Relámpago −${flash.discountPercent}%`,
        body: (
          <>
            {flash.title} en <b className="font-semibold text-ink">{storeById[flash.storeId]?.name}</b>. Duran pocas horas
            {secrets ? <> y hay {secrets === 1 ? 'una oferta escondida' : `${secrets} ofertas escondidas`} cerca de las tiendas: búscalas.</> : '.'}
          </>
        ),
        go: () => {
          ui().setOverview(false)
          ui().setFloor(sp.floorId)
          ui().requestFocus({ kind: 'showcase', id: sp.id })
        },
      })
    }
    if (free)
      story.push({
        key: 'tu-negocio',
        type: 'story',
        icon: StoreIcon,
        color: ZONE_BY_ID[free.zoneId].color,
        kicker: '¿Tienes un negocio?',
        title: 'Tu negocio aquí',
        body: (
          <>
            Hay {freeSpaces.length} espacios libres. Toca un letrero «TU NEGOCIO AQUÍ» y reclámalo desde {formatCOP(Math.min(...freeSpaces.map((sp) => spacePrice(pricing, sp))))}
            /mes.
          </>
        ),
        go: () => {
          ui().setOverview(false)
          ui().setFloor(free.floorId)
          ui().requestFocus({ kind: 'showcase', id: free.id })
        },
      })
    story.push({
      key: 'final',
      type: 'story',
      icon: Footprints,
      color: '#008d87',
      kicker: 'Todo el mall',
      title: '¡Ahora te toca a ti!',
      body: <>Toca cualquier tienda, abre «Categorías» o juega en el Arcade. Puedes repetir este recorrido cuando quieras desde las opciones del mapa.</>,
      go: () => ui().setOverview(true),
    })
    return [...coach, ...story]
  }, [assignments, promotions, storeById, spaceByStore, pricing, entOn, svcOn, airportOn, cineOn, desktop, use3D])
}
