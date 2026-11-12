import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ESCALATOR, ESCALATOR_FRAME, ESCALATOR_STEP_RATE, ESCALATOR_STEPS, FLOOR_BY_ID, escToWorld } from '../config/mall'
import { useUI } from '../state/ui'
import { helmetColor, useHelmetsOn } from './helmets'
import { GEO, mat } from './materials'
import { CINE_STAIR, cinemaGrid, cinemaPois, ESCALATOR_ENDS, navGrids, pointsOfInterest, type NavGrid, type Poi, type Point } from './nav'
import { MAX_DT } from './simTime'

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
/** Probabilidad de ir al cine (por la escalera del rincón) desde el piso 2, y de volver a subir desde la plaza. */
const CINE_GO = 0.3
const CINE_BACK = 0.4
/** Marcha en la escalera del cine (unidades por segundo a lo largo de la rampa). */
const STAIR_SPEED = 1.1
const STAIR_LEN = Math.hypot(CINE_STAIR.zTop - CINE_STAIR.zBot, CINE_STAIR.yTop - CINE_STAIR.yBot)
/** El cine es la plaza de la isla (coordenadas del mundo); los pisos usan las suyas. */
type Level = 'P1' | 'P2' | 'C'

type State = 'walking' | 'pausing' | 'toEscalator' | 'stepOn' | 'riding' | 'stepOff'

interface Traveler {
  floor: Level
  /** Por dónde cambia de nivel: escalera eléctrica o escalera del cine. */
  via: 'esc' | 'stair'
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
  const hats = useRef<THREE.InstancedMesh>(null)
  const helmets = useHelmetsOn()
  const grids = useMemo<Record<Level, NavGrid>>(() => ({ ...navGrids(), C: cinemaGrid() }) as Record<Level, NavGrid>, [])
  const pois = useMemo(() => pointsOfInterest(), [])
  const byFloor = useMemo<Record<string, Poi[]>>(() => ({ P1: pois.filter((p) => p.floorId === 'P1'), P2: pois.filter((p) => p.floorId === 'P2'), C: cinemaPois() }), [pois])
  const rise = FLOOR_BY_ID.P2.elevation
  const p2 = FLOOR_BY_ID.P2.offset
  const run = ESCALATOR.bottomZ - ESCALATOR.topZ
  /** Fracción de la rampa por segundo: la misma marcha que los escalones. */
  const rideSpeed = ESCALATOR_STEP_RATE / ESCALATOR_STEPS

  const travelers = useMemo<Traveler[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const floor: Level = i % 4 === 3 ? 'C' : i % 2 ? 'P2' : 'P1'
        const rnd = mulberry(1234 + i * 97)
        const list = byFloor[floor]
        const poi = list[Math.floor(rnd() * list.length)]
        return { floor, via: 'esc' as const, x: poi.point[0], z: poi.point[1], heading: rnd() * 6.28, state: 'pausing', path: [], next: 0, timer: 1 + rnd() * 4, look: poi.look, dir: 'up', u: 0, speed: 1.55 + rnd() * 0.4, rnd }
      }),
    [count, byFloor],
  )

  useLayoutEffect(() => {
    const c = new THREE.Color()
    travelers.forEach((_, i) => {
      bodies.current?.setColorAt(i, c.set(COLORS[(i * 3) % COLORS.length]))
      heads.current?.setColorAt(i, c.set(SKIN[i % SKIN.length]))
      hats.current?.setColorAt(i, c.set(helmetColor(i + 2)))
    })
    for (const m of [bodies.current, heads.current, hats.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [travelers, helmets])

  /** Elige qué hacer después de una parada: otro lugar del piso o cambiar de piso por la escalera. */
  const decide = (a: Traveler) => {
    const grid = grids[a.floor]
    // Cine: del piso 2 bajan por la escalera del rincón; de la plaza vuelven a subir por ella.
    if ((a.floor === 'P2' && a.rnd() < CINE_GO) || (a.floor === 'C' && a.rnd() < CINE_BACK)) {
      const target = a.floor === 'P2' ? CINE_STAIR.p2Entry : CINE_STAIR.plazaEntry
      const path = grid.path([a.x, a.z], target)
      if (path) {
        a.path = path
        a.next = 1
        a.state = 'toEscalator'
        a.via = 'stair'
        a.dir = a.floor === 'P2' ? 'down' : 'up'
        return
      }
    }
    if (a.floor !== 'C' && a.rnd() < FLOOR_CHANGE) {
      const target = a.floor === 'P1' ? ESCALATOR_ENDS.upStart : ESCALATOR_ENDS.downStart
      const path = grid.path([a.x, a.z], target)
      if (path) {
        a.path = path
        a.next = 1
        a.state = 'toEscalator'
        a.via = 'esc'
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
    const dt = Math.min(rawDt, MAX_DT)
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
            if (a.via === 'stair') {
              // último tramo hasta el extremo de la escalera del cine
              a.path = [[a.x, a.z], a.floor === 'P2' ? CINE_STAIR.p2Top : CINE_STAIR.plazaBot]
              a.next = 1
              a.state = 'stepOn'
              break
            }
            // al pie del carril (en coordenadas del piso donde está)
            const [ex, ez] = escToWorld(lane(a.dir), a.dir === 'up' ? ESCALATOR.bottomZ : ESCALATOR.topZ)
            const x = ex - (a.floor === 'P2' ? p2[0] : 0)
            const z = ez - (a.floor === 'P2' ? p2[1] : 0)
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
          if (a.via === 'stair') {
            bob = Math.abs(Math.sin(t * 6 + i)) * 0.03
            a.u += (STAIR_SPEED / STAIR_LEN) * dt
            if (a.u >= 1) {
              const down = a.dir === 'down'
              a.floor = down ? 'C' : 'P2'
              const from = down ? CINE_STAIR.plazaBot : CINE_STAIR.p2Top
              const to = down ? CINE_STAIR.plazaEntry : CINE_STAIR.p2Entry
              a.x = from[0]
              a.z = from[1]
              a.path = [from, to]
              a.next = 1
              a.state = 'stepOff'
            }
            onEscalator = true
            break
          }
          a.u += rideSpeed * dt
          if (a.u >= 1) {
            // baja de la escalera: queda en el otro piso, a un paso del carril
            a.floor = a.dir === 'up' ? 'P2' : 'P1'
            const end = a.dir === 'up' ? ESCALATOR_ENDS.upEnd : ESCALATOR_ENDS.downEnd
            const [ex, ez] = escToWorld(lane(a.dir), a.dir === 'up' ? ESCALATOR.topZ : ESCALATOR.bottomZ)
            const x = ex - (a.floor === 'P2' ? p2[0] : 0)
            const z = ez - (a.floor === 'P2' ? p2[1] : 0)
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
            a.look = a.floor === 'C' ? [-37.5, -68] : a.floor === 'P2' ? [3, 3] : [0, 0]
          }
          break
        }
      }

      if (a.state === 'riding' && a.via === 'stair') {
        // rampa de la escalera del cine (coordenadas del mundo)
        const u = a.dir === 'down' ? a.u : 1 - a.u
        wx = CINE_STAIR.x
        wz = CINE_STAIR.zTop + (CINE_STAIR.zBot - CINE_STAIR.zTop) * u
        wy = CINE_STAIR.yTop + (CINE_STAIR.yBot - CINE_STAIR.yTop) * u
        a.heading = turnTowards(a.heading, a.dir === 'down' ? Math.PI : 0, TURN * dt)
      } else if (a.state === 'riding' || onEscalator) {
        // sobre el escalón: coordenadas del piso 1
        const u = a.dir === 'up' ? a.u : 1 - a.u
        ;[wx, wz] = escToWorld(lane(a.dir), ESCALATOR.bottomZ - run * u)
        wy = FLOOR_TOP + rise * u + 0.23
        a.heading = turnTowards(a.heading, (a.dir === 'up' ? Math.PI : 0) + ESCALATOR_FRAME.angle, TURN * dt)
      } else if (a.floor === 'C') {
        wx = a.x
        wz = a.z
        wy = CINE_STAIR.yBot
      } else if (a.floor === 'P2') {
        wx = a.x + p2[0]
        wz = a.z + p2[1]
        wy = rise + FLOOR_TOP
      } else {
        wx = a.x
        wz = a.z
        wy = FLOOR_TOP
      }
      const visible = a.state === 'riding' || overview || a.floor === 'C' || a.floor === activeFloor
      o.position.set(wx, wy + 0.43 + bob, wz)
      o.rotation.set(0, a.heading, 0)
      o.scale.setScalar(visible ? 1 : 0)
      o.updateMatrix()
      bodies.current?.setMatrixAt(i, o.matrix)
      o.position.y += 0.52
      o.scale.setScalar(visible ? 0.36 : 0)
      o.updateMatrix()
      heads.current?.setMatrixAt(i, o.matrix)
      if (helmets) {
        o.position.y += 0.02
        o.scale.setScalar(visible ? 0.4 : 0)
        o.updateMatrix()
        hats.current?.setMatrixAt(i, o.matrix)
      }
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
    if (hats.current) hats.current.instanceMatrix.needsUpdate = true
    if (import.meta.env.DEV) (window as unknown as { __cmTravelers?: unknown }).__cmTravelers = travelers
  })

  if (!count) return null
  return (
    <group>
      <instancedMesh ref={bodies} args={[GEO.capsule, mat('#ffffff'), count]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={heads} args={[GEO.sphereSmooth, mat('#ffffff'), count]} frustumCulled={false} raycast={() => null} />
      {helmets && <instancedMesh ref={hats} args={[GEO.helmet, mat('#ffffff'), count]} frustumCulled={false} raycast={() => null} />}
    </group>
  )
}
