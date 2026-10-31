import { FLOOR_BY_ID, FOOD_LAYOUT, LAYOUT, SPACES, SPACE_BY_ID, onP1Walkway, spaceFrontPoint } from '../config/mall'
import type { HideSpot, Promotion, ZoneId } from '../domain/types'

// Escondites de las promociones escondidas: el comerciante elige un punto del mall (plaza,
// pasillos o terraza de comidas) y ahí aparece la gema cuando alguien se acerca.

/** Radio de la fuente de la plaza (no se esconde dentro del agua). */
const FOUNTAIN_R = 3

/** ¿El punto cae dentro de algún local de ese piso (con un margen)? */
function insideSpace(floorId: string, x: number, z: number, margin = 0.6) {
  return SPACES.some((sp) => {
    if (sp.floorId !== floorId) return false
    const dx = x - sp.position[0]
    const dz = z - sp.position[1]
    const c = Math.cos(sp.rotation)
    const s = Math.sin(sp.rotation)
    // al sistema del local (rotation gira alrededor de Y)
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    return Math.abs(lx) <= sp.size[0] / 2 + margin && Math.abs(lz) <= sp.size[1] / 2 + margin
  })
}

/** ¿Se puede esconder una gema en este punto? Solo sobre zonas por donde camina la gente. */
export function canHideAt(floorId: string, x: number, z: number): boolean {
  const floor = FLOOR_BY_ID[floorId]
  if (!floor || !Number.isFinite(x) || !Number.isFinite(z)) return false
  if (insideSpace(floorId, x, z)) return false
  if (floor.layout === 'cross') return onP1Walkway(x, z) && Math.hypot(x, z) > FOUNTAIN_R
  const h = FOOD_LAYOUT.half - 1
  return Math.abs(x) <= h && Math.abs(z) <= h
}

/** Redondea a 10 cm para guardar coordenadas limpias. */
export function hideSpot(floorId: string, x: number, z: number): HideSpot {
  return { floorId, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }
}

export interface ResolvedSpot {
  floorId: string
  /** Punto de la gema, en coordenadas del piso. */
  at: [number, number]
  /** Centro de los destellos de pista. */
  hintAt: [number, number]
  hintY: number
  /** Medio ancho del lugar: amplía la distancia a la que se revela. */
  extent: number
}

/** Dónde aparece la gema de una promoción escondida: su escondite o, si no tiene, junto al local. */
export function resolveHideSpot(promo: Promotion, spaceByStore: Record<string, string>): ResolvedSpot | null {
  const h = promo.hideAt
  if (h && canHideAt(h.floorId, h.x, h.z)) return { floorId: h.floorId, at: [h.x, h.z], hintAt: [h.x, h.z], hintY: 2.8, extent: 0.5 }
  const space = SPACE_BY_ID[spaceByStore[promo.storeId]]
  if (!space) return null
  const [x, z] = spaceFrontPoint(space, 1.4)
  // un poco hacia un costado, para no tapar la entrada
  const side = space.type === 'island' ? 1.6 : space.size[0] * 0.32
  return {
    floorId: space.floorId,
    at: [x + Math.cos(space.rotation) * side, z - Math.sin(space.rotation) * side],
    hintAt: space.position,
    hintY: space.type === 'premium' ? 4.6 : 3.8,
    extent: space.size[0] * 0.5,
  }
}

/** Zona del escondite (pasillo o terraza); null si está en la plaza central. */
export function hideSpotZone(spot: HideSpot): ZoneId | null {
  const floor = FLOOR_BY_ID[spot.floorId]
  if (!floor?.zones.length) return null
  if (floor.layout !== 'cross') return floor.zones[0].id
  const P = LAYOUT.plazaHalf
  if (Math.abs(spot.x) <= P && Math.abs(spot.z) <= P) return null
  // el pasillo hacia el que apunta el punto (cada pasillo sale de la plaza en la dirección de su ángulo)
  const along = (a: number) => spot.x * Math.sin(a) + spot.z * Math.cos(a)
  return floor.zones.reduce((best, z) => (along(z.angle) > along(best.angle) ? z : best)).id
}

/** Nombre del lugar donde quedó escondida, para confirmarlo en palabras. */
export function describeHideSpot(spot: HideSpot): string {
  const floor = FLOOR_BY_ID[spot.floorId]
  if (!floor) return 'Escondite'
  const zoneId = hideSpotZone(spot)
  const zone = floor.zones.find((z) => z.id === zoneId)
  if (!zone) return `${floor.name} · Plaza central`
  return floor.layout === 'cross' ? `${floor.name} · Pasillo ${zone.id}, ${zone.name}` : `${floor.name} · ${zone.name}`
}
