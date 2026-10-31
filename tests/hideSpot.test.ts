import { describe, expect, it } from 'vitest'
import { SPACES, spaceFrontPoint } from '../src/config/mall'
import type { Promotion } from '../src/domain/types'
import { buildPromotion } from '../src/promotions/build'
import { canHideAt, describeHideSpot, hideSpot, hideSpotZone, resolveHideSpot } from '../src/promotions/hideSpot'

const base: Promotion = {
  id: 'S1',
  type: 'secret',
  storeId: 'ST1',
  productId: 'P1',
  title: 'x',
  description: '',
  discountPercent: 20,
  code: 'ABC',
  startsAt: new Date(0).toISOString(),
  endsAt: null,
  active: true,
}

describe('escondites de promociones', () => {
  it('acepta plaza y pasillos, rechaza locales, la fuente y fuera del mall', () => {
    expect(canHideAt('P1', 6, 6)).toBe(true)
    expect(canHideAt('P1', 0, 0)).toBe(false) // fuente
    expect(canHideAt('P1', 40, 40)).toBe(false)
    const sp = SPACES.find((s) => s.floorId === 'P1')!
    expect(canHideAt('P1', sp.position[0], sp.position[1])).toBe(false)
    expect(canHideAt('P2', 0, 0)).toBe(canHideAt('P2', 0, 0)) // estable
    expect(canHideAt('NOPE', 1, 1)).toBe(false)
  })

  it('un punto frente a un local del pasillo cae en su pasillo', () => {
    const sp = SPACES.find((s) => s.floorId === 'P1' && s.zoneId === 'C')!
    const [x, z] = spaceFrontPoint(sp, 1.5)
    expect(canHideAt('P1', x, z)).toBe(true)
    expect(hideSpotZone(hideSpot('P1', x, z))).toBe('C')
    expect(describeHideSpot(hideSpot('P1', 5, 5))).toMatch(/Plaza central/)
  })

  it('usa el escondite elegido y, si no hay o no es válido, el local', () => {
    const at = resolveHideSpot({ ...base, hideAt: { floorId: 'P1', x: 6, z: 6 } }, {})
    expect(at?.at).toEqual([6, 6])
    const sp = SPACES[0]
    const near = resolveHideSpot({ ...base, hideAt: { floorId: 'P1', x: 0, z: 0 } }, { ST1: sp.id })
    expect(near?.floorId).toBe(sp.floorId)
    expect(near?.hintAt).toEqual(sp.position)
    expect(resolveHideSpot(base, {})).toBeNull()
  })

  it('buildPromotion guarda el escondite solo en las escondidas', () => {
    const d = { type: 'secret' as const, storeId: 'ST1', productId: 'P1', productName: 'p', discountPercent: 20, title: '', minutes: 30, code: 'abc', hideAt: hideSpot('P1', 6.04, 6.06) }
    expect(buildPromotion(d, 1, new Set()).hideAt).toEqual({ floorId: 'P1', x: 6, z: 6.1 })
    expect(buildPromotion({ ...d, type: 'flash' }, 1, new Set()).hideAt).toBeUndefined()
  })
})
