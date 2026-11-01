import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FORTRESS, GATE, MALL } from '../config/mall'
import { cameraState } from './cameraState'
import { Batch } from './Batch'
import { getGateSign, getGlassPill } from './labelTexture'
import { ScreenLabel } from './Billboard'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, WATER, mat, shade } from './materials'
import { glowMat, lightPoolMat, litLabelMat, uplightMat } from './night'
import { useIsNight } from '../lib/useIsNight'

// Fortaleza caribeña: murallas, baluartes, garitas, cañones y entrada monumental, construidos con
// módulos reutilizables y datos de `FORTRESS` (config/mall.ts). Todo es estático: Batch lo fusiona.

const S = FORTRESS.half
const WT = FORTRESS.wallThickness
const WH = FORTRESS.wallHeight
const BASE_Y = -1.3 // las murallas nacen en el agua
// piedra coralina: más tostada que la arena y el piso del mall para que la muralla se lea
export const STONE = ['#c7a574', '#bd9a68', '#cdae7f']
export const STONE_DARK = '#9c7d55'
export const CORDON = '#e6d2a8'
const TERRACOTTA = '#d0784f'
const IRON = '#2f3338'

/** Faroles sobre el adarve (x, z): frente, flancos y baluartes. */
const WALL_LANTERNS: [number, number][] = [
  [8, S],
  [-12, S],
  [S, 8],
  [S, -12],
  [-S, -20],
  [-20, -S],
]

/** Geometrías propias de la fortaleza (compartidas). */
const FGEO = {
  prism: new THREE.CylinderGeometry(0.5, 0.5, 1, 3), // tejado a dos aguas
  dome: new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  octa: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  barrel: new THREE.CylinderGeometry(0.15, 0.21, 1, 10),
  wheel: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  tube: new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, true),
}

/** Bañador de luz ascendente sobre una cara de piedra (plano vertical que mira hacia `facing`). */
function Uplight({ x, z, y = BASE_Y + 1, facing, width, height, strength = 0.55 }: { x: number; z: number; y?: number; facing: number; width: number; height: number; strength?: number }) {
  return <mesh geometry={GEO.plane} material={uplightMat('plane', '#ffc27a', strength)} position={[x, y + height / 2, z]} rotation={[0, facing, 0]} scale={[width, height, 1]} />
}

/** Tramo de muralla entre dos puntos, partido en módulos con variación sutil de tono. */
function WallRun({ from, to, outward }: { from: [number, number]; to: [number, number]; outward: [number, number] }) {
  const [x0, z0] = from
  const [x1, z1] = to
  const len = Math.hypot(x1 - x0, z1 - z0)
  const n = Math.max(1, Math.round(len / 6))
  const seg = len / n
  const rot = Math.atan2(x1 - x0, z1 - z0) // el módulo corre a lo largo de su +z local
  const ox = outward[0] * (WT / 2 - 0.25)
  const oz = outward[1] * (WT / 2 - 0.25)
  const merlons = Math.floor(len / 1.6)
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const u = (i + 0.5) / n
        const cx = x0 + (x1 - x0) * u
        const cz = z0 + (z1 - z0) * u
        return (
          <group key={i} position={[cx, 0, cz]} rotation={[0, rot, 0]}>
            {/* zócalo en talud, cuerpo, cordón y adarve */}
            <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, BASE_Y + 0.6, 0]} scale={[WT + 0.6, 1.2, seg + 0.02]} />
            <mesh geometry={GEO.box} material={mat(STONE[i % STONE.length])} position={[0, (BASE_Y + WH) / 2 + 0.3, 0]} scale={[WT, WH - BASE_Y - 0.6, seg + 0.02]} castShadow receiveShadow />
            <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, WH - 0.55, 0]} scale={[WT + 0.18, 0.18, seg + 0.02]} />
            <mesh geometry={GEO.box} material={mat(shade(STONE[i % STONE.length], 0.15))} position={[0, WH + 0.01, 0]} scale={[WT - 0.1, 0.04, seg]} receiveShadow />
          </group>
        )
      })}
      {/* parapeto exterior con almenas */}
      <group position={[(x0 + x1) / 2 + ox, 0, (z0 + z1) / 2 + oz]} rotation={[0, rot, 0]}>
        <mesh geometry={GEO.box} material={mat(STONE[1])} position={[0, WH + 0.2, 0]} scale={[0.55, 0.4, len]} castShadow />
        {Array.from({ length: merlons }, (_, k) => (
          <mesh key={k} geometry={GEO.box} material={mat(STONE[1])} position={[0, WH + 0.7, (k - (merlons - 1) / 2) * 1.6]} scale={[0.55, 0.6, 0.9]} castShadow />
        ))}
      </group>
    </group>
  )
}

/** Baluarte en punta de flecha en una esquina (polígono extruido) con su remate. */
function Bastion({ corner, reach }: { corner: [number, number]; reach: number }) {
  const [sx, sz] = corner
  const geos = useMemo(() => {
    // (u, v): + hacia afuera en x y en z. Se pasa a la forma 2D (x, −z) para extruir en y.
    const r = reach
    const pts: [number, number][] = [
      [-6, 1.1],
      [-0.6, r * 0.78],
      [r * 0.78, r * 0.78],
      [r * 0.78, -0.6],
      [1.1, -6],
      [-1.5, -1.5],
    ]
    const shape = (k: number) =>
      new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(sx * S + sx * u * k, -(sz * S + sz * v * k))))
    const body = new THREE.ExtrudeGeometry(shape(1), { depth: WH + 0.3 - BASE_Y, bevelEnabled: false })
    body.rotateX(-Math.PI / 2)
    body.translate(0, BASE_Y, 0)
    const cap = new THREE.ExtrudeGeometry(shape(1.02), { depth: 0.22, bevelEnabled: false })
    cap.rotateX(-Math.PI / 2)
    cap.translate(0, WH + 0.3, 0)
    return { body, cap }
  }, [sx, sz, reach])
  return (
    <group>
      <mesh geometry={geos.body} material={mat(STONE[0])} castShadow receiveShadow />
      <mesh geometry={geos.cap} material={mat(CORDON)} receiveShadow />
    </group>
  )
}

/** Garita colonial: cuerpo octogonal de piedra y cúpula de terracota. */
export function Garita({ x, z, y }: { x: number; z: number; y: number }) {
  const stone = mat(STONE[2])
  return (
    <group position={[x, y, z]} scale={1.35}>
      <mesh geometry={FGEO.octa} material={mat(STONE_DARK)} position={[0, 0.3, 0]} scale={[2.1, 0.6, 2.1]} castShadow />
      <mesh geometry={FGEO.octa} material={stone} position={[0, 1.5, 0]} scale={[1.7, 1.9, 1.7]} castShadow />
      {/* luz ascendente de noche: la garita se recorta contra el cielo */}
      <mesh geometry={FGEO.tube} material={uplightMat('tube', '#ffc27a', 0.85)} position={[0, 1.55, 0]} scale={[1.82, 2.6, 1.82]} />
      <mesh geometry={FGEO.octa} material={mat(CORDON)} position={[0, 2.5, 0]} scale={[2, 0.18, 2]} />
      <mesh geometry={FGEO.dome} material={mat(TERRACOTTA)} position={[0, 2.58, 0]} scale={[1.8, 1.5, 1.8]} castShadow />
      <mesh geometry={GEO.sphere} material={mat(shade(TERRACOTTA, -0.2))} position={[0, 3.45, 0]} scale={0.22} />
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
        <mesh key={a} geometry={GEO.box} material={mat('#4a3a2c')} position={[Math.sin(a) * 0.84, 1.75, Math.cos(a) * 0.84]} rotation={[0, a, 0]} scale={[0.18, 0.45, 0.06]} />
      ))}
    </group>
  )
}

/** Cañón colonial decorativo: cureña de madera, dos ruedas y tubo de hierro. Apunta a su +z. */
function Cannon({ x, z, y, angle }: { x: number; z: number; y: number; angle: number }) {
  const iron = mat(IRON, { rough: 0.5 })
  const wood = mat(PALETTE.woodDark)
  return (
    <group position={[x, y, z]} rotation={[0, angle, 0]} scale={1.6}>
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.55)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={[2.4, 2.4, 1]} />
      <mesh geometry={GEO.box} material={wood} position={[0, 0.3, -0.1]} scale={[0.75, 0.32, 1.25]} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={FGEO.wheel} material={wood} position={[s * 0.48, 0.3, 0.2]} rotation={[0, 0, Math.PI / 2]} scale={[0.62, 0.13, 0.62]} />
      ))}
      <group position={[0, 0.66, 0.1]} rotation={[Math.PI / 2 - 0.12, 0, 0]}>
        <mesh geometry={FGEO.barrel} material={iron} scale={[1, 1.9, 1]} castShadow />
        <mesh geometry={FGEO.octa} material={iron} position={[0, 0.98, 0]} scale={[0.46, 0.14, 0.46]} />
        <mesh geometry={GEO.sphereSmooth} material={iron} position={[0, -1, 0]} scale={0.32} />
      </group>
    </group>
  )
}

/** Farol colonial de pared (vidrio cálido que se enciende de noche). */
export function WallLantern({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh geometry={GEO.box} material={mat(IRON)} position={[0, 0, -0.2]} scale={[0.08, 0.08, 0.45]} />
      <mesh geometry={GEO.box} material={mat(IRON)} position={[0, 0.34, 0]} scale={[0.42, 0.08, 0.42]} />
      <mesh geometry={GEO.box} material={glowMat('#ffd58a', 2.4, { dayGlow: 0.55 })} position={[0, 0.05, 0]} scale={[0.32, 0.48, 0.32]} />
      <mesh geometry={GEO.cone} material={mat(IRON)} position={[0, 0.5, 0]} scale={[0.36, 0.24, 0.36]} />
    </group>
  )
}

/**
 * Entrada monumental (coordenadas locales: la fachada mira a +z; se rota hacia el frente).
 * Arco de medio punto, puertas abiertas, torres con tejado, remate escalonado y letrero.
 */
/**
 * Entrada monumental. Por defecto, la del mall (con su escalinata hacia el muelle y el paso a la
 * plaza); Isla Tecnología la reusa con su propio nombre, ancho y color, sin esos caminos.
 */
export function EntranceGate({
  width = GATE.width,
  title = MALL.name.toUpperCase(),
  tagline = MALL.tagline,
  paths = true,
  roofColor = TERRACOTTA,
}: { width?: number; title?: string; tagline?: string; paths?: boolean; roofColor?: string } = {}) {
  const W = width
  const D = 3
  const TOP = 5.8
  const sign = getGateSign(title, tagline)
  const stone = mat('#dcc497')
  const trim = mat('#f5ead2')
  // el vano del arco: de día es sombra; de noche, el pasaje iluminado hacia la plaza
  const dark = glowMat('#3a2f28', 0.25)
  const passage = glowMat('#ffb86b', 1.1)
  const door = mat('#3f6b4f')
  const roof = mat(roofColor)
  const archW = 2.8
  const archH = 2.4
  return (
    <group>
      {/* cuerpo principal */}
      <mesh geometry={GEO.box} material={stone} position={[0, (BASE_Y + TOP) / 2, 0]} scale={[W, TOP - BASE_Y, D]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, BASE_Y + 0.6, 0]} scale={[W + 0.6, 1.2, D + 0.6]} />
      {/* torres laterales con tejado de terracota */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (W / 2 - 1.2), 0, 0.35]}>
          <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, (BASE_Y + TOP + 0.9) / 2, 0]} scale={[2.6, TOP + 0.9 - BASE_Y, D + 0.7]} castShadow />
          <mesh geometry={GEO.box} material={trim} position={[0, TOP + 0.95, 0]} scale={[2.8, 0.14, D + 0.9]} />
          <mesh geometry={FGEO.prism} material={roof} position={[0, TOP + 1.42, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} scale={[1.65, D + 1.1, 1.2]} castShadow />
        </group>
      ))}
      {/* remate escalonado con emblema */}
      <mesh geometry={GEO.box} material={stone} position={[0, TOP + 0.35, -0.2]} scale={[5.2, 0.7, D - 0.6]} castShadow />
      <mesh geometry={GEO.box} material={stone} position={[0, TOP + 0.95, -0.2]} scale={[3.2, 0.6, D - 0.9]} castShadow />
      <mesh geometry={GEO.halfDisc} material={stone} position={[0, TOP + 1.25, -0.2]} rotation={[Math.PI / 2, 0, 0]} scale={[0.95, D - 0.9, 0.95]} castShadow />
      <mesh geometry={GEO.box} material={trim} position={[0, TOP + 0.02, 0.05]} scale={[W + 0.1, 0.16, D + 0.12]} />
      {/* letrero sobre el arco */}
      <mesh geometry={GEO.plane} material={litLabelMat(sign.texture)} position={[0, archH + 2.1, D / 2 + 0.12]} scale={[2.1 * sign.aspect, 2.1, 1]} />
      {/* arco: marco claro, vano oscuro y puertas abiertas (capas separadas ≥2 cm: sin parpadeo al acercar) */}
      <mesh geometry={GEO.box} material={trim} position={[0, archH / 2 + 0.1, D / 2 + 0.02]} scale={[archW + 0.6, archH, 0.02]} />
      <mesh geometry={GEO.halfDisc} material={trim} position={[0, archH + 0.1, D / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[archW / 2 + 0.3, 0.02, archW / 2 + 0.3]} />
      <mesh geometry={GEO.box} material={dark} position={[0, archH / 2 + 0.1, D / 2 + 0.05]} scale={[archW, archH, 0.02]} />
      <mesh geometry={GEO.halfDisc} material={dark} position={[0, archH + 0.1, D / 2 + 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[archW / 2, 0.02, archW / 2]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={door} position={[s * (archW / 2 + 0.35), 1.35, D / 2 + 0.65]} rotation={[0, s * 1.15, 0]} scale={[1.35, 2.5, 0.12]} castShadow />
      ))}
      {/* de noche: luz del pasaje en el vano y bañadores en torres y pilares */}
      <mesh geometry={GEO.box} material={passage} position={[0, 0.6, D / 2 + 0.08]} scale={[archW - 0.4, 1.1, 0.01]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.plane} material={uplightMat('plane', '#ffc27a', 0.9)} position={[s * (W / 2 - 1.2), (TOP + 0.9) / 2 + 0.2, D / 2 + 0.75]} scale={[3, TOP + 0.6, 1]} />
          <mesh geometry={GEO.plane} material={uplightMat('plane', '#ffd08a', 0.5)} position={[s * (archW / 2 + 0.8), 2.3, D / 2 + 0.16]} scale={[1.8, 4.4, 1]} />
        </group>
      ))}
      {/* faroles */}
      {[-1, 1].map((s) => (
        <WallLantern key={s} x={s * (archW / 2 + 1.25)} y={2.6} z={D / 2 + 0.3} />
      ))}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.8)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, D / 2 + 2.4]} scale={[8, 5, 1]} />
      {/* escalinata y camino hacia el muelle */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={GEO.box} material={mat(STONE[i % 2])} position={[0, 0.1 - i * 0.22, D / 2 + 0.6 + i * 0.7]} scale={[archW + 2.4 + i * 0.6, 0.3, 0.7]} receiveShadow />
      ))}
      {paths && (
        <>
          <mesh geometry={GEO.box} material={mat('#dccaa4')} position={[0, -0.55, D / 2 + 9]} scale={[archW + 1.2, 0.5, 14]} receiveShadow />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={GEO.box} material={mat(STONE_DARK)} position={[s * (archW / 2 + 0.7), -0.2, D / 2 + 9]} scale={[0.3, 0.3, 14]} />
          ))}
          {/* paso interior hacia la plaza */}
          <mesh geometry={GEO.box} material={mat(PALETTE.floorAlt)} position={[0, 0.1, -D / 2 - 11.5]} scale={[archW + 1.4, 0.2, 23]} receiveShadow />
        </>
      )}
    </group>
  )
}

/** Palmeras y rocas del exterior (playas junto a los baluartes), instanciadas. */
/** `sparse` (calidad baja): sin palmeras exteriores. */
function Shore({ sparse }: { sparse: boolean }) {
  const trunksRef = useRef<THREE.InstancedMesh>(null)
  const frondsRef = useRef<THREE.InstancedMesh>(null)
  const rocksRef = useRef<THREE.InstancedMesh>(null)
  const data = useMemo(() => {
    const palms: [number, number, number][] = [
      [-40, 26, 3.6],
      [-30, 37.5, 3.2],
      [40, -26, 3.6],
      [27, -39, 3.0],
      [37, 37, 3.4],
      [43, 30, 3.0],
      [30, 43, 3.2],
      [-38, -20, 3.4],
    ]
    const rocks: [number, number, number][] = [
      [-44, 12, 1.6],
      [8, 49, 1.3],
      [61, -16, 1.5],
      [12, -44, 1.2],
      [-42, -36, 1.8],
      [-36, -43, 1.3],
      [46, 22, 1.1],
      [22, 47, 1.4],
    ]
    return { palms, rocks }
  }, [])
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    data.palms.forEach(([x, z, h], i) => {
      o.position.set(x, h / 2, z)
      o.rotation.set(0.12, i, 0)
      o.scale.set(0.34, h, 0.34)
      o.updateMatrix()
      trunksRef.current?.setMatrixAt(i, o.matrix)
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + i
        o.position.set(x + Math.sin(a) * 0.85 + Math.sin(i) * 0.25, h + 0.1, z + Math.cos(a) * 0.85 + Math.cos(i) * 0.25)
        o.rotation.set(0.38, a, 0)
        o.scale.set(0.55, 0.08, 2)
        o.updateMatrix()
        frondsRef.current?.setMatrixAt(i * 6 + k, o.matrix)
      }
    })
    data.rocks.forEach(([x, z, s], i) => {
      o.position.set(x, -0.6, z)
      o.rotation.set(0, i * 1.3, 0)
      o.scale.set(s * 1.6, s, s * 1.3)
      o.updateMatrix()
      rocksRef.current?.setMatrixAt(i, o.matrix)
    })
    for (const r of [trunksRef, frondsRef, rocksRef]) {
      if (!r.current) continue
      r.current.instanceMatrix.needsUpdate = true
      r.current.computeBoundingSphere()
    }
  }, [data, sparse])
  return (
    <group>
      {/* playitas junto a los baluartes y al muelle */}
      {[
        [-36, 32, 9],
        [36, -32, 9],
        [36, 36, 11],
        [-36, -28, 8],
      ].map(([x, z, r]) => (
        <mesh key={`${x}${z}`} geometry={GEO.cylinderLow} material={mat(PALETTE.sand)} position={[x, -0.42, z]} scale={[r * 2, 0.3, r * 1.6]} rotation={[0, 0.4, 0]} receiveShadow />
      ))}
      {!sparse && <instancedMesh ref={trunksRef} args={[GEO.cylinderLow, mat(PALETTE.trunk), data.palms.length]} castShadow frustumCulled={false} />}
      {!sparse && <instancedMesh ref={frondsRef} args={[GEO.box, mat(PALETTE.leafDark), data.palms.length * 6]} castShadow frustumCulled={false} />}
      <instancedMesh ref={rocksRef} args={[GEO.sphere, mat('#c9b99c'), data.rocks.length]} frustumCulled={false} />
    </group>
  )
}

/**
 * Fortaleza completa. `onEnter`: la puerta es interactiva (lleva a la plaza del piso 1).
 * Se dibuja siempre: es el contexto de todos los pisos.
 */
export function FortressEnvironment({ onEnter, sparse = false }: { onEnter: () => void; sparse?: boolean }) {
  const night = useIsNight()
  const C = S - FORTRESS.gateCut
  const top = WH + 0.3
  return (
    <group>
      <Batch version="fortaleza">
        {/* mar turquesa y suelo interior de arena */}
        <mesh geometry={GEO.cylinder} material={WATER} position={[0, -1.3, 0]} scale={[1000, 1.6, 1000]} receiveShadow />
        <mesh geometry={GEO.box} material={mat(PALETTE.sand)} position={[0, -0.35, 0]} scale={[2 * S - 0.5, 0.7, 2 * S - 0.5]} receiveShadow />
        {/* murallas (las esquinas con baluarte o puerta se resuelven aparte) */}
        <WallRun from={[-S + 3, -S]} to={[S - 3, -S]} outward={[0, -1]} />
        <WallRun from={[-S, -S + 3]} to={[-S, S - 3]} outward={[-1, 0]} />
        <WallRun from={[-S + 3, S]} to={[C, S]} outward={[0, 1]} />
        <WallRun from={[S, -S + 3]} to={[S, C]} outward={[1, 0]} />
        {FORTRESS.bastions.map((b) => (
          <Bastion key={b.corner.join()} corner={b.corner} reach={b.reach} />
        ))}
        {FORTRESS.garitas.map(([x, z]) => (
          <Garita key={`${x}${z}`} x={x} z={z} y={Math.abs(Math.abs(x) - Math.abs(z)) < 1 ? top : WH} />
        ))}
        {FORTRESS.cannons.map(([x, z, a]) => (
          <Cannon key={`${x}${z}`} x={x} z={z} y={Math.abs(Math.abs(x) - Math.abs(z)) < 1 ? top : WH} angle={a} />
        ))}
        <Shore sparse={sparse} />
        {/* iluminación arquitectónica puntual (no toda la muralla): puntas de baluartes y tramos junto a la puerta */}
        {FORTRESS.bastions.map(({ corner: [sx, sz], reach }) => {
          const tip = S + reach * 0.78
          return <Uplight key={`up${sx}${sz}`} x={sx * (tip + 0.25)} z={sz * (tip + 0.25)} facing={Math.atan2(sx, sz)} width={7} height={WH + 0.3 - BASE_Y - 1} strength={0.95} />
        })}
        {[
          [C - 5, S + WT / 2 + 0.05, 0],
          [C - 16, S + WT / 2 + 0.05, 0],
          [S + WT / 2 + 0.05, C - 5, Math.PI / 2],
          [S + WT / 2 + 0.05, C - 16, Math.PI / 2],
        ].map(([x, z, f]) => (
          <Uplight key={`w${x}${z}`} x={x} z={z} facing={f} width={6} height={WH - BASE_Y - 1} strength={0.75} />
        ))}
        {/* faroles coloniales sobre la muralla (se encienden de noche) */}
        {WALL_LANTERNS.map(([x, z]) => (
          <group key={`${x}${z}`}>
            <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[x, WH + 0.35, z]} scale={[0.4, 0.7, 0.4]} />
            <WallLantern x={x} y={WH + 1.05} z={z} />
            <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.7)} rotation={[-Math.PI / 2, 0, 0]} position={[x, WH + 0.06, z]} scale={[4.5, 4.5, 1]} />
          </group>
        ))}
      </Batch>
      {/* puerta: interactiva, fuera del Batch del resto para recibir el toque */}
      <group
        position={[GATE.x, 0, GATE.z]}
        rotation={[0, GATE.facing, 0]}
        scale={1.35}
        onClick={(e) => {
          if (cameraState.handMode || e.delta > 8) return
          e.stopPropagation()
          onEnter()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <Batch version="entrada">
          <EntranceGate />
        </Batch>
      </group>
      {/* Desde lejos el letrero de piedra es pequeño: un cartel legible sobre la puerta. */}
      <ScreenLabel
        label={getGlassPill(MALL.name, { dot: '#f27b68', sub: MALL.tagline, dark: night })}
        position={[GATE.x + 1, 11, GATE.z + 1]}
        pixelHeight={35}
        maxZoomRatio={1.05}
        lit
        priority={LABEL_PRIORITY.floorSign + 10}
        onClick={onEnter}
      />
    </group>
  )
}
