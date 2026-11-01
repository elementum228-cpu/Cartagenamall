import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ISLAND, insideSpace } from '../config/mall'
import { useIsNight } from '../lib/useIsNight'
import { AirplaneModel } from './Airport'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, STONE, STONE_DARK } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { Person } from './Person'

// Isla Descuento: isla de arena de una sola planta, lejos en el mar. Plaza circular con un tótem
// del %, anillo de locales (los pone Scene, como cualquier espacio), palmeras solo por fuera, una
// pista de aterrizaje con el avión, un arco de bienvenida y gente paseando.

const C = { x: ISLAND.x, z: ISLAND.z }
const R = ISLAND.r
const AMBER = '#f59e0b'
const IRON = '#2f3437'
/** Pista de la isla (eje x, de z0 a z1), a la derecha de la isla. */
const STRIP = { x: C.x + R + 5, z0: C.z - 15, z1: C.z + 15, w: 4 }

function textPlane(lines: { text: string; font: string; color: string; y: number }[], w: number, h: number, bg: string) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.beginPath()
  g.roundRect(0, 0, w, h, Math.min(w, h) * 0.18)
  g.fill()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const l of lines) {
    g.fillStyle = l.color
    g.font = l.font
    g.fillText(l.text, w / 2, l.y)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
}

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

/** Arena, playa, plaza, tótem, palmeras, faroles, pista y arco de bienvenida (todo estático). */
function Ground() {
  const totemSign = useMemo(
    () =>
      textPlane(
        [
          { text: '%', font: '900 210px system-ui, sans-serif', color: '#ffffff', y: 150 },
          { text: 'ISLA DESCUENTO', font: '800 54px system-ui, sans-serif', color: '#fff4d6', y: 300 },
        ],
        512,
        360,
        AMBER,
      ),
    [],
  )
  const archSign = useMemo(
    () =>
      textPlane(
        [
          { text: '¡Bienvenido a', font: '600 64px system-ui, sans-serif', color: '#9fe3dc', y: 70 },
          { text: 'ISLA DESCUENTO!', font: '800 96px system-ui, sans-serif', color: '#ffffff', y: 160 },
        ],
        1024,
        230,
        '#16325c',
      ),
    [],
  )
  // palmeras solo por fuera del anillo de locales (nunca encima de un local)
  const palms = useMemo(() => {
    const out: { x: number; z: number; h: number; seed: number }[] = []
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + 0.13
      const r = R - 3.2 - (i % 3) * 1.1
      const x = C.x + Math.sin(a) * r
      const z = C.z + Math.cos(a) * r
      if (x > C.x + R - 8 && Math.abs(z - C.z) < 4) continue // camino a la pista
      if (insideSpace(x, z, 1.8)) continue
      out.push({ x, z, h: 3 + (i % 3) * 0.6, seed: i * 1.7 })
    }
    return out
  }, [])
  const lamps = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return [C.x + Math.sin(a) * 9.6, C.z + Math.cos(a) * 9.6] as [number, number]
      }).filter(([x, z]) => !insideSpace(x, z, 0.3)),
    [],
  )
  return (
    <group>
      {/* playa y arena */}
      <mesh geometry={GEO.cylinder} material={mat('#f1dfb5')} position={[C.x, -0.62, C.z]} scale={[2 * (R + 4), 0.6, 2 * (R + 3)]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat(PALETTE.sand)} position={[C.x, -0.3, C.z]} scale={[2 * R, 0.6, 2 * R]} receiveShadow />
      {/* plaza: piso claro, anillo de paso y centro con mosaico */}
      <mesh geometry={GEO.cylinder} material={mat('#efe6d4')} position={[C.x, 0.01, C.z]} scale={[2 * (R - 6.5), 0.02, 2 * (R - 6.5)]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#e6d3ad')} position={[C.x, 0.025, C.z]} scale={[9.6, 0.02, 9.6]} receiveShadow />
      <mesh geometry={GEO.torus} material={mat(AMBER)} position={[C.x, 0.04, C.z]} rotation={[Math.PI / 2, 0, 0]} scale={[4.6, 4.6, 0.6]} />
      {/* tótem del % en el centro */}
      <mesh geometry={GEO.cylinder} material={mat(STONE_DARK)} position={[C.x, 0.3, C.z]} scale={[2.6, 0.6, 2.6]} />
      <mesh geometry={GEO.box} material={mat('#16325c')} position={[C.x, 2.4, C.z]} scale={[0.5, 4, 0.5]} castShadow />
      {[0, Math.PI / 2].map((r) => (
        <group key={r} rotation={[0, Math.PI / 4 + r, 0]} position={[C.x, 4.2, C.z]}>
          <mesh geometry={GEO.plane} material={totemSign} position={[0, 0, 0.27]} scale={[2.9, 2.04, 1]} />
          <mesh geometry={GEO.plane} material={totemSign} position={[0, 0, -0.27]} rotation={[0, Math.PI, 0]} scale={[2.9, 2.04, 1]} />
        </group>
      ))}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffd27a', 1)} rotation={[-Math.PI / 2, 0, 0]} position={[C.x, 0.06, C.z]} scale={[9, 9, 1]} />
      {/* faroles del anillo de paso */}
      {lamps.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.5, 0]} scale={[0.1, 3, 0.1]} />
          <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.5 })} position={[0, 3.1, 0]} scale={0.4} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[4, 4, 1]} />
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
      {/* camino de la pista a la plaza y arco de bienvenida */}
      <mesh geometry={GEO.box} material={mat('#e6d3ad')} position={[C.x + R - 4.5, 0.03, C.z]} scale={[11, 0.04, 3.2]} receiveShadow />
      <group position={[C.x + R - 3, 0, C.z]} rotation={[0, Math.PI / 2, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.box} material={mat(STONE[2])} position={[s * 2.4, 1.8, 0]} scale={[0.7, 3.6, 0.7]} castShadow />
        ))}
        <mesh geometry={GEO.box} material={mat('#16325c')} position={[0, 4.05, 0]} scale={[5.6, 1.3, 0.4]} castShadow />
        <mesh geometry={GEO.plane} material={archSign} position={[0, 4.05, 0.21]} scale={[5.4, 1.21, 1]} />
        <mesh geometry={GEO.plane} material={archSign} position={[0, 4.05, -0.21]} rotation={[0, Math.PI, 0]} scale={[5.4, 1.21, 1]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.sphereSmooth} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.5 })} position={[s * 2.4, 3.8, 0.45]} scale={0.25} />
        ))}
      </group>
    </group>
  )
}

/** Gente paseando por el anillo de la plaza. */
function Strollers({ reduceMotion }: { reduceMotion: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const walkers = useMemo(
    () =>
      ['#e07a5f', '#3d7ea6', '#f2cc8f', '#2a9d8f', '#9b5de5', '#f15bb5'].map((c, i) => ({
        c,
        r: 9.2 + (i % 2) * 0.8,
        speed: (0.05 + (i % 3) * 0.012) * (i % 2 ? 1 : -1),
        phase: (i / 6) * Math.PI * 2,
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

export function Island({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const label = useMemo(() => getGlassPill('Isla Descuento', { dot: AMBER, sub: 'Locales disponibles · Ofertas', dark: night }), [night])
  return (
    <group>
      <Batch version="isla">
        <Ground />
        {/* avión que te trajo, junto a la pista */}
        <group position={[STRIP.x - 2.8, 0.2, C.z - 4]}>
          <AirplaneModel />
        </group>
      </Batch>
      <Strollers reduceMotion={reduceMotion} />
      <ScreenLabel label={label} position={[C.x, 8.6, C.z]} pixelHeight={32} maxZoomRatio={2.4} priority={LABEL_PRIORITY.corridorOverview} />
    </group>
  )
}
