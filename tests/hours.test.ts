import { describe, expect, it } from 'vitest'
import { cleanHours, fromInput, isOpenNow, openLabel, toInput, withinHours, type WeekHours } from '../src/lib/hours'

// Colombia = UTC-5: las 14:00 UTC son las 9:00 a. m. en Cartagena.
const at = (iso: string) => new Date(iso)
const wk = (d: { open: number; close: number } | null): WeekHours => Array.from({ length: 7 }, () => d)

describe('horario semanal', () => {
  it('sin horario siempre está dentro', () => {
    expect(withinHours(undefined)).toBe(true)
    expect(withinHours([] as never)).toBe(true)
  })
  it('abre y cierra a la hora de Colombia', () => {
    const w = wk({ open: 9 * 60, close: 20 * 60 })
    expect(withinHours(w, at('2026-11-17T13:59:00Z'))).toBe(false) // 8:59 a. m.
    expect(withinHours(w, at('2026-11-17T14:00:00Z'))).toBe(true) // 9:00
    expect(withinHours(w, at('2026-11-18T00:59:00Z'))).toBe(true) // 7:59 p. m.
    expect(withinHours(w, at('2026-11-18T01:00:00Z'))).toBe(false) // 8:00 p. m.
  })
  it('un día sin servicio queda cerrado', () => {
    const w = wk({ open: 9 * 60, close: 20 * 60 })
    w[2] = null // martes
    expect(withinHours(w, at('2026-11-17T17:00:00Z'))).toBe(false) // martes 12:00
    expect(withinHours(w, at('2026-11-18T17:00:00Z'))).toBe(true) // miércoles 12:00
  })
  it('franja que pasa de la medianoche', () => {
    const w = wk({ open: 18 * 60, close: 2 * 60 })
    expect(withinHours(w, at('2026-11-18T04:00:00Z'))).toBe(true) // 11:00 p. m.
    expect(withinHours(w, at('2026-11-18T03:00:00Z'))).toBe(true) // 10:00 p. m.
    expect(withinHours(w, at('2026-11-18T06:30:00Z'))).toBe(true) // 1:30 a. m. (franja de ayer)
    expect(withinHours(w, at('2026-11-18T08:00:00Z'))).toBe(false) // 3:00 a. m.
  })
  it('el interruptor manual manda sobre el horario', () => {
    const w = wk({ open: 9 * 60, close: 20 * 60 })
    expect(isOpenNow({ status: 'paused', hours: w }, at('2026-11-17T17:00:00Z'))).toBe(false)
    expect(isOpenNow({ status: 'open', hours: w }, at('2026-11-17T17:00:00Z'))).toBe(true)
    expect(isOpenNow({ status: 'open', hours: w }, at('2026-11-18T03:00:00Z'))).toBe(false)
  })
  it('textos de la ficha', () => {
    const w = wk({ open: 9 * 60, close: 20 * 60 })
    expect(openLabel({ status: 'open', hours: w }, at('2026-11-17T17:00:00Z'))).toBe('Abierto · cierra 8:00 p. m.')
    expect(openLabel({ status: 'open', hours: w }, at('2026-11-17T12:00:00Z'))).toBe('Cerrado · abre hoy 9:00 a. m.')
    expect(openLabel({ status: 'open', hours: w }, at('2026-11-18T03:00:00Z'))).toBe('Cerrado · abre mañana 9:00 a. m.')
    expect(openLabel({ status: 'paused', hours: w })).toBe('Cerrado por ahora')
    expect(openLabel({ status: 'open' })).toBe('Abierto')
  })
  it('limpia datos malos y convierte horas', () => {
    expect(cleanHours('x')).toBeUndefined()
    expect(cleanHours(Array(7).fill(null))).toBeUndefined()
    expect(cleanHours([{ open: 540, close: 540 }, ...Array(6).fill(null)])).toBeUndefined()
    expect(cleanHours([{ open: 540, close: 1200 }, ...Array(6).fill(null)])?.[0]).toEqual({ open: 540, close: 1200 })
    expect(toInput(545)).toBe('09:05')
    expect(fromInput('18:30')).toBe(1110)
    expect(fromInput('xx')).toBeNull()
  })
})
