import { describe, expect, it } from 'vitest'
import type { StadiumPhase } from '../src/config/stadium'
import { BASE, N, at, built, segBuilt } from '../src/world/stadiumGeometry'

const PHASES: StadiumPhase[] = ['construction', 'almost', 'open']

describe('geometría del estadio', () => {
  it('el contorno tiene puntos y cierra en sí mismo', () => {
    expect(N).toBe(BASE.length)
    expect(Math.hypot(BASE[0].x - BASE[N - 1].x, BASE[0].z - BASE[N - 1].z)).toBeLessThan(1e-6)
  })

  it('ningún estado falla al recorrer todo el contorno, ni siquiera un punto pasado el final', () => {
    for (const phase of PHASES)
      for (let i = -2; i <= N + 3; i++) {
        expect(() => built(i, phase)).not.toThrow()
        expect(() => segBuilt(i, phase)).not.toThrow()
        const [x, z] = at(i, 3)
        expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true)
      }
  })

  it('en obra queda más por construir que casi terminado, y inaugurado está completo', () => {
    const count = (phase: StadiumPhase) => Array.from({ length: N - 1 }, (_, i) => segBuilt(i, phase)).filter(Boolean).length
    expect(count('construction')).toBeLessThan(count('almost'))
    expect(count('almost')).toBeLessThan(count('open'))
    expect(count('open')).toBe(N - 1)
  })
})
