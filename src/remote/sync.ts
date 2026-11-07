import type { Order, Product, Promotion, SpaceClaim, Store, SubOrder } from '../domain/types'
import { SEED_ASSIGNMENTS, SEED_PRODUCTS, SEED_STORES, createSeedPromotions } from '../data/seed'
import { isDemoPromotion } from '../promotions/demo'
import { isShipPromotion, syncShipBoarding, useDiscountShip, type ShipOffer } from '../ship/offers'

/** Promociones que viven solo en este dispositivo (demostración y barco de los descuentos). */
const isLocalPromotion = (p: Promotion) => isDemoPromotion(p) || isShipPromotion(p)
import { useCatalog } from '../state/catalog'
import { useClaims } from '../state/claims'
import { useSpacePricing, type Pricing } from '../state/spacePricing'
import { useSeasonSettings, type SeasonMode } from '../state/season'
import { useOrders } from '../state/orders'
import { useAirportFeature } from '../state/airportFeature'
import { useEntertainmentFeature } from '../state/entertainmentFeature'
import { useStadiumPhase } from '../state/stadium'
import type { StadiumPhase } from '../config/stadium'
import { usePirateShip } from '../state/pirate'
import { useReservations, type CourtReservation } from '../state/reservations'
import { useUI } from '../state/ui'
import { supabase } from './client'
import { useSession } from './session'

// Sincronización con Supabase. El estado de la app sigue viviendo en los stores de zustand (que
// también hacen de caché sin conexión); este módulo:
//   1. carga el catálogo compartido al abrir y lo mantiene al día en vivo (realtime),
//   2. sube a la base lo que cambia una persona con sesión (admin o comerciante),
//   3. envía pedidos, solicitudes de locales y reservas de la cancha (cualquiera),
//   4. trae pedidos, solicitudes y reservas para quien tiene permiso de verlos.
// La seguridad la ponen las reglas RLS de la base (supabase/migrations), no este código.

/** Mientras se aplica algo que vino de la base, los cambios no se vuelven a subir. */
let applying = false
function applyRemote(fn: () => void) {
  applying = true
  try {
    fn()
  } finally {
    applying = false
  }
}

const toast = (msg: string) => useUI.getState().toast(msg, 'error')
const signedIn = () => !!useSession.getState().userId

// ── Catálogo ─────────────────────────────────────────────────────────────────

type Doc<T> = { doc: T }

export async function loadCatalog() {
  if (!supabase) return
  const [s, p, pr, a] = await Promise.all([
    supabase.from('stores').select('doc'),
    supabase.from('products').select('doc'),
    supabase.from('promotions').select('doc'),
    supabase.from('space_assignments').select('space_id, store_id'),
  ])
  const err = s.error ?? p.error ?? pr.error ?? a.error
  if (err) {
    toast(`No se pudo cargar el catálogo en línea: ${err.message}`)
    return
  }
  const local = useCatalog.getState()
  applyRemote(() =>
    useCatalog.setState({
      stores: (s.data as Doc<Store>[]).map((r) => r.doc),
      products: (p.data as Doc<Product>[]).map((r) => r.doc),
      // la promoción de prueba es local (control de demostración), se conserva
      promotions: [...(pr.data as Doc<Promotion>[]).map((r) => r.doc), ...local.promotions.filter(isLocalPromotion)],
      assignments: Object.fromEntries((a.data as { space_id: string; store_id: string }[]).map((r) => [r.space_id, r.store_id])),
    }),
  )
}

/** Seguimiento en vivo del pedido del cliente: trae el estado de cada tienda (sin datos personales) y lo refleja en su pedido. */
export async function refreshOrderTracking(orderId: string) {
  if (!supabase) return
  const { data, error } = await supabase.rpc('order_tracking', { p_order_id: orderId })
  if (error || !Array.isArray(data)) return
  const rows = data as { sub_id: string; status: SubOrder['status']; history: SubOrder['history'] }[]
  applyRemote(() =>
    useOrders.setState((s) => ({
      orders: s.orders.map((o) =>
        o.id !== orderId
          ? o
          : {
              ...o,
              subOrders: o.subOrders.map((sub) => {
                const r = rows.find((x) => x.sub_id === sub.id)
                if (!r || r.status === sub.status) return sub
                return { ...sub, status: r.status, history: Array.isArray(r.history) && r.history.length ? r.history : sub.history }
              }),
            },
      ),
    })),
  )
}

/** Sube una imagen embebida (data URL) a Storage y devuelve su URL pública. */
async function uploadDataUrl(dataUrl: string, path: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const full = `${path}-${Date.now().toString(36)}.${ext}`
  const { error } = await supabase!.storage.from('media').upload(full, blob, { contentType: blob.type, upsert: true })
  if (error) throw error
  return supabase!.storage.from('media').getPublicUrl(full).data.publicUrl
}

function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((x) => [x.id, x]))
  const ids = new Set(next.map((x) => x.id))
  return { changed: next.filter((x) => before.get(x.id) !== x), removed: prev.filter((x) => !ids.has(x.id)).map((x) => x.id) }
}

let queue: Promise<void> = Promise.resolve()
function enqueue(task: () => Promise<void>) {
  queue = queue.then(task).catch(async (e: { message?: string }) => {
    toast(`No se guardó en línea: ${e?.message ?? 'error desconocido'}. Se recargan los datos.`)
    await loadCatalog()
    await loadPricing()
  })
}

function pushCatalog(prev: ReturnType<typeof useCatalog.getState>, next: ReturnType<typeof useCatalog.getState>) {
  const db = supabase!
  const stores = diff(prev.stores, next.stores)
  const products = diff(prev.products, next.products)
  const promos = diff(prev.promotions.filter((p) => !isLocalPromotion(p)), next.promotions.filter((p) => !isLocalPromotion(p)))
  const assignChanged = prev.assignments !== next.assignments
  if (!stores.changed.length && !stores.removed.length && !products.changed.length && !products.removed.length && !promos.changed.length && !promos.removed.length && !assignChanged) return
  enqueue(async () => {
    for (let st of stores.changed) {
      if (st.logo?.startsWith('data:')) {
        const url = await uploadDataUrl(st.logo, `${st.id}/logo`)
        st = { ...st, logo: url }
        const id = st.id
        const patched = st
        applyRemote(() => useCatalog.setState((s) => ({ stores: s.stores.map((x) => (x.id === id ? patched : x)) })))
      }
      const { error } = await db.from('stores').upsert({ id: st.id, doc: st })
      if (error) throw error
    }
    for (let pr of products.changed) {
      if (pr.image?.startsWith('data:')) {
        const url = await uploadDataUrl(pr.image, `${pr.storeId}/${pr.id}`)
        pr = { ...pr, image: url }
        const patched = pr
        applyRemote(() => useCatalog.setState((s) => ({ products: s.products.map((x) => (x.id === patched.id ? patched : x)) })))
      }
      const { error } = await db.from('products').upsert({ id: pr.id, store_id: pr.storeId, doc: pr })
      if (error) throw error
    }
    if (products.removed.length) {
      const { error } = await db.from('products').delete().in('id', products.removed)
      if (error) throw error
    }
    for (const p of promos.changed) {
      const { error } = await db.from('promotions').upsert({ id: p.id, store_id: p.storeId, doc: p })
      if (error) throw error
    }
    if (promos.removed.length) {
      const { error } = await db.from('promotions').delete().in('id', promos.removed)
      if (error) throw error
    }
    if (assignChanged) {
      const before = prev.assignments
      const after = next.assignments
      const gone = Object.keys(before).filter((sp) => after[sp] !== before[sp])
      if (gone.length) {
        const { error } = await db.from('space_assignments').delete().in('space_id', gone)
        if (error) throw error
      }
      const added = Object.entries(after).filter(([sp, st]) => before[sp] !== st)
      if (added.length) {
        // una tienda ocupa un solo local: se libera el anterior antes de asignar
        await db.from('space_assignments').delete().in('store_id', added.map(([, st]) => st))
        const { error } = await db.from('space_assignments').upsert(added.map(([space_id, store_id]) => ({ space_id, store_id })))
        if (error) throw error
      }
    }
    if (stores.removed.length) {
      const { error } = await db.from('stores').delete().in('id', stores.removed)
      if (error) throw error
    }
  })
}

/** Publica el catálogo de demostración en la base (solo admin; no borra lo que ya exista). */
export async function seedRemoteCatalog() {
  if (!supabase) return 'Sin base de datos.'
  const now = Date.now()
  const promos = createSeedPromotions(now)
  const steps = [
    () => supabase!.from('stores').upsert(SEED_STORES.map((s) => ({ id: s.id, doc: s }))),
    () => supabase!.from('products').upsert(SEED_PRODUCTS.map((p) => ({ id: p.id, store_id: p.storeId, doc: p }))),
    () => supabase!.from('promotions').upsert(promos.map((p) => ({ id: p.id, store_id: p.storeId, doc: p }))),
    () => supabase!.from('space_assignments').upsert(Object.entries(SEED_ASSIGNMENTS).map(([space_id, store_id]) => ({ space_id, store_id }))),
  ]
  for (const step of steps) {
    const { error } = await step()
    if (error) return error.message
  }
  await loadCatalog()
  return null
}

// ── Pedidos, solicitudes y reservas ──────────────────────────────────────────

function pushOrders(prev: Order[], next: Order[]) {
  const db = supabase!
  const known = new Set(prev.map((o) => o.id))
  const before = new Map(prev.flatMap((o) => o.subOrders.map((s) => [s.id, s] as const)))
  const created = next.filter((o) => !known.has(o.id))
  const updated = next.flatMap((o) => o.subOrders).filter((s) => before.has(s.id) && before.get(s.id) !== s)
  if (!created.length && !updated.length) return
  enqueue(async () => {
    for (const o of created) {
      const { error } = await db.from('orders').insert({ id: o.id, doc: o })
      if (error) throw error
      const { error: e2 } = await db.from('sub_orders').insert(o.subOrders.map((s) => ({ id: s.id, order_id: o.id, store_id: s.storeId, status: 'pending_confirmation', doc: s })))
      if (e2) throw e2
      // los pedidos que el comercio registra a mano nacen ya entregados (la base solo deja crearlos como pendientes)
      for (const s of o.subOrders.filter((x) => x.status !== 'pending_confirmation')) {
        const { error: e3 } = await db.from('sub_orders').update({ status: s.status, doc: s }).eq('id', s.id)
        if (e3) throw e3
      }
    }
    for (const s of updated) {
      const { error } = await db.from('sub_orders').update({ status: s.status, doc: s }).eq('id', s.id)
      if (error) throw error
    }
  })
}

function pushClaims(prev: SpaceClaim[], next: SpaceClaim[]) {
  const db = supabase!
  const before = new Map(prev.map((c) => [c.id, c]))
  const created = next.filter((c) => !before.has(c.id))
  const updated = next.filter((c) => before.has(c.id) && before.get(c.id) !== c)
  const removed = prev.filter((c) => !next.some((n) => n.id === c.id))
  if (!created.length && !updated.length && !removed.length) return
  enqueue(async () => {
    if (removed.length) {
      const { error } = await db.from('space_claims').delete().in('id', removed.map((c) => c.id))
      if (error) throw error
    }
    for (const c of created) {
      const { error } = await db.from('space_claims').insert({ id: c.id, status: 'pending', doc: c })
      if (error) throw error
    }
    for (const c of updated) {
      const { error } = await db.from('space_claims').update({ status: c.status, doc: c }).eq('id', c.id)
      if (error) throw error
    }
  })
}

function pushReservations(prev: CourtReservation[], next: CourtReservation[]) {
  const db = supabase!
  const before = new Map(prev.map((r) => [r.id, r]))
  const created = next.filter((r) => !before.has(r.id))
  const updated = next.filter((r) => before.has(r.id) && before.get(r.id) !== r)
  if (!created.length && !updated.length) return
  enqueue(async () => {
    for (const r of created) {
      const row = { id: r.id, day: r.day, hour: r.hour, status: 'pending', doc: r }
      let { error } = await db.from('court_reservations').insert({ ...row, court: r.court ?? 'A' })
      // sin la migración 0005 la tabla aún no tiene la columna de cancha: se guarda como antes
      if (error && r.court !== 'KARTS' && /court/.test(error.message)) ({ error } = await db.from('court_reservations').insert(row))
      if (error) {
        // otro navegador tomó el horario un instante antes
        applyRemote(() => useReservations.setState((s) => ({ reservations: s.reservations.filter((x) => x.id !== r.id) })))
        toast(error.code === '23505' ? 'Ese horario se acaba de ocupar. Elige otro.' : `No se pudo enviar la reserva: ${error.message}`)
        continue
      }
    }
    // cancelar una reserva propia: solo el admin puede cambiarla en la base; para quien reservó
    // queda cancelada en su navegador y la cancha la libera al confirmar por WhatsApp
    if (useSession.getState().isAdmin)
      for (const r of updated) {
        const { error } = await db.from('court_reservations').update({ status: r.status, doc: r }).eq('id', r.id)
        if (error) throw error
      }
  })
}

/** Horas ocupadas de un día (de cualquier persona) para la grilla de reservas. */
export async function courtTakenHours(day: string, court: 'A' | 'B' | 'KARTS' = 'A'): Promise<number[] | null> {
  if (!supabase) return null
  let { data, error } = await supabase.rpc('court_taken_hours', { p_day: day, p_court: court })
  // sin la migración 0005 (una sola cancha): las horas ocupadas de la única cancha
  if (error && court !== 'KARTS') ({ data, error } = await supabase.rpc('court_taken_hours', { p_day: day }))
  if (error) return null
  return (data as number[]) ?? []
}

/** Solo los pedidos visibles para la sesión (comercio: los de sus tiendas; admin: todos). Se usa para el aviso de pedidos nuevos. */
export async function refreshOrders() {
  if (!supabase || !signedIn()) return
  const [subs, orders] = await Promise.all([supabase.from('sub_orders').select('order_id, doc, status'), supabase.from('orders').select('id, doc')])
  if (subs.error || orders.error) return
  const byOrder = new Map<string, SubOrder[]>()
  for (const r of subs.data as { order_id: string; doc: SubOrder; status: SubOrder['status'] }[])
    byOrder.set(r.order_id, [...(byOrder.get(r.order_id) ?? []), { ...r.doc, status: r.status }])
  const remote = (orders.data as { id: string; doc: Order }[]).map((r) => ({ ...r.doc, subOrders: byOrder.get(r.id) ?? [] }))
  const ids = new Set(remote.map((o) => o.id))
  applyRemote(() => useOrders.setState((st) => ({ orders: [...remote, ...st.orders.filter((o) => !ids.has(o.id))].sort((x, y) => y.createdAt.localeCompare(x.createdAt)) })))
}

/** Pedidos, solicitudes y reservas visibles para la sesión (admin: todo; comercio: lo suyo). */
async function loadPrivate() {
  if (!supabase || !signedIn()) return
  const { isAdmin } = useSession.getState()
  const [subs, orders] = await Promise.all([supabase.from('sub_orders').select('order_id, doc, status'), supabase.from('orders').select('id, doc')])
  if (!subs.error && !orders.error) {
    const byOrder = new Map<string, SubOrder[]>()
    for (const r of subs.data as { order_id: string; doc: SubOrder; status: SubOrder['status'] }[])
      byOrder.set(r.order_id, [...(byOrder.get(r.order_id) ?? []), { ...r.doc, status: r.status }])
    const remote = (orders.data as { id: string; doc: Order }[]).map((r) => ({ ...r.doc, subOrders: byOrder.get(r.id) ?? [] }))
    const ids = new Set(remote.map((o) => o.id))
    applyRemote(() => useOrders.setState((s) => ({ orders: [...remote, ...s.orders.filter((o) => !ids.has(o.id))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })))
  }
  if (isAdmin) {
    const [claims, res] = await Promise.all([supabase.from('space_claims').select('doc, status'), supabase.from('court_reservations').select('doc, status')])
    if (!claims.error) {
      const remote = (claims.data as { doc: SpaceClaim; status: SpaceClaim['status'] }[]).map((r) => ({ ...r.doc, status: r.status }))
      applyRemote(() => useClaims.setState({ claims: remote.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
    }
    if (!res.error) {
      const remote = (res.data as { doc: CourtReservation; status: CourtReservation['status'] | 'confirmed' }[]).map((r) => ({ ...r.doc, status: r.status === 'cancelled' ? 'cancelled' : 'pending' }) as CourtReservation)
      applyRemote(() => useReservations.setState({ reservations: remote.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
    }
  }
}

// ── Precios de los espacios (los fija el dueño) ──────────────────────────────

/** Sin la migración 0002 la tabla no existe: se siguen usando los precios locales sin avisar. */
let pricingTable = true
export async function loadPricing() {
  if (!supabase || !pricingTable) return
  const { data, error } = await supabase.from('mall_settings').select('doc').eq('key', 'pricing').maybeSingle()
  if (error) {
    pricingTable = false
    console.warn('Precios de los locales: falta la tabla mall_settings (supabase/migrations/0002_mall_settings.sql).', error.message)
    return
  }
  const doc = (data as Doc<Pricing> | null)?.doc
  applyRemote(() => useSpacePricing.setState({ types: doc?.types ?? {}, spaces: doc?.spaces ?? {} }))
}

/** Temporada elegida por el administrador (decoración del mall), en mall_settings «season». */
export async function loadSeason() {
  if (!supabase || !pricingTable) return
  const { data, error } = await supabase.from('mall_settings').select('doc').eq('key', 'season').maybeSingle()
  if (error) return
  const mode = (data as Doc<{ mode: SeasonMode }> | null)?.doc?.mode
  if (mode) applyRemote(() => useSeasonSettings.setState({ mode }))
}

/** Respaldo del tiempo real: trae solo las promociones (las que otro local acaba de lanzar) y las aplica si cambiaron. */
async function refreshPromotions() {
  if (!supabase || document.hidden) return
  const { data, error } = await supabase.from('promotions').select('doc')
  if (error || !data) return
  const remote = (data as Doc<Promotion>[]).map((r) => r.doc)
  const local = useCatalog.getState().promotions
  const kept = local.filter(isLocalPromotion)
  const next = [...remote, ...kept]
  if (JSON.stringify(next) === JSON.stringify(local)) return
  applyRemote(() => useCatalog.setState({ promotions: next }))
}

// ── Barco de los descuentos compartido ───────────────────────────────────────

/** Trae las ofertas subidas por los locales y la llegada vigente del barco; lo aplica para todos. */
export async function loadShip() {
  if (!supabase) return
  const [set, off] = await Promise.all([supabase.from('mall_settings').select('doc').eq('key', 'ship').maybeSingle(), supabase.from('ship_offers').select('doc')])
  if (set.error || off.error) return
  const arrival = (set.data as Doc<{ arrival?: { at: number; until: number } }> | null)?.doc?.arrival ?? null
  const offers = (off.data as Doc<ShipOffer>[]).map((r) => ({ ...r.doc, demo: false }))
  const cur = useDiscountShip.getState()
  // una llegada de prueba (administrador) es solo local: no la pisa lo que diga la base
  if (cur.testing && cur.arrival && cur.arrival.until > Date.now()) return
  const same = JSON.stringify(offers) === JSON.stringify(cur.offers) && arrival?.at === cur.arrival?.at && arrival?.until === cur.arrival?.until
  if (!same) applyRemote(() => useDiscountShip.setState({ offers, arrival: arrival && arrival.until > Date.now() ? arrival : null }))
  applyRemote(syncShipBoarding)
}

/** El dueño de un local habilita el barco para todos (suena el pito y atraca). Devuelve un mensaje de error o null. */
export async function launchShip(storeId: string): Promise<string | null> {
  if (!supabase) return 'No hay base de datos conectada.'
  const { error } = await supabase.rpc('ship_launch', { p_store: storeId })
  if (error) return error.message
  await loadShip()
  return null
}

function pushShipOffers(prev: ShipOffer[], next: ShipOffer[]) {
  const { storeIds, isAdmin } = useSession.getState()
  const mine = (o: ShipOffer) => isAdmin || storeIds.includes(o.storeId)
  const before = new Map(prev.map((o) => [o.storeId, JSON.stringify(o)]))
  const changed = next.filter((o) => !o.demo && mine(o) && before.get(o.storeId) !== JSON.stringify(o))
  const gone = prev.filter((o) => !o.demo && mine(o) && !next.some((n) => n.storeId === o.storeId))
  if (!changed.length && !gone.length) return
  enqueue(async () => {
    for (const o of changed) {
      const { error } = await supabase!.from('ship_offers').upsert({ store_id: o.storeId, doc: o })
      if (error) throw error
    }
    if (gone.length) {
      const { error } = await supabase!.from('ship_offers').delete().in('store_id', gone.map((o) => o.storeId))
      if (error) throw error
    }
  })
}

/** Funciones que el administrador activa para todos (aeropuerto e isla, barco pirata quieto), en mall_settings «features». */
export async function loadFeatures() {
  if (!supabase) return
  const { data, error } = await supabase.from('mall_settings').select('doc').eq('key', 'features').maybeSingle()
  if (error) return
  const doc = (data as Doc<{ airport?: boolean; pirateParked?: boolean; entertainment?: boolean; stadium?: StadiumPhase }> | null)?.doc
  if (!doc) return
  applyRemote(() => {
    useAirportFeature.setState({ enabled: !!doc.airport })
    useEntertainmentFeature.setState({ enabled: !!doc.entertainment })
    useStadiumPhase.setState({ phase: doc.stadium === 'almost' || doc.stadium === 'open' ? doc.stadium : 'construction' })
    usePirateShip.setState({ parked: !!doc.pirateParked })
  })
}

function pushFeatures() {
  const doc = { airport: useAirportFeature.getState().enabled, pirateParked: usePirateShip.getState().parked, entertainment: useEntertainmentFeature.getState().enabled, stadium: useStadiumPhase.getState().phase }
  enqueue(async () => {
    const { error } = await supabase!.from('mall_settings').upsert({ key: 'features', doc })
    if (error) throw new Error(error.message)
  })
}

function pushSeason(mode: SeasonMode) {
  enqueue(async () => {
    const { error } = await supabase!.from('mall_settings').upsert({ key: 'season', doc: { mode } })
    if (error) throw new Error(error.message)
  })
}

function pushPricing(p: Pricing) {
  enqueue(async () => {
    const { error } = await supabase!.from('mall_settings').upsert({ key: 'pricing', doc: { types: p.types, spaces: p.spaces } })
    if (error) throw new Error(pricingTable ? error.message : 'falta crear la tabla de precios (migración 0002)')
  })
}

// ── Arranque ─────────────────────────────────────────────────────────────────

let started = false
export function startRemoteSync() {
  if (!supabase || started) return
  started = true
  const db = supabase
  void loadCatalog()
  void loadPricing()
  void loadSeason()
  void loadFeatures()
  void loadShip()
  setInterval(() => void refreshPromotions(), 10_000)
  setInterval(() => !document.hidden && void loadShip(), 8_000)

  useCatalog.subscribe((next, prev) => {
    if (applying || !signedIn()) return
    pushCatalog(prev, next)
  })
  useSpacePricing.subscribe((next, prev) => {
    if (applying || !useSession.getState().isAdmin || (next.types === prev.types && next.spaces === prev.spaces)) return
    pushPricing(next)
  })
  useDiscountShip.subscribe((next, prev) => {
    if (applying || !signedIn() || next.offers === prev.offers) return
    pushShipOffers(prev.offers, next.offers)
  })
  useAirportFeature.subscribe((next, prev) => {
    if (applying || !useSession.getState().isAdmin || next.enabled === prev.enabled) return
    pushFeatures()
  })
  useEntertainmentFeature.subscribe((next, prev) => {
    if (applying || !useSession.getState().isAdmin || next.enabled === prev.enabled) return
    pushFeatures()
  })
  useStadiumPhase.subscribe((next, prev) => {
    if (applying || !useSession.getState().isAdmin || next.phase === prev.phase) return
    pushFeatures()
  })
  usePirateShip.subscribe((next, prev) => {
    if (applying || !useSession.getState().isAdmin || next.parked === prev.parked) return
    pushFeatures()
  })
  useSeasonSettings.subscribe((next, prev) => {
    if (applying || !useSession.getState().isAdmin || next.mode === prev.mode) return
    pushSeason(next.mode)
  })
  useOrders.subscribe((next, prev) => {
    if (applying || next.orders === prev.orders) return
    pushOrders(prev.orders, next.orders)
  })
  useClaims.subscribe((next, prev) => {
    if (applying || next.claims === prev.claims) return
    pushClaims(prev.claims, next.claims)
  })
  useReservations.subscribe((next, prev) => {
    if (applying || next.reservations === prev.reservations) return
    pushReservations(prev.reservations, next.reservations)
  })

  // al iniciar o cerrar sesión: catálogo fresco y datos privados
  let lastUser: string | null = null
  useSession.subscribe((s) => {
    if (s.userId === lastUser) return
    lastUser = s.userId
    if (s.userId) void loadPrivate()
  })

  // catálogo en vivo: una promoción o un producto nuevo aparece en todos los navegadores
  let timer: ReturnType<typeof setTimeout> | null = null
  const reload = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void loadCatalog(), 600)
  }
  db.channel('catalogo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'space_assignments' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mall_settings' }, () => {
      void loadPricing()
      void loadSeason()
      void loadFeatures()
      void loadShip()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ship_offers' }, () => void loadShip())
    .subscribe()
}
