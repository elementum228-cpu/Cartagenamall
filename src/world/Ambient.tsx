import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { P1, LAYOUT, toWorld } from '../config/mall'
import { GEO, mat } from './materials'
import { glowMat, nightState } from './night'

// Ambiente ligero: guirnaldas en los pasillos, halos de faroles, barquitos y aves.
// Todo con InstancedMesh o pocas mallas; nada de luces dinámicas.

function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, items: { p: [number, number, number]; s: number | [number, number, number]; r?: [number, number, number] }[]) {
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.rotation.set(...(it.r ?? [0, 0, 0]))
      if (typeof it.s === 'number') o.scale.setScalar(it.s)
      else o.scale.set(...it.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [ref, items])
}

/** Guirnaldas de bombillos cruzando cada pasillo, con caída en catenaria. */
function StringLights() {
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const items = useMemo(() => {
    const out: { p: [number, number, number]; s: number }[] = []
    const half = LAYOUT.corridorHalfWidth + 0.2
    for (const zone of P1.zones)
      for (const z of [11, 16, 21]) {
        const n = 11
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1)
          const x = -half + u * half * 2
          const y = 3.4 - Math.sin(u * Math.PI) * 0.55
          const [wx, wz] = toWorld([x, z], zone.angle)
          out.push({ p: [wx, y, wz], s: 0.11 })
        }
      }
    return out
  }, [])
  useInstances(bulbs, items)
  return <instancedMesh ref={bulbs} args={[GEO.sphere, glowMat('#ffd27a', 2.6, { dayGlow: 0.25 }), items.length]} frustumCulled={false} />
}

/** Barquitos de vela que navegan alrededor de la isla. */
function Boats() {
  const boats = useRef<THREE.Group[]>([])
  const data = useMemo(() => [0.4, 2.3, 4.4].map((phase, i) => ({ phase, r: LAYOUT.baseRadius + 3.5 + (i % 2) * 1.5, speed: 0.025 + i * 0.008 })), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    data.forEach((b, i) => {
      const g = boats.current[i]
      if (!g) return
      const a = b.phase + t * b.speed
      g.position.set(Math.sin(a) * b.r, -0.35 + Math.sin(t * 1.6 + i) * 0.06, Math.cos(a) * b.r)
      g.rotation.set(Math.sin(t * 1.3 + i) * 0.05, a + Math.PI / 2, 0)
    })
  })
  return (
    <>
      {data.map((_, i) => (
        <group key={i} ref={(el) => void (el && (boats.current[i] = el))}>
          <mesh geometry={GEO.rounded} material={mat(i === 1 ? '#e0735f' : '#fbf7f0')} scale={[1.8, 0.4, 0.7]} castShadow />
          <mesh geometry={GEO.cylinder} material={mat('#8a6340')} position={[0, 0.9, 0]} scale={[0.05, 1.6, 0.05]} />
          <mesh geometry={GEO.cone} material={mat('#fffaf0')} position={[0.25, 1, 0]} rotation={[0, 0, -0.05]} scale={[0.9, 1.3, 0.06]} />
          <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffcf7a', 2.5)} position={[-0.75, 0.35, 0]} scale={0.12} />
        </group>
      ))}
    </>
  )
}

/** Aves que planean en círculos de día (de noche se van a dormir). */
function Birds() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const birds = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ r: 14 + i * 4, h: 9 + (i % 3), speed: 0.12 + i * 0.02, phase: i * 1.7 })), [])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    m.visible = nightState.t < 0.5
    if (!m.visible) return
    const t = clock.elapsedTime
    birds.forEach((b, i) => {
      const a = b.phase + t * b.speed
      const flap = Math.sin(t * 9 + i) * 0.5
      for (const side of [0, 1]) {
        const s = side ? 1 : -1
        o.position.set(Math.sin(a) * b.r, b.h + Math.sin(t + i) * 0.4, Math.cos(a) * b.r)
        o.rotation.set(0, a + Math.PI / 2, s * flap)
        o.translateX(s * 0.28)
        o.scale.set(0.55, 0.04, 0.18)
        o.updateMatrix()
        m.setMatrixAt(i * 2 + side, o.matrix)
      }
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[GEO.box, mat('#3b4552'), birds.length * 2]} frustumCulled={false} />
}

/** Luces propias del piso 1 (guirnaldas de pasillos; los halos están en MallPathLighting). */
export function CrossAmbient() {
  return (
    <group>
      <StringLights />
    </group>
  )
}

/** Ambiente del diorama, común a todos los pisos: barquitos y aves. */
export function GlobalAmbient({ detail }: { detail: 'high' | 'low' }) {
  if (detail !== 'high') return null
  return (
    <group>
      <Boats />
      <Birds />
    </group>
  )
}
