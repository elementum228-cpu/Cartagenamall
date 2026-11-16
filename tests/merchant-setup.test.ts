import { describe, expect, it } from 'vitest'
import { setupSteps } from '../src/pages/MerchantSetup'
import type { Store } from '../src/domain/types'

const base = { id: 'S1', name: 'Brisa', logoText: 'BRISA', tagline: '', description: '', categoryId: 'c', zoneId: 'A', brandColor: '#000', accentColor: '#fff', facade: 'awning', instagram: '', whatsapp: '', status: 'paused' } as unknown as Store
const done = (s: Store, n: number) => Object.fromEntries(setupSteps(s, n).map((x) => [x.id, x.done]))

describe('lista de progreso del local', () => {
  it('un local recién aprobado no tiene nada hecho', () => {
    expect(Object.values(done(base, 0)).some(Boolean)).toBe(false)
  })
  it('el texto de relleno de la aprobación no cuenta como descripción', () => {
    expect(done({ ...base, description: 'Nueva tienda de Moda. Completa la descripción en tu perfil.' }, 0).desc).toBe(false)
    expect(done({ ...base, description: 'Ropa fresca de lino y algodón para el calor caribeño.' }, 0).desc).toBe(true)
  })
  it('valida el WhatsApp colombiano y cuenta los productos activos', () => {
    expect(done({ ...base, whatsapp: '300 123 4567' }, 0).wa).toBe(true)
    expect(done({ ...base, whatsapp: '+57 300 123 4567' }, 0).wa).toBe(true)
    expect(done({ ...base, whatsapp: '12345' }, 0).wa).toBe(false)
    expect(done(base, 2).items).toBe(false)
    expect(done(base, 3).items).toBe(true)
  })
  it('horario, local abierto y premio del Arcade', () => {
    const w = Array.from({ length: 7 }, () => ({ open: 540, close: 1200 }))
    const full = { ...base, hours: w, status: 'open', logo: 'data:image/png;base64,xx', arcadeRewards: [{ id: 'r', title: 'x', detail: '', cost: 10, active: true, until: '' }] } as unknown as Store
    const d = done(full, 5)
    expect(d.hours && d.open && d.arcade && d.logo).toBe(true)
  })
})
