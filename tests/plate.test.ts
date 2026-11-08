import { describe, expect, it } from 'vitest'
import { PLATE_FIT0, autoPlateFit, clampPlateFit, findFood, plateWindow } from '../src/lib/plate'

/** Foto de prueba w×h: mesa (color liso) con un plato redondo de otro color centrado en (cx, cy) con radio r (píxeles). */
function photo(w: number, h: number, cx: number, cy: number, r: number) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = Math.hypot(x - cx, y - cy) < r
      d.set(inside ? [235, 200, 120, 255] : [70, 45, 30, 255], (y * w + x) * 4)
    }
  return d
}

describe('modo plato de las fotos', () => {
  it('encuentra la comida donde está', () => {
    const f = findFood(photo(100, 80, 30, 50, 18), 100, 80)
    expect(f.cx).toBeCloseTo(0.3, 1)
    expect(f.cy).toBeCloseTo(50 / 80, 1)
    expect(f.r).toBeGreaterThan(0.14)
    expect(f.r).toBeLessThan(0.32)
  })
  it('en una foto apaisada el radio y el zoom automático salen bien', () => {
    // 160×100 con un plato de radio 33 centrado: ocupa ~66 % del alto
    const w = 160
    const h = 100
    const f = findFood(photo(w, h, 80, 50, 33), w, h)
    expect(f.r).toBeGreaterThan(0.14)
    expect(f.r).toBeLessThan(0.22)
    const fit = autoPlateFit(f, 1600, 1000)
    // el plato (660 px de 1000) debe llenar casi todo el círculo: zoom > 1 y el cuadrado no más pequeño que el plato
    expect(fit.scale).toBeGreaterThan(1.2)
    expect(plateWindow(1600, 1000, fit).side).toBeGreaterThan(560)
    expect(plateWindow(1600, 1000, fit).side).toBeLessThan(900)
  })
  it('una foto lisa se centra sin inventar nada', () => {
    const d = new Uint8ClampedArray(60 * 60 * 4).fill(120)
    expect(findFood(d, 60, 60)).toEqual({ cx: 0.5, cy: 0.5, r: 0.5 })
  })
  it('el ajuste automático acerca y mueve hacia la comida', () => {
    const food = { cx: 0.3, cy: 0.62, r: 0.2 }
    const fit = autoPlateFit(food, 1000, 800)
    expect(fit.scale).toBeGreaterThan(1.3)
    expect(fit.dx).toBeLessThan(0)
    expect(fit.dy).toBeGreaterThan(0)
    // el cuadrado resultante contiene el centro de la comida
    const win = plateWindow(1000, 800, fit)
    expect(win.x).toBeLessThan(0.3 * 1000)
    expect(win.x + win.side).toBeGreaterThan(0.3 * 1000)
    expect(win.y).toBeLessThan(0.62 * 800)
    expect(win.y + win.side).toBeGreaterThan(0.62 * 800)
  })
  it('la ventana nunca se sale de la foto, ni moviendo ni acercando de más', () => {
    for (const fit of [PLATE_FIT0, { scale: 3, dx: 0.5, dy: 0.5 }, { scale: 1.5, dx: -0.5, dy: -0.5 }, { scale: 99, dx: 9, dy: -9 }]) {
      const w = plateWindow(1200, 800, fit)
      expect(w.x).toBeGreaterThanOrEqual(0)
      expect(w.y).toBeGreaterThanOrEqual(0)
      expect(w.x + w.side).toBeLessThanOrEqual(1200 + 1e-6)
      expect(w.y + w.side).toBeLessThanOrEqual(800 + 1e-6)
    }
  })
  it('zoom 1 es el cuadrado más grande y limpia valores raros', () => {
    expect(plateWindow(1200, 800, PLATE_FIT0).side).toBe(800)
    expect(clampPlateFit({ scale: 0, dx: 5, dy: -5 })).toEqual({ scale: 1, dx: 0.5, dy: -0.5 })
  })
})
