import { describe, expect, it } from 'vitest'
import { P1, SPACE_BY_ID, VIEWING_SPOTS, toWorld } from '../src/config/mall'
import { interiorCapacity, planStoreVisit, planVisit, toLocal, toStore, type Point } from '../src/promotions/paths'

// Obstáculos del pasillo en coordenadas locales (islas, jardinera, bancas, faroles, locales), con el
// radio del visitante ya sumado.
const R = 0.25
const rects: [number, number, number, number][] = [
  [-1.3, 1.3, 11.2, 13.8], // isla 1
  [-1.3, 1.3, 18.2, 20.8], // isla 4
  [-0.6, 0.6, 14.7, 17.3], // jardinera
  [0.87, 1.43, 15.2, 16.8], // bancas
  [-1.43, -0.87, 15.2, 16.8],
  [-99, -4.5, 13, 19], // local 2
  [4.5, 99, 13, 19], // local 3
  [-5.5, 5.5, 21.8, 29], // premium
].map(([x0, x1, z0, z1]) => [x0 - R, x1 + R, z0 - R, z1 + R])
const lamps: Point[] = [[4.2, 11], [-4.2, 11], [4.2, 21], [-4.2, 21]]

const blocked = ([x, z]: Point) =>
  rects.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1) || lamps.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 0.15 + R)

describe('recorridos de visitantes', () => {
  it('ningún tramo atraviesa islas, jardineras, bancas, faroles ni locales', () => {
    for (const zone of P1.zones)
      for (const n of [1, 2, 3, 4, 5])
        for (const lane of [-2.85, -2.55, -2.25, -1.95, 1.95, 2.25, 2.55, 2.85])
          for (const z of [8, 12, 16, 21])
            for (let slot = 0; slot < VIEWING_SPOTS[n].spots.length; slot++) {
              const plan = planVisit(`P1-${zone.id}${n}`, toWorld([lane, z], zone.angle), slot)!
              expect(plan).not.toBeNull()
              const local = plan.path.map((p) => toLocal(p, zone.angle))
              for (let i = 1; i < local.length; i++)
                for (let k = 0; k <= 20; k++) {
                  const a = local[i - 1]
                  const b = local[i]
                  const p: Point = [a[0] + ((b[0] - a[0]) * k) / 20, a[1] + ((b[1] - a[1]) * k) / 20]
                  expect(blocked(p), `${zone.id}${n} carril ${lane} z ${z} punto ${p}`).toBe(false)
                }
              // termina en el punto de observación
              const end = local[local.length - 1]
              const spot = VIEWING_SPOTS[n].spots[slot]
              expect(Math.hypot(end[0] - spot[0], end[1] - spot[1])).toBeLessThan(1e-6)
            }
  })

  it('los puntos de observación de una vitrina están separados (sin aglomeraciones)', () => {
    for (const { spots } of Object.values(VIEWING_SPOTS))
      for (let i = 0; i < spots.length; i++)
        for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1])).toBeGreaterThan(0.75)
  })

  it('cada vitrina tiene 15 puntos de observación', () => {
    for (const { spots } of Object.values(VIEWING_SPOTS)) expect(spots).toHaveLength(15)
  })

  it('no reutiliza puntos: más visitantes que puntos no se amontonan', () => {
    expect(planVisit('P1-D5', toWorld([2.4, 12], -Math.PI / 2), VIEWING_SPOTS[5].spots.length)).toBeNull()
  })

  it('no hay recorrido para la terraza del piso 2 (sin carriles)', () => {
    expect(planVisit('P2-E1', [0, 0], 0)).toBeNull()
  })
})

describe('entrar al local durante una promoción', () => {
  // Obstáculos dentro del local (coordenadas del local), con el radio del visitante.
  const inside: Record<'local' | 'premium', { rects: [number, number, number, number][]; circles: [number, number, number][] }> = {
    local: {
      rects: [[-99, 99, -99, -1.45], [0.85, 2.55, -0.6, 0.2]],
      circles: [[1.88, 1.65, 0.35], [-1.88, 1.65, 0.35]],
    },
    premium: {
      rects: [[-99, 99, -99, -2.45], [-2.1, 0.1, -0.3, 0.9], [3.35, 5.05, -0.6, 0.2]],
      circles: [[2.36, 2.65, 0.35], [4.46, 2.65, 0.35], [-2.36, 2.65, 0.35], [-4.46, 2.65, 0.35]],
    },
  }
  const TT = 0.22

  it('entran por la puerta y no atraviesan vitrinas, mostrador, mesa, estantería ni paredes', () => {
    for (const zone of P1.zones)
      for (const n of [2, 3, 5]) {
        const id = `P1-${zone.id}${n}`
        const sp = SPACE_BY_ID[id]
        const [w, d] = sp.size
        const kind = sp.type as 'local' | 'premium'
        const glassW = kind === 'premium' ? w * 0.34 : w * 0.3
        const doorW = w - 2 * TT - 2 * glassW
        for (const spot of VIEWING_SPOTS[n].spots)
          for (let slot = 0; slot < interiorCapacity(id); slot++) {
            const plan = planStoreVisit(id, toWorld(spot, zone.angle), slot)!
            expect(plan).not.toBeNull()
            for (let i = 1; i < plan.path.length; i++)
              for (let k = 0; k <= 30; k++) {
                const a = plan.path[i - 1]
                const b = plan.path[i]
                const p: Point = [a[0] + ((b[0] - a[0]) * k) / 30, a[1] + ((b[1] - a[1]) * k) / 30]
                const [x, z] = toStore(p, id)
                const where = `${id} desde ${spot} lugar ${slot}: (${x.toFixed(2)}, ${z.toFixed(2)})`
                if (Math.abs(x) < w / 2 + R && z < d / 2 + 0.05 && z > -d / 2 - R) {
                  // dentro (o cruzando la fachada): solo por la puerta, lejos de muebles y paredes
                  if (z > d / 2 - 0.45) expect(Math.abs(x), `fachada ${where}`).toBeLessThan(doorW / 2 - R)
                  expect(Math.abs(x), `pared ${where}`).toBeLessThan(w / 2 - TT - R)
                  const ob = inside[kind]
                  const hit =
                    ob.rects.some(([x0, x1, z0, z1]) => x > x0 - R && x < x1 + R && z > z0 - R && z < z1 + R) ||
                    ob.circles.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + R)
                  expect(hit, `mueble ${where}`).toBe(false)
                } else {
                  // afuera: obstáculos del pasillo (salvo el propio local, al que se entra por la puerta)
                  const local = toLocal(p, zone.angle)
                  const own = n === 2 ? 5 : n === 3 ? 6 : 7
                  const others = rects.filter((_, ri) => ri !== own)
                  const hit = others.some(([x0, x1, z0, z1]) => local[0] > x0 && local[0] < x1 && local[1] > z0 && local[1] < z1) || lamps.some(([lx, lz]) => Math.hypot(local[0] - lx, local[1] - lz) < 0.15 + R)
                  expect(hit, `pasillo ${where}`).toBe(false)
                }
              }
          }
      }
  })

  it('las islas no tienen interior: todo el grupo espera afuera', () => {
    expect(interiorCapacity('P1-A1')).toBe(0)
    expect(planStoreVisit('P1-A1', [0, 0], 0)).toBeNull()
  })
})
