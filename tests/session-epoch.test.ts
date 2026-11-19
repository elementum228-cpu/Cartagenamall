import { describe, expect, it } from 'vitest'
import { mustSignOut } from '../src/remote/sessionEpoch'

describe('cierre general de sesiones', () => {
  it('cierra las sesiones que empezaron antes del cierre general', () => {
    expect(mustSignOut('2026-11-19T10:00:00Z', '2026-11-18T09:00:00Z')).toBe(true)
  })
  it('no cierra a quien volvió a entrar después', () => {
    expect(mustSignOut('2026-11-19T10:00:00Z', '2026-11-19T10:05:00Z')).toBe(false)
  })
  it('ignora datos inválidos o ausentes', () => {
    expect(mustSignOut(undefined, '2026-11-18T09:00:00Z')).toBe(false)
    expect(mustSignOut('no es una fecha', '2026-11-18T09:00:00Z')).toBe(false)
    expect(mustSignOut(null, null)).toBe(false)
  })
  it('sin fecha de inicio, solo reacciona a un cierre reciente', () => {
    expect(mustSignOut(new Date(Date.now() - 3_600_000).toISOString(), null)).toBe(true)
    expect(mustSignOut(new Date(Date.now() - 3 * 86_400_000).toISOString(), null)).toBe(false)
  })
})
