import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { STONE, STONE_DARK } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, GLASS, mat } from './materials'
import { glowMat } from './night'

// Mirador de Servicios (propuesta): un piso encima de la joyería, con un vacío de vidrio sobre la alfombra roja,
// un caracol de cristal que sube desde la joyería y una escalinata que baja a la Plaza del Mar.
const U = 4.4 // nivel del piso de servicios
const SLAB = 0.35
const GOLD = '#d9a441'
const X_W = -55.2 // borde oeste de la terraza
const Z_S = 5.8 // frente de la joyería hacia el mar
const T_Z0 = 2.6 // la terraza ocupa solo la franja del lado del mar
const TOP_X = -41.6 // donde termina la escalera verde y empieza la terraza
const STAIR = { x0: X_W, run: 6, z: 4.2, w: 2.4, steps: 12 }
const UP = { x1: -33.6, x0: TOP_X, z: 4.7, w: 1.9, steps: 14 }
const PLAZA = { x0: -74, x1: X_W - STAIR.run, z0: -5, z1: 5.8 }
const PLAZA_C: [number, number] = [(PLAZA.x0 + PLAZA.x1) / 2, (PLAZA.z0 + PLAZA.z1) / 2]

/** Caja con centro y tamaño dados por sus bordes (más fácil de leer en planos). */
function Slab({ x0, x1, z0, z1, y0, y1, material }: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; material: THREE.Material }) {
  return <mesh geometry={GEO.box} material={material} position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} scale={[x1 - x0, y1 - y0, z1 - z0]} castShadow receiveShadow />
}

function Rail({ x0, x1, z0, z1 }: { x0: number; x1: number; z0: number; z1: number }) {
  return (
    <>
      <mesh geometry={GEO.box} material={GLASS} position={[(x0 + x1) / 2, U + 0.5, (z0 + z1) / 2]} scale={[Math.max(0.06, x1 - x0), 1, Math.max(0.06, z1 - z0)]} />
      <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[(x0 + x1) / 2, U + 1.02, (z0 + z1) / 2]} scale={[Math.max(0.1, x1 - x0), 0.07, Math.max(0.1, z1 - z0)]} />
    </>
  )
}

function Palm({ x, z, y = 0.15 }: { x: number; z: number; y?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat('#8a6a4a')} position={[0, 1.4, 0]} scale={[0.26, 2.8, 0.26]} castShadow />
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={GEO.box} material={mat('#3f9e57')} position={[Math.cos((i / 5) * Math.PI * 2) * 0.7, 2.8, Math.sin((i / 5) * Math.PI * 2) * 0.7]} rotation={[0, -(i / 5) * Math.PI * 2, 0.35]} scale={[1.6, 0.08, 0.5]} castShadow />
      ))}
    </group>
  )
}

/** Terraza: pasarela de piedra clara sobre el lado del mar de la joyería, con barandas de vidrio y metal negro. */
function Terrace() {
  const slab = mat('#f1ebdf', { rough: 0.5 })
  const strip = glowMat('#ffe2a8', 1.8, { dayGlow: 0.35 })
  const black = mat('#1b1d22', { rough: 0.4 })
  const x0 = X_W
  const x1 = TOP_X
  return (
    <>
      <Slab x0={x0} x1={x1} z0={T_Z0} z1={Z_S + 0.2} y0={U - SLAB} y1={U} material={slab} />
      <mesh geometry={GEO.box} material={strip} position={[(x0 + x1) / 2, U - 0.2, Z_S + 0.23]} scale={[x1 - x0, 0.06, 0.03]} />
      {/* columnas finas que la sostienen */}
      {[x0 + 0.4, (x0 + x1) / 2, x1 - 0.4].map((x) => (
        <mesh key={x} geometry={GEO.cylinder} material={black} position={[x, (U - SLAB) / 2, Z_S - 0.2]} scale={[0.3, U - SLAB, 0.3]} castShadow />
      ))}
      {/* barandas: vidrio sutil con pasamanos negro; abiertas donde llegan las dos escaleras */}
      <Rail x0={x0} x1={x1} z0={Z_S + 0.2} z1={Z_S + 0.2} />
      <Rail x0={x0} x1={x1} z0={T_Z0} z1={T_Z0} />
      <Rail x0={x0} x1={x0} z0={T_Z0} z1={STAIR.z - STAIR.w / 2} />
      <Rail x0={x0} x1={x0} z0={STAIR.z + STAIR.w / 2} z1={Z_S + 0.2} />
      {/* banca y jardinera para que se sienta terraza */}
      <mesh geometry={GEO.box} material={mat('#8a6a4a')} position={[-47, U + 0.22, T_Z0 + 0.5]} scale={[2.2, 0.45, 0.5]} />
      <mesh geometry={GEO.box} material={mat('#8a6a4a')} position={[-51.5, U + 0.3, T_Z0 + 0.6]} scale={[1, 0.6, 0.8]} castShadow />
      <mesh geometry={GEO.sphere} material={mat('#4da862')} position={[-51.5, U + 0.95, T_Z0 + 0.6]} scale={0.95} castShadow />
    </>
  )
}

/** Escalera de piedra ancha con luz en cada escalón y barandas de vidrio con metal negro. `dir` = hacia dónde sube (+1 hacia +x, -1 hacia -x). */
function Flight({ xStart, run, z, w, steps, up }: { xStart: number; run: number; z: number; w: number; steps: number; up: 1 | -1 }) {
  const step = run / steps
  const glow = glowMat('#ffe2a8', 1.6, { dayGlow: 0.3 })
  const black = mat('#1b1d22', { rough: 0.4 })
  const stone = mat('#efe3cc')
  const slope = Math.atan2(U, run) * up
  const len = Math.hypot(U, run)
  const cx = xStart + (up * run) / 2
  return (
    <>
      {Array.from({ length: steps }, (_, i) => {
        const h = (U * (i + 1)) / steps
        const x = xStart + up * (i + 0.5) * step
        return (
          <group key={i}>
            <mesh geometry={GEO.box} material={stone} position={[x, h / 2, z]} scale={[step + 0.01, h, w]} castShadow receiveShadow />
            <mesh geometry={GEO.box} material={glow} position={[x - up * (step / 2 + 0.005), h - 0.1, z]} scale={[0.02, 0.05, w - 0.3]} />
          </group>
        )
      })}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh geometry={GEO.box} material={GLASS} position={[cx, U / 2 + 0.55, z + sd * (w / 2 - 0.04)]} rotation={[0, 0, slope]} scale={[len, 0.9, 0.04]} />
          <mesh geometry={GEO.box} material={black} position={[cx, U / 2 + 1.02, z + sd * (w / 2 - 0.04)]} rotation={[0, 0, slope]} scale={[len, 0.05, 0.06]} />
        </group>
      ))}
    </>
  )
}

function Plaza() {
  const [cx, cz] = PLAZA_C
  const w = PLAZA.x1 - PLAZA.x0
  const d = PLAZA.z1 - PLAZA.z0
  const Y = 0.12
  return (
    <>
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[cx, (Y - 1.5) / 2, cz]} scale={[w, Y + 1.5, d]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[cx, -0.9, cz]} scale={[w + 0.6, 1.2, d + 0.6]} />
      <mesh geometry={GEO.box} material={mat('#efe4cf')} position={[cx, Y + 0.02, cz]} scale={[w - 0.6, 0.05, d - 0.6]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#d7c39c')} position={[cx, Y + 0.06, cz]} scale={[7, 0.03, 7]} />
      <mesh geometry={GEO.cylinder} material={mat(STONE[1])} position={[cx, Y + 0.3, cz]} scale={[4.6, 0.5, 4.6]} castShadow />
      <mesh geometry={GEO.cylinder} material={mat('#62c3d6', { rough: 0.1 })} position={[cx, Y + 0.56, cz]} scale={[4.1, 0.04, 4.1]} />
      <mesh geometry={GEO.cylinder} material={mat(STONE[1])} position={[cx, Y + 1.0, cz]} scale={[0.6, 1.4, 0.6]} />
      <mesh geometry={GEO.cylinder} material={mat(STONE[1])} position={[cx, Y + 1.7, cz]} scale={[1.6, 0.16, 1.6]} />
      {[PLAZA.z0 + 0.2, PLAZA.z1 - 0.2].map((z) => (
        <mesh key={z} geometry={GEO.box} material={mat(STONE[1])} position={[cx, Y + 0.3, z]} scale={[w, 0.5, 0.35]} />
      ))}
      <mesh geometry={GEO.box} material={mat(STONE[1])} position={[PLAZA.x0 + 0.2, Y + 0.3, cz]} scale={[0.35, 0.5, d]} />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return <mesh key={i} geometry={GEO.box} material={mat('#8a6a4a')} position={[cx + Math.cos(a) * 3.6, Y + 0.25, cz + Math.sin(a) * 3.6]} rotation={[0, -a, 0]} scale={[0.5, 0.4, 1.6]} />
      })}
      <Palm x={cx - 3.8} z={cz} />
      <Palm x={cx + 3.8} z={cz - 3.6} />
      <Palm x={cx} z={cz - 4.2} />
    </>
  )
}

const COATS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f', '#6b5b95']

/** Recorrido de los visitantes: rodean el vacío, cruzan el mirador, bajan la escalinata y vuelven a subir. */
const ROUTE: [number, number, number][] = [
  [-33.6, 0.2, UP.z],
  [TOP_X, U, UP.z],
  [X_W + 0.4, U, STAIR.z],
  [PLAZA.x1, 0.15, STAIR.z],
  [PLAZA.x1 - 2, 0.15, 1.2],
  [PLAZA.x1 - 2, 0.15, STAIR.z],
  [PLAZA.x1, 0.15, STAIR.z],
  [X_W + 0.4, U, STAIR.z],
  [TOP_X, U, UP.z],
  [-33.6, 0.2, UP.z],
]
const SEG = ROUTE.slice(1).map((q, i) => {
  const p = ROUTE[i]
  return { p, d: [q[0] - p[0], q[1] - p[1], q[2] - p[2]] as const, len: Math.hypot(q[0] - p[0], q[2] - p[2]) }
})
const LEN = SEG.reduce((a, s) => a + s.len, 0)

function Visitors({ reduceMotion }: { reduceMotion: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const people = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ phase: i / 7 })), [])
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    people.forEach((p, i) => {
      const el = refs.current[i]
      if (!el) return
      let d = (((t * 1.05) / LEN + p.phase) % 1) * LEN
      let seg = SEG[SEG.length - 1]
      for (const s of SEG) {
        if (d <= s.len) {
          seg = s
          break
        }
        d -= s.len
      }
      const f = Math.min(1, d / seg.len)
      el.position.set(seg.p[0] + seg.d[0] * f, seg.p[1] + seg.d[1] * f + Math.abs(Math.sin(t * 4 + i * 2)) * 0.03, seg.p[2] + seg.d[2] * f)
      el.rotation.y = Math.atan2(seg.d[0], seg.d[2])
    })
  })
  return (
    <>
      {people.map((_, i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)} userData={{ dynamic: true }}>
          <mesh geometry={GEO.capsule} material={mat(COATS[i % COATS.length])} position={[0, 0.43, 0]} castShadow />
          <mesh geometry={GEO.sphereSmooth} material={mat(i % 2 ? '#c58c64' : '#8d5a3b')} position={[0, 0.95, 0]} scale={0.36} castShadow />
        </group>
      ))}
    </>
  )
}

/** Agua de la fuente: un chorro que sube y baja suavemente. */
function Jet({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: '#bfefff', emissive: '#7fd8ff', emissiveIntensity: 0.4, transparent: true, opacity: 0.75 }), [])
  useFrame(({ clock }) => {
    if (!ref.current || reduceMotion) return
    const h = 1.1 + Math.sin(clock.elapsedTime * 1.6) * 0.25
    ref.current.scale.set(0.35, h, 0.35)
    ref.current.position.y = 1.9 + h / 2
  })
  return <mesh ref={ref} geometry={GEO.cone} material={m} position={[PLAZA_C[0], 2.45, PLAZA_C[1]]} scale={[0.35, 1.1, 0.35]} userData={{ dynamic: true }} />
}

export function ServicesZone({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const plaza = useMemo(() => getGlassPill('Plaza del Mar', { dot: '#f08a4b', sub: 'Terraza y plaza', dark: night }), [night])
  return (
    <group>
      <Batch version="servicios-3">
        <Terrace />
        <Flight xStart={UP.x1} run={UP.x1 - UP.x0} z={UP.z} w={UP.w} steps={UP.steps} up={-1} />
        <Flight xStart={STAIR.x0 - STAIR.run} run={STAIR.run} z={STAIR.z} w={STAIR.w} steps={STAIR.steps} up={1} />
        <Plaza />
      </Batch>
      <Visitors reduceMotion={reduceMotion} />
      <Jet reduceMotion={reduceMotion} />
      <ScreenLabel label={plaza} position={[PLAZA_C[0], 4.6, PLAZA_C[1]]} pixelHeight={28} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
    </group>
  )
}
