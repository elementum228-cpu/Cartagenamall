import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, STONE, STONE_DARK, WallLantern } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { Person } from './Person'

// Isla de Entretenimiento (propuesta de diseño): una isla redonda al oeste de la fortaleza, unida a
// la muralla por un puente de piedra con arcos. En el centro, una pista de karts con bordillos rojos
// y blancos; alrededor, locales con toldos a rayas para videojuegos, realidad virtual, esports y
// comida rápida. Por ahora es solo la escena: los locales todavía no se alquilan.

/** Centro y radio de la isla (mundo). */
export const ENTERTAINMENT = { x: -70, z: -4, r: 21 } as const
const C = ENTERTAINMENT
const Y = 0.12
const SEA = -0.5
/** Cara exterior de la muralla oeste: donde arranca el puente. */
const WALL_X = -(31 + 1.1)
const BRIDGE_W = 3.6
const BRIDGE_END = C.x + C.r - 0.8
const IRON = '#2f3438'
const ASPHALT = '#3d4147'
const RED = '#d9453d'
const CREAM = '#fbf3e4'

// ── pista: un óvalo (dos rectas y dos curvas) ─────────────────────────────────────────────────────
const TRACK = { a: 5.2, r: 5.4, w: 3.2 }
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
    return { asphalt: bandGeometry(ri, ro, 0.07), infield: discGeometry(ri - 0.35, 0.1) }
  }, [])
  const curbs = useMemo(() => {
    const out: { x: number; z: number; rot: number; red: boolean }[] = []
    const n = 64
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
      {curbs.map((c, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(c.red ? RED : '#f7f2e8')} position={[c.x, Y + 0.06, c.z]} rotation={[0, c.rot, 0]} scale={[0.26, 0.12, (LAP / 64) * 0.52]} />
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
      <Palm x={-2.5} z={0} h={3.6} seed={0.4} y={Y + 0.1} />
      <Palm x={2.6} z={0.6} h={3.2} seed={2.1} y={Y + 0.1} />
      <Palm x={0} z={-0.6} h={4.1} seed={3.3} y={Y + 0.1} />
      <mesh geometry={GEO.sphere} material={mat(PALETTE.leaf)} position={[0, Y + 0.4, 1]} scale={[2.2, 0.8, 1.2]} />
      <mesh geometry={GEO.sphere} material={mat('#e8879c')} position={[-0.6, Y + 0.78, 1.1]} scale={0.38} />
      <mesh geometry={GEO.sphere} material={mat('#f2cc8f')} position={[0.7, Y + 0.74, 0.9]} scale={0.34} />
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
  { u: 0.05, speed: 0.045, color: '#f2c230', lane: 0.5 },
  { u: 0.4, speed: 0.04, color: '#d9453d', lane: -0.5 },
  { u: 0.66, speed: 0.05, color: '#3d8fd1', lane: 0.2 },
  { u: 0.88, speed: 0.037, color: '#4fa86a', lane: -0.3 },
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

// ── locales ───────────────────────────────────────────────────────────────────────────────────────
const STALLS: { name: string; sub: string; color: string; awning: string }[] = [
  { name: 'ARCADE', sub: 'Máquinas y premios', color: '#ffe3a3', awning: '#d9453d' },
  { name: 'VIDEOJUEGOS', sub: 'Consolas y torneos', color: '#cfe3ff', awning: '#2f6fd1' },
  { name: 'REALIDAD VIRTUAL', sub: 'Mundos en 3D', color: '#e6d4ff', awning: '#7a4fd1' },
  { name: 'ESPORTS', sub: 'Gaming en vivo', color: '#c9f0e4', awning: '#1b9e84' },
  { name: 'HELADOS', sub: 'Y granizados', color: '#ffd6e2', awning: '#e0558a' },
  { name: 'COMIDA RÁPIDA', sub: 'Para recargar', color: '#ffe0bd', awning: '#e07a2f' },
  { name: 'SIMULADORES', sub: 'Carreras y vuelo', color: '#dfe6ee', awning: '#d9453d' },
  { name: 'KARTS', sub: 'Alquiler y boletas', color: '#fff0b3', awning: '#f2c230' },
  { name: 'TIENDA GAMER', sub: 'Figuras y regalos', color: '#d8f0c8', awning: '#4fa86a' },
  { name: 'JUEGOS DE MESA', sub: 'Cafetería y torneos', color: '#f3dccb', awning: '#b5674d' },
]
const STALL_R = 17
const STALL_ARC: [number, number] = [Math.PI * 0.2, Math.PI * 1.8] // deja libre el lado del puente (ángulo 0)

function stallSign(name: string, sub: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#1b1f2b'
  g.beginPath()
  g.roundRect(0, 0, 512, 160, 28)
  g.fill()
  g.strokeStyle = color
  g.lineWidth = 8
  g.stroke()
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `800 ${name.length > 11 ? 54 : 70}px system-ui, sans-serif`
  g.fillText(name, 256, 62)
  g.fillStyle = '#9fe3dc'
  g.font = '600 38px system-ui, sans-serif'
  g.fillText(sub, 256, 123)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
}

/** Un local (local: la fachada mira a +z, hacia el centro de la isla). */
function Stall({ s, signMat }: { s: (typeof STALLS)[number]; signMat: THREE.Material }) {
  const W = 4.6
  const D = 3.6
  const H = 3
  const stripes = 8
  return (
    <group>
      {/* cuerpo y azotea */}
      <mesh geometry={GEO.rounded} material={mat(s.color)} position={[0, H / 2, -0.4]} scale={[W, H, D - 0.8]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, H + 0.08, -0.4]} scale={[W + 0.2, 0.16, D - 0.6]} />
      {/* vitrina iluminada y mostrador */}
      <mesh geometry={GEO.box} material={glowMat('#ffe7b0', 1.2, { dayGlow: 0.25 })} position={[0, 1.5, 1.01]} scale={[W - 1.4, 1.2, 0.04]} />
      <mesh geometry={GEO.box} material={mat(PALETTE.woodDark)} position={[0, 0.45, 1.25]} scale={[W - 1.2, 0.9, 0.5]} castShadow />
      <mesh geometry={GEO.box} material={mat('#f4ead8')} position={[0, 0.94, 1.25]} scale={[W - 1, 0.08, 0.64]} />
      {/* toldo a rayas */}
      {Array.from({ length: stripes }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(i % 2 ? CREAM : s.awning)} position={[(i - (stripes - 1) / 2) * (W / stripes), 2.55, 1.35]} rotation={[0.5, 0, 0]} scale={[W / stripes, 0.07, 1.55]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={mat(s.awning)} position={[0, 2.18, 2.05]} scale={[W, 0.2, 0.06]} />
      {/* cartel sobre la azotea */}
      <mesh geometry={GEO.plane} material={signMat} position={[0, H + 0.85, 1.4]} scale={[3.6, 1.12, 1]} rotation={[-0.12, 0, 0]} />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={GEO.cylinderLow} material={mat(IRON)} position={[sx * 1.7, H + 0.4, 1.2]} scale={[0.07, 0.8, 0.07]} />
      ))}
      {/* trasera: cartel y ventanas, para que también se lea desde el lado del mar */}
      <mesh geometry={GEO.plane} material={signMat} position={[0, H + 0.85, -1.8]} rotation={[0.12, Math.PI, 0]} scale={[3.6, 1.12, 1]} />
      {[-1.3, 0, 1.3].map((x) => (
        <mesh key={x} geometry={GEO.box} material={glowMat('#ffe7b0', 1.2, { dayGlow: 0.2 })} position={[x, 1.7, -1.72]} scale={[0.8, 1, 0.04]} />
      ))}
      <mesh geometry={GEO.box} material={mat(s.awning)} position={[0, 0.3, -1.76]} scale={[W - 0.4, 0.5, 0.06]} />
      {/* globos de luz */}
      {[-1.6, -0.55, 0.55, 1.6].map((x) => (
        <mesh key={x} geometry={GEO.sphere} material={glowMat('#fff1c9', 2, { dayGlow: 0.5 })} position={[x, 2.25, 2.1]} scale={0.14} />
      ))}
    </group>
  )
}

function Stalls() {
  const stalls = useMemo(() => {
    const n = STALLS.length
    return STALLS.map((s, i) => {
      const a = STALL_ARC[0] + ((STALL_ARC[1] - STALL_ARC[0]) * (i + 0.5)) / n
      const x = Math.cos(a) * STALL_R
      const z = Math.sin(a) * STALL_R
      return { s, x, z, rot: Math.atan2(-Math.cos(a), -Math.sin(a)), mat: stallSign(s.name, s.sub, s.awning) }
    })
  }, [])
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
function Ground() {
  const ring = useMemo(() => Array.from({ length: 36 }, (_, i) => (i / 36) * Math.PI * 2), [])
  return (
    <group>
      {/* talud de piedra bajo el agua y piso de arena */}
      <mesh geometry={GEO.cylinder} material={mat(STONE_DARK)} position={[0, SEA - 0.4, 0]} scale={[C.r * 2 + 1.4, 1.6, C.r * 2 + 1.4]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat(STONE[0])} position={[0, (SEA + Y) / 2 - 0.05, 0]} scale={[C.r * 2 + 0.4, Y - SEA - 0.1, C.r * 2 + 0.4]} castShadow receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#efe2c4')} position={[0, Y - 0.05, 0]} scale={[C.r * 2 - 0.4, 0.1, C.r * 2 - 0.4]} receiveShadow />
      {/* adoquín decorativo en un anillo entre los locales y la pista */}
      <mesh geometry={GEO.cylinder} material={mat('#e2cfa6')} position={[0, Y, 0]} scale={[26, 0.02, 26]} receiveShadow />
      {/* borde de piedra a modo de malecón */}
      {ring.map((a, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(i % 2 ? STONE[1] : CORDON)} position={[Math.cos(a) * (C.r - 0.1), Y + 0.15, Math.sin(a) * (C.r - 0.1)]} rotation={[0, -a, 0]} scale={[0.5, 0.3, 3.7]} />
      ))}
      {/* rocas en la orilla */}
      {[0.9, 2.2, 3.5, 4.1, 5.4].map((a, i) => (
        <mesh key={i} geometry={GEO.sphere} material={mat(STONE_DARK)} position={[Math.cos(a) * (C.r + 1), SEA + 0.1, Math.sin(a) * (C.r + 1)]} scale={[1.6 + (i % 2), 0.9, 1.3]} />
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
  const palms: [number, number, number][] = []
  const lamps: [number, number][] = []
  const planters: [number, number, string][] = []
  // palmeras y faroles en el espacio libre entre locales
  for (let i = 0; i <= STALLS.length; i++) {
    const a = STALL_ARC[0] + ((STALL_ARC[1] - STALL_ARC[0]) * i) / STALLS.length
    palms.push([Math.cos(a) * (STALL_R + 0.4), Math.sin(a) * (STALL_R + 0.4), 3 + (i % 3) * 0.5])
    const b = a + 0.16
    lamps.push([Math.cos(b) * (STALL_R - 3.6), Math.sin(b) * (STALL_R - 3.6)])
  }
  // jardineras y palmeras junto al paso del puente
  for (const s of [-1, 1]) {
    palms.push([C.r - 3.4, s * 5.6, 3.6])
    planters.push([C.r - 5.2, s * 3.8, s > 0 ? '#e8879c' : '#f2cc8f'])
  }
  return { palms, lamps, planters }
})()

/** Gente paseando junto a los locales y la pista. */
const VISITORS: [number, number, string, number][] = [
  [9.5, 7.6, '#e07a5f', 0.5], [-9.2, 8.2, '#3d7ea6', 2.6], [13.2, -2.5, '#f2cc8f', -1.7],
  [-13.5, 1.5, '#6c5b7b', 1.4], [0.5, -10.4, '#2a9d8f', 3.1], [-6.5, -9.6, '#e9c46a', 0.2],
  [7.2, -9.2, '#d9453d', -0.4], [12.6, 4.6, '#8ab17d', -1.3], [-1.5, 10.8, '#3d7ea6', 3.3],
]

// ── puente y entrada ──────────────────────────────────────────────────────────────────────────────
function Bridge() {
  const len = WALL_X - BRIDGE_END // largo (positivo: de la isla a la muralla)
  const cx = (WALL_X + BRIDGE_END) / 2
  const pw = BRIDGE_W
  const arches = 3
  return (
    <group position={[cx, 0, C.z]}>
      {/* cuerpo de piedra y piso de adoquín */}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, (SEA + Y) / 2 - 0.02, 0]} scale={[len, Y - SEA - 0.04, pw]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat('#e2cfa6')} position={[0, Y - 0.01, 0]} scale={[len, 0.05, pw - 0.3]} receiveShadow />
      {/* parapetos con remate y pilastras */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={mat(STONE[2])} position={[0, Y + 0.38, s * (pw / 2 - 0.15)]} scale={[len, 0.76, 0.3]} castShadow />
          <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, Y + 0.8, s * (pw / 2 - 0.15)]} scale={[len, 0.1, 0.44]} />
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} geometry={GEO.box} material={mat(STONE[0])} position={[(i - 2) * (len / 4.4), Y + 0.55, s * (pw / 2 - 0.15)]} scale={[0.42, 1.1, 0.42]} castShadow />
          ))}
        </group>
      ))}
      {/* arcos bajo el puente */}
      {Array.from({ length: arches }, (_, i) => {
        const x = (i - (arches - 1) / 2) * (len / arches)
        return (
          <group key={i} position={[x, SEA, 0]}>
            <mesh geometry={GEO.cylinder} material={mat('#31475a')} rotation={[Math.PI / 2, 0, 0]} scale={[1.9, pw + 0.06, 1.9]} />
            <mesh geometry={GEO.cylinder} material={mat(CORDON)} rotation={[Math.PI / 2, 0, 0]} scale={[2.25, pw - 0.04, 2.25]} />
            <mesh geometry={GEO.cylinder} material={mat('#31475a')} rotation={[Math.PI / 2, 0, 0]} scale={[1.9, pw + 0.06, 1.9]} />
          </group>
        )
      })}
      {/* faroles en los parapetos */}
      {[-1, 1].flatMap((s) =>
        [-1, 1].map((k) => (
          <group key={`${s}${k}`} position={[k * (len / 2 - 1.3), Y + 0.8, s * (pw / 2 - 0.15)]}>
            <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 0.9, 0]} scale={[0.08, 1.8, 0.08]} />
            <mesh geometry={GEO.sphere} material={glowMat(PALETTE.lamp, 2.4, { dayGlow: 0.6 })} position={[0, 1.9, 0]} scale={0.32} />
          </group>
        )),
      )}
    </group>
  )
}

/** Puerta de piedra en la muralla oeste (mira al oeste, hacia el puente). */
function WallDoor() {
  const stone = mat(STONE[0])
  const D = 2.2 + 0.5
  return (
    <group position={[-31, 0, C.z]} rotation={[0, -Math.PI / 2, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={stone} position={[s * 1.4, 1.2, 0]} scale={[0.8, 2.4, D]} castShadow receiveShadow />
      ))}
      <mesh geometry={GEO.box} material={stone} position={[0, 3, 0]} scale={[3.6, 1.1, D]} castShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 3.62, 0]} scale={[3.8, 0.14, D + 0.1]} />
      <mesh geometry={GEO.box} material={mat('#3a2f28')} position={[0, 1.2, D / 2 + 0.02]} scale={[2, 2.4, 0.02]} />
      <mesh geometry={GEO.halfDisc} material={mat('#3a2f28')} position={[0, 2.4, D / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.02, 1]} />
      <mesh geometry={GEO.box} material={glowMat('#ffb86b', 1.4)} position={[0, 0.5, D / 2 + 0.05]} scale={[1.5, 0.9, 0.01]} />
      {[-1, 1].map((s) => (
        <WallLantern key={s} x={s * 1.9} y={2.3} z={D / 2 + 0.25} />
      ))}
    </group>
  )
}

/** Portal de la isla junto al puente: dos torres de colores y un arco con el nombre. */
function Portal() {
  const sign = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 240
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 1024, 0)
    grad.addColorStop(0, '#7a4fd1')
    grad.addColorStop(1, '#d9453d')
    g.fillStyle = grad
    g.beginPath()
    g.roundRect(0, 0, 1024, 240, 44)
    g.fill()
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '800 104px system-ui, sans-serif'
    g.fillText('ENTRETENIMIENTO', 512, 96)
    g.fillStyle = '#ffe9a8'
    g.font = '600 56px system-ui, sans-serif'
    g.fillText('🎮 Juegos · Karts · Diversión', 512, 184)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  }, [])
  return (
    <group position={[C.r - 1.6, Y, 0]} rotation={[0, Math.PI / 2, 0]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (BRIDGE_W / 2 + 0.7), 0, 0]}>
          <mesh geometry={GEO.box} material={mat(s > 0 ? '#e0558a' : '#2f6fd1')} position={[0, 2, 0]} scale={[1, 4, 1]} castShadow />
          <mesh geometry={GEO.cone} material={mat(CREAM)} position={[0, 4.5, 0]} scale={[1.5, 1.1, 1.5]} castShadow />
          <mesh geometry={GEO.sphere} material={glowMat('#fff1c9', 2, { dayGlow: 0.5 })} position={[0, 3.7, 0.52]} scale={0.22} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={mat(CREAM)} position={[0, 3.6, 0]} scale={[BRIDGE_W + 1.4, 0.4, 0.7]} castShadow />
      <mesh geometry={GEO.plane} material={sign} position={[0, 4.65, 0.2]} scale={[5.2, 1.22, 1]} />
      <mesh geometry={GEO.plane} material={sign} position={[0, 4.65, -0.2]} rotation={[0, Math.PI, 0]} scale={[5.2, 1.22, 1]} />
      {/* banderines */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} geometry={GEO.cone} material={mat(['#d9453d', '#f2c230', '#2f6fd1', '#4fa86a', '#e0558a'][i % 5])} position={[(i - 4) * 0.7, 3.2 - Math.sin((i / 8) * Math.PI) * 0.3 + 0.2, 0.45]} rotation={[Math.PI, 0, 0]} scale={[0.3, 0.45, 0.3]} />
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
      <group position={[C.x, 0, C.z]}>
        <Karts reduceMotion={reduceMotion} />
        {VISITORS.map(([x, z, color, rot], i) => (
          <group key={i} position={[x, Y, z]} rotation={[0, rot, 0]}>
            <Person color={color} skin={i % 2 ? '#c58c64' : '#e5b48f'} />
          </group>
        ))}
      </group>
      <ScreenLabel label={label} position={[C.x, 7.5, C.z]} pixelHeight={30} maxZoomRatio={1.6} priority={LABEL_PRIORITY.corridor + 5} />
    </group>
  )
}
