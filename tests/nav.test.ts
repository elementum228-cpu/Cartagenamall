import { describe, expect, it } from 'vitest'
import { ESCALATOR_ENDS, navGrids, pointsOfInterest, type Point } from '../src/world/nav'

describe('navegación de visitantes por los dos pisos', () => {
  const grids = navGrids()
  const pois = pointsOfInterest()

  it('hay lugares de interés en ambos pisos y los extremos de las escaleras están libres', () => {
    expect(pois.filter((p) => p.floorId === 'P1').length).toBeGreaterThan(15)
    expect(pois.filter((p) => p.floorId === 'P2').length).toBeGreaterThan(8)
    expect(grids.P1.isFree(...ESCALATOR_ENDS.upStart)).toBe(true)
    expect(grids.P1.isFree(...ESCALATOR_ENDS.downEnd)).toBe(true)
    expect(grids.P2.isFree(...ESCALATOR_ENDS.upEnd)).toBe(true)
    expect(grids.P2.isFree(...ESCALATOR_ENDS.downStart)).toBe(true)
  })

  it('desde las escaleras se llega a cada lugar de su piso sin atravesar obstáculos', () => {
    for (const poi of pois) {
      const grid = grids[poi.floorId]
      const from: Point = poi.floorId === 'P1' ? ESCALATOR_ENDS.downEnd : ESCALATOR_ENDS.upEnd
      const to: Point = poi.floorId === 'P1' ? ESCALATOR_ENDS.upStart : ESCALATOR_ENDS.downStart
      for (const [a, b] of [[from, poi.point], [poi.point, to]] as [Point, Point][]) {
        const path = grid.path(a, b)
        expect(path, `${poi.floorId} ${a} → ${b}`).not.toBeNull()
        for (let i = 1; i < path!.length; i++) expect(grid.lineFree(path![i - 1], path![i]), `${poi.floorId} tramo ${path![i - 1]} → ${path![i]}`).toBe(true)
      }
    }
  })
})

describe('cobertura', () => {
  it('casi todos los locales tienen un punto alcanzable al frente', () => {
    const pois = pointsOfInterest()
    expect(pois.filter((p) => p.floorId === 'P1').length).toBeGreaterThanOrEqual(20)
    expect(pois.filter((p) => p.floorId === 'P2').length).toBeGreaterThanOrEqual(10)
  })
})
