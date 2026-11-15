import { describe, expect, it } from 'vitest'
import { isLiteDoor, median } from '../src/lib/doorMode'
import { doorWillShow, isHomePath, shouldDeferWorld } from '../src/state/entry'

describe('entrada: el 3D espera al portón en equipos que no son potentes', () => {
  it('se aplaza solo si hay portón y el equipo no es de gama alta', () => {
    expect(shouldDeferWorld('low', true, true)).toBe(true)
    expect(shouldDeferWorld('low', true, false)).toBe(true)
    expect(shouldDeferWorld('medium', true, true)).toBe(true) // celular de gama media
    expect(shouldDeferWorld('medium', true, false)).toBe(false) // computador de gama media: lo construye detrás del portón
    expect(shouldDeferWorld('high', true, true)).toBe(false)
    expect(shouldDeferWorld('high', true, false)).toBe(false)
    // sin portón (ya entró en la sesión, o es otra página) nada se aplaza
    expect(shouldDeferWorld('low', false)).toBe(false)
    expect(shouldDeferWorld('medium', false, true)).toBe(false)
  })
  it('el portón solo sale en la portada y una vez por sesión', () => {
    expect(isHomePath('/', '/')).toBe(true)
    expect(isHomePath('/Cartagenamall/', '/Cartagenamall/')).toBe(true)
    expect(isHomePath('/Cartagenamall', '/Cartagenamall/')).toBe(true)
    expect(isHomePath('/comprar', '/')).toBe(false)
    expect(isHomePath('/Cartagenamall/comprar', '/Cartagenamall/')).toBe(false)
    expect(doorWillShow('/', '/', false)).toBe(true)
    expect(doorWillShow('/', '/', true)).toBe(false)
    expect(doorWillShow('/admin', '/', false)).toBe(false)
  })
})

describe('puerta liviana', () => {
  it('se elige en gama baja, con ahorro de datos o si el teléfono va justo de cuadros', () => {
    expect(isLiteDoor({ tier: 'low' })).toBe(true)
    expect(isLiteDoor({ tier: 'high', saveData: true })).toBe(true)
    expect(isLiteDoor({ tier: 'medium', medianFrameMs: 40 })).toBe(true)
    expect(isLiteDoor({ tier: 'medium', medianFrameMs: 17 })).toBe(false)
    expect(isLiteDoor({ tier: 'high' })).toBe(false)
    expect(isLiteDoor({ tier: 'medium' })).toBe(false)
  })
  it('la mediana ignora los tirones sueltos', () => {
    expect(median([16, 17, 16, 250, 16])).toBe(16)
    expect(median([])).toBe(0)
  })
})
