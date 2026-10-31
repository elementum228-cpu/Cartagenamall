import { ChevronLeft, ChevronRight, Compass, Gem, MapPin, Shirt, Smartphone, Sparkles, Store as StoreIcon, Trophy, Utensils, Zap, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
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

export function GuidedTour() {
  const step = useUI((s) => s.tourStep)
  const steps = useTourSteps()
  const timer = useRef<number | null>(null)
  const current = step === null ? null : steps[Math.min(step, steps.length - 1)]
  const last = step !== null && step >= steps.length - 1

  const finish = () => {
    markDone()
    useUI.getState().setTourStep(null)
    useUI.getState().setOverview(true)
  }
  const goto = (n: number) => {
    if (n < 0) return
    if (n >= steps.length) return finish()
    useUI.getState().setTourStep(n)
  }

  // cada parada: mover la cámara, sonar y programar la siguiente
  useEffect(() => {
    if (step === null || !current) return
    current.go()
    if (last) void playSparkle()
    else if (step > 0) void playWhoosh()
    if (timer.current) clearTimeout(timer.current)
    if (!last) timer.current = window.setTimeout(() => goto(step + 1), STEP_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

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
    <AnimatePresence>
      {step !== null && current && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-[55] select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          role="dialog"
          aria-label="Recorrido guiado por el centro comercial"
        >
          {/* zonas táctiles: izquierda vuelve, derecha avanza (como las historias) */}
          <button type="button" className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize" aria-label="Parada anterior" onClick={() => goto(step - 1)} />
          <button type="button" className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize" aria-label="Siguiente parada" onClick={() => goto(step + 1)} />
          {/* sombra arriba y abajo para leer sobre el mapa */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink/45 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-ink/70 via-ink/25 to-transparent" />

          {/* barras de avance */}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex gap-1.5 md:inset-x-auto md:left-1/2 md:w-[560px] md:-translate-x-1/2">
            {steps.map((s, i) => (
              <span key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/35">
                <span
                  key={i === step ? `on-${step}` : 'off'}
                  className="block h-full rounded-full bg-white"
                  style={
                    i < step
                      ? { width: '100%' }
                      : i === step
                        ? { width: last ? '100%' : 0, animation: last ? undefined : `tour-fill ${STEP_MS}ms linear forwards` }
                        : { width: 0 }
                  }
                />
              </span>
            ))}
          </div>
          <div className="absolute top-7 right-3 flex items-center gap-2">
            <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
              {step + 1} / {steps.length}
            </span>
            <button type="button" onClick={finish} className="rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-extrabold text-ink shadow-soft">
              Saltar recorrido
            </button>
          </div>

          {/* tarjeta de la parada */}
          <div className="pointer-events-none absolute inset-x-3 bottom-[max(16px,env(safe-area-inset-bottom))] flex justify-center md:bottom-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.key}
                className="pointer-events-auto w-full max-w-[520px] overflow-hidden rounded-[28px] bg-card/95 shadow-float backdrop-blur"
                initial={{ y: 40, opacity: 0, scale: 0.94, rotate: -1.5 }}
                animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                exit={{ y: -24, opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              >
                <div className="h-1.5" style={{ background: current.color }} />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3.5">
                    <motion.span
                      className="grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-soft"
                      style={{ background: current.color }}
                      initial={{ scale: 0, rotate: -40 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 300, delay: 0.08 }}
                    >
                      <current.icon className="size-6" />
                    </motion.span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color: current.color }}>
                        {current.kicker}
                      </p>
                      <h2 className="text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">{current.title}</h2>
                    </div>
                  </div>
                  <div className="mt-2 text-[14px] leading-snug text-ink-soft">{current.body}</div>
                  {current.chips && current.chips.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {current.chips.map((c, i) => (
                        <motion.span
                          key={c}
                          className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-bold"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.18 + i * 0.07 }}
                        >
                          {c}
                        </motion.span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    {step > 0 && (
                      <button type="button" onClick={() => goto(step - 1)} className="grid size-11 place-items-center rounded-2xl border border-line bg-white" aria-label="Anterior">
                        <ChevronLeft className="size-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => goto(step + 1)}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-extrabold text-white shadow-soft transition active:scale-[0.98]"
                      style={{ background: last ? '#1f7a6e' : current.color }}
                    >
                      {last ? (
                        <>
                          <Compass className="size-4" /> ¡Empieza a explorar!
                        </>
                      ) : (
                        <>
                          Siguiente <ChevronRight className="size-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          {last && <Sparks />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Chispas doradas que saltan al final del recorrido. */
function Sparks() {
  const sparks = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ i, x: (Math.random() - 0.5) * 520, y: -120 - Math.random() * 320, d: Math.random() * 0.25, s: 6 + Math.random() * 8 })), [])
  return (
    <div className="pointer-events-none absolute bottom-40 left-1/2" aria-hidden>
      {sparks.map((p) => (
        <motion.span
          key={p.i}
          className="absolute rounded-full"
          style={{ width: p.s, height: p.s, background: p.i % 3 ? '#f5c35c' : '#fff3c4', boxShadow: '0 0 12px #f5c35c' }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 140], opacity: [1, 1, 0], scale: [0.4, 1, 0.6] }}
          transition={{ duration: 1.6, delay: p.d, ease: 'easeOut' }}
        />
      ))}
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
        body: names.length ? `${names.length === 1 ? 'Una tienda' : `${names.length} tiendas`} te esperan: ${z.categories.map((c) => c.name.toLowerCase()).join(', ')}.` : `Categorías: ${z.categories.map((c) => c.name.toLowerCase()).join(', ')}. ¡Aún hay espacio para nuevas tiendas!`,
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
        color: '#1f7a6e',
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
        key: 'cancha',
        icon: Trophy,
        color: COURT_COLOR,
        kicker: 'Amenidad · Piso 1',
        title: 'Cancha sintética',
        body: court ? (
          <>
            Fútbol 5 con iluminación nocturna, operada por <b className="text-ink">{court.name}</b>. Reserva tu hora desde el mall.
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
        color: '#e09a1f',
        kicker: 'Ofertas',
        title: `Relámpago −${flash.discountPercent}%`,
        body: (
          <>
            {flash.title} en <b className="text-ink">{storeById[flash.storeId]?.name}</b>. Duran pocas horas
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
      color: '#1f7a6e',
      kicker: 'Todo el mall',
      title: '¡Ahora te toca a ti!',
      body: <>Toca cualquier tienda para ver sus productos, cambia de piso a la izquierda y busca las ofertas escondidas.</>,
      go: () => ui().setOverview(true),
    })
    return steps
  }, [assignments, promotions, storeById, spaceByStore, pricing])
}
