import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, Garita, STONE, STONE_DARK, WallLantern } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { Person } from './Person'
import { TRACK_SPACE } from '../config/mall'
import { useCatalog } from '../state/catalog'
import { useClaims } from '../state/claims'
import { useSpacePrice } from '../state/spacePricing'
import { useUI } from '../state/ui'
import { formatCOP } from '../lib/format'
import { ENT_COLOR, ENT_BRIDGE_Z, ENT_CENTER, ENT_HX, ENT_HZ, ENT_TRACK, ENT_WALL_X } from '../entertainment/config'

// Isla de Entretenimiento (propuesta de diseño): una isla redonda al oeste de la fortaleza, unida a
// la muralla por un puente de piedra con arcos. En el centro, una pista de karts con bordillos rojos
// y blancos; alrededor, locales con toldos a rayas para videojuegos, realidad virtual, esports y
// comida rápida. Por ahora es solo la escena: los locales todavía no se alquilan.

/**
 * Contorno del castillo-isla: un rectángulo de esquinas muy redondeadas (con torreones en ellas).
 * El lado este queda abierto en el centro: es la puerta hacia el puente.
 */
const HX = ENT_HX
const HZ = ENT_HZ
const CR = 5
const GATE_HALF = 3.4
const { OUTLINE, TOWERS } = (() => {
  const pts: [number, number][] = [[HX, -GATE_HALF]]
  const towers: number[] = []
  const arc = (cx: number, cz: number, t0: number, t1: number) => {
    const n = 8
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n
      pts.push([cx + Math.cos(t) * CR, cz + Math.sin(t) * CR])
      if (i === n / 2) towers.push(pts.length - 1)
    }
  }
  arc(HX - CR, -HZ + CR, 0, -Math.PI / 2) // noreste
  arc(-HX + CR, -HZ + CR, -Math.PI / 2, -Math.PI) // noroeste
  arc(-HX + CR, HZ - CR, Math.PI, Math.PI / 2) // suroeste
  arc(HX - CR, HZ - CR, Math.PI / 2, 0) // sureste
  pts.push([HX, GATE_HALF])
  return { OUTLINE: pts, TOWERS: towers }
})()
const GATE_X = HX

const WH = 1.7
const Y = 0.12
const SEA = -0.5
/** Cara exterior de la muralla oeste: donde arranca el puente (junto a la garita, frente a Planly). */
const WALL_X = ENT_WALL_X
const BRIDGE_W = 3.2
const BRIDGE_Z = ENT_BRIDGE_Z
const C = { x: ENT_CENTER[0], z: ENT_CENTER[1] }
const IRON = '#2f3438'
const ASPHALT = '#3d4147'
const RED = '#d9453d'

// ── pista: un óvalo (dos rectas y dos curvas) ─────────────────────────────────────────────────────
const TRACK = ENT_TRACK
const LAP = 4 * TRACK.a + 2 * Math.PI * TRACK.r

/** Contorno del óvalo a `off` del eje de la pista (local a la isla). u en [0,1). */
function trackPoint(u: number, off = 0): { x: number; z: number; rot: number } {
  const a = TRACK.a
  const R = TRACK.r + off
  const s = (((u % 1) + 1) % 1) * LAP
  const straight = 2 * a
  const arc = Math.PI * TRACK.r
  let x: number, z: number, rot: number
  if (s < straight) {
    // recta sur (z = +R), de -a a +a
    x = -a + s
    z = R
    rot = Math.PI / 2
  } else if (s < straight + arc) {
    const t = (s - straight) / TRACK.r
    x = a + Math.sin(t) * R
    z = Math.cos(t) * R
    rot = Math.PI / 2 - t
  } else if (s < 2 * straight + arc) {
    x = a - (s - straight - arc)
    z = -R
    rot = -Math.PI / 2
  } else {
    const t = (s - 2 * straight - arc) / TRACK.r
    x = -a - Math.sin(t) * R
    z = -Math.cos(t) * R
    rot = -Math.PI / 2 - t
  }
  return { x, z, rot }
}

function stadiumShape(a: number, R: number): THREE.Path {
  const p = new THREE.Path()
  p.moveTo(-a, R)
  p.lineTo(a, R)
  p.absarc(a, 0, R, Math.PI / 2, -Math.PI / 2, true)
  p.lineTo(-a, -R)
  p.absarc(-a, 0, R, -Math.PI / 2, Math.PI / 2, true)
  return p
}

function bandGeometry(inner: number, outer: number, depth: number) {
  const shape = new THREE.Shape(stadiumShape(TRACK.a, outer).getPoints(32))
  shape.holes.push(new THREE.Path(stadiumShape(TRACK.a, inner).getPoints(32)))
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 })
  g.rotateX(-Math.PI / 2)
  return g
}
function discGeometry(R: number, depth: number) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(stadiumShape(TRACK.a, R).getPoints(32)), { depth, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  return g
}

function Track() {
  const geos = useMemo(() => {
    const ri = TRACK.r - TRACK.w / 2
    const ro = TRACK.r + TRACK.w / 2
    return { asphalt: bandGeometry(ri, ro, 0.07), infield: discGeometry(ri - 0.4, 0.1), neon: bandGeometry(ri - 0.36, ri - 0.2, 0.02) }
  }, [])
  const curbs = useMemo(() => {
    const out: { x: number; z: number; rot: number; red: boolean }[] = []
    const n = 48
    for (const off of [-TRACK.w / 2 - 0.12, TRACK.w / 2 + 0.12]) {
      for (let i = 0; i < n; i++) {
        const p = trackPoint(i / n, off)
        out.push({ ...p, red: i % 2 === 0 })
      }
    }
    return out
  }, [])
  const start = trackPoint(0.02)
  return (
    <group position={[0, 0, 0]}>
      <mesh geometry={geos.asphalt} material={glowMat(ASPHALT, 0.7)} position={[0, Y, 0]} receiveShadow />
      {/* interior con césped, palmeras y el mural del circuito */}
      <mesh geometry={geos.infield} material={mat(PALETTE.grass)} position={[0, Y, 0]} receiveShadow />
      {/* línea central discontinua que brilla de noche */}
      {Array.from({ length: 40 }, (_, i) => {
        const c = trackPoint(i / 40)
        return <mesh key={`d${i}`} geometry={GEO.box} material={glowMat('#ffe9a8', 1.3, { dayGlow: 0.08 })} position={[c.x, Y + 0.08, c.z]} rotation={[0, c.rot, 0]} scale={[0.1, 0.01, (LAP / 40) * 0.38]} />
      })}
      {/* neón en el borde del interior: la pista se ilumina de noche */}
      <mesh geometry={geos.neon} material={glowMat('#38e0ff', 1.8)} position={[0, Y + 0.09, 0]} />
      {curbs.map((c, i) => (
        <mesh key={i} geometry={GEO.box} material={c.red ? glowMat('#ff5a4d', 1.3, { dayGlow: 0.05 }) : glowMat('#fff6e6', 1.1, { dayGlow: 0.05 })} position={[c.x, Y + 0.06, c.z]} rotation={[0, c.rot, 0]} scale={[0.26, 0.12, (LAP / 48) * 0.55]} />
      ))}
      {/* línea de salida/meta a cuadros */}
      <group position={[start.x, Y + 0.075, start.z]} rotation={[0, start.rot, 0]}>
        {Array.from({ length: 8 }, (_, i) =>
          [0, 1].map((j) => (
            <mesh key={`${i}${j}`} geometry={GEO.box} material={mat((i + j) % 2 ? '#ffffff' : '#15181c')} position={[(i - 3.5) * (TRACK.w / 8), 0, (j - 0.5) * 0.3]} scale={[TRACK.w / 8, 0.01, 0.3]} />
          )),
        )}
      </group>
      {/* palmeras y jardín en el interior de la pista */}
      <Palm x={0} z={-0.6} h={3.4} seed={3.3} y={Y + 0.1} />
      <mesh geometry={GEO.sphere} material={mat(PALETTE.leaf)} position={[0, Y + 0.4, 1]} scale={[2.2, 0.8, 1.2]} />
      <mesh geometry={GEO.sphere} material={mat('#e8879c')} position={[-0.6, Y + 0.78, 1.1]} scale={0.38} />
      <mesh geometry={GEO.sphere} material={mat('#f2cc8f')} position={[0.7, Y + 0.74, 0.9]} scale={0.34} />
      {/* arco de salida/meta con luces */}
      <group position={[start.x, Y, start.z]} rotation={[0, start.rot, 0]}>
        {[-1, 1].map((sx) => (
          <mesh key={sx} geometry={GEO.box} material={mat(IRON)} position={[sx * (TRACK.w / 2 + 0.2), 1.2, 0]} scale={[0.16, 2.4, 0.16]} castShadow />
        ))}
        <mesh geometry={GEO.box} material={mat('#15181c')} position={[0, 2.55, 0]} scale={[TRACK.w + 0.9, 0.5, 0.2]} />
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} geometry={GEO.box} material={glowMat(i % 2 ? '#ffffff' : '#ff5a4d', 1.8, { dayGlow: 0.3 })} position={[(i - 2.5) * 0.46, 2.55, 0.11]} scale={[0.4, 0.34, 0.03]} />
        ))}
        <mesh geometry={GEO.plane} material={lightPoolMat('#fff1c9', 0.8)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} scale={[4.2, 4.2, 1]} />
      </group>
      {/* postes de luz a lo largo de la pista */}
      {[0.12, 0.3, 0.45, 0.62, 0.8, 0.95].map((u, i) => {
        const p = trackPoint(u, TRACK.w / 2 + 0.55)
        return (
          <group key={i} position={[p.x, Y, p.z]}>
            <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 0.6, 0]} scale={[0.07, 1.2, 0.07]} />
            <mesh geometry={GEO.sphere} material={glowMat('#fff1c9', 2.4, { dayGlow: 0.4 })} position={[0, 1.25, 0]} scale={0.22} />
            <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.9)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} scale={[5.2, 5.2, 1]} />
          </group>
        )
      })}
      {/* banderas a cuadros en postes, junto a la salida */}
      {[-1, 1].map((s) => (
        <Flag key={s} x={start.x + s * (TRACK.w / 2 + 0.9)} z={start.z + 0.4} tilt={s} />
      ))}
      {/* neumáticos apilados en las curvas */}
      {[0.27, 0.77].flatMap((u) =>
        [1, -1].map((side) => {
          const p = trackPoint(u, side * (TRACK.w / 2 + 0.75))
          return <Tires key={`${u}${side}`} x={p.x} z={p.z} />
        }),
      )}
    </group>
  )
}

function Tires({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, Y, z]}>
      {[0, 1].map((k) => (
        <mesh key={k} geometry={GEO.torus} material={mat('#26282b')} position={[0, 0.18 + k * 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.3} />
      ))}
      <mesh geometry={GEO.torus} material={mat(RED)} position={[0.45, 0.18, 0.1]} rotation={[Math.PI / 2, 0, 0]} scale={0.3} />
    </group>
  )
}

function Flag({ x, z, tilt }: { x: number; z: number; tilt: number }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.2, 0]} scale={[0.06, 2.4, 0.06]} />
      <group position={[0.4 * tilt, 2.15, 0]}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} geometry={GEO.box} material={mat((i + (i > 2 ? 1 : 0)) % 2 ? '#ffffff' : '#15181c')} position={[((i % 3) - 1) * 0.26, i > 2 ? -0.13 : 0.13, 0]} scale={[0.26, 0.26, 0.03]} />
        ))}
      </group>
    </group>
  )
}

/** Karts que dan vueltas a la pista (se animan; con movimiento reducido quedan quietos). */
const KARTS: { u: number; speed: number; color: string; lane: number; sway: number }[] = [
  { u: 0.02, speed: 0.15, color: '#f2c230', lane: 0.7, sway: 0.35 },
  { u: 0.18, speed: 0.135, color: '#d9453d', lane: -0.7, sway: 0.4 },
  { u: 0.36, speed: 0.165, color: '#3d8fd1', lane: 0.2, sway: 0.5 },
  { u: 0.52, speed: 0.14, color: '#4fa86a', lane: -0.3, sway: 0.3 },
  { u: 0.7, speed: 0.155, color: '#e0558a', lane: 0.55, sway: 0.45 },
  { u: 0.86, speed: 0.13, color: '#7a4fd1', lane: -0.5, sway: 0.35 },
]
function Karts({ reduceMotion }: { reduceMotion: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    // con movimiento reducido siguen rodando, pero más despacio
    const t = clock.elapsedTime * (reduceMotion ? 0.35 : 1)
    KARTS.forEach((k, i) => {
      const g = refs.current[i]
      if (!g) return
      // cambian un poco de carril al adelantarse
      const lane = k.lane + Math.sin(t * 0.7 + i * 1.9) * k.sway * 0.5
      const p = trackPoint(k.u + t * k.speed, lane)
      g.position.set(p.x, Y + 0.12, p.z)
      g.rotation.set(0, p.rot, Math.sin(t * 6 + i) * 0.03)
    })
  })
  return (
    <>
      {KARTS.map((k, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} userData={{ dynamic: true }}>
          <mesh geometry={GEO.rounded} material={mat(k.color)} position={[0, 0.12, 0]} scale={[0.62, 0.2, 1.05]} castShadow />
          <mesh geometry={GEO.rounded} material={mat('#26282b')} position={[0, 0.3, -0.2]} scale={[0.34, 0.26, 0.3]} />
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={GEO.sphere} material={glowMat('#fff6c8', 3, { dayGlow: 0.3 })} position={[sx * 0.2, 0.17, 0.55]} scale={0.14} />
          ))}
          <mesh geometry={GEO.plane} material={lightPoolMat('#fff1c9', 1.3)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.1]} scale={[2.4, 3.6, 1]} />
          <mesh geometry={GEO.plane} material={lightPoolMat(k.color, 1.4)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[2.6, 2.6, 1]} />
          <mesh geometry={GEO.sphere} material={mat('#f2d6b8')} position={[0, 0.5, -0.05]} scale={0.26} />
          <mesh geometry={GEO.sphere} material={mat(k.color)} position={[0, 0.58, -0.05]} scale={[0.3, 0.2, 0.3]} />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} geometry={GEO.cylinderLow} material={mat('#1d1f22')} position={[sx * 0.34, 0.1, sz * 0.38]} rotation={[0, 0, Math.PI / 2]} scale={[0.22, 0.12, 0.22]} />
            )),
          )}
        </group>
      ))}
    </>
  )
}

function Palm({ x, z, h = 3.4, y = Y, seed = 0 }: { x: number; z: number; h?: number; y?: number; seed?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(PALETTE.trunk)} position={[0, h / 2, 0]} rotation={[0.1, seed, 0]} scale={[0.3, h, 0.3]} castShadow />
      {Array.from({ length: 7 }, (_, k) => {
        const a = (k / 7) * Math.PI * 2 + seed
        return <mesh key={k} geometry={GEO.box} material={mat(k % 2 ? PALETTE.leafDark : '#5f9a58')} position={[Math.sin(a) * 0.8, h + 0.05, Math.cos(a) * 0.8]} rotation={[0.38, a, 0]} scale={[0.5, 0.08, 1.8]} castShadow />
      })}
    </group>
  )
}

// ── isla, paseos y decoración ─────────────────────────────────────────────────────────────────────
function outlineGeometry(scale: number, depth: number, y: number) {
  const shape = new THREE.Shape(OUTLINE.map(([x, z]) => new THREE.Vector2(x * scale, z * scale)))
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  g.rotateX(Math.PI / 2) // extruye hacia -y
  g.translate(0, y, 0)
  return g
}

/** Tramo de muralla con almenas y cordón entre dos puntos del contorno. */
function WallRun({ a, b }: { a: [number, number]; b: [number, number] }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const rot = Math.atan2(b[0] - a[0], b[1] - a[1])
  return (
    <group position={[(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]} rotation={[0, rot, 0]}>
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, (WH - 1.2) / 2 + 0.1, 0]} scale={[0.9, WH + 1.2, len + 0.15]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, WH - 0.4, 0]} scale={[1.05, 0.14, len + 0.18]} />
      <mesh geometry={GEO.box} material={mat(STONE[1])} position={[0, WH + 0.25, 0]} scale={[0.6, 0.55, len * 0.5]} castShadow />
    </group>
  )
}

/** Torreón redondo de piedra con almenas y garita encima. */
function RoundTower({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[0, (WH + 0.4) / 2 - 0.3, 0]} scale={[3.6, WH + 0.7, 3.6]} castShadow receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat(CORDON)} position={[0, WH - 0.25, 0]} scale={[3.85, 0.16, 3.85]} />
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2
        return <mesh key={k} geometry={GEO.box} material={mat(STONE[1])} position={[Math.cos(a) * 1.65, WH + 0.35, Math.sin(a) * 1.65]} rotation={[0, -a, 0]} scale={[0.4, 0.5, 0.75]} castShadow />
      })}
      <Garita x={0} z={0} y={WH + 0.1} />
    </group>
  )
}

function Ground() {
  const geos = useMemo(
    () => ({
      slope: outlineGeometry(1.12, 1.8, SEA + 0.1),
      base: outlineGeometry(1.04, Y - SEA + 0.1, Y - 0.04),
      floor: outlineGeometry(0.98, 0.05, Y + 0.01),
    }),
    [],
  )
  const n = OUTLINE.length
  return (
    <group>
      <mesh geometry={geos.slope} material={mat(STONE_DARK)} receiveShadow />
      <mesh geometry={geos.base} material={mat(STONE[0])} castShadow receiveShadow />
      <mesh geometry={geos.floor} material={mat('#efe2c4')} receiveShadow />
      {/* murallas con almenas (la puerta queda abierta hacia el puente) y torreones redondos */}
      {OUTLINE.map((p, i) => {
        if (i === n - 1) return null // tramo abierto: la puerta
        const q = OUTLINE[(i + 1) % n]
        return <WallRun key={i} a={[p[0] * 0.99, p[1] * 0.99]} b={[q[0] * 0.99, q[1] * 0.99]} />
      })}
      {TOWERS.slice(0, 3).map((i) => (
        <RoundTower key={i} x={OUTLINE[i][0] * 0.99} z={OUTLINE[i][1] * 0.99} />
      ))}
      {/* rocas en la orilla */}
      {[4, 12, 21, 30, 36].map((i, k) => (
        <mesh key={i} geometry={GEO.sphere} material={mat(STONE_DARK)} position={[OUTLINE[i][0] * 1.13, SEA + 0.1, OUTLINE[i][1] * 1.13]} scale={[1.6 + (k % 2), 0.9, 1.3]} />
      ))}
    </group>
  )
}

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.3, 0]} scale={[0.09, 2.6, 0.09]} />
      <mesh geometry={GEO.sphere} material={glowMat(PALETTE.lamp, 2.4, { dayGlow: 0.6 })} position={[0, 2.65, 0]} scale={0.36} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.6)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[3.2, 3.2, 1]} />
    </group>
  )
}

function Planter({ x, z, flowers }: { x: number; z: number; flowers: string }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.rounded} material={mat('#d9a88a')} position={[0, 0.25, 0]} scale={[1.3, 0.5, 0.9]} castShadow />
      <mesh geometry={GEO.sphere} material={mat(PALETTE.leaf)} position={[0, 0.65, 0]} scale={[1.2, 0.55, 0.8]} />
      <mesh geometry={GEO.sphere} material={mat(flowers)} position={[0.25, 0.9, 0]} scale={0.3} />
    </group>
  )
}

const DECOR = (() => {
  const palms: [number, number, number][] = [] // sin palmeras: los locales quedan despejados
  const lamps: [number, number][] = [[-7, -6.9], [0, -7], [6.5, -7], [-7, 7], [0, 7], [6.5, 7], [-10, -3.4], [-10, 3.4], [10.2, -3.2], [10.2, 3.2]]
  const planters: [number, number, string][] = [[11.2, -6, '#e8879c'], [11.2, 6, '#f2cc8f'], [-10.3, 0, '#e8879c']]
  return { palms, lamps, planters }
})()

/** Gente paseando junto a los locales y la pista. */
const VISITORS: [number, number, string, number][] = [
  [8.8, -6, '#e07a5f', 0.5], [-8.4, 5.6, '#3d7ea6', 2.6], [9.8, 1.8, '#f2cc8f', -1.7],
  [-9.4, -2.2, '#6c5b7b', 1.4], [3.2, 7.2, '#2a9d8f', 3.1], [-4.4, -7.2, '#e9c46a', 0.2],
  [5.2, -7.4, '#d9453d', -0.4],
]

// ── puente y entrada ──────────────────────────────────────────────────────────────────────────────
function Bridge() {
  const end = C.x + GATE_X - 0.6
  const len = WALL_X - end
  const cx = (WALL_X + end) / 2
  const pw = BRIDGE_W
  const HUMP = 1.5
  const N = 28
  const sl = len / N
  // vano del arco: elíptico, por donde pasa el agua
  const archA = Math.min(3.4, len / 2 - 1.6)
  const archH = Y + HUMP - 0.4 - SEA
  // perfil en arco: sube desde los dos extremos hasta la clave, como en la foto de referencia
  const h = (u: number) => HUMP * Math.sin(Math.PI * u)
  const slices = Array.from({ length: N }, (_, i) => {
    const u = (i + 0.5) / N
    const top = Y + h(u)
    const slope = Math.atan2(h((i + 1) / N) - h(i / N), sl)
    return { x: (u - 0.5) * len, top, slope }
  })
  return (
    <group position={[cx, 0, BRIDGE_Z]}>
      {slices.map((sg, i) => (
        <group key={i} position={[sg.x, 0, 0]}>
          {/* piedra bajo el piso: en el centro solo queda el grosor del arco y el agua pasa por debajo */}
          {(() => {
            const k = Math.abs(sg.x) < archA ? Math.sqrt(1 - (sg.x / archA) ** 2) : 0
            const bottom = SEA - 0.3 + (k > 0 ? (archH + 0.3) * k : 0)
            return <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, (bottom + sg.top) / 2, 0]} scale={[sl + 0.02, sg.top - bottom, pw]} castShadow receiveShadow />
          })()}
          <group position={[0, sg.top, 0]} rotation={[0, 0, sg.slope]}>
            <mesh geometry={GEO.box} material={mat('#e2cfa6')} position={[0, 0, 0]} scale={[sl + 0.06, 0.12, pw - 0.3]} receiveShadow />
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh geometry={GEO.box} material={mat(STONE[2])} position={[0, 0.4, s * (pw / 2 - 0.15)]} scale={[sl + 0.03, 0.8, 0.3]} castShadow />
                <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 0.82, s * (pw / 2 - 0.15)]} scale={[sl + 0.03, 0.1, 0.44]} />
              </group>
            ))}
          </group>
        </group>
      ))}
      {/* pilastras con farol y faldones de piedra en los extremos */}
      {[-1, 0, 1].map((k) =>
        [-1, 1].map((s) => {
          const x = k * (len / 2 - 0.5)
          const top = Y + h(k === 0 ? 0.5 : k < 0 ? 0.5 / N : 1 - 0.5 / N)
          return (
            <group key={`${k}${s}`} position={[x, top, s * (pw / 2 - 0.15)]}>
              <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, 0.65, 0]} scale={[0.5, 1.3, 0.5]} castShadow />
              <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 1.34, 0]} scale={[0.62, 0.12, 0.62]} />
              <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.8, 0]} scale={[0.07, 0.9, 0.07]} />
              <mesh geometry={GEO.sphere} material={glowMat(PALETTE.lamp, 2.4, { dayGlow: 0.6 })} position={[0, 2.35, 0]} scale={0.3} />
            </group>
          )
        }),
      )}
    </group>
  )
}

/** Paso en la muralla oeste: un hueco con arco que une el mall con el puente (se ve desde ambos lados). */
function WallDoor() {
  const stone = mat(STONE[0])
  const D = 2.2 + 0.5
  return (
    <group position={[-31, 0, BRIDGE_Z]} rotation={[0, -Math.PI / 2, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={stone} position={[s * 1.4, 1.2, 0]} scale={[0.8, 2.4, D]} castShadow receiveShadow />
      ))}
      <mesh geometry={GEO.box} material={stone} position={[0, 3, 0]} scale={[3.6, 1.1, D]} castShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 3.62, 0]} scale={[3.8, 0.14, D + 0.1]} />
      {/* el vano atraviesa la muralla: sombra al fondo, luz cálida y piso de paso */}
      <mesh geometry={GEO.box} material={mat('#3a2f28')} position={[0, 1.2, 0]} scale={[2, 2.4, D - 0.1]} />
      <mesh geometry={GEO.halfDisc} material={mat('#3a2f28')} position={[0, 2.4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, D - 0.1, 1]} />
      <mesh geometry={GEO.box} material={glowMat('#ffb86b', 1.4)} position={[0, 0.16, 0]} scale={[1.9, 0.04, D - 0.1]} />
      {[1, -1].map((f) => (
        <group key={f} rotation={[0, f === 1 ? 0 : Math.PI, 0]}>
          <mesh geometry={GEO.halfDisc} material={mat(CORDON)} position={[0, 2.4, D / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]} scale={[1.12, 0.02, 1.12]} />
          <mesh geometry={GEO.box} material={glowMat('#ffb86b', 1.4)} position={[0, 0.8, D / 2 + 0.03]} scale={[1.5, 1.5, 0.01]} />
          {[-1, 1].map((s) => (
            <WallLantern key={s} x={s * 1.9} y={2.3} z={D / 2 + 0.25} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Visitantes que cruzan del mall a la isla (y de vuelta) por el puente: salen del paso y entran a la puerta. */
const CROSSERS: { phase: number; dir: 1 | -1; lane: number; color: string; skin: string; speed: number }[] = [
  { phase: 0.0, dir: 1, lane: -0.7, color: '#e07a5f', skin: '#e5b48f', speed: 1 },
  { phase: 0.22, dir: -1, lane: 0.7, color: '#3d7ea6', skin: '#8d5a3b', speed: 1.1 },
  { phase: 0.45, dir: 1, lane: 0.5, color: '#f2cc8f', skin: '#c58c64', speed: 0.9 },
  { phase: 0.62, dir: -1, lane: -0.5, color: '#6c5b7b', skin: '#e5b48f', speed: 1 },
  { phase: 0.8, dir: 1, lane: 0, color: '#2a9d8f', skin: '#8d5a3b', speed: 1.05 },
  { phase: 0.35, dir: -1, lane: 0.1, color: '#d9453d', skin: '#c58c64', speed: 0.95 },
]
function BridgeCrossers({ reduceMotion }: { reduceMotion: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const x0 = WALL_X + 1.4 // dentro del paso de la muralla
  const x1 = C.x + GATE_X - 2.4 // pasado el portal de la isla
  const span = x0 - x1
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    CROSSERS.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      const u = (((c.phase + (t * 0.9 * c.speed) / span) % 1) + 1) % 1
      const f = c.dir === 1 ? u : 1 - u // 0 = mall, 1 = isla
      const x = x0 - f * span
      // altura del puente (misma curva que Bridge) y paso de caminata
      const bu = THREE.MathUtils.clamp((x - (C.x + GATE_X - 0.6)) / (WALL_X - (C.x + GATE_X - 0.6)), 0, 1)
      const hump = 1.5 * Math.sin(Math.PI * bu)
      g.position.set(x, Y + 0.06 + hump + Math.abs(Math.sin(t * 7 + i * 2)) * 0.03, BRIDGE_Z + c.lane)
      g.rotation.y = c.dir === 1 ? -Math.PI / 2 : Math.PI / 2
      // entran y salen por las puertas: aparecen y se achican en los extremos
      const edge = Math.min(f, 1 - f) / 0.07
      g.scale.setScalar(THREE.MathUtils.clamp(edge, 0, 1))
    })
  })
  return (
    <>
      {CROSSERS.map((c, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} userData={{ dynamic: true }}>
          <Person color={c.color} skin={c.skin} />
        </group>
      ))}
    </>
  )
}

/** Portal de la isla junto al puente: dos pilares de piedra con remate, un dintel y un letrero iluminado. */
function Portal() {
  const sign = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 1024, 0)
    grad.addColorStop(0, '#6a3fc4')
    grad.addColorStop(1, '#d9453d')
    g.fillStyle = grad
    g.fillRect(0, 0, 1024, 256)
    g.strokeStyle = '#ffe9a8'
    g.lineWidth = 10
    g.strokeRect(16, 16, 992, 224)
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '800 96px system-ui, sans-serif'
    g.fillText('ENTRETENIMIENTO', 512, 104)
    g.fillStyle = '#ffe9a8'
    g.font = '600 52px system-ui, sans-serif'
    g.fillText('Juegos · Karts · Diversión', 512, 192)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  }, [])
  const span = BRIDGE_W + 1.6
  return (
    <group position={[GATE_X - 0.8, Y, 0]} rotation={[0, Math.PI / 2, 0]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (span / 2), 0, 0]}>
          <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, 2, 0]} scale={[0.95, 4, 0.95]} castShadow receiveShadow />
          <mesh geometry={GEO.box} material={mat(s > 0 ? '#d9453d' : '#6a3fc4')} position={[0, 0.9, 0]} scale={[1.05, 0.5, 1.05]} />
          <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 4.05, 0]} scale={[1.2, 0.18, 1.2]} />
          <mesh geometry={GEO.sphere} material={glowMat('#fff1c9', 2.2, { dayGlow: 0.5 })} position={[0, 4.45, 0]} scale={0.5} />
        </group>
      ))}
      {/* dintel de piedra y letrero grande con marco, girado un poco hacia la cámara */}
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[0, 3.7, 0]} scale={[span + 0.6, 0.5, 0.8]} castShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 3.98, 0]} scale={[span + 0.8, 0.12, 0.95]} />
      <group position={[0, 5.15, 0]}>
        <mesh geometry={GEO.box} material={mat('#1b1f2b')} position={[0, 0, 0]} scale={[5.5, 1.5, 0.16]} />
        <mesh geometry={GEO.plane} material={sign} position={[0, 0, 0.09]} scale={[5.3, 1.32, 1]} />
        <mesh geometry={GEO.plane} material={sign} position={[0, 0, -0.09]} rotation={[0, Math.PI, 0]} scale={[5.3, 1.32, 1]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.box} material={mat(IRON)} position={[s * 2.2, -0.95, 0]} scale={[0.1, 0.5, 0.1]} />
        ))}
      </group>
      {/* banderines bajo el dintel */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} geometry={GEO.cone} material={mat(['#d9453d', '#f2c230', '#2f6fd1', '#4fa86a', '#e0558a'][i % 5])} position={[(i - 4) * (span / 9), 3.25 - Math.sin((i / 8) * Math.PI) * 0.25, 0.45]} rotation={[Math.PI, 0, 0]} scale={[0.28, 0.42, 0.28]} />
      ))}
    </group>
  )
}

/**
 * La pista como espacio reclamable: toda la pista es tocable. Libre, abre su ficha para reclamarla;
 * con un negocio que la opera, abre su ficha. Un cartel sobre el césped dice en qué estado está.
 */
function TrackSpace({ night }: { night: boolean }) {
  const operator = useCatalog((s) => {
    const id = s.assignments[TRACK_SPACE.id]
    return id ? (s.stores.find((st) => st.id === id) ?? null) : null
  })
  const pending = useClaims((s) => s.claims.some((c) => c.spaceId === TRACK_SPACE.id && c.status === 'pending'))
  const price = useSpacePrice(TRACK_SPACE.id)
  const ring = useRef<THREE.Mesh>(null)
  const label = useMemo(
    () =>
      getGlassPill(operator ? operator.name : pending ? 'Pista en revisión' : 'Pista de karts', {
        dot: ENT_COLOR,
        sub: operator ? 'Reserva tu turno · toca para ver' : pending ? 'Solicitud enviada' : `Disponible · ${formatCOP(price)}/mes`,
        logo: operator?.logo ?? null,
        dark: night,
      }),
    [operator, pending, price, night],
  )
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: pending ? '#f5b544' : ENT_COLOR, transparent: true, depthWrite: false, toneMapped: false }), [pending])
  const hit = useMemo(() => {
    const shape = new THREE.Shape(stadiumShape(TRACK.a, TRACK.r + TRACK.w / 2 + 0.4).getPoints(32))
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [])
  useFrame(({ clock }) => {
    if (!ring.current) return
    const p = (clock.elapsedTime * 0.5) % 1
    ring.current.scale.setScalar(2.2 + p * 2.2)
    ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - p)
  })
  const open = () => {
    const ui = useUI.getState()
    if (ui.overview || ui.activeFloor !== 'P1') ui.setFloor('P1')
    if (operator) ui.openTrack(true)
    else ui.selectSpace(TRACK_SPACE.id)
    ui.requestFocus({ kind: 'space', id: TRACK_SPACE.id })
  }
  return (
    <group>
      <mesh
        geometry={hit}
        material={hitMat}
        position={[0, Y + 0.3, 0]}
        onClick={(e) => {
          if (e.delta > 8) return
          e.stopPropagation()
          open()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      />
      {!operator && <mesh ref={ring} userData={{ dynamic: true }} geometry={GEO.ring} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, Y + 0.45, 0.3]} raycast={() => null} />}
      <ScreenLabel label={label} position={[0, 2.4, 0]} pixelHeight={34} maxZoomRatio={2.4} priority={LABEL_PRIORITY.store} onClick={open} />
    </group>
  )
}

export function Entertainment({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const label = useMemo(() => getGlassPill('Entretenimiento', { dot: '#e0558a', sub: 'Pista de karts y videojuegos', dark: night }), [night])
  return (
    <group>
      {/* el puente y la muralla se funden en la escena general; la isla va en su propio grupo */}
      <Batch version="entretenimiento">
        <Bridge />
        <WallDoor />
        <group position={[C.x, 0, C.z]}>
          <Ground />
          <Track />
          {DECOR.palms.map(([x, z, h], i) => (
            <Palm key={i} x={x} z={z} h={h} seed={i * 1.3} />
          ))}
          {DECOR.lamps.map(([x, z], i) => (
            <Lamp key={i} x={x} z={z} />
          ))}
          {DECOR.planters.map(([x, z, f], i) => (
            <Planter key={i} x={x} z={z} flowers={f} />
          ))}
          <Portal />
        </group>
      </Batch>
      <BridgeCrossers reduceMotion={reduceMotion} />
      <group position={[C.x, 0, C.z]}>
        <TrackSpace night={night} />
        <Karts reduceMotion={reduceMotion} />
        {VISITORS.map(([x, z, color, rot], i) => (
          <group key={i} position={[x, Y, z]} rotation={[0, rot, 0]}>
            <Person color={color} skin={i % 2 ? '#c58c64' : '#e5b48f'} />
          </group>
        ))}
      </group>
      <ScreenLabel label={label} position={[C.x, 8, C.z]} pixelHeight={30} maxZoomRatio={1.6} priority={LABEL_PRIORITY.corridor + 5} />
    </group>
  )
}
