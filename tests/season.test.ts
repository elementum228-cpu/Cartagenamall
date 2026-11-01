import { describe, expect, it } from 'vitest'
import { resolveSeason, seasonByDate } from '../src/state/season'

describe('temporadas', () => {
  it('Halloween va del 15 de octubre al 2 de noviembre', () => {
    expect(seasonByDate(new Date(2026, 9, 14))).toBe('none')
    expect(seasonByDate(new Date(2026, 9, 15))).toBe('halloween')
    expect(seasonByDate(new Date(2026, 9, 31))).toBe('halloween')
    expect(seasonByDate(new Date(2026, 10, 2))).toBe('halloween')
    expect(seasonByDate(new Date(2026, 10, 3))).toBe('none')
    expect(seasonByDate(new Date(2026, 5, 1))).toBe('none')
  })
  it('la elección del administrador manda sobre la fecha', () => {
    expect(resolveSeason('none', new Date(2026, 9, 31))).toBe('none')
    expect(resolveSeason('halloween', new Date(2026, 5, 1))).toBe('halloween')
    expect(resolveSeason('auto', new Date(2026, 9, 31))).toBe('halloween')
  })
})
