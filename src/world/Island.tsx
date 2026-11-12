import { useFrame } from '@react-three/fiber'
import { type ReactElement, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ISLAND, ISLAND_DECK as DECK, ISLAND_RING, ISLAND_RUNWAY, ISLAND_SECTORS, ISLAND_WALK, SPACES, insideSpace, spaceFrontPoint, toWorld } from '../config/mall'
import { useIsNight } from '../lib/useIsNight'
import { islandPlaneAnchor } from '../airport/anchor'
import { LANDING_MS, TAKEOFF_MS, TAXI_FRAC, TOUCHDOWN, useFlight } from '../airport/flight'
import { cameraState } from './cameraState'
import { AirplaneModel } from './Airport'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, EntranceGate, Garita, STONE, STONE_DARK } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, mat } from './materials'
import { glowMat, lightPoolMat, nightVolumeMat } from './night'
import { Person } from './Person'
import { RunwayLights } from './RunwayLights'

// Isla Tecnología: un castillo-isla de forma irregular (sigue la costa, con baluartes) que
// por dentro es un mini-mall de una planta: plaza con fuente y cuatro pasillos por sector (Moda,
// Tecnología, Belleza, Lifestyle) con sus arcos de color, como en la fortaleza. Los locales los pone
// Scene (mismo estilo que el resto del mall). Base de piedra con talud, murallas con almenas,
// garitas, puerta en la diagonal hacia la pista, playa, rocas, focos de noche y un globo con el %.

const C = { x: ISLAND.x, z: ISLAND.z }
const WT = 1.6
const WH = 3.2
const TECH_BLUE = '#5b8cff'
const CYAN = '#38e0ff'
const IRON = '#2f3437'
/**
 * Contorno del castillo (relativo al centro), en sentido horario visto desde arriba. Irregular:
 * baluartes que salen hacia el mar y entrantes, como una fortaleza que sigue la costa.
 */
const OUTLINE: [number, number][] = [
  [0, -27], [9, -25.5], [12.5, -28.5], [19, -22], [24.5, -13], [28, -9], [27, 2], [24.5, 10],
  [21, 13], // puerta: entre este vértice y el siguiente
  [13, 21], [10, 24.5], [2, 27], [-9, 28], [-13, 25], [-22, 19.5], [-26, 10], [-29, 4], [-27, -7],
  [-24.5, -14], [-19, -22], [-22, -26.5], [-11, -26],
]
const GATE_EDGE = 8
/** Vértices con garita (los salientes). */
const TOWERS = [2, 5, 13, 16, 20]

/** Tramo de muralla con almenas y cordón entre dos puntos del contorno (en el mundo). */
function WallRun({ a, b, gap = 0 }: { a: [number, number]; b: [number, number]; gap?: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const rot = Math.atan2(b[0] - a[0], b[1] - a[1])
  const segs = gap > 0 ? [[-len / 2, -gap / 2], [gap / 2, len / 2]] : [[-len / 2, len / 2]]
  return (
    <group position={[(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]} rotation={[0, rot, 0]}>
      {segs.map(([z0, z1]) => {
        const l = z1 - z0
        const n = Math.max(1, Math.floor(l / 1.6))
        const mz = (z0 + z1) / 2
        return (
          <group key={z0}>
            <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, (WH - 1.6) / 2, mz]} scale={[WT, WH + 1.6, l + WT * 0.6]} castShadow receiveShadow />
            <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, WH - 0.4, mz]} scale={[WT + 0.14, 0.14, l + WT * 0.6]} />
            {Array.from({ length: n }, (_, k) => (
              <mesh key={k} geometry={GEO.box} material={mat(STONE[1])} position={[0, WH + 0.3, mz + (k - (n - 1) / 2) * (l / n)]} scale={[0.6, 0.6, 0.85]} castShadow />
            ))}
          </group>
        )
      })}
    </group>
  )
}


/**
 * Aeropuerto de la isla (en el marco de la pista; −x local mira al mar y a la cámara): plataforma
 * de piedra, terminal con vidrio y letrero, torre de control con baliza y faroles.
 */
function islandSign() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 300
  const g = c.getContext('2d')!
  g.fillStyle = '#16325c'
  g.beginPath()
  g.roundRect(0, 0, 1024, 300, 48)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = '700 150px system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.fillText('✈', 50, 150)
  g.font = '800 104px system-ui, sans-serif'
  g.fillText('AEROPUERTO', 250, 110)
  g.fillStyle = '#9fd8ff'
  g.font = '600 56px system-ui, sans-serif'
  g.fillText('Isla Tecnología', 254, 215)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
}

function IslandAirport() {
  const sign = useMemo(() => islandSign(), [])
  const glass = glowMat('#ffd9a0', 1.9, { dayGlow: 0.22 })
  const PX = -8.5
  return (
    <group>
      {/* plataforma de piedra junto a la pista */}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[PX, -0.6, -2]} scale={[10, 1.6, 18]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[PX, 0.17, -2]} scale={[10.1, 0.08, 18.1]} />
      <mesh geometry={GEO.box} material={mat('#d6d8d6')} position={[PX, 0.2, -2]} scale={[9.6, 0.02, 17.6]} receiveShadow />
      {/* terminal */}
      <group position={[PX - 1, 0.2, 1]}>
        <mesh geometry={GEO.box} material={mat('#f4f1ea')} position={[0, 1.5, 0]} scale={[5.5, 3, 8]} castShadow receiveShadow />
        {[1, -1].map((s) => (
          <mesh key={s} geometry={GEO.box} material={glass} position={[s * 2.77, 1.35, 0]} scale={[0.04, 2, 7.2]} />
        ))}
        <mesh geometry={GEO.box} material={mat('#3c4651')} position={[0, 3.12, 0]} scale={[6.6, 0.24, 9]} castShadow />
        <mesh geometry={GEO.box} material={mat('#38bdf8')} position={[0, 2.95, 0]} scale={[6.62, 0.1, 9.02]} />
        <mesh geometry={GEO.plane} material={sign} position={[-3.32, 3.9, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[5.2, 1.52, 1]} />
        <mesh geometry={GEO.plane} material={sign} position={[3.32, 3.9, 0]} rotation={[0, Math.PI / 2, 0]} scale={[5.2, 1.52, 1]} />
        <mesh geometry={GEO.box} material={mat('#2f3437')} position={[0, 3.6, 0]} scale={[0.12, 0.8, 4]} />
      </group>
      {/* torre de control */}
      <group position={[PX - 0.5, 0.2, -8]}>
        <mesh geometry={GEO.cylinder} material={mat('#f4f1ea')} position={[0, 3, 0]} scale={[1.2, 6, 1.2]} castShadow />
        <mesh geometry={GEO.cylinder} material={mat('#38bdf8')} position={[0, 4.4, 0]} scale={[1.28, 0.2, 1.28]} />
        <mesh geometry={GEO.cylinder} material={mat('#3c4651')} position={[0, 6.1, 0]} scale={[2.2, 0.22, 2.2]} />
        <mesh geometry={GEO.cylinder} material={glowMat('#bfe6ff', 1.8, { dayGlow: 0.3 })} position={[0, 6.75, 0]} scale={[2, 1.05, 2]} />
        <mesh geometry={GEO.cylinder} material={mat('#3c4651')} position={[0, 7.38, 0]} scale={[2.4, 0.2, 2.4]} castShadow />
        <mesh geometry={GEO.sphereSmooth} material={glowMat('#ff4d4d', 2.6, { dayGlow: 0.6 })} position={[0, 8, 0]} scale={0.24} />
      </group>
      {/* faroles */}
      {[[PX + 3.8, -9.5], [PX + 3.8, 5.5], [PX - 3.8, 6.5]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.2, z]}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.5, 0]} scale={[0.1, 3, 0.1]} />
          <mesh geometry={GEO.box} material={glowMat('#bff6ff', 2.4, { dayGlow: 0.55 })} position={[0, 3.05, 0]} scale={[0.5, 0.12, 0.5]} />
          <mesh geometry={GEO.box} material={glowMat(CYAN, 1.8, { dayGlow: 0.5 })} position={[0, 1.6, 0]} scale={[0.04, 2.4, 0.12]} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#7fe3f0', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} scale={[4, 4, 1]} />
        </group>
      ))}
    </group>
  )
}

/**
 * El avión en la isla: aterriza (llega bajando desde el mar, toca la pista, frena) y queda en la
 * pista. Fuera del aterrizaje se ve estacionado donde frenó. Marco de la pista: nariz hacia −z.
 */
const PARK_Z = 2
function IslandPlane() {
  const g = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const wp = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, gl }) => {
    const p = g.current
    if (!p) return
    const { step, landingAt, takeoffAt, world } = useFlight.getState()
    let z = PARK_Z
    let y = 0.2
    let pitch = 0
    let heading = Math.PI
    const landing = step === 'landing'
    p.visible = (landing || world === 'island' || step === 'arrived') && step !== 'flying'
    if (step === 'departIsland') {
      // despegue: gira, rueda a la cabecera (+z), vuelve a girar y despega hacia −z sobre el mar
      const t = Math.min(1, (performance.now() - takeoffAt) / TAKEOFF_MS)
      const HEAD = RUN.len / 2 - 2.5
      const ease = (v: number) => v * v * (3 - 2 * v)
      if (t < 0.12) heading = Math.PI - Math.PI * ease(t / 0.12)
      else if (t < 0.38) {
        heading = 0
        z = PARK_Z + (HEAD - PARK_Z) * ease((t - 0.12) / 0.26)
      } else if (t < TAXI_FRAC) {
        z = HEAD
        heading = Math.PI * ease((t - 0.38) / (TAXI_FRAC - 0.38))
      } else {
        const b = (t - TAXI_FRAC) / (1 - TAXI_FRAC)
        z = HEAD - (HEAD + RUN.len / 2 + 60) * b * b
        const lift = Math.max(0, -(RUN.len / 2 - 7) - z)
        y = 0.2 + Math.pow(lift, 1.2) * 0.3
        pitch = Math.min(0.3, lift * 0.035)
      }
    } else if (landing) {
      const t = Math.min(1, (performance.now() - landingAt) / LANDING_MS)
      const TD = RUN.len / 2 - 3
      if (t < TOUCHDOWN) {
        // aproximación: baja en línea recta desde el mar
        const u = t / TOUCHDOWN
        z = TD + 55 * (1 - u)
        y = 0.2 + 13 * Math.pow(1 - u, 1.15)
        pitch = 0.04 + (u > 0.8 ? (u - 0.8) * 0.6 : 0)
      } else {
        // carrera de frenado
        const u = (t - TOUCHDOWN) / (1 - TOUCHDOWN)
        const e = 1 - (1 - u) * (1 - u)
        z = TD + (PARK_Z - TD) * e
        pitch = Math.max(0, 0.12 - u * 0.6)
      }
    }
    p.position.set(0.6, y, z)
    p.rotation.set(pitch, heading, 0)
    // ancla en pantalla para la invitación de regreso (sobre el avión)
    p.getWorldPosition(wp)
    wp.y += 4.5
    wp.project(camera)
    const r = gl.domElement.getBoundingClientRect()
    islandPlaneAnchor.x = r.left + ((wp.x + 1) / 2) * r.width
    islandPlaneAnchor.y = r.top + ((1 - wp.y) / 2) * r.height
    islandPlaneAnchor.visible = wp.z < 1
    if (shadow.current) {
      shadow.current.visible = p.visible
      shadow.current.position.set(0.6 + (y - 0.2) * 0.15, 0.24, z)
      shadow.current.scale.set(7 / (1 + (y - 0.2) * 0.08), 0.02, 9 / (1 + (y - 0.2) * 0.08))
    }
  })
  return (
    <group position={[ISLAND_RUNWAY.x, 0, ISLAND_RUNWAY.z]} rotation={[0, ISLAND_RUNWAY.rot, 0]}>
      <mesh ref={shadow} geometry={GEO.sphere} material={mat('#0b2a33', { opacity: 0.22 })} />
      <group
        ref={g}
        onClick={(e) => {
          if (cameraState.handMode || e.delta > 8 || useFlight.getState().step) return
          e.stopPropagation()
          useFlight.getState().setReturnOpen(!useFlight.getState().returnOpen)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <AirplaneModel stairs={false} />
        {/* área táctil generosa */}
        <mesh geometry={GEO.box} position={[0, 1.5, 0]} scale={[11, 4, 11]}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * Puente de la entrada a la pista (local: +z hacia la pista): tablero de piedra clara sobre arcos,
 * barandas con pilares, faroles y una franja de luz cálida que de noche guía hacia el mall.
 */
function Bridge({ from, to }: { from: number; to: number }) {
  const len = to - from
  const mid = (from + to) / 2
  const BW = 3.6
  const piers = Math.max(2, Math.round(len / 3))
  return (
    <group>
      {/* tablero y cordón */}
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[0, 0.02, mid]} scale={[BW, 0.36, len]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat('#e6d3ad')} position={[0, 0.21, mid]} scale={[BW - 0.6, 0.02, len]} receiveShadow />
      <mesh geometry={GEO.box} material={glowMat('#ffcf8a', 1.4, { dayGlow: 0 })} position={[0, 0.225, mid]} scale={[0.12, 0.01, len - 0.4]} />
      {/* arcos sobre el agua */}
      {Array.from({ length: piers + 1 }, (_, k) => (
        <mesh key={k} geometry={GEO.box} material={mat(STONE[0])} position={[0, -0.75, from + (k * len) / piers]} scale={[BW - 0.2, 1.3, 0.7]} castShadow />
      ))}
      {Array.from({ length: piers }, (_, k) => (
        <mesh key={k} geometry={GEO.halfDisc} material={mat(STONE[1])} position={[0, -1.3, from + ((k + 0.5) * len) / piers]} rotation={[0, Math.PI / 2, 0]} scale={[len / piers / 2 - 0.35, BW - 0.3, 0.9]} />
      ))}
      {/* barandas con pilares */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={mat(CORDON)} position={[s * (BW / 2 - 0.12), 0.75, mid]} scale={[0.18, 0.1, len]} />
          {Array.from({ length: Math.round(len / 1.2) + 1 }, (_, k) => (
            <mesh key={k} geometry={GEO.box} material={mat(STONE[1])} position={[s * (BW / 2 - 0.12), 0.48, from + (k * len) / Math.round(len / 1.2)]} scale={[0.16, 0.55, 0.16]} />
          ))}
          {/* faroles en los extremos y al centro */}
          {[from + 0.4, mid, to - 0.4].map((z) => (
            <group key={z} position={[s * (BW / 2 - 0.12), 0.2, z]}>
              <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.1, 0]} scale={[0.09, 1.9, 0.09]} />
              <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.5 })} position={[0, 2.15, 0]} scale={0.34} />
              <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.8)} rotation={[-Math.PI / 2, 0, 0]} position={[-s * 0.9, 0.05, 0]} scale={[3, 3, 1]} />
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Pista de aterrizaje: muelle de piedra frente a la puerta, en la diagonal. */
const RUN = { d: 40, len: 30, w: 4 }

function Castle() {
  const pts = useMemo(() => OUTLINE.map(([x, z]) => [C.x + x, C.z + z] as [number, number]), [])
  // base y suelo: polígono extruido (arena por dentro, talud de piedra por fuera)
  const shapes = useMemo(() => {
    const mk = (scale: number, depth: number) => {
      const shape = new THREE.Shape(OUTLINE.map(([x, z]) => new THREE.Vector2(x * scale, -z * scale)))
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
      g.rotateX(-Math.PI / 2)
      return g
    }
    return { ground: mk(0.97, 1.6), talud: mk(1.06, 1.1), beach: mk(1.22, 0.4) }
  }, [])
  // garitas en los salientes
  const towers = TOWERS.map((i) => pts[i])
  const walkRing = useMemo(() => new THREE.RingGeometry(ISLAND_WALK - 2, ISLAND_WALK + 2, 72), [])
  const lamps = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = Math.PI / 4 + 0.17 + (i * 2 * Math.PI) / 18
        return [C.x + Math.sin(a) * ISLAND_WALK, C.z + Math.cos(a) * ISLAND_WALK] as [number, number]
      }).filter(([x, z]) => !insideSpace(x, z, 0.6) && !onDeck(x, z, 0.8)),
    [],
  )
  const ga = pts[GATE_EDGE]
  const gb = pts[GATE_EDGE + 1]
  const gm: [number, number] = [(ga[0] + gb[0]) / 2, (ga[1] + gb[1]) / 2]
  const diag = Math.PI / 4
  const runC = toWorld([0, RUN.d], diag)
  return (
    <group>
      {/* playa, talud de piedra hasta el mar y suelo del castillo */}
      <mesh geometry={shapes.beach} material={mat('#f1dfb5')} position={[C.x, -0.85, C.z]} receiveShadow />
      <mesh geometry={shapes.talud} material={mat(STONE_DARK)} position={[C.x, -1.25, C.z]} />
      <mesh geometry={shapes.ground} material={mat('#dfe4ea')} position={[C.x, -1.6, C.z]} receiveShadow />
      {[
        [-31, 8, 1.5], [-26, -24, 1.2], [16, -30, 1.3], [30, -14, 1.1], [-4, 31, 1.2], [-25, 24, 1],
      ].map(([dx, dz, s]) => (
        <mesh key={`${dx}${dz}`} geometry={GEO.sphere} material={mat('#9c9184')} position={[C.x + dx, -0.5, C.z + dz]} scale={[s * 1.6, s, s * 1.3]} />
      ))}
      {/* murallas siguiendo el contorno; la de la puerta se abre */}
      {pts.map((a, i) => {
        const b = pts[(i + 1) % pts.length]
        return <WallRun key={i} a={a} b={b} gap={i === GATE_EDGE ? 8.6 : 0} />
      })}
      {/* garitas sobre torres redondas en los salientes */}
      {towers.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[x, (WH - 1.6) / 2, z]} scale={[3.6, WH + 1.6, 3.6]} castShadow />
          <Garita x={x} z={z} y={WH} />
        </group>
      ))}
      {/* entrada monumental (como la del mall), con su letrero y torres, y el puente a la pista */}
      <group position={[gm[0], 0, gm[1]]} rotation={[0, diag, 0]}>
        <EntranceGate width={8.6} title="ISLA TECNOLOGÍA" tagline="Celulares · Gaming · Computación · Smart Home" paths={false} roofColor="#2b3a5c" />
        {[-1, 1].map((s) => (
          <Garita key={s} x={s * 5.3} z={0.2} y={WH + 0.9} />
        ))}
        <Bridge from={3.9} to={Math.hypot(gm[0] - C.x, gm[1] - C.z) > 0 ? RUN.d - 4 - Math.hypot(gm[0] - C.x, gm[1] - C.z) + 0.4 : 12} />
      </group>
      {/* plaza central elevada con fuente */}
      <mesh geometry={GEO.cylinder} material={mat('#cfd6df')} position={[C.x, 0.1, C.z]} scale={[2 * (ISLAND_RING - 2.6), 0.2, 2 * (ISLAND_RING - 2.6)]} receiveShadow />
      {/* paseo entre los dos anillos de locales */}
      <mesh geometry={walkRing} material={mat('#c3ccd7')} position={[C.x, 0.13, C.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#c9d1db')} position={[C.x, 0.22, C.z]} scale={[9, 0.04, 9]} receiveShadow />
      {/* camino de la plaza a la puerta (diagonal) */}
      {(() => {
        const from = ISLAND_RING - 2.4
        const to = Math.hypot(gm[0] - C.x, gm[1] - C.z) - 1
        const [mx, mz] = toWorld([0, (from + to) / 2], diag)
        return <mesh geometry={GEO.box} material={mat('#c3ccd7')} position={[C.x + mx, 0.12, C.z + mz]} rotation={[0, diag, 0]} scale={[3.4, 0.04, to - from]} receiveShadow />
      })()}
      {/* faroles y palmeras de los paseos */}
      {lamps.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.2, z]}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.5, 0]} scale={[0.1, 3, 0.1]} />
          <mesh geometry={GEO.box} material={glowMat('#bff6ff', 2.4, { dayGlow: 0.55 })} position={[0, 3.05, 0]} scale={[0.5, 0.12, 0.5]} />
          <mesh geometry={GEO.box} material={glowMat(CYAN, 1.8, { dayGlow: 0.5 })} position={[0, 1.6, 0]} scale={[0.04, 2.4, 0.12]} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#7fe3f0', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} scale={[4, 4, 1]} />
        </group>
      ))}
      {/* pista de aterrizaje sobre un muelle de piedra, en la diagonal frente a la puerta */}
      <group position={[C.x + runC[0], 0, C.z + runC[1]]} rotation={[0, diag + Math.PI / 2, 0]}>
        <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, -0.6, 0]} scale={[RUN.w + 4, 1.6, RUN.len + 2]} castShadow receiveShadow />
        <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 0.17, 0]} scale={[RUN.w + 4.1, 0.08, RUN.len + 2.1]} />
        <mesh geometry={GEO.box} material={mat('#4a525b')} position={[0.6, 0.22, 0]} scale={[RUN.w, 0.04, RUN.len]} receiveShadow />
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} geometry={GEO.box} material={mat('#f4f1ea')} position={[0.6, 0.25, -RUN.len / 2 + 2.5 + i * 3.1]} scale={[0.14, 0.01, 1.3]} />
        ))}
        {[-1, 1].flatMap((s) =>
          Array.from({ length: 9 }, (_, i) => (
            <mesh key={`${s}${i}`} geometry={GEO.sphere} material={mat('#cfd4da')} position={[0.6 + s * (RUN.w / 2 + 0.25), 0.32, -RUN.len / 2 + (i * RUN.len) / 8]} scale={0.2} />
          )),
        )}
        <IslandAirport />
      </group>
      {/* focos de las garitas hacia el cielo (de noche) */}
      {[pts[2], pts[13], pts[20]].map(([x, z], i) => (
        <mesh key={i} geometry={GEO.cone} material={nightVolumeMat('#fff1c9', 0.22)} position={[x, WH + 9, z]} rotation={[i === 1 ? -0.3 : 0.3, 0, i === 2 ? 0.35 : -0.3]} scale={[3.2, 16, 3.2]} />
      ))}
    </group>
  )
}

/** Gente paseando por la plaza, alrededor de la fuente. */
function Strollers({ reduceMotion }: { reduceMotion: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const walkers = useMemo(
    () =>
      ['#e07a5f', '#3d7ea6', '#f2cc8f', '#2a9d8f', '#9b5de5', '#f15bb5'].map((c, i) => ({
        c,
        r: 4.6 + (i % 2) * 1.2,
        speed: (0.2 + (i % 3) * 0.04) * (i % 2 ? 1 : -1),
        phase: (i / 6) * Math.PI * 2,
      })),
    [],
  )
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    walkers.forEach((w, i) => {
      const g = refs.current[i]
      if (!g) return
      const a = w.phase + t * w.speed
      g.position.set(C.x + Math.sin(a) * w.r, 0.24 + Math.abs(Math.sin(t * 6 + i)) * 0.03, C.z + Math.cos(a) * w.r)
      g.rotation.y = a + (w.speed > 0 ? Math.PI / 2 : -Math.PI / 2)
    })
  })
  return (
    <group>
      {walkers.map((w, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Person color={w.c} skin={['#e5b48f', '#8d5a3b', '#c58c64'][i % 3]} />
        </group>
      ))}
    </group>
  )
}

/** Globo aerostático a rayas con el %, que flota sobre la isla. */
function Balloon({ reduceMotion }: { reduceMotion: boolean }) {
  const g = useRef<THREE.Group>(null)
  const pct = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')!
    x.fillStyle = '#ffffff'
    x.font = '900 96px system-ui, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText('⚡', 64, 70)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })
  }, [])
  useFrame(({ clock }) => {
    if (!g.current || reduceMotion) return
    const t = clock.elapsedTime
    g.current.position.y = 18 + Math.sin(t * 0.5) * 0.8
    g.current.rotation.y = Math.sin(t * 0.2) * 0.3
  })
  return (
    <group ref={g} position={[C.x + 18, 18, C.z - 26]}>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} geometry={GEO.sphereSmooth} material={mat(k % 2 ? '#ffffff' : TECH_BLUE, { rough: 0.6 })} rotation={[0, (k * Math.PI) / 6, 0]} scale={[3.6, 4.2, 0.9 + k * 0.5]} />
      ))}
      <mesh geometry={GEO.plane} material={pct} position={[0.7, 0.2, 1.75]} rotation={[0, Math.PI / 4, 0]} scale={[1.8, 1.8, 1]} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={GEO.box} material={mat('#6b4a2f')} position={[sx * 0.55, -2.6, sz * 0.55]} scale={[0.04, 1.6, 0.04]} />),
      )}
      <mesh geometry={GEO.box} material={mat('#8a5a3a')} position={[0, -3.6, 0]} scale={[1.3, 0.8, 1.3]} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffb347', 2.4, { dayGlow: 0.3 })} position={[0, -2.2, 0]} scale={0.35} />
    </group>
  )
}

/** ¿El punto cae bajo la terraza del segundo piso (más `m`)? */
function onDeck(x: number, z: number, m = 0) {
  return Math.abs(x - (C.x + DECK.x)) < DECK.half + m && Math.abs(z - (C.z + DECK.z)) < DECK.half + m
}

/**
 * Caminos tipo circuito en el piso: de la fuente a cada local del anillo interior (con un quiebre y
 * nodos), del paseo a cada local del anillo exterior, anillos luminosos y tótems con pantalla.
 * Estático: va en el Batch.
 */
function TechCircuits() {
  const line = glowMat(CYAN, 1.5, { dayGlow: 0.45 })
  const lineDim = glowMat('#5b8cff', 1.2, { dayGlow: 0.35 })
  const node = glowMat('#bff6ff', 2, { dayGlow: 0.6 })
  const screen = glowMat('#2a6bff', 1.9, { dayGlow: 0.55 })
  const screen2 = glowMat('#9b5cff', 1.9, { dayGlow: 0.55 })
  const shops = SPACES.filter((sp) => sp.id.startsWith('P1-I') && !sp.elevation)
  const Y0 = 0.235
  const seg = (ax: number, az: number, bx: number, bz: number, m: THREE.Material, k: string) => {
    const len = Math.hypot(bx - ax, bz - az)
    return <mesh key={k} geometry={GEO.box} material={m} position={[(ax + bx) / 2, Y0, (az + bz) / 2]} rotation={[0, Math.atan2(bx - ax, bz - az), 0]} scale={[0.09, 0.012, len]} />
  }
  const dot = (x: number, z: number, r: number, k: string) => <mesh key={k} geometry={GEO.cylinder} material={node} position={[x, Y0 + 0.01, z]} scale={[r, 0.02, r]} />
  const at = (a: number, r: number): [number, number] => [C.x + Math.sin(a) * r, C.z + Math.cos(a) * r]
  const out: ReactElement[] = []
  shops.forEach((sp, k) => {
    const [fx, fz] = spaceFrontPoint(sp, 0.4)
    const a = Math.atan2(fx - C.x, fz - C.z)
    const inner = Math.hypot(sp.position[0] - C.x, sp.position[1] - C.z) < ISLAND_WALK
    if (inner) {
      const bend = a + (k % 2 ? 0.18 : -0.18)
      const [x0, z0] = at(a, 3.6)
      const [x1, z1] = at(bend, 6.4)
      out.push(seg(x0, z0, x1, z1, line, `a${k}`), seg(x1, z1, fx, fz, line, `b${k}`), dot(x1, z1, 0.32, `n${k}`))
    } else {
      // del paseo al frente del local, con un ramal corto al costado
      const [x1, z1] = at(a + (k % 2 ? 0.08 : -0.08), ISLAND_WALK)
      out.push(seg(x1, z1, fx, fz, line, `a${k}`), dot(x1, z1, 0.3, `n${k}`))
      const [x2, z2] = at(a + (k % 2 ? 0.2 : -0.2), ISLAND_WALK - 1.2)
      out.push(seg(x1, z1, x2, z2, lineDim, `c${k}`), dot(x2, z2, 0.2, `o${k}`))
    }
    out.push(dot(fx, fz, 0.42, `m${k}`))
  })
  // tótems con pantalla: en el paseo y entre los locales del anillo interior
  const spots: [number, number, number][] = []
  for (let k = 0; k < 20; k++) {
    const a = Math.PI / 4 + 0.32 + (k * 2 * Math.PI) / 20
    const [x, z] = at(a, ISLAND_WALK + (k % 2 ? 1.3 : -1.3))
    if (!insideSpace(x, z, 0.8) && !onDeck(x, z, 1) && Math.abs(Math.atan2(Math.sin(a - Math.PI / 4), Math.cos(a - Math.PI / 4))) > 0.3) spots.push([x, z, a])
  }
  return (
    <group>
      {out}
      {[4.6, ISLAND_RING - 2.6, ISLAND_WALK - 1.9, ISLAND_WALK + 1.9].map((r, i) => (
        <mesh key={r} geometry={GEO.torus} material={i === 0 ? line : lineDim} position={[C.x, Y0, C.z]} rotation={[Math.PI / 2, 0, 0]} scale={[r, r, 0.3]} />
      ))}
      {spots.map(([x, z, a], k) => (
        <group key={k} position={[x, 0.2, z]} rotation={[0, a + Math.PI / 2, 0]}>
          <mesh geometry={GEO.box} material={mat('#1c2433')} position={[0, 1.05, 0]} scale={[0.75, 2.1, 0.22]} castShadow />
          <mesh geometry={GEO.box} material={k % 2 ? screen2 : screen} position={[0, 1.2, 0.12]} scale={[0.6, 1.5, 0.02]} />
          <mesh geometry={GEO.box} material={k % 2 ? screen : screen2} position={[0, 1.2, -0.12]} scale={[0.6, 1.5, 0.02]} />
          <mesh geometry={GEO.box} material={node} position={[0, 0.05, 0]} scale={[0.95, 0.05, 0.4]} />
        </group>
      ))}
    </group>
  )
}

/**
 * Segundo piso: terraza cuadrada sobre columnas en la esquina del fondo, con losa, canto de piedra,
 * barandas de vidrio con borde luminoso hacia el frente, y escaleras eléctricas en diagonal desde la
 * plaza hasta su esquina del frente. Estático (va en el Batch).
 */
const ESC_BOTTOM = 4.3
const ESC_TOP = Math.SQRT2 * (-DECK.x - DECK.half) + 0.1
function IslandDeck() {
  const E = DECK.elevation
  const cx = C.x + DECK.x
  const cz = C.z + DECK.z
  const H = DECK.half
  const glass = mat('#bfe6ff', { opacity: 0.35 })
  const edge = glowMat(CYAN, 1.8, { dayGlow: 0.5 })
  const dark = mat('#1c2433')
  // escaleras: en el marco de la diagonal hacia la terraza (−x, −z)
  const ang = -3 * Math.PI / 4
  const run = ESC_TOP - ESC_BOTTOM
  const len = Math.hypot(run, E)
  const tilt = Math.atan2(E, run)
  return (
    <group>
      {/* losa, canto y faja */}
      <mesh geometry={GEO.box} material={mat('#dfe4ea')} position={[cx, E - 0.05, cz]} scale={[2 * H, 0.5, 2 * H]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[cx, E - 0.55, cz]} scale={[2 * H + 0.3, 0.5, 2 * H + 0.3]} />
      <mesh geometry={GEO.box} material={edge} position={[cx, E - 0.28, cz]} scale={[2 * H + 0.34, 0.06, 2 * H + 0.34]} />
      {/* columnas hasta el suelo */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[cx + sx * (H - 0.6), 0, cz + sz * (H - 0.6)]}>
            <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, (E - 0.8) / 2 + 0.2, 0]} scale={[0.9, E - 0.6, 0.9]} castShadow />
            <mesh geometry={GEO.box} material={edge} position={[0, (E - 0.8) / 2 + 0.2, 0]} scale={[0.92, 0.12, 0.92]} />
          </group>
        )),
      )}
      {/* barandas de vidrio en los dos lados del frente, con hueco para las escaleras en la esquina */}
      {[
        [cx + H - 0.1, cz - 1.4, 0.1, 2 * H - 2.8],
        [cx - 1.4, cz + H - 0.1, 2 * H - 2.8, 0.1],
      ].map(([x, z, w, d]) => (
        <group key={`${x}${z}`}>
          <mesh geometry={GEO.box} material={glass} position={[x, E + 0.65, z]} scale={[w, 0.9, d]} />
          <mesh geometry={GEO.box} material={edge} position={[x, E + 1.12, z]} scale={[w + 0.04, 0.06, d + 0.04]} />
        </group>
      ))}
      {/* piso con rejilla luminosa */}
      {[-2, 0, 2].map((o) => (
        <group key={o}>
          <mesh geometry={GEO.box} material={glowMat('#5b8cff', 1.2, { dayGlow: 0.35 })} position={[cx + o, E + 0.21, cz]} scale={[0.06, 0.01, 2 * H - 1]} />
          <mesh geometry={GEO.box} material={glowMat('#5b8cff', 1.2, { dayGlow: 0.35 })} position={[cx, E + 0.21, cz + o]} scale={[2 * H - 1, 0.01, 0.06]} />
        </group>
      ))}
      {/* escaleras eléctricas: dos carriles con vidrio y pasamanos luminosos */}
      <group position={[C.x, 0, C.z]} rotation={[0, ang, 0]}>
        {[-0.8, 0.8].map((lx) => (
          <group key={lx} position={[lx, 0.2 + E / 2, ESC_BOTTOM + run / 2]} rotation={[-tilt, 0, 0]}>
            <mesh geometry={GEO.box} material={mat('#c9ccd1')} position={[0, -0.25, 0]} scale={[1.5, 0.5, len]} castShadow />
            <mesh geometry={GEO.box} material={mat('#8f959d')} position={[0, 0.02, 0]} scale={[1.3, 0.04, len]} />
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh geometry={GEO.box} material={glass} position={[s * 0.75, 0.45, 0]} scale={[0.05, 0.85, len]} />
                <mesh geometry={GEO.box} material={edge} position={[s * 0.75, 0.9, 0]} scale={[0.1, 0.06, len + 0.3]} />
              </group>
            ))}
          </group>
        ))}
        <mesh geometry={GEO.box} material={dark} position={[0, 0.25, ESC_BOTTOM - 0.7]} scale={[3.6, 0.1, 1.4]} />
        <mesh geometry={GEO.box} material={dark} position={[0, E + 0.25, ESC_TOP + 0.6]} scale={[3.6, 0.1, 1.2]} />
      </group>
    </group>
  )
}

/** Fuente holográfica: base oscura, agua luminosa, globo de malla que gira, anillos y paneles flotantes. */
function HoloFountain({ reduceMotion }: { reduceMotion: boolean }) {
  const globe = useRef<THREE.Group>(null)
  const rings = useRef<THREE.Group>(null)
  const panels = useRef<THREE.Group>(null)
  const wire = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7fe9ff', wireframe: true, transparent: true, opacity: 0.85, toneMapped: false }), [])
  const holo = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4fd8ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), [])
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    if (globe.current) globe.current.rotation.y = t * 0.4
    if (rings.current) {
      rings.current.children[0].rotation.z = t * 0.6
      rings.current.children[1].rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.3
    }
    if (panels.current) {
      panels.current.rotation.y = -t * 0.25
      panels.current.position.y = Math.sin(t * 1.2) * 0.12
    }
  })
  return (
    <group position={[C.x, 0.2, C.z]}>
      <mesh geometry={GEO.cylinder} material={mat('#1c2433')} position={[0, 0.3, 0]} scale={[5.4, 0.6, 5.4]} castShadow />
      <mesh geometry={GEO.cylinder} material={glowMat(CYAN, 1.8, { dayGlow: 0.55 })} position={[0, 0.62, 0]} scale={[4.7, 0.06, 4.7]} />
      <mesh geometry={GEO.cylinder} material={mat('#2b3a5c')} position={[0, 0.66, 0]} scale={[3.6, 0.06, 3.6]} />
      <mesh geometry={GEO.cylinder} material={glowMat('#2a6bff', 2, { dayGlow: 0.6 })} position={[0, 0.72, 0]} scale={[1.6, 0.06, 1.6]} />
      <mesh geometry={GEO.cylinder} material={mat('#1c2433')} position={[0, 1.2, 0]} scale={[0.35, 1, 0.35]} />
      <mesh geometry={GEO.cone} material={holo} position={[0, 1.95, 0]} scale={[1.6, 1.4, 1.6]} />
      <group ref={globe} position={[0, 3.1, 0]}>
        <mesh geometry={GEO.sphere} material={wire} scale={1.9} />
        <mesh geometry={GEO.sphereSmooth} material={glowMat('#bff6ff', 2.2, { dayGlow: 0.6 })} scale={0.6} />
      </group>
      <group ref={rings} position={[0, 3.1, 0]}>
        <mesh geometry={GEO.torus} material={glowMat(CYAN, 2, { dayGlow: 0.6 })} rotation={[Math.PI / 2, 0, 0]} scale={[1.45, 1.45, 0.5]} />
        <mesh geometry={GEO.torus} material={glowMat('#9b5cff', 2, { dayGlow: 0.6 })} scale={[1.25, 1.25, 0.45]} />
      </group>
      <group ref={panels} position={[0, 0, 0]}>
        {[0, 1, 2, 3].map((k) => {
          const a = (k * Math.PI) / 2 + Math.PI / 4
          return <mesh key={k} geometry={GEO.plane} material={holo} position={[Math.sin(a) * 2.6, 2.6, Math.cos(a) * 2.6]} rotation={[0, a, 0]} scale={[1.1, 1.4, 1]} />
        })}
      </group>
      <mesh geometry={GEO.plane} material={lightPoolMat('#4fd8ff', 1.1)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={[12, 12, 1]} />
    </group>
  )
}

/** Rubro sugerido de cada local, flotando sobre él al acercarse. */
function SectorLabels() {
  const night = useIsNight()
  const shops = useMemo(() => SPACES.filter((sp) => sp.id.startsWith('P1-I')), [])
  const labels = useMemo(() => shops.map((_, k) => getGlassPill(ISLAND_SECTORS[k % ISLAND_SECTORS.length], { dot: CYAN, dark: night })), [night, shops])
  return (
    <>
      {shops.map((sp, k) => (
        <ScreenLabel key={sp.id} label={labels[k]} position={[sp.position[0], 5.2 + (sp.elevation ?? 0), sp.position[1]]} pixelHeight={22} minZoomRatio={1.05} priority={LABEL_PRIORITY.section} />
      ))}
    </>
  )
}

export function Island({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const label = useMemo(() => getGlassPill('Isla Tecnología', { dot: TECH_BLUE, sub: 'Celulares · Gaming · Computación · Smart Home', dark: night }), [night])
  return (
    <group>
      <Batch version="isla-mall">
        <Castle />
        <TechCircuits />
        <IslandDeck />
      </Batch>
      <IslandPlane />
      <HoloFountain reduceMotion={reduceMotion} />
      <SectorLabels />
      <group position={[ISLAND_RUNWAY.x, 0, ISLAND_RUNWAY.z]} rotation={[0, ISLAND_RUNWAY.rot, 0]}>
        <RunwayLights cx={0.6} z0={-RUN.len / 2} z1={RUN.len / 2} w={RUN.w} y={0.22} dir={-1} />
      </group>
      <Strollers reduceMotion={reduceMotion} />
      <Balloon reduceMotion={reduceMotion} />
      <ScreenLabel label={label} position={[C.x - 3, 12, C.z - 3]} pixelHeight={38} maxZoomRatio={2.6} priority={LABEL_PRIORITY.floorSign + 5} />
    </group>
  )
}
