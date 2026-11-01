import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { ESCALATOR, worldToEsc, P1, toWorld } from '../config/mall'
import { GEO, PALETTE, mat } from './materials'
import { glowMat } from './night'
import { onCourt } from '../football/config'

// Ambientación (bancas, plantas, palmeras, faroles) con InstancedMesh: cientos de piezas en
// pocas llamadas de dibujo.

interface Inst {
  p: [number, number, number]
  s: [number, number, number]
  r?: [number, number, number]
}

function Instanced({ geometry, material, items, shadow = true }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Inst[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.rotation.set(...(it.r ?? [0, 0, 0]))
      o.scale.set(...it.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadow} receiveShadow frustumCulled={false} />
}

const Y = 0.2 // altura del piso del mall

// ── Generación de posiciones ──
const benchSeats: Inst[] = []
const benchBacks: Inst[] = []
const benchBases: Inst[] = []
const pots: Inst[] = []
const foliage: Inst[] = []
const planters: Inst[] = []
const trunks: Inst[] = []
const fronds: Inst[] = []
const lampPoles: Inst[] = []
const lampHeads: Inst[] = []
const bushes: Inst[] = []
/** Huella en el piso de cada pieza (x, z, radio): la usa la navegación de los visitantes. */
export const DECOR_FOOTPRINTS: { x: number; z: number; r: number }[] = []

function bench(x: number, z: number, rot: number) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const back = (d: number): [number, number] => [x - s * d, z - c * d]
  benchBases.push({ p: [x, Y + 0.2, z], s: [1.3, 0.4, 0.36], r: [0, rot, 0] })
  DECOR_FOOTPRINTS.push({ x, z, r: 0.85 })
  benchSeats.push({ p: [x, Y + 0.45, z], s: [1.6, 0.1, 0.55], r: [0, rot, 0] })
  const [bx, bz] = back(0.25)
  benchBacks.push({ p: [bx, Y + 0.75, bz], s: [1.6, 0.45, 0.1], r: [0, rot, 0] })
}

function plant(x: number, z: number, size = 1, y = Y) {
  pots.push({ p: [x, y + 0.3 * size, z], s: [0.7 * size, 0.6 * size, 0.7 * size] })
  DECOR_FOOTPRINTS.push({ x, z, r: 0.5 * size })
  foliage.push({ p: [x, y + 0.95 * size, z], s: [1 * size, 1.15 * size, 1 * size] })
}

function palm(x: number, z: number, h: number, y = Y, seed = 0) {
  const lean = 0.08 + (seed % 3) * 0.04
  trunks.push({ p: [x, y + h / 2, z], s: [0.32, h, 0.32], r: [lean, seed, 0] })
  DECOR_FOOTPRINTS.push({ x, z, r: 0.3 })
  const topX = x + Math.sin(seed) * Math.sin(lean) * h * 0.5
  const topZ = z + Math.cos(seed) * Math.sin(lean) * h * 0.5
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + seed
    fronds.push({ p: [topX + Math.sin(a) * 0.8, y + h + 0.05, topZ + Math.cos(a) * 0.8], s: [0.5, 0.08, 1.9], r: [0.35, a, 0] })
  }
}

function lamp(x: number, z: number) {
  lampPoles.push({ p: [x, Y + 1.3, z], s: [0.1, 2.6, 0.1] })
  DECOR_FOOTPRINTS.push({ x, z, r: 0.15 })
  lampHeads.push({ p: [x, Y + 2.7, z], s: [0.4, 0.4, 0.4] })
}

for (const zone of P1.zones) {
  const w = (lx: number, lz: number) => toWorld([lx, lz], zone.angle)
  // jardinera central con bancas a cada lado
  const [cx, cz] = w(0, 16)
  planters.push({ p: [cx, Y + 0.25, cz], s: [1.2, 0.5, 2.6], r: [0, zone.angle, 0] })
  for (const dz of [-0.75, 0, 0.75]) {
    const [px, pz] = w(0, 16 + dz)
    DECOR_FOOTPRINTS.push({ x: px, z: pz, r: 0.65 })
  }
  for (const dz of [-0.8, 0, 0.8]) {
    const [fx, fz] = w(0, 16 + dz)
    foliage.push({ p: [fx, Y + 0.75, fz], s: [0.8, 0.7, 0.8] })
  }
  for (const s of [-1, 1]) {
    const [bx, bz] = w(s * 1.15, 16)
    bench(bx, bz, zone.angle + (s * Math.PI) / 2)
    const [b2x, b2z] = w(s * 7.6, 10.9)
    bench(b2x, b2z, zone.angle - (s * Math.PI) / 2)
    const [px, pz] = w(s * 8.4, 20.4)
    plant(px, pz, 1.1)
    const [p2x, p2z] = w(s * 8.6, 12.2)
    plant(p2x, p2z, 0.8)
    const [lx, lz] = w(s * 4.2, 11)
    lamp(lx, lz)
    const [l2x, l2z] = w(s * 4.2, 21)
    lamp(l2x, l2z)
  }
}

// Plaza central
/** Zona de la plaza que ocupan las escaleras eléctricas (no se decora). */
const onEscalator = (wx: number, wz: number) => {
  const [x, z] = worldToEsc(wx, wz)
  return x > ESCALATOR.lanesX[0] - ESCALATOR.width && x < ESCALATOR.lanesX[1] + ESCALATOR.width && z > ESCALATOR.topZ && z < ESCALATOR.bottomZ + 2
}
/** Camino interior de la puerta a la plaza (cuadrante del frente, sobre la diagonal x = z). */
const onEntrancePath = (x: number, z: number) => x > 8 && z > 8 && Math.abs(x - z) < 4.5
/** Esquina entre Lifestyle y Belleza: zona de servicios, con su propia decoración (District). */
const onDistrict = (x: number, z: number) => x < -9.8 && z > 9.8
/** Jardín del fondo bajo la llegada de las escaleras y el torreón del piso 2: despejado. */
const underEscalator = (x: number, z: number) => x < -6 && z < -6 && Math.abs(x - z) < 6

for (let i = 0; i < 4; i++) {
  const a = Math.PI / 4 + (i * Math.PI) / 2
  if (!onEscalator(Math.sin(a) * 5.2, Math.cos(a) * 5.2)) bench(Math.sin(a) * 5.2, Math.cos(a) * 5.2, a + Math.PI)
  const [px, pz] = [Math.sin(a) * 7.6, Math.cos(a) * 7.6]
  if (!onEscalator(px, pz)) palm(px, pz, 3.6, Y, i * 1.7)
  for (const d of [0.45, -0.45]) {
    const [qx, qz] = [Math.sin(a + d) * 7.4, Math.cos(a + d) * 7.4]
    if (!onEscalator(qx, qz)) plant(qx, qz, 0.75)
  }
}

// Jardines exteriores y playa
for (let q = 0; q < 4; q++) {
  const base = Math.PI / 4 + (q * Math.PI) / 2
  for (let i = 0; i < 5; i++) {
    const a = base + (i - 2) * 0.16
    const r = 17 + (i % 3) * 5
    if (onEntrancePath(Math.sin(a) * r, Math.cos(a) * r) || onDistrict(Math.sin(a) * r, Math.cos(a) * r) || underEscalator(Math.sin(a) * r, Math.cos(a) * r) || onCourt(Math.sin(a) * r, Math.cos(a) * r, 1.5)) continue
    palm(Math.sin(a) * r, Math.cos(a) * r, 3.2 + (i % 2) * 1.1, 0.08, q * 3 + i)
  }
  for (let i = 0; i < 7; i++) {
    const a = base + (i - 3) * 0.12
    const r = 13.5 + (i % 2) * 2
    if (onEntrancePath(Math.sin(a) * r, Math.cos(a) * r) || onDistrict(Math.sin(a) * r, Math.cos(a) * r) || underEscalator(Math.sin(a) * r, Math.cos(a) * r) || onCourt(Math.sin(a) * r, Math.cos(a) * r, 1)) continue
    bushes.push({ p: [Math.sin(a) * r, 0.45, Math.cos(a) * r], s: [1.3, 1, 1.3] })
  }
}

/** `sparse` (calidad baja): sin arbustos de los jardines. */
export function Decor({ shadows, sparse = false }: { shadows: boolean; sparse?: boolean }) {
  const wood = mat(PALETTE.wood)
  return (
    <group>
      <Instanced geometry={GEO.box} material={mat(PALETTE.trim)} items={benchBases} shadow={shadows} />
      <Instanced geometry={GEO.rounded} material={wood} items={benchSeats} shadow={shadows} />
      <Instanced geometry={GEO.rounded} material={wood} items={benchBacks} shadow={shadows} />
      <Instanced geometry={GEO.cylinder} material={mat(PALETTE.pot)} items={pots} shadow={shadows} />
      <Instanced geometry={GEO.sphere} material={mat(PALETTE.leaf)} items={foliage} shadow={shadows} />
      <Instanced geometry={GEO.rounded} material={mat(PALETTE.trim)} items={planters} shadow={shadows} />
      <Instanced geometry={GEO.cylinderLow} material={mat(PALETTE.trunk)} items={trunks} shadow={shadows} />
      <Instanced geometry={GEO.box} material={mat(PALETTE.leafDark)} items={fronds} shadow={shadows} />
      <Instanced geometry={GEO.cylinderLow} material={mat(PALETTE.metal)} items={lampPoles} shadow={false} />
      <Instanced geometry={GEO.sphere} material={glowMat(PALETTE.lamp, 2.4, { dayGlow: 0.6 })} items={lampHeads} shadow={false} />
      {!sparse && <Instanced geometry={GEO.sphere} material={mat(PALETTE.grassDark)} items={bushes} shadow={shadows} />}
    </group>
  )
}
