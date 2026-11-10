import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FLOOR_BY_ID, FOOD_ISLAND_AT, FOOD_LAYOUT, onP1Walkway } from '../config/mall'
import { P2_GROW as G } from '../config/preview'
import { Batch } from './Batch'
import { helmetColor, useHelmetsOn } from './helmets'
import { FoodCrowd } from './FlashCrowd'
import { ScreenLabel } from './Billboard'
import { LABEL_PRIORITY } from './labels'
import { getGlassPill } from './labelTexture'
import { GEO, GLASS, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { useIsNight } from '../lib/useIsNight'

// Piso 2: terraza gastronómica colonial, elevada al fondo de la fortaleza. Coordenadas del piso
// (centro de la losa = origen del piso, que pone MallFloor).

const H = FOOD_LAYOUT.half
const T = FOOD_LAYOUT.terrace
const ELEV = FLOOR_BY_ID.P2.elevation
const OFFSET = FLOOR_BY_ID.P2.offset
const WALL_H = 1.3
const STONE = '#e4d2ae'
const STONE_DARK = '#cdb68e'
const WOOD_DECK = '#dcb78c'
const STOOL_COLORS = ['#f2b880', '#9fd0c7', '#f4a9a0', '#c9b6e4', '#f7d488']
const UMBRELLA_COLORS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f']

/** Chaflán de la esquina del frente, donde llegan las escaleras (en diagonal). */
const CUT = FOOD_LAYOUT.arrivalCut
const ARRIVAL_GAP = CUT - 0.2

/** Caja de la losa (lado 2·half, grosor `h`) con la esquina del frente (+x, +z) recortada en diagonal. */
function chamferedSlab(half: number, cut: number, h: number) {
  // forma en el plano (x, −z): al girarla queda acostada con el grosor hacia arriba
  const pts: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half - cut],
    [half - cut, half],
    [-half, half],
  ]
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, -h / 2, 0)
  return g
}

/**
 * Columnas de la arcada frontal (coordenadas del piso). Se saltan los tramos que caerían sobre
 * los locales premium del piso 1 y donde llegan las escaleras.
 */
const ARCADE_Z = G ? [-13, -8.5, -4, 0.5, 5, 9.5, 14].map((v) => v + (G ? 0 : 0)) : [-4, 0.5, 5, 9.5]
const ARCADE: [number, number][] = ([
  ...ARCADE_Z.map((z): [number, number] => [H - 0.6, z]),
  ...ARCADE_Z.slice(0, G ? 6 : 3).map((x): [number, number] => [x, H - 0.6]),
  // Una columna nunca se apoya sobre la plaza o un pasillo del piso 1: ahí camina la gente.
] as [number, number][]).filter(
  ([x, z]) => !onP1Walkway(x + OFFSET[0], z + OFFSET[1], 0.8) && Math.hypot(x - FOOD_LAYOUT.arrival.x, z - FOOD_LAYOUT.arrival.z) > 3.5,
)

/** Baranda de vidrio y piedra recta de (x0,z0) a (x1,z1). */
function railing(x0: number, z0: number, x1: number, z1: number, key: string) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const rot = Math.atan2(-(z1 - z0), x1 - x0)
  return (
    <group key={key} position={[(x0 + x1) / 2, 0.2, (z0 + z1) / 2]} rotation={[0, rot, 0]}>
      <mesh geometry={GEO.box} material={mat(STONE)} position={[0, 0.2, 0]} scale={[len, 0.4, 0.35]} />
      <mesh geometry={GEO.box} material={GLASS} position={[0, 0.75, 0]} scale={[len, 0.7, 0.05]} />
      <mesh geometry={GEO.box} material={mat('#3a4450')} position={[0, 1.12, 0]} scale={[len, 0.07, 0.12]} />
    </group>
  )
}

/** Losa con borde de piedra, muros del fondo, barandas, pérgola y columnas: todo estático. */
function Shell() {
  const slab = useMemo(() => ({ top: chamferedSlab(H, CUT, 0.5), band: chamferedSlab(H + 0.2, CUT, 0.6) }), [])
  const wall = mat(PALETTE.wall)
  const wood = mat(PALETTE.wood)
  // Columnas en el jardín del fondo de la fortaleza (no caen sobre tiendas del piso 1).
  // con la losa más grande, el patio queda sin columnas: solo apoyos finos en el borde y el torreón del fondo
  const columns: [number, number][] = G
    ? []
    : [
        [-6.5, -6.5],
        [4, -6.5],
        [-6.5, 4],
        [4, 4],
      ]
  return (
    <group>
      {/* losa: piso claro, canto de piedra y faja inferior */}
      <mesh geometry={slab.top} material={mat(PALETTE.floor)} position={[0, -0.05, 0]} receiveShadow castShadow />
      <mesh geometry={slab.band} material={mat(STONE_DARK)} position={[0, -0.6, 0]} />
      <mesh geometry={GEO.box} material={mat(PALETTE.floorAlt)} position={[2, 0.212, 2]} scale={[2 * H - 9, 0.02, 2 * H - 9]} receiveShadow />
      {/* terraza de madera con pérgola en la esquina del fondo */}
      <mesh geometry={GEO.box} material={mat(WOOD_DECK)} position={[(T.x0 + T.x1) / 2 + 0.2, 0.215, (T.z0 + T.z1) / 2 + 0.2]} scale={[T.x1 - T.x0 - 0.4, 0.03, T.z1 - T.z0 - 0.4]} receiveShadow />
      {[
        [T.x0 + 0.8, T.z0 + 0.8],
        [T.x1 - 0.4, T.z0 + 0.8],
        [T.x0 + 0.8, T.z1 - 0.4],
        [T.x1 - 0.4, T.z1 - 0.4],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={GEO.box} material={wood} position={[x, 1.6, z]} scale={[0.25, 2.8, 0.25]} castShadow />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={wood} position={[T.x0 + 0.8 + i * ((T.x1 - T.x0 - 1.2) / 6), 3.05, (T.z0 + T.z1) / 2 + 0.2]} scale={[0.14, 0.14, T.z1 - T.z0 - 0.6]} castShadow />
      ))}
      {[T.z0 + 0.8, T.z1 - 0.4].map((z) => (
        <mesh key={z} geometry={GEO.box} material={wood} position={[(T.x0 + T.x1) / 2 + 0.2, 2.95, z]} scale={[T.x1 - T.x0 - 0.6, 0.18, 0.18]} />
      ))}
      {/* muros bajos detrás de los locales (bordes del fondo) */}
      <mesh geometry={GEO.box} material={wall} position={[0, WALL_H / 2 + 0.2, -H + 0.2]} scale={[2 * H, WALL_H, 0.4]} castShadow />
      <mesh geometry={GEO.box} material={wall} position={[-H + 0.2, WALL_H / 2 + 0.2, 0]} scale={[0.4, WALL_H, 2 * H]} castShadow />
      {/* barandas hacia la plaza; abiertas donde llegan las escaleras */}
      {railing(H - 0.2, -H + 0.4, H - 0.2, H - ARRIVAL_GAP, 'este')}
      {railing(-H + 0.4, H - 0.2, H - ARRIVAL_GAP, H - 0.2, 'frente')}
      {/* arcada bajo los bordes que dan a la plaza: el piso se lee elevado desde la fortaleza */}
      {ARCADE.map(([x, z]) => (
        <group key={`a${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={GEO.box} material={mat(STONE)} position={[0, -ELEV / 2 - 0.4, 0]} scale={[G ? 0.5 : 0.75, ELEV - 0.8, G ? 0.5 : 0.75]} castShadow />
          <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, -ELEV + 0.3, 0]} scale={[G ? 0.8 : 1.05, 0.4, G ? 0.8 : 1.05]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={mat(STONE)} position={[H - 0.3, -1.05, -CUT / 2]} scale={[0.6, 0.7, 2 * H - CUT]} />
      <mesh geometry={GEO.box} material={mat(STONE)} position={[-CUT / 2, -1.05, H - 0.3]} scale={[2 * H - CUT, 0.7, 0.6]} />
      {/* columnas hasta el suelo de la fortaleza */}
      {columns.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={GEO.box} material={mat(STONE)} position={[0, -ELEV / 2 - 0.4, 0]} scale={[1, ELEV - 0.8, 1]} castShadow />
          <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, -ELEV + 0.35, 0]} scale={[1.4, 0.5, 1.4]} />
          <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, -1.05, 0]} scale={[1.3, 0.3, 1.3]} />
        </group>
      ))}
      <Keep />
    </group>
  )
}

/**
 * Torreón: la parte de la terraza que sale por fuera de la muralla se apoya en un macizo de piedra
 * que baja hasta el mar, con zócalo en talud y cordón, como si el castillo creciera en esa esquina.
 */
function Keep() {
  // cara exterior de la muralla, en coordenadas de este piso
  const wall = -31 - 1.1 - OFFSET[0]
  const bottom = -ELEV - 1.3
  const top = -0.9
  const h = top - bottom
  const stone = mat('#c7a574')
  const dark = mat('#9c7d55')
  const cordon = mat('#e6d2a8')
  const E = H + 0.2
  const parts: { x: number; z: number; w: number; d: number }[] = [
    { x: (-E + wall) / 2, z: 0, w: wall + E, d: 2 * E },
    { x: (wall + E) / 2, z: (-E + wall) / 2, w: E - wall, d: wall + E },
  ]
  return (
    <group>
      {parts.map((p, i) => (
        <group key={i}>
          <mesh geometry={GEO.box} material={stone} position={[p.x, bottom + h / 2, p.z]} scale={[p.w, h, p.d]} castShadow receiveShadow />
          <mesh geometry={GEO.box} material={dark} position={[p.x, bottom + 0.9, p.z]} scale={[p.w + 0.5, 1.8, p.d + 0.5]} />
          <mesh geometry={GEO.box} material={cordon} position={[p.x, top - 0.25, p.z]} scale={[p.w + 0.12, 0.16, p.d + 0.12]} />
        </group>
      ))}
      {/* troneras en la cara que mira al frente */}
      {[-12.6 + G, -10.2 + G].map((x) => (
        <mesh key={x} geometry={GEO.box} material={dark} position={[x, -ELEV / 2, E + 0.01]} scale={[0.35, 1.1, 0.04]} />
      ))}
    </group>
  )
}

interface Inst {
  p: [number, number, number]
  s: [number, number, number]
  r?: number
  /** Rotación en X (para planos acostados en el piso). */
  rx?: number
  c?: string
}

function Instanced({ geometry, material, items, shadow = false }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Inst[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.rotation.set(it.rx ?? 0, it.r ?? 0, 0)
      o.scale.set(...it.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      if (it.c) m.setColorAt(i, col.set(it.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadow} receiveShadow frustumCulled={false} />
}

const WHITE = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 })

/** Islas del patio (coordenadas del piso) para no poner mesas encima. */
const ISLANDS: [number, number][] = FOOD_ISLAND_AT

/** Mesas, sillas, sombrillas, jardineras, palmeras, faroles, guirnaldas y comensales. */
/** Mobiliario de la terraza (posiciones fijas). `footprints`: huellas en el piso para la navegación. */
function buildFurniture() {
  const footprints: { x: number; z: number; r: number }[] = []
  const tops: Inst[] = []
  const legs: Inst[] = []
  const stools: Inst[] = []
  const poles: Inst[] = []
  const canopies: Inst[] = []
  const pots: Inst[] = []
  const leaves: Inst[] = []
  const trunks: Inst[] = []
  const fronds: Inst[] = []
  const lampPoles: Inst[] = []
  const lampHeads: Inst[] = []
  const pools: Inst[] = []
  const bodies: Inst[] = []
  const heads: Inst[] = []
  const hats: Inst[] = []
  const bulbs: Inst[] = []
  /** Lamparitas sobre cada mesa: de noche la mesa se lee y el patio se ve habitado. */
  const candles: Inst[] = []
  let k = 0

  const table = (x: number, z: number, seats: number, umbrella = false) => {
    tops.push({ p: [x, 0.95, z], s: [1.25, 0.08, 1.25] })
    footprints.push({ x, z, r: 1.22 })
    candles.push({ p: [x, 1.07, z], s: [0.16, 0.16, 0.16] })
    legs.push({ p: [x, 0.57, z], s: [0.14, 0.75, 0.14] })
    for (let i = 0; i < seats; i++) {
      const a = (i / seats) * Math.PI * 2 + 0.4
      const sx = x + Math.cos(a) * 1
      const sz = z + Math.sin(a) * 1
      stools.push({ p: [sx, 0.45, sz], s: [0.42, 0.5, 0.42], c: STOOL_COLORS[k++ % STOOL_COLORS.length] })
      if ((k + Math.round(x)) % 4 === 0) {
        bodies.push({ p: [sx, 1.05, sz], s: [1, 0.85, 1], r: -a, c: STOOL_COLORS[(k + 2) % STOOL_COLORS.length] })
        heads.push({ p: [sx, 1.55, sz], s: [0.34, 0.34, 0.34], c: k % 2 ? '#c58c64' : '#8d5a3b' })
        hats.push({ p: [sx, 1.575, sz], s: [0.38, 0.38, 0.38], c: helmetColor(k) })
      }
    }
    if (umbrella) {
      poles.push({ p: [x, 1.6, z], s: [0.07, 2.6, 0.07] })
      canopies.push({ p: [x, 2.85, z], s: [2.6, 0.55, 2.6], c: UMBRELLA_COLORS[k % UMBRELLA_COLORS.length] })
    }
  }

  // Patio: rejilla que evita islas, frentes de locales, terraza y la llegada de las escaleras.
  // En damero (una sí, una no): el patio respira y se ven bien los locales y las islas.
  for (let gx = 0, x = -H + 8.5; x <= H - 2; x += 4.2, gx++)
    for (let gz = 0, z = -H + 8.5; z <= H - 2; z += 4.2, gz++) {
      if ((gx + gz) % 2 === 1) continue
      if (ISLANDS.some(([ix, iz]) => Math.hypot(x - ix, z - iz) < 3.2)) continue
      if (x > FOOD_LAYOUT.arrival.x - 3 && z > FOOD_LAYOUT.arrival.z - 3.5) continue
      table(x, z, 4, (k / 4) % 2 === 0)
    }
  // Terraza bajo la pérgola
  table(T.x0 + 2.4, T.z0 + 2.4, 3)
  table(T.x1 - 2.2, T.z1 - 2.2, 3)

  const plant = (x: number, z: number, size = 1) => {
    pots.push({ p: [x, 0.2 + 0.3 * size, z], s: [0.7 * size, 0.6 * size, 0.7 * size] })
    footprints.push({ x, z, r: 0.55 * size })
    leaves.push({ p: [x, 0.2 + 0.95 * size, z], s: [1 * size, 1.15 * size, 1 * size] })
  }
  // Jardineras a lo largo de las barandas
  for (let z = -H + 4; z <= H - 12; z += 6) plant(H - 1.2, z, 0.85)
  for (let x = -H + 3; x <= H - 12.5; x += 6.5) plant(x, H - 1.2, 0.85)
  plant(T.x1 - 0.6, T.z0 + 0.9, 0.7)
  plant(T.x0 + 0.9, T.z1 - 0.6, 0.7)

  // Sin palmeras en la terraza: patio despejado.

  const lamp = (x: number, z: number) => {
    lampPoles.push({ p: [x, 1.5, z], s: [0.1, 2.6, 0.1] })
    footprints.push({ x, z, r: 0.15 })
    lampHeads.push({ p: [x, 2.85, z], s: [0.4, 0.4, 0.4] })
    pools.push({ p: [x, 0.24, z], s: [4, 4, 1], rx: -Math.PI / 2 })
  }
  const LAMPS: [number, number][] = G
    ? [
        [-8, -4],
        [6, -5],
        [-8, 9.5],
        [H - 1, 10],
        [9.5, H - 1],
      ]
    : [
        [-6.5, -6.5],
        [8, -6.5],
        [-6.5, 7],
        [H - 1, 9],
        [8.5, H - 1],
      ]
  for (const [x, z] of LAMPS) lamp(x, z)

  // Guirnaldas sobre la pérgola y a lo largo de la baranda frontal
  for (let i = 0; i <= 10; i++) {
    const u = i / 10
    bulbs.push({ p: [T.x0 + 0.8 + (T.x1 - T.x0 - 1.2) * u, 2.75 - Math.sin(u * Math.PI) * 0.35, (T.z0 + T.z1) / 2], s: [0.1, 0.1, 0.1] })
  }
  for (let i = 0; i <= 16; i++) {
    const u = i / 16
    bulbs.push({ p: [-H + 1 + (2 * H - 2) * u, 3.0 - Math.sin(((u * 16) % 4) / 4 * Math.PI) * 0.35, H - 0.6], s: [0.1, 0.1, 0.1] })
  }

  // Guirnaldas que cruzan el patio de farol a farol (catenaria), como en una terraza de Cartagena
  const strand = (a: [number, number], b: [number, number], n: number, top = 3.4, sag = 0.7) => {
    for (let i = 1; i < n; i++) {
      const u = i / n
      bulbs.push({ p: [a[0] + (b[0] - a[0]) * u, top - Math.sin(u * Math.PI) * sag, a[1] + (b[1] - a[1]) * u], s: [0.11, 0.11, 0.11] })
    }
  }
  strand(LAMPS[0], LAMPS[1], 14)
  strand(LAMPS[0], LAMPS[2], 13)
  strand(LAMPS[2], LAMPS[4], 14)
  strand(LAMPS[1], LAMPS[3], 13)
  strand(LAMPS[0], LAMPS[3], 20, 3.9, 0.5)

  return { tops, legs, stools, poles, canopies, pots, leaves, trunks, fronds, lampPoles, lampHeads, pools, bodies, heads, hats, bulbs, candles, footprints }
}

const FURNITURE = buildFurniture()
/** Huellas (x, z, radio) del mobiliario del piso 2: mesas con taburetes, macetas, palmeras y faroles. */
export const FOOD_FOOTPRINTS = FURNITURE.footprints

function Furniture({ detail }: { detail: 'high' | 'low' }) {
  const data = FURNITURE
  const helmets = useHelmetsOn()

  const high = detail === 'high'
  return (
    <group>
      <Instanced geometry={GEO.cylinder} material={mat('#e9dcc4')} items={data.tops} shadow={high} />
      <Instanced geometry={GEO.cylinderLow} material={mat(PALETTE.metal)} items={data.legs} />
      <Instanced geometry={GEO.cylinderLow} material={WHITE} items={data.stools} />
      <Instanced geometry={GEO.cylinderLow} material={mat('#f6efe2')} items={data.poles} />
      <Instanced geometry={GEO.cone} material={WHITE} items={data.canopies} shadow={high} />
      <Instanced geometry={GEO.cylinder} material={mat(PALETTE.pot)} items={data.pots} />
      <Instanced geometry={GEO.sphere} material={mat(PALETTE.leaf)} items={data.leaves} shadow={high} />
      <Instanced geometry={GEO.cylinderLow} material={mat(PALETTE.trunk)} items={data.trunks} shadow={high} />
      <Instanced geometry={GEO.box} material={mat(PALETTE.leafDark)} items={data.fronds} shadow={high} />
      <Instanced geometry={GEO.cylinderLow} material={mat(PALETTE.metal)} items={data.lampPoles} />
      <Instanced geometry={GEO.sphere} material={glowMat(PALETTE.lamp, 2.4, { dayGlow: 0.6 })} items={data.lampHeads} />
      <Instanced geometry={GEO.plane} material={lightPoolMat('#ffd9a0', 0.6)} items={data.pools} />
      <Instanced geometry={GEO.sphere} material={glowMat('#ffd27a', 2.6, { dayGlow: 0.25 })} items={data.bulbs} />
      <Instanced geometry={GEO.cylinderLow} material={glowMat('#ffc983', 2.2, { dayGlow: 0.1 })} items={data.candles} />
      {high && <Instanced geometry={GEO.capsule} material={WHITE} items={data.bodies} />}
      {high && <Instanced geometry={GEO.sphereSmooth} material={WHITE} items={data.heads} />}
      {high && helmets && <Instanced geometry={GEO.helmet} material={WHITE} items={data.hats} />}
    </group>
  )
}

/** Estructura estática del piso 2 (también se ve como silueta desde otros pisos). */
export function FoodCourtShell() {
  return (
    <Batch version="estructura-p2-fortaleza">
      <Shell />
    </Batch>
  )
}

/** Mobiliario y ambiente de la terraza (solo con el piso en detalle). */
export function FoodCourtDetail({ detail, crowd = 6 }: { detail: 'high' | 'low'; crowd?: number }) {
  return (
    <>
      <Furniture detail={detail} />
      {crowd > 0 && <FoodCrowd count={crowd} />}
    </>
  )
}

/** Carteles del piso 2: principal y terraza. */
export function FoodCourtLabels() {
  const floor = FLOOR_BY_ID.P2
  const night = useIsNight()
  const title = useMemo(() => getGlassPill(floor.title, { dot: '#f7b34b', sub: floor.subtitle, dark: night }), [floor, night])
  const terrace = useMemo(() => getGlassPill('Terraza', { dot: '#d4842e', dark: night }), [night])
  return (
    <>
      <ScreenLabel label={title} position={[H - 11, 5.4, H - 11]} pixelHeight={35} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
      <ScreenLabel label={terrace} position={[(T.x0 + T.x1) / 2, 4, (T.z0 + T.z1) / 2]} pixelHeight={24} minZoomRatio={0.9} priority={LABEL_PRIORITY.section} />
    </>
  )
}
