import { openCourtOrClaim } from '../football/open'
import { AnimatePresence, motion } from 'motion/react'
import { Castle, ChevronDown, ChevronUp, DoorOpen, Gem, Hand, House, Keyboard, Mouse, Settings2, Trophy, Utensils, Layers, Map as MapIcon, Box, Moon, Sun, SunMoon, Zap, ZoomIn, ZoomOut } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FLOORS, FLOOR_OF_ZONE, ZONES } from '../config/mall'
import { isPromotionLive } from '../lib/pricing'
import { useNow } from '../lib/useNow'
import { hasWebGL } from '../lib/webgl'
import { useIsNight } from '../lib/useIsNight'
import { useIsDesktop } from '../lib/useMedia'
import { useCatalog } from '../state/catalog'
import { usePersonal } from '../state/personal'
import { usePrefs, useUI } from '../state/ui'
import { Countdown } from '../ui/bits'
import { Map2D } from './Map2D'
import { usePromoEvents } from '../promotions/store'
import { DemoPromoButton } from './DemoPromoButton'

const WorldCanvas = lazy(() => import('../world/WorldCanvas'))

/** Modo Explorar: mundo 3D (o plano 2D) con controles superpuestos. Se mantiene montado. */
export function ExploreView({ active }: { active: boolean }) {
  const force2D = usePrefs((s) => s.force2D)
  const webgl = useMemo(hasWebGL, [])
  const use3D = webgl && !force2D
  const selectedSpaceId = useUI((s) => s.selectedSpaceId)
  const night = useIsNight() && use3D
  const root = useRef<HTMLDivElement>(null)

  // En el mapa, un pellizco nunca debe agrandar la página entera (eso "rompe" la vista en móvil):
  // los gestos de dos dedos son solo para el zoom del mundo 3D.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    const onGesture = (e: Event) => e.preventDefault() // Safari iOS
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('gesturestart', onGesture)
    el.addEventListener('gesturechange', onGesture)
    return () => {
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('gesturestart', onGesture)
      el.removeEventListener('gesturechange', onGesture)
    }
  }, [])

  return (
    <div ref={root} className="world-sky absolute inset-0 touch-manipulation overflow-hidden select-none" aria-hidden={!active}>
      {/* cielo nocturno: capa CSS que aparece encima del degradado de día */}
      <div className={`world-night pointer-events-none absolute inset-0 transition-opacity duration-[1200ms] ${night ? 'opacity-100' : 'opacity-0'}`} />
      {use3D ? (
        <Suspense fallback={<Loading />}>
          <WorldCanvas active={active} night={night} fallback={<Map2D reason="Tu dispositivo no pudo cargar el 3D. Mostramos el plano 2D." />} />
        </Suspense>
      ) : (
        <Map2D reason={!webgl ? 'Tu navegador no soporta 3D (WebGL). Mostramos el plano 2D con las mismas tiendas.' : undefined} />
      )}
      {active && <Hud use3D={use3D} webgl={webgl} dimmed={!!selectedSpaceId} />}
    </div>
  )
}

function Loading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-3 text-ink-soft">
        <div className="size-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
        <p className="text-sm font-medium">Construyendo el centro comercial…</p>
      </div>
    </div>
  )
}

function Hud({ use3D, webgl, dimmed }: { use3D: boolean; webgl: boolean; dimmed: boolean }) {
  const desktop = useIsDesktop()
  const overview = useUI((s) => s.overview)
  const setFloor = useUI((s) => s.setFloor)
  const requestFocus = useUI((s) => s.requestFocus)
  const selectSpace = useUI((s) => s.selectSpace)
  const hintSeen = usePrefs((s) => s.hintSeen)
  const setHintSeen = usePrefs((s) => s.setHintSeen)
  const promotions = useCatalog((s) => s.promotions)
  const discovered = usePersonal((s) => s.discovered)
  const now = useNow()
  const secretTotal = promotions.filter((p) => p.type === 'secret' && isPromotionLive(p, now)).length
  // Indicador textual de la oferta relámpago: la que se está presentando o, si no, la más reciente.
  const events = usePromoEvents((s) => s.events)
  const flashEvent = useMemo(() => {
    const live = events.filter((e) => e.type === 'flash' && e.status === 'active')
    return live.find((e) => e.spotlight === 'playing') ?? [...live].sort((a, b) => b.startTime - a.startTime)[0]
  }, [events])
  const flash = flashEvent && promotions.find((p) => p.id === flashEvent.promotionId)
  const flashStore = useCatalog((s) => s.stores.find((st) => st.id === flashEvent?.storeId))

  const goHome = () => {
    selectSpace(null)
    requestFocus({ kind: 'home' })
  }

  return (
    <>
      {/* zonas */}
      <div className={`scrollbar-none absolute top-3 right-0 left-0 z-10 flex gap-2 overflow-x-auto px-3 transition-opacity md:right-auto ${dimmed ? 'max-md:pointer-events-none max-md:opacity-0' : ''}`}>
        {ZONES.map((z) => {
          const food = z.id === 'E'
          return (
            <button
              key={z.id}
              onClick={() => {
                // Elegir una zona de otro piso (p. ej. Gastronomía) cambia a ese piso.
                setFloor(FLOOR_OF_ZONE[z.id])
                selectSpace(null)
                if (use3D) requestFocus({ kind: 'zone', id: z.id })
              }}
              className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-[13px] font-bold shadow-soft backdrop-blur transition active:scale-95 ${
                food ? 'text-white' : 'bg-white/90'
              }`}
              style={food ? { background: z.color } : undefined}
            >
              <span className={`grid size-6 place-items-center rounded-full text-[11px] ${food ? 'bg-white/25' : 'text-white'}`} style={food ? undefined : { background: z.color }}>
                {food ? <Utensils className="size-3.5" /> : z.id}
              </span>
              {z.name}
              {food && <span className="rounded-full bg-white/25 px-1.5 text-[10px]">Piso 2</span>}
            </button>
          )
        })}
        <button
          onClick={() => {
            openCourtOrClaim(use3D)
          }}
          className="flex shrink-0 items-center gap-2 rounded-full bg-[#1f7a3d] py-1.5 pr-3.5 pl-1.5 text-[13px] font-bold text-white shadow-soft backdrop-blur transition active:scale-95"
        >
          <span className="grid size-6 place-items-center rounded-full bg-white/25">
            <Trophy className="size-3.5" />
          </span>
          Cancha
        </button>
      </div>

      <FloorSelector use3D={use3D} dimmed={dimmed} />

      {/* descubrimientos y oferta relámpago */}
      <div className={`pointer-events-none absolute top-14 right-3 left-3 z-10 flex flex-wrap items-start gap-2 transition-opacity md:right-auto *:pointer-events-auto ${dimmed ? 'max-md:opacity-0 max-md:*:pointer-events-none' : ''}`}>
        <Link to="/ofertas" className="flex items-center gap-2 rounded-full bg-ink/90 py-1.5 pr-3 pl-1.5 text-xs font-bold text-white shadow-soft backdrop-blur">
          <span className="grid size-6 place-items-center rounded-full bg-sun text-ink">
            <Gem className="size-3.5" />
          </span>
          Secretas {Math.min(discovered.length, secretTotal)}/{secretTotal}
        </Link>
        {flash && flashEvent && (
          <button
            onClick={() => {
              // Lo elige la persona: se acerca la cámara y se abre la ficha con la oferta.
              setFloor(flashEvent.floorId)
              selectSpace(flashEvent.spaceId)
              if (use3D) requestFocus({ kind: 'space', id: flashEvent.spaceId })
            }}
            className={`flex items-center gap-2 rounded-full bg-sun py-1.5 pr-3 pl-2 text-xs font-bold text-ink shadow-soft ${flashEvent.spotlight === 'playing' ? 'ring-2 ring-white' : ''}`}
            aria-label={`Oferta relámpago −${flash.discountPercent}% en ${flashStore?.name ?? 'una tienda'}. Ver la tienda`}
          >
            <Zap className="size-3.5" /> Relámpago −{flash.discountPercent}%{flashStore && <span className="max-w-28 truncate font-extrabold">· {flashStore.name}</span>} <Countdown endsAt={flash.endsAt} />
          </button>
        )}
        <PromoAnnouncer />
      </div>

      {/* La fila ocupa todo el ancho pero no captura toques: solo sus botones (el resto del mapa se puede arrastrar). */}
      <div className={`pointer-events-none absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 flex items-end justify-between gap-3 transition-opacity md:bottom-5 *:pointer-events-auto ${dimmed ? 'max-md:opacity-0 max-md:*:pointer-events-none' : ''}`}>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <AnimatePresence>
            {use3D && !hintSeen && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="max-w-[260px] rounded-2xl bg-white/95 p-3 text-[12.5px] shadow-float backdrop-blur"
              >
                <p className="flex items-center gap-2 font-bold">
                  <Hand className="size-4 text-brand" /> Cómo explorar
                </p>
                <p className="mt-1 text-ink-soft">
                  {desktop
                    ? 'Arrastra con el mouse (o mantén Espacio y arrastra) para recorrer. Rueda para acercarte. Toca una tienda o un espacio libre.'
                    : 'Desliza un dedo para recorrer y pellizca con dos para acercarte. Toca una tienda o un espacio libre.'}{' '}
                  Cerca de las tiendas hay ofertas escondidas.
                </p>
                <button className="mt-1.5 text-xs font-bold text-brand" onClick={setHintSeen}>
                  Entendido
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {overview && use3D ? (
            // Estado inicial (vista de la fortaleza): la acción principal es entrar.
            <button
              className="flex h-12 items-center gap-2 rounded-2xl bg-brand px-4 text-sm font-extrabold whitespace-nowrap text-white shadow-float transition active:scale-95 md:h-13 md:px-5 md:text-[15px]"
              onClick={() => useUI.getState().enterMall()}
            >
              <DoorOpen className="size-5" /> Entrar al centro comercial
            </button>
          ) : (
            <button
              className="flex h-11 items-center gap-2 rounded-2xl bg-brand px-3.5 text-[13px] font-bold whitespace-nowrap text-white shadow-float transition active:scale-95 md:h-12 md:px-4 md:text-sm"
              onClick={goHome}
              aria-label="Volver al centro comercial"
            >
              <House className="size-4" /> <span className="md:hidden">Volver al centro</span>
              <span className="max-md:hidden">Volver al centro comercial</span>
            </button>
          )}
        </div>

        {/* controles de cámara */}
        <div className="flex flex-col items-end gap-2">
          {use3D && (
            <div className="flex flex-col overflow-hidden rounded-2xl bg-white/95 shadow-soft backdrop-blur">
              <button className="grid size-11 place-items-center border-b border-line" onClick={() => requestFocus({ kind: 'zoom', factor: 1.5 })} aria-label="Acercar">
                <ZoomIn className="size-5" />
              </button>
              <button className="grid size-11 place-items-center" onClick={() => requestFocus({ kind: 'zoom', factor: 1 / 1.5 })} aria-label="Alejar">
                <ZoomOut className="size-5" />
              </button>
            </div>
          )}
          <ViewOptions use3D={use3D} webgl={webgl} desktop={desktop} />
        </div>
      </div>
      {use3D && desktop && !dimmed && !overview && <ControlsLegend />}
    </>
  )
}

const QUALITY_LABEL = { high: 'alta', medium: 'media', low: 'baja' } as const
const NEXT_QUALITY = { high: 'medium', medium: 'low', low: 'high' } as const

const TIME_LABEL = { auto: 'Hora real', day: 'Día', night: 'Noche' } as const
const NEXT_MODE = { auto: 'day', day: 'night', night: 'auto' } as const

/** Alterna Hora real (según el reloj del dispositivo) → Día → Noche. */
function TimeToggle() {
  const mode = usePrefs((s) => s.timeMode)
  const setMode = usePrefs((s) => s.setTimeMode)
  const night = useIsNight()
  const Icon = mode === 'auto' ? SunMoon : mode === 'day' ? Sun : Moon
  return (
    <button
      className={`flex h-11 min-w-11 items-center gap-2 rounded-2xl px-3 text-xs font-bold whitespace-nowrap shadow-soft backdrop-blur ${night ? 'bg-ink text-white' : 'bg-white/95'}`}
      onClick={() => setMode(NEXT_MODE[mode])}
      aria-label={`Iluminación: ${TIME_LABEL[mode]}. Toca para cambiar`}
      title={`Iluminación: ${TIME_LABEL[mode]}`}
    >
      <Icon className="size-4" />
      <span>{TIME_LABEL[mode]}</span>
    </button>
  )
}

/** Guía fija de controles en escritorio: deja claro que el mapa se arrastra. */
function ControlsLegend() {
  const key = 'rounded-md border border-ink/15 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink shadow-[0_1px_0_rgb(0_0_0/0.08)]'
  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 flex max-xl:hidden -translate-x-1/2 items-center gap-3 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-ink-soft shadow-soft backdrop-blur">
      <span className="flex items-center gap-1.5">
        <Mouse className="size-4 text-brand" /> Arrastra para moverte
      </span>
      <span className="text-line">|</span>
      <span className="flex items-center gap-1.5">
        o mantén <kbd className={key}>Espacio</kbd> y arrastra
      </span>
      <span className="text-line">|</span>
      <span>Rueda: zoom</span>
      <span className="text-line">|</span>
      <span className="flex items-center gap-1.5">
        <Keyboard className="size-4" /> <kbd className={key}>WASD</kbd> / flechas
      </span>
    </div>
  )
}

/**
 * Plano 2D, día/noche y calidad. En escritorio van apilados con texto; en celular se agrupan en
 * un botón de ajustes para no tapar el mapa en pantallas bajas.
 */
function ViewOptions({ use3D, webgl, desktop }: { use3D: boolean; webgl: boolean; desktop: boolean }) {
  const setForce2D = usePrefs((s) => s.setForce2D)
  const quality = usePrefs((s) => s.quality)
  const chooseQuality = usePrefs((s) => s.chooseQuality)
  const [open, setOpen] = useState(false)
  const item = 'flex h-11 min-w-11 items-center gap-2 rounded-2xl px-3 text-xs font-bold whitespace-nowrap shadow-soft backdrop-blur'

  const buttons = (
    <>
      {webgl && (
        <button
          className={`${item} bg-white/95`}
          onClick={() => {
            setForce2D(use3D)
            setOpen(false)
          }}
          aria-label={use3D ? 'Cambiar a plano 2D' : 'Cambiar a vista 3D'}
        >
          {use3D ? <MapIcon className="size-4" /> : <Box className="size-4" />} {use3D ? 'Plano 2D' : 'Vista 3D'}
        </button>
      )}
      {use3D && <TimeToggle />}
      <DemoPromoButton className={item} onDone={() => setOpen(false)} />
      {use3D && (
        <button
          className={`${item} ${quality !== 'high' ? 'bg-ink text-white' : 'bg-white/95'}`}
          onClick={() => chooseQuality(NEXT_QUALITY[quality])}
          aria-label={`Calidad gráfica: ${QUALITY_LABEL[quality]}. Toca para cambiar`}
          title="Alta: todo. Media: sin sombras. Baja: menos decoración (las tiendas no cambian)."
        >
          <Layers className="size-4" /> Calidad {QUALITY_LABEL[quality]}
        </button>
      )}
    </>
  )

  if (desktop) return buttons
  return (
    <div className="relative">
      {open && (
        <div className="absolute right-0 bottom-full mb-2 flex flex-col items-stretch gap-2 *:justify-start" role="menu">
          {buttons}
        </div>
      )}
      <button
        className={`grid size-11 place-items-center rounded-2xl shadow-soft backdrop-blur ${open ? 'bg-ink text-white' : 'bg-white/95'}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Opciones de vista: plano 2D, día o noche, calidad"
      >
        <Settings2 className="size-5" />
      </button>
    </div>
  )
}

/**
 * Selector de pisos, fijo a la izquierda: Piso 2 arriba, Piso 1 abajo (como en un ascensor),
 * flechas para subir/bajar y "Ambos" para la vista general.
 */
function FloorSelector({ use3D, dimmed }: { use3D: boolean; dimmed: boolean }) {
  const active = useUI((s) => s.activeFloor)
  const overview = useUI((s) => s.overview)
  const setFloor = useUI((s) => s.setFloor)
  const setOverview = useUI((s) => s.setOverview)
  const floors = [...FLOORS].sort((a, b) => b.level - a.level)
  const idx = floors.findIndex((f) => f.id === active)
  const go = (d: -1 | 1) => {
    const next = floors[idx + d]
    if (next) setFloor(next.id)
  }
  const btn = 'grid h-9 w-full place-items-center text-white/70 transition hover:text-white disabled:opacity-25 max-md:hidden'
  return (
    <nav
      aria-label="Pisos"
      className={`absolute top-1/2 left-3 z-10 flex w-[50px] -translate-y-1/2 md:w-[66px] flex-col items-stretch overflow-hidden rounded-2xl bg-ink/90 p-1 shadow-float backdrop-blur transition-opacity ${
        dimmed ? 'max-md:pointer-events-none max-md:opacity-0' : ''
      }`}
    >
      <button className={btn} onClick={() => go(-1)} disabled={idx <= 0 && !overview} aria-label="Subir un piso">
        <ChevronUp className="size-5" />
      </button>
      {floors.map((f) => {
        const on = f.id === active && !overview
        return (
          <button
            key={f.id}
            onClick={() => setFloor(f.id)}
            aria-pressed={on}
            aria-label={f.name}
            className={`rounded-xl px-1 py-2 text-[11px] leading-tight font-bold transition md:py-2.5 md:text-[12px] ${on ? 'bg-brand text-white' : 'text-white/80 hover:bg-white/10'}`}
          >
            <span className="md:hidden">P{f.level}</span>
            <span className="max-md:hidden">{f.name}</span>
          </button>
        )
      })}
      <button className={btn} onClick={() => go(1)} disabled={idx >= floors.length - 1 && !overview} aria-label="Bajar un piso">
        <ChevronDown className="size-5" />
      </button>
      {use3D && (
        <button
          onClick={() => setOverview(!overview)}
          aria-pressed={overview}
          title="Vista general de la fortaleza (ambos pisos)"
          className={`mt-0.5 flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition ${overview ? 'bg-sun text-ink' : 'text-white/70 hover:bg-white/10'}`}
        >
          <Castle className="size-4" /> Fortaleza
        </button>
      )}
    </nav>
  )
}

/** Anuncio para lectores de pantalla cuando una oferta relámpago se presenta (no depende del brillo). */
function PromoAnnouncer() {
  const event = usePromoEvents((s) => s.events.find((e) => e.spotlight === 'playing'))
  const store = useCatalog((s) => s.stores.find((st) => st.id === event?.storeId))
  return (
    <p className="sr-only" aria-live="polite">
      {event && store ? `Nueva oferta relámpago en ${store.name}: −${event.discount}%.` : ''}
    </p>
  )
}
