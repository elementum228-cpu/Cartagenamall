import { describe, expect, it } from 'vitest'
import type { Promotion } from '../src/domain/types'
import { SPOTLIGHT_GAP_MS, SPOTLIGHT_MS, syncPromotionEvents } from '../src/promotions/events'

const T0 = Date.parse('2026-10-29T15:00:00Z')
const promo = (over: Partial<Promotion> = {}): Promotion => ({
  id: 'PROMO-X',
  type: 'flash',
  storeId: 'S1',
  productId: 'P1',
  title: 'Prueba',
  description: '',
  discountPercent: 30,
  startsAt: new Date(T0).toISOString(),
  endsAt: new Date(T0 + 300_000).toISOString(),
  active: true,
  ...over,
})
const assignments = { 'P1-B2': 'S1', 'P1-A1': 'S2', 'P2-E1': 'S3' }

describe('eventos de promoción', () => {
  it('crea el evento con piso, local y punto frente a la vitrina', () => {
    const [e] = syncPromotionEvents([], { promotions: [promo()], assignments, now: T0 + 1000, visibleFloor: null })
    expect(e).toMatchObject({ promotionId: 'PROMO-X', storeId: 'S1', floorId: 'P1', spaceId: 'P1-B2', type: 'flash', status: 'active', discount: 30, spotlight: 'pending' })
    expect(e.targetPosition).toHaveLength(2)
  })

  it('presenta la oferta solo cuando su piso está a la vista, una por piso, y termina sola', () => {
    const promos = [promo(), promo({ id: 'PROMO-Y', storeId: 'S2', startsAt: new Date(T0 + 500).toISOString() })]
    let ev = syncPromotionEvents([], { promotions: promos, assignments, now: T0 + 1000, visibleFloor: null })
    expect(ev.every((e) => e.spotlight === 'pending')).toBe(true)
    ev = syncPromotionEvents(ev, { promotions: promos, assignments, now: T0 + 2000, visibleFloor: 'P1' })
    expect(ev.filter((e) => e.spotlight === 'playing').map((e) => e.promotionId)).toEqual(['PROMO-Y']) // la más reciente
    ev = syncPromotionEvents(ev, { promotions: promos, assignments, now: T0 + 2000 + SPOTLIGHT_MS, visibleFloor: 'P1' })
    expect(ev.find((e) => e.promotionId === 'PROMO-Y')?.spotlight).toBe('done')
    expect(ev.find((e) => e.promotionId === 'PROMO-X')?.spotlight).toBe('pending') // pausa entre presentaciones
    ev = syncPromotionEvents(ev, { promotions: promos, assignments, now: T0 + 2000 + SPOTLIGHT_MS + SPOTLIGHT_GAP_MS, visibleFloor: 'P1' })
    expect(ev.find((e) => e.promotionId === 'PROMO-X')?.spotlight).toBe('playing') // después la otra
  })

  it('una oferta lanzada ahora reemplaza a la que se está presentando', () => {
    const old = promo()
    let ev = syncPromotionEvents([], { promotions: [old], assignments, now: T0 + 1000, visibleFloor: 'P1' })
    const launched = promo({ id: 'NEW', storeId: 'S2', startsAt: new Date(T0 + 3000).toISOString() })
    ev = syncPromotionEvents(ev, { promotions: [old, launched], assignments, now: T0 + 3500, visibleFloor: 'P1' })
    expect(ev.find((e) => e.promotionId === 'NEW')?.spotlight).toBe('playing')
    expect(ev.find((e) => e.promotionId === 'PROMO-X')?.spotlight).toBe('done')
    expect(ev.filter((e) => e.spotlight === 'playing')).toHaveLength(1)
  })

  it('desactivar la promoción termina el evento; reactivarla crea uno nuevo', () => {
    let ev = syncPromotionEvents([], { promotions: [promo()], assignments, now: T0 + 1000, visibleFloor: 'P1' })
    expect(ev[0].spotlight).toBe('playing')
    ev = syncPromotionEvents(ev, { promotions: [promo({ active: false })], assignments, now: T0 + 2000, visibleFloor: 'P1' })
    expect(ev[0]).toMatchObject({ status: 'ended', spotlight: 'done' })
    const again = promo({ startsAt: new Date(T0 + 3000).toISOString() })
    ev = syncPromotionEvents(ev, { promotions: [again], assignments, now: T0 + 4000, visibleFloor: 'P1' })
    expect(ev.filter((e) => e.status === 'active' && e.spotlight === 'playing')).toHaveLength(1)
  })

  it('vence con el reloj y no presenta ofertas secretas ni normales', () => {
    const promos = [promo(), promo({ id: 'S', type: 'secret', storeId: 'S2' }), promo({ id: 'N', type: 'normal', storeId: 'S3' })]
    const ev = syncPromotionEvents([], { promotions: promos, assignments, now: T0 + 400_000, visibleFloor: 'P1' })
    expect(ev.find((e) => e.promotionId === 'PROMO-X')).toMatchObject({ status: 'ended', spotlight: 'done' })
    expect(ev.find((e) => e.promotionId === 'S')?.spotlight).toBe('none')
    expect(ev.find((e) => e.promotionId === 'N')).toMatchObject({ type: 'regular', spotlight: 'none' })
  })

  it('devuelve la misma lista si nada cambió (no re-renderiza)', () => {
    const ev = syncPromotionEvents([], { promotions: [promo()], assignments, now: T0 + 1000, visibleFloor: null })
    expect(syncPromotionEvents(ev, { promotions: [promo()], assignments, now: T0 + 1500, visibleFloor: null })).toBe(ev)
  })
})

describe('promociones creadas por el comerciante', () => {
  it('valida descuento, duración y código', async () => {
    const { validatePromotion } = await import('../src/promotions/build')
    const base = { type: 'flash' as const, storeId: 'S1', productId: 'P1', productName: 'Vela', discountPercent: 20, title: '', minutes: 30 }
    expect(validatePromotion(base)).toBeNull()
    expect(validatePromotion({ ...base, discountPercent: 90 })).toMatch(/entre/)
    expect(validatePromotion({ ...base, minutes: 2 })).toMatch(/mínima/)
    expect(validatePromotion({ ...base, type: 'secret', code: 'x' })).toMatch(/código/)
    expect(validatePromotion({ ...base, type: 'normal', minutes: 0 })).toBeNull()
  })

  it('arma la promoción desde ahora, con id libre, y la relámpago se presenta', async () => {
    const { buildPromotion } = await import('../src/promotions/build')
    const p = buildPromotion({ type: 'flash', storeId: 'S1', productId: 'P1', productName: 'Vela', discountPercent: 20, title: '', minutes: 30 }, T0, new Set([`PROMO-F-${T0.toString(36)}`]))
    expect(p.id).not.toBe(`PROMO-F-${T0.toString(36)}`)
    expect(p.title).toBe('Relámpago: Vela')
    expect(Date.parse(p.endsAt!) - Date.parse(p.startsAt)).toBe(30 * 60_000)
    const [e] = syncPromotionEvents([], { promotions: [p], assignments, now: T0 + 500, visibleFloor: 'P1' })
    expect(e).toMatchObject({ type: 'flash', status: 'active', spotlight: 'playing' })
  })
})
