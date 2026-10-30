import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { SPACE_BY_ID, spaceFrontPoint } from '../config/mall'
import type { Promotion } from '../domain/types'
import { cameraState } from './cameraState'
import { GEO, mat } from './materials'
import { lightPoolMat } from './night'
import { liveOrigins } from './floors'

/** Distancia (en unidades del mundo) a la que hay que acercarse para que aparezca la señal. */
const REVEAL_DISTANCE = 9
/** Además, la cámara debe estar al menos así de cerca respecto al encuadre general. */
const REVEAL_ZOOM_RATIO = 1.7

const gold = mat('#f5b544', { emissive: 0.55, rough: 0.35 })
const sparkle = mat('#fff3c4', { emissive: 0.9 })
const HINT_COUNT = 6
/** Brillo dorado en el piso donde aparecerá la gema (de día tenue, de noche más visible). */
const SPOT = lightPoolMat('#ffcc4d', 0.9, 0.35)

/**
 * Oferta escondida: una gema que solo aparece cuando la persona explora de cerca la tienda.
 * No interrumpe: no abre nada sola, hay que tocarla.
 */
function Marker({ promo, spaceId, interactive, onOpen }: { promo: Promotion; spaceId: string; interactive: boolean; onOpen: (id: string) => void }) {
  const space = SPACE_BY_ID[spaceId]
  const [x, z] = spaceFrontPoint(space, 1.4)
  // Un poco hacia un costado, para no tapar la entrada.
  const side = space.type === 'island' ? 1.6 : space.size[0] * 0.32
  const px = x + Math.cos(space.rotation) * side
  const pz = z - Math.sin(space.rotation) * side
  const group = useRef<THREE.Group>(null)
  const gem = useRef<THREE.Mesh>(null)
  const reveal = useRef(0)

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    // Posición en el mundo = origen actual del piso + posición en el piso.
    const origin = liveOrigins[space.floorId]
    const dx = cameraState.target.x - cameraState.viewOffset.x - (origin.x + px)
    const dz = cameraState.target.z - cameraState.viewOffset.z - (origin.z + pz)
    const near = Math.hypot(dx, dz) < REVEAL_DISTANCE + space.size[0] * 0.5 && cameraState.zoom > cameraState.fitZoom * REVEAL_ZOOM_RATIO
    reveal.current += ((near ? 1 : 0) - reveal.current) * Math.min(1, dt * 4)
    const s = reveal.current
    g.visible = s > 0.02
    g.scale.setScalar(s)
    const t = clock.elapsedTime
    g.position.y = 1.4 + Math.sin(t * 2.4) * 0.15
    if (gem.current) gem.current.rotation.y = t * 1.6
  })

  // Pista: destellos dorados sobre la tienda, visibles desde lejos mientras la gema sigue oculta.
  const hints = useRef<THREE.Group>(null)
  const hintY = space.type === 'premium' ? 4.6 : 3.8
  const spot = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const h = hints.current
    if (!h) return
    const t = clock.elapsedTime
    const fade = 1 - reveal.current
    const show = fade > 0.05 && cameraState.zoom > cameraState.fitZoom * 0.95
    h.visible = show
    if (spot.current) {
      spot.current.visible = show
      spot.current.scale.setScalar((1.6 + Math.sin(t * 2) * 0.25) * fade)
    }
    if (!show) return
    h.children.forEach((c, i) => {
      const a = t * 0.7 + (i / HINT_COUNT) * Math.PI * 2
      const tw = Math.max(0, Math.sin(t * 3 + i * 1.9))
      c.position.set(Math.sin(a) * 1.4, hintY + Math.sin(t * 1.3 + i) * 0.5, Math.cos(a) * 1.4)
      c.scale.setScalar((0.12 + tw * 0.22) * fade)
      c.rotation.y = t * 2
    })
  })

  return (
    <group position={[px, 0, pz]}>
      <group ref={hints} position={[space.position[0] - px, 0, space.position[1] - pz]}>
        {Array.from({ length: HINT_COUNT }, (_, i) => (
          <mesh key={i} geometry={GEO.octa} material={sparkle} />
        ))}
      </group>
      <mesh ref={spot} geometry={GEO.plane} material={SPOT} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.26, 0]} />
      <group ref={group} visible={false}>
        <mesh
          ref={gem}
          userData={{ secretGem: true }}
          geometry={GEO.octa}
          material={gold}
          scale={[0.7, 1, 0.7]}
          castShadow
          onClick={(e) => {
            if (!interactive || cameraState.handMode || e.delta > 8 || reveal.current < 0.5) return
            e.stopPropagation()
            onOpen(promo.id)
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        />
        <mesh geometry={GEO.torus} material={sparkle} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} scale={[0.55, 0.55, 0.55]} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={GEO.octa} material={sparkle} position={[Math.sin(i * 2.1) * 0.7, 0.4 + i * 0.15, Math.cos(i * 2.1) * 0.7]} scale={0.14} />
        ))}
        {/* área táctil generosa para dedos */}
        <mesh
          userData={{ secretGem: true }}
          geometry={GEO.sphere}
          scale={2}
          onClick={(e) => {
            if (!interactive || cameraState.handMode || e.delta > 8 || reveal.current < 0.5) return
            e.stopPropagation()
            onOpen(promo.id)
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Ofertas escondidas de las tiendas de un piso. */
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
      {promos
        .filter((p) => !hidden.includes(p.id) && spaceByStore[p.storeId] && SPACE_BY_ID[spaceByStore[p.storeId]]?.floorId === floorId)
        .map((p) => (
          <Marker key={p.id} promo={p} spaceId={spaceByStore[p.storeId]} interactive={interactive} onOpen={onOpen} />
        ))}
    </>
  )
}
