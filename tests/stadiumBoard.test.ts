import { describe, expect, it } from 'vitest'
import { boardHasContent, boardWhen, cleanBoard, emptyBoard, resolveBoard } from '../src/stadium/board'

describe('cartel del estadio', () => {
  it('un cartel vacío no tiene contenido', () => {
    expect(boardHasContent(emptyBoard())).toBe(false)
    expect(boardHasContent(null)).toBe(false)
  })
  it('con un nombre, un escudo o una imagen sí', () => {
    expect(boardHasContent({ ...emptyBoard(), image: 'x.jpg' })).toBe(true)
    expect(boardHasContent({ ...emptyBoard(), home: { name: 'Real', crest: null } })).toBe(true)
    expect(boardHasContent({ ...emptyBoard(), away: { name: '', crest: 'c.png' } })).toBe(true)
  })
  it('el cartel del evento manda; sin contenido, el general', () => {
    const general = { ...emptyBoard(), caption: 'general' }
    const ev = { board: { ...emptyBoard(), image: 'a.jpg' } }
    expect(resolveBoard(ev, general).image).toBe('a.jpg')
    expect(resolveBoard({ board: emptyBoard() }, general).caption).toBe('general')
    expect(resolveBoard(null, general)).toBe(general)
  })
  it('limpia datos incompletos de la base de datos', () => {
    expect(cleanBoard(undefined)).toEqual(emptyBoard())
    expect(cleanBoard({ home: { name: 'A' }, image: 5 }).home).toEqual({
      name: 'A',
      crest: null,
    })
    expect(cleanBoard({ image: 5 }).image).toBeNull()
  })
  it('da fecha legible o vacío', () => {
    expect(boardWhen('no es fecha')).toBe('')
    expect(boardWhen(undefined)).toBe('')
    expect(boardWhen('2026-11-14T20:00:00-05:00')).toMatch(/\d/)
  })
})

import { cleanFit } from '../src/stadium/board'
import { drawCover } from '../src/stadium/boardPaint'

describe('encuadre de la imagen del cartel', () => {
  const draw = (fit: { x: number; y: number; zoom: number }) => {
    let args: number[] = []
    const g = { drawImage: (_i: unknown, l: number, t: number, w: number, h: number) => (args = [l, t, w, h]) }
    drawCover(g as unknown as CanvasRenderingContext2D, { naturalWidth: 2000, naturalHeight: 1000 } as HTMLImageElement, 1000, 400, fit)
    return args
  }
  it('limpia valores raros', () => {
    expect(cleanFit(undefined)).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(cleanFit({ x: 9, y: -9, zoom: 99 })).toEqual({ x: 2, y: -2, zoom: 4 })
    expect(cleanFit({ x: 'a', zoom: 0.2 })).toEqual({ x: 0, y: 0, zoom: 1 })
  })
  it('sin ajuste, la imagen cubre el cartel centrada', () => {
    const [l, t, w, h] = draw({ x: 0, y: 0, zoom: 1 })
    expect(l + w).toBeGreaterThanOrEqual(1000)
    expect(t + h).toBeGreaterThanOrEqual(400)
    expect(l).toBeLessThanOrEqual(0)
    expect(t).toBeLessThanOrEqual(0)
  })
  it('nunca deja bordes vacíos, ni arrastrando de más ni acercando', () => {
    for (const fit of [{ x: 5, y: 5, zoom: 1 }, { x: -5, y: -5, zoom: 2 }, { x: 0.3, y: -0.2, zoom: 3.5 }]) {
      const [l, t, w, h] = draw(fit)
      expect(l).toBeLessThanOrEqual(0.0001)
      expect(t).toBeLessThanOrEqual(0.0001)
      expect(l + w).toBeGreaterThanOrEqual(999.999)
      expect(t + h).toBeGreaterThanOrEqual(399.999)
    }
  })
  it('acercar agranda la imagen', () => {
    expect(draw({ x: 0, y: 0, zoom: 2 })[2]).toBeCloseTo(draw({ x: 0, y: 0, zoom: 1 })[2] * 2)
  })
})
