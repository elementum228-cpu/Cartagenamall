import { describe, expect, it } from 'vitest'
import { CINE_STAIR, cinemaGrid, cinemaPois, ESCALATOR_ENDS, navGrids, pointsOfInterest } from '../src/world/nav'

describe('navegación al cine', () => {
  it('del centro del piso 2 se llega al pie del hueco de la escalera', () => {
    const { P2 } = navGrids()
    const path = P2.path(ESCALATOR_ENDS.upEnd, CINE_STAIR.p2Entry)
    expect(path).not.toBeNull()
    const last = path![path!.length - 1]
    expect(Math.hypot(last[0] - CINE_STAIR.p2Entry[0], last[1] - CINE_STAIR.p2Entry[1])).toBeLessThan(0.5)
  })

  it('del pie de la escalera se llega a los lugares de la plaza', () => {
    const grid = cinemaGrid()
    const pois = cinemaPois()
    expect(pois.length).toBeGreaterThanOrEqual(6)
    for (const p of pois) expect(grid.path(CINE_STAIR.plazaEntry, p.point)).not.toBeNull()
  })

  it('el piso 2 sigue teniendo lugares donde pasear', () => {
    expect(pointsOfInterest().filter((p) => p.floorId === 'P2').length).toBeGreaterThan(10)
  })
})
