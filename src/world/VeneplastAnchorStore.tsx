import { useMemo } from 'react'
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
  /** Si es verdadero, el edificio recibe toques (y el cursor cambia a mano). */
  interactive?: boolean
  /** Se llama al tocar el edificio. La experiencia interna (catálogo) se conecta después. */
  onOpen?: () => void
}

/** Alto de cada piso. */
const FLOOR_H = 3.3

/**
 * Huella y medidas del edificio, para colocarlo y detectar choques sin renderizarlo.
 * `bounds` está en el espacio local del componente (antes de aplicar posición, rotación y escala).
 */
export function veneplastFootprint(width = 12, depth = 8) {
  const height = FLOOR_H * 2 + 1.5
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

export function VeneplastAnchorStore({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, width = 12, depth = 8, showInterior = true, interactive = true, onOpen }: VeneplastAnchorStoreProps) {
  const w = width
  const d = depth
  const H = FLOOR_H * 2
  const front = d / 2
  // lo estático se funde en pocas mallas; solo cambia si cambian las medidas
  const version = `veneplast-${w}x${d}-${showInterior ? 'i' : 'x'}`
  const foot = useMemo(() => veneplastFootprint(w, d), [w, d])
  const S = sign()
  const E = emblem()

  const navy = mat(VENEPLAST.navy)
  const navy2 = mat(VENEPLAST.navy2)
  const roof = mat("#22407f")
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
  const upTop = upSill + 2.2
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
          <Box x0={-w / 2} x1={-w / 2 + T} y0={0} y1={H} z0={-d / 2} z1={front - T} m={navy} />
          <Box x0={w / 2 - T} x1={w / 2} y0={0} y1={H} z0={-d / 2} z1={front - T} m={navy} />
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

          {/* azotea: antepecho y un volumen central escalonado que da jerarquía */}
          <mesh geometry={GEO.box} material={navy2} position={[0, H + 0.34, front + 0.1]} scale={[w + 0.3, 0.28, 0.18]} />
          <mesh geometry={GEO.box} material={navy2} position={[0, H + 0.34, -front - 0.1]} scale={[w + 0.3, 0.28, 0.18]} />
          <mesh geometry={GEO.box} material={navy2} position={[-w / 2 - 0.1, H + 0.34, 0]} scale={[0.18, 0.28, d + 0.3]} />
          <mesh geometry={GEO.box} material={navy2} position={[w / 2 + 0.1, H + 0.34, 0]} scale={[0.18, 0.28, d + 0.3]} />
          <mesh geometry={GEO.rounded} material={navy2} position={[0, H + 0.2 + 0.55, front * 0.15]} scale={[w * 0.5, 1.1, d * 0.5]} castShadow />
          <mesh geometry={GEO.box} material={roof} position={[0, H + 0.2 + 1.12, front * 0.15]} scale={[w * 0.5 + 0.2, 0.12, d * 0.5 + 0.2]} />

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
          <mesh geometry={GEO.box} material={GOLD_GLOW()} position={[0, H - 0.16, front + 0.1]} scale={[w - 0.5, 0.05, 0.06]} />

          {/* aletas amarillas verticales en la esquina (reconocibles de lejos) */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={GEO.box} material={gold} position={[-w / 2 + 0.55 + i * 0.34, FLOOR_H + 0.3 + 1.25, front + 0.18]} scale={[0.18, 2.5, 0.16]} castShadow />
          ))}

          {/* ── entrada: puertas dobles de vidrio, toldo amarillo y luces cálidas ── */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (doorW / 4), 0, front - 0.1]}>
              <mesh geometry={GEO.box} material={GLASS} position={[0, 1.15, 0]} scale={[doorW / 2 - 0.14, 2.2, 0.05]} />
              <mesh geometry={GEO.box} material={WARM_PANE()} position={[0, 1.15, -0.07]} scale={[doorW / 2 - 0.2, 2.1, 0.03]} />
              <mesh geometry={GEO.box} material={white} position={[-s * 0.1, 1.1, 0.06]} scale={[0.04, 0.55, 0.04]} />
              <mesh geometry={GEO.box} material={navy2} position={[0, 1.15, 0.02]} scale={[0.06, 2.2, 0.05]} />
            </group>
          ))}
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

          {/* costados: ventanas sobrias para que el edificio no quede ciego al girarlo */}
          {[-1, 1].map((s) =>
            [FLOOR_H * 0.5 + 0.3, FLOOR_H * 1.5 + 0.2].map((y) =>
              [-1, 1].map((q) => (
                <group key={`${s}${y}${q}`} position={[s * (w / 2 + 0.02), y, q * (d / 4)]}>
                  <mesh geometry={GEO.box} material={navy2} scale={[0.1, 1.5, 1.9]} />
                  <mesh geometry={GEO.box} material={GLASS} position={[s * 0.05, 0, 0]} scale={[0.05, 1.36, 1.74]} />
                  <mesh geometry={GEO.box} material={WARM_PANE()} position={[-s * 0.04, 0, 0]} scale={[0.03, 1.3, 1.7]} />
                </group>
              )),
            ),
          )}

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
      {/* disco amarillo con VP, sobre el volumen central de la azotea */}
      <group position={[0, H + 0.2 + 1.55, front * 0.15 + (d * 0.5) / 2 + 0.12]}>
        <mesh geometry={GEO.cylinder} material={gold} rotation={[Math.PI / 2, 0, 0]} scale={[1.7, 0.2, 1.7]} castShadow />
        <mesh geometry={GEO.plane} position={[0, 0, 0.11]} scale={[1.25, 1.25, 1]}>
          <meshBasicMaterial map={E.texture} transparent toneMapped={false} />
        </mesh>
      </group>
      <mesh geometry={GEO.box} material={GOLD_GLOW()} position={[0, H + 0.2 + 0.06, front * 0.15 + (d * 0.5) / 2 + 0.1]} scale={[w * 0.5, 0.05, 0.05]} />

      {/* halo cálido frente a la entrada (solo de noche) */}
      <mesh geometry={GEO.plane} material={POOL()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, front + 1.4]} scale={[w + 2.5, 4.2, 1]} />
      {/* dos visitantes en la puerta (mismos que el resto del mall) */}
      {showInterior && (
        <>
          <group position={[-0.7, 0.1, front + 1.5]} rotation={[0, -0.3, 0]}>
            <Person color="#2f86d6" skin="#c58c64" />
          </group>
          <group position={[0.35, 0.1, front + 1.65]} rotation={[0, 0.25, 0]}>
            <Person color="#e8573f" skin="#e5b48f" />
          </group>
        </>
      )}
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
      <mesh key={`${y}-${i}`} geometry={GEO.box} material={mat(NOTEBOOKS[(i + seed) % NOTEBOOKS.length])} position={[x0 - span / 2 + (span / (n - 1)) * i, y, z]} scale={[0.26, 0.42, 0.34]} />
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
          <mesh key={i} geometry={GEO.cylinder} material={mat(['#FFC62B', '#e8573f', '#3aa57a'][i])} position={[-0.6 + i * 0.05, 1.08, 0.1]} rotation={[0, 0, (i - 1) * 0.18]} scale={[0.04, 0.42, 0.04]} />
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
        <mesh key={i} geometry={GEO.box} material={mat(['#2a3347', '#e9ebf0', '#17346F', '#5a6277', '#e9ebf0'][i])} position={[xR + 0.3 - 1 + i * 0.5, 1.7, shelfZ - 0.6]} scale={[0.3, 0.28, 0.2]} />
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

      {/* planta alta: estantes de suministros de oficina y un mostrador */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={wood} position={[s * (w / 2 - 1.1), FLOOR_H + 0.95, shelfZ]} scale={[2.6, 0.07, 0.6]} />
          {row(s * (w / 2 - 1.1), 2.0, FLOOR_H + 1.2, 6, shelfZ, s < 0 ? 1 : 4)}
          <mesh geometry={GEO.box} material={wood} position={[s * (w / 2 - 1.1), FLOOR_H + 1.55, shelfZ]} scale={[2.6, 0.07, 0.6]} />
          {row(s * (w / 2 - 1.1), 2.0, FLOOR_H + 1.8, 6, shelfZ, s < 0 ? 3 : 0)}
        </group>
      ))}
      <mesh geometry={GEO.rounded} material={mat(VENEPLAST.navy2)} position={[0, FLOOR_H + 0.5, 0]} scale={[2.4, 0.9, 0.9]} />
    </group>
  )
}

const white0 = () => mat(VENEPLAST.white)
