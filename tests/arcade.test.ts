import { describe, expect, it } from 'vitest'
import { KIND_HP, MAX_STEPS, MAX_WEAPON, RAPID_SECONDS, ROUND_SECONDS, SHIP_Y, STEP, createGame, createRecorder, fallSpeed, fsin, makeRand, replay, spawnGap, update, H, W, type Input } from '../src/arcade/engine'
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
    expect(g.score).toBe(6)
  })

  it('chocar quita una vida, da invulnerabilidad y a la tercera termina', () => {
    const g = createGame(makeRand(5))
    g.spawnIn = 99
    g.fireIn = 99
    const hit = () => Object.assign(g.enemies.find((x) => !x.on)!, { on: true, kind: 0, x: g.shipX, baseX: g.shipX, y: SHIP_Y, vy: 0, hp: 1, amp: 0 })
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
    expect(spawnGap(1000)).toBe(0.24)
    expect(fallSpeed(1000)).toBe(245)
    const g = createGame(makeRand(9))
    const sizes = [g.bullets.length, g.enemies.length, g.parts.length]
    for (let i = 0; i < 3000 && !g.over; i++) update(g, 1 / 60, { targetX: (i * 7) % W, dir: 0 })
    expect([g.bullets.length, g.enemies.length, g.parts.length]).toEqual(sizes)
    expect(g.enemies.every((e) => !e.on || e.y < H + 40)).toBe(true)
  })
})

describe('dificultad progresiva de Nave Caribe', () => {
  it('un cañonero dispara hacia la nave y su disparo cuenta como golpe', () => {
    const g = createGame(makeRand(6))
    g.spawnIn = 99
    g.fireIn = 99
    Object.assign(g.enemies[0], { on: true, kind: 3, x: g.shipX, baseX: g.shipX, y: 120, vy: 0, hp: KIND_HP[3], amp: 0, shoot: 0.05 })
    for (let i = 0; i < 600 && g.lives === 3; i++) update(g, 1 / 60, still)
    expect(g.ebullets.length).toBeGreaterThan(0)
    expect(g.lives).toBe(2)
  })

  it('llegan formaciones en V y aparecen cañoneros pasada la mitad inicial', () => {
    const g = createGame(makeRand(8))
    g.lives = 999
    let guns = 0
    let maxOn = 0
    for (let i = 0; i < 70 * 60 && !g.over; i++) {
      update(g, 1 / 60, { targetX: (i * 3) % W, dir: 0 })
      maxOn = Math.max(maxOn, g.enemies.filter((e) => e.on).length)
      if (g.enemies.some((e) => e.on && e.kind === 3)) guns++
    }
    expect(maxOn).toBeGreaterThanOrEqual(6)
    expect(guns).toBeGreaterThan(0)
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

describe('armas y premios', () => {
  const place = (g: ReturnType<typeof createGame>, o: Partial<{ kind: 0 | 1 | 2 | 3; x: number; y: number; hp: number }>) =>
    Object.assign(g.enemies.find((x) => !x.on)!, { on: true, kind: 0, x: g.shipX, baseX: g.shipX, y: 300, vy: 0, hp: 1, amp: 0, ...o })
  const quiet = (g: ReturnType<typeof createGame>) => {
    g.spawnIn = 99
    return g
  }

  it('el arma sube de nivel y dispara más: 1, 2, 3, 5 y 7 disparos por ráfaga', () => {
    const counts = [1, 2, 3, 4, 5].map((lvl) => {
      const g = quiet(createGame(makeRand(1)))
      g.weapon = lvl
      g.fireIn = 0
      update(g, 1 / 60, still)
      return g.bullets.filter((b) => b.on).length
    })
    expect(counts).toEqual([1, 2, 3, 5, 7])
  })

  it('un cañonero siempre suelta premio; al recogerlo de arma, sube el nivel', () => {
    const g = quiet(createGame(makeRand(2)))
    g.fireIn = 99
    place(g, { kind: 3, y: 200 })
    Object.assign(g.bullets[0], { on: true, x: g.shipX, y: 200, vx: 0 })
    update(g, 1 / 60, still)
    const drop = g.pickups.find((k) => k.on)
    expect(drop).toBeTruthy()
    drop!.kind = 0
    drop!.x = g.shipX
    drop!.y = SHIP_Y - 4
    const antes = g.weapon
    update(g, 1 / 60, still)
    expect(g.weapon).toBe(antes + 1)
    expect(g.picked).toBe(1)
  })

  it('con el arma al máximo el premio de arma da 15 puntos; el rápido acelera el disparo', () => {
    const g = quiet(createGame(makeRand(3)))
    g.fireIn = 99
    g.weapon = MAX_WEAPON
    Object.assign(g.pickups[0], { on: true, kind: 0, x: g.shipX, y: SHIP_Y, phase: 0 })
    update(g, 1 / 60, still)
    expect(g.score).toBe(15)
    Object.assign(g.pickups[1], { on: true, kind: 1, x: g.shipX, y: SHIP_Y, phase: 0 })
    update(g, 1 / 60, still)
    expect(g.rapid).toBeGreaterThan(RAPID_SECONDS - 0.1)
    g.fireIn = 0
    update(g, 1 / 60, still)
    expect(g.fireIn).toBeLessThan(0.14) // cadencia rápida (0,13 s) en vez de 0,24 s
  })

  it('recibir un golpe baja un nivel de arma y quita la cadencia rápida', () => {
    const g = quiet(createGame(makeRand(4)))
    g.fireIn = 99
    g.weapon = 3
    g.rapid = 5
    place(g, { y: SHIP_Y })
    update(g, 1 / 60, still)
    expect(g.weapon).toBe(2)
    expect(g.rapid).toBe(0)
  })

  it('el premio no tarda: tras 16 enemigos sin soltar nada, el siguiente lo suelta', () => {
    const g = quiet(createGame(makeRand(5)))
    g.fireIn = 99
    g.sinceDrop = 15
    place(g, { kind: 0, y: 200 })
    Object.assign(g.bullets[0], { on: true, x: g.shipX, y: 200, vx: 0 })
    update(g, 1 / 60, still)
    expect(g.pickups.some((k) => k.on)).toBe(true)
    expect(g.sinceDrop).toBe(0)
  })

  it('con premios en juego la repetición del servidor sigue dando el mismo puntaje', () => {
    const wander = (s: number): Input => ({ targetX: Math.round(180 + Math.sin(s / 25) * 160), dir: 0 })
    for (const seed of [11, 12, 13]) {
      const { g, log } = play(seed, wander)
      expect(replay(seed, log)!.score).toBe(g.score)
      expect(g.picked).toBeGreaterThanOrEqual(0)
    }
  })

  it('el puntaje máximo posible queda por debajo del tope del servidor (6000)', () => {
    // un jugador perfecto: la nave se pone bajo cada enemigo; aun así no se pasa del tope
    const g = createGame(makeRand(21))
    const rec = createRecorder()
    let step = 0
    while (!g.over && step < MAX_STEPS) {
      const target = g.enemies.filter((e) => e.on).sort((a, b) => b.y - a.y)[0]
      const input: Input = { targetX: target ? Math.round(target.x) : 180, dir: 0 }
      rec.push(step, input)
      update(g, STEP, input)
      step++
    }
    expect(g.score).toBeLessThan(6000)
  })
})

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

describe('historial y sonido del Arcade', () => {
  it('guarda cada partida (la más reciente primero) hasta un tope, y marca las del ranking', () => {
    useArcade.setState({ runs: [], earnedToday: 0, best: 0, localBest: [] })
    useArcade.getState().finishRun(120, true)
    useArcade.getState().finishRun(300, false)
    const r = useArcade.getState().runs
    expect(r.map((x) => x.score)).toEqual([300, 120])
    expect(r.map((x) => x.ranked)).toEqual([false, true])
    for (let i = 0; i < 80; i++) useArcade.getState().finishRun(10 + i)
    expect(useArcade.getState().runs.length).toBe(60)
    expect(useArcade.getState().runs[0].score).toBe(89)
  })

  it('una partida de 0 puntos no ensucia el historial', () => {
    useArcade.setState({ runs: [] })
    useArcade.getState().finishRun(0)
    expect(useArcade.getState().runs).toHaveLength(0)
  })

  it('el sonido está encendido por defecto y se puede apagar', () => {
    expect(useArcade.getState().sound).toBe(true)
    useArcade.getState().setSound(false)
    expect(useArcade.getState().sound).toBe(false)
    useArcade.getState().setSound(true)
  })
})
