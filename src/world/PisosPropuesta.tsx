import { useMemo } from 'react'
import { useCatalog } from '../state/catalog'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, GLASS, PALETTE, mat } from './materials'
import { glowMat } from './night'
import { FLOOR_BY_ID } from '../config/mall'
import type { SpaceSlot } from '../domain/types'
import { SpaceUnit } from './SpaceUnit'

// Propuesta de piso 3 «Entretenimiento» (vista previa): se apoya sobre el rincón del fondo del piso 2, con el
// mismo lenguaje de los locales abiertos (toldos, vitrinas, luces cálidas). No toca el piso 1 ni sus locales.
// Solo se dibuja con ?vista=pisos.

export const PISOS_PREVIEW = typeof location !== 'undefined' && /[?&]vista=pisos/.test(location.search)

const P2 = FLOOR_BY_ID.P2
/** Centro de la losa del piso 3 (mundo): el rincón del fondo del piso 2, hacia el fondo de la fortaleza. */
const ORIGIN: [number, number, number] = [P2.offset[0] - 6, P2.elevation + 7.2, P2.offset[1] - 6]
const H = 8.5
const STONE = '#e4d2ae'
const STONE_DARK = '#cdb68e'
const NAVY = '#1c2a55'
const UMBRELLA = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f']

function slot(id: string, at: [number, number], rotation: number, type: 'local' | 'island'): SpaceSlot {
  return { id, floorId: 'P2', zoneId: 'E', type, label: id, position: at, rotation, size: type === 'local' ? [6, 5] : [2.6, 2.6] } as SpaceSlot
}

const P3_SPACES: SpaceSlot[] = [
  slot('P3-1', [-5.7, -0.8], Math.PI / 2, 'local'),
  slot('P3-2', [-5.7, 5.2], Math.PI / 2, 'local'),
  slot('P3-3', [5.7, -0.8], -Math.PI / 2, 'local'),
  slot('P3-4', [0.5, 1.2], Math.PI / 4, 'island'),
]

function Table({ x, z, i }: { x: number; z: number; i: number }) {
  return (
    <group position={[x, 0.2, z]}>
      <mesh geometry={GEO.cylinder} material={mat('#f4efe4')} position={[0, 0.78, 0]} scale={[1.1, 0.08, 1.1]} />
      <mesh geometry={GEO.cylinder} material={mat('#8a6340')} position={[0, 0.4, 0]} scale={[0.12, 0.8, 0.12]} />
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2 + i
        return <mesh key={k} geometry={GEO.cylinder} material={mat(['#f2b880', '#9fd0c7', '#f4a9a0'][k])} position={[Math.cos(a) * 0.95, 0.25, Math.sin(a) * 0.95]} scale={[0.4, 0.5, 0.4]} />
      })}
      <mesh geometry={GEO.cylinder} material={mat('#8a6340')} position={[0, 1.5, 0]} scale={[0.06, 2.4, 0.06]} />
      <mesh geometry={GEO.cone} material={mat(UMBRELLA[i % UMBRELLA.length])} position={[0, 2.75, 0]} scale={[2.6, 0.55, 2.6]} />
    </group>
  )
}

function Planter({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0.2, z]}>
      <mesh geometry={GEO.box} material={mat(PALETTE.pot)} position={[0, 0.3 * s, 0]} scale={[0.9 * s, 0.6 * s, 0.9 * s]} />
      <mesh geometry={GEO.sphereSmooth} material={mat(PALETTE.leaf)} position={[0, 1.0 * s, 0]} scale={1.15 * s} />
      <mesh geometry={GEO.sphereSmooth} material={mat(PALETTE.leafDark)} position={[0.2 * s, 1.5 * s, 0.1 * s]} scale={0.7 * s} />
    </group>
  )
}

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.2, z]}>
      <mesh geometry={GEO.cylinder} material={mat('#3a4450')} position={[0, 1.3, 0]} scale={[0.1, 2.6, 0.1]} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#fff1c9', 2.2, { dayGlow: 0.3 })} position={[0, 2.7, 0]} scale={0.42} />
    </group>
  )
}

/** Baranda de vidrio y piedra de (x0,z0) a (x1,z1). */
function Rail({ x0, z0, x1, z1 }: { x0: number; z0: number; x1: number; z1: number }) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  return (
    <group position={[(x0 + x1) / 2, 0.2, (z0 + z1) / 2]} rotation={[0, Math.atan2(-(z1 - z0), x1 - x0), 0]}>
      <mesh geometry={GEO.box} material={mat(STONE)} position={[0, 0.2, 0]} scale={[len, 0.4, 0.35]} />
      <mesh geometry={GEO.box} material={GLASS} position={[0, 0.75, 0]} scale={[len, 0.7, 0.05]} />
      <mesh geometry={GEO.box} material={mat('#3a4450')} position={[0, 1.12, 0]} scale={[len, 0.07, 0.12]} />
    </group>
  )
}

/** Cine: bloque azul oscuro con marquesina luminosa, pantalla y carteles de películas. */
function Cinema() {
  const marquee = glowMat('#ffd27a', 2, { dayGlow: 0.5 })
  const screen = glowMat('#8fd3ff', 1.4, { dayGlow: 0.55 })
  const poster = ['#e0735f', '#f5b544', '#9b7be0', '#5fb7c9']
  return (
    <group position={[0, 0.2, -6.3]}>
      <mesh geometry={GEO.box} material={mat(NAVY)} position={[0, 2.4, 0]} scale={[13, 4.8, 3.6]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat('#10183a')} position={[0, 4.95, 0]} scale={[13.4, 0.3, 4]} />
      {/* marquesina */}
      <mesh geometry={GEO.box} material={marquee} position={[0, 3.2, 1.85]} scale={[7.4, 0.5, 0.2]} />
      <mesh geometry={GEO.box} material={mat('#10183a')} position={[0, 3.2, 1.78]} scale={[7.8, 0.8, 0.2]} />
      {/* pantalla grande sobre la entrada */}
      <mesh geometry={GEO.box} material={screen} position={[0, 4.1, 1.82]} scale={[5.6, 0.75, 0.08]} />
      {/* puertas */}
      <mesh geometry={GEO.box} material={glowMat('#ffcf8f', 1.6, { dayGlow: 0.2 })} position={[0, 1.15, 1.82]} scale={[3.2, 2.1, 0.08]} />
      <mesh geometry={GEO.box} material={mat('#10183a')} position={[0, 1.15, 1.79]} scale={[3.5, 2.4, 0.06]} />
      {/* carteles de películas a los lados */}
      {[-5, -3.7, 3.7, 5].map((x, i) => (
        <mesh key={x} geometry={GEO.box} material={glowMat(poster[i], 1.2, { dayGlow: 0.5 })} position={[x, 1.7, 1.83]} scale={[1, 1.8, 0.06]} />
      ))}
      {/* franja de luces del remate */}
      {Array.from({ length: 12 }, (_, k) => (
        <mesh key={k} geometry={GEO.sphereSmooth} material={marquee} position={[-6 + k * 1.09, 5.2, 2.0]} scale={0.18} />
      ))}
    </group>
  )
}

function Shell() {
  return (
    <>
      {/* losa: piso claro, canto de piedra y faja inferior, igual que el piso 2 */}
      <mesh geometry={GEO.box} material={mat(PALETTE.floor)} position={[0, 0, 0]} scale={[2 * H, 0.5, 2 * H]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, -0.5, 0]} scale={[2 * H + 0.4, 0.6, 2 * H + 0.4]} />
      <mesh geometry={GEO.box} material={mat(PALETTE.floorAlt)} position={[0.5, 0.215, 1]} scale={[2 * H - 3, 0.02, 2 * H - 4]} receiveShadow />
      {/* muros bajos del fondo y del oeste */}
      <mesh geometry={GEO.box} material={mat(PALETTE.wall)} position={[0, 0.85, -H + 0.2]} scale={[2 * H, 1.3, 0.4]} castShadow />
      <mesh geometry={GEO.box} material={mat(PALETTE.wall)} position={[-H + 0.2, 0.85, 0]} scale={[0.4, 1.3, 2 * H]} castShadow />
      {/* barandas hacia la plaza (este y sur) */}
      <Rail x0={H - 0.2} z0={-H + 0.4} x1={H - 0.2} z1={H - 0.4} />
      <Rail x0={-H + 0.4} z0={H - 0.2} x1={H - 0.4} z1={H - 0.2} />
      {/* columnas hasta la losa del piso 2 */}
      {[
        [7.5, 0.5],
        [-2, 4.2],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={GEO.box} material={mat(STONE)} position={[0, -3.5, 0]} scale={[0.9, 6.6, 0.9]} castShadow />
          <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, -6.8, 0]} scale={[1.3, 0.4, 1.3]} />
        </group>
      ))}
      {/* ascensor panorámico en la esquina del frente */}
      <group position={[6.7, 0, 6.7]}>
        <mesh geometry={GEO.box} material={GLASS} position={[0, -3.2, 0]} scale={[2.2, 7.6, 2.2]} />
        <mesh geometry={GEO.box} material={GLASS} position={[0, 2, 0]} scale={[2.2, 3.6, 2.2]} />
        {[
          [-1.1, -1.1],
          [1.1, -1.1],
          [-1.1, 1.1],
          [1.1, 1.1],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={GEO.box} material={mat('#6c7480')} position={[x, -0.9, z]} scale={[0.12, 11.4, 0.12]} />
        ))}
        <mesh geometry={GEO.box} material={glowMat('#8fd3ff', 1.2, { dayGlow: 0.4 })} position={[0, -3.2, 0]} scale={[0.5, 7.4, 0.5]} />
        <mesh geometry={GEO.box} material={mat('#6c7480')} position={[0, 3.9, 0]} scale={[2.5, 0.18, 2.5]} />
      </group>
      <Cinema />
      {/* mesas con sombrilla y jardineras en el patio */}
      <Table x={-0.8} z={5.6} i={0} />
      <Table x={3.2} z={3.8} i={1} />
      <Table x={2.6} z={-1.2} i={3} />
      <Planter x={-1.6} z={-3} s={0.9} />
      <Planter x={H - 1.2} z={3.2} s={0.85} />
      <Planter x={1.5} z={H - 1.2} s={0.85} />
      <Planter x={-3.4} z={H - 1.2} s={0.85} />
      <Lamp x={-2.4} z={-1.8} />
      <Lamp x={3.4} z={H - 1.4} />
      <Lamp x={H - 1.4} z={-4} />
    </>
  )
}

/** Vista previa 3D del piso 3 de entretenimiento. */
export function PisosPropuesta() {
  const night = useIsNight()
  const stores = useCatalog((s) => s.stores)
  const products = useCatalog((s) => s.products)
  const pick = useMemo(() => stores.filter((s) => products.some((p) => p.storeId === s.id)).slice(0, 4), [stores, products])
  const title = useMemo(() => getGlassPill('PISO 3', { dot: '#9b7be0', sub: 'Entretenimiento · propuesta', dark: night }), [night])
  const cinema = useMemo(() => getGlassPill('Cine', { dot: '#e0735f', dark: night }), [night])
  return (
    <group position={ORIGIN}>
      <Batch version="piso3-propuesta">
        <Shell />
      </Batch>
      {P3_SPACES.map((sp, i) => {
        const store = pick[i % Math.max(1, pick.length)] ?? null
        return (
          <SpaceUnit
            key={sp.id}
            space={sp}
            store={store}
            products={store ? products.filter((p) => p.storeId === store.id) : []}
            zoneColor="#9b7be0"
            selected={false}
            pendingClaim={false}
            detail="high"
            interactive={false}
            onSelect={() => undefined}
          />
        )
      })}
      <ScreenLabel label={title} position={[0, 7.4, 1]} pixelHeight={36} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
      <ScreenLabel label={cinema} position={[0, 6.4, -4.2]} pixelHeight={22} minZoomRatio={0.9} priority={LABEL_PRIORITY.section} />
      <pointLight position={[0, 5, -2]} color="#ffd98c" intensity={night ? 30 : 6} distance={20} decay={2} />
    </group>
  )
}
