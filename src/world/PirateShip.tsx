import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePirateShip } from '../state/pirate'
import { useUI } from '../state/ui'
import { BASIN, HARBOR, PIRATE_BERTH, SEA_Y } from '../tourism/config'
import { trackHarbor } from '../tourism/store'
import { cameraState } from './cameraState'
import { GEO, mat } from './materials'
import { glowMat, lightPoolMat, nightState } from './night'
import { Person } from './Person'

// Barco pirata de eventos, inspirado en los galeones de paseo de la bahía de Cartagena: casco negro
// con franjas doradas, barandas de madera, dos mástiles con vergas y escalas de cuerda, guirnaldas de
// bombillos de proa a popa, bandera pirata y la de Colombia, toldo en la popa y luces de fiesta de
// noche. Atraca en el malecón oeste, se bajan los que vuelven, se suben los que esperan, sale de la
// dársena y le da la vuelta a toda la fortaleza. Se puede tocar: abre sus planes de eventos.

const H = HARBOR
const [BX, BZ] = PIRATE_BERTH
/** Segundos atracado y de recorrido; cada grupo de pasajeros vive dos ciclos. */
const DOCK = 24
const CRUISE = 110
const CYCLE = DOCK + CRUISE
const OFF: [number, number] = [3, 27]
const DOWN: [number, number] = [CYCLE - 32, CYCLE - 8]
const BOARD: [number, number] = [CYCLE + 8, CYCLE + 13]
const STAGGER = 0.8

/** Cubierta (altura local sobre el agua) y colores. */
const DY = 1.22
const BLACK = '#1d1f22'
const GOLD = '#c8963e'
const RAIL = '#d9963f'

/** Sale de la dársena, rodea la fortaleza por el oeste y vuelve a entrar por el lado de las lanchas. */
const ROUTE = new THREE.CatmullRomCurve3(
  (
    [
      [BX, BZ],
      [BX, 51],
      [BX - 1, 57],
      [-27, 61.5],
      [-38, 60],
      [-48, 53],
      [-53, 38],
      [-54, 15],
      [-54, -12],
      [-52, -36],
      [-46, -50],
      [-25, -54],
      [0, -55],
      [25, -54],
      [46, -50],
      [57, -36],
      [59, -8],
      [59, 18],
      [55, 40],
      [47, 54],
      [32, 61],
      [10, 63.5],
      [-4, 62.5],
      [-11, 58.5],
      [-13, 52],
      [-13, 45],
      [-14, 41.4],
      [-17.3, 39.5],
      [-20.6, 41.2],
      [BX, 43.4],
    ] as [number, number][]
  ).map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'centripetal',
)

/** Avance con arranque y llegada suaves (velocidad en trapecio). */
const RAMP = 0.07
const VMAX = 1 / (1 - RAMP)
function progress(s: number) {
  if (s < RAMP) return (VMAX * s * s) / (2 * RAMP)
  if (s > 1 - RAMP) return 1 - (VMAX * (1 - s) ** 2) / (2 * RAMP)
  return VMAX * (s - RAMP / 2)
}
const speedAt = (s: number) => (s < RAMP ? s / RAMP : s > 1 - RAMP ? (1 - s) / RAMP : 1)

/** Lugares en cubierta (local: proa a +z, babor -x da al malecón al atracar). */
const SPOTS: [number, number][] = [
  [-0.9, -1.6],
  [-0.3, -1.3],
  [0.5, -1.7],
  [-0.9, 0.2],
  [-0.1, 0.5],
  [0.7, 0.1],
]
/** Gente que siempre va a bordo (la fiesta). */
const CROWD: [number, number, string][] = [
  [-0.95, 2.6, '#f2f2f2'],
  [-0.2, 2.9, '#e76f51'],
  [0.6, 2.5, '#f2f2f2'],
  [0.95, 1.6, '#2a9d8f'],
  [0.1, 1.5, '#f4a261'],
  [-0.8, 1.2, '#f2f2f2'],
  [1.0, -0.8, '#9b5de5'],
  [0.2, -0.6, '#f2f2f2'],
  [-1.0, -0.7, '#00bbf9'],
  [0.9, -2.3, '#f15bb5'],
  [-0.4, -2.4, '#f2f2f2'],
  [-0.9, -3.4, '#264653'],
  [0.4, -3.6, '#fee440'],
]
const SKINS = ['#e5b48f', '#8d5a3b', '#c58c64', '#f0c8a0']
const GROUPS = [
  ['#e76f51', '#f2f2f2', '#2a9d8f', '#f4a261', '#264653', '#f2f2f2'],
  ['#9b5de5', '#f15bb5', '#f2f2f2', '#00bbf9', '#fee440', '#3d7ea6'],
]

export type P3 = [number, number, number]
const QUAY_Y = H.deckY
const DECK_W = SEA_Y + DY
const WEST_LANE = H.west + H.quayWidth / 2

/** Recorridos a pie de cada pasajero (en el mundo): bajar, volver y subir. */
const PATHS = SPOTS.map(([lx, lz], i) => {
  const z = BZ + lz
  const deck: P3 = [BX + lx, DECK_W, z]
  const rail: P3 = [BX - 1.45, DECK_W, z]
  const edge: P3 = [BASIN.x0 - 0.5, QUAY_Y, z]
  const lane = WEST_LANE - 0.35 + (i % 3) * 0.35
  const walkZ = H.outerZ + 1.5 + (i % 2) * 0.45
  const ax = H.x - 0.6 + i * 0.24
  const queue: P3 = [BASIN.x0 - 0.8 - (i % 2) * 0.7, QUAY_Y, BZ - 2 + i * 0.8]
  return {
    off: [deck, rail, edge, [lane, QUAY_Y, z], [lane, QUAY_Y, walkZ], [ax, QUAY_Y, walkZ], [ax, QUAY_Y, H.wallZ + 0.2]] as P3[],
    down: [[ax, QUAY_Y, H.wallZ + 0.2], [ax, QUAY_Y, walkZ], [lane, QUAY_Y, walkZ], [lane, QUAY_Y, queue[2]], queue] as P3[],
    board: [queue, [edge[0], QUAY_Y, z], rail, deck] as P3[],
  }
})

/** Punto a una fracción u (0–1) de una polilínea, a velocidad constante; devuelve también el rumbo. */
function along(pts: P3[], u: number, out: THREE.Vector3): number {
  let total = 0
  for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][2] - pts[k - 1][2]) + 1e-6
  let d = Math.min(1, Math.max(0, u)) * total
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1]
    const b = pts[k]
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]) + 1e-6
    if (d <= len || k === pts.length - 1) {
      const t = Math.min(1, d / len)
      out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
      return Math.atan2(b[0] - a[0], b[2] - a[2])
    }
    d -= len
  }
  return 0
}

/** Cuerda/palo entre dos puntos locales. */
export function Line({ a, b, r = 0.03, material }: { a: P3; b: P3; r?: number; material: THREE.Material }) {
  const { mid, len, q } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    return {
      mid: va.clone().add(vb).multiplyScalar(0.5),
      len: va.distanceTo(vb),
      q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()),
    }
  }, [a, b])
  return <mesh geometry={GEO.cylinderLow} material={material} position={mid} quaternion={q} scale={[r * 2, len, r * 2]} />
}

/** Muchas copias de una pieza en una sola llamada de dibujo. */
export function Instances({ geometry, material, items }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: { p: P3; s: P3 }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    items.forEach(({ p, s }, i) => {
      o.position.set(...p)
      o.scale.set(...s)
      o.updateMatrix()
      ref.current?.setMatrixAt(i, o.matrix)
    })
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true
      ref.current.computeBoundingSphere()
    }
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />
}

/** Guirnaldas de bombillos (puntos locales entre anclajes, con algo de comba). */
const STRINGS: [P3, P3][] = [
  [[0, 2.75, 7.0], [0, 8.0, 1.8]],
  [[0, 8.0, 1.8], [0, 9.0, -1.1]],
  [[0, 9.0, -1.1], [0, 4.3, -4.55]],
  [[0, 8.0, 1.8], [1.5, 1.9, 3.6]],
  [[0, 8.0, 1.8], [-1.5, 1.9, 3.6]],
  [[0, 9.0, -1.1], [1.5, 2.7, -3.0]],
  [[0, 9.0, -1.1], [-1.5, 2.7, -3.0]],
]
const BULBS = STRINGS.flatMap(([a, b]) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const n = Math.max(3, Math.round(len / 0.6))
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n
    const sag = Math.sin(t * Math.PI) * len * 0.05
    return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t] as P3, s: [0.15, 0.15, 0.15] as P3 }
  })
})
const BALUSTERS = [
  ...[-1, 1].flatMap((sx) => Array.from({ length: 12 }, (_, k) => ({ p: [sx * 1.5, DY + 0.3, -2.1 + k * 0.45] as P3, s: [0.07, 0.55, 0.07] as P3 }))),
  ...[-1, 1].flatMap((sx) => Array.from({ length: 5 }, (_, k) => ({ p: [sx * 1.5, 2.4, -4.5 + k * 0.5] as P3, s: [0.07, 0.5, 0.07] as P3 }))),
  ...Array.from({ length: 6 }, (_, k) => ({ p: [-1.25 + k * 0.5, 2.4, -4.62] as P3, s: [0.07, 0.5, 0.07] as P3 })),
]

/** Casco, arboladura y detalles (local, proa a +z, línea de flotación en y = 0). */
function ShipModel() {
  const black = mat(BLACK, { rough: 0.7 })
  const gold = mat(GOLD, { rough: 0.45 })
  const rail = mat(RAIL, { rough: 0.6 })
  const rope = mat('#3a3128')
  const deck = mat('#7d8288')
  const amber = glowMat('#ffcf7a', 2.2, { dayGlow: 0.25 })
  const ladderA: P3 = [1.48, 1.85, -0.75]
  const ladderB: P3 = [1.48, 1.85, 0.05]
  const topA: P3 = [0.12, 8.2, -1.2]
  const topB: P3 = [0.12, 8.2, -0.95]
  return (
    <group>
      {/* casco: cuerpo, proa en punta y castillo de popa */}
      <mesh geometry={GEO.box} material={black} position={[0, 0.45, -0.9]} scale={[3.2, 1.55, 7.6]} castShadow />
      <mesh geometry={GEO.box} material={black} position={[0, 0.45, 2.9]} rotation={[0, Math.PI / 4, 0]} scale={[2.26, 1.55, 2.26]} castShadow />
      <mesh geometry={GEO.box} material={black} position={[0, 1.65, -3.55]} scale={[3.2, 0.9, 2.3]} castShadow />
      {/* franjas doradas a lo largo del casco */}
      {[0.3, 0.95].map((y) => (
        <group key={y}>
          <mesh geometry={GEO.box} material={gold} position={[0, y, -0.9]} scale={[3.24, 0.08, 7.62]} />
          <mesh geometry={GEO.box} material={gold} position={[0, y, 2.9]} rotation={[0, Math.PI / 4, 0]} scale={[2.29, 0.08, 2.29]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={gold} position={[0, 2.12, -3.55]} scale={[3.24, 0.08, 2.32]} />
      {/* ojos de buey dorados y persianas naranja del castillo */}
      {[-1, 1].flatMap((sx) =>
        [-2.6, -1.2, 0.2, 1.6].map((z) => <mesh key={`${sx}${z}`} geometry={GEO.box} material={gold} position={[sx * 1.61, 0.62, z]} scale={[0.02, 0.18, 0.32]} />),
      )}
      {[-1, 1].flatMap((sx) =>
        [-4.1, -3.1].map((z) => <mesh key={`l${sx}${z}`} geometry={GEO.box} material={rail} position={[sx * 1.61, 1.62, z]} scale={[0.03, 0.45, 0.6]} />),
      )}
      {/* ventanas de popa encendidas y calavera con huesos en la proa */}
      {[-0.9, 0, 0.9].map((x) => (
        <mesh key={x} geometry={GEO.box} material={amber} position={[x, 1.05, -4.71]} scale={[0.5, 0.35, 0.02]} />
      ))}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 1.62, 0.95, 1.4]} rotation={[0, sx * (Math.PI / 2), 0]}>
          <mesh geometry={GEO.sphereSmooth} material={mat('#f5f2ea')} position={[0, 0.1, 0]} scale={[0.26, 0.24, 0.05]} />
          <mesh geometry={GEO.box} material={mat('#f5f2ea')} position={[0, -0.12, 0]} rotation={[0, 0, 0.7]} scale={[0.42, 0.06, 0.03]} />
          <mesh geometry={GEO.box} material={mat('#f5f2ea')} position={[0, -0.12, 0]} rotation={[0, 0, -0.7]} scale={[0.42, 0.06, 0.03]} />
        </group>
      ))}
      {/* llantas de defensa colgando por los costados */}
      {[-1, 1].flatMap((sx) =>
        [-2.8, -0.4, 1.9].map((z) => <mesh key={`t${sx}${z}`} geometry={GEO.torus} material={mat('#141516')} position={[sx * 1.66, 0.15, z]} rotation={[0, Math.PI / 2, 0]} scale={0.24} />),
      )}
      {/* cubierta y barandas de madera */}
      <mesh geometry={GEO.box} material={deck} position={[0, DY, -0.6]} scale={[2.95, 0.05, 6.4]} />
      <mesh geometry={GEO.box} material={deck} position={[0, 2.11, -3.55]} scale={[2.95, 0.04, 2.1]} />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh geometry={GEO.box} material={rail} position={[sx * 1.5, DY + 0.6, 0.4]} scale={[0.1, 0.08, 5.3]} />
          <mesh geometry={GEO.box} material={rail} position={[sx * 1.5, 2.67, -3.5]} scale={[0.1, 0.08, 2.3]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={rail} position={[0, 2.67, -4.62]} scale={[3.0, 0.08, 0.1]} />
      <Instances geometry={GEO.box} material={rail} items={BALUSTERS} />
      {/* bauprés */}
      <Line a={[0, 1.6, 4.2]} b={[0, 2.75, 7.0]} r={0.09} material={black} />
      {/* mástiles, vergas y cofa */}
      <mesh geometry={GEO.cylinderLow} material={black} position={[0, 4.6, 1.8]} scale={[0.22, 6.8, 0.22]} castShadow />
      <mesh geometry={GEO.cylinderLow} material={black} position={[0, 5.1, -1.1]} scale={[0.26, 7.8, 0.26]} castShadow />
      <mesh geometry={GEO.box} material={black} position={[0, 6.3, 1.8]} scale={[3.0, 0.1, 0.1]} />
      <mesh geometry={GEO.box} material={black} position={[0, 7.1, -1.1]} scale={[3.8, 0.11, 0.11]} />
      <mesh geometry={GEO.box} material={black} position={[0, 4.6, -1.1]} scale={[3.0, 0.1, 0.1]} />
      <mesh geometry={GEO.cylinderLow} material={black} position={[0, 5.6, -1.1]} scale={[0.75, 0.25, 0.75]} />
      {/* obenques */}
      {[-1, 1].flatMap((sx) => [
        <Line key={`f${sx}a`} a={[0, 7.8, 1.8]} b={[sx * 1.5, 1.85, 1.0]} material={rope} r={0.02} />,
        <Line key={`f${sx}b`} a={[0, 7.8, 1.8]} b={[sx * 1.5, 1.85, 2.6]} material={rope} r={0.02} />,
        <Line key={`m${sx}a`} a={[0, 8.8, -1.1]} b={[sx * 1.5, 1.85, -2.0]} material={rope} r={0.02} />,
      ])}
      {/* escala de cuerda con peldaños de madera hacia la cofa */}
      <Line a={ladderA} b={topA} material={rope} r={0.025} />
      <Line a={ladderB} b={topB} material={rope} r={0.025} />
      {Array.from({ length: 11 }, (_, k) => {
        const t = (k + 0.5) / 11
        const lerp = (p: P3, q: P3): P3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]
        return <Line key={k} a={lerp(ladderA, topA)} b={lerp(ladderB, topB)} material={rail} r={0.035} />
      })}
      {/* guirnaldas: cuerda y bombillos (una sola llamada de dibujo) */}
      {STRINGS.map(([a, b], i) => (
        <Line key={i} a={a} b={b} material={rope} r={0.012} />
      ))}
      <Instances geometry={GEO.sphere} material={glowMat('#ffd58a', 3, { dayGlow: 0.45 })} items={BULBS} />
      {/* bandera pirata en el palo mayor */}
      <mesh geometry={GEO.box} material={mat('#121314')} position={[0, 8.55, -1.62]} scale={[0.04, 0.62, 0.95]} />
      <mesh geometry={GEO.sphereSmooth} material={mat('#f5f2ea')} position={[0.03, 8.6, -1.6]} scale={[0.04, 0.2, 0.18]} />
      {/* toldo negro sobre la popa, con postes y bandera de Colombia */}
      {[-1, 1].flatMap((sx) =>
        [-4.5, -2.55].map((z) => <mesh key={`c${sx}${z}`} geometry={GEO.box} material={black} position={[sx * 1.4, 2.8, z]} scale={[0.06, 1.35, 0.06]} />),
      )}
      <mesh geometry={GEO.box} material={black} position={[0, 3.5, -3.55]} scale={[3.0, 0.06, 2.1]} castShadow />
      <mesh geometry={GEO.box} material={glowMat('#fff1c9', 1.6)} position={[0, 3.44, -3.55]} scale={[2.6, 0.02, 1.8]} />
      <mesh geometry={GEO.cylinderLow} material={black} position={[-1.3, 3.6, -4.55]} scale={[0.05, 2.6, 0.05]} />
      <mesh geometry={GEO.box} material={mat('#f7c600')} position={[-1.3, 4.6, -5.0]} scale={[0.03, 0.34, 0.85]} />
      <mesh geometry={GEO.box} material={mat('#1f4ea3')} position={[-1.3, 4.35, -5.0]} scale={[0.03, 0.17, 0.85]} />
      <mesh geometry={GEO.box} material={mat('#d3202f')} position={[-1.3, 4.18, -5.0]} scale={[0.03, 0.17, 0.85]} />
      {/* timón y faroles de popa */}
      <mesh geometry={GEO.torus} material={rail} position={[0, 2.65, -2.6]} scale={0.32} />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={GEO.box} material={glowMat('#ffd58a', 2.4, { dayGlow: 0.5 })} position={[sx * 1.45, 3.0, -4.65]} scale={[0.22, 0.3, 0.22]} />
      ))}
      {/* luces de navegación */}
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#ff4d4d', 2.4, { dayGlow: 0.3 })} position={[-1.55, 1.9, 2.6]} scale={0.16} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#3ddc84', 2.4, { dayGlow: 0.3 })} position={[1.55, 1.9, 2.6]} scale={0.16} />
      {/* consola junto al palo de proa */}
      <mesh geometry={GEO.box} material={black} position={[0, DY + 0.35, 3.1]} scale={[0.8, 0.7, 0.5]} />
    </group>
  )
}

export function PirateShip({ reduceMotion, selected }: { reduceMotion: boolean; selected: boolean }) {
  const ship = useRef<THREE.Group>(null)
  const hull = useRef<THREE.Group>(null)
  const wake = useRef<THREE.Mesh>(null)
  const party = useRef<THREE.Mesh>(null)
  const people = useRef<(THREE.Group | null)[]>([])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const tan = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const mats = useMemo(
    () => ({
      wake: new THREE.MeshBasicMaterial({ color: '#f2fffd', transparent: true, opacity: 0, depthWrite: false }),
      shadow: new THREE.MeshBasicMaterial({ color: '#0b3a40', transparent: true, opacity: 0.3, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false }),
      party: new THREE.MeshBasicMaterial({ color: '#c13cff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    }),
    [],
  )
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    // quieto: se queda atracado con su gente a bordo y la fila esperando (sigue meciéndose)
    const parked = usePirateShip.getState().parked
    const time = reduceMotion || parked ? 1 : clock.elapsedTime
    const phase = time % CYCLE
    let rot = 0
    let speed = 0
    if (phase < DOCK) pos.set(BX, 0, BZ)
    else {
      const s = (phase - DOCK) / CRUISE
      const u = progress(s) % 1
      ROUTE.getPointAt(u, pos)
      ROUTE.getTangentAt(u, tan)
      rot = Math.atan2(tan.x, tan.z)
      speed = speedAt(s)
    }
    const bob = reduceMotion ? 0 : Math.sin(clock.elapsedTime * 0.9) * 0.06
    if (ship.current) {
      ship.current.position.set(pos.x, SEA_Y, pos.z)
      ship.current.rotation.y = rot
    }
    if (hull.current) {
      hull.current.position.y = bob
      hull.current.rotation.z = reduceMotion ? 0 : Math.sin(time * 0.7) * 0.018
      hull.current.rotation.x = reduceMotion ? 0 : Math.sin(time * 0.55) * 0.01 - speed * 0.015
    }
    if (wake.current) {
      mats.wake.opacity = speed * 0.55
      wake.current.visible = speed > 0.02
      wake.current.scale.set(3 + speed, 0.02, 5 + speed * 5)
      wake.current.position.z = -4.6 - speed * 2.4
    }
    // luces de fiesta en cubierta: solo de noche, cambiando entre morado y fucsia
    const night = nightState.t
    if (party.current) party.current.visible = night > 0.02
    mats.party.opacity = night * (0.45 + 0.2 * Math.sin(time * 3))
    mats.party.color.setHSL(0.8 + 0.06 * Math.sin(time * 0.8), 0.95, 0.55)
    mats.glow.opacity = THREE.MathUtils.lerp(mats.glow.opacity, selected ? 0.35 : 0, 0.15)
    if (glowRef.current) glowRef.current.visible = mats.glow.opacity > 0.01

    // pasajeros: cada grupo con su reloj de dos ciclos
    const c = Math.cos(rot)
    const sn = Math.sin(rot)
    GROUPS.forEach((_, gi) => {
      const tau = (time + gi * CYCLE) % (2 * CYCLE)
      SPOTS.forEach(([lx, lz], i) => {
        const p = people.current[gi * SPOTS.length + i]
        if (!p) return
        const d = i * STAGGER
        const path = PATHS[i]
        const onBoard = (px: number, pz: number, cc: number, ss: number, r: number) => {
          p.visible = true
          p.position.set(px + lx * cc + lz * ss, SEA_Y + bob + DY, pz - lx * ss + lz * cc)
          p.rotation.y = r + (i % 2 ? 1.2 : -1.2)
        }
        const walk = (pts: P3[], u: number, moving = true) => {
          p.visible = true
          const heading = along(pts, u, tmp)
          p.position.copy(tmp)
          if (moving) {
            p.position.y += Math.abs(Math.sin(time * 7 + i)) * 0.03
            p.rotation.y = heading
          }
        }
        if (tau < OFF[0] + d) onBoard(BX, BZ, 1, 0, 0)
        else if (tau < OFF[1] + d) walk(path.off, (tau - OFF[0] - d) / (OFF[1] - OFF[0]))
        else if (tau < DOWN[0] + d) p.visible = false
        else if (tau < DOWN[1] + d) walk(path.down, (tau - DOWN[0] - d) / (DOWN[1] - DOWN[0]))
        else if (tau < BOARD[0] + d) {
          walk(path.down, 1, false)
          p.rotation.y = Math.PI / 2 // mirando al barco
        } else if (tau < BOARD[1] + d) walk(path.board, (tau - BOARD[0] - d) / (BOARD[1] - BOARD[0]))
        else onBoard(pos.x, pos.z, c, sn, rot)
      })
    })
  })

  const open = () => {
    useUI.getState().openHarbor('pirata')
    trackHarbor({ type: 'boat_open', boat: 'pirata' })
  }

  return (
    <group>
      <group ref={ship}>
        <mesh geometry={GEO.sphere} material={mats.shadow} position={[0, 0.02, -0.4]} scale={[4, 0.02, 11]} />
        <mesh ref={glowRef} geometry={GEO.sphere} material={mats.glow} position={[0, 0.03, -0.4]} scale={[5.4, 0.02, 13]} visible={false} />
        <mesh ref={wake} geometry={GEO.sphere} material={mats.wake} position={[0, 0.04, -5]} visible={false} />
        <mesh geometry={GEO.plane} material={lightPoolMat('#c13cff', 0.7)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={[7, 13, 1]} />
        <group ref={hull}>
          <ShipModel />
          <mesh ref={party} geometry={GEO.plane} material={mats.party} rotation={[-Math.PI / 2, 0, 0]} position={[0, DY + 0.04, -0.6]} scale={[2.8, 6.2, 1]} visible={false} />
          {CROWD.map(([x, z, color], i) => (
            <group key={i} position={[x, DY, z]} rotation={[0, (i * 1.7) % (Math.PI * 2), 0]}>
              <Person color={color} skin={SKINS[i % SKINS.length]} />
            </group>
          ))}
        </group>
        {/* área táctil del barco (invisible) */}
        <mesh
          geometry={GEO.box}
          position={[0, 2, 0]}
          scale={[3.8, 4.5, 11]}
          onClick={(e) => {
            if (cameraState.handMode || e.delta > 8) return
            e.stopPropagation()
            open()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {GROUPS.flatMap((colors, gi) =>
        SPOTS.map((_, i) => (
          <group key={`${gi}${i}`} ref={(g) => void (people.current[gi * SPOTS.length + i] = g)} visible={false}>
            <Person color={colors[i]} skin={SKINS[(i + gi) % SKINS.length]} />
          </group>
        )),
      )}
    </group>
  )
}
