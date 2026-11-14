import { describe, expect, it } from 'vitest'
import { ROUND_SECONDS, createGame, fallSpeed, makeRand, spawnGap, update, H, W } from '../src/arcade/engine'
import { ARCADE_REWARDS, DAILY_POINTS_CAP, MAX_POINTS_PER_RUN, awardFor, useArcade } from '../src/arcade/store'

const still = { targetX: null, dir: 0 }

describe('motor de Nave Caribe', () => {
  it('es repetible con la misma semilla', () => {
    const run = () => {
      const g = createGame(makeRand(7))
      for (let i = 0; i < 600; i++) update(g, 1 / 60, { targetX: W / 2 + Math.sin(i / 20) * 100, dir: 0 })
      return [g.score, g.lives, g.kills]
    }
    expect(run()).toEqual(run())
  })

  it('la nave dispara sola y se queda dentro del campo', () => {
    const g = createGame(makeRand(1))
    update(g, 0.3, { targetX: null, dir: -1 })
    expect(g.bullets.some((b) => b.on)).toBe(true)
    for (let i = 0; i < 300; i++) update(g, 1 / 60, { targetX: null, dir: -1 })
    expect(g.shipX).toBeGreaterThanOrEqual(0)
    for (let i = 0; i < 300; i++) update(g, 1 / 60, { targetX: null, dir: 1 })
    expect(g.shipX).toBeLessThanOrEqual(W)
  })

  it('un puntito alcanzado por una bala suma puntaje', () => {
    const g = createGame(makeRand(3))
    const e = g.enemies[0]
    Object.assign(e, { on: true, kind: 0, x: g.shipX, baseX: g.shipX, y: 300, vy: 0, hp: 1, amp: 0 })
    g.spawnIn = 99
    for (let i = 0; i < 120 && g.score === 0; i++) update(g, 1 / 60, still)
    expect(g.score).toBe(10)
  })

  it('chocar quita una vida, da invulnerabilidad y a la tercera termina', () => {
    const g = createGame(makeRand(5))
    g.spawnIn = 99
    g.fireIn = 99
    const hit = () => Object.assign(g.enemies.find((x) => !x.on)!, { on: true, kind: 0, x: g.shipX, baseX: g.shipX, y: 548, vy: 0, hp: 1, amp: 0 })
    hit()
    update(g, 1 / 60, still)
    expect(g.lives).toBe(2)
    hit()
    update(g, 1 / 60, still)
    expect(g.lives).toBe(2) // invulnerable
    g.invuln = 0
    hit()
    update(g, 1 / 60, still)
    g.invuln = 0
    hit()
    update(g, 1 / 60, still)
    expect(g.over).toBe(true)
  })

  it('la ronda termina sola a los 90 s aunque la nave no muera', () => {
    const g = createGame(makeRand(2))
    g.lives = 999
    for (let i = 0; i < (ROUND_SECONDS + 2) * 60 && !g.over; i++) update(g, 1 / 60, still)
    expect(g.over).toBe(true)
    expect(g.time).toBeGreaterThanOrEqual(ROUND_SECONDS)
  })

  it('la dificultad sube con tope y no se crean objetos nuevos (piscinas fijas)', () => {
    expect(spawnGap(0)).toBeGreaterThan(spawnGap(40))
    expect(spawnGap(1000)).toBe(0.3)
    expect(fallSpeed(1000)).toBe(190)
    const g = createGame(makeRand(9))
    const sizes = [g.bullets.length, g.enemies.length, g.parts.length]
    for (let i = 0; i < 3000 && !g.over; i++) update(g, 1 / 60, { targetX: (i * 7) % W, dir: 0 })
    expect([g.bullets.length, g.enemies.length, g.parts.length]).toEqual(sizes)
    expect(g.enemies.every((e) => !e.on || e.y < H + 40)).toBe(true)
  })
})

describe('puntos y premios del Arcade', () => {
  it('1 punto por cada 10, con tope por partida y por día', () => {
    expect(awardFor(0, 0)).toBe(0)
    expect(awardFor(95, 0)).toBe(9)
    expect(awardFor(100_000, 0)).toBe(MAX_POINTS_PER_RUN)
    expect(awardFor(100_000, DAILY_POINTS_CAP - 10)).toBe(10)
    expect(awardFor(100_000, DAILY_POINTS_CAP)).toBe(0)
  })

  it('registra partidas, récord y canjea con código sin dejar saldo negativo', () => {
    useArcade.setState({ points: 0, lifetime: 0, best: 0, plays: 0, earnedToday: 0, redemptions: [] })
    const r1 = useArcade.getState().finishRun(300)
    expect(r1).toMatchObject({ awarded: 30, record: true, capped: false })
    expect(useArcade.getState().redeem(ARCADE_REWARDS[0].id)).toBeNull() // 30 < 100
    useArcade.setState({ points: 120 })
    const red = useArcade.getState().redeem(ARCADE_REWARDS[0].id)!
    expect(red.code).toMatch(/^CM-/)
    expect(useArcade.getState().points).toBe(20)
    expect(useArcade.getState().finishRun(100).record).toBe(false)
  })
})
