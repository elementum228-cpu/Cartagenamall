import { describe, expect, it } from 'vitest'
import { BOWLS, CRABS } from '../src/arcade/games/defs'

describe('Cangrejos Locos', () => {
  it('termina a los 45 segundos y suma al tocar un cangrejo', () => {
    const s = CRABS.create()
    for (let i = 0; i < 100 && !s.holes.some((h) => h.kind === 'crab'); i++) CRABS.update(s, 0.05)
    const h = s.holes.find((x) => x.kind === 'crab')
    expect(h).toBeTruthy()
    const before = s.score
    CRABS.pointer(s, 'down', h!.x, h!.y - 20, 0)
    expect(s.score).toBeGreaterThan(before)
    expect(h!.hit).toBe(true)
    for (let i = 0; i < 1000; i++) CRABS.update(s, 0.05)
    expect(CRABS.done(s)).toBe(true)
  })
  it('un toque en vacío corta la racha y el pulpo resta sin bajar de cero', () => {
    const s = CRABS.create()
    s.combo = 6
    CRABS.pointer(s, 'down', 5, 5, 0)
    expect(s.combo).toBe(0)
    s.holes[0].kind = 'octo'
    s.holes[0].dur = 5
    CRABS.pointer(s, 'down', s.holes[0].x, s.holes[0].y - 20, 0)
    expect(s.score).toBe(0)
  })
})

describe('Bolos de coco', () => {
  const throwBall = (s: ReturnType<typeof BOWLS.create>, power: number) => {
    BOWLS.pointer(s, 'down', 180, 500, 0)
    BOWLS.pointer(s, 'move', 180, 400, 50)
    BOWLS.pointer(s, 'up', 180, 500 - (power * 0.1), 100) // power px/s en 0,1 s
    for (let i = 0; i < 400 && s.phase !== 'rest'; i++) BOWLS.update(s, 0.016)
    for (let i = 0; i < 80; i++) BOWLS.update(s, 0.016)
  }
  it('un deslizamiento medio cae en los aros y suma; uno suave se pierde', () => {
    const s = BOWLS.create()
    throwBall(s, 1900)
    expect(s.left).toBe(8)
    expect(s.score).toBeGreaterThan(0)
    const t = BOWLS.create()
    throwBall(t, 500)
    expect(t.score).toBe(0)
    expect(t.left).toBe(8)
  })
  it('se acaba después de los 9 cocos', () => {
    const s = BOWLS.create()
    for (let i = 0; i < 9; i++) throwBall(s, 1900)
    expect(s.left).toBe(0)
    expect(BOWLS.done(s)).toBe(true)
  })
})

describe('Bolos de coco: las esquinas de 100 se pueden alcanzar', () => {
  /** Un deslizamiento: sale de abajo, sube `dist` px con un desvío lateral `dx` en 120 ms, y se simula hasta que cae el coco. */
  const throwAt = (dx: number, dist: number): number => {
    const s = BOWLS.create()
    let t = 0
    BOWLS.pointer(s, 'down', 180, 500, t)
    for (let i = 1; i <= 6; i++) {
      t += 20
      BOWLS.pointer(s, 'move', 180 + (dx * i) / 6, 500 - (dist * i) / 6, t)
    }
    BOWLS.pointer(s, 'up', 180 + dx, 500 - dist, t)
    for (let i = 0; i < 600 && s.phase !== 'rest'; i++) BOWLS.update(s, 1 / 60)
    return s.score
  }
  it('con un buen lanzamiento hacia cada lado se llega a 100, y no todos los lanzamientos lo logran', () => {
    const results: { left: number[]; right: number[] } = { left: [], right: [] }
    for (let dist = 300; dist <= 520; dist += 20)
      for (let dx = 40; dx <= 200; dx += 20) {
        results.left.push(throwAt(-dx, dist))
        results.right.push(throwAt(dx, dist))
      }
    expect(results.left.some((v) => v === 100)).toBe(true)
    expect(results.right.some((v) => v === 100)).toBe(true)
    const all = [...results.left, ...results.right]
    expect(all.filter((v) => v === 100).length).toBeLessThan(all.length * 0.3) // no es trivial
  })
  it('un lanzamiento recto sigue cayendo en el tablero del centro, no en las esquinas', () => {
    for (const dist of [300, 340, 380]) expect(throwAt(0, dist)).toBeLessThan(100)
  })
})
