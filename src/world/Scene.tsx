import { openCourtOrClaim, useCourtOperator } from '../football/open'
import { ARCADE_ZONE, JOYERIA } from '../config/preview'
import { JewelryZone } from './JewelryZone'
import { isServicesSpace, useServicesFeature } from '../state/servicesFeature'
import { useCine } from '../state/cine'
import { Cinema } from './Cinema'
import { useEffect, useMemo, useState } from 'react'
import { detectProfile } from '../lib/deviceProfile'
import { useEntry } from '../state/entry'
import { COURT_SPACE, FLOORS, FLOOR_BY_ID, FLOOR_OF_ZONE, SPACES, SPACE_BY_ID, ZONES, ZONE_BY_ID } from '../config/mall'
import type { FloorConfig, Product, SpaceSlot } from '../domain/types'
import { isPromotionLive } from '../lib/pricing'
import { useMinute } from '../lib/useMinute'
import { useMediaQuery } from '../lib/useMedia'
import { useCatalog } from '../state/catalog'
import { canPreview, usePreviewMall, useWorldCatalog } from '../state/previewMall'
import { GeorgesCafe } from './GeorgesCafe'
import { CustomStore, thatchRise } from './CustomStore'
import { CustomKiosk } from './CustomKiosk'
import { cleanDesign } from './localDesign'
import { GEORGES_STORE_ID } from '../data/businesses'
import { getGlassPill } from './labelTexture'
import { ScreenLabel } from './Billboard'
import { LABEL_PRIORITY } from './labels'
import { storeCategoryName } from '../lib/storeCategories'
import { useClaims } from '../state/claims'
import { usePersonal } from '../state/personal'
import { usePrefs, useUI, type Quality } from '../state/ui'
import { CrossAmbient, GlobalAmbient } from './Ambient'
import { Batch, BatchScope } from './Batch'
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
import { ArcadeZone } from './ArcadeZone'
import { Entertainment } from './Entertainment'
import { Airport } from './Airport'
import { MallToStadium, Stadium, StairFans } from './Stadium'
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
import { VeneplastAnchorStore } from './VeneplastAnchorStore'

function modeFor(floor: FloorConfig, active: FloorConfig, overview: boolean): FloorMode {
  if (overview || floor.id === active.id) return 'full'
  return floor.level < active.level ? 'shell' : 'hidden'
}

/** Espacio de la zona de comida (Piso 2) donde está George's. */
const GEORGES_SPACE = 'E-02'

export function Scene({ quality, night }: { quality: Quality; night: boolean }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const season = useSeason()
  const airportOn = useAirportFeature((s) => s.enabled)
  const entOn = useEntertainmentFeature((s) => s.enabled)
  const svcOn = useServicesFeature((s) => s.enabled)
  const cineOn = useCine((s) => s.enabled)
  // el catálogo del mundo incluye, con el modo «mall lleno» de la administración, negocios inventados en los espacios libres
  const { assignments, products, storeById, spaceByStore } = useWorldCatalog()
  const promotions = useCatalog((s) => s.promotions)
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
    for (const sp of SPACES) if ((entOn || sp.zoneId !== 'G') && (svcOn || !isServicesSpace(sp)) && !storeById[assignments[sp.id]] && sp.label !== GEORGES_SPACE) (m[sp.zoneId] ??= []).push(sp)
    return m
  }, [assignments, storeById, entOn, svcOn])

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
      // un local inventado por el modo «mall lleno» no tiene ficha: se avisa y no se abre nada
      if (usePreviewMall.getState().full && canPreview()) {
        const real = useCatalog.getState()
        if (!real.stores.some((st) => st.id === real.assignments[spaceId]) && space.label !== 'D-05') {
          ui.toast('Local de prueba del modo «mall lleno»: no existe de verdad.')
          return
        }
      }
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
  const stage = useBuildStage()

  const renderFloor = (floor: FloorConfig) => {
          const mode = modeFor(floor, active, overview)
          const interactive = mode === 'full'
          const spaces = SPACES.filter((s) => s.floorId === floor.id && (entOn || s.zoneId !== 'G') && (svcOn || !isServicesSpace(s)))
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
                    // local armado a medida desde la administración («Arma tu local»); las islas conservan su mostrador
                    const cd = store && store.id !== GEORGES_STORE_ID ? cleanDesign(store.design) : null
                    const isIsland = space.type === 'island'
                    const custom = cd && (cd.form === 'island') === isIsland ? cd : null
                    if (store && custom)
                      return (
                        <group key={space.id} position={[space.position[0], 0.2, space.position[1]]} rotation={[0, space.rotation, 0]}>
                          {isIsland ? (
                            <CustomKiosk store={store} design={custom} interactive={interactive} onOpen={() => onSelect(space.id)} />
                          ) : (
                            <CustomStore store={store} design={custom} width={space.size[0]} depth={space.size[1]} interactive={interactive} onOpen={() => onSelect(space.id)} />
                          )}
                          <ScreenLabel
                            label={getGlassPill(store.name, { dot: store.brandColor, sub: storeCategoryName(store), logo: store.logo, dark: night })}
                            position={[0, isIsland ? 4.9 : custom.roof === 'thatch' || custom.roof === 'thatchfin' ? 3.9 + thatchRise(space.size[0]) + 1.3 : 6.1, 0]}
                            pixelHeight={selectedSpaceId === space.id ? 44 : 40}
                            minZoomRatio={0}
                            maxZoomRatio={2.4}
                            lit
                            priority={selectedSpaceId === space.id ? LABEL_PRIORITY.selected : LABEL_PRIORITY.store}
                            onClick={interactive ? () => onSelect(space.id) : undefined}
                          />
                        </group>
                      )
                    // George's es una tienda real: edificio propio, ficha arriba y su menú al tocarlo
                    if (store?.id === GEORGES_STORE_ID)
                      return (
                        <group key={space.id} position={[space.position[0], 0.2, space.position[1]]} rotation={[0, space.rotation, 0]}>
                          <GeorgesCafe interactive={interactive} onOpen={() => onSelect(space.id)} />
                          <ScreenLabel
                            label={getGlassPill(store.name, { dot: store.brandColor, sub: storeCategoryName(store), logo: store.logo, dark: night })}
                            position={[0, 6.1, 0]}
                            pixelHeight={selectedSpaceId === space.id ? 44 : 40}
                            minZoomRatio={0}
                            maxZoomRatio={2.4}
                            lit
                            priority={selectedSpaceId === space.id ? LABEL_PRIORITY.selected : LABEL_PRIORITY.store}
                            onClick={interactive ? () => onSelect(space.id) : undefined}
                          />
                        </group>
                      )
                    // respaldo: mientras George's no esté cargado en la base de datos, E-02 muestra el edificio con un aviso
                    if (space.label === GEORGES_SPACE && !store)
                      return (
                        <group key={space.id} position={[space.position[0], 0.2, space.position[1]]} rotation={[0, space.rotation, 0]}>
                          <GeorgesCafe interactive={interactive} onOpen={() => useUI.getState().toast("George's · cafetería de especialidad. ¡Muy pronto en MallPlay!")} />
                        </group>
                      )
                    // D-05 (local premium del Pasillo D): tienda ancla Veneplast
                    if (space.label === 'D-05')
                      return (
                        <group key={space.id} position={[space.position[0], 0.2, space.position[1]]} rotation={[0, space.rotation, 0]}>
                          <VeneplastAnchorStore width={9.8} depth={6.2} interactive={interactive} animateVisitors={!reduceMotion} onOpen={() => onSelect(space.id)} />
                        </group>
                      )
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
  }

  return (
    <>
      <Lighting night={night} shadows={shadows} quality={quality} />
      <CameraRig />
      <group dispose={null}>
        {/* Etapa 0: lo primero que se ve al entrar (la fortaleza y el piso 1). Cada etapa tiene su propio BatchScope: fusionar una no repite el trabajo de las otras. */}
        <BatchScope>
          <FortressEnvironment onEnter={() => useUI.getState().enterMall()} sparse={quality === 'low'} />
          {FLOORS.filter((f) => f.id === 'P1').map(renderFloor)}
        </BatchScope>
        {/* Etapa 1: el entorno cercano */}
        {stage >= 1 && (
          <BatchScope>
            <Harbor reduceMotion={reduceMotion} />
            <Stadium reduceMotion={reduceMotion} quality={quality} />
            <StairFans reduceMotion={reduceMotion} />
            <MallToStadium reduceMotion={reduceMotion} />
            <Batch version="jardines">
              <Diorama />
            </Batch>
          </BatchScope>
        )}
        {/* Etapa 2: las demás zonas */}
        {stage >= 2 && (
          <BatchScope>
            {entOn && <Entertainment reduceMotion={reduceMotion} />}
            {entOn && ARCADE_ZONE && <ArcadeZone reduceMotion={reduceMotion} />}
            {airportOn && <Airport reduceMotion={reduceMotion} />}
            {airportOn && <Island reduceMotion={reduceMotion} />}
            <District reduceMotion={reduceMotion} />
            {JOYERIA && <JewelryZone services={svcOn} />}
            {cineOn && <Cinema />}
            {season === 'halloween' && <Halloween reduceMotion={reduceMotion} />}
          </BatchScope>
        )}
        {/* Etapa 3: el piso 2 y los visitantes que usan las escaleras */}
        {stage >= 3 && (
          <BatchScope>
            <GlobalAmbient detail={quality === 'high' ? 'high' : 'low'} />
            {/* visitantes que recorren ambos pisos y usan las escaleras (fuera de MallFloor: cambian de piso) */}
            {quality !== 'low' && <Travelers count={quality === 'high' ? 22 : 10} />}
            {FLOORS.filter((f) => f.id !== 'P1').map(renderFloor)}
          </BatchScope>
        )}

      </group>
    </>
  )
}

/** Etapas en que se monta el mundo: 0 = fortaleza y piso 1 · 1 = entorno cercano · 2 = demás zonas · 3 = piso 2 y visitantes. */
const BUILD_STAGES = 3

/**
 * Construir todo el mundo de una vez bloquea el teléfono varios segundos antes del primer cuadro. En equipos que no son potentes se monta
 * por etapas: primero lo que se ve al entrar y, cuando ya se dibujaron los primeros cuadros, el resto de a poco (una etapa por turno,
 * con un respiro entre ellas para que se siga dibujando y respondiendo a los toques). En equipos potentes se monta todo junto.
 */
function useBuildStage(): number {
  const ready = useEntry((s) => s.worldReady)
  const staged = useMemo(() => detectProfile().tier !== 'high', [])
  const [stage, setStage] = useState(staged ? 0 : BUILD_STAGES)
  useEffect(() => {
    if (!staged || !ready || stage >= BUILD_STAGES) return
    const t = window.setTimeout(() => setStage((n) => n + 1), stage === 0 ? 300 : 150)
    return () => clearTimeout(t)
  }, [staged, ready, stage])
  return stage
}

const EMPTY: Product[] = []
const EMPTY_SPACES: SpaceSlot[] = []
