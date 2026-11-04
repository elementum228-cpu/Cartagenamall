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

// Isla de Entretenimiento (propuesta de diseño): una isla redonda al oeste de la fortaleza, unida a
// la muralla por un puente de piedra con arcos. En el centro, una pista de karts con bordillos rojos
// y blancos; alrededor, locales con toldos a rayas para videojuegos, realidad virtual, esports y
// comida rápida. Por ahora es solo la escena: los locales todavía no se alquilan.

/** Contorno redondeado del castillo-isla (relativo al centro): lóbulos suaves donde van los torreones. */
const OUTLINE: [number, number][] = Array.from({ length: 64 }, (_, i) => {
  const t = (i / 64) * Math.PI * 2
  const r = 14.5 + 1.7 * Math.cos(3 * t - 0.6) + 0.8 * Math.cos(2 * t + 0.8)
  return [Math.cos(t) * r * 1.06, Math.sin(t) * r * 0.92]
})
/** La puerta mira al este (hacia la muralla): los tramos cerca de t = 0 quedan abiertos. */
const GATE_IDX = new Set([62, 63, 0, 1, 2])
const GATE_X = OUTLINE[0][0]
/** Torreones redondos: en los máximos locales del contorno (sin la puerta). */
const TOWERS = OUTLINE.map((p, i) => {
  const n = OUTLINE.length
  const r = Math.hypot(p[0] / 1.06, p[1] / 0.92)
  const rp = Math.hypot(OUTLINE[(i + n - 1) % n][0] / 1.06, OUTLINE[(i + n - 1) % n][1] / 0.92)
  const rn = Math.hypot(OUTLINE[(i + 1) % n][0] / 1.06, OUTLINE[(i + 1) % n][1] / 0.92)
  return r >= rp && r >= rn && !GATE_IDX.has(i) ? i : -1
}).filter((i) => i >= 0)

const WH = 1.7
const Y = 0.12
const SEA = -0.5
/** Cara exterior de la muralla oeste: donde arranca el puente (junto a la garita, frente a Planly). */
const WALL_X = -(31 + 1.1)
const BRIDGE_W = 3.2
const BRIDGE_LEN = 13.5
const BRIDGE_Z = 10
/** Centro de la isla (mundo): junto a la garita del muro oeste, a la derecha de Planly. */
export const ENTERTAINMENT = { x: WALL_X - BRIDGE_LEN + 0.6 - GATE_X, z: BRIDGE_Z, r: 16 } as const
const C = ENTERTAINMENT
const IRON = '#2f3438'
const ASPHALT = '#3d4147'
const RED = '#d9453d'

// ── pista: un óvalo (dos rectas y dos curvas) ─────────────────────────────────────────────────────
const TRACK = { a: 2.8, r: 3.4, w: 2.3 }
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
      <mesh geometry={geos.asphalt} material={mat(ASPHALT, { rough: 0.95 })} position={[0, Y, 0]} receiveShadow />
      {/* interior con césped, palmeras y el mural del circuito */}
      <mesh geometry={geos.infield} material={mat(PALETTE.grass)} position={[0, Y, 0]} receiveShadow />
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
            <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.7)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} scale={[3.4, 3.4, 1]} />
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
const KARTS: { u: number; speed: number; color: string; lane: number }[] = [
  { u: 0.05, speed: 0.1, color: '#f2c230', lane: 0.6 },
  { u: 0.3, speed: 0.085, color: '#d9453d', lane: -0.6 },
  { u: 0.55, speed: 0.11, color: '#3d8fd1', lane: 0.2 },
  { u: 0.8, speed: 0.092, color: '#4fa86a', lane: -0.3 },
]
function Karts({ reduceMotion }: { reduceMotion: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    KARTS.forEach((k, i) => {
      const g = refs.current[i]
      if (!g) return
      const p = trackPoint(k.u + t * k.speed, k.lane)
      g.position.set(p.x, Y + 0.12, p.z)
      g.rotation.y = p.rot
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
          <mesh geometry={GEO.plane} material={lightPoolMat('#fff1c9', 0.9)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.9]} scale={[1.8, 2.6, 1]} />
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

// ── locales abiertos y disponibles ────────────────────────────────────────────────────────────────
// Igual que dentro del mall: cortes sin techo para ver el interior, mostrador, toldo y un cartel
// "TU NEGOCIO AQUÍ" con el rubro sugerido. Todos libres (todavía no se alquilan).
const STALLS: { name: string; color: string; awning: string }[] = [
  { name: 'ARCADE', color: '#ffe3a3', awning: '#d9453d' },
  { name: 'VIDEOJUEGOS', color: '#cfe3ff', awning: '#2f6fd1' },
  { name: 'REALIDAD VIRTUAL', color: '#e6d4ff', awning: '#7a4fd1' },
  { name: 'ESPORTS', color: '#c9f0e4', awning: '#1b9e84' },
  { name: 'HELADOS', color: '#ffd6e2', awning: '#e0558a' },
  { name: 'COMIDA RÁPIDA', color: '#ffe0bd', awning: '#e07a2f' },
  { name: 'SIMULADORES', color: '#dfe6ee', awning: '#d9453d' },
  { name: 'TIENDA GAMER', color: '#d8f0c8', awning: '#4fa86a' },
]
const STALL_RX = 10.2
const STALL_RZ = 8.2
/** Ángulos (0 = lado del puente, que queda libre para la puerta). */
const STALL_ANGLES = [0.85, 1.4, 1.95, 2.55, 3.55, 4.1, 4.65, 5.45]

function stallSign(name: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = color
  g.beginPath()
  g.roundRect(0, 0, 512, 160, 28)
  g.fill()
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 62px system-ui, sans-serif'
  g.fillText('TU NEGOCIO AQUÍ', 256, 58)
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.font = `700 ${name.length > 11 ? 40 : 48}px system-ui, sans-serif`
  g.fillText(name, 256, 118)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
}

/** Un local abierto (local: la fachada mira a +z, hacia la pista): sin carpa ni techo, como en el mall. */
function Stall({ s, signMat }: { s: (typeof STALLS)[number]; signMat: THREE.Material }) {
  const W = 4.4
  const D = 3.2
  const wall = mat(s.color)
  return (
    <group>
      {/* piso del local con marco de color y paredes bajas cortadas (se ve todo el interior) */}
      <mesh geometry={GEO.box} material={mat(s.awning)} position={[0, 0.05, 0]} scale={[W + 0.2, 0.1, D + 0.2]} receiveShadow />
      <mesh geometry={GEO.box} material={mat('#f6efe0')} position={[0, 0.07, 0]} scale={[W - 0.2, 0.1, D - 0.2]} receiveShadow />
      <mesh geometry={GEO.box} material={wall} position={[0, 1.3, -D / 2 + 0.1]} scale={[W, 2.6, 0.2]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(s.awning)} position={[0, 2.62, -D / 2 + 0.1]} scale={[W + 0.1, 0.12, 0.3]} />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh geometry={GEO.box} material={wall} position={[sx * (W / 2 - 0.1), 0.55, 0]} scale={[0.2, 1.1, D]} castShadow receiveShadow />
          <mesh geometry={GEO.box} material={mat(s.awning)} position={[sx * (W / 2 - 0.1), 1.14, 0]} scale={[0.28, 0.08, D + 0.1]} />
        </group>
      ))}
      {/* interior: mostrador, estantes y una máquina de muestra */}
      <mesh geometry={GEO.box} material={mat(PALETTE.woodDark)} position={[0, 0.5, 0.5]} scale={[W - 1.4, 1, 0.5]} castShadow />
      <mesh geometry={GEO.box} material={mat('#f4ead8')} position={[0, 1.02, 0.5]} scale={[W - 1.2, 0.08, 0.62]} />
      {[1.0, 1.55, 2.1].map((y) => (
        <mesh key={y} geometry={GEO.box} material={mat(PALETTE.wood)} position={[0, y, -D / 2 + 0.38]} scale={[W - 0.9, 0.07, 0.4]} />
      ))}
      <mesh geometry={GEO.box} material={glowMat('#ffe7b0', 1.1, { dayGlow: 0.2 })} position={[0, 1.8, -D / 2 + 0.22]} scale={[W - 1.4, 0.05, 0.04]} />
      {/* cartel de local disponible, igual al del mall, sobre un poste */}
      <mesh geometry={GEO.plane} material={signMat} position={[0, 3.25, -0.2]} scale={[3.2, 1, 1]} rotation={[-0.1, 0, 0]} />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={GEO.cylinderLow} material={mat(IRON)} position={[sx * 1.5, 2.9, -0.3]} scale={[0.07, 0.8, 0.07]} />
      ))}
      {/* aro en el piso frente al local, como las plazas libres del mall */}
      <mesh geometry={GEO.ring} material={glowMat(s.awning, 1, { opacity: 0.8, dayGlow: 0.45 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 1.6]} scale={[0.95, 0.95, 1]} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.5)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 1.2]} scale={[4, 3, 1]} />
    </group>
  )
}

function Stalls() {
  const stalls = useMemo(
    () =>
      STALLS.map((s, i) => {
        const a = STALL_ANGLES[i]
        const x = Math.cos(a) * STALL_RX
        const z = Math.sin(a) * STALL_RZ
        return { s, x, z, rot: Math.atan2(-x, -z), mat: stallSign(s.name, s.awning) }
      }),
    [],
  )
  return (
    <>
      {stalls.map((o) => (
        <group key={o.s.name} position={[o.x, Y, o.z]} rotation={[0, o.rot, 0]}>
          <Stall s={o.s} signMat={o.mat} />
        </group>
      ))}
    </>
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
        if (GATE_IDX.has(i) && GATE_IDX.has((i + 1) % n)) return null
        const q = OUTLINE[(i + 1) % n]
        return <WallRun key={i} a={[p[0] * 0.99, p[1] * 0.99]} b={[q[0] * 0.99, q[1] * 0.99]} />
      })}
      {TOWERS.map((i) => (
        <RoundTower key={i} x={OUTLINE[i][0] * 0.99} z={OUTLINE[i][1] * 0.99} />
      ))}
      {/* rocas en la orilla */}
      {[6, 18, 30, 44, 55].map((i, k) => (
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
  const lamps: [number, number][] = [[8.6, -2.6], [8.6, 2.6], [-8.2, -3.6], [-8.2, 3.6], [0, 8.4], [0, -8.4]]
  const planters: [number, number, string][] = [[11.4, -4, '#e8879c'], [11.4, 4, '#f2cc8f']]
  return { palms, lamps, planters }
})()

/** Gente paseando junto a los locales y la pista. */
const VISITORS: [number, number, string, number][] = [
  [8.2, 5.6, '#e07a5f', 0.5], [-8.4, 5.2, '#3d7ea6', 2.6], [9.6, -1.8, '#f2cc8f', -1.7],
  [-9.5, -3.5, '#6c5b7b', 1.4], [0.5, -8.6, '#2a9d8f', 3.1], [-5.5, -8.2, '#e9c46a', 0.2],
  [5.2, 7.6, '#d9453d', -0.4],
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
          <Stalls />
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
