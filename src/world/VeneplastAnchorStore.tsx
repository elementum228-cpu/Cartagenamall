import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Batch } from './Batch'
import { GEO, GLASS, mat } from './materials'
import { glowMat, lightPoolMat, nightVolumeMat } from './night'
import { Person } from './Person'

// Veneplast: local ANCLA de dos pisos para Mallplay (papelería, tecnología, juguetería y celebraciones).
//
// Es un componente aislado y reutilizable: NO está puesto en ninguna coordenada del mapa. El padre decide `position`, `rotation` y
// `scale`. Usa solo lo que ya existe en el mundo (geometrías y materiales compartidos de `materiales.ts`, `glowMat` para lo que se
// enciende de noche, `<Batch>` para fundir lo estático en pocas mallas) y no agrega luces dinámicas, modelos ni texturas grandes.
//
// Convención de ejes (igual que los locales y vitrinas del mall): el origen es el centro de la huella, sobre el piso (y = 0); la
// fachada principal mira a +z. Girando el componente se elige hacia dónde mira.

export const VENEPLAST_STORE_ID = 'veneplast'

/** Paleta de la marca. */
export const VENEPLAST = {
  navy: '#091C4A',
  navy2: '#17346F',
  roof: '#0a2254',
  gold: '#FFC62B',
  white: '#F7F3EA',
} as const

export interface VeneplastAnchorStoreProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  /** Ancho de la huella (eje x del local). */
  width?: number
  /** Fondo de la huella (eje z del local). */
  depth?: number
  /** Dibuja lo que se ve por las vitrinas (estantes, computador, impresora, globos…). */
  showInterior?: boolean
  /** Gente entrando y saliendo por la puerta (se apaga con «reducir movimiento»). */
  animateVisitors?: boolean
  /** Si es verdadero, el edificio recibe toques (y el cursor cambia a mano). */
  interactive?: boolean
  /** Se llama al tocar el edificio. La experiencia interna (catálogo) se conecta después. */
  onOpen?: () => void
}

/** Alto de cada piso. */
const FLOOR_H = 3.3
/** Altura de la planta alta: más baja que la de abajo para que el ancla no domine el pasillo (≈1,8 pisos en total). */
const UP_H = 2.7

/**
 * Huella y medidas del edificio, para colocarlo y detectar choques sin renderizarlo.
 * `bounds` está en el espacio local del componente (antes de aplicar posición, rotación y escala).
 */
export function veneplastFootprint(width = 12, depth = 8) {
  const height = FLOOR_H + UP_H + 0.9
  return {
    storeId: VENEPLAST_STORE_ID,
    width,
    depth,
    height,
    bounds: { min: [-width / 2, 0, -depth / 2] as [number, number, number], max: [width / 2, height, depth / 2] as [number, number, number] },
    /** Puerta principal (en el espacio local): de ahí salen los visitantes. */
    entrance: [0, 0, depth / 2 + 0.6] as [number, number, number],
  }
}

// ── texturas de los letreros (dos lienzos pequeños, creados una sola vez) ──────────────────────────────────────────────────────────

interface Tex {
  texture: THREE.CanvasTexture
  aspect: number
}
let signTex: Tex | null = null
let emblemTex: Tex | null = null

function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Tex {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(c.getContext('2d')!)
  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: w / h }
}

/** «VENEPLAST» en blanco, sans serif moderna, con un borde inferior más oscuro que le da volumen. */
function sign(): Tex {
  if (!signTex)
    signTex = canvasTexture(1400, 250, (g) => {
      g.font = '900 188px "Plus Jakarta Sans", Manrope, system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      ;(g as unknown as { letterSpacing: string }).letterSpacing = '10px'
      g.fillStyle = '#9fb0d6' // cara lateral de las letras (grosor)
      for (let i = 12; i >= 1; i--) g.fillText('VENEPLAST', 700 + i * 0.55, 128 + i * 0.9)
      g.fillStyle = VENEPLAST.white
      g.fillText('VENEPLAST', 700, 124)
    })
  return signTex
}

/** Emblema: «VP» en cursiva pesada, azul marino sobre el disco amarillo. */
function emblem(): Tex {
  if (!emblemTex)
    emblemTex = canvasTexture(256, 256, (g) => {
      g.font = 'italic 900 150px "Plus Jakarta Sans", Manrope, system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      ;(g as unknown as { letterSpacing: string }).letterSpacing = '-6px'
      g.fillStyle = VENEPLAST.navy
      g.fillText('VP', 128, 138)
    })
  return emblemTex
}

// ── materiales que se encienden de noche (los mismos de los demás locales) ─────────────────────────────────────────────────────────

const WARM_PANE = () => glowMat('#ffd08a', 1.4, { opacity: 0.42 })
const COOL_PANE = () => glowMat('#cfe3ff', 1.2, { opacity: 0.4 })
const WARM_LIGHT = () => glowMat('#fff0c8', 2.2, { dayGlow: 0.35 })
const GOLD_GLOW = () => glowMat(VENEPLAST.gold, 0.7, { dayGlow: 0.15 })
const SCREEN = () => glowMat('#8fd3ff', 1.4, { dayGlow: 0.55 })
const POOL = () => lightPoolMat('#ffc97a', 0.7)
const INTERIOR = () => nightVolumeMat('#ffcf8f', 0.15)

// colores de los productos de la papelería (sobrios: no compiten con la fachada)
const NOTEBOOKS = ['#e8573f', '#2f86d6', '#f3b234', '#3aa57a', '#9b6ad8', '#f5efe0']
const GIFTS = ['#e8573f', '#2f86d6', '#f3b234', '#3aa57a']

export function VeneplastAnchorStore({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  width = 12,
  depth = 8,
  showInterior = true,
  interactive = true,
  animateVisitors = true,
  onOpen,
}: VeneplastAnchorStoreProps) {
  const w = width
  const d = depth
  const H = FLOOR_H + UP_H
  const front = d / 2
  // lo estático se funde en pocas mallas; solo cambia si cambian las medidas
  const version = `veneplast-${w}x${d}-${showInterior ? 'i' : 'x'}`
  const foot = useMemo(() => veneplastFootprint(w, d), [w, d])
  const S = sign()
  const E = emblem()

  const navy = mat(VENEPLAST.navy)
  const navy2 = mat(VENEPLAST.navy2)
  const roof = mat('#2c4a8c')
  const gold = mat(VENEPLAST.gold, { emissive: 0.28 })
  const white = mat(VENEPLAST.white)
  const dark = mat('#101a33')

  // reparto de la fachada
  const doorW = 2.7
  const bay = (w - doorW) / 2 // ancho de cada vitrina de planta baja
  const winH = FLOOR_H - 0.55
  const T = 0.3
  const sillH = 0.4
  const winTop = sillH + winH
  const doorH = 2.45
  const upSill = FLOOR_H + 0.1 + 0.3
  const upTop = upSill + 1.85
  const signW = Math.min(w * 0.56, 7.4)
  const signH = signW / S.aspect

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{ storeId: VENEPLAST_STORE_ID, footprint: foot }}
      onClick={
        interactive && onOpen
          ? (e) => {
              if (e.delta > 8) return
              e.stopPropagation()
              onOpen()
            }
          : undefined
      }
      onPointerOver={
        interactive
          ? (e) => {
              e.stopPropagation()
              document.body.style.cursor = 'pointer'
            }
          : undefined
      }
      onPointerOut={interactive ? () => (document.body.style.cursor = '') : undefined}
    >
      {/* zona tocable limpia: un prisma invisible del tamaño de la huella */}
      {interactive && (
        <mesh position={[0, foot.height / 2, 0]} visible={false}>
          <boxGeometry args={[w + 0.4, foot.height, d + 0.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      <Batch version={version}>
        <group>
          {/* ── cascarón: muros delgados con aberturas (como los demás locales), así las vitrinas dejan ver el interior ── */}
          {/* muro del fondo, costados, losa de entrepiso y del techo */}
          <Box x0={-w / 2} x1={w / 2} y0={0} y1={H} z0={-d / 2} z1={-d / 2 + T} m={navy} />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <SideWall sx={sx} x0={w / 2 - 0.12} x1={w / 2} zA={-d / 2} zB={front - T} H={H} d={d} m={navy} />
              <SideWall sx={sx} x0={w / 2 - T} x1={w / 2 - 0.12} zA={-d / 2 + T} zB={front - T} H={H} d={d} m={mat('#efe6d2')} />
            </group>
          ))}
          <Box x0={-w / 2} x1={w / 2} y0={FLOOR_H - 0.1} y1={FLOOR_H + 0.1} z0={-d / 2} z1={front} m={white} />
          <Box x0={-w / 2 - 0.15} x1={w / 2 + 0.15} y0={H} y1={H + 0.2} z0={-d / 2 - 0.15} z1={front + 0.15} m={roof} />
          {/* paredes interiores claras: el fondo se lee cálido por las vitrinas */}
          <Box x0={-w / 2 + T} x1={w / 2 - T} y0={0.1} y1={FLOOR_H - 0.1} z0={-d / 2 + T} z1={-d / 2 + T + 0.04} m={mat('#efe6d2')} />
          <Box x0={-w / 2 + T} x1={w / 2 - T} y0={FLOOR_H + 0.1} y1={H} z0={-d / 2 + T} z1={-d / 2 + T + 0.04} m={mat('#efe6d2')} />
          <Box x0={-w / 2 + T} x1={w / 2 - T} y0={0} y1={0.1} z0={-d / 2 + T} z1={front - T} m={mat('#e9dcc2')} />

          {/* muro frontal, planta baja: zócalo, pilares, dintel de la puerta y viga corrida sobre las vitrinas */}
          {[
            [-w / 2, -doorW / 2],
            [doorW / 2, w / 2],
          ].map(([x0, x1]) => (
            <Box key={x0} x0={x0} x1={x1} y0={0} y1={sillH} z0={front - T} z1={front} m={navy} />
          ))}
          {[
            [-w / 2, -w / 2 + 0.4],
            [-doorW / 2 - 0.4, -doorW / 2],
            [doorW / 2, doorW / 2 + 0.4],
            [w / 2 - 0.4, w / 2],
          ].map(([x0, x1]) => (
            <Box key={x0} x0={x0} x1={x1} y0={0} y1={FLOOR_H} z0={front - T} z1={front} m={navy} />
          ))}
          <Box x0={-w / 2} x1={w / 2} y0={winTop} y1={FLOOR_H} z0={front - T} z1={front} m={navy} />
          <Box x0={-doorW / 2} x1={doorW / 2} y0={doorH} y1={winTop} z0={front - T} z1={front} m={navy} />
          {/* muro frontal, planta alta: antepecho, viga, pilares y el paño del letrero */}
          <Box x0={-w / 2} x1={w / 2} y0={FLOOR_H + 0.1} y1={upSill} z0={front - T} z1={front} m={navy} />
          <Box x0={-w / 2} x1={w / 2} y0={upTop} y1={H} z0={front - T} z1={front} m={navy} />
          {[
            [-w / 2, -w / 2 + 0.4],
            [w / 2 - 0.4, w / 2],
            [-signW / 2 - 0.25, signW / 2 + 0.25],
          ].map(([x0, x1]) => (
            <Box key={x0} x0={x0} x1={x1} y0={upSill} y1={upTop} z0={front - T} z1={front} m={navy} />
          ))}
          {/* cornisa entre pisos y zócalo */}
          <mesh geometry={GEO.box} material={white} position={[0, FLOOR_H, front + 0.03]} scale={[w + 0.12, 0.12, 0.14]} />
          <mesh geometry={GEO.box} material={navy2} position={[0, 0.16, front + 0.04]} scale={[w + 0.1, 0.32, 0.12]} />

          {/* azotea limpia: solo un antepecho bajo */}
          <mesh geometry={GEO.box} material={navy2} position={[0, H + 0.34, front + 0.1]} scale={[w + 0.3, 0.28, 0.18]} />
          <mesh geometry={GEO.box} material={navy2} position={[0, H + 0.34, -front - 0.1]} scale={[w + 0.3, 0.28, 0.18]} />
          <mesh geometry={GEO.box} material={navy2} position={[-w / 2 - 0.1, H + 0.34, 0]} scale={[0.18, 0.28, d + 0.3]} />
          <mesh geometry={GEO.box} material={navy2} position={[w / 2 + 0.1, H + 0.34, 0]} scale={[0.18, 0.28, d + 0.3]} />

          {/* ── vitrinas de planta baja a ambos lados de la entrada: marcos, vidrio y luz cálida detrás ── */}
          {[-1, 1].map((s) => {
            const x = s * (doorW / 2 + bay / 2)
            const gw = bay - 0.8
            const gy = sillH + winH / 2
            return (
              <group key={s}>
                <mesh geometry={GEO.box} material={GLASS} position={[x, gy, front - 0.06]} scale={[gw, winH, 0.04]} />
                <mesh geometry={GEO.box} material={WARM_PANE()} position={[x, gy, front - 0.14]} scale={[gw - 0.04, winH - 0.04, 0.02]} />
                {[-0.5, 0.5].map((q) => (
                  <mesh key={q} geometry={GEO.box} material={navy2} position={[x + q * gw, gy, front - 0.04]} scale={[0.08, winH, 0.1]} />
                ))}
                <mesh geometry={GEO.box} material={navy2} position={[x, gy, front - 0.04]} scale={[0.05, winH, 0.07]} />
                <mesh geometry={GEO.box} material={navy2} position={[x, sillH + 0.05, front - 0.04]} scale={[gw + 0.1, 0.1, 0.1]} />
              </group>
            )
          })}
          {/* planta alta: cinta de ventanas a los lados del letrero */}
          {[-1, 1].map((s) => {
            const x0 = -w / 2 + 0.4
            const x1 = -signW / 2 - 0.25
            const gx = (s * (Math.abs(x0) + Math.abs(x1))) / 2
            const gw = Math.abs(x0 - x1)
            const gy = (upSill + upTop) / 2
            return (
              <group key={s}>
                <mesh geometry={GEO.box} material={GLASS} position={[gx, gy, front - 0.06]} scale={[gw, upTop - upSill, 0.04]} />
                <mesh geometry={GEO.box} material={s < 0 ? WARM_PANE() : COOL_PANE()} position={[gx, gy, front - 0.14]} scale={[gw - 0.04, upTop - upSill - 0.04, 0.02]} />
                <mesh geometry={GEO.box} material={navy2} position={[gx, gy, front - 0.04]} scale={[0.05, upTop - upSill, 0.07]} />
                <mesh geometry={GEO.box} material={navy2} position={[gx, upSill + 0.04, front - 0.04]} scale={[gw + 0.1, 0.08, 0.1]} />
              </group>
            )
          })}
          {/* franja amarilla fina: acento, no protagonista */}
          <mesh geometry={GEO.box} material={GOLD_GLOW()} position={[0, FLOOR_H + 0.16, front + 0.1]} scale={[w - 0.5, 0.06, 0.06]} />

          {/* aletas amarillas verticales en la esquina (reconocibles de lejos) */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={GEO.box} material={gold} position={[-w / 2 + 0.55 + i * 0.3, FLOOR_H + 0.3 + 0.8, front + 0.16]} scale={[0.14, 1.6, 0.12]} castShadow />
          ))}

          {/* ── entrada: puertas dobles de vidrio, toldo amarillo y luces cálidas ── */}
          {/* puertas dobles abiertas de par en par: cada hoja gira sobre su jamba hacia afuera y el vano queda libre */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (doorW / 2 - 0.05), 0, front - 0.12]} rotation={[0, s * 1.25, 0]}>
              <group position={[-s * (doorW / 4 - 0.04), 0, 0]}>
                <mesh geometry={GEO.box} material={GLASS} position={[0, 1.15, 0]} scale={[doorW / 2 - 0.14, 2.2, 0.05]} />
                <mesh geometry={GEO.box} material={navy2} position={[0, 2.27, 0]} scale={[doorW / 2 - 0.1, 0.07, 0.08]} />
                <mesh geometry={GEO.box} material={navy2} position={[0, 0.06, 0]} scale={[doorW / 2 - 0.1, 0.07, 0.08]} />
                <mesh geometry={GEO.box} material={navy2} position={[-s * (doorW / 4 - 0.1), 1.15, 0]} scale={[0.07, 2.2, 0.08]} />
                <mesh geometry={GEO.box} material={white} position={[-s * 0.45, 1.1, 0.06]} scale={[0.04, 0.55, 0.04]} />
              </group>
            </group>
          ))}
          {/* vano: umbral y un poco de luz cálida del interior sobre el piso de la entrada */}
          <mesh geometry={GEO.box} material={mat('#c9a21c')} position={[0, 0.05, front - 0.1]} scale={[doorW - 0.1, 0.1, 0.4]} />
          <group position={[0, FLOOR_H - 0.7, front + 0.55]} rotation={[0.16, 0, 0]}>
            <mesh geometry={GEO.rounded} material={gold} scale={[doorW + 1.5, 0.12, 1.5]} castShadow />
            <mesh geometry={GEO.box} material={mat('#e0a912')} position={[0, -0.09, 0.7]} scale={[doorW + 1.5, 0.1, 0.12]} />
          </group>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (doorW / 2 + 0.55), 0, front + 0.18]}>
              <mesh geometry={GEO.box} material={dark} position={[0, 1.65, 0]} scale={[0.12, 0.34, 0.1]} />
              <mesh geometry={GEO.sphere} material={WARM_LIGHT()} position={[0, 1.5, 0.08]} scale={0.18} />
            </group>
          ))}
          <mesh geometry={GEO.box} material={mat('#c9a21c')} position={[0, 0.07, front + 0.55]} scale={[doorW * 0.9, 0.04, 0.8]} />

          {/* macetas integradas a la fachada */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (doorW / 2 + 1.35), 0, front + 0.5]}>
              <mesh geometry={GEO.rounded} material={white} position={[0, 0.28, 0]} scale={[0.7, 0.56, 0.5]} castShadow />
              <mesh geometry={GEO.sphere} material={mat('#5f9a6e')} position={[0, 0.85, 0]} scale={[0.7, 0.8, 0.6]} castShadow />
            </group>
          ))}

          {/* costados: ventanas reales (con el interior detrás), iluminadas igual que las de la fachada */}
          {[-1, 1].map((sx) =>
            SIDE_WINDOWS.map(([y0, y1]) =>
              [-1, 1].map((q) => {
                const zc = q * (d / 4)
                const hh = y1 - y0
                return (
                  <group key={`${sx}${y0}${q}`} position={[sx * (w / 2 - 0.06), (y0 + y1) / 2, zc]}>
                    <mesh geometry={GEO.box} material={GLASS} scale={[0.04, hh, SIDE_WIN_W]} />
                    <mesh geometry={GEO.box} material={WARM_PANE()} position={[-sx * 0.08, 0, 0]} scale={[0.02, hh - 0.04, SIDE_WIN_W - 0.04]} />
                    <mesh geometry={GEO.box} material={navy2} position={[sx * 0.04, 0, 0]} scale={[0.08, 0.1, SIDE_WIN_W + 0.16]} />
                    <mesh geometry={GEO.box} material={navy2} position={[sx * 0.04, -hh / 2, 0]} scale={[0.14, 0.1, SIDE_WIN_W + 0.2]} />
                    <mesh geometry={GEO.box} material={navy2} position={[sx * 0.04, hh / 2, 0]} scale={[0.08, 0.1, SIDE_WIN_W + 0.16]} />
                    <mesh geometry={GEO.box} material={navy2} position={[sx * 0.04, 0, 0]} scale={[0.06, hh, 0.06]} />
                  </group>
                )
              }),
            ),
          )}

          {/* cinta clara que rodea el edificio entre pisos: los costados dejan de verse como muro liso */}
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={GEO.box} material={white} position={[s * (w / 2 + 0.02), FLOOR_H, 0]} scale={[0.12, 0.12, d + 0.12]} />
          ))}
          {/* luz interior: volumen tenue que aclara el interior de noche (no es una luz dinámica) */}
          <mesh geometry={GEO.box} material={INTERIOR()} position={[0, H / 2, 0]} scale={[w - 0.7, H - 0.5, d - 0.7]} />
          {/* piso interior por donde se asoman las vitrinas */}
          <mesh geometry={GEO.box} material={mat('#e9dcc2')} position={[0, 0.08, 0]} scale={[w - 0.6, 0.1, d - 0.6]} />
          <mesh geometry={GEO.box} material={mat('#d9ccb4')} position={[0, FLOOR_H + 0.02, 0]} scale={[w - 0.6, 0.1, d - 0.6]} />

          {showInterior && <Interior w={w} d={d} bay={bay} doorW={doorW} />}
        </group>
      </Batch>

      {/* letrero y emblema (planos con textura: el texto exacto es VENEPLAST) */}
      <mesh geometry={GEO.box} material={navy} position={[0, (upSill + upTop) / 2, front + 0.02]} scale={[signW + 0.5, upTop - upSill, 0.08]} />
      <mesh geometry={GEO.plane} position={[0, (upSill + upTop) / 2, front + 0.07]} scale={[signW, signH, 1]}>
        <meshBasicMaterial map={S.texture} transparent toneMapped={false} />
      </mesh>
      {/* disco amarillo con VP, asomado sobre la cornisa de la fachada */}
      <group position={[0, H + 0.2 + 0.5, front + 0.12]}>
        <mesh geometry={GEO.cylinder} material={gold} rotation={[Math.PI / 2, 0, 0]} scale={[1.3, 0.18, 1.3]} castShadow />
        <mesh geometry={GEO.plane} position={[0, 0, 0.11]} scale={[0.95, 0.95, 1]}>
          <meshBasicMaterial map={E.texture} transparent toneMapped={false} />
        </mesh>
      </group>

      {/* halo cálido frente a la entrada (solo de noche) */}
      <mesh geometry={GEO.plane} material={POOL()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, front + 1.4]} scale={[w + 2.5, 4.2, 1]} />
      {/* gente entrando y saliendo por la puerta abierta */}
      {showInterior && <Visitors front={front} animated={animateVisitors} />}
    </group>
  )
}

/** Visitantes: unos entran (se acercan, cruzan la puerta y se pierden adentro) y otros salen (aparecen adentro y se alejan). */
const WALKERS = [
  { dir: 1, off: 0.0, lane: -0.45, far: -2.8, color: '#2f86d6', skin: '#c58c64' },
  { dir: -1, off: 0.17, lane: 0.4, far: 3.0, color: '#e8573f', skin: '#e5b48f' },
  { dir: 1, off: 0.34, lane: 0.45, far: 2.2, color: '#3aa57a', skin: '#8d5a3b' },
  { dir: -1, off: 0.5, lane: -0.4, far: -3.2, color: '#9b6ad8', skin: '#c58c64' },
  { dir: 1, off: 0.67, lane: 0.0, far: 0.8, color: '#f3b234', skin: '#e5b48f' },
  { dir: -1, off: 0.84, lane: 0.05, far: -1.0, color: '#17346F', skin: '#c58c64' },
]
const WALK_PERIOD = 13 // segundos por recorrido completo
const WALK_START = 5 // metros frente a la puerta donde empieza/termina el recorrido

function Visitors({ front, animated }: { front: number; animated: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const clock = useRef(0)
  const place = (g: THREE.Group, w: (typeof WALKERS)[number], t: number) => {
    const p = (((t / WALK_PERIOD + w.off) % 1) + 1) % 1
    const q = w.dir > 0 ? p : 1 - p // q: 0 = lejos afuera, 1 = adentro
    const zOut = front + WALK_START
    const zDoor = front - 0.15
    const zIn = front - 1.7
    let x: number
    let z: number
    if (q < 0.78) {
      const k = q / 0.78
      x = w.far + (w.lane - w.far) * Math.min(1, k * 1.15)
      z = zOut + (zDoor - zOut) * k
    } else {
      const k = (q - 0.78) / 0.22
      x = w.lane * (1 - 0.4 * k)
      z = zDoor + (zIn - zDoor) * k
    }
    // aparecen/desaparecen encogiéndose cerca de los extremos (adentro o muy lejos), nunca de golpe en el pasillo
    const edge = Math.min(q / 0.06, (1 - q) / 0.1, 1)
    g.position.set(x, 0.1 + Math.abs(Math.sin(t * 6 + w.off * 20)) * 0.035, z)
    g.scale.setScalar(Math.max(0.001, edge))
    g.rotation.y = w.dir > 0 ? Math.atan2(w.lane - w.far, -WALK_START) : Math.atan2(w.far - w.lane, WALK_START)
  }
  useLayoutEffect(() => {
    WALKERS.forEach((w, i) => {
      const g = refs.current[i]
      if (g) place(g, w, animated ? 0 : 6) // sin animación: quedan congelados en el recorrido
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated, front])
  useFrame((_, rawDt) => {
    if (!animated) return
    clock.current += Math.min(rawDt, 0.1)
    WALKERS.forEach((w, i) => {
      const g = refs.current[i]
      if (g) place(g, w, clock.current)
    })
  })
  return (
    <>
      {WALKERS.map((w, i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)}>
          <Person color={w.color} skin={w.skin} />
        </group>
      ))}
    </>
  )
}

const SIDE_WIN_W = 1.9
/** Ventanas de los costados (alto inferior y superior de cada fila). */
const SIDE_WINDOWS: [number, number][] = [
  [1.0, 2.75],
  [FLOOR_H + 0.6, FLOOR_H + 2.1],
]

/** Muro lateral con dos aberturas por planta (centradas en ±d/4): pilares, antepechos, franjas entre pisos y dinteles. */
function SideWall({ sx, x0, x1, zA, zB, H, d, m }: { sx: number; x0: number; x1: number; zA: number; zB: number; H: number; d: number; m: THREE.Material }) {
  const hw = SIDE_WIN_W / 2
  const xa = sx > 0 ? x0 : -x1
  const xb = sx > 0 ? x1 : -x0
  const cols = [-d / 4, d / 4]
  const piers: [number, number][] = [
    [zA, cols[0] - hw],
    [cols[0] + hw, cols[1] - hw],
    [cols[1] + hw, zB],
  ]
  const ys = [0, ...SIDE_WINDOWS.flat(), H]
  return (
    <group>
      {piers.map(([za, zb], i) => (
        <Box key={i} x0={xa} x1={xb} y0={0} y1={H} z0={za} z1={zb} m={m} />
      ))}
      {cols.map((c) => (
        <group key={c}>
          {[0, 2, 4].map((k) => (
            <Box key={k} x0={xa} x1={xb} y0={ys[k]} y1={ys[k + 1]} z0={c - hw} z1={c + hw} m={m} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Caja definida por sus extremos (min/max en x, y, z): facilita armar muros con aberturas. */
function Box({ x0, x1, y0, y1, z0, z1, m }: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; m: THREE.Material }) {
  return <mesh geometry={GEO.box} material={m} position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} scale={[x1 - x0, y1 - y0, z1 - z0]} castShadow receiveShadow />
}

/** Lo que se ve por las vitrinas: creativo y papelería · tecnología · celebraciones. Pocas piezas, todas pequeñas. */
function Interior({ w, d, bay, doorW }: { w: number; d: number; bay: number; doorW: number }) {
  const wood = mat('#b98a5c')
  const shelfZ = d / 2 - 1.15
  const xL = -(doorW / 2 + bay / 2) // vitrina izquierda: papelería y arte
  const xR = doorW / 2 + bay / 2 // vitrina derecha: tecnología y celebración
  const row = (x0: number, span: number, y: number, n: number, z: number, seed: number) =>
    Array.from({ length: n }, (_, i) => (
      <mesh
        key={`${y}-${i}`}
        geometry={GEO.box}
        material={mat(NOTEBOOKS[(i + seed) % NOTEBOOKS.length])}
        position={[x0 - span / 2 + (span / (n - 1)) * i, y, z]}
        scale={[0.26, 0.42, 0.34]}
      />
    ))
  return (
    <group>
      {/* papelería: repisas con cuadernos, carpetas y hojas de colores */}
      {[0.62, 1.32, 2.02].map((y, k) => (
        <group key={y}>
          <mesh geometry={GEO.box} material={wood} position={[xL, y - 0.26, shelfZ]} scale={[bay - 1, 0.07, 0.62]} />
          {row(xL, bay - 1.5, y, 8, shelfZ, k * 2)}
        </group>
      ))}
      {/* un cuaderno abierto y un portalápices sobre una mesa baja */}
      <group position={[xL + 0.2, 0, shelfZ - 1.15]}>
        <mesh geometry={GEO.rounded} material={white0()} position={[0, 0.34, 0]} scale={[1.5, 0.68, 0.9]} />
        <mesh geometry={GEO.box} material={mat('#f5efe0')} position={[0, 0.7, 0]} scale={[0.6, 0.04, 0.42]} rotation={[0, 0, 0.12]} />
        <mesh geometry={GEO.box} material={mat('#f5efe0')} position={[0.6, 0.7, 0]} scale={[0.6, 0.04, 0.42]} rotation={[0, 0, -0.12]} />
        <mesh geometry={GEO.cylinder} material={mat('#17346F')} position={[-0.55, 0.82, 0.1]} scale={[0.2, 0.28, 0.2]} />
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            geometry={GEO.cylinder}
            material={mat(['#FFC62B', '#e8573f', '#3aa57a'][i])}
            position={[-0.6 + i * 0.05, 1.08, 0.1]}
            rotation={[0, 0, (i - 1) * 0.18]}
            scale={[0.04, 0.42, 0.04]}
          />
        ))}
      </group>

      {/* tecnología (luz algo más fría): escritorio con computador, impresora y accesorios */}
      <group position={[xR - 0.9, 0, shelfZ - 0.2]}>
        <mesh geometry={GEO.rounded} material={white0()} position={[0, 0.5, 0]} scale={[2.6, 0.12, 1.0]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.box} material={mat('#8f95a3')} position={[s * 1.15, 0.24, 0]} scale={[0.08, 0.48, 0.8]} />
        ))}
        <mesh geometry={GEO.box} material={mat('#2a3347')} position={[-0.55, 0.74, -0.1]} scale={[0.1, 0.24, 0.1]} />
        <mesh geometry={GEO.rounded} material={mat('#222b3d')} position={[-0.55, 1.08, -0.1]} scale={[0.92, 0.6, 0.08]} />
        <mesh geometry={GEO.box} material={SCREEN()} position={[-0.55, 1.08, -0.05]} scale={[0.82, 0.5, 0.02]} />
        <mesh geometry={GEO.box} material={mat('#e9ebf0')} position={[-0.55, 0.58, 0.18]} scale={[0.62, 0.05, 0.22]} />
        <mesh geometry={GEO.rounded} material={mat('#e9ebf0')} position={[0.7, 0.68, -0.05]} scale={[0.78, 0.3, 0.55]} />
        <mesh geometry={GEO.box} material={mat('#c8ccd6')} position={[0.7, 0.86, 0.1]} scale={[0.6, 0.03, 0.28]} />
        <mesh geometry={GEO.box} material={mat('#ffffff')} position={[0.7, 0.9, 0.24]} scale={[0.5, 0.02, 0.2]} />
      </group>
      {/* repisa de accesorios tecnológicos */}
      <mesh geometry={GEO.box} material={wood} position={[xR + 0.3, 1.5, shelfZ - 0.6]} scale={[bay - 1.6, 0.07, 0.45]} />
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          geometry={GEO.box}
          material={mat(['#2a3347', '#e9ebf0', '#17346F', '#5a6277', '#e9ebf0'][i])}
          position={[xR + 0.3 - 1 + i * 0.5, 1.7, shelfZ - 0.6]}
          scale={[0.3, 0.28, 0.2]}
        />
      ))}

      {/* celebración: pocos globos y regalos, como guiño a la piñatería y la juguetería */}
      <group position={[xR + bay / 2 - 1.05, 0, shelfZ - 0.9]}>
        {GIFTS.map((c, i) => (
          <group key={c} position={[(i % 2) * 0.55 - 0.3, 0.2 + Math.floor(i / 2) * 0.38, (i % 2) * 0.2]}>
            <mesh geometry={GEO.box} material={mat(c)} scale={[0.5, 0.38, 0.5]} />
            <mesh geometry={GEO.box} material={mat('#f7f3ea')} position={[0, 0.2, 0]} scale={[0.52, 0.05, 0.1]} />
            <mesh geometry={GEO.box} material={mat('#f7f3ea')} position={[0, 0.2, 0]} scale={[0.1, 0.05, 0.52]} />
          </group>
        ))}
        {[
          ['#e8573f', -0.35, 1.7],
          ['#FFC62B', 0.05, 1.95],
          ['#2f86d6', 0.4, 1.65],
        ].map(([c, x, y]) => (
          <group key={c as string} position={[x as number, 0, 0.1]}>
            <mesh geometry={GEO.cylinder} material={mat('#c9ccd3')} position={[0, (y as number) / 2 - 0.2, 0]} scale={[0.02, (y as number) - 0.2, 0.02]} />
            <mesh geometry={GEO.sphere} material={mat(c as string)} position={[0, y as number, 0]} scale={[0.5, 0.58, 0.5]} />
          </group>
        ))}
      </group>

      {/* costados: estantes con productos pegados a los muros laterales (se ven por las ventanas de los lados) */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((q) => (
          <group key={`${sx}${q}`} position={[sx * (w / 2 - 0.62), 0, q * (d / 4)]}>
            {[1.28, 1.88, 2.48, FLOOR_H + 0.85, FLOOR_H + 1.45, FLOOR_H + 2.05].map((y, k) => (
              <group key={y}>
                <mesh geometry={GEO.box} material={wood} position={[0, y, 0]} scale={[0.46, 0.07, SIDE_WIN_W - 0.2]} />
                {Array.from({ length: 6 }, (_, i) => (
                  <mesh
                    key={i}
                    geometry={GEO.box}
                    material={mat(NOTEBOOKS[(i + k + (q > 0 ? 2 : 0) + (sx > 0 ? 1 : 0)) % NOTEBOOKS.length])}
                    position={[0, y + 0.25, -0.75 + i * 0.3]}
                    scale={[0.3, 0.42, 0.22]}
                  />
                ))}
              </group>
            ))}
          </group>
        )),
      )}
      {/* planta alta: estantes de suministros de oficina y un mostrador */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={wood} position={[s * (w / 2 - 2.4), FLOOR_H + 0.95, shelfZ]} scale={[2.6, 0.07, 0.6]} />
          {row(s * (w / 2 - 2.4), 2.0, FLOOR_H + 1.2, 6, shelfZ, s < 0 ? 1 : 4)}
          <mesh geometry={GEO.box} material={wood} position={[s * (w / 2 - 2.4), FLOOR_H + 1.55, shelfZ]} scale={[2.6, 0.07, 0.6]} />
          {row(s * (w / 2 - 2.4), 2.0, FLOOR_H + 1.8, 6, shelfZ, s < 0 ? 3 : 0)}
        </group>
      ))}
      <mesh geometry={GEO.rounded} material={mat(VENEPLAST.navy2)} position={[0, FLOOR_H + 0.5, 0]} scale={[2.4, 0.9, 0.9]} />
    </group>
  )
}

const white0 = () => mat(VENEPLAST.white)
