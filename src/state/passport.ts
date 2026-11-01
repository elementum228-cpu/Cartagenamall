import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { COURT_SPACE, SPACE_BY_ID, ZONES } from '../config/mall'
import type { Store } from '../domain/types'
import { useCatalog } from './catalog'
import { useOrders } from './orders'
import { usePersonal } from './personal'
import { safeStorage } from './storage'
import { useUI } from './ui'

// Pasaporte del mall: sellos por visitar cada pasillo (y la cancha, encontrar una gema y completar
// la búsqueda del tesoro) más una tarjeta de sellos por tienda, que se llena comprando y se canjea
// por el premio que define cada comerciante. Vive en este dispositivo.

/** Sellos del pasaporte, en orden. */
export const PASSPORT_STAMPS: { id: string; name: string; hint: string; color: string; zone?: string }[] = [
  ...ZONES.map((z) => ({ id: z.id, name: z.name, hint: z.id === 'F' ? 'Visita un negocio de la zona Soporte' : `Visita una tienda del ${z.id === 'E' ? 'Piso 2' : `pasillo ${z.id}`}`, color: z.color, zone: z.id })),
  { id: 'CANCHA', name: 'Zona de deportes', hint: 'Abre la zona de deportes en el mapa', color: '#2f9e5a' },
  { id: 'GEMA', name: 'Cazador de gemas', hint: 'Encuentra una oferta escondida', color: '#e39a2d' },
  { id: 'TESORO', name: 'Búsqueda del tesoro', hint: 'Resuelve las 3 pistas de la semana', color: '#062c42' },
]

/** Premio por completar el pasaporte (todos los sellos). */
export const PASSPORT_PRIZE = 'Bono de $20.000 para usar en la tienda que elijas'

/** Tarjeta de sellos de una tienda: cuántos sellos pide y qué regala. Sin configurar, esta. */
export const DEFAULT_LOYALTY = { stamps: 5, reward: '10 % de descuento en tu próxima compra', active: true }
export const MIN_LOYALTY_STAMPS = 3
export const MAX_LOYALTY_STAMPS = 12
export const loyaltyOf = (store: Pick<Store, 'loyalty'> | undefined) => ({ ...DEFAULT_LOYALTY, ...(store?.loyalty ?? {}) })

export interface Redemption {
  code: string
  storeId: string
  reward: string
  at: string
}

interface PassportState {
  /** Sello del pasaporte → cuándo se ganó. */
  stamps: Record<string, string>
  /** Sellos acumulados (sin canjear) por tienda. */
  cards: Record<string, number>
  /** Pedidos que ya dieron sello (para no contarlos dos veces). */
  countedOrders: string[]
  redemptions: Redemption[]
  /** Código del premio del pasaporte completo, cuando se reclama. */
  passportPrize: Redemption | null
  /** Búsqueda del tesoro: semana en curso y cuántas pistas lleva encontradas. */
  hunt: { week: number; found: number }
  /** Último sello ganado, para celebrarlo en pantalla. */
  lastStamp: { kind: 'passport' | 'store'; id: string; at: number } | null
  stamp: (id: string) => void
  addStoreStamp: (storeId: string) => void
  redeem: (storeId: string, needed: number, reward: string) => Redemption | null
  claimPassportPrize: () => Redemption | null
  /** Marca encontrada la pista `index` de la semana `week` (solo si es la que tocaba). */
  findClue: (week: number, index: number, total: number) => void
  clearCelebration: () => void
  reset: () => void
}

/** Código corto y legible para mostrar en caja (sin letras que se confunden). */
export function rewardCode(seed: number = Date.now() + Math.random() * 1e6) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let n = Math.floor(seed)
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += abc[n % abc.length]
    n = Math.floor(n / abc.length) + i * 7919
  }
  return `CM-${out}`
}

export const usePassport = create<PassportState>()(
  persist(
    (set, get) => ({
      stamps: {},
      cards: {},
      countedOrders: [],
      redemptions: [],
      passportPrize: null,
      lastStamp: null,
      hunt: { week: -1, found: 0 },
      stamp: (id) => {
        if (get().stamps[id] || !PASSPORT_STAMPS.some((s) => s.id === id)) return
        set((s) => ({ stamps: { ...s.stamps, [id]: new Date().toISOString() }, lastStamp: { kind: 'passport', id, at: Date.now() } }))
      },
      addStoreStamp: (storeId) => set((s) => ({ cards: { ...s.cards, [storeId]: (s.cards[storeId] ?? 0) + 1 }, lastStamp: { kind: 'store', id: storeId, at: Date.now() } })),
      redeem: (storeId, needed, reward) => {
        if ((get().cards[storeId] ?? 0) < needed) return null
        const r: Redemption = { code: rewardCode(), storeId, reward, at: new Date().toISOString() }
        set((s) => ({ cards: { ...s.cards, [storeId]: (s.cards[storeId] ?? 0) - needed }, redemptions: [r, ...s.redemptions] }))
        return r
      },
      claimPassportPrize: () => {
        const s = get()
        if (s.passportPrize) return s.passportPrize
        if (!PASSPORT_STAMPS.every((p) => s.stamps[p.id])) return null
        const r: Redemption = { code: rewardCode(), storeId: '', reward: PASSPORT_PRIZE, at: new Date().toISOString() }
        set({ passportPrize: r })
        return r
      },
      findClue: (week, index, total) => {
        const h = get().hunt
        const found = h.week === week ? h.found : 0
        if (index !== found) return
        set({ hunt: { week, found: found + 1 } })
        if (found + 1 >= total) get().stamp('TESORO')
      },
      clearCelebration: () => set({ lastStamp: null }),
      reset: () => set({ stamps: {}, cards: {}, countedOrders: [], redemptions: [], passportPrize: null, lastStamp: null, hunt: { week: -1, found: 0 } }),
    }),
    { name: 'cm:passport:v1', storage: safeStorage, partialize: ({ lastStamp: _l, ...rest }) => rest },
  ),
)

/** Pistas encontradas esta semana (una semana nueva empieza en cero). */
export const huntProgress = (hunt: { week: number; found: number }, week: number) => (hunt.week === week ? hunt.found : 0)

/** Sello del pasaporte que da abrir este local o tienda (su pasillo), o null. */
export function stampForVisit(spaceId: string | null, openStoreId: string | null, courtOpen: boolean, peek: boolean): string | null {
  if (courtOpen || spaceId === COURT_SPACE.id) return 'CANCHA'
  const { stores, assignments } = useCatalog.getState()
  if (spaceId && !peek) {
    const store = stores.find((s) => s.id === assignments[spaceId])
    return store ? SPACE_BY_ID[spaceId]?.zoneId ?? null : null
  }
  if (openStoreId) return stores.find((s) => s.id === openStoreId)?.zoneId ?? null
  return null
}

let started = false
/** Escucha el mall para dar sellos: visitas a tiendas, gemas encontradas y pedidos hechos. */
export function startPassport() {
  if (started) return
  started = true
  const passport = usePassport.getState

  useUI.subscribe((s, prev) => {
    if (s.showroom && s.showroom !== prev.showroom) passport().stamp('F')
    if (s.selectedSpaceId === prev.selectedSpaceId && s.openStoreId === prev.openStoreId && s.courtOpen === prev.courtOpen && s.peek === prev.peek) return
    const id = stampForVisit(s.selectedSpaceId, s.openStoreId, s.courtOpen, s.peek)
    if (id) passport().stamp(id)
  })

  const checkGems = () => usePersonal.getState().discovered.length > 0 && passport().stamp('GEMA')
  usePersonal.subscribe(checkGems)

  // cada pedido nuevo da un sello en la tarjeta de cada tienda incluida
  const checkOrders = () => {
    const { orders } = useOrders.getState()
    const counted = new Set(passport().countedOrders)
    const fresh = orders.filter((o) => !counted.has(o.id))
    if (!fresh.length) return
    usePassport.setState((s) => ({ countedOrders: [...s.countedOrders, ...fresh.map((o) => o.id)] }))
    for (const o of fresh) for (const storeId of new Set(o.subOrders.map((so) => so.storeId))) passport().addStoreStamp(storeId)
  }
  // los pedidos hechos antes de existir el pasaporte no cuentan: se marcan como vistos al arrancar
  const boot = () => {
    if (!passport().countedOrders.length && !Object.keys(passport().cards).length)
      usePassport.setState({ countedOrders: useOrders.getState().orders.map((o) => o.id) })
    useOrders.subscribe(checkOrders)
    checkGems()
  }
  if (usePassport.persist.hasHydrated()) boot()
  else usePassport.persist.onFinishHydration(boot)
}
