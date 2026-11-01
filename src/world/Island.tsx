import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ISLAND, ISLAND_RUNWAY, ISLAND_WING, P1, insideSpace, toWorld } from '../config/mall'
import type { ZoneConfig } from '../domain/types'
import { useIsNight } from '../lib/useIsNight'
import { islandPlaneAnchor } from '../airport/anchor'
import { LANDING_MS, TOUCHDOWN, useFlight } from '../airport/flight'
import { cameraState } from './cameraState'
import { AirplaneModel } from './Airport'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, EntranceGate, Garita, STONE, STONE_DARK } from './Fortress'
import { getGlassPill, getZoneSign } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat, shade } from './materials'
import { dimLabelMat, glowMat, lightPoolMat, nightVolumeMat } from './night'
import { Person } from './Person'
import { RunwayLights } from './RunwayLights'

// Isla de los Descuentos: un castillo-isla de forma irregular (sigue la costa, con baluartes) que
// por dentro es un mini-mall de una planta: plaza con fuente y cuatro pasillos por sector (Moda,
// Tecnología, Belleza, Lifestyle) con sus arcos de color, como en la fortaleza. Los locales los pone
// Scene (mismo estilo que el resto del mall). Base de piedra con talud, murallas con almenas,
// garitas, puerta en la diagonal hacia la pista, playa, rocas, focos de noche y un globo con el %.

const C = { x: ISLAND.x, z: ISLAND.z }
const WT = 1.6
const WH = 3.2
const PINK = '#e85a8a'
const IRON = '#2f3437'
const PLAZA = 7.5
const W = ISLAND_WING
const WW = W.corridorHalf + 5.4
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

/** Pasillo de un sector: piso, camino del color de la zona, muros bajos y arco con su letrero. */
function Wing({ zone }: { zone: ZoneConfig }) {
  const len = W.end - PLAZA
  const mid = PLAZA + len / 2
  const sign = useMemo(() => getZoneSign(zone.id, zone.name.toUpperCase(), zone.color), [zone])
  const wall = mat(PALETTE.wall)
  const trim = mat(PALETTE.trim)
  const CW = W.corridorHalf
  return (
    <group position={[C.x, 0, C.z]} rotation={[0, zone.angle, 0]}>
      <mesh geometry={GEO.box} material={mat(PALETTE.floor)} position={[0, 0.1, mid]} scale={[WW * 2, 0.2, len]} receiveShadow />
      <mesh geometry={GEO.box} material={mat(shade(zone.color, 0.72))} position={[0, 0.205, mid]} scale={[CW * 1.1, 0.02, len - 0.6]} receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={wall} position={[s * (WW - 0.15), 0.9, mid + 0.2]} scale={[0.3, 1.4, len + 0.4]} castShadow receiveShadow />
          <mesh geometry={GEO.box} material={trim} position={[s * (WW - 0.15), 1.64, mid + 0.2]} scale={[0.4, 0.08, len + 0.5]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={wall} position={[0, 0.9, W.end + 0.3]} scale={[WW * 2, 1.4, 0.3]} castShadow />
      {/* arco de entrada del sector */}
      <group position={[0, 0.2, PLAZA + 0.4]}>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.rounded} material={wall} position={[s * (CW + 0.2), 1.9, 0]} scale={[0.55, 3.8, 0.55]} castShadow />
        ))}
        <mesh geometry={GEO.rounded} material={mat(zone.color)} position={[0, 3.95, 0]} scale={[CW * 2 + 1.2, 0.7, 0.5]} castShadow />
        {[1, -1].map((s) => (
          <group key={s} position={[0, 3.95, s * 0.3]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <mesh geometry={GEO.rounded} material={mat(shade(zone.color, -0.25))} position={[0, 0, -0.04]} scale={[1.36 * sign.aspect + 0.16, 1.52, 0.08]} />
            <mesh geometry={GEO.plane} material={dimLabelMat(sign.texture)} position={[0, 0, 0.01]} scale={[1.36 * sign.aspect, 1.36, 1]} />
          </group>
        ))}
      </group>
    </group>
  )
}

function Palm({ x, z, h, seed }: { x: number; z: number; h: number; seed: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(PALETTE.trunk)} position={[0, h / 2, 0]} rotation={[0.1, seed, 0]} scale={[0.3, h, 0.3]} castShadow />
      {Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * Math.PI * 2 + seed
        return <mesh key={k} geometry={GEO.box} material={mat(PALETTE.leafDark)} position={[Math.sin(a) * 0.8, h + 0.05, Math.cos(a) * 0.8]} rotation={[0.35, a, 0]} scale={[0.5, 0.08, 1.9]} castShadow />
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
  g.fillStyle = '#ffb3cb'
  g.font = '600 56px system-ui, sans-serif'
  g.fillText('Isla de los Descuentos', 254, 215)
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
        <mesh geometry={GEO.box} material={mat('#e85a8a')} position={[0, 2.95, 0]} scale={[6.62, 0.1, 9.02]} />
        <mesh geometry={GEO.plane} material={sign} position={[-3.32, 3.9, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[5.2, 1.52, 1]} />
        <mesh geometry={GEO.plane} material={sign} position={[3.32, 3.9, 0]} rotation={[0, Math.PI / 2, 0]} scale={[5.2, 1.52, 1]} />
        <mesh geometry={GEO.box} material={mat('#2f3437')} position={[0, 3.6, 0]} scale={[0.12, 0.8, 4]} />
      </group>
      {/* torre de control */}
      <group position={[PX - 0.5, 0.2, -8]}>
        <mesh geometry={GEO.cylinder} material={mat('#f4f1ea')} position={[0, 3, 0]} scale={[1.2, 6, 1.2]} castShadow />
        <mesh geometry={GEO.cylinder} material={mat('#e85a8a')} position={[0, 4.4, 0]} scale={[1.28, 0.2, 1.28]} />
        <mesh geometry={GEO.cylinder} material={mat('#3c4651')} position={[0, 6.1, 0]} scale={[2.2, 0.22, 2.2]} />
        <mesh geometry={GEO.cylinder} material={glowMat('#bfe6ff', 1.8, { dayGlow: 0.3 })} position={[0, 6.75, 0]} scale={[2, 1.05, 2]} />
        <mesh geometry={GEO.cylinder} material={mat('#3c4651')} position={[0, 7.38, 0]} scale={[2.4, 0.2, 2.4]} castShadow />
        <mesh geometry={GEO.sphereSmooth} material={glowMat('#ff4d4d', 2.6, { dayGlow: 0.6 })} position={[0, 8, 0]} scale={0.24} />
      </group>
      {/* faroles */}
      {[[PX + 3.8, -9.5], [PX + 3.8, 5.5], [PX - 3.8, 6.5]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.2, z]}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.5, 0]} scale={[0.1, 3, 0.1]} />
          <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.5 })} position={[0, 3.1, 0]} scale={0.4} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} scale={[4, 4, 1]} />
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
    const { step, landingAt, world } = useFlight.getState()
    let z = PARK_Z
    let y = 0.2
    let pitch = 0
    const landing = step === 'landing'
    p.visible = landing || world === 'island' || step === 'arrived'
    if (landing) {
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
    p.rotation.set(pitch, Math.PI, 0)
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
  // palmeras y faroles en los paseos (nunca encima de un local)
  const palms = useMemo(() => {
    const spots: [number, number][] = [
      [14, -14], [-14, -14], [-14, 14], [15.5, -18.5], [-19, -17], [-20, 13], [20, -6.5], [-6, 22.5], [6, -22.5], [-23, -2], [23.5, 3],
    ]
    return spots
      .map(([dx, dz], i) => ({ x: C.x + dx, z: C.z + dz, h: 3 + (i % 3) * 0.5, seed: i * 1.7 }))
      .filter((p) => !insideSpace(p.x, p.z, 1.8))
  }, [])
  const lamps = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 4
        return [C.x + Math.sin(a) * 7, C.z + Math.cos(a) * 7] as [number, number]
      }).filter(([x, z]) => !insideSpace(x, z, 0.3)),
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
      <mesh geometry={shapes.ground} material={mat('#e9dcc2')} position={[C.x, -1.6, C.z]} receiveShadow />
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
        <EntranceGate width={8.6} title="ISLA DE LOS DESCUENTOS" tagline="Outlet · Ofertas · Variedad" paths={false} roofColor={PINK} />
        {[-1, 1].map((s) => (
          <Garita key={s} x={s * 5.3} z={0.2} y={WH + 0.9} />
        ))}
        <Bridge from={3.9} to={Math.hypot(gm[0] - C.x, gm[1] - C.z) > 0 ? RUN.d - 4 - Math.hypot(gm[0] - C.x, gm[1] - C.z) + 0.4 : 12} />
      </group>
      {/* plaza central elevada con fuente */}
      <mesh geometry={GEO.cylinder} material={mat(PALETTE.floor)} position={[C.x, 0.1, C.z]} scale={[2 * PLAZA + 1, 0.2, 2 * PLAZA + 1]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#e6d3ad')} position={[C.x, 0.22, C.z]} scale={[9, 0.04, 9]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[C.x, 0.5, C.z]} scale={[5, 0.6, 5]} castShadow />
      <mesh geometry={GEO.cylinder} material={glowMat('#5fd0e0', 0.9, { dayGlow: 0.25 })} position={[C.x, 0.78, C.z]} scale={[4.4, 0.1, 4.4]} />
      <mesh geometry={GEO.cylinder} material={mat(STONE[1])} position={[C.x, 1.25, C.z]} scale={[0.6, 1.4, 0.6]} />
      <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[C.x, 2, C.z]} scale={[2, 0.25, 2]} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#bff6ff', 1.6, { dayGlow: 0.4 })} position={[C.x, 2.45, C.z]} scale={[0.7, 0.9, 0.7]} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#7fe3f0', 1)} rotation={[-Math.PI / 2, 0, 0]} position={[C.x, 0.25, C.z]} scale={[10, 10, 1]} />
      {/* camino de la plaza a la puerta (diagonal) */}
      {(() => {
        const from = PLAZA
        const to = Math.hypot(gm[0] - C.x, gm[1] - C.z) - 1
        const [mx, mz] = toWorld([0, (from + to) / 2], diag)
        return <mesh geometry={GEO.box} material={mat('#e6d3ad')} position={[C.x + mx, 0.12, C.z + mz]} rotation={[0, diag, 0]} scale={[3.4, 0.04, to - from]} receiveShadow />
      })()}
      {/* faroles y palmeras de los paseos */}
      {lamps.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.2, z]}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.5, 0]} scale={[0.1, 3, 0.1]} />
          <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.5 })} position={[0, 3.1, 0]} scale={0.4} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} scale={[4, 4, 1]} />
        </group>
      ))}
      {palms.map((p) => (
        <Palm key={`${p.x}${p.z}`} {...p} />
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
        speed: (0.06 + (i % 3) * 0.015) * (i % 2 ? 1 : -1),
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
    x.fillText('%', 64, 70)
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
        <mesh key={k} geometry={GEO.sphereSmooth} material={mat(k % 2 ? '#ffffff' : PINK, { rough: 0.6 })} rotation={[0, (k * Math.PI) / 6, 0]} scale={[3.6, 4.2, 0.9 + k * 0.5]} />
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

export function Island({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const label = useMemo(() => getGlassPill('Isla de los Descuentos', { dot: PINK, sub: 'Moda · Tecnología · Belleza · Lifestyle', dark: night }), [night])
  return (
    <group>
      <Batch version="isla-mall">
        <Castle />
        {P1.zones.map((z) => (
          <Wing key={z.id} zone={z} />
        ))}
      </Batch>
      <IslandPlane />
      <group position={[ISLAND_RUNWAY.x, 0, ISLAND_RUNWAY.z]} rotation={[0, ISLAND_RUNWAY.rot, 0]}>
        <RunwayLights cx={0.6} z0={-RUN.len / 2} z1={RUN.len / 2} w={RUN.w} y={0.22} dir={-1} />
      </group>
      <Strollers reduceMotion={reduceMotion} />
      <Balloon reduceMotion={reduceMotion} />
      <ScreenLabel label={label} position={[C.x - 3, 12, C.z - 3]} pixelHeight={38} maxZoomRatio={2.6} priority={LABEL_PRIORITY.floorSign + 5} />
    </group>
  )
}
