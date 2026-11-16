import { describe, expect, it } from 'vitest'
import { normalizeCode, rawRewardId } from '../src/arcade/vouchers'

describe('bonos del arcade', () => {
  it('normaliza el código tecleado', () => {
    expect(normalizeCode('cm q9gm8c')).toBe('CM-Q9GM8C')
    expect(normalizeCode('CM-Q9GM8C')).toBe('CM-Q9GM8C')
    expect(normalizeCode(' q9gm8c ')).toBe('CM-Q9GM8C')
  })
  it('quita el prefijo de tienda del premio', () => {
    expect(rawRewardId({ storeId: 'STORE-1', rewardId: 'STORE-1:r1' })).toBe('r1')
    expect(rawRewardId({ rewardId: 'r1' })).toBe('r1')
  })
})
