import { describe, expect, it } from 'vitest'
import { DPR_CAP, classify, shouldPreload3D, type DeviceSignals } from '../src/lib/deviceProfile'
import { createFrameGate } from '../src/world/frameGate'

/** Simula un monitor de `hz` hertz durante `ms` milisegundos y cuenta los cuadros que se dibujan. */
function drawn(maxFps: number, hz: number, ms: number) {
  const g = createFrameGate(maxFps)
  let n = 0
  for (let t = 1000; t < 1000 + ms; t += 1000 / hz) if (g.shouldRender(t)) (g.step(t), n++)
  return n
}

describe('limitador de cuadros', () => {
  it('a 60 Hz con tope de 60 se dibuja todo; a 120 Hz, la mitad; con tope 30, la mitad de 60', () => {
    expect(drawn(60, 60, 2000)).toBeGreaterThanOrEqual(119)
    expect(drawn(60, 120, 2000)).toBeLessThanOrEqual(125)
    expect(drawn(60, 120, 2000)).toBeGreaterThanOrEqual(118)
    const n30 = drawn(30, 60, 2000)
    expect(n30).toBeGreaterThanOrEqual(58)
    expect(n30).toBeLessThanOrEqual(62)
  })

  it('el tiempo de animación avanza en segundos y con tope tras un tirón (no salta al volver de otra pestaña)', () => {
    const g = createFrameGate(60)
    g.start(5)
    const a = g.step(1000)
    expect(a).toBeCloseTo(5 + 1 / 60, 5)
    const b = g.step(1016)
    expect(b - a).toBeCloseTo(0.016, 3)
    const c = g.step(61016) // un minuto después
    expect(c - b).toBeCloseTo(0.1, 5)
  })

  it('tras pausar, el primer cuadro no suma un salto', () => {
    const g = createFrameGate(60)
    g.step(1000)
    g.reset()
    expect(g.shouldRender(99999)).toBe(true)
    const t = g.step(99999)
    expect(t).toBeLessThan(1)
  })
})

describe('precarga del motor 3D', () => {
  const sig = (o: Partial<DeviceSignals>): DeviceSignals => ({ webgl: true, webgl2: true, reducedMotion: false, shortSide: 390, longSide: 844, dpr: 2, touch: true, ios: false, ...o })

  it('con WebGL todos lo precargan (también los básicos); sin WebGL, no', () => {
    expect(shouldPreload3D(classify(sig({ memory: 4, cores: 8 })), { force2D: false, prefer3D: false })).toBe(true)
    expect(shouldPreload3D(classify(sig({ memory: 2 })), { force2D: false, prefer3D: false })).toBe(true)
    expect(shouldPreload3D(classify(sig({ webgl: false, webgl2: false })), { force2D: false, prefer3D: false })).toBe(false)
  })
  it('quien pidió 3D a mano en un dispositivo básico sí lo precarga; quien eligió 2D, nunca', () => {
    expect(shouldPreload3D(classify(sig({ memory: 2 })), { force2D: false, prefer3D: true })).toBe(true)
    expect(shouldPreload3D(classify(sig({ memory: 8, cores: 8 })), { force2D: true, prefer3D: false })).toBe(false)
  })
  it('el tope de resolución se mantiene', () => {
    expect(DPR_CAP).toEqual({ low: 1.25, medium: 1.5, high: 2 })
  })
})
