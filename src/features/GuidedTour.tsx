import { ChevronLeft, ChevronRight, Compass, Gem, MapPin, Scissors, Shirt, Smartphone, Sparkles, Store as StoreIcon, Trophy, Utensils, Zap, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { COURT_SPACE, FLOOR_OF_ZONE, MALL, SPACES, SPACE_BY_ID, ZONE_BY_ID } from '../config/mall'
import type { ZoneId } from '../domain/types'
import { COURT_COLOR } from '../football/open'
import { playSparkle, playWhoosh } from '../lib/doorSound'
import { formatCOP } from '../lib/format'
import { isPromotionLive } from '../lib/pricing'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { spacePrice, useSpacePricing } from '../state/spacePricing'
import { useUI } from '../state/ui'

// Recorrido guiado, al estilo de las historias: la primera vez que alguien entra (después del
// portón) la cámara vuela por lo que tiene el mall — plaza, pasillos con sus tiendas, cancha, zona de
// comidas, ofertas y espacios libres — con una tarjeta por parada, barras de avance arriba y toques
// para avanzar o volver. Termina en la vista «Fortaleza» con todo el mall. Se puede repetir desde
// «Recorrido guiado» en las opciones del mapa.

const DONE_KEY = 'cm:tour-done'
const STEP_MS = 5200

export function tourDone() {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}
function markDone() {
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    /* sin almacenamiento: se ofrece de nuevo la próxima vez */
  }
}

export function startTour() {
  useUI.getState().setTourStep(0)
}

interface Step {
  key: string
  icon: LucideIcon
  color: string
  kicker: string
  title: string
  body: ReactNode
  chips?: string[]
  /** Mueve la cámara a esta parada. */
  go: () => void
}

const ZONE_ICON: Partial<Record<ZoneId, LucideIcon>> = { A: Shirt, B: Smartphone, C: Sparkles, D: Gem }

/** Resorte de las apps nativas: arranca ágil y se asienta sin rebote. */
const SPRING = { type: 'spring', stiffness: 360, damping: 34, mass: 0.9 } as const
/** Distancia (px) o velocidad para que un deslizamiento lateral cambie de parada. */
const SWIPE_PX = 60
const SWIPE_V = 450

export function GuidedTour() {
  const step = useUI((s) => s.tourStep)
  const steps = useTourSteps()
  const timer = useRef<number | null>(null)
  const startedAt = useRef(0)
  const remaining = useRef(STEP_MS)
  const [paused, setPaused] = useState(false)
  const pressedAt = useRef(0)
  const [dir, setDir] = useState(1)
  const current = step === null ? null : steps[Math.min(step, steps.length - 1)]
  const last = step !== null && step >= steps.length - 1

  const finish = () => {
    markDone()
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
    current.go()
    if (last) void playSparkle()
    else if (step > 0) void playWhoosh()
    remaining.current = STEP_MS
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // avance automático; mantener presionado lo pausa (como las historias) y al soltar sigue donde iba
  useEffect(() => {
    if (step === null || last) return
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
  }, [step, paused, last])

  // la interfaz del mall se aparta mientras dura el recorrido
  const on = step !== null
  useEffect(() => {
    document.documentElement.classList.toggle('tour-on', on)
    return () => document.documentElement.classList.remove('tour-on')
  }, [on])

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

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {step !== null && current && (
          <motion.div
            key="tour"
            className="fixed inset-0 z-[55] select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            role="dialog"
            aria-label="Recorrido guiado por el centro comercial"
          >
            {/* toques sobre el mapa: izquierda vuelve, derecha avanza; mantener presionado pausa */}
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
            {/* velo suave abajo para leer la tarjeta sobre el mapa */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-deep/70 via-deep/25 to-transparent" />

            {/* arriba: contador y salir, en vidrio */}
            <motion.div
              className="absolute inset-x-3 top-[max(12px,env(safe-area-inset-top))] flex items-center justify-between md:inset-x-6"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...SPRING, delay: 0.1 }}
            >
              <span className="glass rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink tabular-nums">
                {step + 1} de {steps.length}
              </span>
              <button type="button" onClick={finish} className="glass rounded-full px-4 py-1.5 text-[13px] font-semibold text-ink transition active:scale-[0.96]">
                Saltar
              </button>
            </motion.div>

            {/* tarjeta: se queda en su sitio y solo cambia su contenido; se desliza de lado para
                cambiar de parada */}
            <div className="pointer-events-none absolute inset-x-3 bottom-[max(16px,env(safe-area-inset-bottom))] flex justify-center md:bottom-8">
              <motion.div
                className="glass-strong pointer-events-auto w-full max-w-[460px] touch-pan-y overflow-hidden rounded-[32px]"
                initial={{ y: 80, opacity: 0, scale: 0.94 }}
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
                    <div className="flex items-center gap-3.5">
                      <motion.span
                        className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-[18px] text-white"
                        style={{ background: `linear-gradient(145deg, ${current.color}, color-mix(in srgb, ${current.color} 70%, #062c42))`, boxShadow: `0 10px 24px -10px ${current.color}` }}
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
                    <div className="mt-3 text-[15px] leading-snug text-ink-soft">{current.body}</div>
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
                  {/* indicador de páginas: la actual es una cápsula que se llena con el tiempo */}
                  <div className="mb-4 flex items-center justify-center gap-1.5" aria-hidden>
                    {steps.map((s, i) => (
                      <motion.span
                        key={s.key}
                        className="relative h-[7px] overflow-hidden rounded-full bg-ink/15"
                        animate={{ width: i === step ? 28 : 7 }}
                        transition={SPRING}
                      >
                        {i === step && (
                          <span
                            key={`fill-${step}`}
                            className="absolute inset-y-0 left-0 rounded-full bg-teal"
                            style={last ? { width: '100%' } : { animation: `tour-fill ${STEP_MS}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
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
                  <p className="mt-3 text-center text-[11.5px] text-ink-soft max-md:block md:hidden">Desliza la tarjeta o toca el mapa para avanzar</p>
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

/** Destellos turquesa y ámbar que se abren suavemente al final del recorrido. */
function Sparks() {
  const sparks = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ i, x: (Math.random() - 0.5) * 460, y: -140 - Math.random() * 300, d: Math.random() * 0.25, s: 4 + Math.random() * 6 })), [])
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

/** Paradas del recorrido, con datos reales del mall (tiendas, precios, ofertas, espacios libres). */
function useTourSteps(): Step[] {
  const assignments = useCatalog((s) => s.assignments)
  const promotions = useCatalog((s) => s.promotions)
  const { storeById, spaceByStore } = useCatalogMaps()
  const pricing = useSpacePricing()

  return useMemo(() => {
    const ui = () => useUI.getState()
    const storesIn = (zone: ZoneId) => SPACES.filter((sp) => sp.zoneId === zone && assignments[sp.id]).map((sp) => storeById[assignments[sp.id]]?.name).filter(Boolean) as string[]
    const freeSpaces = SPACES.filter((sp) => !assignments[sp.id])
    const totalStores = SPACES.filter((sp) => assignments[sp.id]).length
    const zoneStep = (id: ZoneId): Step => {
      const z = ZONE_BY_ID[id]
      const names = storesIn(id)
      return {
        key: `zona-${id}`,
        icon: ZONE_ICON[id] ?? StoreIcon,
        color: z.color,
        kicker: `Pasillo ${id}`,
        title: z.name,
        body: names.length ? `${names.length === 1 ? 'Una tienda te espera' : `${names.length} tiendas te esperan`}: ${z.categories.map((c) => c.name.toLowerCase()).join(', ')}.` : `Categorías: ${z.categories.map((c) => c.name.toLowerCase()).join(', ')}. ¡Aún hay espacio para nuevas tiendas!`,
        chips: names.slice(0, 4),
        go: () => {
          ui().setFloor(FLOOR_OF_ZONE[id])
          ui().requestFocus({ kind: 'zone', id })
        },
      }
    }

    const flash = promotions.find((p) => p.type === 'flash' && isPromotionLive(p, Date.now()) && spaceByStore[p.storeId] && SPACE_BY_ID[spaceByStore[p.storeId]])
    const secrets = promotions.filter((p) => p.type === 'secret' && isPromotionLive(p, Date.now())).length
    const court = assignments[COURT_SPACE.id] ? storeById[assignments[COURT_SPACE.id]] : null
    const free = freeSpaces.find((sp) => sp.floorId === 'P1' && sp.type === 'local') ?? freeSpaces[0]
    const food = ZONE_BY_ID.E

    const steps: Step[] = [
      {
        key: 'bienvenida',
        icon: MapPin,
        color: '#008d87',
        kicker: 'Bienvenido a',
        title: MALL.name,
        body: <>Un centro comercial dentro de una fortaleza amurallada, como el Centro Histórico. Te mostramos lo que hay en menos de un minuto.</>,
        chips: [`${totalStores} tiendas`, '2 pisos', 'Cancha sintética', 'Ofertas escondidas'],
        go: () => ui().enterMall(),
      },
      zoneStep('A'),
      zoneStep('B'),
      zoneStep('C'),
      zoneStep('D'),
      {
        key: 'servicios',
        icon: Scissors,
        color: ZONE_BY_ID.F.color,
        kicker: 'Zona F',
        title: 'Soporte',
        body: <>Barberías y servicios alrededor de una plaza, con las vitrinas de Planly (turismo) y GrowDesk (software). Desde aquí sale la puerta al muelle.</>,
        chips: ['Planly', 'GrowDesk', 'Barberías', 'Muelle turístico'],
        go: () => {
          ui().setFloor('P1')
          ui().requestFocus({ kind: 'zone', id: 'F' })
        },
      },
      {
        key: 'cancha',
        icon: Trophy,
        color: COURT_COLOR,
        kicker: 'Amenidad · Piso 1',
        title: 'Cancha sintética',
        body: court ? (
          <>
            Fútbol 5 con iluminación nocturna, operada por <b className="font-semibold text-ink">{court.name}</b>. Reserva tu hora desde el mall.
          </>
        ) : (
          <>Fútbol 5 con iluminación nocturna, lista para un negocio que la opere: {formatCOP(spacePrice(pricing, COURT_SPACE))}/mes.</>
        ),
        go: () => {
          ui().setFloor('P1')
          ui().requestFocus({ kind: 'court' })
        },
      },
      {
        key: 'comidas',
        icon: Utensils,
        color: food.color,
        kicker: 'Piso 2',
        title: food.name,
        body: <>Sube por las escaleras eléctricas: comida local, mariscos, café y postres con vista a la fortaleza.</>,
        chips: storesIn('E').slice(0, 4),
        go: () => {
          ui().setFloor(FLOOR_OF_ZONE.E)
          ui().requestFocus({ kind: 'zone', id: 'E' })
        },
      },
    ]
    if (flash) {
      const sp = SPACE_BY_ID[spaceByStore[flash.storeId]]
      steps.push({
        key: 'ofertas',
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
          ui().setFloor(sp.floorId)
          ui().requestFocus({ kind: 'showcase', id: sp.id })
        },
      })
    }
    if (free)
      steps.push({
        key: 'tu-negocio',
        icon: StoreIcon,
        color: ZONE_BY_ID[free.zoneId].color,
        kicker: '¿Tienes un negocio?',
        title: 'Tu negocio aquí',
        body: (
          <>
            Hay {freeSpaces.length} espacios libres. Toca un letrero «TU NEGOCIO AQUÍ» y reclámalo desde {formatCOP(Math.min(...freeSpaces.map((sp) => spacePrice(pricing, sp))))}/mes.
          </>
        ),
        go: () => {
          ui().setFloor(free.floorId)
          ui().requestFocus({ kind: 'showcase', id: free.id })
        },
      })
    steps.push({
      key: 'final',
      icon: Compass,
      color: '#008d87',
      kicker: 'Todo el mall',
      title: '¡Ahora te toca a ti!',
      body: <>Toca cualquier tienda para ver sus productos, cambia de piso a la izquierda y busca las ofertas escondidas.</>,
      go: () => ui().setOverview(true),
    })
    return steps
  }, [assignments, promotions, storeById, spaceByStore, pricing])
}
