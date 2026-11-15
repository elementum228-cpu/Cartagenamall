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
    throwBall(t, 800)
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
