import { describe, expect, it } from 'vitest'
import { isNightHour, skyAt } from '../src/lib/daylight'

const at = (h: number, m = 0) => skyAt(new Date(2026, 10, 8, h, m))

describe('ciclo del día', () => {
  it('a mediodía es de día y de madrugada es de noche', () => {
    expect(at(12)).toEqual({ night: 0, warm: 0 })
    expect(at(14, 30).night).toBe(0)
    expect(at(2).night).toBe(1)
    expect(at(23).night).toBe(1)
  })
  it('desde las 4 de la tarde el naranja crece poco a poco, antes de que anochezca', () => {
    const ws = [15, 15.75, 16.25, 16.75, 17.25, 17.75].map((h) => at(Math.floor(h), Math.round((h % 1) * 60)).warm)
    expect(ws[0]).toBe(0)
    for (let i = 1; i < ws.length; i++) expect(ws[i]).toBeGreaterThanOrEqual(ws[i - 1])
    expect(at(16, 30).warm).toBeGreaterThan(0.1)
    expect(at(16, 30).night).toBe(0)
    expect(at(17, 45).warm).toBeGreaterThan(0.9)
  })
  it('anochece gradualmente entre las 5:30 y las 7 p. m., y el naranja se apaga', () => {
    const ns = [17.5, 18, 18.25, 18.5, 18.75, 19].map((h) => at(Math.floor(h), Math.round((h % 1) * 60)).night)
    for (let i = 1; i < ns.length; i++) expect(ns[i]).toBeGreaterThanOrEqual(ns[i - 1])
    expect(ns[0]).toBe(0)
    expect(ns[ns.length - 1]).toBe(1)
    expect(at(19, 30).warm).toBe(0)
  })
  it('de madrugada aclara poco a poco con un amanecer anaranjado y sale el día', () => {
    const ns = [5, 5.5, 6, 6.5].map((h) => at(Math.floor(h), Math.round((h % 1) * 60)).night)
    expect(ns[0]).toBe(1)
    for (let i = 1; i < ns.length; i++) expect(ns[i]).toBeLessThanOrEqual(ns[i - 1])
    expect(ns[ns.length - 1]).toBe(0)
    expect(at(5, 50).warm).toBeGreaterThan(0.8)
    expect(at(8).warm).toBe(0)
  })
  it('nunca se sale de 0 a 1 en todo el día', () => {
    for (let m = 0; m < 24 * 60; m += 5) {
      const s = at(Math.floor(m / 60), m % 60)
      expect(s.night).toBeGreaterThanOrEqual(0)
      expect(s.night).toBeLessThanOrEqual(1)
      expect(s.warm).toBeGreaterThanOrEqual(0)
      expect(s.warm).toBeLessThanOrEqual(1)
    }
  })
  it('isNightHour: de noche después de las 6:30 p. m. y antes del amanecer', () => {
    expect(isNightHour(new Date(2026, 10, 8, 20))).toBe(true)
    expect(isNightHour(new Date(2026, 10, 8, 4))).toBe(true)
    expect(isNightHour(new Date(2026, 10, 8, 10))).toBe(false)
    expect(isNightHour(new Date(2026, 10, 8, 17))).toBe(false)
  })
})
