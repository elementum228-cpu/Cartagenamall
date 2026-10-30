import { describe, expect, it } from 'vitest'
import { COURT_SPACE, SPACES, SPACE_TYPES } from '../src/config/mall'
import { spacePrice, typePrice, validPrice } from '../src/state/spacePricing'

describe('precios de los espacios', () => {
  const local = SPACES.find((s) => s.type === 'local')!
  it('sin ajustes rige el precio de referencia del tipo', () => {
    expect(spacePrice({ types: {}, spaces: {} }, local)).toBe(SPACE_TYPES.local.monthlyPriceCOP)
    expect(spacePrice({ types: {}, spaces: {} }, COURT_SPACE)).toBe(SPACE_TYPES.court.monthlyPriceCOP)
  })
  it('el precio del tipo aplica a todos sus espacios', () => {
    const p = { types: { local: 99_000 }, spaces: {} }
    expect(typePrice(p, 'local')).toBe(99_000)
    expect(spacePrice(p, local)).toBe(99_000)
  })
  it('el precio propio de un espacio gana sobre el del tipo', () => {
    const p = { types: { local: 99_000 }, spaces: { [local.id]: 55_000 } }
    expect(spacePrice(p, local)).toBe(55_000)
    const other = SPACES.find((s) => s.type === 'local' && s.id !== local.id)!
    expect(spacePrice(p, other)).toBe(99_000)
  })
  it('valida precios', () => {
    expect(validPrice(0)).toBe(false)
    expect(validPrice(NaN)).toBe(false)
    expect(validPrice(120_000)).toBe(true)
  })
})
