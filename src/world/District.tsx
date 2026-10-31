import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DISTRICT_PLAZA, DISTRICT_ZONE } from '../config/mall'
import { SHOWROOMS, SHOWROOM_IDS, type Showroom, type ShowroomId } from '../district/showrooms'
import { useIsNight } from '../lib/useIsNight'
import { useUI } from '../state/ui'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { cameraState } from './cameraState'
import { Person } from './Harbor'
import { getGlassPill, getLabel } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat, litLabelMat } from './night'

// Zona de servicios (piso 1, esquina entre Lifestyle y Belleza): piso de baldosa cálida, una plaza
// redonda con palmera, toldo y guirnaldas, y las vitrinas grandes de Planly (turismo) y GrowDesk
// (software). Los espacios para barberías son locales normales (SpaceUnit, zona F).

const P = DISTRICT_PLAZA
const X0 = -29.7
const X1 = -10
const Z0 = 10
const Z1 = 29.8
const Y = 0.04

// ── decoración reutilizable ───────────────────────────────────────────────────────────────────

function Palm({ x, z, h = 3.4, y = Y, seed = 0 }: { x: number; z: number; h?: number; y?: number; seed?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(PALETTE.trunk)} position={[0, h / 2, 0]} rotation={[0.1, seed, 0]} scale={[0.3, h, 0.3]} castShadow />
      {Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * Math.PI * 2 + seed
        return <mesh key={k} geometry={GEO.box} material={mat(PALETTE.leafDark)} position={[Math.sin(a) * 0.8, h + 0.05, Math.cos(a) * 0.8]} rotation={[0.38, a, 0]} scale={[0.5, 0.08, 1.8]} castShadow />
      })}
    </group>
  )
}

function Planter({ x, z, w = 1.2, d = 0.8, flowers = '#e8879c', y = Y }: { x: number; z: number; w?: number; d?: number; flowers?: string; y?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh geometry={GEO.rounded} material={mat('#d9a88a')} position={[0, 0.25, 0]} scale={[w, 0.5, d]} castShadow />
      <mesh geometry={GEO.sphere} material={mat(PALETTE.leaf)} position={[0, 0.65, 0]} scale={[w * 0.9, 0.55, d * 0.9]} castShadow />
      <mesh geometry={GEO.sphere} material={mat(flowers)} position={[w * 0.2, 0.85, 0]} scale={[0.32, 0.28, 0.32]} />
      <mesh geometry={GEO.sphere} material={mat(flowers)} position={[-w * 0.25, 0.8, d * 0.15]} scale={[0.26, 0.22, 0.26]} />
    </group>
  )
}

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat('#2f3338')} position={[0, 1.3, 0]} scale={[0.09, 2.6, 0.09]} />
      <mesh geometry={GEO.sphere} material={glowMat(PALETTE.lamp, 2.4, { dayGlow: 0.6 })} position={[0, 2.65, 0]} scale={0.36} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.6)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[3, 3, 1]} />
    </group>
  )
}

/** Piso de baldosas cálidas con juntas terracota y un camino al muelle. */
function Paving() {
  const lines: [number, number, number, number][] = []
  for (let x = X0 + 2; x < X1; x += 2.4) lines.push([x, (Z0 + Z1) / 2, 0.05, Z1 - Z0])
  for (let z = Z0 + 2; z < Z1; z += 2.4) lines.push([(X0 + X1) / 2, z, X1 - X0, 0.05])
  return (
    <group>
      <mesh geometry={GEO.box} material={mat('#eedccb')} position={[(X0 + X1) / 2, 0.02, (Z0 + Z1) / 2]} scale={[X1 - X0, 0.04, Z1 - Z0]} receiveShadow />
      {lines.map(([x, z, w, d], i) => (
        <mesh key={i} geometry={GEO.box} material={mat('#e3c4ac')} position={[x, 0.045, z]} scale={[w, 0.01, d]} receiveShadow />
      ))}
      {/* sendero terracota: de las vitrinas a la plaza y de la plaza a la puerta del muelle */}
      <mesh geometry={GEO.box} material={mat('#e9b9a1')} position={[-19.4, 0.05, 19.4]} scale={[2.2, 0.02, 3.4]} receiveShadow />
      <mesh geometry={GEO.box} material={mat('#e9b9a1')} position={[-16.6, 0.05, 26.2]} rotation={[0, -0.7, 0]} scale={[1.8, 0.02, 4.6]} receiveShadow />
    </group>
  )
}

/** Plaza redonda: tarima de madera, palmera, bancas, toldo de vela y guirnaldas. */
function Plaza() {
  const posts = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.3
    return [P.x + Math.sin(a) * (P.r + 0.6), P.z + Math.cos(a) * (P.r + 0.6)] as [number, number]
  })
  const bulb = glowMat('#ffd58a', 2.2, { dayGlow: 0.5 })
  return (
    <group>
      <mesh geometry={GEO.cylinder} material={mat('#c99566')} position={[P.x, 0.14, P.z]} scale={[P.r * 2, 0.22, P.r * 2]} receiveShadow castShadow />
      <mesh geometry={GEO.cylinder} material={mat('#b98159')} position={[P.x, 0.26, P.z]} scale={[P.r * 1.2, 0.04, P.r * 1.2]} receiveShadow />
      {/* jardinera central con palmera */}
      <mesh geometry={GEO.cylinder} material={mat(PALETTE.trim)} position={[P.x, 0.45, P.z]} scale={[1.6, 0.4, 1.6]} castShadow />
      <mesh geometry={GEO.sphere} material={mat(PALETTE.leaf)} position={[P.x, 0.72, P.z]} scale={[1.5, 0.4, 1.5]} />
      <Palm x={P.x} z={P.z} h={3.8} y={0.6} seed={1.2} />
      {/* bancas */}
      {[0.5, 2.6, 4.7].map((a) => (
        <group key={a} position={[P.x + Math.sin(a) * 2.1, 0.25, P.z + Math.cos(a) * 2.1]} rotation={[0, a + Math.PI / 2, 0]}>
          <mesh geometry={GEO.rounded} material={mat(PALETTE.wood)} position={[0, 0.32, 0]} scale={[1.2, 0.1, 0.42]} castShadow />
          <mesh geometry={GEO.box} material={mat(PALETTE.woodDark)} position={[0, 0.15, 0]} scale={[1, 0.3, 0.3]} />
        </group>
      ))}
      {/* postes con guirnaldas hacia el centro y vela de sombra */}
      {posts.map(([x, z], i) => {
        const dx = P.x - x
        const dz = P.z - z
        const len = Math.hypot(dx, dz)
        return (
          <group key={i}>
            <mesh geometry={GEO.cylinderLow} material={mat('#5a4636')} position={[x, 1.5, z]} scale={[0.1, 3, 0.1]} />
            <mesh geometry={GEO.box} material={mat('#3a3a3a')} position={[x + dx / 2, 2.85, z + dz / 2]} rotation={[0, Math.atan2(dx, dz), 0]} scale={[0.02, 0.02, len]} />
            {[0.25, 0.5, 0.75].map((u) => (
              <mesh key={u} geometry={GEO.sphere} material={bulb} position={[x + dx * u, 2.8 - Math.sin(u * Math.PI) * 0.18, z + dz * u]} scale={0.16} />
            ))}
          </group>
        )
      })}
      <mesh geometry={GEO.cylinderLow} material={mat('#f8f3ea', { opacity: 0.92 })} position={[P.x + 0.4, 3.35, P.z - 0.3]} rotation={[0.12, 0.5, -0.08]} scale={[4.6, 0.04, 4.6]} castShadow />
    </group>
  )
}

/** Carrito de café y tótem de información: vida en la plaza. */
function Extras() {
  const sign = useMemo(() => getLabel('i', { bg: '#13b9ad', fg: '#ffffff' }), [])
  return (
    <group>
      {/* carrito de café con toldo a rayas */}
      <group position={[-21.3, Y, 28]} rotation={[0, 0.3, 0]}>
        <mesh geometry={GEO.box} material={mat('#f3e3cf')} position={[0, 0.55, 0]} scale={[1.6, 1.1, 0.9]} castShadow />
        <mesh geometry={GEO.box} material={mat('#7a4b2a')} position={[0, 1.13, 0]} scale={[1.7, 0.08, 1]} />
        {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
          <mesh key={x} geometry={GEO.box} material={mat(i % 2 ? '#ffffff' : '#e0735f')} position={[x, 1.85, 0.15]} rotation={[-0.25, 0, 0]} scale={[0.4, 0.06, 1.2]} castShadow />
        ))}
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} geometry={GEO.box} material={mat('#5a4636')} position={[x, 1.5, -0.35]} scale={[0.06, 0.8, 0.06]} />
        ))}
        <mesh geometry={GEO.cylinder} material={mat('#ffffff')} position={[0.3, 1.25, 0.1]} scale={[0.22, 0.2, 0.22]} />
      </group>
      {/* tótem de información frente a GrowDesk */}
      <group position={[-17.4, Y, 19.4]} rotation={[0, 0.4, 0]}>
        <mesh geometry={GEO.rounded} material={mat('#1f8f8a')} position={[0, 1.15, 0]} scale={[0.75, 2.3, 0.3]} castShadow />
        <mesh geometry={GEO.plane} material={litLabelMat(sign.texture)} position={[0, 1.8, 0.16]} scale={[0.5 * sign.aspect, 0.5, 1]} />
      </group>
      {/* palmeras, jardineras y faroles */}
      <Palm x={-28.4} z={18.3} h={3.6} seed={0.4} />
      <Palm x={-28.4} z={28.6} h={3.2} seed={2.1} />
      <Palm x={-19.4} z={11.2} h={3.8} seed={3.3} />
      <Palm x={-10.9} z={18.9} h={3.3} seed={5.1} />
      <Planter x={-21.2} z={18.4} />
      <Planter x={-17.6} z={18.4} flowers="#f7b34b" />
      <Planter x={-23.4} z={24.6} w={0.9} />
      <Planter x={-13.2} z={25} w={0.9} flowers="#f7b34b" />
      <Lamp x={-22.6} z={20.2} />
      <Lamp x={-16.4} z={20.4} />
      <Lamp x={-17.8} z={26.4} />
      <Lamp x={-26.6} z={18.6} />
    </group>
  )
}

// ── vitrinas ─────────────────────────────────────────────────────────────────────────────────

/** Póster de playa (cielo, mar, arena y palmera) dibujado una vez. */
function useBeachTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 160
    const g = c.getContext('2d')!
    const sky = g.createLinearGradient(0, 0, 0, 90)
    sky.addColorStop(0, '#7fd3f0')
    sky.addColorStop(1, '#c9f0ff')
    g.fillStyle = sky
    g.fillRect(0, 0, 256, 90)
    g.fillStyle = '#ffe08a'
    g.beginPath()
    g.arc(200, 34, 16, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#1fb3c2'
    g.fillRect(0, 90, 256, 34)
    g.fillStyle = '#5fd6d0'
    g.fillRect(0, 90, 256, 8)
    g.fillStyle = '#f5deb0'
    g.fillRect(0, 124, 256, 36)
    g.strokeStyle = '#7a5532'
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(52, 140)
    g.quadraticCurveTo(60, 90, 78, 52)
    g.stroke()
    g.fillStyle = '#2f8a4f'
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      g.beginPath()
      g.ellipse(78 + Math.cos(a) * 18, 52 + Math.sin(a) * 8, 22, 6, a, 0, Math.PI * 2)
      g.fill()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

function Planly({ room }: { room: Showroom }) {
  const [W, D] = room.size
  const H = 3.2
  const sign = useMemo(() => getLabel('PLANLY', { bg: '#7a4b2a', fg: '#fff6e6', weight: 900 }), [])
  const beach = useBeachTexture()
  const cream = mat('#f6e7d3')
  const coral = mat('#e0735f')
  const teal = mat('#2fa3a0')
  const wood = mat('#9a6b45')
  const glass = mat('#bfe9ec', { opacity: 0.55, rough: 0.2 })
  const warm = glowMat('#ffd9a0', 1.2, { dayGlow: 0.35 })
  return (
    <group>
      {/* cuerpo, zócalo y cornisa */}
      <mesh geometry={GEO.box} material={cream} position={[0, H / 2, 0]} scale={[W, H, D]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat('#e6cfb4')} position={[0, 0.15, 0.02]} scale={[W + 0.1, 0.3, D + 0.1]} />
      {/* cornisa coral solo en el borde y terraza de madera en el techo */}
      <mesh geometry={GEO.box} material={coral} position={[0, H + 0.08, D / 2 + 0.02]} scale={[W + 0.2, 0.3, 0.22]} castShadow />
      <mesh geometry={GEO.box} material={coral} position={[W / 2 + 0.02, H + 0.08, 0]} scale={[0.22, 0.3, D + 0.2]} />
      <mesh geometry={GEO.box} material={mat('#f0dcc2')} position={[0, H + 0.02, 0]} scale={[W, 0.06, D]} receiveShadow />
      <mesh geometry={GEO.box} material={mat('#c99566')} position={[0, H + 0.08, -0.3]} scale={[W - 0.9, 0.05, D - 1.3]} receiveShadow />
      {/* franjas de color en la esquina izquierda del frente y en el costado */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={GEO.box} material={[coral, teal, cream, coral][i]} position={[-W / 2 + 0.35 + i * 0.5, H / 2, D / 2 + 0.03]} scale={[0.42, H - 0.2, 0.06]} />
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={GEO.box} material={i % 2 ? teal : coral} position={[W / 2 + 0.03, H / 2, -D / 2 + 0.8 + i * 0.6]} scale={[0.06, H - 0.3, 0.45]} />
      ))}
      {/* vitrina de vidrio con interior cálido y puerta */}
      <mesh geometry={GEO.box} material={warm} position={[0.2, 1.25, D / 2 - 0.05]} scale={[3.4, 2.1, 0.04]} />
      <mesh geometry={GEO.box} material={glass} position={[0.2, 1.25, D / 2 + 0.04]} scale={[3.6, 2.3, 0.06]} />
      <mesh geometry={GEO.box} material={wood} position={[0.2, 2.45, D / 2 + 0.06]} scale={[3.8, 0.1, 0.1]} />
      {/* póster de playa a la derecha */}
      <mesh geometry={GEO.box} material={mat('#ffffff')} position={[W / 2 - 1.15, 1.45, D / 2 + 0.05]} scale={[1.75, 1.25, 0.06]} />
      <mesh geometry={GEO.plane} material={litLabelMat(beach)} position={[W / 2 - 1.15, 1.45, D / 2 + 0.09]} scale={[1.6, 1.1, 1]} />
      {/* letrero de madera */}
      <mesh geometry={GEO.box} material={wood} position={[0.2, H + 0.7, D / 2 - 0.2]} rotation={[-0.08, 0, 0]} scale={[0.9 * sign.aspect + 0.3, 1.05, 0.14]} castShadow />
      <mesh geometry={GEO.plane} material={litLabelMat(sign.texture)} position={[0.2, H + 0.71, D / 2 - 0.12]} rotation={[-0.08, 0, 0]} scale={[0.9 * sign.aspect, 0.9, 1]} />
      {/* terraza en el techo: pérgola de madera, plantas, flores y palmeras */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={wood} position={[-W / 2 + 0.7 + i * ((W - 1.4) / 7), H + 1.55, -0.3]} scale={[0.14, 0.12, D - 1.2]} castShadow />
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={GEO.box} material={wood} position={[sx * (W / 2 - 0.6), H + 0.8, -0.3 + sz * (D / 2 - 0.9)]} scale={[0.16, 1.5, 0.16]} />),
      )}
      {[-2.6, -0.6, 1.6].map((x, i) => (
        <mesh key={x} geometry={GEO.sphere} material={mat(i % 2 ? PALETTE.leafDark : PALETTE.leaf)} position={[x, H + 1.62, -0.3 + (i - 1) * 0.6]} scale={[1.4, 0.3, 1]} />
      ))}
      {[-3, 0.4, 3].map((x) => (
        <mesh key={x} geometry={GEO.sphere} material={mat('#e8879c')} position={[x, H + 0.45, D / 2 - 0.35]} scale={[0.5, 0.35, 0.4]} />
      ))}
      <Palm x={-W / 2 + 0.6} z={-D / 2 + 0.7} h={2.6} y={H + 0.15} seed={0.7} />
      <Palm x={W / 2 - 0.5} z={-D / 2 + 0.6} h={2.2} y={H + 0.15} seed={2.4} />
      {/* columnas turquesa a la entrada y luz en el piso */}
      {[-1.65, 2.05].map((x) => (
        <mesh key={x} geometry={GEO.cylinder} material={teal} position={[x, 1.3, D / 2 + 0.35]} scale={[0.3, 2.6, 0.3]} castShadow />
      ))}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.7)} rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.06, D / 2 + 1.4]} scale={[5, 2.5, 1]} />
    </group>
  )
}

function GrowDesk({ room }: { room: Showroom }) {
  const [W, D] = room.size
  const H = 3.6
  const sign = useMemo(() => getLabel('GrowDesk Offices', { bg: '#1b2547', fg: '#ffffff', weight: 800 }), [])
  const navy = mat('#26325c')
  const navyDark = mat('#1b2547')
  const glass = mat('#9fd6ee', { opacity: 0.45, rough: 0.1 })
  const inside = glowMat('#e9f6ff', 1, { dayGlow: 0.4 })
  const teal = mat('#13b9ad')
  const white = mat('#ffffff')
  return (
    <group>
      <mesh geometry={GEO.box} material={navy} position={[0, H / 2, -0.3]} scale={[W, H, D - 0.6]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={navyDark} position={[0, H + 0.12, -0.2]} scale={[W + 0.25, 0.24, D - 0.3]} castShadow />
      {/* fachada de vidrio con interior luminoso: recepción y un monitor */}
      <mesh geometry={GEO.box} material={inside} position={[-0.4, 1.4, D / 2 - 0.575]} scale={[W - 2.2, 2.5, 0.02]} />
      <mesh geometry={GEO.box} material={glass} position={[-0.4, 1.45, D / 2 - 0.5]} scale={[W - 2, 2.7, 0.08]} />
      {[-2.2, -0.4, 1.4].map((x) => (
        <mesh key={x} geometry={GEO.box} material={navyDark} position={[x, 1.45, D / 2 - 0.44]} scale={[0.08, 2.7, 0.1]} />
      ))}
      <mesh geometry={GEO.box} material={white} position={[0.6, 0.5, D / 2 - 1]} scale={[1.6, 0.9, 0.5]} castShadow />
      <mesh geometry={GEO.box} material={teal} position={[0.6, 0.97, D / 2 - 1]} scale={[1.6, 0.05, 0.52]} />
      {/* letrero de la marca */}
      <mesh geometry={GEO.box} material={navyDark} position={[-0.3, H - 0.45, D / 2 - 0.42]} scale={[0.7 * sign.aspect + 0.3, 0.85, 0.12]} />
      <mesh geometry={GEO.plane} material={litLabelMat(sign.texture)} position={[-0.3, H - 0.45, D / 2 - 0.33]} scale={[0.7 * sign.aspect, 0.7, 1]} />
      {/* pantalla con gráfica de barras (lado derecho del frente) */}
      <mesh geometry={GEO.box} material={white} position={[W / 2 - 0.65, 1.45, D / 2 - 0.45]} scale={[1, 1.4, 0.08]} />
      {[0.35, 0.6, 0.85, 1.1].map((h, i) => (
        <mesh key={i} geometry={GEO.box} material={teal} position={[W / 2 - 1 + i * 0.23, 0.85 + h / 2, D / 2 - 0.37]} scale={[0.14, h, 0.02]} />
      ))}
      {/* jardín vertical y aletas verdes en el costado */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={GEO.box} material={mat(i % 2 ? '#1f8f8a' : PALETTE.leafDark)} position={[W / 2 + 0.05, H / 2, -D / 2 + 0.9 + i * 0.9]} scale={[0.12, H - 0.4, 0.4]} />
      ))}
      {/* sala de reuniones de vidrio en el techo */}
      <mesh geometry={GEO.box} material={inside} position={[0.6, H + 0.85, -0.6]} scale={[2.6, 1.3, 2]} />
      <mesh geometry={GEO.box} material={glass} position={[0.6, H + 0.85, -0.6]} scale={[2.7, 1.4, 2.1]} />
      <mesh geometry={GEO.box} material={navyDark} position={[0.6, H + 1.6, -0.6]} scale={[2.9, 0.12, 2.3]} />
      <mesh geometry={GEO.sphere} material={mat(PALETTE.leaf)} position={[-2.2, H + 0.45, 0.4]} scale={[1.2, 0.5, 0.9]} />
      {/* entrada: alero y palmera */}
      <mesh geometry={GEO.box} material={navyDark} position={[-0.4, 2.95, D / 2 - 0.1]} scale={[W - 1.6, 0.12, 0.9]} castShadow />
      <Palm x={-W / 2 + 0.2} z={D / 2 + 0.3} h={2.9} seed={4.2} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#cfeaff', 0.6)} rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0.06, D / 2 + 1.2]} scale={[5, 2.4, 1]} />
    </group>
  )
}

/** Vitrina tocable: abre su ficha. Lo estático va en Batch; el grupo recibe el toque. */
function ShowroomBuilding({ id }: { id: ShowroomId }) {
  const room = SHOWROOMS[id]
  const selected = useUI((s) => s.showroom === id)
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: room.color, transparent: true, opacity: 0, depthWrite: false }), [room.color])
  useFrame(() => {
    ringMat.opacity = THREE.MathUtils.lerp(ringMat.opacity, selected ? 0.32 : 0, 0.15)
    if (ring.current) ring.current.visible = ringMat.opacity > 0.01
  })
  const [W, D] = room.size
  return (
    <group
      position={[room.position[0], Y, room.position[1]]}
      onClick={(e) => {
        if (cameraState.handMode || e.delta > 8) return
        e.stopPropagation()
        useUI.getState().openShowroom(id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh ref={ring} geometry={GEO.box} material={ringMat} position={[0, 0.03, 0.4]} scale={[W + 1.4, 0.02, D + 2]} visible={false} />
      <Batch version={`vitrina-${id}`}>{id === 'planly' ? <Planly room={room} /> : <GrowDesk room={room} />}</Batch>
    </group>
  )
}

/** Gente paseando por la plaza y frente a las vitrinas. */
function Strollers({ reduceMotion }: { reduceMotion: boolean }) {
  const walkers = useRef<(THREE.Group | null)[]>([])
  const people = useMemo(
    () => [
      { r: 4.3, speed: 0.18, phase: 0, color: '#3d7ea6', skin: '#8d5a3b' },
      { r: 4.3, speed: 0.18, phase: 2.1, color: '#e07a5f', skin: '#e5b48f' },
      { r: 4.6, speed: -0.14, phase: 1.2, color: '#81b29a', skin: '#c58c64' },
      { r: 4.6, speed: -0.14, phase: 4, color: '#f2cc8f', skin: '#8d5a3b' },
    ],
    [],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    people.forEach((p, i) => {
      const g = walkers.current[i]
      if (!g) return
      const a = p.phase + (reduceMotion ? 0 : t * p.speed)
      g.position.set(P.x + Math.sin(a) * p.r, Y + (reduceMotion ? 0 : Math.abs(Math.sin(t * 6 + i)) * 0.03), P.z + Math.cos(a) * p.r)
      g.rotation.y = a + (p.speed > 0 ? Math.PI / 2 : -Math.PI / 2)
    })
  })
  const standing: [number, number, string, string, number][] = [
    [-23.2, 18.6, '#6c5b7b', '#c58c64', Math.PI],
    [-22.4, 18.9, '#f28482', '#8d5a3b', -2.6],
    [-14.2, 19, '#355070', '#e5b48f', Math.PI],
    [-13.4, 18.7, '#e9c46a', '#c58c64', 2.8],
  ]
  return (
    <group>
      {people.map((p, i) => (
        <group key={i} ref={(g) => void (walkers.current[i] = g)}>
          <Person color={p.color} skin={p.skin} />
        </group>
      ))}
      {standing.map(([x, z, c, s, r], i) => (
        <group key={i} position={[x, Y, z]} rotation={[0, r, 0]}>
          <Person color={c} skin={s} />
        </group>
      ))}
    </group>
  )
}

/** Zona de servicios completa. */
export function District({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const zoneLabel = useMemo(() => getGlassPill(DISTRICT_ZONE.name, { dot: DISTRICT_ZONE.color, sub: 'Zona F', dark: night }), [night])
  const labels = useMemo(
    () => SHOWROOM_IDS.map((id) => ({ id, label: getGlassPill(SHOWROOMS[id].name, { dot: SHOWROOMS[id].color, sub: SHOWROOMS[id].kind, dark: night }) })),
    [night],
  )
  const open = useUI((s) => s.showroom)
  return (
    <group>
      <Batch version="servicios">
        <Paving />
        <Plaza />
        <Extras />
      </Batch>
      {SHOWROOM_IDS.map((id) => (
        <ShowroomBuilding key={id} id={id} />
      ))}
      <Strollers reduceMotion={reduceMotion} />
      <ScreenLabel label={zoneLabel} position={[P.x, 6.5, P.z]} pixelHeight={35} maxZoomRatio={1.45} priority={LABEL_PRIORITY.corridorOverview} />
      {labels.map(({ id, label }) =>
        open === id ? null : (
          <ScreenLabel
            key={id}
            label={label}
            position={[SHOWROOMS[id].position[0], 6.6, SHOWROOMS[id].position[1] + 1]}
            pixelHeight={36}
            minZoomRatio={1.45}
            priority={LABEL_PRIORITY.store + 5}
            onClick={() => useUI.getState().openShowroom(id)}
          />
        ),
      )}
    </group>
  )
}
