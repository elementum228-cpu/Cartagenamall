import { openCourtOrClaim, useCourtOperator } from '../football/open'
import { useMemo } from 'react'
import { COURT_SPACE, FLOORS, FLOOR_BY_ID, FLOOR_OF_ZONE, SPACES, SPACE_BY_ID, ZONES, ZONE_BY_ID } from '../config/mall'
import type { FloorConfig, Product, SpaceSlot } from '../domain/types'
import { isPromotionLive } from '../lib/pricing'
import { useMinute } from '../lib/useMinute'
import { useMediaQuery } from '../lib/useMedia'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useClaims } from '../state/claims'
import { usePersonal } from '../state/personal'
import { usePrefs, useUI, type Quality } from '../state/ui'
import { CrossAmbient, GlobalAmbient } from './Ambient'
import { Batch } from './Batch'
import { CameraRig } from './CameraRig'
import { Decor } from './Decor'
import { Escalators } from './Escalator'
import { FoodCourtDetail, FoodCourtLabels, FoodCourtShell } from './FoodCourt'
import { useLabelDeclutter } from './labels'
import { Lighting } from './Lighting'
import { CrossLabels, CrossShell, Diorama } from './MallStructure'
import { FortressEnvironment } from './Fortress'
import { useAirportFeature } from '../state/airportFeature'
import { useEntertainmentFeature } from '../state/entertainmentFeature'
import { Entertainment } from './Entertainment'
import { Airport } from './Airport'
import { Stadium } from './Stadium'
import { Island } from './Island'
import { Harbor } from './Harbor'
import { District } from './District'
import { Halloween } from './Halloween'
import { useSeason } from '../state/season'
import { MallFloor, type FloorMode } from './MallFloor'
import { SecretMarkers } from './SecretMarkers'
import { TreasureMarkers } from './TreasureMarkers'
import { Shoppers } from './Shoppers'
import { Travelers } from './Travelers'
import { TechDistrictDecor } from './TechDistrict'
import { FootballCourt } from './football/FootballCourt'
import { FootballMatchController } from './football/FootballMatchController'
import { PadelMatchController } from './football/PadelMatchController'
import { PromoSpotlights } from './PromoSpotlight'
import { MallPathLighting } from './MallPathLighting'
import { PATH_LIGHTS } from './pathLights'
import { usePromoEvents } from '../promotions/store'
import { AvailableOutlines, SpaceUnit } from './SpaceUnit'

function modeFor(floor: FloorConfig, active: FloorConfig, overview: boolean): FloorMode {
  if (overview || floor.id === active.id) return 'full'
  return floor.level < active.level ? 'shell' : 'hidden'
}

export function Scene({ quality, night }: { quality: Quality; night: boolean }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const season = useSeason()
  const airportOn = useAirportFeature((s) => s.enabled)
  const entOn = useEntertainmentFeature((s) => s.enabled)
  const assignments = useCatalog((s) => s.assignments)
  const products = useCatalog((s) => s.products)
  const promotions = useCatalog((s) => s.promotions)
  const { storeById, spaceByStore } = useCatalogMaps()
  const claims = useClaims((s) => s.claims)
  const selectedSpaceId = useUI((s) => s.selectedSpaceId)
  const activeFloor = useUI((s) => s.activeFloor)
  const overview = useUI((s) => s.overview)
  const openSecret = useUI((s) => s.openSecret)
  const saved = usePersonal((s) => s.savedSecrets)
  // Solo hace falta saber el minuto (vencimiento de ofertas): re-renderizar la escena cada segundo
  // era caro y reconectaba los controles de cámara en medio de un arrastre.
  const minute = useMinute()
  useLabelDeclutter()

  const productsByStore = useMemo(() => {
    const m: Record<string, Product[]> = {}
    for (const p of products) (m[p.storeId] ??= []).push(p)
    return m
  }, [products])

  const availableByZone = useMemo(() => {
    const m: Record<string, SpaceSlot[]> = {}
    for (const sp of SPACES) if ((entOn || sp.zoneId !== 'G') && !storeById[assignments[sp.id]]) (m[sp.zoneId] ??= []).push(sp)
    return m
  }, [assignments, storeById, entOn])

  const pendingSpaces = useMemo(() => new Set(claims.filter((c) => c.status === 'pending').map((c) => c.spaceId)), [claims])
  const secretPromos = useMemo(() => promotions.filter((p) => p.type === 'secret' && isPromotionLive(p, minute)), [promotions, minute])
  // Descuento relámpago vigente por tienda (señal sobre su local) y el momento en que su oferta se
  // presentó (el cartel salta). Sale de los eventos, que se actualizan cada segundo.
  const events = usePromoEvents((s) => s.events)
  const { flashByStore, popByStore } = useMemo(() => {
    const flash: Record<string, number> = {}
    const pop: Record<string, number> = {}
    for (const e of events) {
      if (e.type !== 'flash' || e.status !== 'active') continue
      flash[e.storeId] = Math.max(flash[e.storeId] ?? 0, e.discount)
      if (e.spotlight === 'playing' && e.spotlightStart !== null) pop[e.storeId] = e.spotlightStart
    }
    return { flashByStore: flash, popByStore: pop }
  }, [events, reduceMotion])

  /** Mensajes de las pantallas del pasillo de tecnología: ofertas relámpago vigentes de sus tiendas. */
  const techOffers = useMemo(
    () =>
      events
        .filter((e) => e.type === 'flash' && e.status === 'active' && SPACE_BY_ID[e.spaceId]?.zoneId === 'B')
        .map((e) => ({ title: `−${e.discount}% ${storeById[e.storeId]?.name ?? ''}`.trim(), sub: 'Oferta relámpago · tócala en su local' })),
    [events, storeById],
  )

  const courtOpen = useUI((s) => s.courtOpen)
  const courtOperator = useCourtOperator()
  const courtPending = useClaims((s) => s.claims.some((c) => c.spaceId === COURT_SPACE.id && c.status === 'pending'))
  const openCourtPanel = useMemo(
    () => () => {
      openCourtOrClaim()
      usePrefs.getState().setHintSeen()
    },
    [],
  )

  const onSelect = useMemo(
    () => (spaceId: string) => {
      const ui = useUI.getState()
      const space = SPACE_BY_ID[spaceId]
      // Tocar un local de otro piso (vista general) lleva a ese piso.
      if (ui.overview || space.floorId !== ui.activeFloor) ui.setFloor(space.floorId)
      // celular: primero la ficha breve sobre el mapa; escritorio: la ficha completa al lado
      if (window.matchMedia('(min-width: 768px)').matches) ui.selectSpace(spaceId)
      else ui.peekSpace(spaceId)
      ui.requestFocus({ kind: 'space', id: spaceId })
      usePrefs.getState().setHintSeen()
    },
    [],
  )

  const shadows = quality === 'high'
  // Detalle de locales y mobiliario: solo la calidad baja lo reduce (nunca quita tiendas).
  const detail = quality === 'low' ? 'low' : 'high'
  const active = FLOOR_BY_ID[activeFloor]

  return (
    <>
      <Lighting night={night} shadows={shadows} quality={quality} />
      <CameraRig />
      <group dispose={null}>
        <FortressEnvironment onEnter={() => useUI.getState().enterMall()} sparse={quality === 'low'} />
        <Harbor reduceMotion={reduceMotion} />
        {entOn && <Entertainment reduceMotion={reduceMotion} />}
        {airportOn && <Airport reduceMotion={reduceMotion} />}
        <Stadium reduceMotion={reduceMotion} quality={quality} />
        {airportOn && <Island reduceMotion={reduceMotion} />}
        <District reduceMotion={reduceMotion} />
        {season === 'halloween' && <Halloween reduceMotion={reduceMotion} />}
        <Batch version="jardines">
          <Diorama />
        </Batch>
        <GlobalAmbient detail={quality === 'high' ? 'high' : 'low'} />
        {/* visitantes que recorren ambos pisos y usan las escaleras (fuera de MallFloor: cambian de piso) */}
        {quality !== 'low' && <Travelers count={quality === 'high' ? 14 : 6} />}
        {FLOORS.map((floor) => {
          const mode = modeFor(floor, active, overview)
          const interactive = mode === 'full'
          const spaces = SPACES.filter((s) => s.floorId === floor.id && (entOn || s.zoneId !== 'G'))
          const cross = floor.layout === 'cross'
          return (
            <MallFloor
              key={floor.id}
              floor={floor}
              mode={mode}
              overview={overview}
              shell={
                cross ? (
                  <>
                    <CrossShell />
                    <Escalators showUpSign={interactive} />
                  </>
                ) : (
                  <FoodCourtShell />
                )
              }
              detail={
                <>
                  {cross ? (
                    <>
                      <Decor shadows={shadows} sparse={quality === 'low'} />
                      <CrossAmbient />
                      {quality !== 'low' && <Shoppers maxReacting={reduceMotion ? 0 : quality === 'high' ? 15 : 6} />}
                      <CrossLabels />
                      <FootballCourt
                        selected={courtOpen || selectedSpaceId === COURT_SPACE.id}
                        interactive={interactive}
                        onOpen={openCourtPanel}
                        operator={courtOperator?.name ?? null}
                        pending={courtPending}
                      />
                      {/* partido solo con un negocio operando la cancha; libre, se ve vacía */}
                      {courtOperator && <FootballMatchController quality={quality} reduceMotion={reduceMotion} court={0} />}
                      {courtOperator && <PadelMatchController quality={quality} reduceMotion={reduceMotion} court={1} />}
                      <TechDistrictDecor zoneId="B" angle={ZONE_BY_ID.B.angle} offers={techOffers} />
                    </>
                  ) : (
                    <>
                      <FoodCourtDetail detail={detail} crowd={reduceMotion ? 0 : quality === 'high' ? 8 : quality === 'medium' ? 6 : 4} />
                      <FoodCourtLabels />
                    </>
                  )}
                  {spaces.map((space) => {
                    const store = storeById[assignments[space.id]] ?? null
                    return (
                      <SpaceUnit
                        key={space.id}
                        space={space}
                        store={store}
                        products={store ? productsByStore[store.id] ?? [] : EMPTY}
                        zoneColor={ZONE_BY_ID[space.zoneId].color}
                        selected={selectedSpaceId === space.id}
                        pendingClaim={pendingSpaces.has(space.id)}
                        detail={detail}
                        interactive={interactive}
                        flashPercent={store ? flashByStore[store.id] : undefined}
                        promoPopAt={store ? popByStore[store.id] : undefined}
                        onSelect={onSelect}
                      />
                    )
                  })}
                  {ZONES.filter((z) => FLOOR_OF_ZONE[z.id] === floor.id).map((z) => (
                    <AvailableOutlines key={z.id} color={z.color} spaces={availableByZone[z.id] ?? EMPTY_SPACES} />
                  ))}
                  <MallPathLighting lights={PATH_LIGHTS} floorId={floor.id} boost={quality === 'high' ? 1 : quality === 'medium' ? 1.15 : 1.4} />
                  <PromoSpotlights floorId={floor.id} reduceMotion={reduceMotion} onOpen={onSelect} />
                  <SecretMarkers
                    floorId={floor.id}
                    promos={secretPromos}
                    spaceByStore={spaceByStore}
                    hidden={saved}
                    interactive={interactive}
                    onOpen={(id) => openSecret(id)}
                  />
                  <TreasureMarkers floorId={floor.id} interactive={interactive} now={minute} />
                </>
              }
            />
          )
        })}
      </group>
    </>
  )
}

const EMPTY: Product[] = []
const EMPTY_SPACES: SpaceSlot[] = []
