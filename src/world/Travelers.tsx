import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ESCALATOR, ESCALATOR_STEP_RATE, ESCALATOR_STEPS, FLOOR_BY_ID } from '../config/mall'
import type { FloorId } from '../domain/types'
import { useUI } from '../state/ui'
import { GEO, mat } from './materials'
import { ESCALATOR_ENDS, navGrids, pointsOfInterest, type Poi, type Point } from './nav'

// Visitantes que recorren los dos pisos: caminan entre vitrinas, restaurantes, bancas y miradores
// por rutas que esquivan todo (nav.ts), se detienen a mirar y, de vez en cuando, suben al piso 2 o
// bajan al 1 por las escaleras eléctricas, quietos sobre el escalón a la velocidad de la escalera.
// Solo se dibujan en el piso que se está viendo (y siempre sobre la escalera).

const COLORS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f', '#6b5b95', '#2f3e4e', '#f4f1ea', '#d4842e', '#0f766e']
const SKIN = ['#8d5a3b', '#c58c64', '#e5b48f']
const FLOOR_TOP = 0.2
const TURN = 6
/** Probabilidad de cambiar de piso al terminar una parada. */
const FLOOR_CHANGE = 0.35

type State = 'walking' | 'pausing' | 'toEscalator' | 'stepOn' | 'riding' | 'stepOff'

interface Traveler {
  floor: FloorId
  x: number
  z: number
  heading: number
  state: State
  path: Point[]
  next: number
  timer: number
  look: Point
  /** En la escalera: 'up' o 'down' y avance 0..1. */
  dir: 'up' | 'down'
  u: number
  speed: number
  rnd: () => number
}

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function turnTowards(current: number, target: number, step: number) {
  const d = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + Math.max(-step, Math.min(step, d))
}

function follow(a: Traveler, dt: number, speed: number): boolean {
  let budget = speed * dt
  while (budget > 0 && a.next < a.path.length) {
    const [tx, tz] = a.path[a.next]
    const dx = tx - a.x
    const dz = tz - a.z
    const d = Math.hypot(dx, dz)
    if (d < 1e-4) {
      a.next++
      continue
    }
    a.heading = turnTowards(a.heading, Math.atan2(dx, dz), TURN * dt)
    const step = Math.min(budget, d)
    a.x += (dx / d) * step
    a.z += (dz / d) * step
    budget -= step
    if (step === d) a.next++
  }
  return a.next >= a.path.length
}

export function Travelers({ count }: { count: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const grids = useMemo(() => navGrids(), [])
  const pois = useMemo(() => pointsOfInterest(), [])
  const byFloor = useMemo<Record<string, Poi[]>>(() => ({ P1: pois.filter((p) => p.floorId === 'P1'), P2: pois.filter((p) => p.floorId === 'P2') }), [pois])
  const rise = FLOOR_BY_ID.P2.elevation
  const p2 = FLOOR_BY_ID.P2.offset
  const run = ESCALATOR.bottomZ - ESCALATOR.topZ
  /** Fracción de la rampa por segundo: la misma marcha que los escalones. */
  const rideSpeed = ESCALATOR_STEP_RATE / ESCALATOR_STEPS

  const travelers = useMemo<Traveler[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const floor: FloorId = i % 2 ? 'P2' : 'P1'
        const rnd = mulberry(1234 + i * 97)
        const list = byFloor[floor]
        const poi = list[Math.floor(rnd() * list.length)]
        return { floor, x: poi.point[0], z: poi.point[1], heading: rnd() * 6.28, state: 'pausing', path: [], next: 0, timer: 1 + rnd() * 4, look: poi.look, dir: 'up', u: 0, speed: 1 + rnd() * 0.3, rnd }
      }),
    [count, byFloor],
  )

  useLayoutEffect(() => {
    const c = new THREE.Color()
    travelers.forEach((_, i) => {
      bodies.current?.setColorAt(i, c.set(COLORS[(i * 3) % COLORS.length]))
      heads.current?.setColorAt(i, c.set(SKIN[i % SKIN.length]))
    })
    for (const m of [bodies.current, heads.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [travelers])

  /** Elige qué hacer después de una parada: otro lugar del piso o cambiar de piso por la escalera. */
  const decide = (a: Traveler) => {
    const grid = grids[a.floor]
    if (a.rnd() < FLOOR_CHANGE) {
      const target = a.floor === 'P1' ? ESCALATOR_ENDS.upStart : ESCALATOR_ENDS.downStart
      const path = grid.path([a.x, a.z], target)
      if (path) {
        a.path = path
        a.next = 1
        a.state = 'toEscalator'
        a.dir = a.floor === 'P1' ? 'up' : 'down'
        return
      }
    }
    const list = byFloor[a.floor]
    for (let tries = 0; tries < 6; tries++) {
      const poi: Poi = list[Math.floor(a.rnd() * list.length)]
      if (Math.hypot(poi.point[0] - a.x, poi.point[1] - a.z) < 2) continue
      const path = grid.path([a.x, a.z], poi.point)
      if (!path) continue
      a.path = path
      a.next = 1
      a.look = poi.look
      a.state = 'walking'
      return
    }
    a.state = 'pausing'
    a.timer = 2
  }

  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    const { activeFloor, overview } = useUI.getState()
    const lane = (dir: 'up' | 'down') => (dir === 'up' ? ESCALATOR.lanesX[0] : ESCALATOR.lanesX[1])

    travelers.forEach((a, i) => {
      let bob = 0
      // posición en el mundo (y) y si se ve
      let wx: number, wy: number, wz: number
      let onEscalator = false
      switch (a.state) {
        case 'pausing': {
          a.timer -= dt
          a.heading = turnTowards(a.heading, Math.atan2(a.look[0] - a.x, a.look[1] - a.z), TURN * 0.5 * dt)
          if (a.timer <= 0) decide(a)
          break
        }
        case 'walking': {
          bob = Math.abs(Math.sin(t * 6 + i)) * 0.05
          if (follow(a, dt, a.speed)) {
            a.state = 'pausing'
            a.timer = 2.5 + a.rnd() * 4
          }
          break
        }
        case 'toEscalator': {
          bob = Math.abs(Math.sin(t * 6 + i)) * 0.05
          if (follow(a, dt, a.speed)) {
            // al pie del carril (en coordenadas del piso donde está)
            const x = lane(a.dir) - (a.floor === 'P2' ? p2[0] : 0)
            const z = a.dir === 'up' ? ESCALATOR.bottomZ : ESCALATOR.topZ - p2[1]
            a.path = [[a.x, a.z], [x, z]]
            a.next = 1
            a.state = 'stepOn'
          }
          break
        }
        case 'stepOn': {
          bob = Math.abs(Math.sin(t * 6 + i)) * 0.04
          if (follow(a, dt, a.speed * 0.8)) {
            a.state = 'riding'
            a.u = 0
          }
          break
        }
        case 'riding': {
          a.u += rideSpeed * dt
          if (a.u >= 1) {
            // baja de la escalera: queda en el otro piso, a un paso del carril
            a.floor = a.dir === 'up' ? 'P2' : 'P1'
            const end = a.dir === 'up' ? ESCALATOR_ENDS.upEnd : ESCALATOR_ENDS.downEnd
            const x = lane(a.dir) - (a.floor === 'P2' ? p2[0] : 0)
            const z = a.dir === 'up' ? ESCALATOR.topZ - p2[1] : ESCALATOR.bottomZ
            a.x = x
            a.z = z
            a.path = [[x, z], end]
            a.next = 1
            a.state = 'stepOff'
          }
          onEscalator = true
          break
        }
        case 'stepOff': {
          bob = Math.abs(Math.sin(t * 6 + i)) * 0.04
          if (follow(a, dt, a.speed * 0.8)) {
            a.state = 'pausing'
            a.timer = 0.8 + a.rnd() * 1.5
            a.look = a.floor === 'P2' ? [3, 3] : [0, 0]
          }
          break
        }
      }

      if (a.state === 'riding' || onEscalator) {
        // sobre el escalón: coordenadas del piso 1
        const u = a.dir === 'up' ? a.u : 1 - a.u
        wx = lane(a.dir)
        wz = ESCALATOR.bottomZ - run * u
        wy = FLOOR_TOP + rise * u + 0.23
        a.heading = turnTowards(a.heading, a.dir === 'up' ? Math.PI : 0, TURN * dt)
      } else if (a.floor === 'P2') {
        wx = a.x + p2[0]
        wz = a.z + p2[1]
        wy = rise + FLOOR_TOP
      } else {
        wx = a.x
        wz = a.z
        wy = FLOOR_TOP
      }
      const visible = a.state === 'riding' || overview || a.floor === activeFloor
      o.position.set(wx, wy + 0.43 + bob, wz)
      o.rotation.set(0, a.heading, 0)
      o.scale.setScalar(visible ? 1 : 0)
      o.updateMatrix()
      bodies.current?.setMatrixAt(i, o.matrix)
      o.position.y += 0.52
      o.scale.setScalar(visible ? 0.36 : 0)
      o.updateMatrix()
      heads.current?.setMatrixAt(i, o.matrix)
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
    if (import.meta.env.DEV) (window as unknown as { __cmTravelers?: unknown }).__cmTravelers = travelers
  })

  if (!count) return null
  return (
    <group>
      <instancedMesh ref={bodies} args={[GEO.capsule, mat('#ffffff'), count]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={heads} args={[GEO.sphereSmooth, mat('#ffffff'), count]} frustumCulled={false} raycast={() => null} />
    </group>
  )
}
