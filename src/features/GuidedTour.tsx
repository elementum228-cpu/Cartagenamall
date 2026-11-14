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
  Pause,
  Play,
  Scissors,
  Store as StoreIcon,
  Trophy,
  Utensils,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { COURT_SPACE, FLOOR_OF_ZONE, MALL, SPACES } from '../config/mall'
import { STADIUM } from '../config/stadium'
import { ENT_COLOR } from '../entertainment/config'
import { playSparkle, playWhoosh } from '../lib/doorSound'
import { useIsDesktop } from '../lib/useMedia'
import { useUse3D } from '../lib/view3d'
import { useCine } from '../state/cine'
import { useCatalog } from '../state/catalog'
import { useEntertainmentFeature } from '../state/entertainmentFeature'
import { isServicesSpace, useServicesFeature } from '../state/servicesFeature'
import { usePrefs, useUI } from '../state/ui'
import { HARBOR_FOCUS } from '../tourism/config'
import { cameraState } from '../world/cameraState'
import { BX, BZ, DECK, DX } from '../world/cinemaLayout'
import { markDone } from './tourState'

// Recorrido de bienvenida: solo 6 pasos, pensado para que nadie lo salte.
//  1) Bienvenida · 2) Recorre y acerca (gesto con prueba en vivo) · 3) Tu menú (Categorías y Descubre, resaltados sobre la pantalla real)
//  4) Pisos y barra inferior · 5) Qué hay en el mall: UN solo paso donde la persona elige qué zona ver (la cámara vuela y la marca;
//  «Mostrarme todas» las recorre sola) · 6) Cierre.
// Las zonas son opcionales (un toque) en vez de ocho paradas obligatorias. Se muestra la primera vez (después del portón) y se
// puede repetir desde «Recorrido guiado» en las opciones del mapa.

export { startTour, tourDone } from './tourState'

type StepType = 'coach' | 'demo' | 'zones'
type DemoKind = 'dragpinch' | 'wheel'

interface Zone {
  id: string
  icon: LucideIcon
  color: string
  /** Texto corto del botón. */
  label: string
  /** Nombre completo, sobre el aro que marca la zona. */
  name: string
  desc: ReactNode
  isNew?: boolean
  go: () => void
}

interface Step {
  key: string
  type: StepType
  icon: LucideIcon
  color: string
  kicker: string
  title: string
  body?: ReactNode
  chips?: string[]
  /** Mueve la cámara a esta parada. */
  go?: () => void
  /** coach: valores de `data-tour` (separados por coma) de los elementos que se resaltan. */
  target?: string
  /** demo: gesto que se muestra y que la persona puede probar de verdad sobre el mapa. */
  demo?: DemoKind
  /** zones: las zonas que se pueden elegir. */
  zones?: Zone[]
}

/** Resorte de las apps nativas: arranca ágil y se asienta sin rebote. */
const SPRING = { type: 'spring', stiffness: 360, damping: 34, mass: 0.9 } as const
/** Distancia (px) o velocidad para que un deslizamiento lateral cambie de paso. */
const SWIPE_PX = 60
const SWIPE_V = 450
/** Cada cuánto cambia de zona «Mostrarme todas». */
const PLAY_MS = 4800
/** Dónde (fracción del alto) cae el punto enfocado en el paso de zonas: debe coincidir con TOUR_LIFT de la cámara (0,5 − lift). */
const MARK_TOP = '23%'

export function GuidedTour() {
  const step = useUI((s) => s.tourStep)
  const steps = useTourSteps()
  const use3D = useUse3D()
  const [dir, setDir] = useState(1)
  const [demoDone, setDemoDone] = useState(false)
  const [rects, setRects] = useState<DOMRect[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const current = step === null ? null : steps[Math.min(step, steps.length - 1)]
  const last = step !== null && step >= steps.length - 1
  const type: StepType = current?.type ?? 'coach'

  const finish = () => {
    markDone()
    // quien ya hizo el recorrido no necesita la tarjeta «Cómo explorar» ni el botón de entrada: el mapa queda limpio
    usePrefs.getState().setHintSeen()
    usePrefs.getState().setCtaSeen()
    useUI.getState().setTourStep(null)
    useUI.getState().setOverview(true)
  }
  const goto = (n: number) => {
    if (n < 0 || step === null) return
    if (n >= steps.length) return finish()
    setDir(n > step ? 1 : -1)
    useUI.getState().setTourStep(n)
  }

  // cada paso: mover la cámara y sonar
  useEffect(() => {
    if (step === null || !current) return
    setDemoDone(false)
    setRects([])
    setPicked(null)
    setPlaying(false)
    current.go?.()
    if (last) void playSparkle()
    else if (step > 0) void playWhoosh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // prueba en vivo: si la persona acerca el mapa de verdad (lo difícil de descubrir), se celebra y se pasa al siguiente
  const demoKind = current?.demo
  useEffect(() => {
    if (step === null || type !== 'demo' || !demoKind || demoDone) return
    const z0 = cameraState.zoom
    const id = window.setInterval(() => {
      if (Math.abs(Math.log(cameraState.zoom / z0)) > 0.08) {
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

  // elegir una zona: la cámara vuela y el aro la marca
  const zones = current?.zones
  const pick = (z: Zone) => {
    setPicked(z.id)
    z.go()
    void playWhoosh()
  }
  // «Mostrarme todas»: recorre las zonas solas, una cada pocos segundos
  const pickedIdx = zones ? zones.findIndex((z) => z.id === picked) : -1
  useEffect(() => {
    if (!playing || !zones?.length) return
    const next = () => {
      setPicked((cur) => {
        const i = zones.findIndex((z) => z.id === cur)
        const z = zones[(i + 1) % zones.length]
        z.go()
        return z.id
      })
    }
    if (pickedIdx < 0) next()
    const id = window.setInterval(next, PLAY_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, zones])

  // la interfaz del mall se aparta solo en el paso de zonas; al enseñar la interfaz hay que verla
  const hideUi = step !== null && type === 'zones'
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
  const cardOnTop = type === 'coach' && rects.some((r) => r.top > window.innerHeight * 0.55)
  const zone = zones?.find((z) => z.id === picked)

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
            {type === 'coach' && <Spotlight targets={current.target?.split(',') ?? []} onRects={setRects} />}
            {/* velo suave abajo para leer la tarjeta sobre el mapa */}
            {type !== 'coach' && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-deep/75 via-deep/30 to-transparent" />}
            {type === 'demo' && current.demo && <GestureDemo kind={current.demo} done={demoDone} />}
            {use3D && zone && <ZoneMark key={zone.id} label={zone.name} color={zone.color} icon={zone.icon} />}

            {/* arriba: contador y salir, en vidrio (solo en el paso de zonas; en los demás ahí está la barra de la plataforma) */}
            {type === 'zones' && (
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

            {/* tarjeta: se queda en su sitio y solo cambia su contenido; se desliza de lado para cambiar de paso */}
            <div
              className={`pointer-events-none absolute inset-x-3 flex justify-center md:inset-x-0 ${cardOnTop ? 'top-[calc(max(12px,env(safe-area-inset-top))+52px)] md:top-20' : 'bottom-[max(16px,env(safe-area-inset-bottom))] md:bottom-8'}`}
            >
              <motion.div
                className="glass-strong pointer-events-auto relative w-full max-w-[460px] touch-pan-y overflow-hidden rounded-[32px]"
                initial={{ y: cardOnTop ? -60 : 80, opacity: 0, scale: 0.94 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={SPRING}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.35}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_V) goto(step + 1)
                  else if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_V) goto(step - 1)
                }}
                layout
              >
                {type !== 'zones' && !last && (
                  <button
                    type="button"
                    onClick={finish}
                    className="absolute top-3 right-3 z-10 min-h-11 rounded-full px-3 text-[13px] font-semibold text-ink-soft transition active:scale-95"
                  >
                    Saltar
                  </button>
                )}
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div
                    key={current.key}
                    custom={dir}
                    variants={{
                      enter: (d: number) => ({ x: d * 70, opacity: 0, filter: 'blur(8px)' }),
                      center: { x: 0, opacity: 1, filter: 'blur(0px)' },
                      exit: (d: number) => ({ x: d * -70, opacity: 0, filter: 'blur(8px)' }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={SPRING}
                    className="px-5 pt-5 pb-1"
                  >
                    <div className={`flex items-center gap-3.5 ${type !== 'zones' && !last ? 'pr-12' : ''}`}>
                      <motion.span
                        className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-[18px] text-white"
                        style={{
                          background: `linear-gradient(145deg, ${current.color}, color-mix(in srgb, ${current.color} 70%, #062c42))`,
                          boxShadow: `0 10px 24px -10px ${current.color}`,
                        }}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.06 }}
                      >
                        {/* brillo de vidrio arriba del ícono */}
                        <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
                        <motion.span initial={{ y: 6 }} animate={{ y: [6, -3, 0] }} transition={{ duration: 0.55, delay: 0.12, ease: 'easeOut' }}>
                          <current.icon className="relative size-7" strokeWidth={1.8} />
                        </motion.span>
                      </motion.span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-ink-soft">{current.kicker}</p>
                        <h2 className="text-[24px] leading-[1.1] font-bold tracking-[-0.02em] text-ink">{current.title}</h2>
                      </div>
                    </div>
                    {current.body && <div className="mt-3 text-[15px] leading-snug text-ink-soft">{current.body}</div>}
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
                    {zones && (
                      <ZonePicker
                        zones={zones}
                        picked={picked}
                        playing={playing}
                        onPick={(z) => {
                          setPlaying(false)
                          pick(z)
                        }}
                        onTogglePlay={() => setPlaying((p) => !p)}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="px-5 pt-4 pb-5">
                  {/* indicador de pasos */}
                  <div className="mb-4 flex items-center justify-center gap-1.5" aria-hidden>
                    {steps.map((s, i) => (
                      <motion.span key={s.key} className="relative h-[6px] overflow-hidden rounded-full bg-ink/15" animate={{ width: i === step ? 26 : 6 }} transition={SPRING}>
                        {i === step && <span className="absolute inset-0 rounded-full bg-teal" />}
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

/** Las zonas del mall como botones: tocar una lleva la cámara hasta ella y muestra su descripción. */
function ZonePicker({
  zones,
  picked,
  playing,
  onPick,
  onTogglePlay,
}: {
  zones: Zone[]
  picked: string | null
  playing: boolean
  onPick: (z: Zone) => void
  onTogglePlay: () => void
}) {
  const zone = zones.find((z) => z.id === picked)
  return (
    <div className="mt-3">
      <ul className="grid grid-cols-4 gap-1.5" aria-label="Zonas del mall">
        {zones.map((z) => {
          const on = z.id === picked
          return (
            <li key={z.id}>
              <button
                type="button"
                onClick={() => onPick(z)}
                aria-pressed={on}
                className={`relative flex min-h-[62px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-[11px] leading-none font-bold transition active:scale-[0.96] ${on ? 'text-white' : 'bg-ink/[0.06] text-ink'}`}
                style={on ? { background: z.color } : undefined}
              >
                {z.isNew && !on && <span className="absolute top-1 right-1.5 size-2 rounded-full bg-amber ring-2 ring-white" aria-label="Nuevo" />}
                <z.icon className="size-[22px]" strokeWidth={1.8} />
                {z.label}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-2.5 min-h-[64px]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={zone?.id ?? 'vacio'}
            className="text-[14px] leading-snug text-ink-soft"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {zone ? (
              <>
                <b className="font-bold text-ink">{zone.name}.</b> {zone.desc}
              </>
            ) : (
              'Toca una zona y la cámara vuela hasta ella. Con «Mostrarme todas» las vemos seguidas.'
            )}
          </motion.p>
        </AnimatePresence>
      </div>
      <button type="button" onClick={onTogglePlay} className="mt-1 flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-teal">
        {playing ? (
          <>
            <Pause className="size-4" strokeWidth={2.2} /> Detener
          </>
        ) : (
          <>
            <Play className="size-4" strokeWidth={2.2} /> Mostrarme todas
          </>
        )}
      </button>
    </div>
  )
}

/**
 * Foco sobre uno o varios elementos reales de la interfaz (marcados con `data-tour`): todo se oscurece menos ellos, con un aro que late.
 * Si no están en pantalla (otra versión del diseño), solo queda el velo y la tarjeta explica.
 */
function Spotlight({ targets, onRects }: { targets: string[]; onRects: (r: DOMRect[]) => void }) {
  const [rs, setRs] = useState<DOMRect[]>([])
  const key = targets.join(',')
  useEffect(() => {
    if (!key) return
    let raf = 0
    let until = performance.now() + 900 // las barras se acomodan con una transición: se mide unos instantes
    const measure = () => {
      const found: DOMRect[] = []
      for (const t of key.split(',')) {
        const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${t}"]`)].find((e) => {
          const b = e.getBoundingClientRect()
          return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'
        })
        if (el) found.push(el.getBoundingClientRect())
      }
      setRs((old) =>
        old.length === found.length && old.every((o, i) => o.x === found[i].x && o.y === found[i].y && o.width === found[i].width && o.height === found[i].height) ? old : found,
      )
      onRects(found)
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
  }, [key, onRects])
  if (!rs.length) return <div className="absolute inset-0 bg-deep/60" />
  const pad = 8
  return (
    <div className="absolute inset-0" aria-hidden>
      {/* velo con huecos: una máscara oscurece todo menos los elementos resaltados */}
      <svg className="absolute inset-0 size-full">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {rs.map((r, i) => (
              <rect key={i} x={r.left - pad} y={r.top - pad} width={r.width + pad * 2} height={r.height + pad * 2} rx={24} fill="black" />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(3 14 24 / 0.62)" mask="url(#tour-hole)" />
        {rs.map((r, i) => (
          <rect
            key={i}
            x={r.left - pad}
            y={r.top - pad}
            width={r.width + pad * 2}
            height={r.height + pad * 2}
            rx={24}
            fill="none"
            stroke="rgb(255 255 255 / 0.9)"
            strokeWidth={2}
          />
        ))}
      </svg>
      {rs.map((r, i) => (
        <motion.div
          key={i}
          className="absolute rounded-[28px] border-2 border-teal-bright"
          style={{ left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.9, 0, 0.9] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

/** Animación del gesto sobre el mapa (en el celular alterna deslizar y pellizcar); el mapa sigue tocable debajo. */
function GestureDemo({ kind, done }: { kind: DemoKind; done: boolean }) {
  const [phase, setPhase] = useState<'drag' | 'pinch'>('drag')
  useEffect(() => {
    if (kind !== 'dragpinch') return
    const id = window.setInterval(() => setPhase((p) => (p === 'drag' ? 'pinch' : 'drag')), 2600)
    return () => window.clearInterval(id)
  }, [kind])
  const finger = 'absolute size-12 rounded-full border-2 border-white bg-white/35 shadow-[0_0_24px_rgb(255_255_255/0.55)]'
  return (
    <div className="pointer-events-none absolute top-[26%] left-1/2 h-40 w-56 -translate-x-1/2" aria-hidden>
      <div className="absolute inset-0 rounded-[28px] bg-deep/35" />
      {kind === 'dragpinch' && phase === 'drag' && (
        <motion.span
          key="drag"
          className={`${finger} top-[calc(50%-24px)]`}
          initial={{ left: 24 }}
          animate={{ left: [24, 152, 24], opacity: done ? 0 : [0.9, 1, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {kind === 'dragpinch' && phase === 'pinch' && (
        <>
          <motion.span
            key="p1"
            className={finger}
            initial={{ left: 86, top: 62 }}
            animate={{ left: [86, 40, 86], top: [62, 94, 62] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            key="p2"
            className={finger}
            initial={{ left: 118, top: 44 }}
            animate={{ left: [118, 164, 118], top: [44, 12, 44] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
      {kind === 'dragpinch' && (
        <span className="absolute inset-x-0 bottom-2.5 text-center text-[12px] font-bold text-white/90">{phase === 'drag' ? 'Desliza para moverte' : 'Pellizca para acercar'}</span>
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
      <ZoomIn className="absolute top-3 right-3 size-6 text-white/80" strokeWidth={1.8} />
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
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: MARK_TOP }} aria-hidden>
      <div className="relative grid size-[120px] place-items-center">
        {[0, 0.7].map((d) => (
          <motion.span
            key={d}
            className="absolute inset-0 rounded-full border-[3px]"
            style={{ borderColor: color }}
            initial={{ scale: 0.55, opacity: 0.9 }}
            animate={{ scale: [0.55, 1.25], opacity: [0.9, 0] }}
            transition={{ duration: 1.9, repeat: Infinity, delay: d, ease: 'easeOut' }}
          />
        ))}
        <span className="size-3 rounded-full" style={{ background: color, boxShadow: `0 0 0 4px #fff, 0 0 18px ${color}` }} />
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
    () => Array.from({ length: 22 }, (_, i) => ({ i, x: (Math.random() - 0.5) * 460, y: -140 - Math.random() * 300, d: Math.random() * 0.25, s: 4 + Math.random() * 6 })),
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
            style={{ width: p.s, height: p.s, background: c, boxShadow: `0 0 10px ${c}` }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
            animate={{ x: p.x, y: [0, p.y, p.y + 110], opacity: [0, 1, 0], scale: [0.3, 1, 0.5] }}
            transition={{ duration: 1.8, delay: p.d, ease: [0.2, 0.8, 0.2, 1] }}
          />
        )
      })}
    </div>
  )
}

/** Los pasos del recorrido; las zonas que aparecen en el paso 5 son solo las que están activadas. */
function useTourSteps(): Step[] {
  const assignments = useCatalog((s) => s.assignments)
  const entOn = useEntertainmentFeature((s) => s.enabled)
  const svcOn = useServicesFeature((s) => s.enabled)
  const cineOn = useCine((s) => s.enabled)
  const desktop = useIsDesktop()
  const use3D = useUse3D()

  return useMemo(() => {
    const ui = () => useUI.getState()
    /** Para los puntos lejanos (cine, estadio, muelle) se abre la vista general: ahí la cámara puede llegar. */
    const far = (focus: Parameters<ReturnType<typeof ui>['requestFocus']>[0]) => {
      ui().setOverview(true)
      ui().requestFocus(focus)
    }
    const tourSpaces = SPACES.filter((sp) => (entOn || sp.zoneId !== 'G') && (svcOn || !isServicesSpace(sp)))
    const totalStores = tourSpaces.filter((sp) => assignments[sp.id]).length
    const serviceIds = SPACES.filter(isServicesSpace).map((sp) => sp.id)

    const zones: Zone[] = [
      {
        id: 'tiendas',
        icon: StoreIcon,
        color: '#e0735f',
        label: 'Tiendas',
        name: 'Pasillos de tiendas',
        desc: <>Moda, tecnología, belleza y lifestyle alrededor de la plaza. Toca una tienda para ver sus productos.</>,
        go: () => {
          ui().setOverview(false)
          ui().setFloor('P1')
          ui().requestFocus({ kind: 'home' })
        },
      },
      {
        id: 'comida',
        icon: Utensils,
        color: '#d98a2a',
        label: 'Comida',
        name: 'Zona de comida · Piso 2',
        desc: <>Comida local, mariscos, café y postres. Sube por las escaleras eléctricas.</>,
        go: () => {
          ui().setFloor(FLOOR_OF_ZONE.E)
          ui().requestFocus({ kind: 'zone', id: 'E' })
        },
      },
      ...(svcOn && serviceIds.length
        ? [
            {
              id: 'servicios',
              icon: Scissors,
              color: '#7b6cf0',
              label: 'Servicios',
              name: 'Zona de servicios',
              isNew: true,
              desc: <>Una terraza sobre la joyería con barberías, belleza y otros servicios. Pregunta y reserva por WhatsApp.</>,
              go: () => {
                ui().setOverview(false)
                ui().setFloor('P1')
                ui().requestFocus({ kind: 'spaces', ids: serviceIds, zoom: 1.9 })
              },
            } as Zone,
          ]
        : []),
      ...(cineOn
        ? [
            {
              id: 'cine',
              icon: Film,
              color: '#6b4fd1',
              label: 'Cine',
              name: 'Cine',
              isNew: true,
              desc: <>Toca la cartelera para ver las películas; entra por las puertas para elegir la cadena y sus horarios.</>,
              go: () => far({ kind: 'point', x: BX + DX, z: BZ + 3, y: DECK, zoom: 1.6 }),
            } as Zone,
          ]
        : []),
      ...(entOn
        ? [
            {
              id: 'diversion',
              icon: Gamepad2,
              color: ENT_COLOR,
              label: 'Diversión',
              name: 'Entretenimiento',
              desc: <>Una isla con pista de karts, videojuegos y comida. En el óvalo verde está el Arcade: juega y gana premios.</>,
              go: () => {
                ui().setOverview(false)
                ui().setFloor('P1')
                ui().requestFocus({ kind: 'zone', id: 'G' })
              },
            } as Zone,
          ]
        : []),
      {
        id: 'deportes',
        icon: Trophy,
        color: '#2f9e5a',
        label: 'Deportes',
        name: 'Zona de deportes',
        desc: <>Fútbol 5 y pádel con luz nocturna. Reserva la cancha libre desde el mall.</>,
        go: () => {
          ui().setOverview(false)
          ui().setFloor('P1')
          ui().requestFocus({ kind: 'spaces', ids: [COURT_SPACE.id], zoom: 2.1 })
        },
      },
      {
        id: 'estadio',
        icon: Landmark,
        color: '#2e6f4a',
        label: 'Estadio',
        name: 'Estadio',
        desc: <>En construcción al norte de la fortaleza. Toca la obra para ver eventos, boletas y cómo avanza.</>,
        go: () => far({ kind: 'point', x: STADIUM.center[0], z: STADIUM.center[1], zoom: 1.6 }),
      },
      {
        id: 'muelle',
        icon: Anchor,
        color: '#16325c',
        label: 'Muelle',
        name: 'Muelle turístico',
        desc: <>Paseos en lancha, el barco pirata y el barco de los descuentos. Toca una lancha para reservar.</>,
        go: () => far({ kind: 'point', x: HARBOR_FOCUS[0], z: HARBOR_FOCUS[1], zoom: 1.4 }),
      },
    ]

    const steps: Step[] = [
      {
        key: 'bienvenida',
        type: 'coach',
        icon: MapPin,
        color: '#008d87',
        kicker: 'Bienvenido a',
        title: MALL.name,
        body: <>Un centro comercial para recorrer, descubrir y jugar. En menos de un minuto te mostramos cómo moverte y qué hay en cada zona.</>,
        chips: [`${totalStores} tiendas`, '2 pisos', ...(entOn ? ['Entretenimiento'] : []), 'Ofertas escondidas'],
        go: () => ui().setOverview(true),
      },
      ...(use3D
        ? ([
            {
              key: 'gestos',
              type: 'demo',
              demo: desktop ? 'wheel' : 'dragpinch',
              icon: ZoomIn,
              color: '#d99a1f',
              kicker: 'Cómo moverte',
              title: 'Recorre y acerca',
              body: desktop ? (
                <>Arrastra con el mouse para moverte y usa la rueda para acercarte a una tienda o alejarte.</>
              ) : (
                <>Desliza un dedo para moverte. Pellizca con dos: sepáralos para ver una tienda de cerca y júntalos para alejar.</>
              ),
            },
          ] as Step[])
        : []),
      {
        key: 'menu',
        type: 'coach',
        target: desktop ? 'categorias' : 'menu',
        icon: LayoutGrid,
        color: '#c2607f',
        kicker: 'Cómo moverte',
        title: desktop ? 'Categorías' : 'Tu menú',
        body: desktop ? (
          <>Toca una categoría para ir directo a ella: Moda, Tecnología, Gastronomía, Cine…</>
        ) : (
          <>
            <b className="font-semibold text-ink">Categorías</b> te lleva a cada zona y a sus locales. <b className="font-semibold text-ink">Descubre</b> reúne tu pasaporte, las
            ofertas escondidas, el periódico y el Arcade.
          </>
        ),
      },
      {
        key: 'pisos',
        type: 'coach',
        target: 'pisos,nav',
        icon: Layers,
        color: '#008d87',
        kicker: 'Cómo moverte',
        title: desktop ? 'Pisos y modos' : 'Pisos y barra',
        body: desktop ? (
          <>A la izquierda cambias de piso (y «Todo» muestra el mall completo). Arriba alternas entre explorar y comprar.</>
        ) : (
          <>Izquierda: pisos y «Todo» (el mall completo). Abajo: explorar, comprar, ofertas y carrito.</>
        ),
      },
      {
        key: 'zonas',
        type: 'zones',
        icon: Compass,
        color: '#e0735f',
        kicker: 'Qué hay en el mall',
        title: 'Elige una zona',
        zones,
        go: () => ui().setOverview(true),
      },
      {
        key: 'final',
        type: 'coach',
        icon: Footprints,
        color: '#008d87',
        kicker: 'Todo listo',
        title: '¡Ahora te toca a ti!',
        body: <>Toca cualquier tienda, abre «Categorías» o juega en el Arcade. Puedes repetir este recorrido cuando quieras desde las opciones del mapa.</>,
        go: () => ui().setOverview(true),
      },
    ]
    return steps
  }, [assignments, entOn, svcOn, cineOn, desktop, use3D])
}
