import { describe, expect, it } from 'vitest'
import { GOAL_SHOW_MS, matchClock, matchSeconds, cleanMatch, emptyMatch, finishMatch, goalActive, matchLabel, matchMinute, nudgeMinute, pauseHalf, resumeMatch, scoreGoal, startMatch, undoGoal } from '../src/stadium/match'

const T = 1_700_000_000_000
const min = (n: number) => n * 60_000

describe('marcador en vivo', () => {
  it('antes de empezar: 0-0 por empezar', () => {
    const m = emptyMatch()
    expect(matchLabel(m, T)).toBe('POR EMPEZAR')
    expect(matchMinute(m, T)).toBe(0)
  })
  it('el reloj corre solo desde que se inicia el tiempo', () => {
    const m = startMatch(emptyMatch(), T)
    expect(matchMinute(m, T)).toBe(0)
    expect(matchMinute(m, T + min(12) + 5000)).toBe(12)
    expect(matchLabel(m, T + min(78) + 23_000)).toBe('EN VIVO · 78:23')
    // el reloj avanza segundo a segundo
    expect(matchClock(m, T + 59_000)).toBe('00:59')
    expect(matchClock(m, T + 60_000)).toBe('01:00')
    expect(matchSeconds(m, T + 61_500)).toBe(61)
  })
  it('medio tiempo detiene el reloj y el segundo tiempo arranca en el 45', () => {
    let m = startMatch(emptyMatch(), T)
    m = pauseHalf(m, T + min(46))
    expect(m.status).toBe('half')
    expect(matchMinute(m, T + min(100))).toBe(45)
    m = resumeMatch(m, T + min(70))
    expect(matchMinute(m, T + min(70))).toBe(45)
    expect(matchMinute(m, T + min(80))).toBe(55)
  })
  it('final deja el minuto fijo', () => {
    let m = startMatch(emptyMatch(), T)
    m = finishMatch(m, T + min(91))
    expect(m.status).toBe('final')
    expect(matchMinute(m, T + min(500))).toBe(91)
    expect(matchLabel(m, T)).toBe('FINAL · 91:00')
  })
  it('un gol suma, avisa y cuenta; anular baja sin aviso', () => {
    let m = startMatch(emptyMatch(), T)
    m = scoreGoal(m, 'home', T + 1000)
    expect(m.home).toBe(1)
    expect(m.goal).toEqual({ side: 'home', n: 1, at: T + 1000 })
    m = scoreGoal(m, 'away', T + 2000)
    expect(m.goal?.n).toBe(2)
    m = undoGoal(m, 'home')
    expect(m.home).toBe(0)
    expect(m.goal?.n).toBe(2) // anular no dispara nada
    expect(undoGoal(m, 'home').home).toBe(0) // nunca negativo
  })
  it('el aviso de gol dura un rato', () => {
    const m = scoreGoal(emptyMatch(), 'home', T)
    expect(goalActive(m, T + 1000)).toBe('home')
    expect(goalActive(m, T + GOAL_SHOW_MS + 1)).toBeNull()
    expect(goalActive(emptyMatch(), T)).toBeNull()
  })
  it('se puede corregir el minuto', () => {
    let m = startMatch(emptyMatch(), T)
    m = nudgeMinute(m, T + min(10), +5)
    expect(matchMinute(m, T + min(10))).toBe(15)
    expect(matchMinute(nudgeMinute(emptyMatch(), T, -3), T)).toBe(0)
  })
  it('limpia datos raros de la base de datos', () => {
    expect(cleanMatch(undefined)).toEqual(emptyMatch())
    const c = cleanMatch({ status: 'live', home: 3.7, away: -2, since: 'x', goal: { side: 'zzz', n: 1, at: 1 } })
    expect(c.home).toBe(3)
    expect(c.away).toBe(0)
    expect(c.since).toBeNull()
    expect(c.goal).toBeNull()
  })
})
