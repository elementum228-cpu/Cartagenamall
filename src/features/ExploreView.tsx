import { openCourtOrClaim } from '../football/open'
import { AnimatePresence, motion } from 'motion/react'
import { Castle, ChevronDown, ChevronUp, DoorOpen, Gem, Hand, House, Keyboard, Mouse, Settings2, Shirt, Smartphone, Sparkles, Trophy, Utensils, Layers, Map as MapIcon, Box, Moon, Sun, SunMoon, Zap, ZoomIn, ZoomOut, Route, ChevronRight, X, Store as StoreIcon, type LucideIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORY_BY_ID, COURT_SPACE, FLOORS, FLOOR_OF_ZONE, SPACE_BY_ID, ZONES, ZONE_BY_ID } from '../config/mall'
import { formatCOP } from '../lib/format'
import { useSpacePrice } from '../state/spacePricing'
import type { ZoneId } from '../domain/types'
import { isPromotionLive } from '../lib/pricing'
import { useNow } from '../lib/useNow'
import { hasWebGL } from '../lib/webgl'
import { useIsNight } from '../lib/useIsNight'
import { useIsDesktop } from '../lib/useMedia'
import { useCatalog } from '../state/catalog'
import { usePersonal } from '../state/personal'
import { usePrefs, useUI } from '../state/ui'
import { Countdown, StoreLogo } from '../ui/bits'
import { Map2D } from './Map2D'
import { usePromoEvents } from '../promotions/store'
import { DemoPromoButton } from './DemoPromoButton'
import { startTour } from './GuidedTour'
import { PinchHint } from './PinchHint'

const WorldCanvas = lazy(() => import('../world/WorldCanvas'))

/** Modo Explorar: mundo 3D (o plano 2D) con controles superpuestos. Se mantiene montado. */
export function ExploreView({ active }: { active: boolean }) {
  const force2D = usePrefs((s) => s.force2D)
  const webgl = useMemo(hasWebGL, [])
  const use3D = webgl && !force2D
  const selectedSpaceId = useUI((s) => s.selectedSpaceId)
  const peek = useUI((s) => s.peek)
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
      {use3D && <div className="world-vignette pointer-events-none absolute inset-0" aria-hidden />}
      {active && <Hud use3D={use3D} webgl={webgl} dimmed={!!selectedSpaceId && !peek} />}
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

  const activeZone = useUI((s) => (s.focus?.kind === 'zone' ? s.focus.id : null))
  const peekId = useUI((s) => (s.peek ? s.selectedSpaceId : null))
  const courtActive = useUI((s) => s.courtOpen || s.selectedSpaceId === COURT_SPACE.id)
  const chip = (on: boolean) =>
    `tap-halo flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition duration-200 active:scale-[0.98] ${
      on ? 'bg-teal text-white shadow-[var(--shadow-glow)] ring-1 ring-white/30' : 'glass text-ink shadow-none'
    }`

  return (
    <>
      {use3D && <PinchHint hidden={dimmed || !!peekId} />}
      {/* categorías: cápsulas de vidrio, la elegida en turquesa */}
      <div
        className={`scrollbar-none absolute top-[var(--chrome-top)] right-0 left-0 z-10 flex gap-2 overflow-x-auto px-3 pb-2 transition-opacity duration-200 md:right-auto md:px-5 ${dimmed ? 'max-md:pointer-events-none max-md:opacity-0' : ''}`}
        role="toolbar"
        aria-label="Categorías del mall"
      >
        {ZONES.map((z) => {
          const Icon = ZONE_ICON[z.id]
          return (
            <button
              key={z.id}
              onClick={() => {
                // Elegir una zona de otro piso (p. ej. Gastronomía) cambia a ese piso.
                setFloor(FLOOR_OF_ZONE[z.id])
                selectSpace(null)
                if (use3D) requestFocus({ kind: 'zone', id: z.id })
              }}
              aria-pressed={activeZone === z.id}
              className={chip(activeZone === z.id)}
            >
              <Icon className="size-4" strokeWidth={1.8} />
              {z.name}
            </button>
          )
        })}
        <button onClick={() => openCourtOrClaim(use3D)} aria-pressed={courtActive} className={chip(courtActive)}>
          <Trophy className="size-4" strokeWidth={1.8} />
          Cancha
        </button>
      </div>

      <FloorSelector use3D={use3D} dimmed={dimmed} />

      {/* descubrimientos y oferta relámpago: pills discretas */}
      <div
        className={`pointer-events-none absolute top-[calc(var(--chrome-top)+44px)] right-3 left-3 z-10 flex flex-wrap items-start gap-1.5 transition-opacity duration-200 md:left-5 md:right-auto *:pointer-events-auto ${dimmed ? 'max-md:opacity-0 max-md:*:pointer-events-none' : ''}`}
      >
        <Link to="/ofertas" className="glass flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-[12px] font-semibold text-ink shadow-none">
          <span className="grid size-5 place-items-center rounded-full bg-amber/90 text-deep">
            <Gem className="size-3" strokeWidth={2} />
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
            className={`glass flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2 text-[12px] font-semibold text-ink shadow-none transition active:scale-[0.98] ${flashEvent.spotlight === 'playing' ? 'ring-2 ring-amber' : ''}`}
            aria-label={`Oferta relámpago −${flash.discountPercent}% en ${flashStore?.name ?? 'una tienda'}. Ver la tienda`}
          >
            <Zap className="size-3.5 text-[#c9871c]" strokeWidth={2} /> −{flash.discountPercent}%{flashStore && <span className="max-w-28 truncate">· {flashStore.name}</span>}
            <span className="text-ink-soft">
              <Countdown endsAt={flash.endsAt} />
            </span>
          </button>
        )}
        <PromoAnnouncer />
      </div>

      {/* Parte baja: ficha del local elegido, botón principal y controles. La fila no captura toques
          (el mapa se puede arrastrar); solo sus botones. */}
      <div
        className={`pointer-events-none absolute inset-x-3 bottom-[calc(var(--chrome-bottom)+10px)] z-10 flex flex-col gap-3 transition-opacity duration-200 md:inset-x-5 md:bottom-5 *:pointer-events-auto ${dimmed ? 'max-md:opacity-0 max-md:*:pointer-events-none' : ''}`}
      >
        <AnimatePresence>
          {use3D && !hintSeen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.24 }}
              className="glass-strong max-w-[300px] self-start rounded-[22px] p-3.5 text-[12.5px]"
            >
              <p className="flex items-center gap-2 font-semibold">
                <Hand className="size-4 text-teal" strokeWidth={1.8} /> Cómo explorar
              </p>
              <p className="mt-1 text-ink-soft">
                {desktop
                  ? 'Arrastra con el mouse (o mantén Espacio y arrastra) para recorrer. Rueda para acercarte. Toca una tienda o un espacio libre.'
                  : 'Desliza un dedo para recorrer y pellizca con dos para acercarte. Toca una tienda o un espacio libre.'}{' '}
                Cerca de las tiendas hay ofertas escondidas.
              </p>
              <button className="mt-1.5 text-xs font-semibold text-teal" onClick={setHintSeen}>
                Entendido
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>{peekId && <PeekCard key={peekId} spaceId={peekId} />}</AnimatePresence>
        <div className="flex items-end justify-between gap-3">
          {/* espacio izquierdo (equilibra los controles de la derecha para centrar el botón) */}
          <div className="w-11 shrink-0 max-md:block md:hidden" aria-hidden />
          <div className="flex min-w-0 flex-1 justify-center md:justify-start">
            {overview && use3D ? (
              <PrimaryCta onClick={() => useUI.getState().enterMall()} icon={<DoorOpen className="size-5" strokeWidth={1.9} />} label="Explorar el mall" />
            ) : use3D ? (
              <PrimaryCta onClick={() => useUI.getState().setOverview(true)} icon={<Castle className="size-5" strokeWidth={1.9} />} label="Ver todo el mall" />
            ) : null}
          </div>
          {/* controles de cámara */}
          <div className="flex shrink-0 flex-col items-end gap-2">
            {use3D && !overview && (
              <button className="glass grid size-11 place-items-center rounded-full text-ink shadow-none transition active:scale-[0.96]" onClick={goHome} aria-label="Volver al centro del piso">
                <House className="size-5" strokeWidth={1.8} />
              </button>
            )}
            {use3D && (
              <div className="glass flex flex-col overflow-hidden rounded-full shadow-none">
                <button className="grid size-11 place-items-center text-ink transition active:bg-white/50" onClick={() => requestFocus({ kind: 'zoom', factor: 1.5 })} aria-label="Acercar">
                  <ZoomIn className="size-5" strokeWidth={1.8} />
                </button>
                <span className="mx-auto h-px w-5 bg-ink/10" />
                <button className="grid size-11 place-items-center text-ink transition active:bg-white/50" onClick={() => requestFocus({ kind: 'zoom', factor: 1 / 1.5 })} aria-label="Alejar">
                  <ZoomOut className="size-5" strokeWidth={1.8} />
                </button>
              </div>
            )}
            <ViewOptions use3D={use3D} webgl={webgl} desktop={desktop} />
          </div>
        </div>
      </div>
      {use3D && desktop && !dimmed && !overview && <ControlsLegend />}
    </>
  )
}

const ZONE_ICON: Record<ZoneId, LucideIcon> = { A: Shirt, B: Smartphone, C: Sparkles, D: Gem, E: Utensils }

/**
 * Ficha breve del local tocado en el mapa (celular): logo, nombre y rubro; al tocarla se abre la
 * ficha completa. Para un espacio libre invita a reclamarlo.
 */
function PeekCard({ spaceId }: { spaceId: string }) {
  const space = SPACE_BY_ID[spaceId]
  const store = useCatalog((s) => s.stores.find((st) => st.id === s.assignments[spaceId]))
  const price = useSpacePrice(spaceId)
  if (!space) return null
  const zone = ZONE_BY_ID[space.zoneId]
  const title = store ? store.name : `Espacio ${space.label}`
  const sub = store ? (CATEGORY_BY_ID[store.categoryId]?.name ?? zone.name) : `Disponible · ${formatCOP(price)}/mes`
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      className="glass-strong mx-auto flex w-full max-w-[420px] items-center gap-1 rounded-[26px] p-1.5"
    >
      <button onClick={() => useUI.getState().openPeek()} className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] p-1.5 text-left transition duration-200 active:scale-[0.99]" aria-label={`Ver ${title}`}>
        {store ? (
          <StoreLogo store={store} size={48} />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal/10 text-teal">
            <StoreIcon className="size-5" strokeWidth={1.8} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold tracking-[-0.01em]">{title}</span>
          <span className="flex items-center gap-1.5 truncate text-[13px] text-ink-soft">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: store ? store.brandColor : zone.color }} />
            {sub}
          </span>
        </span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal text-white shadow-[var(--shadow-glow)]">
          <ChevronRight className="size-5" strokeWidth={2} />
        </span>
      </button>
      <button onClick={() => useUI.getState().selectSpace(null)} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-white/60" aria-label="Cerrar">
        <X className="size-4" strokeWidth={2} />
      </button>
    </motion.div>
  )
}

/** Botón principal: cápsula turquesa con degradado sutil y sombra turquesa suave. */
function PrimaryCta({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex h-14 items-center gap-2.5 rounded-full bg-gradient-to-b from-[#0a9c95] to-teal px-7 text-[17px] font-semibold tracking-[-0.01em] text-white shadow-[0_14px_34px_-10px_rgb(0_141_135/0.75)] ring-1 ring-white/25 transition duration-200 active:scale-[0.97] max-md:max-w-[min(260px,100%)]"
    >
      {icon}
      {label}
    </button>
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
      className={`glass flex h-11 min-w-11 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold whitespace-nowrap shadow-none transition active:scale-[0.98] ${night ? '!bg-deep/85 !text-white' : 'text-ink'}`}
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
    <div className="glass pointer-events-none absolute bottom-5 left-1/2 z-10 flex max-xl:hidden -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-xs font-medium text-ink-soft shadow-none">
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
  const item = 'glass flex h-11 min-w-11 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold whitespace-nowrap text-ink shadow-none transition duration-200 active:scale-[0.98]'

  const buttons = (
    <>
      {webgl && (
        <button
          className={item}
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
      <button
        className={item}
        onClick={() => {
          setOpen(false)
          useUI.getState().showDoor()
        }}
        aria-label="Ver otra vez el portón de entrada"
      >
        <DoorOpen className="size-4" /> Ver la entrada
      </button>
      {use3D && (
        <button
          className={item}
          onClick={() => {
            setOpen(false)
            startTour()
          }}
          aria-label="Empezar el recorrido guiado por el mall"
        >
          <Route className="size-4" /> Recorrido guiado
        </button>
      )}
      {use3D && (
        <button
          className={`${item} ${quality !== 'high' ? '!bg-deep/85 !text-white' : ''}`}
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
        className={`glass grid size-11 place-items-center rounded-full shadow-none transition active:scale-[0.96] ${open ? '!bg-teal !text-white' : 'text-ink'}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Opciones de vista: plano 2D, día o noche, calidad"
      >
        <Settings2 className="size-5" strokeWidth={1.8} />
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
  const btn = 'grid h-8 w-full place-items-center text-ink-soft transition hover:text-ink disabled:opacity-25 max-md:hidden'
  return (
    <nav
      aria-label="Pisos"
      className={`glass absolute top-1/2 left-3 z-10 flex w-[48px] -translate-y-1/2 flex-col items-stretch gap-0.5 overflow-hidden rounded-[24px] p-1 shadow-none transition-opacity duration-200 md:left-5 md:w-[64px] ${
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
            className={`rounded-[18px] px-1 py-2 text-[11.5px] leading-tight font-semibold transition duration-200 active:scale-[0.97] md:py-2.5 md:text-[12px] ${on ? 'bg-teal text-white shadow-[var(--shadow-glow)]' : 'text-ink hover:bg-white/50'}`}
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
          className={`flex flex-col items-center gap-0.5 rounded-[18px] py-1.5 text-[9.5px] font-semibold transition duration-200 active:scale-[0.97] ${overview ? 'bg-amber text-deep' : 'text-ink-soft hover:bg-white/50'}`}
        >
          <Castle className="size-4" strokeWidth={1.8} /> Fortaleza
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
