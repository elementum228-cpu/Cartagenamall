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
const MEDAL_GOLD = layer('#d9a441', 6, 0.25)
const MEDAL_BLACK = layer('#17171f', 7, 0.25)

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
      {/* incrustación de mármol negro con filete dorado, y medallón central */}
      <mesh geometry={GEO.box} material={BLACK_INLAY} position={[CX, Y + 0.075, CZ]} scale={[W - 1.2, 0.02, D - 1.2]} />
      <mesh geometry={GEO.box} material={marbleInlay} position={[CX, Y + 0.09, CZ]} scale={[W - 1.5, 0.02, D - 1.5]} />
      <mesh geometry={GEO.cylinder} material={MEDAL_GOLD} position={[-47.2, Y + 0.15, 0]} scale={[3.4, 0.03, 3.4]} />
      <mesh geometry={GEO.cylinder} material={MEDAL_BLACK} position={[-47.2, Y + 0.17, 0]} scale={[2.9, 0.03, 2.9]} />
      <mesh geometry={GEO.cylinder} material={MEDAL_GOLD} position={[-47.2, Y + 0.19, 0]} scale={[1.5, 0.03, 1.5]} />
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
const ROUTE: [number, number][] = [
  [-16, 0.5],
  [-19.5, 2],
  [-20.5, 6.6],
  [-29.4, 6.6],
  [-29.4, 0],
  [-34, 0],
  [-50, 0],
]
const SEG = ROUTE.slice(1).map((q, i) => {
  const p = ROUTE[i]
  return { p, dx: q[0] - p[0], dz: q[1] - p[1], len: Math.hypot(q[0] - p[0], q[1] - p[1]) }
})
const ROUTE_LEN = SEG.reduce((a, s) => a + s.len, 0)
const WALK_SPEED = 1.1

/** Visitantes que recorren esa ruta de ida y vuelta, a paso de caminata normal. */
function Walkers() {
  const refs = useRef<(THREE.Group | null)[]>([])
  const people = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ phase: i / 6, lane: (i % 3 - 1) * 0.8 })), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    let nearest = 99
    people.forEach((p, i) => {
      const el = refs.current[i]
      if (!el) return
      const u = (((t * WALK_SPEED) / (2 * ROUTE_LEN) + p.phase) % 1 + 1) % 1
      const going = u < 0.5
      let d = (going ? u * 2 : (1 - u) * 2) * ROUTE_LEN
      let seg = SEG[SEG.length - 1]
      for (const sg of SEG) {
        if (d <= sg.len) {
          seg = sg
          break
        }
        d -= sg.len
      }
      const f = Math.min(1, d / seg.len)
      const x = seg.p[0] + seg.dx * f
      let z = seg.p[1] + seg.dz * f
      if (x < -33.5) z += p.lane
      if (Math.abs(z) < 3.2) nearest = Math.min(nearest, Math.abs(x - DOOR_X))
      el.position.set(x, 0.2 + Math.abs(Math.sin(t * 4 + i * 2)) * 0.03, z)
      const sign = going ? 1 : -1
      el.rotation.y = Math.atan2(seg.dx * sign, seg.dz * sign)
    })
    door.near = nearest
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

export function JewelryZone() {
  const night = useIsNight()
  const title = useMemo(() => getGlassPill('Joyería', { dot: GOLD, sub: 'Zona exclusiva', dark: night }), [night])
  return (
    <group>
      <Batch version="joyeria-zona-2">
        <Shell />
      </Batch>
      {/* dos vigilantes que patrullan la alfombra */}
      <Patrol z={-2.3} phase={0} />
      <Patrol z={2.3} phase={1} />
      <Walkers />
      <AutoDoors />
      <SecurityCam x={-38.5} z={-5.2} base={0} phase={0} />
      <SecurityCam x={-46.5} z={-5.2} base={0} phase={2} />
      <SecurityCam x={-51.8} z={0} base={Math.PI / 2} phase={4} />
      <ScreenLabel label={title} position={[CX, 6.2, 0]} pixelHeight={30} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
      {[-37, -44, -50].map((x) => (
        <pointLight key={x} position={[x, 3.4, 0]} color="#ffd98c" intensity={night ? 26 : 7} distance={14} decay={2} />
      ))}
    </group>
  )
}
