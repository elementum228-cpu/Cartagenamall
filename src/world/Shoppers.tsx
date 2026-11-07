import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LANE_SPREAD, P1, WALK_LANES, toWorld } from '../config/mall'
import { playingOn } from '../promotions/events'
import { interiorCapacity, planStoreVisit, planVisit, type Point } from '../promotions/paths'
import { usePromoEvents } from '../promotions/store'
import { HELMETS_ON, helmetColor } from './helmets'
import { GEO, mat } from './materials'

// Visitantes en miniatura que caminan por la plaza y los pasillos (dos InstancedMesh, sin sombras).
// Cuando una oferta relámpago se presenta en el piso, hasta `maxReacting` visitantes del mismo
// pasillo acuden de prisa a la vitrina por waypoints. El grupo se queda ~40 s: unos entran al local
// por turnos a comprar (los que caben) y los demás esperan afuera; luego vuelven a su ruta.

const COLORS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f', '#6b5b95', '#2f3e4e', '#f4f1ea']

type Route =
  | { kind: 'circle'; r: number; speed: number; phase: number }
  | { kind: 'line'; angle: number; x: number; z0: number; z1: number; speed: number; phase: number }

export type AgentState = 'walking' | 'idle' | 'browsing' | 'shopping' | 'reactingToPromotion' | 'returningToRoute'

interface Agent {
  route: Route
  /** Tiempo propio de la ruta: solo avanza caminando, así la ruta continúa donde se dejó. */
  routeT: number
  state: AgentState
  x: number
  z: number
  heading: number
  /** Waypoints del recorrido actual y siguiente índice. */
  path: Point[]
  next: number
  lookAt: Point
  timer: number
  eventId: string | null
  /** Segundos esperando al resto del grupo frente a la vitrina. */
  wait: number
  seed: number
  /** Recorrido de llegada a la vitrina (para volver por el mismo camino después de entrar al local). */
  approach: Point[]
  /** Dentro del local: entrando, comprando o saliendo, en qué lugar y hacia dónde mira. */
  shop: { phase: 'in' | 'inside' | 'out'; slot: number; look: Point } | null
  /** Ya entró una vez (los demás tienen prioridad para su turno). */
  visited: boolean
  /** Debe irse en cuanto salga del local (terminó el grupo o la promoción). */
  leaving: boolean
}

/** Estado de un grupo frente a una vitrina (uno por presentación). */
interface Group {
  spaceId: string
  /** Momento (reloj de la escena) en que el grupo quedó completo; desde ahí corre la estadía. */
  start: number | null
  /** Quién ocupa cada lugar dentro del local. */
  inside: (Agent | null)[]
  nextEntry: number
}

/** A la vitrina van de prisa; la vuelta también es ágil. */
const HURRY_SPEED = 2.1
const RETURN_SPEED = 1.7
/** Visitantes por pasillo (los que pueden acudir a una oferta de ese pasillo). */
const PER_WING = 16
const TURN = 6 // rad/s de suavizado del giro
/** Cuánto se queda el grupo frente a la vitrina una vez completo. */
const DWELL = 40
/** Paso dentro del local (tranquilo) y tiempo de compra de cada turno. */
const SHOP_SPEED = 1.6
const SHOP_TIME = [5, 7] as const

function routePose(r: Route, t: number): { x: number; z: number; heading: number } {
  if (r.kind === 'circle') {
    const a = t * r.speed + r.phase
    return { x: Math.sin(a) * r.r, z: Math.cos(a) * r.r, heading: a + (r.speed > 0 ? Math.PI / 2 : -Math.PI / 2) }
  }
  // ida y vuelta por el pasillo
  const u = (Math.sin(t * r.speed + r.phase) + 1) / 2
  const dir = Math.cos(t * r.speed + r.phase) > 0 ? 0 : Math.PI
  const [x, z] = toWorld([r.x, r.z0 + (r.z1 - r.z0) * u], r.angle)
  return { x, z, heading: r.angle + dir }
}

const angleTo = (from: Point, to: Point) => Math.atan2(to[0] - from[0], to[1] - from[1])
function turnTowards(current: number, target: number, step: number) {
  const d = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + Math.max(-step, Math.min(step, d))
}

/** Avanza por los waypoints; devuelve true al llegar al último. */
function follow(a: Agent, dt: number, speed: number): boolean {
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

/** Recorrido de vuelta por los mismos waypoints hasta el punto donde dejó su ruta. */
function startReturn(a: Agent) {
  const back = a.path.slice(0, a.next).reverse()
  a.path = [[a.x, a.z], ...back]
  a.next = 1
  a.state = 'returningToRoute'
  a.eventId = null
}

export function Shoppers({ maxReacting = 3 }: { maxReacting?: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const hats = useRef<THREE.InstancedMesh>(null)
  const agents = useMemo<Agent[]>(() => {
    const routes: Route[] = []
    for (let i = 0; i < 5; i++) routes.push({ kind: 'circle', r: 3.6 + (i % 2) * 0.6, speed: (i % 2 ? 1 : -1) * 0.22, phase: i * 1.3 })
    P1.zones.forEach((z, zi) => {
      for (let i = 0; i < PER_WING; i++)
        routes.push({
          kind: 'line',
          angle: z.angle,
          x: (i % 2 ? -1 : 1) * (WALK_LANES.x + LANE_SPREAD[(i >> 1) % LANE_SPREAD.length]),
          z0: WALK_LANES.z0,
          z1: 21,
          speed: 0.05 + (i % 5) * 0.012,
          phase: zi + i * 0.83,
        })
    })
    return routes.map((route, i) => {
      const p = routePose(route, 0)
      return { route, routeT: 0, state: 'walking', x: p.x, z: p.z, heading: p.heading, path: [], next: 0, lookAt: [0, 0], timer: 0, eventId: null, wait: 0, seed: i, approach: [], shop: null, visited: false, leaving: false }
    })
  }, [])
  /** Visitantes ya convocados por cada presentación (nunca más de `maxReacting`). */
  const recruited = useRef(new Map<string, number>())
  /** Visitantes que ya llegaron a la vitrina, por evento: el grupo mira junto hasta que llega el último. */
  const arrived = useRef(new Map<string, number>())
  const groups = useRef(new Map<string, Group>())
  const simT = useRef(0)

  useLayoutEffect(() => {
    const c = new THREE.Color()
    agents.forEach((_, i) => {
      bodies.current?.setColorAt(i, c.set(COLORS[i % COLORS.length]))
      heads.current?.setColorAt(i, c.set(i % 3 === 0 ? '#8d5a3b' : i % 3 === 1 ? '#c58c64' : '#e5b48f'))
      hats.current?.setColorAt(i, c.set(helmetColor(i)))
    })
    if (hats.current?.instanceColor) hats.current.instanceColor.needsUpdate = true
    if (bodies.current?.instanceColor) bodies.current.instanceColor.needsUpdate = true
    if (heads.current?.instanceColor) heads.current.instanceColor.needsUpdate = true
  }, [agents])

  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1) // al volver de otra pestaña no hay saltos
    // Reloj de la simulación (avanza con el mismo dt que los pasos): en un equipo lento, estadía,
    // turnos y caminatas se estiran juntos y la escena se ve igual, solo más despacio.
    simT.current += dt
    const t = simT.current
    const events = usePromoEvents.getState().events
    const event = playingOn(events, 'P1')

    // Presentación en curso: se convocan los visitantes libres más cercanos del mismo pasillo. Si
    // alguno todavía vuelve de otra vitrina, se suma cuando quede libre (mientras dure la presentación).
    if (event && maxReacting > 0) {
      const done = recruited.current.get(event.id) ?? 0
      const zoneId = event.spaceId.match(/^P1-([A-D])/)?.[1]
      const angle = P1.zones.find((z) => z.id === zoneId)?.angle
      if (done < maxReacting && angle !== undefined) {
        const [tx, tz] = event.targetPosition
        const free = agents
          .filter((a) => a.state === 'walking' && a.route.kind === 'line' && a.route.angle === angle)
          .sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz))
          .slice(0, maxReacting - done)
        free.forEach((a, k) => {
          const slot = done + k
          const plan = planVisit(event.spaceId, [a.x, a.z], slot)
          if (!plan) return
          a.state = 'reactingToPromotion'
          a.eventId = event.id
          a.path = plan.path
          a.next = 1
          a.lookAt = plan.lookAt
          a.timer = -k * 0.15 // escalonado: no salen todos a la vez
        })
        recruited.current.set(event.id, done + free.length)
        if (!groups.current.has(event.id))
          groups.current.set(event.id, { spaceId: event.spaceId, start: null, inside: Array(interiorCapacity(event.spaceId)).fill(null), nextEntry: 0 })
      }
    }

    // Grupos: arrancan cuando llega el último convocado (o tras 20 s de espera) y, mientras dura la
    // estadía, van entrando por turnos al local los que esperan afuera.
    for (const [id, g] of groups.current) {
      const members = agents.filter((a) => a.eventId === id)
      if (!members.length && g.start !== null) {
        groups.current.delete(id)
        continue
      }
      if (g.start === null) {
        const complete = (arrived.current.get(id) ?? 0) >= (recruited.current.get(id) ?? 0) && (recruited.current.get(id) ?? 0) > 0
        if (complete || members.some((a) => a.wait > 20)) g.start = t
        continue
      }
      const elapsed = t - g.start
      // Últimos turnos: que alcancen a comprar y salir antes de que el grupo se disuelva.
      if (elapsed > DWELL - SHOP_TIME[1] - 6 || t < g.nextEntry) continue
      const slot = g.inside.indexOf(null)
      if (slot < 0) continue
      const waiting = members.filter((a) => a.state === 'browsing' && !a.leaving)
      const candidate = waiting.find((a) => !a.visited) ?? waiting[0]
      if (!candidate) continue
      const plan = planStoreVisit(g.spaceId, [candidate.x, candidate.z], slot)
      if (!plan) continue
      candidate.approach = candidate.path
      candidate.path = plan.path
      candidate.next = 1
      candidate.state = 'shopping'
      candidate.shop = { phase: 'in', slot, look: plan.lookAt }
      g.inside[slot] = candidate
      g.nextEntry = t + 0.9
    }

    agents.forEach((a, i) => {
      // Si el evento terminó antes de tiempo (promoción finalizada), vuelven enseguida.
      if (a.eventId && a.state !== 'returningToRoute') {
        const e = events.find((x) => x.id === a.eventId)
        if (!e || e.status === 'ended') {
          // dentro del local: primero sale por la puerta; afuera: se va enseguida
          if (a.state === 'shopping' && a.shop) a.leaving = true
          else startReturn(a)
        }
      }
      let bob = 0
      let sway = 0
      switch (a.state) {
        case 'walking': {
          a.routeT += dt
          const p = routePose(a.route, a.routeT)
          a.x = p.x
          a.z = p.z
          a.heading = turnTowards(a.heading, p.heading, TURN * dt)
          bob = Math.abs(Math.sin(t * 6 + i)) * 0.05
          break
        }
        case 'reactingToPromotion': {
          a.timer += dt
          if (a.timer < 0) {
            // todavía sigue su ruta un instante antes de "notar" la oferta
            a.routeT += dt
            const p = routePose(a.route, a.routeT)
            a.x = p.x
            a.z = p.z
            a.heading = turnTowards(a.heading, p.heading, TURN * dt)
            a.path[0] = [a.x, a.z]
            bob = Math.abs(Math.sin(t * 6 + i)) * 0.05
            break
          }
          bob = Math.abs(Math.sin(t * 11 + i)) * 0.07
          if (follow(a, dt, HURRY_SPEED)) {
            a.state = 'idle'
            a.timer = 0
          }
          break
        }
        case 'idle': {
          // se gira hacia la vitrina
          a.timer += dt
          a.heading = turnTowards(a.heading, angleTo([a.x, a.z], a.lookAt), TURN * 0.6 * dt)
          if (a.timer > 0.4) {
            a.state = 'browsing'
            a.wait = 0
            a.visited = false
            a.leaving = false
            if (a.eventId) arrived.current.set(a.eventId, (arrived.current.get(a.eventId) ?? 0) + 1)
          }
          break
        }
        case 'browsing': {
          // Afuera, frente a la vitrina: esperan al grupo y luego se quedan la estadía completa (unos
          // entran por turnos). Se van escalonados para que el grupo se disuelva con naturalidad.
          a.wait += dt
          a.heading = turnTowards(a.heading, angleTo([a.x, a.z], a.lookAt), TURN * 0.3 * dt)
          sway = Math.sin(t * 1.3 + a.seed) * 0.18
          bob = Math.sin(t * 2 + a.seed) * 0.012
          const g = a.eventId ? groups.current.get(a.eventId) : undefined
          const due = g?.start != null && t - g.start > DWELL + (a.seed % 7) * 0.6
          if (!a.eventId || due || a.wait > DWELL + 25) startReturn(a)
          break
        }
        case 'shopping': {
          const sh = a.shop!
          const g = a.eventId ? groups.current.get(a.eventId) : undefined
          if (sh.phase === 'in') {
            bob = Math.abs(Math.sin(t * 6 + i)) * 0.04
            if (follow(a, dt, SHOP_SPEED)) {
              sh.phase = 'inside'
              a.timer = SHOP_TIME[0] + ((a.seed * 31) % 10) / 10 * (SHOP_TIME[1] - SHOP_TIME[0])
            }
          } else if (sh.phase === 'inside') {
            // mira productos: gira entre la estantería y la vitrina, con leve balanceo
            a.timer -= dt
            const look = Math.sin(t * 0.5 + a.seed) > 0.4 ? a.lookAt : sh.look
            a.heading = turnTowards(a.heading, angleTo([a.x, a.z], look), TURN * 0.4 * dt)
            sway = Math.sin(t * 1.6 + a.seed) * 0.15
            const over = g?.start != null && t - g.start > DWELL
            if (a.timer <= 0 || a.leaving || over) {
              sh.phase = 'out'
              const back = a.path.slice(0, a.next).reverse()
              a.path = [[a.x, a.z], ...back]
              a.next = 1
            }
          } else {
            bob = Math.abs(Math.sin(t * 6 + i)) * 0.04
            if (follow(a, dt, SHOP_SPEED)) {
              // de vuelta en su lugar afuera
              if (g) g.inside[sh.slot] = null
              a.shop = null
              a.visited = true
              a.path = a.approach
              a.next = a.approach.length
              a.state = 'browsing'
              if (a.leaving) startReturn(a)
            }
          }
          break
        }
        case 'returningToRoute': {
          bob = Math.abs(Math.sin(t * 9 + i)) * 0.06
          if (follow(a, dt, RETURN_SPEED)) {
            a.state = 'walking'
            a.path = []
          }
          break
        }
      }
      o.position.set(a.x, 0.2 + 0.43 + bob, a.z)
      o.rotation.set(0, a.heading + sway, 0)
      o.scale.setScalar(1)
      o.updateMatrix()
      bodies.current?.setMatrixAt(i, o.matrix)
      o.position.y += 0.52
      o.rotation.set(a.state === 'browsing' || a.state === 'shopping' ? Math.sin(t * 0.9 + a.seed) * 0.12 : 0, a.heading + sway * 1.4, 0)
      o.scale.setScalar(0.36)
      o.updateMatrix()
      heads.current?.setMatrixAt(i, o.matrix)
      if (HELMETS_ON) {
        o.position.y += 0.02
        o.scale.setScalar(0.4)
        o.updateMatrix()
        hats.current?.setMatrixAt(i, o.matrix)
      }
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
    if (hats.current) hats.current.instanceMatrix.needsUpdate = true
    if (import.meta.env.DEV) (window as unknown as { __cmAgents?: unknown }).__cmAgents = agents
  })

  return (
    <group>
      {/* sin raycast: los visitantes nunca tapan el toque a un local */}
      <instancedMesh ref={bodies} args={[GEO.capsule, mat('#ffffff'), agents.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={heads} args={[GEO.sphereSmooth, mat('#ffffff'), agents.length]} frustumCulled={false} raycast={() => null} />
      {HELMETS_ON && <instancedMesh ref={hats} args={[GEO.helmet, mat('#ffffff'), agents.length]} frustumCulled={false} raycast={() => null} />}
    </group>
  )
}
