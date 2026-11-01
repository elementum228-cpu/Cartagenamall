import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ISLAND, insideSpace } from '../config/mall'
import { useIsNight } from '../lib/useIsNight'
import { AirplaneModel } from './Airport'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, Garita, STONE, STONE_DARK } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat, nightVolumeMat } from './night'
import { Person } from './Person'

// Isla de los Descuentos: un castillo-isla de una sola planta. Murallas con almenas y garitas en las
// esquinas, puerta en arco hacia la pista (lado +x), plaza con fuente, locales outlet de colores
// repartidos (los pone Scene, como cualquier espacio), palmeras y faroles en los paseos, focos que
// barren el cielo de noche y un globo aerostático con el %.

const C = { x: ISLAND.x, z: ISLAND.z }
const HALF = ISLAND.half
const WT = 1.6
const WH = 3
const PINK = '#e85a8a'
const IRON = '#2f3437'
const GATE_W = 4.2
/** Pista de la isla (eje x, de z0 a z1), frente a la puerta. */
const STRIP = { x: C.x + HALF + 9, z0: C.z - 15, z1: C.z + 15, w: 4 }

function Palm({ x, z, h, seed }: { x: number; z: number; h: number; seed: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(PALETTE.trunk)} position={[0, h / 2, 0]} rotation={[0.1, seed, 0]} scale={[0.3, h, 0.3]} castShadow />
      {Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * Math.PI * 2 + seed
        return <mesh key={k} geometry={GEO.box} material={mat(PALETTE.leafDark)} position={[Math.sin(a) * 0.8, h + 0.05, Math.cos(a) * 0.8]} rotation={[0.35, a, 0]} scale={[0.5, 0.08, 1.9]} castShadow />
      })}
    </group>
  )
}

/** Tramo de muralla de (x0,z0) a (x1,z1), con almenas y cordón. */
function Wall({ x0, z0, x1, z1 }: { x0: number; z0: number; x1: number; z1: number }) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const rot = Math.atan2(x1 - x0, z1 - z0)
  const n = Math.floor(len / 1.6)
  return (
    <group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation={[0, rot, 0]}>
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, (WH - 1.4) / 2, 0]} scale={[WT, WH + 1.4, len]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, -0.7, 0]} scale={[WT + 0.7, 1.4, len + 0.4]} />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, WH - 0.35, 0]} scale={[WT + 0.12, 0.14, len]} />
      {Array.from({ length: n }, (_, k) => (
        <mesh key={k} geometry={GEO.box} material={mat(STONE[1])} position={[0, WH + 0.3, (k - (n - 1) / 2) * 1.6]} scale={[0.55, 0.6, 0.9]} castShadow />
      ))}
    </group>
  )
}

/** Arena, murallas, garitas, puerta, plaza con fuente, palmeras, faroles, pista y muelle. */
function Ground() {
  const H = HALF
  const palms = useMemo(() => {
    const out: { x: number; z: number; h: number; seed: number }[] = []
    const spots: [number, number][] = [
      [-5, -14.5], [5, -15.8], [-15.5, -6], [-15.5, 6], [-5, 15.8], [5, 15.8],
      [-16, -16], [-16, 16], [16, -16], [16, 16], [-8.5, 0], [0, -8.5], [0, 8.5], [10.5, -1.8], [10.5, 1.8],
    ]
    spots.forEach(([dx, dz], i) => {
      const x = C.x + dx
      const z = C.z + dz
      if (insideSpace(x, z, 1.8)) return
      if (dx > 3 && Math.abs(dz) < 2.4) return // camino de la puerta
      out.push({ x, z, h: 2.8 + (i % 3) * 0.6, seed: i * 1.7 })
    })
    return out
  }, [])
  const lamps = useMemo(
    () =>
      ([
        [4.5, -2.6], [4.5, 2.6], [-4, 0], [0, -4], [0, 4], [-11, -11.8], [-11.8, 11], [12, -16.5], [12, 16.5],
      ] as [number, number][])
        .map(([dx, dz]) => [C.x + dx, C.z + dz] as [number, number])
        .filter(([x, z]) => !insideSpace(x, z, 0.3)),
    [],
  )
  const gx = C.x + H
  return (
    <group>
      {/* arena alrededor del castillo y rocas en la orilla */}
      <mesh geometry={GEO.cylinderLow} material={mat('#f1dfb5')} position={[C.x, -0.7, C.z]} rotation={[0, Math.PI / 8, 0]} scale={[2 * (H + 6), 0.6, 2 * (H + 6)]} receiveShadow />
      {[
        [-H - 3, -H + 4, 1.4], [-H + 6, -H - 3.5, 1.1], [H + 2.5, -H - 2, 1.2], [-H - 2.5, H - 3, 1], [H - 4, H + 3, 1.3],
      ].map(([dx, dz, s]) => (
        <mesh key={`${dx}${dz}`} geometry={GEO.sphere} material={mat('#9c9184')} position={[C.x + dx, -0.4, C.z + dz]} scale={[s * 1.6, s, s * 1.3]} />
      ))}
      {/* piso del castillo y plaza */}
      <mesh geometry={GEO.box} material={mat('#e9dcc2')} position={[C.x, -0.3, C.z]} scale={[2 * H, 0.6, 2 * H]} receiveShadow />
      <mesh geometry={GEO.box} material={mat('#efe6d4')} position={[C.x, 0.02, C.z]} scale={[2 * H - 2, 0.04, 2 * H - 2]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#e6d3ad')} position={[C.x, 0.05, C.z]} scale={[8.6, 0.04, 8.6]} receiveShadow />
      <mesh geometry={GEO.box} material={mat('#e6d3ad')} position={[C.x + (H + 4.2) / 2, 0.05, C.z]} scale={[H - 4.2, 0.04, 3]} receiveShadow />
      {/* fuente en el centro */}
      <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[C.x, 0.35, C.z]} scale={[5.2, 0.6, 5.2]} castShadow />
      <mesh geometry={GEO.cylinder} material={glowMat('#5fd0e0', 0.9, { dayGlow: 0.25 })} position={[C.x, 0.62, C.z]} scale={[4.6, 0.1, 4.6]} />
      <mesh geometry={GEO.cylinder} material={mat(STONE[1])} position={[C.x, 1.1, C.z]} scale={[0.6, 1.4, 0.6]} />
      <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[C.x, 1.85, C.z]} scale={[2, 0.25, 2]} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#bff6ff', 1.6, { dayGlow: 0.4 })} position={[C.x, 2.3, C.z]} scale={[0.7, 0.9, 0.7]} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#7fe3f0', 1)} rotation={[-Math.PI / 2, 0, 0]} position={[C.x, 0.08, C.z]} scale={[10, 10, 1]} />
      {/* murallas: la del lado +x se abre para la puerta */}
      <Wall x0={C.x - H} z0={C.z - H} x1={C.x + H} z1={C.z - H} />
      <Wall x0={C.x - H} z0={C.z + H} x1={C.x + H} z1={C.z + H} />
      <Wall x0={C.x - H} z0={C.z - H} x1={C.x - H} z1={C.z + H} />
      <Wall x0={gx} z0={C.z - H} x1={gx} z1={C.z - GATE_W / 2 - 0.6} />
      <Wall x0={gx} z0={C.z + GATE_W / 2 + 0.6} x1={gx} z1={C.z + H} />
      {/* garitas en las esquinas y a los lados de la puerta */}
      {[
        [C.x - H, C.z - H], [C.x + H, C.z - H], [C.x - H, C.z + H], [C.x + H, C.z + H],
      ].map(([x, z]) => (
        <group key={`${x}${z}`}>
          <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[x, (WH - 1.4) / 2, z]} scale={[4, WH + 1.4, 4]} castShadow />
          <Garita x={x} z={z} y={WH} />
        </group>
      ))}
      {/* puerta en arco con escalinata hacia el muelle */}
      <group position={[gx, 0, C.z]} rotation={[0, Math.PI / 2, 0]}>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[s * (GATE_W / 2 + 1.2), (WH + 1.2 - 1.4) / 2, 0]} scale={[2.6, WH + 2.6, 2.6]} castShadow />
            <Garita x={s * (GATE_W / 2 + 1.2)} z={0} y={WH + 1.2} />
          </group>
        ))}
        <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, WH + 0.25, 0]} scale={[GATE_W + 0.6, 1.3, WT + 0.4]} castShadow />
        <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, WH + 0.95, 0]} scale={[GATE_W + 0.8, 0.14, WT + 0.5]} />
        <mesh geometry={GEO.halfDisc} material={mat(CORDON)} position={[0, WH - 0.5, WT / 2 + 0.22]} rotation={[Math.PI / 2, 0, 0]} scale={[GATE_W / 2, 0.02, GATE_W / 2 - 0.4]} />
        {/* puertas abiertas (verdes) y luz del pasaje */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.box} material={mat('#2f6b4f')} position={[s * (GATE_W / 2 - 0.15), 1.4, WT / 2 + 0.5]} rotation={[0, s * 1.2, 0]} scale={[1.6, 2.8, 0.12]} />
        ))}
        <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.9)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 1.6]} scale={[5, 4, 1]} />
        {/* escalinata */}
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} geometry={GEO.box} material={mat(STONE[k % 2 ? 1 : 2])} position={[0, -0.12 - k * 0.18, WT / 2 + 0.6 + k * 0.6]} scale={[GATE_W + 1.6 - k * 0.2, 0.18, 0.6]} receiveShadow />
        ))}
      </group>
      {/* camino de piedra hasta la pista */}
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[(gx + 3.2 + STRIP.x - STRIP.w / 2 - 1.5) / 2, -0.62, C.z]} scale={[STRIP.x - STRIP.w / 2 - 1.5 - gx - 3.2, 0.5, 3.6]} receiveShadow />
      {/* faroles y palmeras de los paseos */}
      {lamps.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.5, 0]} scale={[0.1, 3, 0.1]} />
          <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.5 })} position={[0, 3.1, 0]} scale={0.4} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} scale={[4, 4, 1]} />
        </group>
      ))}
      {palms.map((p) => (
        <Palm key={`${p.x}${p.z}`} {...p} />
      ))}
      {/* pista de aterrizaje sobre un muelle de piedra */}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[STRIP.x, -0.6, C.z]} scale={[STRIP.w + 4, 1.6, STRIP.z1 - STRIP.z0 + 2]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[STRIP.x, 0.17, C.z]} scale={[STRIP.w + 4.1, 0.08, STRIP.z1 - STRIP.z0 + 2.1]} />
      <mesh geometry={GEO.box} material={mat('#4a525b')} position={[STRIP.x + 0.6, 0.22, C.z]} scale={[STRIP.w, 0.04, STRIP.z1 - STRIP.z0]} receiveShadow />
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={mat('#f4f1ea')} position={[STRIP.x + 0.6, 0.25, STRIP.z0 + 2.5 + i * 3.1]} scale={[0.14, 0.01, 1.3]} />
      ))}
      {[-1, 1].flatMap((s) =>
        Array.from({ length: 9 }, (_, i) => (
          <mesh key={`${s}${i}`} geometry={GEO.sphere} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.35 })} position={[STRIP.x + 0.6 + s * (STRIP.w / 2 + 0.25), 0.32, STRIP.z0 + (i * (STRIP.z1 - STRIP.z0)) / 8]} scale={0.2} />
        )),
      )}
      {/* focos de las garitas: haces de luz hacia el cielo (de noche) */}
      {[
        [C.x - H, C.z - H, -0.35, 0.3], [C.x + H, C.z - H, 0.3, 0.3], [C.x - H, C.z + H, -0.3, -0.35],
      ].map(([x, z, rx, rz]) => (
        <mesh key={`${x}${z}`} geometry={GEO.cone} material={nightVolumeMat('#fff1c9', 0.22)} position={[x, WH + 9, z]} rotation={[rx, 0, rz]} scale={[3.2, 16, 3.2]} />
      ))}
    </group>
  )
}

/** Gente paseando por la plaza, alrededor de la fuente. */
function Strollers({ reduceMotion }: { reduceMotion: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const walkers = useMemo(
    () =>
      ['#e07a5f', '#3d7ea6', '#f2cc8f', '#2a9d8f', '#9b5de5', '#f15bb5', '#81b29a'].map((c, i) => ({
        c,
        r: 9.4 + (i % 2) * 0.6,
        speed: (0.045 + (i % 3) * 0.012) * (i % 2 ? 1 : -1),
        phase: (i / 7) * Math.PI * 2,
      })),
    [],
  )
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    walkers.forEach((w, i) => {
      const g = refs.current[i]
      if (!g) return
      const a = w.phase + t * w.speed
      g.position.set(C.x + Math.sin(a) * w.r, Math.abs(Math.sin(t * 6 + i)) * 0.03, C.z + Math.cos(a) * w.r)
      g.rotation.y = a + (w.speed > 0 ? Math.PI / 2 : -Math.PI / 2)
    })
  })
  return (
    <group>
      {walkers.map((w, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Person color={w.c} skin={['#e5b48f', '#8d5a3b', '#c58c64'][i % 3]} />
        </group>
      ))}
    </group>
  )
}

/** Globo aerostático a rayas con el %, que flota sobre la isla. */
function Balloon({ reduceMotion }: { reduceMotion: boolean }) {
  const g = useRef<THREE.Group>(null)
  const pct = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')!
    x.fillStyle = '#ffffff'
    x.font = '900 96px system-ui, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText('%', 64, 70)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })
  }, [])
  useFrame(({ clock }) => {
    if (!g.current || reduceMotion) return
    const t = clock.elapsedTime
    g.current.position.y = 17 + Math.sin(t * 0.5) * 0.8
    g.current.rotation.y = Math.sin(t * 0.2) * 0.3
  })
  return (
    <group ref={g} position={[C.x + HALF - 4, 17, C.z - HALF - 2]}>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} geometry={GEO.sphereSmooth} material={mat(k % 2 ? '#ffffff' : PINK, { rough: 0.6 })} rotation={[0, (k * Math.PI) / 6, 0]} scale={[3.6 - k * 0.02, 4.2, 0.9 + k * 0.5]} />
      ))}
      <mesh geometry={GEO.plane} material={pct} position={[0.7, 0.2, 1.75]} rotation={[0, Math.PI / 4, 0]} scale={[1.8, 1.8, 1]} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={GEO.box} material={mat('#6b4a2f')} position={[sx * 0.55, -2.6, sz * 0.55]} scale={[0.04, 1.6, 0.04]} />),
      )}
      <mesh geometry={GEO.box} material={mat('#8a5a3a')} position={[0, -3.6, 0]} scale={[1.3, 0.8, 1.3]} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffb347', 2.4, { dayGlow: 0.3 })} position={[0, -2.2, 0]} scale={0.35} />
    </group>
  )
}

export function Island({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const label = useMemo(() => getGlassPill('Isla de los Descuentos', { dot: PINK, sub: 'Outlet · Ofertas · Variedad', dark: night }), [night])
  return (
    <group>
      <Batch version="isla-castillo">
        <Ground />
        {/* avión que te trajo, junto a la pista */}
        <group position={[STRIP.x - 3.2, 0.2, C.z - 5]}>
          <AirplaneModel />
        </group>
      </Batch>
      <Strollers reduceMotion={reduceMotion} />
      <Balloon reduceMotion={reduceMotion} />
      <ScreenLabel label={label} position={[C.x - 2, 11, C.z - 2]} pixelHeight={38} maxZoomRatio={2.6} priority={LABEL_PRIORITY.floorSign + 5} />
    </group>
  )
}
