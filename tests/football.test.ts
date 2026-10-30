import { describe, expect, it } from 'vitest'
import { COURT, FENCE_X, FENCE_Z, HALF_L, HALF_W, demoTaken } from '../src/football/config'
import { MatchSim } from '../src/football/match'

describe('simulación de fútbol 5', () => {
  it('dos equipos de 5 con un arquero cada uno', () => {
    const m = new MatchSim(3)
    expect(m.players).toHaveLength(10)
    expect(m.players.filter((p) => p.team === 0)).toHaveLength(5)
    expect(m.players.filter((p) => p.keeper)).toHaveLength(2)
  })

  it('en 5 minutos hay pases, remates, goles y reinicios; nadie sale ni entra a los arcos', () => {
    for (const seed of [1, 7, 42]) {
      const m = new MatchSim(seed)
      let owners = new Set<number>()
      let goals = 0
      let lastPhase = m.phase
      let resets = 0
      let outside = 0
      for (let k = 0; k < 60 * 300; k++) {
        m.step(1 / 60)
        if (m.ball.owner !== null) owners.add(m.ball.owner)
        if (m.phase !== lastPhase) {
          if (m.phase === 'goal') goals++
          if (m.phase === 'reset') resets++
          lastPhase = m.phase
        }
        for (const p of m.players) if (Math.abs(p.x) > HALF_L - 0.29 || Math.abs(p.z) > HALF_W + 0.51) outside++
        if (Math.abs(m.ball.x) >= FENCE_X || Math.abs(m.ball.z) >= FENCE_Z) outside++
      }
      expect(outside, `seed ${seed}: fuera de límites`).toBe(0)
      expect(owners.size, `seed ${seed}: jugadores que tocaron el balón`).toBeGreaterThanOrEqual(8)
      expect(goals, `seed ${seed}: goles`).toBeGreaterThanOrEqual(2)
      expect(resets).toBeGreaterThanOrEqual(goals)
      owners = new Set()
    }
  }, 30_000)

  it('cuando hay gol, el balón está dentro del arco', () => {
    const m = new MatchSim(11)
    let checked = 0
    let prev = m.phase
    for (let k = 0; k < 60 * 300 && checked < 3; k++) {
      m.step(1 / 60)
      if (m.phase === 'goal' && prev !== 'goal') {
        expect(Math.abs(m.ball.x)).toBeGreaterThan(HALF_L)
        expect(Math.abs(m.ball.z)).toBeLessThan(COURT.goal.width / 2)
        checked++
      }
      prev = m.phase
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('horarios de demostración: determinísticos', () => {
    expect(demoTaken('2026-11-01', 19)).toBe(demoTaken('2026-11-01', 19))
  })
})
