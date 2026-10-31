import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { P1, LAYOUT, toWorld } from '../config/mall'
import type { ZoneConfig } from '../domain/types'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { LABEL_PRIORITY } from './labels'
import { getGlassPill, getZoneSign } from './labelTexture'
import { GEO, PALETTE, mat, shade } from './materials'
import { dimLabelMat, glowMat, lightPoolMat } from './night'
import { useIsNight } from '../lib/useIsNight'

const { plazaHalf: P, corridorHalfWidth: CW, wingHalfWidth: WW, wingEnd: END } = LAYOUT
const WALL_H = 1.3
const WALL_T = 0.4

/** Jardines en los cuadrantes entre pasillos (dentro de la fortaleza). */
export function Diorama() {
  return (
    <group>
      {[45, 135, 225, 315].map((deg) => {
        const a = (deg * Math.PI) / 180
        const r = 25
        return (
          <mesh
            key={deg}
            geometry={GEO.cylinderLow}
            material={mat(PALETTE.grass)}
            position={[Math.sin(a) * r, 0.03, Math.cos(a) * r]}
            rotation={[0, a, 0]}
            scale={[20, 0.1, 20]}
            receiveShadow
          />
        )
      })}
    </group>
  )
}

function Wing({ zone }: { zone: ZoneConfig }) {
  const len = END - P
  const mid = P + len / 2
  const gateSign = useMemo(() => getZoneSign(zone.id, zone.name.toUpperCase(), zone.color), [zone])
  const wallMat = mat(PALETTE.wall)
  const trimMat = mat(PALETTE.trim)
  return (
    <group rotation={[0, zone.angle, 0]}>
      {/* Piso del pasillo */}
      <mesh geometry={GEO.box} material={mat(PALETTE.floor)} position={[0, 0.1, mid]} scale={[WW * 2, 0.2, len]} receiveShadow />
      {/* Camino central con el color de la zona: ayuda a orientarse */}
      <mesh geometry={GEO.box} material={mat(shade(zone.color, 0.72))} position={[0, 0.205, P + 11.5 / 2 + 0.2]} scale={[CW * 1.1, 0.02, 11.5]} receiveShadow />
      {/* Muros perimetrales bajos (techo abierto) */}
      <mesh geometry={GEO.box} material={wallMat} position={[-WW + WALL_T / 2, WALL_H / 2 + 0.2, mid + 0.3]} scale={[WALL_T, WALL_H, len + 0.6]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={wallMat} position={[WW - WALL_T / 2, WALL_H / 2 + 0.2, mid + 0.3]} scale={[WALL_T, WALL_H, len + 0.6]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={wallMat} position={[0, WALL_H / 2 + 0.2, END + 0.3]} scale={[WW * 2, WALL_H, WALL_T]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={trimMat} position={[-WW + WALL_T / 2, WALL_H + 0.24, mid + 0.3]} scale={[WALL_T + 0.1, 0.08, len + 0.7]} />
      <mesh geometry={GEO.box} material={trimMat} position={[WW - WALL_T / 2, WALL_H + 0.24, mid + 0.3]} scale={[WALL_T + 0.1, 0.08, len + 0.7]} />
      <mesh geometry={GEO.box} material={trimMat} position={[0, WALL_H + 0.24, END + 0.3]} scale={[WW * 2 + 0.1, 0.08, WALL_T + 0.1]} />
      {/* Arco de entrada con señalización de la zona */}
      <group position={[0, 0.2, P + 0.3]}>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.rounded} material={wallMat} position={[s * (CW + 0.2), 1.9, 0]} scale={[0.55, 3.8, 0.55]} castShadow />
        ))}
        <mesh geometry={GEO.rounded} material={mat(zone.color)} position={[0, 3.95, 0]} scale={[CW * 2 + 1.2, 0.7, 0.5]} castShadow />
        {/* cartel colgado al frente y atrás del arco, más alto que la viga para que se lea de lejos */}
        {[1, -1].map((s) => (
          <group key={s} position={[0, 3.95, s * 0.3]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <mesh geometry={GEO.rounded} material={mat(shade(zone.color, -0.25))} position={[0, 0, -0.04]} scale={[1.36 * gateSign.aspect + 0.16, 1.52, 0.08]} />
            <mesh geometry={GEO.plane} material={dimLabelMat(gateSign.texture)} position={[0, 0, 0.01]} scale={[1.36 * gateSign.aspect, 1.36, 1]} />
          </group>
        ))}
      </group>
    </group>
  )
}

const FOUNTAIN_WATER = () => glowMat('#5fb8c4', 0.55)

/** Gotas de los chorros de la fuente: arcos desde la copa hasta el agua (una InstancedMesh). */
const JETS = 10
const DROPS = 5

function Fountain() {
  const water = useRef<THREE.Mesh>(null)
  const drops = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (water.current) water.current.position.y = 0.72 + Math.sin(t * 2) * 0.025
    const m = drops.current
    if (!m) return
    for (let j = 0; j < JETS; j++) {
      const a = (j / JETS) * Math.PI * 2
      for (let k = 0; k < DROPS; k++) {
        const u = (t * 0.7 + k / DROPS + j * 0.13) % 1
        const r = 0.75 + u * 1.25
        o.position.set(Math.sin(a) * r, 2.35 + Math.sin(u * Math.PI) * 0.9 - u * 1.45, Math.cos(a) * r)
        o.scale.setScalar(0.17 * (1 - u * 0.4))
        o.updateMatrix()
        m.setMatrixAt(j * DROPS + k, o.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <group position={[0, 0.2, 0]}>
      <mesh geometry={GEO.cylinder} material={mat(PALETTE.trim)} position={[0, 0.3, 0]} scale={[5.4, 0.6, 5.4]} castShadow receiveShadow />
      <mesh ref={water} geometry={GEO.cylinder} material={FOUNTAIN_WATER()} position={[0, 0.72, 0]} scale={[4.8, 0.2, 4.8]} />
      <instancedMesh ref={drops} args={[GEO.sphere, glowMat('#bdeff3', 0.9, { dayGlow: 0.15 }), JETS * DROPS]} frustumCulled={false} raycast={() => null} />
      {/* de noche: agua turquesa iluminada desde dentro, reflejo simple y bombillos en el borde (fusionados: pocas llamadas) */}
      <Batch version="fuente-luces">
        <mesh geometry={GEO.plane} material={lightPoolMat('#c9fbf6', 0.45)} rotation={[-Math.PI / 2, 0, 0.6]} position={[0.5, 0.85, -0.4]} scale={[2.6, 1.1, 1]} />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2
          return <mesh key={i} geometry={GEO.sphere} material={glowMat('#ffd59a', 2.4, { dayGlow: 0.2 })} position={[Math.sin(a) * 2.62, 0.66, Math.cos(a) * 2.62]} scale={0.1} />
        })}
        <mesh geometry={GEO.cylinder} material={glowMat('#8fe3e6', 1.1)} position={[0, 2.06, 0]} scale={[1.6, 0.04, 1.6]} />
      </Batch>
      <mesh geometry={GEO.cylinder} material={mat(PALETTE.wall)} position={[0, 1.2, 0]} scale={[1, 1.4, 1]} castShadow />
      <mesh geometry={GEO.cylinder} material={mat(PALETTE.trim)} position={[0, 1.95, 0]} scale={[2, 0.18, 2]} castShadow />
      <mesh geometry={GEO.sphereSmooth} material={mat('#9fd6db', { opacity: 0.75 })} position={[0, 2.35, 0]} scale={[0.7, 0.9, 0.7]} />
    </group>
  )
}

function PlazaFloor() {
  return (
    <group>
      <mesh geometry={GEO.box} material={mat(PALETTE.plaza)} position={[0, 0.1, 0]} scale={[P * 2, 0.2, P * 2]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat(PALETTE.floorAlt)} position={[0, 0.21, 0]} scale={[13, 0.02, 13]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#d7c3a0')} position={[0, 0.22, 0]} scale={[8.6, 0.02, 8.6]} receiveShadow />
    </group>
  )
}

/**
 * Cascarón del piso 1 en cruz: pisos, muros, arcos y plaza. Es lo único que se dibuja de este piso
 * cuando se explora el piso 2 (silueta de contexto, pocas llamadas de dibujo gracias a Batch).
 */
export function CrossShell() {
  return (
    <group>
      <Batch version="estructura-p1">
        {P1.zones.map((z) => (
          <Wing key={z.id} zone={z} />
        ))}
        <PlazaFloor />
      </Batch>
      <Fountain />
    </group>
  )
}

/** Cartel principal del piso y carteles de pasillo (solo señalización: no capturan toques). */
export function CrossLabels() {
  const night = useIsNight()
  const title = useMemo(() => getGlassPill(P1.title, { dot: '#13b9ad', sub: P1.subtitle, dark: night }), [night])
  return (
    <>
      <ScreenLabel label={title} position={[0, 5.2, 0]} pixelHeight={35} maxZoomRatio={3} priority={LABEL_PRIORITY.floorSign} />
      {P1.zones.map((z) => (
        <CorridorSign key={z.id} zone={z} />
      ))}
    </>
  )
}

/** Cartel flotante de pasillo: PASILLO A / Moda… Solo señalización (los chips de zona navegan). */
export function CorridorSign({ zone }: { zone: ZoneConfig }) {
  const [x, zz] = toWorld([0, 17], zone.angle)
  const label = getGlassPill(zone.name, { dot: zone.color, sub: `Pasillo ${zone.id}`, dark: useIsNight() })
  // Solo de lejos: de cerca se lee el cartel del arco y no se duplica.
  return <ScreenLabel label={label} position={[x, 7, zz]} pixelHeight={35} maxZoomRatio={1.45} priority={LABEL_PRIORITY.corridor} />
}
