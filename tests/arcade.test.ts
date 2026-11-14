import { describe, expect, it } from 'vitest'
import { MAX_STEPS, ROUND_SECONDS, STEP, createGame, createRecorder, fallSpeed, fsin, makeRand, replay, spawnGap, update, H, W, type Input } from '../src/arcade/engine'
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

describe('ranking del Arcade (cliente)', () => {
  it('limpia el apodo como lo hace la base y genera uno por defecto estable', async () => {
    const { cleanNick, defaultNick } = await import('../src/arcade/board')
    expect(cleanNick('  <b>Ana   Luz</b> ')).toBe('bAna Luzb')
    expect(cleanNick('Ñandú_92')).toBe('Ñandú_92')
    expect(cleanNick('x'.repeat(40))).toHaveLength(16)
    expect(defaultNick('abc')).toBe(defaultNick('abc'))
    expect(defaultNick('abc')).toMatch(/^Jugador\d{4}$/)
  })

  it('un apodo demasiado corto vuelve al apodo por defecto', () => {
    useArcade.setState({ nickname: '' })
    const id = useArcade.getState().playerId
    expect(useArcade.getState().setNickname('a')).toMatch(/^Jugador\d{4}$/)
    expect(useArcade.getState().setNickname('Capitán')).toBe('Capitán')
    expect(id).toBeTruthy()
  })

  it('guarda las 5 mejores partidas del dispositivo, de mayor a menor', () => {
    useArcade.setState({ localBest: [], earnedToday: 0 })
    for (const s of [120, 900, 40, 500, 300, 700, 10]) useArcade.getState().finishRun(s)
    expect(useArcade.getState().localBest.map((b) => b.score)).toEqual([900, 700, 500, 300, 120])
  })

  it('sin base de datos conectada, el ranking en línea devuelve null y no rompe', async () => {
    const { fetchBoard, fetchMyPrize, fetchWinners, finishRun, startRun } = await import('../src/arcade/board')
    expect(await fetchBoard('week', 'x', true)).toBeNull()
    expect(await startRun('x')).toBeNull()
    expect(await finishRun('x', { runId: 'r', seed: 1 }, 'Ana', [])).toBeNull()
    expect(await fetchWinners()).toBeNull()
    expect(await fetchMyPrize('x')).toBeNull()
  })
})

/** Juega como el navegador (anota entradas y avanza a paso fijo) y devuelve la partida y su registro. */
function play(seed: number, pick: (step: number) => Input) {
  const g = createGame(makeRand(seed))
  const rec = createRecorder()
  let step = 0
  while (!g.over && step < MAX_STEPS) {
    const input = pick(step)
    rec.push(step, input)
    update(g, STEP, input)
    step++
  }
  return { g, log: rec.log, steps: step }
}

describe('verificación de partidas en el servidor (repetición)', () => {
  const wander = (s: number): Input => ({ targetX: Math.round(180 + Math.sin(s / 40) * 150), dir: 0 })

  it('repetir el registro da exactamente el mismo puntaje, vidas y pasos', () => {
    for (const seed of [1, 42, 987654]) {
      const { g, log, steps } = play(seed, wander)
      const r = replay(seed, log)!
      expect(r).toMatchObject({ score: g.score, kills: g.kills, lives: g.lives, over: true, steps })
    }
  })

  it('funciona con teclado, cambios bruscos y partidas que terminan por vidas', () => {
    const { g, log } = play(7, (s) => ({ targetX: s % 90 < 45 ? null : (s * 7) % 361, dir: s % 200 < 20 ? 1 : s % 200 < 40 ? -1 : 0 }))
    expect(replay(7, log)!.score).toBe(g.score)
  })

  it('un puntaje inventado no se puede obtener: otra semilla u otros movimientos dan otro resultado', () => {
    const a = play(5, wander)
    const otraSemilla = replay(6, a.log)!
    const otrosMovimientos = replay(5, a.log.slice(0, 3))!
    expect(otraSemilla.score === a.g.score && otrosMovimientos.score === a.g.score).toBe(false)
  })

  it('rechaza registros mal formados o imposibles', () => {
    expect(replay(1, [0, 10])).toBeNull() // no es múltiplo de 3
    expect(replay(1, [0, 999, 0])).toBeNull() // objetivo fuera del campo
    expect(replay(1, [0, 10, 5])).toBeNull() // dirección inválida
    expect(replay(1, [10, 10, 0, 5, 10, 0])).toBeNull() // pasos desordenados
    expect(replay(1.5, [])).toBeNull() // semilla no entera
    expect(replay(1, new Array(3 * 6001).fill(0))).toBeNull() // demasiado largo
  })

  it('una partida sin movimientos termina sola y no pasa del tope de pasos', () => {
    const r = replay(3, [])!
    expect(r.over).toBe(true)
    expect(r.steps).toBeLessThanOrEqual(MAX_STEPS)
    expect(r.seconds).toBeLessThanOrEqual(ROUND_SECONDS + 1)
  })

  it('el seno determinista se parece al real (error < 0,2 %) y es exacto de un motor a otro (solo operaciones básicas)', () => {
    let worst = 0
    for (let x = -20; x <= 20; x += 0.013) worst = Math.max(worst, Math.abs(fsin(x) - Math.sin(x)))
    expect(worst).toBeLessThan(0.002)
    expect(fsin(0)).toBe(0)
  })

  it('el registro de una partida completa es pequeño (cabe holgado en el envío)', () => {
    const { log } = play(11, (s) => ({ targetX: Math.round(180 + Math.sin(s / 3) * 170), dir: 0 })) // peor caso: cambia en cada paso
    expect(JSON.stringify(log).length).toBeLessThan(150_000)
  })
})
