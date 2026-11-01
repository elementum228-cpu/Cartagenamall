import { ESCALATOR, worldToEsc, FOOD_LAYOUT, P1, toWorld } from '../config/mall'
import type { FloorId } from '../domain/types'

/**
 * Una luz de recorrido: un halo cálido en el piso (y opcionalmente su luminaria) que hace visibles
 * pasillos, plaza y terraza de noche. No es una luz dinámica: es un material aditivo barato.
 */
export interface PathLight {
  id: string
  floorId: FloorId
  /** (x, z) en coordenadas del piso. */
  position: [number, number]
  color: string
  /** Opacidad del halo a plena noche (0–1). */
  intensity: number
  /** Radio aparente del halo. */
  radius: number
  active: boolean
  /** Luminaria que se dibuja con el halo (los faroles de Decor ya existen: `none`). */
  fixture: 'none' | 'bollard'
}

const WARM = '#ffd29a'
const AMBER = '#ffbf73'

const onEscalator = (wx: number, wz: number) => {
  const [x, z] = worldToEsc(wx, wz)
  return x > ESCALATOR.lanesX[0] - ESCALATOR.width - 0.6 && x < ESCALATOR.lanesX[1] + ESCALATOR.width + 0.6 && z > ESCALATOR.topZ - 1 && z < ESCALATOR.bottomZ + 2.5
}

function p1Lights(): PathLight[] {
  const out: PathLight[] = []
  for (const zone of P1.zones) {
    // bajo los faroles de Decor (mismas posiciones)
    for (const s of [-1, 1])
      for (const z of [11, 21]) {
        const [x, wz] = toWorld([s * 4.2, z], zone.angle)
        out.push({ id: `farol-${zone.id}${s}${z}`, floorId: 'P1', position: [x, wz], color: WARM, intensity: 0.75, radius: 2.3, active: true, fixture: 'none' })
      }
    // eje del pasillo: una "alfombra" de luz que se lee con el zoom alejado
    for (const z of [10.2, 13.6, 17.5, 21]) {
      const [x, wz] = toWorld([0, z], zone.angle)
      out.push({ id: `ruta-${zone.id}${z}`, floorId: 'P1', position: [x, wz], color: WARM, intensity: 0.45, radius: 3.4, active: true, fixture: 'none' })
    }
  }
  // plaza: gran halo alrededor de la fuente, bancas y balizas en las entradas de los pasillos
  out.push({ id: 'plaza', floorId: 'P1', position: [0, 0], color: AMBER, intensity: 0.55, radius: 6.2, active: true, fixture: 'none' })
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    const [x, z] = [Math.sin(a) * 5.2, Math.cos(a) * 5.2]
    if (!onEscalator(x, z)) out.push({ id: `banca-${i}`, floorId: 'P1', position: [x, z], color: WARM, intensity: 0.6, radius: 1.8, active: true, fixture: 'none' })
  }
  for (const zone of P1.zones)
    for (const s of [-1, 1]) {
      const [x, z] = toWorld([s * 3.6, 8.6], zone.angle)
      if (!onEscalator(x, z)) out.push({ id: `baliza-${zone.id}${s}`, floorId: 'P1', position: [x, z], color: AMBER, intensity: 0.7, radius: 1.5, active: true, fixture: 'bollard' })
    }
  return out
}

function p2Lights(): PathLight[] {
  const out: PathLight[] = [
    { id: 'patio', floorId: 'P2', position: [3, 3], color: AMBER, intensity: 0.22, radius: 11, active: true, fixture: 'none' },
    { id: 'terraza', floorId: 'P2', position: [(FOOD_LAYOUT.terrace.x0 + FOOD_LAYOUT.terrace.x1) / 2, (FOOD_LAYOUT.terrace.z0 + FOOD_LAYOUT.terrace.z1) / 2], color: AMBER, intensity: 0.6, radius: 4.2, active: true, fixture: 'none' },
    { id: 'llegada', floorId: 'P2', position: [FOOD_LAYOUT.arrival.x, FOOD_LAYOUT.arrival.z - 1], color: WARM, intensity: 0.6, radius: 2.8, active: true, fixture: 'none' },
  ]
  // frente de los restaurantes del fondo y del costado
  for (const x of [-4, 3, 10]) out.push({ id: `frente-n${x}`, floorId: 'P2', position: [x, -8.4], color: WARM, intensity: 0.55, radius: 2.6, active: true, fixture: 'none' })
  for (const z of [-4, 3, 10]) out.push({ id: `frente-o${z}`, floorId: 'P2', position: [-8.4, z], color: WARM, intensity: 0.55, radius: 2.6, active: true, fixture: 'none' })
  return out
}

export const PATH_LIGHTS: PathLight[] = [...p1Lights(), ...p2Lights()]
