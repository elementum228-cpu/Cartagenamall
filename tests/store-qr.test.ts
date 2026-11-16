import { describe, expect, it } from 'vitest'
import { qrMatrix } from '../src/lib/storeQr'

describe('QR del local', () => {
  it('genera una matriz cuadrada con los patrones de esquina', () => {
    const m = qrMatrix('https://mallplay.example/tienda/brisa-textil')
    expect(m.length).toBeGreaterThanOrEqual(21)
    expect(m.every((r) => r.length === m.length)).toBe(true)
    // el cuadro de búsqueda de arriba a la izquierda: borde oscuro de 7×7
    for (let i = 0; i < 7; i++) expect(m[0][i] && m[i][0] && m[6][i] && m[i][6]).toBe(true)
    expect(m.flat().filter(Boolean).length).toBeGreaterThan(100)
  })
  it('un enlace más largo da una matriz igual o mayor', () => {
    expect(qrMatrix('https://x.co/' + 'a'.repeat(120)).length).toBeGreaterThan(qrMatrix('https://x.co/a').length)
  })
})
