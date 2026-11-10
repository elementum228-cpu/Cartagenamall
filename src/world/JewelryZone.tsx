import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, STONE, STONE_DARK } from './Fortress'
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

function Shell() {
  const marble = useMarble()
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
      <mesh geometry={GEO.box} material={marble} position={[-31.2, 0.21, 0]} scale={[4.6, 0.04, 5.4]} receiveShadow />
      <mesh geometry={GEO.box} material={mat(RED, { rough: 0.95 })} position={[-31.2, 0.24, 0]} scale={[4.6, 0.03, 2.8]} />
      {/* mármol, borde dorado y alfombra roja hasta el fondo */}
      <mesh geometry={GEO.box} material={marble} position={[CX, Y + 0.02, CZ]} scale={[W, 0.06, D]} receiveShadow />
      {[
        [CX, NZ + 0.3, W, 0.3],
        [CX, SZ - 0.3, W, 0.3],
        [X0 + 0.3, CZ, 0.3, D],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[x, Y + 0.06, z]} scale={[w, 0.03, d]} />
      ))}
      <mesh geometry={GEO.box} material={mat(RED, { rough: 0.95 })} position={[CX + 0.2, Y + 0.08, 0]} scale={[W - 0.6, 0.04, 2.8]} receiveShadow />
      {[-1.45, 1.45].map((z) => (
        <mesh key={z} geometry={GEO.box} material={mat(GOLD)} position={[CX + 0.2, Y + 0.1, z]} scale={[W - 0.6, 0.03, 0.07]} />
      ))}
      {/* paredes: fondo y norte altas con cornisa dorada; el lado de la cámara es una baranda de vidrio */}
      {[
        [X0 - 0.15, CZ, 0.3, D + 0.6, WH],
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
      <mesh geometry={GEO.box} material={mat('#10183a')} position={[X0 + 0.06, 2.2, CZ]} scale={[0.1, 1.5, 6.4]} />
      <mesh geometry={GEO.box} material={warm} position={[X0 + 0.14, 2.2, CZ]} scale={[0.05, 1.1, 5.6]} />
      {/* columnas doradas con luz a lo largo del pasillo */}
      {[-39, -44, -49].flatMap((x) => [NZ + 0.9, SZ - 0.9].map((z) => ({ x, z }))).map(({ x, z }) => (
        <group key={`${x}${z}`}>
          <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[x, 1.7, z]} scale={[0.4, 3.4, 0.4]} castShadow />
          <mesh geometry={GEO.sphereSmooth} material={warm} position={[x, 3.5, z]} scale={0.36} />
        </group>
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

const COATS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f', '#6b5b95']

/** Visitantes que bajan por el pasillo de Lifestyle, cruzan la puerta de la muralla, recorren la alfombra y regresan. */
function Walkers() {
  const refs = useRef<(THREE.Group | null)[]>([])
  const people = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ phase: i / 6, lane: (i % 3 - 1) * 0.9, speed: 0.0165 + (i % 3) * 0.002 })), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    people.forEach((p, i) => {
      const el = refs.current[i]
      if (!el) return
      const u = (((t * p.speed + p.phase) % 1) + 1) % 1
      const going = u < 0.5
      const f = going ? u * 2 : (1 - u) * 2
      const x = -16 - f * 33
      el.position.set(x, 0.2 + Math.abs(Math.sin(t * 4 + i * 2)) * 0.03, p.lane + (going ? 0.4 : -0.4))
      el.rotation.y = going ? Math.PI / 2 : -Math.PI / 2
    })
  })
  return (
    <>
      {people.map((_, i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)} scale={1} userData={{ dynamic: true }}>
          <mesh geometry={GEO.capsule} material={mat(COATS[i % COATS.length])} position={[0, 0.43, 0]} castShadow />
          <mesh geometry={GEO.sphereSmooth} material={mat(i % 2 ? '#c58c64' : '#8d5a3b')} position={[0, 0.95, 0]} scale={0.36} castShadow />
        </group>
      ))}
    </>
  )
}

export function JewelryZone() {
  const night = useIsNight()
  const title = useMemo(() => getGlassPill('Joyería', { dot: GOLD, sub: 'Zona exclusiva · propuesta', dark: night }), [night])
  return (
    <group>
      <Batch version="joyeria-zona-2">
        <Shell />
      </Batch>
      {/* dos vigilantes que patrullan la alfombra */}
      <Patrol z={-2.3} phase={0} />
      <Patrol z={2.3} phase={1} />
      <Walkers />
      <ScreenLabel label={title} position={[CX, 6.2, 0]} pixelHeight={30} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
      {[-37, -44, -50].map((x) => (
        <pointLight key={x} position={[x, 3.4, 0]} color="#ffd98c" intensity={night ? 26 : 7} distance={14} decay={2} />
      ))}
    </group>
  )
}
