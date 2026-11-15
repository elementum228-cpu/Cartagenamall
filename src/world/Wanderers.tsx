import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { helmetColor, useHelmetsOn } from './helmets'
import { GEO, mat } from './materials'
import { MAX_DT } from './simTime'

// Visitantes que pasean por una zona: van de un punto de interés al siguiente, se detienen un momento a mirar y siguen. Sirven para
// repartir la gente por todo el mundo (terraza, cine, estadio…) y no solo en la plaza. Dos InstancedMesh (cuerpos y cabezas), sin
// luces ni sombras, sin toque (no tapan los locales). Coordenadas: las del grupo donde se coloque el componente.

type Point = [number, number]

const COLORS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f', '#6b5b95', '#2f3e4e', '#f4f1ea']
const TURN = 6

interface Agent {
  x: number
  z: number
  heading: number
  target: number
  /** Segundos que se queda mirando antes de seguir. */
  wait: number
  speed: number
  seed: number
}

/** Número pseudoaleatorio estable (para que cada recorrido sea distinto pero repetible). */
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

const turnTowards = (cur: number, target: number, step: number) => {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur))
  return cur + Math.max(-step, Math.min(step, d))
}

export function Wanderers({ points, count, y = 0.2, reach = 16, speed = 1.0, seed = 1 }: { points: Point[]; count: number; y?: number; reach?: number; speed?: number; seed?: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const hats = useRef<THREE.InstancedMesh>(null)
  const helmets = useHelmetsOn()
  const o = useMemo(() => new THREE.Object3D(), [])
  const agents = useMemo<Agent[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const start = points[Math.floor(rnd(seed * 31 + i) * points.length)]
        const target = Math.floor(rnd(seed * 17 + i * 3) * points.length)
        return { x: start[0] + (rnd(i + 5) - 0.5), z: start[1] + (rnd(i + 9) - 0.5), heading: rnd(i) * 6.28, target, wait: rnd(i + 2) * 3, speed: 0.85 + rnd(seed + i * 7) * 0.5, seed: i }
      }),
    [count, points, seed],
  )

  useLayoutEffect(() => {
    const c = new THREE.Color()
    agents.forEach((_, i) => {
      bodies.current?.setColorAt(i, c.set(COLORS[(i + seed) % COLORS.length]))
      heads.current?.setColorAt(i, c.set(i % 3 === 0 ? '#8d5a3b' : i % 3 === 1 ? '#c58c64' : '#e5b48f'))
      hats.current?.setColorAt(i, c.set(helmetColor(i)))
    })
    for (const m of [bodies.current, heads.current, hats.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [agents, helmets, seed])

  const clock = useRef(0)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT)
    clock.current += dt
    const t = clock.current
    agents.forEach((a, i) => {
      let bob = 0
      if (a.wait > 0) {
        a.wait -= dt
        // mirando: gira despacio hacia un lado y otro
        a.heading += Math.sin(t * 0.8 + a.seed) * 0.01
        if (a.wait <= 0) {
          // el siguiente punto: uno cercano distinto del actual
          const here = points[a.target]
          const near = points.map((_, k) => k).filter((k) => k !== a.target && Math.hypot(points[k][0] - here[0], points[k][1] - here[1]) <= reach)
          const pool = near.length ? near : points.map((_, k) => k)
          a.target = pool[Math.floor(rnd(t * 7 + a.seed * 13) * pool.length)]
        }
      } else {
        const [tx, tz] = points[a.target]
        const dx = tx - a.x
        const dz = tz - a.z
        const d = Math.hypot(dx, dz)
        if (d < 0.35) a.wait = 1.5 + rnd(t + a.seed) * 4
        else {
          a.heading = turnTowards(a.heading, Math.atan2(dx, dz), TURN * dt)
          const step = Math.min(d, a.speed * speed * dt)
          a.x += (dx / d) * step
          a.z += (dz / d) * step
          bob = Math.abs(Math.sin(t * 6 + i)) * 0.05
        }
      }
      o.position.set(a.x, y + 0.43 + bob, a.z)
      o.rotation.set(0, a.heading, 0)
      o.scale.setScalar(1)
      o.updateMatrix()
      bodies.current?.setMatrixAt(i, o.matrix)
      o.position.y += 0.52
      o.scale.setScalar(0.36)
      o.updateMatrix()
      heads.current?.setMatrixAt(i, o.matrix)
      if (helmets) {
        o.position.y += 0.02
        o.scale.setScalar(0.4)
        o.updateMatrix()
        hats.current?.setMatrixAt(i, o.matrix)
      }
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
    if (hats.current) hats.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={bodies} args={[GEO.capsule, mat('#ffffff'), count]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={heads} args={[GEO.sphereSmooth, mat('#ffffff'), count]} frustumCulled={false} raycast={() => null} />
      {helmets && <instancedMesh ref={hats} args={[GEO.helmet, mat('#ffffff'), count]} frustumCulled={false} raycast={() => null} />}
    </group>
  )
}
