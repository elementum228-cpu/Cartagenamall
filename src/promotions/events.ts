import { SPACE_BY_ID, spaceFrontPoint } from '../config/mall'
import type { FloorId, Promotion } from '../domain/types'
import { BOATS, BOAT_OF_STORE } from '../tourism/config'

// Gestor de eventos de promoción (puro, sin three): convierte las promociones del catálogo en
// eventos con vigencia y decide cuándo una oferta relámpago se "presenta" en el mall (fachada
// resaltada y visitantes que se acercan). Máximo una presentación a la vez por piso, y cada
// activación se presenta una sola vez por sesión, cuando su piso está a la vista.

export type PromoEventType = 'flash' | 'secret' | 'regular'
export type PromoEventStatus = 'scheduled' | 'active' | 'ended'
/** Presentación visual: pendiente (espera que su piso esté a la vista), en curso o terminada. */
export type SpotlightState = 'none' | 'pending' | 'playing' | 'done'

export interface PromotionEvent {
  /** Una activación concreta: `${promotionId}@${startsAt}` (reactivar crea otro evento). */
  id: string
  promotionId: string
  storeId: string
  floorId: FloorId
  spaceId: string
  type: PromoEventType
  startTime: number
  endTime: number | null
  status: PromoEventStatus
  discount: number
  title: string
  /** Punto frente a la vitrina, en coordenadas del piso (x, z). */
  targetPosition: [number, number]
  spotlight: SpotlightState
  spotlightStart: number | null
  spotlightEnd: number | null
}

/** Duración de la presentación (fachada + visitantes). Los visitantes terminan su visita aunque acabe. */
export const SPOTLIGHT_MS = 45_000
/** Pausa entre presentaciones de ofertas que ya estaban vigentes (en el mismo piso). */
export const SPOTLIGHT_GAP_MS = 25_000
const KEEP_ENDED = 40

const typeOf = (p: Promotion): PromoEventType => (p.type === 'normal' ? 'regular' : p.type)

export interface SyncInput {
  promotions: Promotion[]
  /** spaceId → storeId */
  assignments: Record<string, string>
  now: number
  /** Piso que se está viendo en detalle; «all» en la vista general (todos los pisos a la vista); null fuera del mapa. */
  visibleFloor: FloorId | 'all' | null
}

export function syncPromotionEvents(prev: PromotionEvent[], { promotions, assignments, now, visibleFloor }: SyncInput): PromotionEvent[] {
  const spaceByStore: Record<string, string> = {}
  for (const [sp, st] of Object.entries(assignments)) spaceByStore[st] = sp
  const byId = new Map(prev.map((e) => [e.id, e]))
  const next: PromotionEvent[] = []
  const live = new Set<string>()

  for (const p of promotions) {
    const spaceId = spaceByStore[p.storeId]
    const space = SPACE_BY_ID[spaceId]
    // Los barcos del muelle son negocios sin local: sus ofertas también son eventos (el barco se ilumina).
    const boat = space ? undefined : BOAT_OF_STORE[p.storeId]
    if (!p.active || (!space && !boat)) continue
    const id = `${p.id}@${p.startsAt}`
    const start = Date.parse(p.startsAt)
    const end = p.endsAt ? Date.parse(p.endsAt) : null
    const status: PromoEventStatus = start > now ? 'scheduled' : end !== null && end <= now ? 'ended' : 'active'
    const old = byId.get(id)
    const type = typeOf(p)
    let spotlight: SpotlightState = boat ? 'none' : (old?.spotlight ?? (type === 'flash' ? 'pending' : 'none'))
    if (status === 'ended' && spotlight !== 'none') spotlight = 'done'
    live.add(id)
    next.push({
      id,
      promotionId: p.id,
      storeId: p.storeId,
      floorId: space ? space.floorId : 'P1',
      spaceId: space ? spaceId : `BOAT:${boat}`,
      type,
      startTime: start,
      endTime: end,
      status,
      discount: p.discountPercent,
      title: p.title,
      targetPosition: space ? spaceFrontPoint(space, 1.2) : BOATS[boat!].position,
      spotlight,
      spotlightStart: old?.spotlightStart ?? null,
      spotlightEnd: old?.spotlightEnd ?? null,
    })
  }
  // Promociones desactivadas, borradas o que cambiaron de local: el evento termina.
  for (const e of prev)
    if (!live.has(e.id)) next.push({ ...e, status: 'ended', spotlight: e.spotlight === 'none' ? 'none' : 'done' })

  for (const e of next) {
    if (e.spotlight === 'playing' && e.spotlightEnd !== null && now >= e.spotlightEnd) e.spotlight = 'done'
    // Un local que cambió de piso (admin) no puede seguir presentándose en el anterior.
  }
  // Una presentación por piso. Una activación posterior al comienzo de la presentación en curso
  // (p. ej. una tienda que lanza su oferta ahora) la reemplaza; las ofertas que ya estaban vigentes
  // esperan una pausa entre presentaciones para no amontonar visitantes.
  const floors: FloorId[] = visibleFloor === 'all' ? [...new Set(next.map((e) => e.floorId))] : visibleFloor ? [visibleFloor] : []
  for (const floor of floors) {
    const onFloor = next.filter((e) => e.floorId === floor)
    const playing = onFloor.find((e) => e.spotlight === 'playing')
    const lastStart = Math.max(0, ...onFloor.map((e) => e.spotlightStart ?? 0))
    const lastEnd = Math.max(0, ...onFloor.filter((e) => e.spotlight === 'done').map((e) => e.spotlightEnd ?? 0))
    const candidate = onFloor.filter((e) => e.spotlight === 'pending' && e.status === 'active').sort((a, b) => b.startTime - a.startTime)[0]
    const fresh = candidate && candidate.startTime > lastStart
    if (candidate && (fresh || (!playing && now >= lastEnd + SPOTLIGHT_GAP_MS))) {
      if (playing) {
        playing.spotlight = 'done'
        playing.spotlightEnd = now
      }
      candidate.spotlight = 'playing'
      candidate.spotlightStart = now
      candidate.spotlightEnd = now + SPOTLIGHT_MS
    }
  }

  const ended = next.filter((e) => e.status === 'ended')
  const trimmed = ended.length > KEEP_ENDED ? next.filter((e) => e.status !== 'ended' || ended.indexOf(e) >= ended.length - KEEP_ENDED) : next
  return JSON.stringify(trimmed) === JSON.stringify(prev) ? prev : trimmed
}

/** Presentación en curso en un piso (como mucho una). */
export const playingOn = (events: PromotionEvent[], floorId: FloorId) => events.find((e) => e.floorId === floorId && e.spotlight === 'playing')
