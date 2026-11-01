import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, Promotion, Store } from '../domain/types'
import { appClock } from '../lib/clock'
import { useCatalog } from '../state/catalog'
import { safeStorage } from '../state/storage'

// Barco de los descuentos: un barco blanco e iluminado que atraca en el muelle a horas fijas y se
// queda un rato. Cada local puede «subir al barco» un descuento especial (uno por local). Mientras
// el barco está atracado, esos descuentos son promociones reales del catálogo (se cobran en el
// carrito) y se van con él. Si pocos locales subieron ofertas, se completan con ejemplos marcados.

/** Llegadas programadas: día de la semana (0 = domingo) y hora local. */
export const SHIP_SCHEDULE = [
  { day: 5, hour: 19 },
  { day: 6, hour: 19 },
]
export const SHIP_SCHEDULE_LABEL = 'Viernes y sábados, 7:00 p. m.'
/** Cuánto se queda atracado. */
export const SHIP_STAY_MIN = 30
/** Mínimo de ofertas para zarpar (se completa con ejemplos) y máximo a bordo. */
export const SHIP_MIN_OFFERS = 5
export const SHIP_MAX_OFFERS = 10
export const SHIP_MIN_DISCOUNT = 10
export const SHIP_MAX_DISCOUNT = 70

export interface ShipOffer {
  storeId: string
  productId: string
  discountPercent: number
  /** Cupos (unidades) para el viaje; null = hasta agotar inventario. */
  units: number | null
  /** Oferta de ejemplo, para la demostración (no la subió el local). */
  demo?: boolean
}

interface ShipState {
  /** Ofertas que subieron los locales para el próximo viaje (una por local). */
  offers: ShipOffer[]
  /** Llegada en curso: cuándo atracó y cuándo zarpa. */
  arrival: { at: number; until: number } | null
  setOffer: (offer: ShipOffer) => void
  removeOffer: (storeId: string) => void
  /** Hace atracar el barco ahora (prueba o llegada programada). */
  arrive: (minutes?: number) => void
  depart: () => void
}

export const PROMO_PREFIX = 'PROMO-BARCO-'
export const isShipPromotion = (p: Pick<Promotion, 'id'>) => p.id.startsWith(PROMO_PREFIX)

export const useDiscountShip = create<ShipState>()(
  persist(
    (set, get) => ({
      offers: [],
      arrival: null,
      setOffer: (offer) => set((s) => ({ offers: [...s.offers.filter((o) => o.storeId !== offer.storeId), { ...offer, demo: false }] })),
      removeOffer: (storeId) => set((s) => ({ offers: s.offers.filter((o) => o.storeId !== storeId) })),
      arrive: (minutes = SHIP_STAY_MIN) => {
        const now = appClock.now()
        const arrival = { at: now, until: now + minutes * 60_000 }
        set({ arrival })
        boardPromotions(get().offers, arrival.until)
      },
      depart: () => {
        set({ arrival: null })
        unboardPromotions()
      },
    }),
    { name: 'cm:ship:v1', storage: safeStorage },
  ),
)

/** ¿Está atracado ahora? */
export const isDocked = (arrival: ShipState['arrival'], now: number) => !!arrival && now >= arrival.at && now < arrival.until

/** Próxima llegada programada (ms), a partir de `now`. */
export function nextScheduledArrival(now: number): number {
  const d = new Date(now)
  for (let add = 0; add <= 7; add++) {
    const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + add)
    for (const s of SHIP_SCHEDULE) {
      if (c.getDay() !== s.day) continue
      const t = new Date(c.getFullYear(), c.getMonth(), c.getDate(), s.hour).getTime()
      if (t > now) return t
    }
  }
  return now
}

/** Si hay una llegada programada en curso (dentro de la ventana de estadía), su ventana. */
export function scheduledWindow(now: number): { at: number; until: number } | null {
  const d = new Date(now)
  for (const s of SHIP_SCHEDULE) {
    if (d.getDay() !== s.day) continue
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.hour).getTime()
    if (now >= at && now < at + SHIP_STAY_MIN * 60_000) return { at, until: at + SHIP_STAY_MIN * 60_000 }
  }
  return null
}

/** Rótulo corto de la próxima llegada: «hoy 7:00 p. m.», «viernes 7:00 p. m.». */
export function arrivalLabel(at: number, now: number) {
  const d = new Date(at)
  const today = new Date(now)
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
  return `${sameDay ? 'hoy' : d.toLocaleDateString('es-CO', { weekday: 'long' })} ${time}`
}

/**
 * Lo que va a bordo: las ofertas de los locales (las que siguen siendo válidas) y, si no alcanzan el
 * mínimo, ejemplos de otras tiendas abiertas. Una por local, ordenadas por descuento.
 */
export function shipLineup(offers: ShipOffer[], stores: Store[], products: Product[]): ShipOffer[] {
  const open = new Set(stores.filter((s) => s.status === 'open').map((s) => s.id))
  const active = new Map(products.filter((p) => p.active).map((p) => [p.id, p]))
  const seen = new Set<string>()
  const real = offers.filter((o) => open.has(o.storeId) && active.get(o.productId)?.storeId === o.storeId && !seen.has(o.storeId) && !!seen.add(o.storeId))
  const out = [...real]
  if (out.length < SHIP_MIN_OFFERS) {
    const taken = new Set(out.map((o) => o.storeId))
    const pcts = [30, 25, 40, 20, 35, 30, 25, 45]
    let k = 0
    for (const s of stores) {
      if (out.length >= Math.max(SHIP_MIN_OFFERS, 8)) break
      if (!open.has(s.id) || taken.has(s.id)) continue
      const p = products.find((x) => x.storeId === s.id && x.active && x.featured) ?? products.find((x) => x.storeId === s.id && x.active)
      if (!p) continue
      out.push({ storeId: s.id, productId: p.id, discountPercent: pcts[k++ % pcts.length], units: 20, demo: true })
      taken.add(s.id)
    }
  }
  return out.sort((a, b) => b.discountPercent - a.discountPercent).slice(0, SHIP_MAX_OFFERS)
}

/** Sube a bordo: cada oferta pasa a ser una promoción del catálogo que vence cuando zarpa. */
function boardPromotions(offers: ShipOffer[], until: number) {
  const { stores, products, upsertPromotion } = useCatalog.getState()
  unboardPromotions()
  const now = appClock.now()
  for (const o of shipLineup(offers, stores, products)) {
    const product = products.find((p) => p.id === o.productId)
    if (!product) continue
    upsertPromotion({
      id: `${PROMO_PREFIX}${o.storeId}`,
      type: 'normal',
      storeId: o.storeId,
      productId: o.productId,
      title: `Barco de los descuentos · ${product.name}`,
      description: o.demo ? 'Oferta de ejemplo del barco de los descuentos (demostración).' : 'Descuento especial que este local subió al barco de los descuentos.',
      discountPercent: o.discountPercent,
      startsAt: new Date(now).toISOString(),
      endsAt: new Date(until).toISOString(),
      active: true,
    })
  }
}

function unboardPromotions() {
  const { promotions, deletePromotion } = useCatalog.getState()
  for (const p of promotions) if (isShipPromotion(p)) deletePromotion(p.id)
}
