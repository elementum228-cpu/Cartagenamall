import { useMemo } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, STONE, STONE_DARK } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, mat } from './materials'

// Zona de joyería (propuesta): plataforma de mármol al otro lado de una puerta en la muralla oeste, con alfombra roja,
// cordones, dos vigilantes y cuatro locales pequeños (los reclamables van aparte, ver JEWELRY_SPACES).
const CX = -37.8
const CZ = -0.5
const W = 11
const D = 15
const Y = 0.12
const GOLD = '#d9a441'
const RED = '#b9242b'
const WALL_X = -32.1

function useMarble() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 ? '#f3eee2' : '#d9d0bb'
        g.fillRect(i * 64, j * 64, 64, 64)
        g.strokeStyle = 'rgba(120,105,80,0.25)'
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

function Guard({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, Y, z]} rotation={[0, rot, 0]} scale={1.75}>
      <mesh geometry={GEO.capsule} material={mat('#1d2b4a')} position={[0, 0.43, 0]} castShadow />
      <mesh geometry={GEO.sphereSmooth} material={mat('#e0b08a')} position={[0, 0.95, 0]} scale={0.36} castShadow />
      <mesh geometry={GEO.cylinder} material={mat('#10172b')} position={[0, 1.15, 0]} scale={[0.3, 0.1, 0.3]} />
    </group>
  )
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

function Shell() {
  const marble = useMarble()
  const ropes = [-1, 1].flatMap((side) => [0, 1, 2, 3, 4].map((i) => ({ x: -34.4 - i * 1.9, z: side * 1.9, side, i })))
  return (
    <>
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[CX, (Y - 1.5) / 2, CZ]} scale={[W + 1, Y + 1.5, D + 1]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[CX, -0.9, CZ]} scale={[W + 1.6, 1.2, D + 1.6]} />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[CX, Y - 0.04, CZ]} scale={[W + 1.1, 0.12, D + 1.1]} />
      <mesh geometry={GEO.box} material={marble} position={[CX, Y + 0.02, CZ]} scale={[W, 0.06, D]} receiveShadow />
      {[
        [CX, CZ - D / 2 + 0.2, W, 0.3],
        [CX, CZ + D / 2 - 0.2, W, 0.3],
        [CX - W / 2 + 0.2, CZ, 0.3, D],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[x, Y + 0.06, z]} scale={[w, 0.03, d]} />
      ))}
      {/* alfombra roja desde la puerta */}
      <mesh geometry={GEO.box} material={mat(RED, { rough: 0.95 })} position={[-37.4, Y + 0.08, 0]} scale={[10.4, 0.04, 2.8]} receiveShadow />
      {/* puerta en la muralla: arco dorado con luz */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[WALL_X + 0.6, 2.2, s * 2.9]} scale={[1.2, 4.6, 0.7]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[WALL_X + 0.6, 4.7, 0]} scale={[1.3, 0.55, 6.5]} castShadow />
      <mesh geometry={GEO.box} material={mat('#7a1620')} position={[WALL_X - 0.05, 4.7, 0]} scale={[0.06, 0.32, 5.6]} />
      {/* cordones rojos y postes dorados */}
      {ropes.map((r) => (
        <group key={`${r.side}${r.i}`}>
          <Post x={r.x} z={r.z} />
          {r.i < 4 && <mesh geometry={GEO.box} material={mat(RED)} position={[r.x - 0.95, Y + 0.72, r.z]} scale={[1.9, 0.07, 0.07]} />}
        </group>
      ))}
      {/* vigilantes a los lados de la entrada */}
      <Guard x={-33.4} z={-2.3} rot={-Math.PI / 2} />
      <Guard x={-33.4} z={2.3} rot={-Math.PI / 2} />
    </>
  )
}

export function JewelryZone() {
  const night = useIsNight()
  const title = useMemo(() => getGlassPill('Joyería', { dot: GOLD, sub: 'Zona exclusiva · propuesta', dark: night }), [night])
  return (
    <group>
      <Batch version="joyeria-zona">
        <Shell />
      </Batch>
      <ScreenLabel label={title} position={[-38, 5.4, 0]} pixelHeight={30} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
      <pointLight position={[-37.5, 4.2, 0]} color="#ffd98c" intensity={night ? 30 : 8} distance={18} decay={2} />
    </group>
  )
}
