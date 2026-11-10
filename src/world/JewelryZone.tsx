import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, Garita, STONE, STONE_DARK } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, GLASS, mat } from './materials'
import { glowMat } from './night'

// Zona de joyería (propuesta): plataforma de mármol al otro lado de una puerta en la muralla oeste, con alfombra roja,
// cordones, dos vigilantes y cuatro locales pequeños (los reclamables van aparte, ver JEWELRY_SPACES).
const CX = -42.4
const CZ = 0
const W = 19.6
const D = 11
const X0 = CX - W / 2
const WH = 3.8
const Y = 0.12
const GOLD = '#d9a441'
const RED = '#b9242b'
const WALL_X = -32.1

/** Material de una capa del piso: con desplazamiento de profundidad para que no parpadee al acercar la cámara. */
const layer = (color: string, n: number, rough = 0.9) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
  m.polygonOffset = true
  m.polygonOffsetFactor = -n
  m.polygonOffsetUnits = -n * 4
  return m
}
const CARPET = layer('#b9242b', 3, 0.97)
const GOLD_LINE = layer('#d9a441', 4, 0.3)
const BLACK_INLAY = layer('#17171f', 1, 0.25)

function useMarble() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 ? '#fbf9f4' : '#eeeae0'
        g.fillRect(i * 64, j * 64, 64, 64)
        g.strokeStyle = 'rgba(150,150,160,0.28)'
        for (let k = 0; k < 3; k++) {
          g.beginPath()
          g.moveTo(i * 64 + ((k * 23 + i * 7) % 64), j * 64)
          g.bezierCurveTo(i * 64 + 20, j * 64 + 20, i * 64 + 44, j * 64 + 40, i * 64 + ((k * 31 + j * 11) % 64), j * 64 + 64)
          g.stroke()
        }
      }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(W / 4, D / 4)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.28, metalness: 0.08 })
  }, [])
}

function Post({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.cylinder} material={mat(GOLD, { rough: 0.3 })} position={[0, 0.03, 0]} scale={[0.34, 0.06, 0.34]} />
      <mesh geometry={GEO.cylinder} material={mat(GOLD, { rough: 0.3 })} position={[0, 0.45, 0]} scale={[0.09, 0.9, 0.09]} />
      <mesh geometry={GEO.sphereSmooth} material={mat(GOLD, { rough: 0.25 })} position={[0, 0.94, 0]} scale={0.2} />
    </group>
  )
}


const AX = X0 - 0.3 // cara exterior del muro del fondo
const STAIR_ROOM = { len: 8.4, half: 2.0 }
/** Nivel de la terraza (segundo piso nuevo) sobre el piso de la joyería. */
const TOP = 5.0
const SW = WH // los muros de la escalera llegan a la altura de la joyería; más arriba la escalera queda abierta con baranda
const STEPS = 24
/** Donde termina la escalera y entra a la terraza. */
const TX0 = AX - 0.9 - STEPS * 0.3

/** Puerta en la pared del fondo, al final de la alfombra, y el vestíbulo donde arranca la escalera al segundo piso. */
function StairDoor() {
  const warm = glowMat('#fff0c8', 2.2, { dayGlow: 0.5 })
  const strip = glowMat('#ffe2a8', 1.8, { dayGlow: 0.4 })
  const wall = mat('#f1e9d8')
  const stone = mat('#efe3cc')
  const goldM = mat(GOLD, { rough: 0.3 })
  const black = mat('#d6dade', { rough: 0.4 })
  const x1 = AX - STAIR_ROOM.len
  const mid = (AX + x1) / 2
  const tread = 0.3
  const rise = TOP / STEPS
  const run = STEPS * tread
  const sx0 = AX - 0.9
  const slope = Math.atan2(TOP, run)
  const rail = Math.hypot(run, TOP)
  return (
    <>
      {/* marco dorado de la puerta */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} geometry={GEO.box} material={goldM} position={[X0 - 0.1, 1.6, sd * 1.85]} scale={[0.5, 3.2, 0.3]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={goldM} position={[X0 - 0.1, 3.35, 0]} scale={[0.5, 0.35, 4.0]} castShadow />
      <mesh geometry={GEO.box} material={mat('#7a1620')} position={[X0 + 0.16, 3.1, 0]} scale={[0.06, 0.2, 3.4]} />
      <mesh geometry={GEO.box} material={wall} position={[X0 - 0.15, 3.5, 0]} scale={[0.3, 0.6, 3.5]} />
      <mesh geometry={GEO.box} material={goldM} position={[X0 - 0.15, WH + 0.08, 0]} scale={[0.5, 0.18, 3.5]} />
      {/* losa de piedra bajo el vestíbulo (sobre el mar) */}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[mid, (Y - 1.5) / 2, 0]} scale={[STAIR_ROOM.len + 0.6, Y + 1.5, STAIR_ROOM.half * 2 + 0.8]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[mid, -0.9, 0]} scale={[STAIR_ROOM.len + 1.2, 1.2, STAIR_ROOM.half * 2 + 1.4]} />
      <mesh geometry={GEO.box} material={mat('#f1ebdf', { rough: 0.3 })} position={[mid, Y + 0.02, 0]} scale={[STAIR_ROOM.len, 0.06, STAIR_ROOM.half * 2]} receiveShadow />
      <mesh geometry={GEO.box} material={CARPET} position={[X0 - 1.2, Y + 0.115, 0]} scale={[2.6, 0.02, 2.8]} />
      {/* muros del vestíbulo, con cornisa dorada y luz */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh geometry={GEO.box} material={wall} position={[mid, SW / 2, sd * (STAIR_ROOM.half + 0.15)]} scale={[STAIR_ROOM.len, SW, 0.3]} castShadow receiveShadow />
          <mesh geometry={GEO.box} material={goldM} position={[mid, SW + 0.08, sd * (STAIR_ROOM.half + 0.15)]} scale={[STAIR_ROOM.len + 0.2, 0.18, 0.5]} />
          <mesh geometry={GEO.box} material={goldM} position={[mid, 0.3, sd * (STAIR_ROOM.half + 0.15)]} scale={[STAIR_ROOM.len + 0.1, 0.35, 0.42]} />
          <mesh geometry={GEO.box} material={strip} position={[mid, WH - 0.5, sd * STAIR_ROOM.half]} scale={[STAIR_ROOM.len - 0.4, 0.1, 0.05]} />
        </group>
      ))}
      {/* escalera de piedra: sube desde la puerta hasta la terraza, con luz en cada escalón */}
      {Array.from({ length: STEPS }, (_, i) => {
        const h = rise * (i + 1)
        const x = sx0 - (i + 0.5) * tread
        return (
          <group key={i}>
            <mesh geometry={GEO.box} material={stone} position={[x, Y + h / 2, 0]} scale={[tread + 0.01, h, STAIR_ROOM.half * 2 - 0.5]} castShadow receiveShadow />
            <mesh geometry={GEO.box} material={strip} position={[x + tread / 2 + 0.005, Y + h - 0.07, 0]} scale={[0.02, 0.05, STAIR_ROOM.half * 2 - 0.9]} />
          </group>
        )
      })}
      {/* baranda de vidrio y metal negro a cada lado */}
      {[-1, 1].map((sd) => (
        <group key={`r${sd}`}>
          <mesh geometry={GEO.box} material={GLASS} position={[sx0 - run / 2, Y + TOP / 2 + 0.55, sd * (STAIR_ROOM.half - 0.3)]} rotation={[0, 0, -slope]} scale={[rail, 0.9, 0.04]} />
          <mesh geometry={GEO.box} material={black} position={[sx0 - run / 2, Y + TOP / 2 + 1.02, sd * (STAIR_ROOM.half - 0.3)]} rotation={[0, 0, -slope]} scale={[rail, 0.05, 0.06]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={warm} position={[mid, SW - 0.35, 0]} scale={[STAIR_ROOM.len - 0.6, 0.06, 0.3]} />
    </>
  )
}


// Terraza: un gran cuadrado ~2 m más bajo que el piso 2 (se nota el desnivel), con muralla de piedra, muros sólidos en los lados cercanos,
// locales pegados al muro y un patio hundido muy grande en el centro. Termina en el tercer local del piso 2, antes de su garita.
const T = { x0: -79.5, x1: -48, z0: -34, z1: 6.4 }
const COURT = { x0: -72, x1: -55.5, z0: -26.5, z1: -3, drop: 4.2 }
const OPEN = 2.3 // media anchura del hueco por donde pasa la escalera
const WALL_T = 1.0

function Merlons({ x0, z0, x1, z1, y }: { x0: number; z0: number; x1: number; z1: number; y: number }) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const n = Math.max(1, Math.floor(len / 1.6))
  const rot = Math.atan2(x1 - x0, z1 - z0)
  return (
    <group position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} rotation={[0, rot, 0]}>
      {Array.from({ length: n }, (_, k) => (
        <mesh key={k} geometry={GEO.box} material={mat(STONE[1])} position={[0, 0.3, (k - (n - 1) / 2) * (len / n)]} scale={[WALL_T - 0.2, 0.6, 0.9]} castShadow />
      ))}
    </group>
  )
}

function Terrace() {
  const top = Y + TOP
  const floorM = mat('#f1ebdf', { rough: 0.45 })
  const courtM = mat('#efe6d2', { rough: 0.5 })
  const wallM = mat('#a77b52', { rough: 0.7 })
  const baseM = mat('#6f5a3e', { rough: 0.8 })
  const goldM = mat(GOLD, { rough: 0.3 })
  const black = mat('#d6dade', { rough: 0.4 })
  const strip = glowMat('#ffe2a8', 1.8, { dayGlow: 0.35 })
  const warm = glowMat('#fff0c8', 2.2, { dayGlow: 0.5 })
  const cy = top - COURT.drop
  const CX2 = (COURT.x0 + COURT.x1) / 2
  const CZ2 = (COURT.z0 + COURT.z1) / 2
  const stairX = -60
  const gap = 3
  const slabs: [number, number, number, number][] = [
    [T.x0, T.x1, T.z0, COURT.z0],
    [T.x0, COURT.x0, COURT.z0, T.z1],
    [COURT.x0, TX0, COURT.z1, T.z1],
    [TX0, COURT.x1, COURT.z1, -OPEN],
    [TX0, COURT.x1, OPEN, T.z1],
    [COURT.x1, T.x1, COURT.z0, -OPEN],
    [COURT.x1, T.x1, OPEN, T.z1],
  ]
  // muralla de piedra (lados lejanos a la cámara): del mar al adarve, con almenas
  const mural: [number, number, number, number][] = [
    [T.x0, T.x0, T.z0, T.z1],
    [T.x0, T.x1, T.z0, T.z0],
  ]
  // muros sólidos del mar a la terraza en los lados cercanos (donde antes había columnas), con parapeto y almenas
  const solid: [number, number, number, number][] = [[T.x0, T.x1, T.z1, T.z1]]
  // sobre la joyería, el muro de la unión con la zona de comida es de vidrio, con marcos negros y almenas bajas
  const glassE: [number, number, number, number][] = [
    [T.x1, T.x1, -9.75, -OPEN],
    [T.x1, T.x1, OPEN, T.z1],
  ]
  const rails: [number, number, number, number][] = [
    [TX0, T.x1, -OPEN, -OPEN],
    [TX0, T.x1, OPEN, OPEN],
    [T.x1 - 0.15, T.x1 - 0.15, T.z0, -9.75],
  ]
  const walls: [number, number, number, number][] = [
    [COURT.x0, COURT.x0, COURT.z0, COURT.z1],
    [COURT.x1, COURT.x1, COURT.z0, COURT.z1],
    [COURT.x0, COURT.x1, COURT.z0, COURT.z0],
    [COURT.x0, stairX - gap, COURT.z1, COURT.z1],
    [stairX + gap, COURT.x1, COURT.z1, COURT.z1],
  ]
  return (
    <>
      {/* losas del borde, con canto dorado y línea de luz */}
      {slabs.map(([xa, xb, za, zb], i) => (
        <group key={`s${i}`}>
          <mesh geometry={GEO.box} material={floorM} position={[(xa + xb) / 2, top - 0.17, (za + zb) / 2]} scale={[xb - xa, 0.34, zb - za]} castShadow receiveShadow />
          <mesh geometry={GEO.box} material={goldM} position={[(xa + xb) / 2, top - 0.34, (za + zb) / 2]} scale={[xb - xa + 0.08, 0.06, zb - za + 0.08]} />
        </group>
      ))}
      {/* muralla: zócalo en talud, cuerpo, cordón, adarve y almenas */}
      {mural.map(([xa, xb, za, zb], i) => {
        const len = Math.hypot(xb - xa, zb - za) + WALL_T
        const rot = Math.atan2(xb - xa, zb - za)
        const hh = top + 2.7
        return (
          <group key={`m${i}`}>
            <group position={[(xa + xb) / 2, 0, (za + zb) / 2]} rotation={[0, rot, 0]}>
              <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, -0.3, 0]} scale={[WALL_T + 0.6, 1.2, len + 0.6]} />
              <mesh geometry={GEO.box} material={mat(STONE[i % STONE.length])} position={[0, (top + 0.9) / 2, 0]} scale={[WALL_T, hh, len]} castShadow receiveShadow />
              <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, top + 0.4, 0]} scale={[WALL_T + 0.18, 0.18, len]} />
              <mesh geometry={GEO.box} material={mat(STONE[1])} position={[0, top + 1.8, 0]} scale={[WALL_T + 0.1, 0.18, len]} />
            </group>
            <Merlons x0={xa} z0={za} x1={xb} z1={zb} y={top + 1.89} />
          </group>
        )
      })}
      {/* muros sólidos de los lados cercanos: del mar a la terraza, como los del piso 2 */}
      {solid.map(([xa, xb, za, zb], i) => {
        const w = Math.max(0.8, xb - xa)
        const d = Math.max(0.8, zb - za)
        return (
          <group key={`sw${i}`}>
            <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[(xa + xb) / 2, -0.3, (za + zb) / 2]} scale={[w + 0.5, 1.2, d + 0.5]} />
            <mesh geometry={GEO.box} material={wallM} position={[(xa + xb) / 2, (top + 0.9) / 2, (za + zb) / 2]} scale={[w, top + 0.9, d]} castShadow receiveShadow />
            <mesh geometry={GEO.box} material={mat(CORDON)} position={[(xa + xb) / 2, top - 0.2, (za + zb) / 2]} scale={[w + 0.12, 0.14, d + 0.12]} />
            <mesh geometry={GEO.box} material={mat(STONE[0])} position={[(xa + xb) / 2, top + 0.4, (za + zb) / 2]} scale={[w, 0.8, d]} castShadow />
            <mesh geometry={GEO.box} material={mat(CORDON)} position={[(xa + xb) / 2, top + 0.85, (za + zb) / 2]} scale={[w + 0.1, 0.1, d + 0.1]} />
            <Merlons x0={xa} z0={za} x1={xb} z1={zb} y={top + 0.9} />
          </group>
        )
      })}
      {glassE.map(([xa, , za, zb], i) => {
        const d = zb - za
        const n = Math.max(1, Math.round(d / 3.4))
        return (
          <group key={`ge${i}`}>
            <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[xa, -0.3, (za + zb) / 2]} scale={[1.5, 1.2, d + 0.5]} />
            <mesh geometry={GEO.box} material={mat(STONE[0])} position={[xa, (top - 0.4) / 2, (za + zb) / 2]} scale={[1.0, top - 0.4 + 0.6, d]} castShadow receiveShadow />
            <mesh geometry={GEO.box} material={mat(CORDON)} position={[xa, top + 0.25, (za + zb) / 2]} scale={[1.12, 0.18, d + 0.12]} />
            <mesh geometry={GEO.box} material={GLASS} position={[xa, top + 1.55, (za + zb) / 2]} scale={[0.1, 2.6, d]} />
            <mesh geometry={GEO.box} material={black} position={[xa, top + 2.88, (za + zb) / 2]} scale={[0.2, 0.1, d + 0.1]} />
            {Array.from({ length: n + 1 }, (_, k) => (
              <mesh key={k} geometry={GEO.box} material={black} position={[xa, top + 1.55, za + (k * d) / n]} scale={[0.14, 2.6, 0.12]} />
            ))}
          </group>
        )
      })}
      {/* garitas en las esquinas */}
      <Garita x={T.x0 + 0.2} z={T.z0 + 0.2} y={top + 1.8} />
      <Garita x={T.x0 + 0.2} z={T.z1 - 0.2} y={top + 0.9} />
      {/* patio hundido, con muros de piedra oscura */}
      <mesh geometry={GEO.box} material={courtM} position={[CX2, cy - 0.17, CZ2]} scale={[COURT.x1 - COURT.x0, 0.34, COURT.z1 - COURT.z0]} receiveShadow />
      {walls.map(([xa, xb, za, zb], i) => (
        <group key={`w${i}`}>
          <mesh geometry={GEO.box} material={wallM} position={[(xa + xb) / 2, (top + cy) / 2 - 0.17, (za + zb) / 2]} scale={[Math.max(0.3, xb - xa), COURT.drop + 0.34, Math.max(0.3, zb - za)]} castShadow receiveShadow />
          <mesh geometry={GEO.box} material={goldM} position={[(xa + xb) / 2, top + 0.05, (za + zb) / 2]} scale={[Math.max(0.42, xb - xa + 0.1), 0.1, Math.max(0.42, zb - za + 0.1)]} />
        </group>
      ))}
      {/* gran escalinata: del paseo al patio, con descanso a media altura, alfombra roja, barandas con luces y arco dorado */}
      {(() => {
        const stone = mat('#efe3cc')
        const half = COURT.drop / 2
        const sw = gap * 2
        const nUp = 8
        const rn = 0.5
        const steps: { z: number; h: number }[] = []
        for (let i = 0; i < nUp; i++) steps.push({ z: COURT.z1 - 0.15 - (i + 0.5) * rn, h: COURT.drop - (half / nUp) * (i + 1) })
        const zl = COURT.z1 - 0.15 - nUp * rn
        const zl2 = zl - 2.2
        for (let i = 0; i < nUp; i++) steps.push({ z: zl2 - (i + 0.5) * rn, h: half - (half / nUp) * (i + 1) })
        const zEnd = zl2 - nUp * rn
        const lamps = steps.filter((_, i) => i % 3 === 1)
        return (
          <>
            {steps.map((st, i) => (
              <group key={`gs${i}`}>
                <mesh geometry={GEO.box} material={stone} position={[stairX, cy + st.h / 2, st.z]} scale={[sw, st.h, rn + 0.01]} castShadow receiveShadow />
                <mesh geometry={GEO.box} material={strip} position={[stairX, cy + st.h - 0.07, st.z + rn / 2 + 0.005]} scale={[sw - 0.6, 0.05, 0.02]} />
              </group>
            ))}
            {/* descanso */}
            <mesh geometry={GEO.box} material={stone} position={[stairX, cy + half / 2, (zl + zl2) / 2]} scale={[sw, half, zl - zl2]} castShadow receiveShadow />
            <mesh geometry={GEO.box} material={goldM} position={[stairX, cy + half + 0.03, (zl + zl2) / 2]} scale={[sw, 0.03, 0.12]} />
            {/* balaustradas de piedra con globos de luz */}
            {[-1, 1].map((sd) => (
              <group key={`bal${sd}`}>
                {steps.map((st, i) => (
                  <mesh key={i} geometry={GEO.box} material={mat(STONE[0])} position={[stairX + sd * (gap + 0.2), cy + st.h + 0.45, st.z]} scale={[0.4, 0.9, rn + 0.01]} castShadow />
                ))}
                <mesh geometry={GEO.box} material={mat(STONE[0])} position={[stairX + sd * (gap + 0.2), cy + half + 0.45, (zl + zl2) / 2]} scale={[0.4, 0.9, zl - zl2]} castShadow />
                {lamps.map((st, i) => (
                  <group key={`lp${i}`}>
                    <mesh geometry={GEO.box} material={goldM} position={[stairX + sd * (gap + 0.2), cy + st.h + 1.0, st.z]} scale={[0.5, 0.12, 0.5]} />
                    <mesh geometry={GEO.sphereSmooth} material={warm} position={[stairX + sd * (gap + 0.2), cy + st.h + 1.4, st.z]} scale={0.46} />
                  </group>
                ))}
              </group>
            ))}
            {/* arco dorado en lo alto */}
            {[-1, 1].map((sd) => (
              <mesh key={`ar${sd}`} geometry={GEO.box} material={goldM} position={[stairX + sd * (gap + 0.2), top + 1.7, COURT.z1 + 0.35]} scale={[0.5, 3.4, 0.5]} castShadow />
            ))}
            <mesh geometry={GEO.box} material={goldM} position={[stairX, top + 3.55, COURT.z1 + 0.35]} scale={[sw + 1.0, 0.4, 0.55]} castShadow />
            <mesh geometry={GEO.box} material={warm} position={[stairX, top + 3.55, COURT.z1 - 0.0]} scale={[sw - 0.6, 0.1, 0.05]} />
            {/* pie: jardineras con palma a cada lado y medallón */}
            {[-1, 1].map((sd) => (
              <group key={`pf${sd}`} position={[stairX + sd * (gap + 1.6), cy, zEnd - 0.2]}>
                <mesh geometry={GEO.box} material={mat('#8a6a4a')} position={[0, 0.3, 0]} scale={[1.3, 0.6, 1.3]} castShadow />
                <mesh geometry={GEO.cylinder} material={mat('#8a6a4a')} position={[0, 1.8, 0]} scale={[0.26, 2.4, 0.26]} castShadow />
                {[0, 1, 2, 3, 4].map((k) => (
                  <mesh key={k} geometry={GEO.box} material={mat('#3f9e57')} position={[Math.cos((k / 5) * Math.PI * 2) * 0.8, 3.0, Math.sin((k / 5) * Math.PI * 2) * 0.8]} rotation={[0, -(k / 5) * Math.PI * 2, 0.35]} scale={[1.8, 0.08, 0.55]} castShadow />
                ))}
              </group>
            ))}
            <mesh geometry={GEO.cylinder} material={mat('#d9c9a5')} position={[stairX, cy + 0.03, zEnd - 2.2]} scale={[4.8, 0.04, 4.8]} receiveShadow />
            <mesh geometry={GEO.cylinder} material={goldM} position={[stairX, cy + 0.06, zEnd - 2.2]} scale={[3.9, 0.03, 3.9]} />
            <mesh geometry={GEO.cylinder} material={mat('#efe6d2')} position={[stairX, cy + 0.09, zEnd - 2.2]} scale={[3.6, 0.03, 3.6]} />
            <mesh geometry={GEO.cylinder} material={goldM} position={[stairX, cy + 0.12, zEnd - 2.2]} scale={[1.2, 0.03, 1.2]} />
          </>
        )
      })()}
      <mesh geometry={GEO.box} material={baseM} position={[CX2, cy + 0.1, COURT.z1 - 0.2]} scale={[COURT.x1 - COURT.x0, 0.2, 0.4]} />
      {([
        [CX2, COURT.z0 + 0.2, COURT.x1 - COURT.x0 - 0.6, 0.04],
        [COURT.x0 + 0.2, CZ2, 0.04, COURT.z1 - COURT.z0 - 0.6],
        [COURT.x1 - 0.2, CZ2, 0.04, COURT.z1 - COURT.z0 - 0.6],
      ] as [number, number, number, number][]).map(([x, z, w, d], i) => (
        <mesh key={`lw${i}`} geometry={GEO.box} material={strip} position={[x, cy + 0.12, z]} scale={[w, 0.06, d]} />
      ))}
      {/* barandas de vidrio con pasamanos negro: junto a la escalera de la joyería y en la unión con la zona de comida (vidrio alto con marcos) */}
      {rails.map(([xa, xb, za, zb], i) => {
        const w = Math.max(0.05, xb - xa)
        const d = Math.max(0.05, zb - za)
        const tall = i === 2
        const h = tall ? 2.4 : 1
        return (
          <group key={`t${i}`}>
            <mesh geometry={GEO.box} material={GLASS} position={[(xa + xb) / 2, top + h / 2, (za + zb) / 2]} scale={[w, h, d]} />
            <mesh geometry={GEO.box} material={black} position={[(xa + xb) / 2, top + h + 0.02, (za + zb) / 2]} scale={[Math.max(w, 0.09), 0.08, Math.max(d, 0.09)]} />
            {tall && Array.from({ length: Math.floor(d / 3.2) + 1 }, (_, k) => (
              <mesh key={k} geometry={GEO.box} material={black} position={[xa, top + h / 2, za + k * (d / Math.floor(d / 3.2))]} scale={[0.1, h, 0.1]} />
            ))}
          </group>
        )
      })}
      {/* faroles cálidos en el paseo */}
      {[[-79.9, -31], [-79.9, -18], [-79.9, -6], [-79.9, 4.2], [-70, 4.2], [-60, 4.2], [-72, -33], [-60, -33], [-52, -33], [-53.2, -27]].map(([x, z], i) => (
        <group key={`f${i}`}>
          <mesh geometry={GEO.cylinder} material={black} position={[x, top + 1.2, z]} scale={[0.08, 2.4, 0.08]} />
          <mesh geometry={GEO.sphereSmooth} material={warm} position={[x, top + 2.5, z]} scale={0.34} />
        </group>
      ))}
    </>
  )
}

const NAVY = '#1d2b4a'

/** Vigilante que patrulla de la puerta al fondo y regresa, con paso de caminata. */
function Patrol({ z, phase }: { z: number; phase: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const el = g.current
    if (!el) return
    const L = 14.5
    const t = ((clock.elapsedTime * 0.14 + phase) % 2 + 2) % 2
    const u = t < 1 ? t : 2 - t
    el.position.set(-34.6 - u * L, Y + Math.abs(Math.sin(clock.elapsedTime * 3 + phase * 5)) * 0.04, z)
    el.rotation.y = t < 1 ? Math.PI / 2 : -Math.PI / 2
  })
  return (
    <group ref={g} scale={1.2} userData={{ dynamic: true }}>
      <mesh geometry={GEO.capsule} material={mat(NAVY)} position={[0, 0.43, 0]} castShadow />
      <mesh geometry={GEO.box} material={mat(GOLD)} position={[0, 0.5, 0.2]} scale={[0.34, 0.05, 0.02]} />
      <mesh geometry={GEO.sphereSmooth} material={mat('#e0b08a')} position={[0, 0.95, 0]} scale={0.36} castShadow />
      <mesh geometry={GEO.cylinder} material={mat('#10172b')} position={[0, 1.15, 0]} scale={[0.3, 0.1, 0.3]} />
    </group>
  )
}

function Shell({ services }: { services: boolean }) {
  const marble = useMarble()
  const marbleInlay = useMemo(() => {
    const m = marble.clone()
    m.polygonOffset = true
    m.polygonOffsetFactor = -2
    m.polygonOffsetUnits = -8
    return m
  }, [marble])
  const strip = glowMat('#ffe2a8', 1.8, { dayGlow: 0.35 })
  const warm = glowMat('#fff0c8', 2.2, { dayGlow: 0.4 })
  const NZ = CZ - D / 2
  const SZ = CZ + D / 2
  const ropes = [-1, 1].flatMap((side) => Array.from({ length: 8 }, (_, i) => ({ x: -34.4 - i * 1.95, z: side * 1.9, side, i })))
  return (
    <>
      {/* losa de piedra sobre el mar */}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[CX, (Y - 1.5) / 2, CZ]} scale={[W + 1, Y + 1.5, D + 1]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[CX, -0.9, CZ]} scale={[W + 1.6, 1.2, D + 1.6]} />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[CX, Y - 0.04, CZ]} scale={[W + 1.1, 0.12, D + 1.1]} />
      {/* paso completo bajo la puerta: sin hueco de agua entre el mall y la plataforma */}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[-31.2, 0.05, 0]} scale={[4.6, 0.3, 5.4]} receiveShadow />
      <mesh geometry={GEO.box} material={marbleInlay} position={[-31.2, 0.21, 0]} scale={[4.6, 0.04, 5.4]} />
      <mesh geometry={GEO.box} material={CARPET} position={[-31.2, 0.24, 0]} scale={[4.6, 0.03, 2.8]} />
      {/* mármol, borde dorado y alfombra roja hasta el fondo */}
      <mesh geometry={GEO.box} material={marble} position={[CX, Y + 0.02, CZ]} scale={[W, 0.06, D]} receiveShadow />
      {[
        [CX, NZ + 0.3, W, 0.3],
        [CX, SZ - 0.3, W, 0.3],
        [X0 + 0.3, CZ, 0.3, D],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[x, Y + 0.06, z]} scale={[w, 0.03, d]} />
      ))}
      <mesh geometry={GEO.box} material={CARPET} position={[CX + 0.2, Y + 0.115, 0]} scale={[W - 0.6, 0.02, 2.8]} />
      {[-1.45, 1.45].map((z) => (
        <mesh key={z} geometry={GEO.box} material={GOLD_LINE} position={[CX + 0.2, Y + 0.14, z]} scale={[W - 0.6, 0.02, 0.07]} />
      ))}
      {/* paredes: fondo y norte altas con cornisa dorada; el lado de la cámara es una baranda de vidrio */}
      {[
        ...(services ? [[X0 - 0.15, -3.75, 0.3, 3.9, WH], [X0 - 0.15, 3.75, 0.3, 3.9, WH]] : [[X0 - 0.15, CZ, 0.3, D + 0.6, WH]]),
        [CX, NZ - 0.15, W + 0.6, 0.3, WH],
      ].map(([x, z, w, d, h], i) => (
        <group key={i}>
          <mesh geometry={GEO.box} material={mat('#f1e9d8')} position={[x, h / 2, z]} scale={[w, h, d]} castShadow receiveShadow />
          <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[x, h + 0.08, z]} scale={[w + 0.2, 0.18, d + 0.2]} />
          <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[x, 0.3, z]} scale={[w + 0.12, 0.35, d + 0.12]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={mat(STONE[1])} position={[CX, 0.55, SZ + 0.15]} scale={[W + 0.6, 0.9, 0.3]} castShadow />
      <mesh geometry={GEO.box} material={GLASS} position={[CX, 1.55, SZ + 0.15]} scale={[W + 0.6, 1.1, 0.06]} />
      <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[CX, 2.15, SZ + 0.15]} scale={[W + 0.6, 0.1, 0.14]} />
      {/* luz de cornisa y gran rótulo dorado en el fondo */}
      <mesh geometry={GEO.box} material={strip} position={[X0 + 0.04, WH - 0.5, CZ]} scale={[0.05, 0.12, D - 1]} />
      <mesh geometry={GEO.box} material={strip} position={[CX, WH - 0.5, NZ + 0.04]} scale={[W - 1, 0.12, 0.05]} />
      {services ? (
        <>
          <StairDoor />
          <Terrace />
        </>
      ) : (
        <>
          {/* sin la zona de servicios: el fondo es un muro cerrado con su gran rótulo dorado */}
          <mesh geometry={GEO.box} material={mat('#10183a')} position={[X0 + 0.06, 2.2, CZ]} scale={[0.1, 1.5, 6.4]} />
          <mesh geometry={GEO.box} material={warm} position={[X0 + 0.14, 2.2, CZ]} scale={[0.05, 1.1, 5.6]} />
        </>
      )}
      {/* columnas doradas con luz a lo largo del pasillo */}
      {[-39, -44, -49].flatMap((x) => [NZ + 0.9, SZ - 0.9].map((z) => ({ x, z }))).map(({ x, z }) => (
        <group key={`${x}${z}`}>
          <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[x, 1.7, z]} scale={[0.4, 3.4, 0.4]} castShadow />
          <mesh geometry={GEO.sphereSmooth} material={warm} position={[x, 3.5, z]} scale={0.36} />
        </group>
      ))}
      {/* incrustación de mármol negro con filete dorado, y medallón central */}
      <mesh geometry={GEO.box} material={BLACK_INLAY} position={[CX, Y + 0.075, CZ]} scale={[W - 1.2, 0.02, D - 1.2]} />
      <mesh geometry={GEO.box} material={marbleInlay} position={[CX, Y + 0.09, CZ]} scale={[W - 1.5, 0.02, D - 1.5]} />
      {/* vitrinas de cristal con joyas, contra las paredes laterales */}
      {[-37, -41.5, -46, -50].flatMap((x) => [NZ + 0.95, SZ - 0.95].map((z) => ({ x, z }))).map(({ x, z }, i) => (
        <group key={`v${x}${z}`}>
          <mesh geometry={GEO.box} material={mat('#17171f', { rough: 0.25 })} position={[x, 0.5, z]} scale={[1.5, 0.85, 0.9]} castShadow />
          <mesh geometry={GEO.box} material={GLASS} position={[x, 1.15, z]} scale={[1.5, 0.45, 0.9]} />
          <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.25 })} position={[x, 0.96, z]} scale={[1.56, 0.06, 0.96]} />
          <mesh geometry={GEO.octa} material={glowMat(['#bff2ff', '#ffd6f0', '#fff3b0', '#d6ffe6'][i % 4], 2.4, { dayGlow: 0.6 })} position={[x - 0.3, 1.1, z]} scale={0.22} />
          <mesh geometry={GEO.octa} material={glowMat('#ffffff', 2.4, { dayGlow: 0.6 })} position={[x + 0.3, 1.08, z]} scale={0.16} />
        </group>
      ))}
      {/* paneles de espejo en las paredes */}
      {[-39, -44.5, -49.5].map((x) => (
        <mesh key={`m${x}`} geometry={GEO.box} material={mat('#cfe3ea', { rough: 0.05 })} position={[x, 2.1, NZ + 0.04]} scale={[3.2, 1.6, 0.06]} />
      ))}
      {/* puerta en la muralla: arco dorado */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[WALL_X + 0.6, 2.2, s * 2.9]} scale={[1.2, 4.6, 0.7]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[WALL_X + 0.6, 4.7, 0]} scale={[1.3, 0.55, 6.5]} castShadow />
      <mesh geometry={GEO.box} material={mat('#7a1620')} position={[WALL_X - 0.05, 4.7, 0]} scale={[0.06, 0.32, 5.6]} />
      {/* cordones rojos y postes dorados a lo largo de la alfombra */}
      {ropes.map((r) => (
        <group key={`${r.side}${r.i}`}>
          <Post x={r.x} z={r.z} />
          {r.i < 7 && <mesh geometry={GEO.box} material={mat(RED)} position={[r.x - 0.975, Y + 0.72, r.z]} scale={[1.95, 0.07, 0.07]} />}
        </group>
      ))}
    </>
  )
}

/** Distancia (a lo largo del recorrido) del visitante más cercano a la puerta: la lee la puerta automática. */
const door = { near: 99 }
/** Vidrio tintado de las puertas automáticas: se lee bien también de día. */
const DOOR_GLASS = new THREE.MeshPhysicalMaterial({ color: '#1f4658', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false })
const DOOR_X = -31.2

const COATS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f', '#6b5b95']

/**
 * Recorrido de los visitantes: bajan por el pasillo de Lifestyle, rodean por el lado el local del fondo (que ocupa
 * el final del pasillo), pasan por la estrecha franja junto a la muralla, cruzan la puerta y siguen por la alfombra.
 */
const BASE_ROUTE: [number, number, number][] = [
  [-16, 0.5, 0.2],
  [-19.5, 2, 0.2],
  [-20.5, 6.6, 0.2],
  [-29.4, 6.6, 0.2],
  [-29.4, 0, 0.2],
  [-34, 0, 0.2],
  [-50, 0, 0.2],
]
/** Con la zona de servicios: cruzan la puerta del fondo, suben por la escalera y recorren el paseo de la terraza (por el pasillo libre que rodea el patio). */
const TERRACE_ROUTE: [number, number, number][] = [
  ...BASE_ROUTE,
  [TX0 + 10.2, 0, 0.2],
  [TX0, 0, Y + TOP + 0.08],
  [-67, -0.4, Y + TOP + 0.08],
  [-73.2, -0.4, Y + TOP + 0.08],
  [-73.2, -27.8, Y + TOP + 0.08],
  [-54.3, -27.8, Y + TOP + 0.08],
  [-54.3, -4.5, Y + TOP + 0.08],
]
const makeRoute = (pts: [number, number, number][]) => {
  const seg = pts.slice(1).map((q, i) => {
    const p = pts[i]
    const dx = q[0] - p[0]
    const dz = q[1] - p[1]
    return { p, dx, dz, dy: q[2] - p[2], len: Math.hypot(dx, dz) }
  })
  return { seg, len: seg.reduce((a, s) => a + s.len, 0) }
}
const ROUTE_BASE = makeRoute(BASE_ROUTE)
const ROUTE_TERRACE = makeRoute(TERRACE_ROUTE)
const WALK_SPEED = 1.1

/** Visitantes que recorren esa ruta de ida y vuelta, a paso de caminata normal; con la zona de servicios suben a la terraza. */
function Walkers({ services }: { services: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const route = services ? ROUTE_TERRACE : ROUTE_BASE
  const n = services ? 9 : 6
  const people = useMemo(() => Array.from({ length: n }, (_, i) => ({ phase: i / n, lane: (i % 3 - 1) * 0.55 })), [n])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    let nearest = 99
    people.forEach((p, i) => {
      const el = refs.current[i]
      if (!el) return
      const u = (((t * WALK_SPEED) / (2 * route.len) + p.phase) % 1 + 1) % 1
      const going = u < 0.5
      let d = (going ? u * 2 : (1 - u) * 2) * route.len
      let seg = route.seg[route.seg.length - 1]
      for (const sg of route.seg) {
        if (d <= sg.len) {
          seg = sg
          break
        }
        d -= sg.len
      }
      const f = Math.min(1, d / seg.len)
      let x = seg.p[0] + seg.dx * f
      let z = seg.p[1] + seg.dz * f
      const y = seg.p[2] + seg.dy * f
      if (x < -33.5) {
        // carril: desplazado hacia un lado del recorrido
        x += (-seg.dz / seg.len) * p.lane
        z += (seg.dx / seg.len) * p.lane
      }
      if (y < 1 && Math.abs(z) < 3.2) nearest = Math.min(nearest, Math.abs(x - DOOR_X))
      el.position.set(x, y + Math.abs(Math.sin(t * 4 + i * 2)) * 0.03, z)
      const sign = going ? 1 : -1
      el.rotation.y = Math.atan2(seg.dx * sign, seg.dz * sign)
    })
    door.near = nearest
  })
  return (
    <>
      {people.map((_, i) => (
        <group key={`${services}${i}`} ref={(g) => (refs.current[i] = g)} scale={1} userData={{ dynamic: true }}>
          <mesh geometry={GEO.capsule} material={mat(COATS[i % COATS.length])} position={[0, 0.43, 0]} castShadow />
          <mesh geometry={GEO.sphereSmooth} material={mat(i % 2 ? '#c58c64' : '#8d5a3b')} position={[0, 0.95, 0]} scale={0.36} castShadow />
        </group>
      ))}
    </>
  )
}

/** Puertas automáticas de vidrio: se abren hacia los lados cuando alguien se acerca y se cierran cuando se aleja. */
function AutoDoors() {
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const light = useRef<THREE.Mesh>(null)
  const open = useRef(0)
  useFrame((_, dt) => {
    const target = door.near < 3.6 ? 1 : 0
    open.current += (target - open.current) * Math.min(1, dt * (target ? 4 : 2.2))
    const o = open.current
    if (left.current) left.current.position.z = -1.35 - o * 1.2
    if (right.current) right.current.position.z = 1.35 + o * 1.2
    if (light.current) (light.current.material as THREE.MeshStandardMaterial).emissiveIntensity = o > 0.2 ? 1.6 : 0.3
  })
  const leaf = (ref: React.RefObject<THREE.Group | null>, z0: number) => (
    <group ref={ref} position={[DOOR_X, 0, z0]} userData={{ dynamic: true }}>
      <mesh geometry={GEO.box} material={DOOR_GLASS} position={[0, 1.75, 0]} scale={[0.08, 3.5, 2.6]} />
      <mesh geometry={GEO.box} material={mat('#c9ced4', { rough: 0.2 })} position={[0, 1.75, 1.3]} scale={[0.14, 3.5, 0.1]} />
      <mesh geometry={GEO.box} material={mat('#c9ced4', { rough: 0.2 })} position={[0, 1.75, -1.3]} scale={[0.14, 3.5, 0.1]} />
      <mesh geometry={GEO.box} material={mat('#c9ced4', { rough: 0.2 })} position={[0, 3.45, 0]} scale={[0.14, 0.1, 2.6]} />
      <mesh geometry={GEO.box} material={mat('#c9ced4', { rough: 0.2 })} position={[0, 0.25, 0]} scale={[0.14, 0.1, 2.6]} />
    </group>
  )
  return (
    <group>
      {leaf(left, -1.35)}
      {leaf(right, 1.35)}
      {/* carril y sensor sobre las puertas */}
      <mesh geometry={GEO.box} material={mat('#2a3038')} position={[DOOR_X, 3.7, 0]} scale={[0.3, 0.3, 6.2]} />
      <mesh ref={light} geometry={GEO.sphereSmooth} material={new THREE.MeshStandardMaterial({ color: '#7dffb2', emissive: '#7dffb2', emissiveIntensity: 0.3 })} position={[DOOR_X - 0.2, 3.7, 0]} scale={0.14} />
    </group>
  )
}

/** Cámara de seguridad que barre el salón de lado a lado, con su luz roja intermitente. */
function SecurityCam({ x, z, base, phase }: { x: number; z: number; base: number; phase: number }) {
  const head = useRef<THREE.Group>(null)
  const led = useRef<THREE.Mesh>(null)
  const ledMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: '#ff3b30', emissiveIntensity: 1 }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (head.current) head.current.rotation.y = base + Math.sin(t * 0.55 + phase) * 0.85
    ledMat.emissiveIntensity = Math.sin(t * 4 + phase) > 0.3 ? 2.2 : 0.15
  })
  return (
    <group position={[x, 3.15, z]} userData={{ dynamic: true }}>
      <mesh geometry={GEO.box} material={mat('#2a3038')} position={[0, 0.2, 0]} scale={[0.3, 0.1, 0.3]} />
      <group ref={head} rotation={[0, base, 0]}>
        <mesh geometry={GEO.box} material={mat('#f2f3f5', { rough: 0.3 })} position={[0, 0, 0.3]} scale={[0.34, 0.3, 0.7]} castShadow />
        <mesh geometry={GEO.cylinder} material={mat('#10131a')} position={[0, 0, 0.68]} rotation={[Math.PI / 2, 0, 0]} scale={[0.22, 0.06, 0.22]} />
        <mesh ref={led} geometry={GEO.sphereSmooth} material={ledMat} position={[0.12, 0.17, 0.5]} scale={0.07} />
      </group>
    </group>
  )
}

export function JewelryZone({ services = true }: { services?: boolean }) {
  const night = useIsNight()
  const title = useMemo(() => getGlassPill('Joyería', { dot: GOLD, sub: 'Zona exclusiva', dark: night }), [night])
  return (
    <group>
      <Batch version={`joyeria-escalera-18-${services}`}>
        <Shell services={services} />
      </Batch>
      {/* dos vigilantes que patrullan la alfombra */}
      <Patrol z={-2.3} phase={0} />
      <Patrol z={2.3} phase={1} />
      <Walkers services={services} />
      <AutoDoors />
      <SecurityCam x={-38.5} z={-5.2} base={0} phase={0} />
      <SecurityCam x={-46.5} z={-5.2} base={0} phase={2} />
      <SecurityCam x={-51.8} z={services ? -3.4 : 0} base={Math.PI / 2} phase={4} />
      <ScreenLabel label={title} position={[CX, 6.2, 0]} pixelHeight={30} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
      {services && (
        <>
        <pointLight position={[-56, 3.2, 0]} color="#ffd98c" intensity={night ? 18 : 4} distance={9} decay={2} />
        <pointLight position={[-70, 9, 0]} color="#ffe2a8" intensity={night ? 18 : 3} distance={15} decay={2} />
        <pointLight position={[-61, 4.5, -14]} color="#ffe2a8" intensity={night ? 28 : 3} distance={22} decay={2} />
        <pointLight position={[-64, 8.5, -27]} color="#ffe2a8" intensity={night ? 16 : 2} distance={16} decay={2} />
        <pointLight position={[-62, 8, -2]} color="#ffe2a8" intensity={night ? 16 : 2} distance={14} decay={2} />
        </>
      )}
      {[-37, -44, -50].map((x) => (
        <pointLight key={x} position={[x, 3.4, 0]} color="#ffd98c" intensity={night ? 26 : 7} distance={14} decay={2} />
      ))}
    </group>
  )
}
