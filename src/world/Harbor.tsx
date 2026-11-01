import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { useUI } from '../state/ui'
import { trackHarbor } from '../tourism/store'
import { BOATS, BOAT_IDS, HARBOR, SEA_Y, HARBOR_END_Z, HARBOR_FRONT_Z } from '../tourism/config'
import type { BoatConfig } from '../tourism/types'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { Person } from './Person'
import { TourBoat } from './TourBoat'
import { cameraState } from './cameraState'
import { CORDON, STONE, STONE_DARK, WallLantern } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat, nightState } from './night'

// Muelle turístico: una puerta en arco abierta en la muralla del frente izquierdo, un muelle de
// madera hacia el mar y dos lanchas que se pueden tocar (planes de mar e islas / bahía al
// atardecer). Lo estático va en Batch; las lanchas, la gente y los indicadores se animan.

const H = HARBOR
const WT = 2.2
const WATER_Y = SEA_Y
const WOOD = '#9a6b45'
const WOOD_DARK = '#6e4a30'
const WOOD_LIGHT = '#b98a5e'
const IRON = '#2f3437'
const MARBLE = '#ece6da'
const ARCH_W = 2
const ARCH_H = 2.1
/** Las lanchas son un poco más grandes que la gente: se leen desde lejos. */
const BOAT_SCALE = 1.35
/** Fin del paseo (z) y plataforma del final, donde atracan las lanchas y el bote de paseo. */
const END_Z = HARBOR_END_Z
const PW = H.platformWidth
const PD = H.platformDepth
const FRONT_Z = HARBOR_FRONT_Z
/** Arranque de la cubierta de madera (después del rellano de piedra). */
const DECK_Z0 = H.outerZ + 1.1
const DECK_LEN = END_Z - DECK_Z0

/** Pilotes (x, z): a los lados del paseo cada ~2,2 y en el borde de la plataforma. */
const POSTS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let z = DECK_Z0 + 0.3; z <= END_Z - 0.2; z += 2.2) for (const s of [-1, 1]) out.push([H.x + s * (H.width / 2 + 0.05), z])
  for (const s of [-1, 1]) {
    out.push([H.x + s * (PW / 2), END_Z + 0.2], [H.x + s * (PW / 2), FRONT_Z - 0.2], [H.x + s * 2.4, FRONT_Z - 0.1])
  }
  return out
})()

/** Faroles del paseo (x, z): a ambos lados y en las esquinas de la plataforma. */
const LAMPS: [number, number][] = [
  ...[DECK_Z0 + 2.2, DECK_Z0 + 5.8, DECK_Z0 + 9.4].flatMap((z) => [-1, 1].map((s) => [H.x + s * (H.width / 2 + 0.05), z] as [number, number])),
  ...[-1, 1].map((s) => [H.x + s * (PW / 2 - 0.3), FRONT_Z - 0.3] as [number, number]),
]

/** Gente esperando junto a las lanchas (x, z, color de ropa, giro). */
const WAITING: [number, number, string, number][] = [
  [H.x - 4.1, END_Z + 1.2, '#e07a5f', -1.3],
  [H.x - 3.5, END_Z + 1.9, '#3d7ea6', -1.9],
  [H.x + 3.9, END_Z + 0.9, '#f2cc8f', 1.4],
  [H.x + 4.2, END_Z + 1.8, '#6c5b7b', 1.9],
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
 * Pegaso de mármol sobre su pedestal, como los del Muelle de los Pegasos: caballo encabritado con
 * las alas abiertas (local: mira a +z). De noche lo ilumina un foco desde el pie.
 */
function Pegasus() {
  const m = mat(MARBLE, { rough: 0.55 })
  const shade = mat('#d9d1c2', { rough: 0.6 })
  return (
    <group>
      {/* pedestal de piedra con cornisa */}
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[0, 0.65, 0]} scale={[1.3, 1.3, 1.9]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 1.35, 0]} scale={[1.5, 0.14, 2.1]} />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, 0.1, 0]} scale={[1.5, 0.2, 2.1]} />
      {/* caballo encabritado: todo gira sobre las patas traseras */}
      <group position={[0, 1.42, -0.45]} rotation={[-0.42, 0, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.cylinderLow} material={m} position={[s * 0.17, 0.36, 0]} scale={[0.13, 0.72, 0.13]} castShadow />
        ))}
        <mesh geometry={GEO.sphereSmooth} material={m} position={[0, 0.82, 0.42]} scale={[0.46, 0.46, 1.1]} castShadow />
        {/* patas delanteras al aire */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.box} material={m} position={[s * 0.15, 0.78, 1.0]} rotation={[s > 0 ? -1.1 : -0.7, 0, 0]} scale={[0.11, 0.55, 0.11]} castShadow />
        ))}
        {/* cuello, cabeza y crin */}
        <mesh geometry={GEO.box} material={m} position={[0, 1.2, 0.86]} rotation={[0.45, 0, 0]} scale={[0.22, 0.72, 0.32]} castShadow />
        <mesh geometry={GEO.box} material={m} position={[0, 1.55, 1.12]} rotation={[1.05, 0, 0]} scale={[0.2, 0.5, 0.24]} castShadow />
        <mesh geometry={GEO.box} material={shade} position={[0, 1.3, 0.72]} rotation={[0.45, 0, 0]} scale={[0.08, 0.66, 0.14]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.cone} material={m} position={[s * 0.07, 1.74, 0.98]} scale={[0.07, 0.14, 0.07]} />
        ))}
        {/* cola */}
        <mesh geometry={GEO.box} material={shade} position={[0, 0.7, -0.2]} rotation={[0.6, 0, 0]} scale={[0.09, 0.55, 0.12]} />
        {/* alas abiertas hacia arriba y atrás, con dos capas de plumas */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.2, 1.0, 0.45]} rotation={[0.25, 0, s * 0.7]}>
            <mesh geometry={GEO.box} material={m} position={[s * 0.55, 0, 0]} scale={[1.1, 0.05, 0.6]} castShadow />
            <mesh geometry={GEO.box} material={shade} position={[s * 0.85, 0.02, -0.28]} rotation={[0, s * 0.25, 0]} scale={[0.75, 0.04, 0.42]} />
          </group>
        ))}
      </group>
      {/* foco al pie (se enciende de noche) */}
      <mesh geometry={GEO.box} material={glowMat('#ffe2a8', 2.2)} position={[0, 0.25, 1.08]} scale={[0.5, 0.12, 0.06]} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffe2a8', 0.8)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 1.6]} scale={[2.6, 2.2, 1]} />
    </group>
  )
}

/** Farol de paseo: poste de hierro y farola que se enciende de noche, con su halo en la madera. */
function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, H.deckY, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 0.08, 0]} scale={[0.26, 0.16, 0.26]} />
      <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.2, 0]} scale={[0.09, 2.3, 0.09]} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.5 })} position={[0, 2.5, 0]} scale={0.42} />
      <mesh geometry={GEO.cone} material={mat(IRON)} position={[0, 2.78, 0]} scale={[0.4, 0.2, 0.4]} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={[3.4, 3.4, 1]} />
    </group>
  )
}

/** Muelle: paseo amplio de madera con pilotes, barandas, faroles, plataforma final y paso interior. */
function Dock() {
  const planks = Math.floor(DECK_LEN / 0.55)
  const midZ = DECK_Z0 + DECK_LEN / 2
  return (
    <group>
      {/* paso interior: de la plaza a la puerta */}
      <mesh geometry={GEO.box} material={mat(PALETTE.floorAlt)} position={[H.x, 0.03, H.wallZ - WT / 2 - 2.6]} scale={[ARCH_W + 0.6, 0.06, 5.2]} receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat(STONE_DARK)} position={[H.x + s * (ARCH_W / 2 + 0.45), 0.1, H.wallZ - WT / 2 - 2.6]} scale={[0.22, 0.2, 5.2]} />
      ))}
      {/* rellano de piedra al salir, ancho: aquí están los pegasos */}
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[H.x, H.deckY - 0.12, H.outerZ + 0.6]} scale={[H.width + 5.4, 0.5, 1.3]} receiveShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[H.x, H.deckY + 0.14, H.outerZ + 1.22]} scale={[H.width + 5.4, 0.04, 0.1]} />
      {/* cubierta y tablones */}
      <mesh geometry={GEO.box} material={mat(WOOD)} position={[H.x, H.deckY - 0.08, midZ]} scale={[H.width, 0.16, DECK_LEN]} castShadow receiveShadow />
      {Array.from({ length: planks }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(i % 2 ? WOOD_LIGHT : WOOD)} position={[H.x, H.deckY + 0.01, DECK_Z0 + 0.3 + i * 0.55]} scale={[H.width - 0.06, 0.03, 0.42]} receiveShadow />
      ))}
      {/* bordillos laterales de madera oscura */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat(WOOD_DARK)} position={[H.x + s * (H.width / 2 - 0.06), H.deckY + 0.05, midZ]} scale={[0.12, 0.1, DECK_LEN]} />
      ))}
      {/* plataforma del final */}
      <mesh geometry={GEO.box} material={mat(WOOD)} position={[H.x, H.deckY - 0.08, END_Z + PD / 2]} scale={[PW, 0.16, PD]} castShadow receiveShadow />
      {Array.from({ length: Math.floor(PD / 0.55) }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(i % 2 ? WOOD : WOOD_LIGHT)} position={[H.x, H.deckY + 0.01, END_Z + 0.3 + i * 0.55]} scale={[PW - 0.08, 0.03, 0.42]} receiveShadow />
      ))}
      {/* borde de atraque (frente) con defensas */}
      <mesh geometry={GEO.box} material={mat(WOOD_DARK)} position={[H.x, H.deckY - 0.12, FRONT_Z + 0.04]} scale={[PW, 0.3, 0.1]} />
      {[-3.2, -1.2, 1.2, 3.2].map((dx) => (
        <mesh key={dx} geometry={GEO.cylinderLow} material={mat('#2e3135')} position={[H.x + dx, H.deckY - 0.2, FRONT_Z + 0.12]} rotation={[0, 0, Math.PI / 2]} scale={[0.22, 0.6, 0.22]} />
      ))}
      {/* pilotes con remate */}
      {POSTS.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <mesh geometry={GEO.cylinderLow} material={mat(WOOD_DARK)} position={[x, (WATER_Y - 0.8 + H.deckY + 0.75) / 2, z]} scale={[0.22, H.deckY + 0.75 - WATER_Y + 0.8, 0.22]} castShadow />
          <mesh geometry={GEO.cylinderLow} material={mat(CORDON)} position={[x, H.deckY + 0.78, z]} scale={[0.26, 0.06, 0.26]} />
        </group>
      ))}
      {/* barandas: a los lados del paseo y en la parte de atrás de la plataforma */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={mat('#d9c39b')} position={[H.x + s * (H.width / 2 + 0.05), H.deckY + 0.55, midZ]} scale={[0.05, 0.05, DECK_LEN - 0.4]} />
          <mesh geometry={GEO.box} material={mat('#d9c39b')} position={[H.x + s * (H.width / 2 + 0.05), H.deckY + 0.3, midZ]} scale={[0.04, 0.04, DECK_LEN - 0.4]} />
          <mesh geometry={GEO.box} material={mat('#d9c39b')} position={[H.x + s * (H.width / 2 + PW / 2) / 2, H.deckY + 0.55, END_Z + 0.2]} scale={[(PW - H.width) / 2, 0.05, 0.05]} />
        </group>
      ))}
      {/* faroles */}
      {LAMPS.map(([x, z]) => (
        <Lamp key={`${x}${z}`} x={x} z={z} />
      ))}
      {/* pegasos a la entrada del paseo, mirando al mar */}
      {[-1, 1].map((s) => (
        <group key={s} position={[H.x + s * (H.width / 2 + 1.55), H.deckY + 0.13, H.outerZ + 0.75]} rotation={[0, s * 0.2, 0]} scale={0.95}>
          <Pegasus />
        </group>
      ))}
      {/* bolardos, rollo de cuerda y bancas en la plataforma */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.cylinderLow} material={mat('#3a3d42')} position={[H.x + s * 1.6, H.deckY + 0.14, FRONT_Z - 0.35]} scale={[0.28, 0.28, 0.28]} />
          <mesh geometry={GEO.box} material={mat(WOOD_DARK)} position={[H.x + s * 3.6, H.deckY + 0.24, END_Z + 0.55]} scale={[1.5, 0.12, 0.45]} />
          <mesh geometry={GEO.box} material={mat(IRON)} position={[H.x + s * 3.6, H.deckY + 0.1, END_Z + 0.55]} scale={[1.3, 0.2, 0.3]} />
        </group>
      ))}
      <mesh geometry={GEO.cylinder} material={mat('#d8c39c')} position={[H.x - 1.4, H.deckY + 0.1, DECK_Z0 + 1.4]} scale={[0.42, 0.18, 0.42]} />
    </group>
  )
}

/**
 * Luces de los peldaños: una línea cálida en cada tablón alterno. De noche una ola de luz corre
 * desde el mar hacia la puerta, como invitando a entrar. De día no se ven.
 */
function StepLights({ reduceMotion }: { reduceMotion: boolean }) {
  const n = Math.floor(DECK_LEN / 1.1)
  const group = useRef<THREE.Group>(null)
  const mats = useMemo(
    () =>
      Array.from({ length: n }, () => ({
        core: new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
        halo: new THREE.MeshBasicMaterial({ color: '#ffb455', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
      })),
    [n],
  )
  useFrame(({ clock }) => {
    const night = nightState.t
    if (group.current) group.current.visible = night > 0.02
    if (night <= 0.02) return
    // la ola baja de i = n-1 (el mar) a i = 0 (la puerta) y vuelve a empezar
    const head = reduceMotion ? -10 : (1 - ((clock.elapsedTime * 0.32) % 1)) * (n + 4) - 2
    mats.forEach((m, i) => {
      const wave = Math.exp(-((i - head) ** 2) / 1.6)
      m.core.opacity = night * (0.45 + 0.55 * wave)
      m.halo.opacity = night * (0.12 + 0.38 * wave)
    })
  })
  return (
    <group ref={group} visible={false}>
      {mats.map((m, i) => {
        const z = DECK_Z0 + 0.3 + (2 * i + 1) * 0.55 - 0.275
        return (
          <group key={i} position={[H.x, H.deckY + 0.035, z]}>
            <mesh geometry={GEO.box} material={m.core} scale={[H.width - 0.5, 0.012, 0.07]} />
            <mesh geometry={GEO.plane} material={m.halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[H.width - 0.2, 0.55, 1]} />
          </group>
        )
      })}
    </group>
  )
}

export { Person }

/** Gente en el muelle: unos esperan junto a las lanchas y otros pasean por el paseo. */
function DockPeople({ reduceMotion }: { reduceMotion: boolean }) {
  const walkers = useRef<(THREE.Group | null)[]>([])
  const routes = useMemo(
    () => [
      { x: H.x + 0.8, speed: 0.07, phase: 0 },
      { x: H.x - 0.9, speed: 0.055, phase: 0.9 },
      { x: H.x + 0.2, speed: 0.08, phase: 1.5 },
    ],
    [],
  )
  useFrame(({ clock }) => {
    if (reduceMotion) return
    const span = END_Z + 1.2 - DECK_Z0 - 0.4
    routes.forEach((r, i) => {
      const g = walkers.current[i]
      if (!g) return
      const t = (clock.elapsedTime * r.speed + r.phase) % 2
      const u = t < 1 ? t : 2 - t
      g.position.z = DECK_Z0 + 0.4 + u * span
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
        <group key={i} ref={(g) => void (walkers.current[i] = g)} position={[r.x, H.deckY, DECK_Z0 + 1 + i * 3]}>
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

/** Cuerdas de amarre: de los pilotes del costado de la plataforma a la proa y la popa de cada lancha. */
function MooringLines() {
  const lines = useMemo(
    () =>
      BOAT_IDS.flatMap((id) => {
        const b = BOATS[id]
        const side = Math.sign(b.position[0] - H.x)
        const postX = H.x + side * (PW / 2)
        return [
          [FRONT_Z - 0.2, 1.3],
          [END_Z + 0.2, -1.5],
        ].map(([postZ, lz]) => {
          const from = new THREE.Vector3(postX, H.deckY + 0.72, postZ)
          // punto del casco en el costado que mira a la plataforma
          const lx = -side * 0.55
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
  const label = useMemo(() => getGlassPill('Muelle turístico', { dot: '#13b9ad', sub: 'Tours y experiencias', dark: night }), [night])
  return (
    <group>
      <Batch version="muelle">
        <SeaGate />
        <Dock />
        <MooringLines />
      </Batch>
      <StepLights reduceMotion={reduceMotion} />
      <DockPeople reduceMotion={reduceMotion} />
      <TourBoat reduceMotion={reduceMotion} />
      {BOAT_IDS.map((id) => (
        <Boat key={id} boat={BOATS[id]} selected={selected === id} reduceMotion={reduceMotion} />
      ))}
      {!selected && <ScreenLabel
        label={label}
        position={[H.x, 7.4, H.wallZ + 0.5]}
        pixelHeight={30}
        maxZoomRatio={1.6}
        priority={LABEL_PRIORITY.corridor + 5}
      />}
    </group>
  )
}
