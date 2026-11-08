import { openCourtOrClaim } from '../football/open'
import { EVENT_KINDS, PHASES, STADIUM, phaseInfo } from '../config/stadium'
import { cameraState } from '../world/cameraState'
import { previewGoal } from '../state/goalSound'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { stopStadiumSound, toggleStadiumSound, toggleWorksSound, useStadiumEvent, useStadiumPhase, useStadiumSound } from '../state/stadium'
import { BOAT_OF_STORE } from '../tourism/config'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import {
  Anchor,
  Music2,
  Volume2,
  Ticket,
  PartyPopper,
  VolumeX,
  HardHat,
  Gamepad2,
  Plane,
  BookOpen,
  Castle,
  Sailboat,
  Ghost,
  Scissors,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Gem,
  Hand,
  House,
  Keyboard,
  Mouse,
  Settings2,
  Shirt,
  Smartphone,
  Sparkles,
  Trophy,
  Utensils,
  Layers,
  Map as MapIcon,
  Box,
  Moon,
  Sun,
  SunMoon,
  Zap,
  ZoomIn,
  ZoomOut,
  Route,
  ChevronRight,
  X,
  Store as StoreIcon,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
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
import { usePassport, usePassportStamps } from '../state/passport'
import { useSeason, useSeasonSettings } from '../state/season'
import { usePrefs, useUI } from '../state/ui'
import { Countdown, StoreLogo } from '../ui/bits'
import { Map2D } from './Map2D'
import { usePromoEvents } from '../promotions/store'
import { DemoPromoButton } from './DemoPromoButton'
import { useCanAdmin } from '../remote/session'
import { ShipPill, ShipTestButton } from '../ship/ShipLayer'
import { usePirateShip } from '../state/pirate'
import { useAirportFeature } from '../state/airportFeature'
import { useEntertainmentFeature } from '../state/entertainmentFeature'
import { useFlight } from '../airport/flight'
import { BOATS, BOAT_IDS } from '../tourism/config'
import { startTour } from './GuidedTour'
import { PinchHint } from './PinchHint'
import { InstallButton } from '../pwa/InstallApp'

const WorldCanvas = lazy(() => import('../world/WorldCanvas'))

/** Modo Explorar: mundo 3D (o plano 2D) con controles superpuestos. Se mantiene montado. */
export function ExploreView({ active }: { active: boolean }) {
  const force2D = usePrefs((s) => s.force2D)
  const webgl = useMemo(hasWebGL, [])
  const use3D = webgl && !force2D
  const selectedSpaceId = useUI((s) => s.selectedSpaceId)
  const peek = useUI((s) => s.peek)
  const harborOpen = useUI((s) => s.harbor !== null || s.showroom !== null || s.shipOpen)
  const night = useIsNight() && use3D
  const root = useRef<HTMLDivElement>(null)

  // De noche, mientras se explora, las barras y controles pasan a vidrio ahumado (ver index.css).
  useEffect(() => {
    document.documentElement.classList.toggle('theme-night', active && night)
    // sobre el mapa 3D el nombre del mall va en blanco (el fondo es agua y muralla, no la arena)
    document.documentElement.classList.toggle('on-map', active && use3D)
    return () => document.documentElement.classList.remove('theme-night', 'on-map')
  }, [active, night, use3D])

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
      {active && <Hud use3D={use3D} webgl={webgl} dimmed={(!!selectedSpaceId && !peek) || harborOpen} />}
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
  const season = useSeason()
  const entOn = useEntertainmentFeature((s) => s.enabled)
  const stampList = usePassportStamps()
  const passportDone = usePassport((s) => stampList.filter((p) => s.stamps[p.id]).length)
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
      on ? 'glass-teal' : 'glass text-ink'
    }`

  return (
    <MotionConfig reducedMotion="user">
      <div className="tour-hide">
        {use3D && <PinchHint hidden={dimmed || !!peekId} />}
        {/* las lanchas del muelle, también con teclado (en el mapa se tocan directamente) */}
        {use3D && (
          <div className="absolute bottom-[calc(var(--chrome-bottom)+80px)] left-3 z-30 flex flex-col gap-2">
            {BOAT_IDS.map((id) => (
              <button
                key={id}
                className="glass sr-only rounded-full px-4 py-2.5 text-[13px] font-semibold text-ink focus:not-sr-only focus-visible:ring-2 focus-visible:ring-teal"
                onClick={() => useUI.getState().openHarbor(id)}
              >
                Muelle turístico: {BOATS[id].title}
              </button>
            ))}
          </div>
        )}
        {/* categorías: cápsulas de vidrio, la elegida en turquesa */}
        {/* cada cápsula flota sola sobre el mapa (sin bandeja). La fila sí recibe toques: en iPhone una
          fila que los ignora no se puede deslizar de lado. Es una franja delgada, el mapa sigue libre. */}
        <div
          className={`island-hide scrollbar-none absolute top-[var(--chrome-top)] right-0 left-0 z-10 flex touch-pan-x gap-2.5 overflow-x-auto overscroll-x-contain px-3 pb-2 transition-opacity duration-200 md:px-5 ${dimmed ? 'max-md:pointer-events-none max-md:opacity-0' : ''}`}
          role="toolbar"
          aria-label="Categorías del mall"
        >
          {/* Isla Tecnología no va en la fila: se llega en avión desde el aeropuerto */}
          {ZONES.filter((z) => z.id !== 'I' && (z.id !== 'G' || entOn)).map((z) => {
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
            Deportes
          </button>
        </div>

        <div className="island-hide">
          <FloorSelector use3D={use3D} dimmed={dimmed} />
        </div>

        {/* descubrimientos y oferta relámpago: pills discretas */}
        <div
          className={`island-hide pointer-events-none absolute top-[calc(var(--chrome-top)+48px)] right-3 left-3 z-10 flex flex-wrap items-start gap-1.5 transition-opacity duration-200 md:left-5 md:right-auto *:pointer-events-auto ${dimmed ? 'max-md:opacity-0 max-md:*:pointer-events-none' : ''}`}
        >
          <Link to="/ofertas" className="glass flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-[12px] font-semibold text-ink shadow-none">
            <span className="grid size-5 place-items-center rounded-full bg-amber/90 text-deep">
              <Gem className="size-3" strokeWidth={2} />
            </span>
            Secretas {Math.min(discovered.length, secretTotal)}/{secretTotal}
          </Link>
          <Link
            to="/pasaporte"
            className="glass flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-[12px] font-semibold text-ink shadow-none"
            aria-label={`Mi pasaporte: ${passportDone} de ${stampList.length} sellos`}
          >
            <span className="grid size-5 place-items-center rounded-full bg-teal text-white">
              <BookOpen className="size-3" strokeWidth={2} />
            </span>
            Pasaporte {passportDone}/{stampList.length}
          </Link>
          {flash && flashEvent && (
            <button
              onClick={() => {
                // Lo elige la persona: se acerca la cámara y se abre la ficha con la oferta.
                setFloor(flashEvent.floorId)
                const boat = BOAT_OF_STORE[flashEvent.storeId]
                if (boat && flashEvent.spaceId.startsWith('BOAT:')) {
                  useUI.getState().openHarbor(boat)
                  return
                }
                selectSpace(flashEvent.spaceId)
                if (use3D) requestFocus({ kind: 'space', id: flashEvent.spaceId })
              }}
              // suelta, sin cápsula: ícono ámbar, descuento, tienda y contador alineados al centro
              className="chrome-text flex h-8 items-center gap-1.5 rounded-full pr-1 text-[13px] leading-none font-semibold transition active:scale-[0.98]"
              aria-label={`Oferta relámpago −${flash.discountPercent}% en ${flashStore?.name ?? 'una tienda'}. Ver la tienda`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full bg-amber text-deep shadow-[0_2px_10px_rgb(247_179_75/0.55)] ${flashEvent.spotlight === 'playing' ? 'motion-safe:animate-pulse' : ''}`}
              >
                <Zap className="size-3.5" strokeWidth={2.2} fill="currentColor" />
              </span>
              <span className="font-bold">−{flash.discountPercent}%</span>
              {flashStore && <span className="max-w-28 truncate opacity-90">{flashStore.name}</span>}
              <Countdown endsAt={flash.endsAt} className="!font-sans !text-[12.5px] leading-none !font-semibold opacity-90" />
            </button>
          )}
          <ShipPill />
          {season === 'halloween' && (
            <span className="chrome-text flex h-8 items-center gap-1.5 pr-1 text-[12.5px] leading-none font-semibold">
              <span className="grid size-6 place-items-center rounded-full bg-[#e8761c] text-white shadow-[0_2px_10px_rgb(232_118_28/0.5)]">
                <Moon className="size-3.5" strokeWidth={2.2} />
              </span>
              Temporada de Halloween
            </span>
          )}
          <PromoAnnouncer />
        </div>

        {use3D && <StadiumListenButton />}

        {/* Parte baja: ficha del local elegido, botón principal y controles. La fila no captura toques
          (el mapa se puede arrastrar); solo sus botones. */}
        <div
          className={`pointer-events-none absolute inset-x-3 bottom-[calc(var(--chrome-bottom)+10px)] z-10 flex flex-col gap-3 transition-opacity duration-200 md:inset-x-5 md:bottom-5 ${dimmed ? 'max-md:opacity-0 max-md:**:pointer-events-none' : ''}`}
        >
          <AnimatePresence>
            {use3D && !hintSeen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.24 }}
                className="glass-strong pointer-events-auto max-w-[300px] self-start rounded-[22px] p-3.5 text-[12.5px]"
              >
                <p className="flex items-center gap-2 font-semibold">
                  <Hand className="size-4 text-teal" strokeWidth={1.8} /> Cómo explorar
                </p>
                <p className="mt-1 text-ink-soft">
                  {desktop
                    ? 'Arrastra con el mouse (o mantén Espacio y arrastra) para recorrer. Rueda para acercarte. Toca una tienda o un espacio libre.'
                    : 'Desliza un dedo para recorrer y pellizca con dos para acercarte. Toca una tienda o un espacio libre.'}{' '}
                  Hay ofertas escondidas por todo el mall: acércate a los destellos dorados.
                </p>
                <button className="mt-1.5 text-xs font-semibold text-teal" onClick={setHintSeen}>
                  Entendido
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {/* la fila y su centro no capturan toques (el mapa sigue arrastrable y con pellizco debajo).
            La ficha del local se posa encima del botón principal, como una tarjeta de mapas; los
            controles suben para dejarle sitio. */}
          <div className="pointer-events-none relative flex items-end justify-between gap-3">
            {/* espacio izquierdo (equilibra los controles de la derecha para centrar el botón) */}
            <div className="w-11 shrink-0 max-md:block md:hidden" aria-hidden />
            <div className="flex min-w-0 flex-1 justify-center md:justify-start *:pointer-events-auto">
              <AnimatePresence mode="popLayout" initial={false}>
                {use3D && !peekId && (
                  <motion.div
                    className="island-hide"
                    key={overview ? 'enter' : 'overview'}
                    initial={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.92, filter: 'blur(6px)' }}
                    transition={SPRING}
                  >
                    {overview ? (
                      <PrimaryCta onClick={() => useUI.getState().enterMall()} icon={<DoorOpen className="size-5" strokeWidth={1.9} />} label="Explorar el mall" />
                    ) : (
                      <PrimaryCta onClick={() => useUI.getState().setOverview(true)} icon={<Castle className="size-5" strokeWidth={1.9} />} label="Ver todo el mall" />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* controles de cámara */}
            <motion.div className="flex shrink-0 flex-col items-end gap-2 *:pointer-events-auto" animate={{ y: peekId ? -(PEEK_HEIGHT + 12) : 0 }} transition={SPRING}>
              {use3D && !overview && (
                <button
                  className="glass grid size-11 place-items-center rounded-full text-ink shadow-none transition active:scale-[0.96]"
                  onClick={goHome}
                  aria-label="Volver al centro del piso"
                >
                  <House className="size-5" strokeWidth={1.8} />
                </button>
              )}
              {use3D && (
                <div className="glass flex flex-col overflow-hidden rounded-full shadow-none">
                  <button
                    className="grid size-11 place-items-center text-ink transition active:bg-white/50"
                    onClick={() => requestFocus({ kind: 'zoom', factor: 1.5 })}
                    aria-label="Acercar"
                  >
                    <ZoomIn className="size-5" strokeWidth={1.8} />
                  </button>
                  <span className="mx-auto h-px w-5 bg-ink/10" />
                  <button
                    className="grid size-11 place-items-center text-ink transition active:bg-white/50"
                    onClick={() => requestFocus({ kind: 'zoom', factor: 1 / 1.5 })}
                    aria-label="Alejar"
                  >
                    <ZoomOut className="size-5" strokeWidth={1.8} />
                  </button>
                </div>
              )}
              <ViewOptions use3D={use3D} webgl={webgl} desktop={desktop} />
            </motion.div>
            <AnimatePresence>{peekId && <PeekCard spaceId={peekId} />}</AnimatePresence>
          </div>
        </div>
        {use3D && desktop && !dimmed && !overview && <ControlsLegend />}
      </div>
    </MotionConfig>
  )
}

const ZONE_ICON: Record<ZoneId, LucideIcon> = { A: Shirt, B: Smartphone, C: Sparkles, D: Gem, E: Utensils, F: Scissors, G: Gamepad2, I: Plane }

/** Resorte suave al estilo de las apps nativas: rápido al arrancar, sin rebote brusco al llegar. */
const SPRING = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 } as const
/** Alto de la ficha breve (logo de 48 + márgenes); los controles suben esto más el respiro. */
const PEEK_HEIGHT = 72

/**
 * Ficha breve del local tocado en el mapa (celular): sube desde abajo y se posa sobre el botón
 * principal. Al tocar otro local la tarjeta se queda y solo cambia su contenido (deslizándose);
 * se cierra con la X o arrastrándola hacia abajo. Al tocarla se abre la ficha completa.
 */
function PeekCard({ spaceId }: { spaceId: string }) {
  const close = () => useUI.getState().selectSpace(null)
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.96 }}
      transition={SPRING}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.05, bottom: 0.7 }}
      onDragEnd={(_, info) => (info.offset.y > 36 || info.velocity.y > 400) && close()}
      style={{ height: PEEK_HEIGHT }}
      className="glass-strong pointer-events-auto absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-[420px] touch-none items-center gap-1 overflow-hidden rounded-[26px] p-1.5"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <PeekContent key={spaceId} spaceId={spaceId} />
      </AnimatePresence>
      <button onClick={close} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-white/60" aria-label="Cerrar">
        <X className="size-4" strokeWidth={2} />
      </button>
    </motion.div>
  )
}

function PeekContent({ spaceId, ref }: { spaceId: string; ref?: Ref<HTMLButtonElement> }) {
  const space = SPACE_BY_ID[spaceId]
  const store = useCatalog((s) => s.stores.find((st) => st.id === s.assignments[spaceId]))
  const price = useSpacePrice(spaceId)
  if (!space) return null
  const zone = ZONE_BY_ID[space.zoneId]
  const title = store ? store.name : `Espacio ${space.label}`
  const sub = store ? (CATEGORY_BY_ID[store.categoryId]?.name ?? zone.name) : `Disponible · ${formatCOP(price)}/mes`
  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, x: 28, filter: 'blur(4px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: -28, filter: 'blur(4px)' }}
      transition={SPRING}
      onClick={() => useUI.getState().openPeek()}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] p-1.5 text-left active:scale-[0.99]"
      aria-label={`Ver ${title}`}
    >
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
    </motion.button>
  )
}

/** Botón principal: cápsula turquesa con degradado sutil y sombra turquesa suave. */
function PrimaryCta({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="glass-teal flex h-14 items-center gap-2.5 rounded-full pr-5 pl-6 text-[17px] font-semibold tracking-[-0.01em] transition duration-200 active:scale-[0.97] max-md:max-w-[min(280px,100%)]"
    >
      {icon}
      {label}
      <ChevronRight className="size-5 opacity-90" strokeWidth={2} />
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
  const key = 'rounded-md border border-black/15 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800 shadow-[0_1px_0_rgb(0_0_0/0.08)]'
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
  // el cliente ve Plano 2D, día/noche/hora real, instalar, recorrido guiado y calidad; las herramientas de prueba y de guía son del administrador
  const canAdmin = useCanAdmin()
  const item =
    'glass flex h-11 min-w-11 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold whitespace-nowrap text-ink shadow-none transition duration-200 active:scale-[0.98]'

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
      <InstallButton className={item} onDone={() => setOpen(false)} />
      {use3D && (
        <button
          className={`${item} ${quality !== 'high' ? '!bg-deep/85 !text-white' : ''}`}
          onClick={() => chooseQuality(NEXT_QUALITY[quality])}
          aria-label={`Calidad gráfica: ${QUALITY_LABEL[quality]}. Toca para cambiar`}
          title="Alta: sombras y más personas en el mall. Media: sin sombras y menos personas. Baja: sin personas y menos decoración (las tiendas no cambian)."
        >
          <Layers className="size-4" /> Calidad {QUALITY_LABEL[quality]}
        </button>
      )}
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
      {canAdmin && (
        <>
          <DemoPromoButton className={item} onDone={() => setOpen(false)} />
          {use3D && <ShipTestButton className={item} onDone={() => setOpen(false)} />}
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
          {use3D && <HalloweenToggle className={item} />}
          {use3D && <PirateToggle className={item} />}
          {use3D && <AirportToggle className={item} />}
          {use3D && <EntertainmentToggle className={item} />}
          {use3D && <StadiumToggle className={item} />}
          {use3D && <StadiumEventToggle className={item} />}
        </>
      )}
    </>
  )

  // escritorio y móvil: un solo botón de opciones que despliega el menú (el mapa queda limpio)
  void desktop
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
      className={`glass absolute top-1/2 left-3 z-10 flex w-[50px] -translate-y-1/2 flex-col items-stretch gap-0.5 overflow-hidden rounded-[24px] p-1 transition-opacity duration-200 md:left-5 md:w-[64px] ${
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
            className={`rounded-[18px] px-1 py-2 text-[11.5px] leading-tight font-semibold transition duration-200 active:scale-[0.97] md:py-2.5 md:text-[12px] ${on ? 'glass-teal' : 'text-ink hover:bg-white/30'}`}
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
          aria-label="Fortaleza: ver todo el mall"
          className={`grid h-10 place-items-center rounded-[18px] transition duration-200 active:scale-[0.97] ${overview ? 'bg-amber text-deep shadow-[0_6px_18px_-6px_rgb(247_179_75/0.7),inset_0_1px_0_rgb(255_255_255/0.5)]' : 'text-ink-soft hover:bg-white/30'}`}
        >
          <Castle className="size-5" strokeWidth={1.8} />
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

/** Prueba el tema de Halloween en este dispositivo (para mostrar que el mall se puede tematizar). */
function HalloweenToggle({ className }: { className: string }) {
  const on = useSeason() === 'halloween'
  return (
    <button
      className={`${className} ${on ? '!bg-[#e8761c] !text-white' : ''}`}
      onClick={() => useSeasonSettings.getState().setPreview(on ? 'none' : 'halloween')}
      aria-pressed={on}
      aria-label={on ? 'Quitar el tema de Halloween' : 'Ver el mall con tema de Halloween'}
    >
      <Ghost className="size-4" /> {on ? 'Quitar Halloween' : 'Tema Halloween'}
    </button>
  )
}

/** Deja quieto el barco pirata en el muelle o lo pone a navegar alrededor de la fortaleza. */
function PirateToggle({ className }: { className: string }) {
  const parked = usePirateShip((s) => s.parked)
  const setParked = usePirateShip((s) => s.setParked)
  return (
    <button
      className={className}
      onClick={() => setParked(!parked)}
      aria-pressed={parked}
      aria-label={parked ? 'Poner a navegar el barco pirata' : 'Dejar quieto el barco pirata en el muelle'}
    >
      {parked ? <Sailboat className="size-4" /> : <Anchor className="size-4" />} {parked ? 'Barco pirata: navegar' : 'Barco pirata: quieto'}
    </button>
  )
}

/** Muestra u oculta el aeropuerto y la Isla Tecnología (con sus vuelos). */
function AirportToggle({ className }: { className: string }) {
  const enabled = useAirportFeature((s) => s.enabled)
  const setEnabled = useAirportFeature((s) => s.setEnabled)
  return (
    <button
      className={enabled ? `${className} !bg-deep/85 !text-white` : className}
      aria-pressed={enabled}
      aria-label={enabled ? 'Ocultar el aeropuerto y la Isla Tecnología' : 'Mostrar el aeropuerto y la Isla Tecnología'}
      onClick={() => {
        const on = !enabled
        if (!on) {
          // al apagarlo: de vuelta al mall, sin vuelo en curso ni ventanas del aeropuerto
          useFlight.getState().cancel()
          useFlight.setState({ world: 'mall', step: null, returnOpen: false })
          useUI.getState().openAirport(false)
          useUI.getState().setOverview(true)
        } else useUI.getState().requestFocus({ kind: 'airport' })
        setEnabled(on)
      }}
    >
      <Plane className="size-4" /> {enabled ? 'Aeropuerto: ocultar' : 'Aeropuerto: mostrar'}
    </button>
  )
}

/** Muestra u oculta la Isla de Entretenimiento (locales, pista y puente) para todos los visitantes. */
function EntertainmentToggle({ className }: { className: string }) {
  const enabled = useEntertainmentFeature((s) => s.enabled)
  const setEnabled = useEntertainmentFeature((s) => s.setEnabled)
  return (
    <button
      className={enabled ? `${className} !bg-deep/85 !text-white` : className}
      aria-pressed={enabled}
      aria-label={enabled ? 'Ocultar la Isla de Entretenimiento' : 'Mostrar la Isla de Entretenimiento'}
      onClick={() => {
        const on = !enabled
        const ui = useUI.getState()
        if (!on) {
          // al apagarla: se cierran sus fichas y paneles y se vuelve a la vista general
          ui.openTrack(false)
          const sel = ui.selectedSpaceId
          if (sel === 'PISTA' || sel?.startsWith('P1-G')) ui.selectSpace(null)
          ui.setOverview(true)
        }
        setEnabled(on)
        if (on) ui.requestFocus({ kind: 'zone', id: 'G' })
      }}
    >
      <Gamepad2 className="size-4" /> {enabled ? 'Entretenimiento: ocultar' : 'Entretenimiento: mostrar'}
    </button>
  )
}

/** Administración: cambia el estado del estadio para todos (en obra → casi terminado → inaugurado). */
function StadiumToggle({ className }: { className: string }) {
  const phase = useStadiumPhase((s) => s.phase)
  const setPhase = useStadiumPhase((s) => s.setPhase)
  const idx = PHASES.findIndex((p) => p.id === phase)
  const next = PHASES[(idx + 1) % PHASES.length]
  return (
    <button
      className={className}
      aria-label={`Estadio: ${phaseInfo(phase).label}. Cambiar a ${next.label}`}
      onClick={() => {
        if (next.id !== 'open') stopStadiumSound()
        setPhase(next.id)
        useUI.getState().requestFocus({ kind: 'stadium' })
        useUI.getState().toast(`Estadio: ${next.label}. ${next.note}`, 'success')
      }}
    >
      <HardHat className="size-4" /> Estadio: {phaseInfo(phase).short}
    </button>
  )
}

/** Administración: con el estadio inaugurado, elige si hoy hay partido de fútbol o concierto. */
function StadiumEventToggle({ className }: { className: string }) {
  const phase = useStadiumPhase((s) => s.phase)
  const kind = useStadiumEvent((s) => s.kind)
  const setKind = useStadiumEvent((s) => s.setKind)
  if (phase !== 'open') return null
  const next = EVENT_KINDS.find((k) => k.id !== kind) ?? EVENT_KINDS[0]
  return (
    <button
      className={className}
      aria-label={`Evento del estadio: ${EVENT_KINDS.find((k) => k.id === kind)?.label}. Cambiar a ${next.label}`}
      onClick={() => {
        stopStadiumSound()
        setKind(next.id)
        useUI.getState().requestFocus({ kind: 'stadium' })
        useUI.getState().toast(`Estadio: ${next.label}.`, 'success')
      }}
    >
      <Music2 className="size-4" /> Evento: {kind === 'concert' ? 'Concierto' : 'Partido'}
    </button>
  )
}

/**
 * Botón junto al estadio, a la derecha: aparece cuando la persona se acerca al estadio. Inaugurado: «Escuchar el
 * estadio» lo enciende (canción, luces, hinchada y partido). En obra: «Escuchar obras» pone el pitido de las
 * grúas y el ruido de la construcción.
 */
function StadiumListenButton() {
  const phase = useStadiumPhase((s) => s.phase)
  const playing = useStadiumSound((s) => s.playing)
  const works = useStadiumSound((s) => s.works)
  const toast = useUI((s) => s.toast)
  const [near, setNear] = useState(false)
  const [closeUp, setCloseUp] = useState(false)
  const open = phase === 'open'
  const on = open ? playing : works
  // el mapa vive fuera de React: se mira la cámara varias veces por segundo
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = cameraState.target
      const d = Math.hypot(t.x - STADIUM.center[0], t.z - STADIUM.center[1])
      const ratio = cameraState.zoom / cameraState.fitZoom
      setNear(d < 30 && ratio >= 0.95)
      // con mucho zoom el botón se quita para no tapar la escena (el sonido sigue; se apaga al alejar)
      setCloseUp(ratio > 2.4)
    }, 250)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    // al cambiar de estado se apaga lo que sonaba
    stopStadiumSound()
  }, [phase])
  useEffect(() => () => stopStadiumSound(), [])
  const concert = useStadiumEvent((s) => s.kind) === 'concert'
  const isAdmin = useSession((s) => s.isAdmin)
  const canTest = isAdmin || !remoteEnabled()
  const noun = concert ? 'el concierto' : 'el estadio'
  const label = open ? (on ? `Apagar ${noun}` : `Escuchar ${noun}`) : on ? 'Parar las obras' : 'Escuchar obras'
  const show = (near || on) && !closeUp
  // Solo el ícono, en la esquina superior derecha: no tapa el estadio ni la gente.
  return (
    <div
      className={`pointer-events-none absolute top-[calc(var(--chrome-top)+104px)] right-3 z-20 flex flex-col items-end transition duration-300 md:top-[calc(var(--chrome-top)+96px)] md:right-5 ${show ? 'opacity-100' : 'scale-90 opacity-0'}`}
      aria-hidden={!show}
    >
      <button
        tabIndex={show ? 0 : -1}
        onClick={async () => {
          const ok = await (open ? toggleStadiumSound() : toggleWorksSound())
          if (!ok) toast('El audio todavía no está disponible.', 'error')
        }}
        aria-pressed={on}
        aria-label={label}
        title={label}
        className={`glass pointer-events-auto relative grid size-11 place-items-center rounded-full text-white shadow-soft transition active:scale-95 ${show ? '' : 'pointer-events-none'}`}
        style={{ background: on ? '#c8553b' : open ? '#22a05a' : '#e8832a' }}
      >
        {on && <span className="absolute inset-0 rounded-full ring-2 ring-white/70 motion-safe:animate-ping" aria-hidden />}
        {on ? (
          <VolumeX className="relative size-5" strokeWidth={2.2} />
        ) : open ? (
          <Volume2 className="relative size-5" strokeWidth={2.2} />
        ) : (
          <HardHat className="relative size-5" strokeWidth={2.2} />
        )}
      </button>
      <button
        tabIndex={show ? 0 : -1}
        onClick={() => useUI.getState().openStadium(true)}
        aria-label="Eventos y boletas del estadio"
        title="Eventos y boletas"
        className={`glass pointer-events-auto mt-2 grid size-11 place-items-center rounded-full bg-ink text-white shadow-soft transition active:scale-95 ${show ? '' : 'pointer-events-none'}`}
      >
        <Ticket className="size-5" strokeWidth={2.2} />
      </button>
      {/* solo para la administración: ver y oír un gol de prueba (solo en este dispositivo, no toca el marcador de todos) */}
      {canTest && open && !concert && (
        <button
          tabIndex={show ? 0 : -1}
          onClick={() => previewGoal()}
          aria-label="Probar un gol"
          title="Probar un gol (solo lo ves y oyes tú)"
          className={`glass pointer-events-auto mt-2 grid size-11 place-items-center rounded-full bg-coral text-white shadow-soft transition active:scale-95 ${show ? '' : 'pointer-events-none'}`}
        >
          <PartyPopper className="size-5" strokeWidth={2.2} />
        </button>
      )}
    </div>
  )
}
