import { describe, expect, it } from 'vitest'
import { cleanEvent, EVENT_KINDS, newEvent, publicEvents } from '../src/state/cine'

describe('planes en grupo (Planly) como eventos', () => {
  it('«plan» es un tipo de evento válido y conserva su enlace de Planly y su película', () => {
    expect(EVENT_KINDS.some((k) => k.id === 'plan')).toBe(true)
    const e = cleanEvent({ ...newEvent(), kind: 'plan', title: 'Plan de cine', status: 'open', url: 'https://planly.app/p/abc', movieId: 'm1' }, 0)
    expect(e.kind).toBe('plan')
    expect(e.url).toBe('https://planly.app/p/abc')
    expect(e.movieId).toBe('m1')
  })
  it('un enlace que no es https se descarta; un evento nuevo ya se ve como «Próximamente» y el borrador queda oculto', () => {
    expect(cleanEvent({ ...newEvent(), kind: 'plan', url: 'http://x.com' }, 0).url).toBe('')
    const fresh = cleanEvent({ ...newEvent(), kind: 'plan', title: 'Plan' }, 0)
    expect(fresh.status).toBe('soon')
    expect(publicEvents([fresh]).map((e) => e.id)).toEqual([fresh.id])
    expect(publicEvents([{ ...fresh, status: 'draft' }])).toEqual([])
    expect(publicEvents([{ ...fresh, title: '' }])).toEqual([]) // sin nombre no se muestra
  })
})
