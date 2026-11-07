import { describe, expect, it } from 'vitest'
import { NEXT_TICKET_STATUS, fromPrice, isSoldOut, onSale, soldFromTickets, ticketCode, tierLeft, upcoming, validateEvent } from '../src/stadium/logic'
import type { StadiumEvent } from '../src/stadium/types'

const ev = (over: Partial<StadiumEvent> = {}): StadiumEvent => ({
  id: 'EV-1',
  title: 'Cartagena vs Rival',
  subtitle: '',
  kind: 'match',
  startsAt: '2026-12-01T20:00:00Z',
  description: '',
  status: 'published',
  tiers: [
    { id: 'gen', name: 'General', price: 30000, capacity: 10 },
    { id: 'vip', name: 'VIP', price: 90000, capacity: 2 },
  ],
  songUrl: null,
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
})

describe('boletas del estadio', () => {
  it('el código es legible y de la forma EST-XXXXXX', () => {
    for (let i = 0; i < 50; i++) expect(ticketCode()).toMatch(/^EST-[2-9A-HJ-NP-Z]{6}$/)
  })

  it('cuenta las vendidas sin las canceladas y calcula lo que queda', () => {
    const sold = soldFromTickets([
      { eventId: 'EV-1', tierId: 'gen', qty: 3, status: 'confirmed' },
      { eventId: 'EV-1', tierId: 'gen', qty: 2, status: 'pending' },
      { eventId: 'EV-1', tierId: 'gen', qty: 4, status: 'cancelled' },
      { eventId: 'EV-1', tierId: 'vip', qty: 2, status: 'used' },
    ])
    const e = ev()
    expect(tierLeft(e.tiers[0], sold, e.id)).toBe(5)
    expect(tierLeft(e.tiers[1], sold, e.id)).toBe(0)
    expect(isSoldOut(e, sold)).toBe(false)
    expect(fromPrice(e, sold)).toBe(30000)
  })

  it('agotado cuando no queda ninguna boleta de ningún tipo', () => {
    const sold = soldFromTickets([
      { eventId: 'EV-1', tierId: 'gen', qty: 10, status: 'confirmed' },
      { eventId: 'EV-1', tierId: 'vip', qty: 2, status: 'pending' },
    ])
    expect(isSoldOut(ev(), sold)).toBe(true)
    expect(fromPrice(ev(), sold)).toBeNull()
  })

  it('solo se compran eventos publicados y que no terminaron', () => {
    const now = Date.parse('2026-12-01T21:00:00Z')
    expect(onSale(ev(), now)).toBe(true)
    expect(onSale(ev({ status: 'draft' }), now)).toBe(false)
    expect(onSale(ev({ status: 'cancelled' }), now)).toBe(false)
    expect(onSale(ev({ startsAt: '2026-11-20T20:00:00Z' }), now)).toBe(false)
  })

  it('los próximos eventos salen del más cercano al más lejano', () => {
    const now = Date.parse('2026-11-05T00:00:00Z')
    const list = upcoming([ev({ id: 'B', startsAt: '2026-12-20T20:00:00Z' }), ev({ id: 'A', startsAt: '2026-11-10T20:00:00Z' }), ev({ id: 'C', status: 'draft' })], now)
    expect(list.map((e) => e.id)).toEqual(['A', 'B'])
  })

  it('valida el evento antes de guardarlo', () => {
    expect(validateEvent(ev())).toBeNull()
    expect(validateEvent(ev({ title: ' ' }))).toMatch(/nombre/i)
    expect(validateEvent(ev({ startsAt: 'x' }))).toMatch(/fecha/i)
    expect(validateEvent(ev({ tiers: [] }))).toMatch(/tipo de boleta/i)
    expect(validateEvent(ev({ tiers: [{ id: 'a', name: 'Palco', price: 10, capacity: 0 }] }))).toMatch(/al menos 1/i)
  })

  it('una boleta usada o cancelada ya no cambia de estado', () => {
    expect(NEXT_TICKET_STATUS.used).toEqual([])
    expect(NEXT_TICKET_STATUS.cancelled).toEqual([])
    expect(NEXT_TICKET_STATUS.pending).toContain('confirmed')
  })
})
