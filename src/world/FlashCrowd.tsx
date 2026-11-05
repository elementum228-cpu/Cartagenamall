import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FORTRESS, FOOD_LAYOUT, SPACE_BY_ID, spaceFrontPoint } from '../config/mall'
import { appClock } from '../lib/clock'
import type { PromotionEvent } from '../promotions/events'
import { usePromoEvents } from '../promotions/store'
import { BOATS, BOAT_OF_STORE, HARBOR, PIRATE_BERTH } from '../tourism/config'
import { GEO, mat } from './materials'

// Visitantes que acuden a una oferta relámpago donde no hay pasillos con carriles: la terraza de
// comida (piso 2) y el muelle. Salen del punto de llegada (escaleras o puerta de la muralla), caminan por
// waypoints hasta el local o el barco, se quedan mirando un rato y vuelven por donde llegaron.
// Un solo InstancedMesh para cuerpos y otro para cabezas; sin luces ni sombras.

type Point = [number, number]

export interface CrowdTarget {
  /** De dónde salen. */
  start: Point
  /** Waypoints intermedios (esquivar jardineras, estatuas). */
  via: Point[]
  /** Un lugar por visitante, frente al local o junto al barco. */
  spots: Point[]
  look: Point
}

const COLORS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f', '#6b5b95', '#2f3e4e', '#f4f1ea']
const WALK = 1.9
const BACK = 1.6
const DWELL = 38
const TURN = 6
const MAX = 8

type Phase = 'idle' | 'delay' | 'in' | 'dwell' | 'out'
interface Walker {
  phase: Phase
  x: number
  z: number
  heading: number
  path: Point[]
  next: number
  timer: number
  eventId: string | null
  look: Point
  seed: number
}

const turnTowards = (cur: number, target: number, step: number) => {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur))
  return cur + Math.max(-step, Math.min(step, d))
}

export function FlashCrowd({ match, resolve, y, count = 6 }: { match: (e: PromotionEvent, now: number) => boolean; resolve: (e: PromotionEvent) => CrowdTarget | null; y: number; count?: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const started = useRef(new Set<string>())
  const simT = useRef(0)
  const walkers = useMemo<Walker[]>(() => Array.from({ length: MAX }, (_, i) => ({ phase: 'idle', x: 0, z: 0, heading: 0, path: [], next: 0, timer: 0, eventId: null, look: [0, 0], seed: i })), [])
  const o = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const c = new THREE.Color()
    walkers.forEach((_, i) => {
      bodies.current?.setColorAt(i, c.set(COLORS[(i + 3) % COLORS.length]))
      heads.current?.setColorAt(i, c.set(i % 3 === 0 ? '#8d5a3b' : i % 3 === 1 ? '#c58c64' : '#e5b48f'))
    })
    if (bodies.current?.instanceColor) bodies.current.instanceColor.needsUpdate = true
    if (heads.current?.instanceColor) heads.current.instanceColor.needsUpdate = true
  }, [walkers])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    simT.current += dt
    const t = simT.current
    const events = usePromoEvents.getState().events
    const now = appClock.now()

    // Una activación nueva: salen los visitantes libres, escalonados.
    for (const e of events) {
      if (started.current.has(e.id) || !match(e, now)) continue
      started.current.add(e.id)
      const target = resolve(e)
      if (!target) continue
      const free = walkers.filter((w) => w.phase === 'idle').slice(0, Math.min(count, target.spots.length))
      free.forEach((w, k) => {
        w.phase = 'delay'
        w.timer = k * 0.7
        w.eventId = e.id
        w.path = [target.start, ...target.via, target.spots[k]]
        w.next = 1
        w.look = target.look
        w.x = target.start[0]
        w.z = target.start[1]
      })
    }

    walkers.forEach((w, i) => {
      let bob = 0
      let sway = 0
      const ev = w.eventId ? events.find((x) => x.id === w.eventId) : undefined
      const move = (speed: number) => {
        let budget = speed * dt
        while (budget > 0 && w.next < w.path.length) {
          const [tx, tz] = w.path[w.next]
          const dx = tx - w.x
          const dz = tz - w.z
          const d = Math.hypot(dx, dz)
          if (d < 1e-4) {
            w.next++
            continue
          }
          w.heading = turnTowards(w.heading, Math.atan2(dx, dz), TURN * dt)
          const step = Math.min(budget, d)
          w.x += (dx / d) * step
          w.z += (dz / d) * step
          budget -= step
          if (step === d) w.next++
        }
        bob = Math.abs(Math.sin(t * 9 + i)) * 0.05
        return w.next >= w.path.length
      }
      switch (w.phase) {
        case 'delay':
          w.timer -= dt
          if (w.timer <= 0) w.phase = 'in'
          break
        case 'in':
          if (move(WALK)) {
            w.phase = 'dwell'
            w.timer = DWELL + (w.seed % 5) * 1.4
          }
          break
        case 'dwell': {
          w.timer -= dt
          w.heading = turnTowards(w.heading, Math.atan2(w.look[0] - w.x, w.look[1] - w.z), TURN * 0.5 * dt)
          sway = Math.sin(t * 1.3 + w.seed) * 0.16
          bob = Math.sin(t * 2 + w.seed) * 0.012
          if (w.timer <= 0 || !ev || ev.status === 'ended') {
            w.phase = 'out'
            w.path = [[w.x, w.z], ...w.path.slice(0, w.next).reverse()]
            w.next = 1
          }
          break
        }
        case 'out':
          if (move(BACK)) {
            w.phase = 'idle'
            w.eventId = null
          }
          break
      }
      const shown = w.phase === 'in' || w.phase === 'dwell' || w.phase === 'out'
      const s = shown ? 1 : 0
      o.position.set(w.x, y + 0.43 + bob, w.z)
      o.rotation.set(0, w.heading + sway, 0)
      o.scale.setScalar(s)
      o.updateMatrix()
      bodies.current?.setMatrixAt(i, o.matrix)
      o.position.y += 0.52
      o.rotation.set(w.phase === 'dwell' ? Math.sin(t * 0.9 + w.seed) * 0.12 : 0, w.heading + sway * 1.4, 0)
      o.scale.setScalar(0.36 * s)
      o.updateMatrix()
      heads.current?.setMatrixAt(i, o.matrix)
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
    if (import.meta.env.DEV) {
      const w = window as unknown as { __cmCrowd?: Walker[][] }
      w.__cmCrowd ??= []
      if (!w.__cmCrowd.includes(walkers)) w.__cmCrowd.push(walkers)
    }
  })

  return (
    <group>
      <instancedMesh ref={bodies} args={[GEO.capsule, mat('#ffffff'), MAX]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={heads} args={[GEO.sphereSmooth, mat('#ffffff'), MAX]} frustumCulled={false} raycast={() => null} />
    </group>
  )
}

const fresh = (e: PromotionEvent, now: number) => e.type === 'flash' && e.status === 'active' && now - e.startTime < 150_000

/** Restaurantes de la terraza (piso 2). Va dentro del piso: coordenadas del piso. */
export function FoodCrowd({ count = 6 }: { count?: number }) {
  return (
    <FlashCrowd
      y={0.2}
      count={count}
      match={(e, now) => e.floorId === 'P2' && e.type === 'flash' && e.status === 'active' && e.spotlight === 'playing' && now - e.startTime < 150_000}
      resolve={(e) => {
        const sp = SPACE_BY_ID[e.spaceId]
        if (!sp) return null
        const front = spaceFrontPoint(sp, 1.3)
        const fx = Math.sin(sp.rotation)
        const fz = Math.cos(sp.rotation)
        // lugares en abanico frente al local: filas hacia afuera, de a tres
        const spots: Point[] = Array.from({ length: 8 }, (_, k) => {
          const row = Math.floor(k / 3)
          const col = (k % 3) - 1
          return [front[0] + fx * row * 0.85 + fz * col * 0.95, front[1] + fz * row * 0.85 - fx * col * 0.95]
        })
        const a = FOOD_LAYOUT.arrival
        return { start: [a.x - 1.2, a.z - 1.2], via: [], spots, look: sp.position }
      }}
    />
  )
}

/** Muelle: salen por la puerta de la muralla y van al barco, por la plaza y el malecón. Coordenadas del mundo. */
export function HarborCrowd({ count = 6 }: { count?: number }) {
  return (
    <FlashCrowd
      y={HARBOR.deckY}
      count={count}
      match={fresh}
      resolve={(e) => {
        const boat = BOAT_OF_STORE[e.storeId]
        if (!boat) return null
        const quayX = boat === 'pirata' ? HARBOR.west + HARBOR.quayWidth / 2 : HARBOR.east - HARBOR.quayWidth / 2
        const [bx, bz] = boat === 'pirata' ? PIRATE_BERTH : BOATS[boat].position
        const row = HARBOR.headZ - 3.6 // por delante de los pegasos y las jardineras
        const spots: Point[] = [-1.2, 0, 1.2, -2.4, 2.4, -0.6, 0.6, 1.8].map((dz, k) => [quayX + (k % 2 ? 0.55 : -0.45), bz + dz])
        return {
          start: [HARBOR.x, FORTRESS.half - 1],
          via: [[HARBOR.x, row], [quayX, row], [quayX, HARBOR.headZ + 0.6]],
          spots,
          look: [bx, bz],
        }
      }}
    />
  )
}
