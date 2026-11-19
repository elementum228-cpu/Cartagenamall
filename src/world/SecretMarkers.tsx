import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import type { Promotion } from '../domain/types'
import { resolveHideSpot, type ResolvedSpot } from '../promotions/hideSpot'
import { cameraState } from './cameraState'
import { GEO, mat } from './materials'
import { lightPoolMat } from './night'
import { liveOrigins } from './floors'

/** Distancia (en unidades del mundo) a la que hay que acercarse para que aparezca la señal. */
const REVEAL_DISTANCE = 15
/** Además, la cámara debe estar al menos así de cerca respecto al encuadre general. */
const REVEAL_ZOOM_RATIO = 1.3

const HINT_COUNT = 6
/** Colores por tipo: gema dorada (oferta escondida) o turquesa (pista de la búsqueda del tesoro). */
const TONES = {
  gold: { gem: mat('#ff5a8a', { emissive: 0.35, rough: 0.4 }), ribbon: mat('#ffd45c', { emissive: 0.5, rough: 0.35 }), sparkle: mat('#fff3c4', { emissive: 0.9 }), pool: lightPoolMat('#ffcc4d', 0.9, 0.35) },
  treasure: { gem: mat('#13b9ad', { emissive: 0.4, rough: 0.35 }), ribbon: mat('#fff3c4', { emissive: 0.6, rough: 0.35 }), sparkle: mat('#d9fffb', { emissive: 0.95 }), pool: lightPoolMat('#5ef2e4', 0.9, 0.35) },
}
export type MarkerTone = keyof typeof TONES

/**
 * Oferta escondida: una gema que solo aparece cuando la persona explora de cerca su escondite (el
 * que eligió el comerciante, o junto a su local). No interrumpe: no abre nada sola, hay que tocarla.
 */
export function HiddenMarker({ id, spot, interactive, onOpen, tone = 'gold' }: { id: string; spot: ResolvedSpot; interactive: boolean; onOpen: (id: string) => void; tone?: MarkerTone }) {
  const { gem: gold, ribbon, sparkle, pool: SPOT } = TONES[tone]
  const [px, pz] = spot.at
  const group = useRef<THREE.Group>(null)
  const gem = useRef<THREE.Group>(null)
  const reveal = useRef(0)

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    // Posición en el mundo = origen actual del piso + posición en el piso.
    const origin = liveOrigins[spot.floorId]
    const dx = cameraState.target.x - cameraState.viewOffset.x - (origin.x + px)
    const dz = cameraState.target.z - cameraState.viewOffset.z - (origin.z + pz)
    const near = Math.hypot(dx, dz) < REVEAL_DISTANCE + spot.extent && cameraState.zoom > cameraState.fitZoom * REVEAL_ZOOM_RATIO
    reveal.current += ((near ? 1 : 0) - reveal.current) * Math.min(1, dt * 4)
    const s = reveal.current
    g.visible = s > 0.02
    g.scale.setScalar(s)
    const t = clock.elapsedTime
    g.position.y = 1.4 + Math.sin(t * 2.4) * 0.15
    if (gem.current) gem.current.rotation.y = Math.sin(t * 1.4) * 0.5
  })

  // Pista: destellos dorados sobre el escondite, visibles desde lejos mientras la gema sigue oculta.
  const hints = useRef<THREE.Group>(null)
  const hintY = spot.hintY
  const glow = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const h = hints.current
    if (!h) return
    const t = clock.elapsedTime
    const fade = 1 - reveal.current
    const show = fade > 0.05 && cameraState.zoom > cameraState.fitZoom * 0.95
    h.visible = show
    if (glow.current) {
      glow.current.visible = show
      glow.current.scale.setScalar((2.8 + Math.sin(t * 2) * 0.4) * fade)
    }
    if (!show) return
    h.children.forEach((c, i) => {
      const a = t * 0.7 + (i / HINT_COUNT) * Math.PI * 2
      const tw = Math.max(0, Math.sin(t * 3 + i * 1.9))
      c.position.set(Math.sin(a) * 1.4, hintY + Math.sin(t * 1.3 + i) * 0.5, Math.cos(a) * 1.4)
      c.scale.setScalar((0.2 + tw * 0.34) * fade)
      c.rotation.y = t * 2
    })
  })

  return (
    <group position={[px, 0, pz]}>
      <group ref={hints} position={[spot.hintAt[0] - px, 0, spot.hintAt[1] - pz]}>
        {Array.from({ length: HINT_COUNT }, (_, i) => (
          <mesh key={i} geometry={GEO.octa} material={sparkle} />
        ))}
      </group>
      <mesh ref={glow} geometry={GEO.plane} material={SPOT} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.26, 0]} />
      <group ref={group} visible={false}>
        {/* el regalo: caja con tapa, cinta en cruz y moño; se ve grande y brillante para encontrarlo fácil */}
        <group ref={gem} scale={1.5}>
          <mesh
            userData={{ secretGem: true }}
            geometry={GEO.rounded}
            material={gold}
            scale={[1, 0.8, 1]}
            position={[0, -0.1, 0]}
            castShadow
            onClick={(e) => {
              if (!interactive || cameraState.handMode || e.delta > 8 || reveal.current < 0.5) return
              e.stopPropagation()
              onOpen(id)
            }}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          />
          <mesh geometry={GEO.rounded} material={gold} scale={[1.1, 0.24, 1.1]} position={[0, 0.38, 0]} castShadow />
          <mesh geometry={GEO.box} material={ribbon} scale={[0.2, 0.84, 1.02]} position={[0, -0.1, 0]} />
          <mesh geometry={GEO.box} material={ribbon} scale={[1.02, 0.84, 0.2]} position={[0, -0.1, 0]} />
          <mesh geometry={GEO.box} material={ribbon} scale={[0.2, 0.26, 1.12]} position={[0, 0.38, 0]} />
          <mesh geometry={GEO.box} material={ribbon} scale={[1.12, 0.26, 0.2]} position={[0, 0.38, 0]} />
          <mesh geometry={GEO.sphereSmooth} material={ribbon} scale={[0.42, 0.3, 0.2]} position={[-0.25, 0.7, 0]} rotation={[0, 0, 0.5]} />
          <mesh geometry={GEO.sphereSmooth} material={ribbon} scale={[0.42, 0.3, 0.2]} position={[0.25, 0.7, 0]} rotation={[0, 0, -0.5]} />
          <mesh geometry={GEO.sphereSmooth} material={ribbon} scale={0.2} position={[0, 0.62, 0]} />
        </group>
        <mesh geometry={GEO.torus} material={sparkle} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.1, 0]} scale={[0.9, 0.9, 0.9]} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={GEO.octa} material={sparkle} position={[Math.sin(i * 2.1) * 0.7, 0.4 + i * 0.15, Math.cos(i * 2.1) * 0.7]} scale={0.14} />
        ))}
        {/* área táctil generosa para dedos */}
        <mesh
          userData={{ secretGem: true }}
          geometry={GEO.sphere}
          scale={3}
          onClick={(e) => {
            if (!interactive || cameraState.handMode || e.delta > 8 || reveal.current < 0.5) return
            e.stopPropagation()
            onOpen(id)
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Ofertas escondidas de un piso. */
export function SecretMarkers({
  floorId,
  promos,
  spaceByStore,
  hidden,
  interactive,
  onOpen,
}: {
  floorId: string
  promos: Promotion[]
  spaceByStore: Record<string, string>
  hidden: string[]
  interactive: boolean
  onOpen: (id: string) => void
}) {
  return (
    <>
      {promos.map((p) => {
        if (hidden.includes(p.id)) return null
        const spot = resolveHideSpot(p, spaceByStore)
        if (spot?.floorId !== floorId) return null
        return <HiddenMarker key={`${p.id}@${spot.at.join(',')}`} id={p.id} spot={spot} interactive={interactive} onOpen={onOpen} />
      })}
    </>
  )
}
