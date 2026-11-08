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
    expect(cleanBoard({ home: { name: 'A' }, image: 5 }).home).toMatchObject({
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
    const g = { save: () => {}, restore: () => {}, fillRect: () => {}, set fillStyle(_v: string) {}, drawImage: (_i: unknown, l: number, t: number, w: number, h: number) => (args = [l, t, w, h]) }
    drawCover(g as unknown as CanvasRenderingContext2D, { naturalWidth: 2000, naturalHeight: 1000 } as HTMLImageElement, 1000, 400, fit)
    return args
  }
  it('limpia valores raros', () => {
    expect(cleanFit(undefined)).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(cleanFit({ x: 9, y: -9, zoom: 99 })).toEqual({ x: 2, y: -2, zoom: 4 })
    expect(cleanFit({ x: 'a', zoom: 0.01 })).toEqual({ x: 0, y: 0, zoom: 0.3 })
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
  it('más pequeña que el cartel queda entera y se puede mover dentro de él', () => {
    for (const fit of [{ x: 0, y: 0, zoom: 0.5 }, { x: 5, y: 5, zoom: 0.4 }, { x: -5, y: -5, zoom: 0.3 }, { x: 0.2, y: 0, zoom: 0.8 }]) {
      const [l, t, w, h] = draw(fit)
      expect(l).toBeGreaterThanOrEqual(-0.0001)
      expect(t).toBeGreaterThanOrEqual(-0.0001)
      expect(l + w).toBeLessThanOrEqual(1000.0001)
      expect(t + h).toBeLessThanOrEqual(400.0001)
    }
    // y se puede llevar a las esquinas
    expect(draw({ x: -5, y: -5, zoom: 0.4 }).slice(0, 2)).toEqual([0, 0])
  })
  it('acercar agranda la imagen', () => {
    expect(draw({ x: 0, y: 0, zoom: 2 })[2]).toBeCloseTo(draw({ x: 0, y: 0, zoom: 1 })[2] * 2)
  })
})

import { BOARD_H, BOARD_W, crestBox } from '../src/stadium/boardPaint'

describe('escudos del cartel', () => {
  it('sin ajuste, uno a cada lado y del mismo tamaño', () => {
    const h = crestBox({ name: '', crest: null }, 'home')
    const a = crestBox({ name: '', crest: null }, 'away')
    expect(h.cx).toBeLessThan(BOARD_W / 2)
    expect(a.cx).toBeGreaterThan(BOARD_W / 2)
    expect(h.cy).toBe(a.cy)
    expect(h.size).toBe(a.size)
  })
  it('se pueden mover y agrandar, sin salirse del cartel', () => {
    const t = { name: '', crest: null, fit: { x: 0.1, y: -0.2, zoom: 0.5 } }
    const b = crestBox(t, 'home')
    expect(b.cx).toBeCloseTo(BOARD_W * 0.2 + 0.1 * BOARD_W)
    expect(b.cy).toBeCloseTo(BOARD_H * 0.54 - 0.2 * BOARD_H)
    expect(b.size).toBeCloseTo(BOARD_H * 0.74 * 0.5)
    const far = crestBox({ ...t, fit: { x: 2, y: 2, zoom: 1 } }, 'away')
    expect(far.cx).toBeLessThanOrEqual(BOARD_W)
    expect(far.cy).toBeLessThanOrEqual(BOARD_H)
  })
  it('limpia el ajuste de cada equipo', () => {
    expect(cleanBoard({ home: { name: 'A', fit: { x: 9, zoom: 99 } } }).home.fit).toEqual({ x: 2, y: 0, zoom: 4 })
  })
})

import { cleanTexts } from '../src/stadium/board'
import { boardElements, textBox, textContent } from '../src/stadium/boardPaint'

describe('textos independientes del cartel', () => {
  const base = { kind: 'match' as const, board: emptyBoard(), title: 'Real vs. Cundinamarca', when: 'SÁB 14 NOV · 8:00 P. M.' }
  it('sin cambios, cada texto dice lo de siempre', () => {
    expect(textContent('title', base)).toBe('REAL VS. CUNDINAMARCA')
    expect(textContent('vs', base)).toBe('VS')
    expect(textContent('when', base)).toBe('SÁB 14 NOV · 8:00 P. M.')
    expect(textContent('caption', base)).toBe('')
  })
  it('cada texto se puede cambiar u ocultar sin afectar a los demás', () => {
    const board = { ...emptyBoard(), caption: 'Fecha 12', texts: { title: { text: 'PARTIDO DE HOY' }, vs: { hidden: true } } }
    const inp = { ...base, board }
    expect(textContent('title', inp)).toBe('PARTIDO DE HOY')
    expect(textContent('vs', inp)).toBe('')
    expect(textContent('when', inp)).toBe('SÁB 14 NOV · 8:00 P. M.')
    expect(textContent('caption', inp)).toBe('Fecha 12')
  })
  it('se pueden mover y cambiar de tamaño por separado, dentro del cartel', () => {
    const board = { ...emptyBoard(), texts: { title: { x: 0.1, y: 0.1, zoom: 2 }, vs: { x: 9, y: -9 } } }
    const t = textBox('match', 'title', board)!
    const t0 = textBox('match', 'title', emptyBoard())!
    expect(t.cx).toBeCloseTo(t0.cx + 0.1 * BOARD_W)
    expect(t.size).toBeCloseTo(t0.size * 2)
    const v = textBox('match', 'vs', board)!
    expect(v.cx).toBeLessThanOrEqual(BOARD_W)
    expect(v.cy).toBeGreaterThanOrEqual(0)
    expect(textBox('concert', 'vs', board)).toBeNull()
  })
  it('las piezas que se pueden arrastrar: escudos y textos visibles', () => {
    const ids = boardElements({ ...base, board: { ...emptyBoard(), texts: { when: { hidden: true } } } }).map((e) => e.id)
    expect(ids).toEqual(expect.arrayContaining(['home', 'away', 'title', 'vs']))
    expect(ids).not.toContain('when')
    expect(boardElements({ ...base, kind: 'concert' }).map((e) => e.id)).not.toContain('home')
  })
  it('limpia los textos que vienen de la base de datos', () => {
    expect(cleanTexts(undefined)).toEqual({})
    expect(cleanTexts({ title: { text: 'A', zoom: 99, x: 'z' }, otro: { text: 'x' }, vs: { hidden: true } })).toEqual({ title: { text: 'A', zoom: 3 }, vs: { hidden: true } })
  })
})
