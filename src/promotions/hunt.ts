import { FLOORS, FOOD_LAYOUT, toWorld } from '../config/mall'
import { canHideAt } from './hideSpot'

// Búsqueda del tesoro semanal: tres pistas encadenadas escondidas en el mall. Encontrar una revela
// la siguiente; la tercera da el sello «Tesoro» del pasaporte. Cada semana (de lunes a domingo) el
// recorrido cambia solo, el mismo para todos.

export interface HuntSpot {
  id: string
  floorId: string
  x: number
  z: number
  /** Acertijo que lleva hasta aquí. */
  clue: string
}

const P1 = FLOORS[0]

/** Escondites posibles, con su acertijo. Solo se usan los que caen sobre zonas caminables. */
export const HUNT_SPOTS: HuntSpot[] = [
  { id: 'fuente', floorId: 'P1', x: 4.6, z: 4.6, clue: 'Donde el agua canta en el corazón de la plaza, del lado que mira a la puerta de la muralla.' },
  { id: 'plaza-fondo', floorId: 'P1', x: -6.5, z: -6.5, clue: 'En la esquina de la plaza más lejana a la entrada, donde casi nadie mira.' },
  ...P1.zones.flatMap((z) => {
    const [mx, mz] = toWorld([0, 16], z.angle)
    const [ex, ez] = toWorld([2.5, 20.5], z.angle)
    return [
      { id: `medio-${z.id}`, floorId: 'P1', x: mx, z: mz, clue: `En medio del pasillo ${z.id}, entre las vitrinas de ${z.name.toLowerCase()}.` },
      { id: `fin-${z.id}`, floorId: 'P1', x: ex, z: ez, clue: `Al final del pasillo de ${z.name.toLowerCase()}, donde ya no quedan más vitrinas.` },
    ]
  }),
  { id: 'escaleras-p2', floorId: 'P2', x: FOOD_LAYOUT.arrival.x - 1.5, z: FOOD_LAYOUT.arrival.z - 2.5, clue: 'Sube: justo donde te dejan las escaleras eléctricas en el Piso 2.' },
  { id: 'terraza', floorId: 'P2', x: (FOOD_LAYOUT.terrace.x0 + FOOD_LAYOUT.terrace.x1) / 2 + 1, z: (FOOD_LAYOUT.terrace.z0 + FOOD_LAYOUT.terrace.z1) / 2 + 1, clue: 'Arriba, bajo la pérgola de la terraza, donde se come mirando la muralla.' },
].filter((s) => canHideAt(s.floorId, s.x, s.z))

export const HUNT_LENGTH = 3
const WEEK_MS = 7 * 24 * 3600 * 1000
/** Lunes 5 de enero de 2026, 00:00 hora de Colombia (UTC−5). */
const EPOCH = Date.UTC(2026, 0, 5, 5)

/** Número de semana de la búsqueda (cambia los lunes a medianoche, hora de Colombia). */
export const huntWeek = (now: number) => Math.floor((now - EPOCH) / WEEK_MS)
/** Cuándo termina la búsqueda de esa semana. */
export const huntEndsAt = (week: number) => EPOCH + (week + 1) * WEEK_MS

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Las tres pistas de la semana, en orden; siempre en lugares distintos y sin dos seguidas en la misma zona. */
export function huntFor(week: number): HuntSpot[] {
  const r = rng(week * 2654435761 + 97)
  const pool = [...HUNT_SPOTS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const area = (s: HuntSpot) => s.id.replace(/^(medio|fin)-/, '')
  const out: HuntSpot[] = []
  for (const s of pool) {
    if (out.length === HUNT_LENGTH) break
    if (out.some((o) => area(o) === area(s))) continue
    out.push(s)
  }
  return out
}
