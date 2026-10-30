import { SPACE_BY_ID } from '../config/mall'
import type { Promotion } from '../domain/types'
import { appClock } from '../lib/clock'
import { isPromotionLive } from '../lib/pricing'
import { useCatalog } from '../state/catalog'

// Promoción de prueba para ver un evento completo: una tienda ficticia del piso 1 lanza un 30 %
// durante 5 minutos. Es un dato de demostración, identificado como tal en su título y descripción.

export const DEMO_PROMO_ID = 'PROMO-DEMO'
const DEMO_STORE_ID = 'STORE-005'
const DEMO_MINUTES = 5

export const isDemoPromotion = (p: Pick<Promotion, 'id'>) => p.id === DEMO_PROMO_ID

export function demoPromotion() {
  return useCatalog.getState().promotions.find(isDemoPromotion) ?? null
}

/** Activa (o reactiva) la promoción de prueba. Devuelve el espacio de la tienda o null si no hay dónde. */
export function activateDemoPromotion(): string | null {
  const { stores, products, promotions, assignments, upsertPromotion } = useCatalog.getState()
  const spaceOf = (storeId: string) => Object.keys(assignments).find((sp) => assignments[sp] === storeId)
  const onP1 = (storeId: string) => SPACE_BY_ID[spaceOf(storeId) ?? '']?.floorId === 'P1'
  // La cámara isométrica mira desde +x +z: se prefiere una vitrina orientada hacia ella.
  const facesCamera = (storeId: string) => {
    const r = SPACE_BY_ID[spaceOf(storeId) ?? '']?.rotation ?? 0
    return Math.sin(r) + Math.cos(r) > 0.5
  }
  const candidates = stores.filter((s) => onP1(s.id) && s.status === 'open')
  const store = candidates.find((s) => s.id === DEMO_STORE_ID) ?? candidates.find((s) => facesCamera(s.id)) ?? candidates[0]
  if (!store) return null
  const now = appClock.now()
  const others = new Set(promotions.filter((p) => !isDemoPromotion(p) && isPromotionLive(p, now)).map((p) => p.productId))
  const mine = products.filter((p) => p.storeId === store.id && p.active)
  // Mejor un producto sin otra oferta y sin opciones, para poder agregarlo al carrito de una vez.
  const product =
    mine.find((p) => !others.has(p.id) && !p.variants.length && !p.sizes.length) ?? mine.find((p) => !others.has(p.id)) ?? mine[0]
  if (!product) return null
  upsertPromotion({
    id: DEMO_PROMO_ID,
    type: 'flash',
    storeId: store.id,
    productId: product.id,
    title: `DEMO · ${product.name} −30%`,
    description: 'Promoción ficticia de prueba para la demostración. No es una oferta real.',
    discountPercent: 30,
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + DEMO_MINUTES * 60_000).toISOString(),
    durationHours: DEMO_MINUTES / 60,
    active: true,
  })
  return spaceOf(store.id) ?? null
}

/** Termina la promoción de prueba: el evento acaba y los visitantes vuelven a sus rutas. */
export function endDemoPromotion() {
  const { promotions, setPromotionActive } = useCatalog.getState()
  if (promotions.some(isDemoPromotion)) setPromotionActive(DEMO_PROMO_ID, false)
}
