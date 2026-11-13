import { describe, expect, it } from 'vitest'
import { providers } from '../supabase/functions/_shared/cinema/providers/registry'
import { OFFICIAL_CINEMAS } from '../src/cinema/official'

describe('cartelera oficial en la app', () => {
  it('coincide con los proveedores del servidor (mismo orden, nombre y enlace)', () => {
    expect(OFFICIAL_CINEMAS).toEqual(providers.map((p) => ({ id: p.id, name: p.name, url: p.officialUrl('cartagena', () => undefined) })))
  })
  it('todos los enlaces son https', () => {
    for (const c of OFFICIAL_CINEMAS) expect(c.url.startsWith('https://')).toBe(true)
  })
})
