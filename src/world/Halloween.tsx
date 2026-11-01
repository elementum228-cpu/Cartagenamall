import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DISTRICT_PLAZA, GATE, LAYOUT, P1, toWorld } from '../config/mall'
import { HARBOR } from '../tourism/config'
import { Batch } from './Batch'
import { GEO, mat } from './materials'
import { glowMat, lightPoolMat } from './night'

// Temporada de Halloween: calabazas talladas que brillan, guirnaldas naranja y morado en los arcos
// de los pasillos y en la puerta, halos de luz en el piso y una bandada de murciélagos sobre la
// fortaleza. Sobrio (para jóvenes y adultos), sin personajes infantiles. Se monta solo en temporada.

const ORANGE = '#e8761c'
const PURPLE = '#8b5cf6'
/** Las caras miran hacia la cámara (diagonal +x +z). */
const FACING = Math.PI / 4

/** Cara tallada (ojos, nariz y boca dentada), dibujada una vez. */
let faceMaterial: THREE.MeshBasicMaterial | null = null
function faceMat() {
  if (!faceMaterial) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#ffd36b'
    g.shadowColor = '#ff9a2a'
    g.shadowBlur = 10
    const tri = (pts: [number, number][]) => {
      g.beginPath()
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      g.closePath()
      g.fill()
    }
    tri([[28, 52], [52, 52], [40, 30]])
    tri([[76, 52], [100, 52], [88, 30]])
    tri([[58, 70], [70, 70], [64, 58]])
    g.beginPath()
    g.moveTo(26, 82)
    const teeth = [[36, 92], [44, 84], [52, 96], [64, 86], [76, 96], [84, 84], [92, 92], [102, 82]]
    for (const [x, y] of teeth) g.lineTo(x, y)
    g.quadraticCurveTo(64, 120, 26, 82)
    g.fill()
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    faceMaterial = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.35, toneMapped: false })
  }
  return faceMaterial
}

function Pumpkin({ x, z, y = 0.05, s = 1, rot = 0 }: { x: number; z: number; y?: number; s?: number; rot?: number }) {
  const face = faceMat()
  const orange = mat(ORANGE, { rough: 0.6 })
  const dark = mat('#c45f12', { rough: 0.6 })
  return (
    <group position={[x, y, z]} rotation={[0, FACING + rot * 0.25, 0]} scale={s * 1.8}>
      {/* gajos */}
      <mesh geometry={GEO.sphere} material={orange} position={[0, 0.32, 0]} scale={[0.82, 0.62, 0.82]} castShadow />
      <mesh geometry={GEO.sphere} material={dark} position={[-0.2, 0.32, 0]} scale={[0.5, 0.6, 0.78]} />
      <mesh geometry={GEO.sphere} material={dark} position={[0.2, 0.32, 0]} scale={[0.5, 0.6, 0.78]} />
      <mesh geometry={GEO.cylinderLow} material={mat('#5b6b2a')} position={[0, 0.68, 0]} rotation={[0, 0, 0.25]} scale={[0.08, 0.18, 0.08]} />
      {/* cara que brilla (un poco por delante del gajo frontal) */}
      <mesh geometry={GEO.plane} material={face} position={[0, 0.34, 0.43]} scale={[0.52, 0.52, 1]} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#ff8a2a', 1.1, 0.12)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.4]} scale={[2.4, 2.4, 1]} />
    </group>
  )
}

/** Guirnalda colgante entre dos puntos, con bombillos naranja y morado alternados. */
function Garland({ from, to, y, sag = 0.35, n = 9 }: { from: [number, number]; to: [number, number]; y: number; sag?: number; n?: number }) {
  const orange = glowMat(ORANGE, 2.6, { dayGlow: 0.55 })
  const purple = glowMat(PURPLE, 2.6, { dayGlow: 0.55 })
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const u = n === 1 ? 0.5 : i / (n - 1)
        return (
          <mesh
            key={i}
            geometry={GEO.sphere}
            material={i % 2 ? purple : orange}
            position={[from[0] + (to[0] - from[0]) * u, y - Math.sin(u * Math.PI) * sag, from[1] + (to[1] - from[1]) * u]}
            scale={0.26}
          />
        )
      })}
    </group>
  )
}

/** Murciélagos: siluetas que vuelan en círculo sobre la fortaleza aleteando. */
function Bats({ reduceMotion }: { reduceMotion: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const bats = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ r: 14 + (i % 4) * 3.2, h: 12 + (i % 3) * 1.6, speed: 0.12 + (i % 3) * 0.03, phase: (i / 8) * Math.PI * 2, flap: 9 + (i % 4) })), [])
  const black = mat('#1e1b26', { rough: 0.9 })
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    bats.forEach((b, i) => {
      const g = refs.current[i]
      if (!g) return
      const a = b.phase + t * b.speed
      g.position.set(Math.sin(a) * b.r - 2, b.h + Math.sin(t * 1.3 + i) * 0.6, Math.cos(a) * b.r - 2)
      g.rotation.y = a + Math.PI / 2
      const w = Math.sin(t * b.flap + i) * 0.7
      ;(g.children[1] as THREE.Object3D).rotation.z = 0.3 + w
      ;(g.children[2] as THREE.Object3D).rotation.z = -0.3 - w
    })
  })
  return (
    <group>
      {bats.map((_, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} scale={1.1}>
          <mesh geometry={GEO.sphere} material={black} scale={[0.26, 0.22, 0.4]} />
          <group>
            <mesh geometry={GEO.box} material={black} position={[-0.5, 0, 0]} scale={[0.9, 0.03, 0.42]} />
          </group>
          <group>
            <mesh geometry={GEO.box} material={black} position={[0.5, 0, 0]} scale={[0.9, 0.03, 0.42]} />
          </group>
        </group>
      ))}
    </group>
  )
}

/** Decoración completa de Halloween (piso 1, fortaleza y muelle). */
export function Halloween({ reduceMotion }: { reduceMotion: boolean }) {
  const CW = LAYOUT.corridorHalfWidth
  const P = LAYOUT.plazaHalf
  const gate = (lx: number, lz: number) => {
    const [x, z] = toWorld([lx, lz], GATE.facing)
    return [GATE.x + x, GATE.z + z] as [number, number]
  }
  const D = DISTRICT_PLAZA
  const pumpkins: { x: number; z: number; y?: number; s?: number; rot?: number }[] = [
    // plaza central, alrededor de la fuente
    ...[0.6, 2.2, 3.8, 5.4].map((a, i) => ({ x: Math.sin(a) * 4.6, z: Math.cos(a) * 4.6, s: i % 2 ? 0.8 : 1, rot: i })),
    // a la entrada de cada pasillo
    ...P1.zones.flatMap((zn) =>
      [-1, 1].map((s) => {
        const [x, z] = toWorld([s * (CW + 1), P + 0.9], zn.angle)
        return { x, z, y: 0.2, s: s > 0 ? 0.9 : 0.7, rot: s }
      }),
    ),
    // puerta de la fortaleza: una grande a cada lado
    ...[-1, 1].map((s) => {
      const [x, z] = gate(s * 3.4, 3.4)
      return { x, z, y: 0.1, s: 1.5, rot: s * 0.3 }
    }),
    // zona Soporte y muelle
    { x: D.x + 3.6, z: D.z + 0.4, y: 0.05, s: 1 },
    { x: D.x - 0.4, z: D.z + 3.7, y: 0.05, s: 0.75 },
    { x: HARBOR.x - 0.8, z: HARBOR.outerZ + 1.6, y: HARBOR.deckY, s: 0.8 },
    { x: HARBOR.x + 0.9, z: HARBOR.outerZ + 2.4, y: HARBOR.deckY, s: 0.65 },
  ]
  const garlands = P1.zones.map((zn) => {
    const a = toWorld([-(CW + 0.2), P + 0.05], zn.angle)
    const b = toWorld([CW + 0.2, P + 0.05], zn.angle)
    return { from: a, to: b }
  })
  return (
    <group>
      <Batch version="halloween">
        {pumpkins.map((p, i) => (
          <Pumpkin key={i} {...p} />
        ))}
        {garlands.map((g, i) => (
          <Garland key={i} from={g.from} to={g.to} y={3.75} n={11} />
        ))}
        {/* guirnalda sobre la puerta de la fortaleza */}
        <Garland from={gate(-3.6, 2.4)} to={gate(3.6, 2.4)} y={6.4} sag={0.6} n={13} />
      </Batch>
      <Bats reduceMotion={reduceMotion} />
    </group>
  )
}
