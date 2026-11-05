import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { useUI } from '../state/ui'
import { trackHarbor } from '../tourism/store'
import { BASIN, BOATS, HARBOR, LAUNCH_IDS, SEA_Y, STORE_OF_BOAT } from '../tourism/config'
import type { BoatConfig } from '../tourism/types'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { cameraState } from './cameraState'
import { CORDON, STONE, STONE_DARK, WallLantern } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat, nightState } from './night'
import { BoatFlash } from './BoatFlash'
import { Person } from './Person'
import { DiscountShip } from './DiscountShip'
import { PirateShip } from './PirateShip'

// Muelle turístico al estilo del Muelle de los Pegasos: puerta en arco en la muralla, plaza de piedra
// con los pegasos de bronce sobre pedestales, dos malecones que abrazan una dársena abierta al mar,
// dos lanchas amarradas que se pueden tocar y el barco pirata de eventos (navega, ver PirateShip).
// Lo estático va en Batch; lanchas, gente, luces y barco se animan.

const H = HARBOR
const WT = 2.2
const WATER_Y = SEA_Y
const ARCH_W = 2
const ARCH_H = 2.1
const IRON = '#2f3437'
const WOOD_LIGHT = '#b98a5e'
const BRONZE = '#4f5d55'
const BRONZE_LIGHT = '#66766c'
const PAVE = '#dccaa6'
const PAVE_LINE = '#b5674d'
const COPING = '#efe4cc'
const PEDESTAL = '#e9dfc7'
/** Las lanchas son un poco más grandes que la gente: se leen desde lejos. */
const BOAT_SCALE = 1.35
const QW = H.quayWidth
/** Ejes de los dos malecones (x) y su largo. */
const WEST_X = H.west + QW / 2
const EAST_X = H.east - QW / 2
const QUAY_LEN = H.endZ - H.headZ
const QUAY_MID = H.headZ + QUAY_LEN / 2
const HEAD_DEPTH = H.headZ - H.outerZ
/** Pedestales de los pegasos, frente a la dársena. */
const PEGASI: [number, number, number][] = [
  [H.x - 4.6, H.headZ - 1.35, 0.25],
  [H.x + 4.6, H.headZ - 1.35, -0.25],
]

/** Faroles altos (x, z): a lo largo de los dos malecones y en la plaza. */
const LAMPS: [number, number][] = [
  ...[3, 7.5, 12, 16.2].flatMap((dz) => [
    [H.west + 0.45, H.headZ + dz] as [number, number],
    [H.east - 0.45, H.headZ + dz] as [number, number],
  ]),
  [H.west + 0.6, H.outerZ + 0.7],
  [H.east - 0.6, H.outerZ + 0.7],
]
/** Bolardos en el borde de la dársena. */
const BOLLARDS: [number, number][] = [2, 5, 8, 11, 14, 16.4].flatMap((dz) => [
  [BASIN.x0 - 0.25, H.headZ + dz] as [number, number],
  [BASIN.x1 + 0.25, H.headZ + dz] as [number, number],
])

/** Gente esperando junto a las lanchas (x, z, color de ropa, giro). */
const WAITING: [number, number, string, number][] = [
  [EAST_X - 0.6, BOATS.mar.position[1] - 0.8, '#e07a5f', -1.6],
  [EAST_X + 0.2, BOATS.mar.position[1] - 0.3, '#3d7ea6', -1.9],
  [EAST_X - 0.5, BOATS.bahia.position[1] + 0.6, '#f2cc8f', -1.4],
  [EAST_X + 0.4, BOATS.bahia.position[1] + 1.1, '#6c5b7b', -2.0],
  [H.x + 1.4, H.headZ - 0.6, '#2a9d8f', 0.3],
]

/** Puerta en arco sobre la muralla (local: la cara exterior mira a +z). */
function SeaGate() {
  const stone = mat(STONE[0])
  const trim = mat(CORDON)
  const dark = glowMat('#3a2f28', 0.25)
  const passage = glowMat('#ffb86b', 1.4)
  const D = WT + 0.5
  return (
    <group position={[H.x, 0, H.wallZ]}>
      {/* pilastras y dintel que sobresalen un poco de la muralla */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={stone} position={[s * (ARCH_W / 2 + 0.4), (ARCH_H + 0.3) / 2, 0]} scale={[0.8, ARCH_H + 0.3, D]} castShadow receiveShadow />
      ))}
      <mesh geometry={GEO.box} material={stone} position={[0, ARCH_H + 0.85, 0]} scale={[ARCH_W + 1.6, 1.1, D]} castShadow />
      <mesh geometry={GEO.box} material={trim} position={[0, ARCH_H + 1.45, 0]} scale={[ARCH_W + 1.8, 0.14, D + 0.1]} />
      {/* marco claro y vano en sombra, en las dos caras (capas separadas: sin parpadeo de cerca) */}
      {[1, -1].map((f) => (
        <group key={f} position={[0, 0, f * (D / 2)]} rotation={[0, f === 1 ? 0 : Math.PI, 0]}>
          <mesh geometry={GEO.halfDisc} material={trim} position={[0, ARCH_H, 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[ARCH_W / 2 + 0.22, 0.02, ARCH_W / 2 + 0.22]} />
          <mesh geometry={GEO.box} material={dark} position={[0, ARCH_H / 2, 0.05]} scale={[ARCH_W, ARCH_H, 0.02]} />
          <mesh geometry={GEO.halfDisc} material={dark} position={[0, ARCH_H, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[ARCH_W / 2, 0.02, ARCH_W / 2]} />
          <mesh geometry={GEO.box} material={passage} position={[0, 0.5, 0.08]} scale={[ARCH_W - 0.5, 0.9, 0.01]} />
        </group>
      ))}
      {/* faroles a los lados del arco y luz en el piso */}
      {[-1, 1].map((s) => (
        <WallLantern key={s} x={s * (ARCH_W / 2 + 0.95)} y={2.3} z={D / 2 + 0.25} />
      ))}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.75)} rotation={[-Math.PI / 2, 0, 0]} position={[0, H.deckY + 0.06, D / 2 + 1.6]} scale={[4.5, 3.5, 1]} />
    </group>
  )
}

/**
 * Pegaso de bronce, como los del Muelle de los Pegasos: caballo encabritado con las alas abiertas
 * sobre un pedestal claro (local: mira a +z). De noche lo iluminan focos desde el pie.
 */
function Pegasus() {
  const m = mat(BRONZE, { rough: 0.5 })
  const shade = mat(BRONZE_LIGHT, { rough: 0.55 })
  return (
    <group>
      {/* pedestal alto de piedra clara con zócalo y cornisa */}
      <mesh geometry={GEO.box} material={mat(PEDESTAL)} position={[0, 1, 0]} scale={[1.9, 2, 1.9]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(COPING)} position={[0, 2.05, 0]} scale={[2.05, 0.12, 2.05]} />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, 0.08, 0]} scale={[2.1, 0.16, 2.1]} />
      {/* caballo encabritado: todo gira sobre las patas traseras */}
      <group position={[0, 2.1, -0.55]} rotation={[-0.45, 0, 0]} scale={1.45}>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.cylinderLow} material={m} position={[s * 0.17, 0.36, 0]} scale={[0.14, 0.72, 0.14]} castShadow />
        ))}
        <mesh geometry={GEO.sphereSmooth} material={m} position={[0, 0.82, 0.42]} scale={[0.48, 0.48, 1.1]} castShadow />
        {/* patas delanteras al aire */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.box} material={m} position={[s * 0.15, 0.78, 1.0]} rotation={[s > 0 ? -1.1 : -0.7, 0, 0]} scale={[0.12, 0.58, 0.12]} castShadow />
        ))}
        {/* cuello, cabeza y crin */}
        <mesh geometry={GEO.box} material={m} position={[0, 1.2, 0.86]} rotation={[0.45, 0, 0]} scale={[0.24, 0.74, 0.34]} castShadow />
        <mesh geometry={GEO.box} material={m} position={[0, 1.55, 1.12]} rotation={[1.05, 0, 0]} scale={[0.21, 0.52, 0.25]} castShadow />
        <mesh geometry={GEO.box} material={shade} position={[0, 1.32, 0.7]} rotation={[0.45, 0, 0]} scale={[0.1, 0.7, 0.18]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.cone} material={m} position={[s * 0.07, 1.74, 0.98]} scale={[0.07, 0.14, 0.07]} />
        ))}
        {/* cola abundante */}
        <mesh geometry={GEO.sphere} material={shade} position={[0, 0.55, -0.25]} rotation={[0.6, 0, 0]} scale={[0.22, 0.7, 0.3]} />
        {/* alas abiertas hacia arriba y atrás, con dos capas de plumas */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.2, 1.0, 0.45]} rotation={[0.35, 0, s * 0.75]}>
            <mesh geometry={GEO.box} material={m} position={[s * 0.6, 0, 0]} scale={[1.2, 0.05, 0.62]} castShadow />
            <mesh geometry={GEO.box} material={shade} position={[s * 0.95, 0.02, -0.3]} rotation={[0, s * 0.25, 0]} scale={[0.8, 0.04, 0.44]} />
          </group>
        ))}
      </group>
      {/* focos al pie (se encienden de noche) */}
      <mesh geometry={GEO.box} material={glowMat('#ffe2a8', 2.2)} position={[0, 0.3, 1.0]} scale={[0.7, 0.12, 0.06]} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffe2a8', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 1.4]} scale={[3.4, 2.6, 1]} />
    </group>
  )
}

/** Farol alto de paseo: poste de hierro y farola que se enciende de noche, con su halo en el piso. */
function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, H.deckY, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 0.1, 0]} scale={[0.3, 0.2, 0.3]} />
      <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.6, 0]} scale={[0.1, 3.1, 0.1]} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.5 })} position={[0, 3.3, 0]} scale={0.46} />
      <mesh geometry={GEO.cone} material={mat(IRON)} position={[0, 3.62, 0]} scale={[0.44, 0.22, 0.44]} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} scale={[4.2, 4.2, 1]} />
    </group>
  )
}

/** Jardinera baja con borde amarillo (como las del muelle real). */
function Planter({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  return (
    <group position={[x, H.deckY, z]}>
      <mesh geometry={GEO.box} material={mat('#e8c53a')} position={[0, 0.15, 0]} scale={[w, 0.3, d]} />
      <mesh geometry={GEO.box} material={mat('#4f8a3c')} position={[0, 0.42, 0]} scale={[w - 0.2, 0.5, d - 0.2]} castShadow />
    </group>
  )
}

/** Plaza, malecones, pegasos, faroles, jardineras y paso interior. */
function Quays() {
  const pave = mat(PAVE)
  const line = mat(PAVE_LINE)
  const coping = mat(COPING)
  const base = mat(STONE[1])
  const blockY = (H.deckY - 0.02 + WATER_Y - 0.8) / 2
  const blockH = H.deckY - 0.02 - (WATER_Y - 0.8)
  const W = H.east - H.west
  return (
    <group>
      {/* paso interior: de la plaza del mall a la puerta */}
      <mesh geometry={GEO.box} material={mat(PALETTE.floorAlt)} position={[H.x, 0.03, H.wallZ - WT / 2 - 2.6]} scale={[ARCH_W + 0.6, 0.06, 5.2]} receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat(STONE_DARK)} position={[H.x + s * (ARCH_W / 2 + 0.45), 0.1, H.wallZ - WT / 2 - 2.6]} scale={[0.22, 0.2, 5.2]} />
      ))}
      {/* cuerpos de piedra: plaza y los dos malecones */}
      <mesh geometry={GEO.box} material={base} position={[H.x, blockY, H.outerZ + HEAD_DEPTH / 2]} scale={[W, blockH, HEAD_DEPTH]} receiveShadow />
      {[WEST_X, EAST_X].map((x) => (
        <mesh key={x} geometry={GEO.box} material={base} position={[x, blockY, QUAY_MID]} scale={[QW, blockH, QUAY_LEN]} castShadow receiveShadow />
      ))}
      {/* piso de baldosa clara con líneas terracota */}
      <mesh geometry={GEO.box} material={pave} position={[H.x, H.deckY - 0.03, H.outerZ + HEAD_DEPTH / 2]} scale={[W - 0.3, 0.06, HEAD_DEPTH - 0.1]} receiveShadow />
      {[0.9, 2.1, 3.3].map((dz) => (
        <mesh key={dz} geometry={GEO.box} material={line} position={[H.x, H.deckY + 0.005, H.outerZ + dz]} scale={[W - 0.6, 0.012, 0.07]} />
      ))}
      {[WEST_X, EAST_X].map((x) => (
        <group key={x}>
          <mesh geometry={GEO.box} material={pave} position={[x, H.deckY - 0.03, QUAY_MID]} scale={[QW - 0.3, 0.06, QUAY_LEN - 0.3]} receiveShadow />
          {[-0.75, 0.75].map((dx) => (
            <mesh key={dx} geometry={GEO.box} material={line} position={[x + dx, H.deckY + 0.005, QUAY_MID]} scale={[0.07, 0.012, QUAY_LEN - 0.6]} />
          ))}
        </group>
      ))}
      {/* bordes claros sobre el agua: frente de la plaza, costados y puntas de los malecones */}
      <mesh geometry={GEO.box} material={coping} position={[H.x, H.deckY + 0.02, H.headZ - 0.12]} scale={[BASIN.x1 - BASIN.x0, 0.12, 0.25]} />
      {[BASIN.x0 + 0.12, BASIN.x1 - 0.12, H.west + 0.12, H.east - 0.12].map((x) => (
        <mesh key={x} geometry={GEO.box} material={coping} position={[x, H.deckY + 0.02, (x === BASIN.x0 + 0.12 || x === BASIN.x1 - 0.12 ? QUAY_MID : (H.outerZ + H.endZ) / 2)]} scale={[0.25, 0.12, x === BASIN.x0 + 0.12 || x === BASIN.x1 - 0.12 ? QUAY_LEN : H.endZ - H.outerZ]} />
      ))}
      {[WEST_X, EAST_X].map((x) => (
        <mesh key={x} geometry={GEO.box} material={coping} position={[x, H.deckY + 0.02, H.endZ - 0.12]} scale={[QW, 0.12, 0.25]} />
      ))}
      {/* pegasos */}
      {PEGASI.map(([x, z, r]) => (
        <group key={x} position={[x, H.deckY, z]} rotation={[0, r, 0]}>
          <Pegasus />
        </group>
      ))}
      {/* jardineras: junto a los pedestales y en el frente de la plaza */}
      {PEGASI.map(([x, z]) => (
        <Planter key={x} x={x + (x < H.x ? -2.3 : 2.3)} z={z + 0.2} w={2.2} d={1.2} />
      ))}
      <Planter x={H.x} z={H.headZ - 0.85} w={4.4} d={0.9} />
      {/* faroles y bolardos */}
      {LAMPS.map(([x, z]) => (
        <Lamp key={`${x}${z}`} x={x} z={z} />
      ))}
      {BOLLARDS.map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={GEO.cylinderLow} material={mat('#3a3d42')} position={[x, H.deckY + 0.16, z]} scale={[0.26, 0.32, 0.26]} />
      ))}
      {/* llantas como defensas en el borde de las lanchas */}
      {LAUNCH_IDS.flatMap((id) =>
        [-1.2, 1.2].map((dz) => (
          <mesh key={`${id}${dz}`} geometry={GEO.torus} material={mat('#26282b')} position={[BASIN.x1 - 0.05, -0.05, BOATS[id].position[1] + dz]} rotation={[0, Math.PI / 2, 0]} scale={0.24} />
        )),
      )}
      {/* bancas en la plaza */}
      {[-1, 1].map((s) => (
        <group key={s} position={[H.x + s * 8.6, H.deckY, H.outerZ + 0.55]}>
          <mesh geometry={GEO.box} material={mat('#8a5a3a')} position={[0, 0.3, 0]} scale={[1.8, 0.1, 0.5]} />
          <mesh geometry={GEO.box} material={mat(IRON)} position={[0, 0.13, 0]} scale={[1.5, 0.26, 0.3]} />
        </group>
      ))}
    </group>
  )
}

/**
 * Luces del piso: líneas cálidas a lo ancho de los malecones y por el centro de la plaza. De noche
 * una ola de luz corre desde la boca de la dársena hasta la puerta, como invitando a entrar.
 */
function WalkLights({ reduceMotion }: { reduceMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const strips = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; along: boolean }[] = []
    // en los malecones: de la punta hacia la plaza; d = distancia a la puerta caminando
    for (let z = H.endZ - 0.8; z > H.headZ + 0.4; z -= 1.3) {
      for (const x of [WEST_X, EAST_X]) out.push({ x, z, w: QW - 0.9, d: z - H.outerZ + Math.abs(x - H.x), along: false })
    }
    // en la plaza: del frente hacia la puerta, por el centro
    for (let z = H.headZ - 1.9; z > H.outerZ + 0.3; z -= 0.7) out.push({ x: H.x, z, w: 2.4, d: z - H.outerZ, along: false })
    return out
  }, [])
  const maxD = Math.max(...strips.map((s) => s.d))
  const mats = useMemo(
    () =>
      strips.map(() => ({
        core: new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
        halo: new THREE.MeshBasicMaterial({ color: '#ffb455', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
      })),
    [strips],
  )
  useFrame(({ clock }) => {
    const night = nightState.t
    if (group.current) group.current.visible = night > 0.02
    if (night <= 0.02) return
    // la ola baja desde la boca (d máxima) hasta la puerta (d = 0) y vuelve a empezar
    const head = reduceMotion ? -99 : (1 - ((clock.elapsedTime * 0.16) % 1)) * (maxD + 6) - 3
    strips.forEach((s, i) => {
      const wave = Math.exp(-((s.d - head) ** 2) / 4)
      mats[i].core.opacity = night * (0.4 + 0.6 * wave)
      mats[i].halo.opacity = night * (0.1 + 0.4 * wave)
    })
  })
  return (
    <group ref={group} visible={false}>
      {strips.map((s, i) => (
        <group key={i} position={[s.x, H.deckY + 0.04, s.z]}>
          <mesh geometry={GEO.box} material={mats[i].core} scale={[s.w, 0.012, 0.08]} />
          <mesh geometry={GEO.plane} material={mats[i].halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[s.w + 0.4, 0.7, 1]} />
        </group>
      ))}
    </group>
  )
}

export { Person }

/** Gente en el muelle: unos esperan junto a las lanchas y otros pasean por el malecón este. */
function DockPeople({ reduceMotion }: { reduceMotion: boolean }) {
  const walkers = useRef<(THREE.Group | null)[]>([])
  const routes = useMemo(
    () => [
      { x: EAST_X + 0.7, speed: 0.045, phase: 0 },
      { x: EAST_X + 0.1, speed: 0.035, phase: 0.9 },
      { x: WEST_X - 0.9, speed: 0.04, phase: 1.5 },
    ],
    [],
  )
  useFrame(({ clock }) => {
    if (reduceMotion) return
    const z0 = H.headZ + 0.6
    const span = H.endZ - 1 - z0
    routes.forEach((r, i) => {
      const g = walkers.current[i]
      if (!g) return
      const t = (clock.elapsedTime * r.speed + r.phase) % 2
      const u = t < 1 ? t : 2 - t
      g.position.z = z0 + u * span
      g.position.y = H.deckY + Math.abs(Math.sin(clock.elapsedTime * 6 + i)) * 0.03
      g.rotation.y = t < 1 ? 0 : Math.PI
    })
  })
  return (
    <group>
      {WAITING.map(([x, z, c, r], i) => (
        <group key={i} position={[x, H.deckY, z]} rotation={[0, r, 0]}>
          <Person color={c} skin={i % 2 ? '#c58c64' : '#8d5a3b'} />
        </group>
      ))}
      {routes.map((r, i) => (
        <group key={i} ref={(g) => void (walkers.current[i] = g)} position={[r.x, H.deckY, H.headZ + 2 + i * 4]}>
          <Person color={['#81b29a', '#e9c46a', '#5e8fd8'][i]} skin={['#e5b48f', '#8d5a3b', '#c58c64'][i]} />
        </group>
      ))}
    </group>
  )
}

/** Lancha turística: casco blanco con franja y toldo de color, amarrada al muelle; se puede tocar. */
function Boat({ boat, selected, reduceMotion }: { boat: BoatConfig; selected: boolean; reduceMotion: boolean }) {
  const body = useRef<THREE.Group>(null)
  const hit = useRef<THREE.Mesh>(null)
  const spot = useRef<THREE.Group>(null)
  const pulse = useRef<THREE.Mesh>(null)
  const rings = useRef<THREE.Mesh[]>([])
  const glow = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const color = boat.color
  const mats = useMemo(
    () => ({
      white: mat('#f7f5f1'),
      accent: mat(color),
      deck: mat(WOOD_LIGHT),
      seat: mat(color, { rough: 0.6 }),
      shadow: new THREE.MeshBasicMaterial({ color: '#0b3a40', transparent: true, opacity: 0.28, depthWrite: false }),
      ripple: [0, 1].map(() => new THREE.MeshBasicMaterial({ color: '#e9fffb', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })),
      spot: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
      spotFill: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }),
      pulse: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      glow: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    }),
    [color],
  )
  const [bx, bz] = boat.position
  const seed = bx * 1.7

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime
    const g = body.current
    if (g && !reduceMotion) {
      // flota: sube y baja y se mece apenas
      g.position.y = Math.sin(t * 1.3 + seed) * 0.06
      g.rotation.z = Math.sin(t * 1.1 + seed) * 0.025
      g.rotation.x = Math.sin(t * 0.9 + seed * 2) * 0.015
    }
    // ondas suaves que se abren alrededor del casco
    rings.current.forEach((r, i) => {
      const u = reduceMotion ? 0.5 : ((t * 0.35 + i * 0.5) % 1)
      r.scale.set(1.6 + u * 1.6, 2.6 + u * 1.8, 1)
      ;(r.material as THREE.MeshBasicMaterial).opacity = reduceMotion ? 0.12 : 0.28 * (1 - u)
    })
    // indicador y área táctil con un tamaño mínimo en pantalla (zoom = píxeles por unidad)
    const ppu = (camera as THREE.OrthographicCamera).zoom || 1
    const s = Math.max(0.55, 13 / ppu) * (hover || selected ? 1.15 : 1)
    spot.current?.scale.setScalar(s)
    // radio ≥ 24 px (toque de 48 px) sin invadir la otra lancha
    hit.current?.scale.setScalar(2 * THREE.MathUtils.clamp(24 / ppu, 1.6, 3))
    if (pulse.current) {
      const u = reduceMotion ? 0 : (t * 0.6) % 1
      pulse.current.scale.setScalar(1 + u * 1.4)
      mats.pulse.opacity = reduceMotion ? 0 : 0.55 * (1 - u)
    }
    mats.spotFill.color.set(selected ? color : '#ffffff')
    mats.glow.opacity = THREE.MathUtils.lerp(mats.glow.opacity, selected ? 0.35 : hover ? 0.18 : 0, 0.15)
    if (glow.current) glow.current.visible = mats.glow.opacity > 0.01
  })

  const open = () => {
    useUI.getState().openHarbor(boat.id)
    trackHarbor({ type: 'boat_open', boat: boat.id })
  }

  return (
    <group position={[bx, WATER_Y, bz]} rotation={[0, boat.rotation, 0]}>
      <group scale={BOAT_SCALE}>
      {/* sombra, brillo de selección y ondas sobre el agua */}
      <mesh geometry={GEO.sphere} material={mats.shadow} position={[0, 0.02, 0]} scale={[1.7, 0.02, 3.6]} />
      <mesh ref={glow} geometry={GEO.sphere} material={mats.glow} position={[0, 0.04, 0]} scale={[2.6, 0.02, 4.8]} visible={false} />
      {[0, 1].map((i) => (
        <mesh key={i} ref={(m) => void (m && (rings.current[i] = m))} geometry={GEO.ring} material={mats.ripple[i]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} />
      ))}
      <group ref={body}>
        {/* casco: cuerpo, proa en punta y franja de color */}
        <mesh geometry={GEO.box} material={mats.white} position={[0, 0.2, -0.15]} scale={[1.3, 0.55, 2.5]} castShadow />
        <mesh geometry={GEO.box} material={mats.white} position={[0, 0.2, 1.1]} rotation={[0, Math.PI / 4, 0]} scale={[0.92, 0.55, 0.92]} castShadow />
        <mesh geometry={GEO.box} material={mats.accent} position={[0, 0.06, -0.15]} scale={[1.34, 0.14, 2.52]} />
        <mesh geometry={GEO.box} material={mats.accent} position={[0, 0.06, 1.1]} rotation={[0, Math.PI / 4, 0]} scale={[0.95, 0.14, 0.95]} />
        <mesh geometry={GEO.box} material={mats.deck} position={[0, 0.49, -0.15]} scale={[1.08, 0.04, 2.3]} />
        {/* asientos, consola y toldo */}
        {[-0.75, 0.05].map((z) => (
          <mesh key={z} geometry={GEO.box} material={mats.seat} position={[0, 0.62, z]} scale={[0.95, 0.2, 0.3]} />
        ))}
        <mesh geometry={GEO.box} material={mats.white} position={[0, 0.75, 0.7]} scale={[0.6, 0.45, 0.35]} />
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={GEO.box} material={mats.white} position={[sx * 0.55, 0.95, -0.35 + sz * 0.65]} scale={[0.05, 0.9, 0.05]} />),
        )}
        <mesh geometry={GEO.box} material={mats.accent} position={[0, 1.42, -0.35]} scale={[1.3, 0.08, 1.6]} castShadow />
        <mesh geometry={GEO.box} material={mats.white} position={[0, 1.36, -0.35]} scale={[1.32, 0.04, 1.62]} />
        {/* luz de cortesía bajo el toldo (de noche) */}
        <mesh geometry={GEO.box} material={glowMat('#fff1c9', 1.6)} position={[0, 1.33, -0.35]} scale={[1.1, 0.02, 1.4]} />
      </group>
      </group>
      <BoatFlash storeId={STORE_OF_BOAT[boat.id]} width={1.7 * BOAT_SCALE} length={3.6 * BOAT_SCALE} height={2.2} onOpen={open} reduceMotion={reduceMotion} />
      {/* indicador táctil: anillo de color con centro y pulso lento, sobre el agua junto a la popa */}
      <group ref={spot} position={[0, 0.08, -2.05 * BOAT_SCALE]}>
        <mesh ref={pulse} geometry={GEO.ring} material={mats.pulse} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={GEO.ring} material={mats.spot} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={GEO.sphere} material={mats.spotFill} scale={[0.95, 0.04, 0.95]} />
      </group>
      {/* área táctil generosa (invisible): lancha + indicador */}
      <mesh
        ref={hit}
        geometry={GEO.sphere}
        position={[0, 0.6, -0.6]}
        onClick={(e) => {
          if (cameraState.handMode || e.delta > 8) return
          e.stopPropagation()
          open()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Cuerdas de amarre: de los bolardos del malecón este a la proa y la popa de cada lancha. */
function MooringLines() {
  const lines = useMemo(
    () =>
      LAUNCH_IDS.flatMap((id) => {
        const b = BOATS[id]
        return [
          [1.6, 1.3],
          [-1.8, -1.5],
        ].map(([dz, lz]) => {
          const from = new THREE.Vector3(BASIN.x1 + 0.25, H.deckY + 0.3, b.position[1] + dz)
          // punto del casco en el costado que da al malecón (+x)
          const lx = 0.55
          const c = Math.cos(b.rotation)
          const sn = Math.sin(b.rotation)
          const to = new THREE.Vector3(b.position[0] + (lx * c + lz * sn) * BOAT_SCALE, WATER_Y + 0.62, b.position[1] + (-lx * sn + lz * c) * BOAT_SCALE)
          const mid = from.clone().add(to).multiplyScalar(0.5)
          const len = from.distanceTo(to)
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
          return { mid, len, q }
        })
      }),
    [],
  )
  return (
    <>
      {lines.map((l, i) => (
        <mesh key={i} geometry={GEO.cylinderLow} material={mat('#e3cfa6')} position={l.mid} quaternion={l.q} scale={[0.04, l.len, 0.04]} />
      ))}
    </>
  )
}

/** Muelle turístico completo, con su rótulo en el mapa. */
export function Harbor({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const selected = useUI((s) => s.harbor?.boat ?? null)
  const label = useMemo(() => getGlassPill('Muelle turístico', { dot: '#13b9ad', sub: 'Lanchas y barco pirata', dark: night }), [night])
  return (
    <group>
      <Batch version="muelle-pegasos">
        <SeaGate />
        <Quays />
        <MooringLines />
      </Batch>
      <WalkLights reduceMotion={reduceMotion} />
      <DockPeople reduceMotion={reduceMotion} />
      {LAUNCH_IDS.map((id) => (
        <Boat key={id} boat={BOATS[id]} selected={selected === id} reduceMotion={reduceMotion} />
      ))}
      <PirateShip reduceMotion={reduceMotion} selected={selected === 'pirata'} />
      <DiscountShip reduceMotion={reduceMotion} />
      {!selected && <ScreenLabel
        label={label}
        position={[H.x, 7.8, H.headZ - 1]}
        pixelHeight={30}
        maxZoomRatio={1.6}
        priority={LABEL_PRIORITY.corridor + 5}
      />}
    </group>
  )
}
