import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HARBOR, HARBOR_END_Z, SEA_Y, TOUR_BERTH } from '../tourism/config'
import { GEO, mat } from './materials'
import { glowMat } from './night'
import { Person } from './Person'

// Bote de paseo: sale del muelle, le da la vuelta a toda la fortaleza y vuelve a atracar. En el
// muelle se bajan los que vuelven del paseo (y se van caminando hacia la puerta) y se suben los que
// esperaban en la plataforma. Todo sigue un mismo reloj, así que es determinista y barato.

const H = HARBOR
/** Segundos atracado (bajar y subir gente) y de recorrido. */
const DOCK = 18
const CRUISE = 80
const CYCLE = DOCK + CRUISE
/** Cada grupo vive dos ciclos: llega de paseo, se baja, se va y vuelve para el siguiente. */
const ALIGHT: [number, number] = [3, 6]
const WALK_UP: [number, number] = [6, 20]
const WALK_DOWN: [number, number] = [CYCLE - 24, CYCLE - 6]
const BOARD: [number, number] = [CYCLE + 7, CYCLE + 11]
const STAGGER = 0.6

/** Ida y vuelta alrededor de la fortaleza, lejos de baluartes, playas y lanchas amarradas. */
const ROUTE = new THREE.CatmullRomCurve3(
  (
    [
      TOUR_BERTH,
      [H.x + 4.5, TOUR_BERTH[1] + 0.9],
      [H.x + 11, 51.5],
      [8, 53],
      [30, 53],
      [46, 50],
      [53, 38],
      [52, 18],
      [50, -12],
      [50, -30],
      [46, -46],
      [28, -49],
      [-10, -49.5],
      [-32, -49],
      [-48, -46],
      [-50, -25],
      [-49.5, 0],
      [-49.5, 18],
      [-48, 38],
      [-38, 50],
      [H.x - 11, 51.5],
      [H.x - 4.5, TOUR_BERTH[1] + 0.9],
    ] as [number, number][]
  ).map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'centripetal',
)

/** Avance (0–1 del recorrido) con arranque y llegada suaves: velocidad en trapecio. */
const RAMP = 0.08
const VMAX = 1 / (1 - RAMP)
function progress(s: number) {
  if (s < RAMP) return (VMAX * s * s) / (2 * RAMP)
  if (s > 1 - RAMP) return 1 - (VMAX * (1 - s) ** 2) / (2 * RAMP)
  return VMAX * (s - RAMP / 2)
}
const speedAt = (s: number) => (s < RAMP ? s / RAMP : s > 1 - RAMP ? (1 - s) / RAMP : 1)

/** Asientos (local: proa a +z, el costado +x da a la plataforma al atracar). */
const SEATS: [number, number][] = [
  [0.45, -1.2],
  [-0.45, -1.2],
  [0.45, 0.2],
  [-0.45, 0.2],
]
const SEAT_Y = 0.33
const DECK_Y = 0.58
/** Dónde esperan en la plataforma y por dónde entran a la muralla. */
const QUEUE = SEATS.map((_, i) => [H.x - 1.8 + i * 1.2, HARBOR_END_Z + 2.15] as [number, number])
const OFF = SEATS.map((_, i) => [H.x - 2.6 + i * 1.7, HARBOR_END_Z + 1.3] as [number, number])
const ARCH = SEATS.map((_, i) => [H.x - 0.6 + i * 0.4, H.wallZ + 0.3] as [number, number])

const GROUPS = [
  { colors: ['#e76f51', '#2a9d8f', '#f4a261', '#264653'], skins: ['#e5b48f', '#8d5a3b', '#c58c64', '#f0c8a0'] },
  { colors: ['#9b5de5', '#f15bb5', '#00bbf9', '#fee440'], skins: ['#8d5a3b', '#e5b48f', '#c58c64', '#8d5a3b'] },
]

/** De local del bote a mundo (giro en y). */
function toWorld(x: number, z: number, px: number, pz: number, rot: number): [number, number] {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return [px + x * c + z * s, pz - x * s + z * c]
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const ease = (v: number) => v * v * (3 - 2 * v)

export function TourBoat({ reduceMotion }: { reduceMotion: boolean }) {
  const boat = useRef<THREE.Group>(null)
  const hull = useRef<THREE.Group>(null)
  const wake = useRef<THREE.Mesh>(null)
  const people = useRef<(THREE.Group | null)[]>([])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const tan = useMemo(() => new THREE.Vector3(), [])
  const mats = useMemo(
    () => ({
      white: mat('#f8f6f1'),
      hull: mat('#2f6fd6'),
      canopy: mat('#f6c445', { rough: 0.6 }),
      seat: mat('#2f6fd6', { rough: 0.6 }),
      deck: mat('#c79a6b'),
      wake: new THREE.MeshBasicMaterial({ color: '#f2fffd', transparent: true, opacity: 0, depthWrite: false }),
      shadow: new THREE.MeshBasicMaterial({ color: '#0b3a40', transparent: true, opacity: 0.26, depthWrite: false }),
    }),
    [],
  )

  useFrame(({ clock }) => {
    const time = reduceMotion ? 1 : clock.elapsedTime
    const phase = time % CYCLE
    // dónde va el bote: atracado (mirando a +x) o navegando el recorrido
    let rot = Math.PI / 2
    let speed = 0
    if (phase < DOCK) pos.set(TOUR_BERTH[0], 0, TOUR_BERTH[1])
    else {
      const s = (phase - DOCK) / CRUISE
      const u = progress(s) % 1
      ROUTE.getPointAt(u, pos)
      ROUTE.getTangentAt(u, tan)
      rot = Math.atan2(tan.x, tan.z)
      speed = speedAt(s)
    }
    const bob = reduceMotion ? 0 : Math.sin(time * 1.2) * 0.05
    const g = boat.current
    if (g) {
      g.position.set(pos.x, SEA_Y, pos.z)
      g.rotation.y = rot
    }
    if (hull.current) {
      hull.current.position.y = bob
      hull.current.rotation.z = reduceMotion ? 0 : Math.sin(time * 0.9) * 0.02 + speed * 0.015
      hull.current.rotation.x = -speed * 0.03
    }
    if (wake.current) {
      mats.wake.opacity = speed * 0.55
      wake.current.visible = speed > 0.02
      wake.current.scale.set(1.6 + speed * 0.6, 0.02, 3 + speed * 3.5)
      wake.current.position.z = -2.6 - speed * 1.7
    }

    // gente: cada grupo, su propio reloj de dos ciclos
    const dockedRot = Math.PI / 2
    GROUPS.forEach((_, gi) => {
      const tau = (time + gi * CYCLE) % (2 * CYCLE)
      SEATS.forEach(([sx, sz], i) => {
        const p = people.current[gi * SEATS.length + i]
        if (!p) return
        const d = i * STAGGER
        const seated = (bx: number, bz: number, r: number, y: number) => {
          const [wx, wz] = toWorld(sx, sz, bx, bz, r)
          p.visible = true
          p.position.set(wx, SEA_Y + y + SEAT_Y, wz)
          p.rotation.y = r
        }
        const walk = (from: [number, number], to: [number, number], u: number, y0: number, y1: number) => {
          const k = ease(u)
          p.visible = true
          p.position.set(from[0] + (to[0] - from[0]) * k, y0 + (y1 - y0) * k + (u > 0 && u < 1 ? Math.abs(Math.sin(time * 7 + i)) * 0.03 : 0), from[1] + (to[1] - from[1]) * k)
          if (u > 0 && u < 1) p.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1])
        }
        const seat = toWorld(sx, sz, TOUR_BERTH[0], TOUR_BERTH[1], dockedRot)
        const deckY = SEA_Y + DECK_Y
        if (tau < ALIGHT[0] + d) seated(TOUR_BERTH[0], TOUR_BERTH[1], dockedRot, bob)
        else if (tau < WALK_UP[0] + d) walk(seat, OFF[i], clamp01((tau - ALIGHT[0] - d) / (ALIGHT[1] - ALIGHT[0])), deckY, H.deckY)
        else if (tau < WALK_UP[1] + d) walk(OFF[i], ARCH[i], clamp01((tau - WALK_UP[0] - d) / (WALK_UP[1] - WALK_UP[0])), H.deckY, H.deckY)
        else if (tau < WALK_DOWN[0] + d) p.visible = false
        else if (tau < WALK_DOWN[1] + d) walk(ARCH[i], QUEUE[i], clamp01((tau - WALK_DOWN[0] - d) / (WALK_DOWN[1] - WALK_DOWN[0])), H.deckY, H.deckY)
        else if (tau < BOARD[0] + d) {
          walk(ARCH[i], QUEUE[i], 1, H.deckY, H.deckY)
          p.rotation.y = 0 // mirando al mar, esperando el bote
        } else if (tau < BOARD[1] + d) walk(QUEUE[i], seat, clamp01((tau - BOARD[0] - d) / (BOARD[1] - BOARD[0])), H.deckY, deckY)
        else seated(pos.x, pos.z, rot, bob)
      })
    })
  })

  return (
    <group>
      <group ref={boat}>
        <mesh geometry={GEO.sphere} material={mats.shadow} position={[0, 0.02, 0]} scale={[2.4, 0.02, 5.6]} />
        <mesh ref={wake} geometry={GEO.sphere} material={mats.wake} position={[0, 0.04, -3]} visible={false} />
        <group ref={hull}>
          {/* casco blanco con franja azul y proa en punta */}
          <mesh geometry={GEO.box} material={mats.white} position={[0, 0.28, -0.3]} scale={[2, 0.6, 4.4]} castShadow />
          <mesh geometry={GEO.box} material={mats.white} position={[0, 0.28, 1.9]} rotation={[0, Math.PI / 4, 0]} scale={[1.42, 0.6, 1.42]} castShadow />
          <mesh geometry={GEO.box} material={mats.hull} position={[0, 0.1, -0.3]} scale={[2.04, 0.18, 4.42]} />
          <mesh geometry={GEO.box} material={mats.hull} position={[0, 0.1, 1.9]} rotation={[0, Math.PI / 4, 0]} scale={[1.45, 0.18, 1.45]} />
          <mesh geometry={GEO.box} material={mats.deck} position={[0, DECK_Y, -0.3]} scale={[1.8, 0.04, 4.2]} />
          {/* bancas */}
          {SEATS.map(([x, z]) => (
            <mesh key={`${x}${z}`} geometry={GEO.box} material={mats.seat} position={[x, DECK_Y + 0.12, z - 0.2]} scale={[0.7, 0.2, 0.32]} />
          ))}
          {/* consola y capitán */}
          <mesh geometry={GEO.box} material={mats.white} position={[0, DECK_Y + 0.25, 1.35]} scale={[0.8, 0.5, 0.4]} />
          <group position={[0, DECK_Y, 0.95]}>
            <Person color="#f8f6f1" skin="#8d5a3b" />
          </group>
          {/* toldo amarillo sobre cuatro postes, con luz debajo de noche */}
          {[-1, 1].flatMap((sx) =>
            [-1.95, 1.0].map((z) => <mesh key={`${sx}${z}`} geometry={GEO.box} material={mats.white} position={[sx * 0.85, DECK_Y + 0.7, z]} scale={[0.06, 1.4, 0.06]} />),
          )}
          <mesh geometry={GEO.box} material={mats.canopy} position={[0, DECK_Y + 1.42, -0.48]} scale={[2.0, 0.1, 3.4]} castShadow />
          <mesh geometry={GEO.box} material={mats.white} position={[0, DECK_Y + 1.5, -0.48]} scale={[2.05, 0.05, 3.45]} />
          <mesh geometry={GEO.box} material={glowMat('#fff1c9', 1.8)} position={[0, DECK_Y + 1.35, -0.48]} scale={[1.7, 0.02, 3.1]} />
          {/* luces de navegación: roja a babor, verde a estribor */}
          <mesh geometry={GEO.sphereSmooth} material={glowMat('#ff4d4d', 2.4, { dayGlow: 0.3 })} position={[-0.95, 0.66, 1.4]} scale={0.16} />
          <mesh geometry={GEO.sphereSmooth} material={glowMat('#3ddc84', 2.4, { dayGlow: 0.3 })} position={[0.95, 0.66, 1.4]} scale={0.16} />
        </group>
      </group>
      {GROUPS.flatMap((grp, gi) =>
        SEATS.map((_, i) => (
          <group key={`${gi}${i}`} ref={(g) => void (people.current[gi * SEATS.length + i] = g)} visible={false}>
            <Person color={grp.colors[i]} skin={grp.skins[i]} />
          </group>
        )),
      )}
    </group>
  )
}
