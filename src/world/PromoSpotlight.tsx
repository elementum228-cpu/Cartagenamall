import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SPACE_BY_ID } from '../config/mall'
import type { FloorId } from '../domain/types'
import { appClock } from '../lib/clock'
import { usePromoEvents } from '../promotions/store'
import { SPOTLIGHT_MS } from '../promotions/events'
import { useCatalog } from '../state/catalog'
import { ScreenLabel } from './Billboard'
import { getPromoBanner } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO } from './materials'

// Presentación de una oferta relámpago en su local mientras dura el evento: el local se ilumina
// (interior, fachada, halo en el piso y un haz de luz que se ve de lejos), borde dorado, un destello,
// un anillo que se abre una vez y un cartel grande con la oferta que se puede tocar.
// Solo materiales básicos (sin luces dinámicas ni partículas) y opacidades suaves, sin
// parpadeo. Con movimiento reducido el borde aparece y se apaga sin pulsos ni destello.

const GLOW = '#ffb02e'

let poolTexture: THREE.CanvasTexture | null = null
function pool() {
  if (poolTexture) return poolTexture
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  poolTexture = new THREE.CanvasTexture(c)
  return poolTexture
}

let starTexture: THREE.CanvasTexture | null = null
function star() {
  if (starTexture) return starTexture
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,248,220,1)')
  g.addColorStop(0.25, 'rgba(255,214,130,0.55)')
  g.addColorStop(1, 'rgba(255,214,130,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = 'rgba(255,250,235,0.95)'
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 9 : 60
    const a = (i / 8) * Math.PI * 2
    ctx.lineTo(64 + Math.sin(a) * r, 64 + Math.cos(a) * r)
  }
  ctx.fill()
  starTexture = new THREE.CanvasTexture(c)
  starTexture.colorSpace = THREE.SRGBColorSpace
  return starTexture
}

// Mezcla normal con un dorado saturado: se ve de día sobre fachadas claras y, sin tone mapping, brilla
// de noche. El destello sí es aditivo (es luz).
const glowMat = (opts: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, ...opts })

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function PromoSpotlights({ floorId, reduceMotion, onOpen }: { floorId: FloorId; reduceMotion: boolean; onOpen: (spaceId: string) => void }) {
  const event = usePromoEvents((s) => s.events.find((e) => e.floorId === floorId && e.spotlight === 'playing'))
  const promo = useCatalog((s) => s.promotions.find((p) => p.id === event?.promotionId))
  const product = useCatalog((s) => s.products.find((p) => p.id === promo?.productId))
  const store = useCatalog((s) => s.stores.find((st) => st.id === event?.storeId))
  if (!event || event.spotlightStart === null) return null
  return (
    <Spotlight
      key={event.id}
      spaceId={event.spaceId}
      start={event.spotlightStart}
      reduceMotion={reduceMotion}
      banner={getPromoBanner(event.discount, product?.name ?? event.title, store?.name ?? '')}
      onOpen={() => onOpen(event.spaceId)}
    />
  )
}

function Spotlight({
  spaceId,
  start,
  reduceMotion,
  banner,
  onOpen,
}: {
  spaceId: string
  start: number
  reduceMotion: boolean
  banner: ReturnType<typeof getPromoBanner>
  onOpen: () => void
}) {
  const space = SPACE_BY_ID[spaceId]
  const [w, d] = space.size
  const island = space.type === 'island'
  const H = space.type === 'premium' ? 3.4 : 2.6
  const mats = useMemo(
    () => ({
      frame: glowMat(),
      ring: glowMat({ side: THREE.DoubleSide }),
      sparkle: glowMat({ map: star(), color: '#ffffff', blending: THREE.AdditiveBlending }),
      // luz del local: aditiva y cálida (aclara lo que hay detrás, de día y de noche)
      interior: glowMat({ color: '#ffc96b', blending: THREE.AdditiveBlending }),
      wash: glowMat({ color: '#ffd98a', blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      pool: glowMat({ map: pool(), color: '#ffbf4a' }),
      beam: glowMat({ color: '#ffe2a0', blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    }),
    [],
  )
  const ring = useRef<THREE.Mesh>(null)
  const sparkle = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const t = (appClock.now() - start) / 1000
    const total = SPOTLIGHT_MS / 1000
    const envelope = smooth(t / 0.8) * (1 - smooth((t - (total - 2)) / 2))
    // pulso lento y suave (≈0.5 Hz, ±20 %): llama la atención sin destellos
    const pulse = reduceMotion ? 1 : 0.8 + 0.2 * Math.sin(t * Math.PI)
    mats.frame.opacity = 0.95 * envelope * pulse
    mats.interior.opacity = 0.32 * envelope * pulse
    mats.wash.opacity = 0.22 * envelope * pulse
    mats.pool.opacity = 0.55 * envelope
    mats.beam.opacity = 0.08 * envelope
    // anillo: se abre una vez al comenzar
    const u = reduceMotion ? 1 : smooth(t / 1.6)
    if (ring.current) ring.current.scale.setScalar((island ? 1.6 : 2.4) * (0.55 + 0.6 * u))
    mats.ring.opacity = reduceMotion ? 0.35 * envelope : 0.55 * (1 - u) * envelope + 0.18 * envelope
    // destello: aparece y se va una sola vez
    const s = reduceMotion ? 0 : Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.3) / 1.1)))
    if (sparkle.current) sparkle.current.scale.setScalar(0.05 + 1.3 * s)
    mats.sparkle.opacity = s
  })

  const bar = 0.09
  const front = d / 2 + 0.06
  return (
    <group position={[space.position[0], 0.2, space.position[1]]} rotation={[0, space.rotation, 0]}>
      {!island && (
        <group position={[0, 0, front]}>
          <mesh geometry={GEO.box} material={mats.frame} position={[0, H, 0]} scale={[w + 0.2, bar, bar]} />
          <mesh geometry={GEO.box} material={mats.frame} position={[0, 0.12, 0]} scale={[w + 0.2, bar, bar]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={GEO.box} material={mats.frame} position={[s * (w / 2 + 0.06), H / 2 + 0.06, 0]} scale={[bar, H - 0.05, bar]} />
          ))}
        </group>
      )}
      {island && (
        <mesh geometry={GEO.box} material={mats.frame} position={[0, 2.85, -0.3]} scale={[1.62, 0.66, 1.62]} />
      )}
      {/* el local se ilumina: interior, fachada, halo al frente y haz de luz */}
      <mesh geometry={GEO.box} material={mats.interior} position={[0, (island ? 1.6 : H) / 2 + 0.05, island ? 0 : 0]} scale={island ? [2.7, 1.6, 2.7] : [w - 0.45, H - 0.2, d - 0.45]} />
      {!island && <mesh geometry={GEO.plane} material={mats.wash} position={[0, H / 2, front + 0.02]} scale={[w + 0.1, H, 1]} />}
      <mesh geometry={GEO.plane} material={mats.pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, island ? 0 : front + 1.4]} scale={island ? [5.5, 5.5, 1] : [w + 4, 5, 1]} />
      <mesh geometry={GEO.cylinder} material={mats.beam} position={[0, H + 5, island ? 0 : 0]} scale={[island ? 2.4 : Math.min(w, 7), 10, island ? 2.4 : Math.min(d, 6)]} />
      <ScreenLabel
        label={banner}
        position={[0, (space.type === 'premium' ? 5.6 : space.type === 'local' ? 4.6 : 3.8) + 0.8, 0]}
        pixelHeight={62}
        lit
        priority={LABEL_PRIORITY.selected - 1}
        popAt={reduceMotion ? null : start}
        onClick={onOpen}
        yieldExcept={spaceId}
      />
      <mesh ref={ring} geometry={GEO.ring} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, island ? 0 : front + 0.9]} />
      {!reduceMotion && (
        <Billboard position={island ? [0.8, 3.4, 0.6] : [w / 2 - 0.25, H + 0.25, front + 0.05]}>
          <mesh ref={sparkle} geometry={GEO.plane} material={mats.sparkle} renderOrder={11} />
        </Billboard>
      )}
    </group>
  )
}
