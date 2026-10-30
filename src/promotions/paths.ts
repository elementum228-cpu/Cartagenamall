import { INTERIOR_SPOTS, SPACE_BY_ID, VIEWING_SPOTS, WALK_LANES, ZONE_BY_ID, toWorld } from '../config/mall'

// Recorridos cortos por waypoints (sin pathfinding): del carril del pasillo al punto de observación
// de una vitrina. Todo en coordenadas locales del pasillo y luego rotado al piso.

export type Point = [number, number]

/** Inversa de `toWorld`: punto del piso → coordenadas locales del pasillo. */
export function toLocal([X, Z]: Point, angle: number): Point {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [X * c - Z * s, X * s + Z * c]
}

export interface VisitPlan {
  /** Waypoints en coordenadas del piso, desde el punto de salida (incluido) hasta el de observación. */
  path: Point[]
  lookAt: Point
}

/**
 * Plan de visita a la vitrina de `spaceId` para un visitante que está en `from` (sobre su carril).
 * `slot` elige uno de los puntos de observación (no se repiten: sin aglomeraciones). Null si el
 * espacio no está en un pasillo con carriles (p. ej. la terraza del piso 2).
 */
export function planVisit(spaceId: string, from: Point, slot: number): VisitPlan | null {
  const space = SPACE_BY_ID[spaceId]
  const n = Number(spaceId.match(/(\d+)$/)?.[1])
  const def = VIEWING_SPOTS[n]
  const zone = ZONE_BY_ID[space?.zoneId]
  if (!space || !def || !zone || space.floorId !== 'P1') return null
  const a = zone.angle
  const [fx, fz] = toLocal(from, a)
  // Cada visitante tiene su propio punto (no se repiten): si se acaban, no hay visita.
  if (slot >= def.spots.length) return null
  const [sx, sz] = def.spots[slot]
  const lane = fx < 0 ? -WALK_LANES.x : WALK_LANES.x
  const local: Point[] = [[fx, fz]]
  // Puntos a un lado del pasillo (locales laterales, costados de una isla): se llega por el carril
  // de ese lado; si el visitante viene por el otro, cruza por la fila libre.
  const need = Math.abs(sx) > 1.4 ? Math.sign(sx) * WALK_LANES.x : lane
  if (need !== lane) local.push([lane, WALK_LANES.crossZ], [need, WALK_LANES.crossZ])
  local.push([need, sz], [sx, sz])
  // Se quitan puntos repetidos (p. ej. si ya estaba a la altura de la vitrina).
  const path = local
    .filter((p, i) => i === 0 || Math.hypot(p[0] - local[i - 1][0], p[1] - local[i - 1][1]) > 0.05)
    .map((p) => toWorld(p, a))
  return { path, lookAt: toWorld(def.lookAt, a) }
}

/** Punto del piso → coordenadas del local (`spaceId`), con la fachada hacia +z. */
export function toStore(p: Point, spaceId: string): Point {
  const sp = SPACE_BY_ID[spaceId]
  return toLocal([p[0] - sp.position[0], p[1] - sp.position[1]], sp.rotation)
}
export function fromStore(p: Point, spaceId: string): Point {
  const sp = SPACE_BY_ID[spaceId]
  const [x, z] = toWorld(p, sp.rotation)
  return [sp.position[0] + x, sp.position[1] + z]
}

/** Cuántos visitantes caben a la vez dentro del local (0 en islas). */
export const interiorCapacity = (spaceId: string) => INTERIOR_SPOTS[SPACE_BY_ID[spaceId]?.type]?.length ?? 0

/**
 * Entrar a comprar: desde el punto de observación (afuera) hasta un lugar dentro del local, siempre
 * por la puerta (centro de la fachada). La salida es el mismo recorrido al revés.
 */
export function planStoreVisit(spaceId: string, spot: Point, slot: number): VisitPlan | null {
  const sp = SPACE_BY_ID[spaceId]
  const inside = INTERIOR_SPOTS[sp?.type]
  if (!sp || !inside || slot >= inside.length) return null
  const d = sp.size[1]
  const [sx, sz] = toStore(spot, spaceId)
  const front = d / 2 + 0.6
  const local: Point[] = [[sx, sz], [sx, front], [0, front], [0, d / 2 - 0.9], inside[slot]]
  const path = local.filter((p, i) => i === 0 || Math.hypot(p[0] - local[i - 1][0], p[1] - local[i - 1][1]) > 0.05).map((p) => fromStore(p, spaceId))
  // mira hacia la estantería del fondo, frente a donde está parado
  return { path, lookAt: fromStore([inside[slot][0], -d / 2], spaceId) }
}
