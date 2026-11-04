import { ArrowLeft, Check, Plug, RotateCcw, ShieldAlert, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CATEGORIES, CATEGORY_BY_ID, COURT_SPACE, TRACK_SPACE, FLOORS, FLOOR_BY_ID, SPACES, SPACE_BY_ID, SPACE_TYPES, ZONE_BY_ID } from '../config/mall'
import { COURT_COLOR } from '../football/open'
import type { FacadeStyle, OrderStatus, Product, ProductIcon, Promotion, PromotionType, SpaceClaim, SpaceSlot, Store } from '../domain/types'
import { formatCOP, formatDateTime } from '../lib/format'
import { stockKey, totalStock } from '../lib/inventory'
import { isPromotionLive } from '../lib/pricing'
import { useNow } from '../lib/useNow'
import { growDesk } from '../services/integrations/growdesk'
import { ORDER_STATUS_LABEL, overallStatus, statusOptions } from '../services/orders'
import { useCart } from '../state/cart'
import { remoteEnabled, supabase } from '../remote/client'
import { useReservations } from '../state/reservations'
import { seedRemoteCatalog } from '../remote/sync'
import { AccountBar, AccountGate } from '../remote/AccountGate'
import { uniqueId } from '../lib/ids'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useClaims } from '../state/claims'
import { useOrders } from '../state/orders'
import { usePersonal } from '../state/personal'
import { useUI } from '../state/ui'
import { StatusPill } from '../pages/OrdersPage'
import { StoreLogo, btn, input } from '../ui/bits'
import { isHighlighted } from '../lib/storeHighlight'
import { DemoPromoButton } from '../features/DemoPromoButton'
import { OwnerDashboard, PriceInput } from './OwnerDashboard'
import { DemoInvites } from './DemoInvites'
import { useSpacePrice, useSpacePricing } from '../state/spacePricing'

type Tab = 'gestion' | 'espacios' | 'solicitudes' | 'tiendas' | 'productos' | 'promociones' | 'pedidos' | 'cancha' | 'invitaciones' | 'integraciones'

const TABS: { id: Tab; label: string }[] = [
  { id: 'gestion', label: 'Gestión y precios' },
  { id: 'espacios', label: 'Espacios' },
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'tiendas', label: 'Tiendas' },
  { id: 'productos', label: 'Productos' },
  { id: 'promociones', label: 'Promociones' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'cancha', label: 'Deportes' },
  { id: 'invitaciones', label: 'Invitaciones' },
  { id: 'integraciones', label: 'Integraciones' },
]

const small = 'rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand'

export default function AdminPage() {
  return (
    <AccountGate need="admin">
      <AdminContent />
    </AccountGate>
  )
}

function AdminContent() {
  const [tab, setTab] = useState<Tab>('gestion')
  const pendingClaims = useClaims((s) => s.claims.filter((c) => c.status === 'pending').length)
  const pendingOrders = useOrders((s) => s.orders.flatMap((o) => o.subOrders).filter((so) => so.status === 'pending_confirmation').length)

  return (
    <div className="min-h-full bg-sand">
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className={btn.icon} aria-label="Volver al mall">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Administración · MallPlay</h1>
            <p className="text-xs text-ink-soft">Gestión de espacios, tiendas, catálogo, promociones y pedidos</p>
          </div>
        </div>
        {remoteEnabled() ? (
          <div className="mx-auto max-w-6xl px-4 pb-2">
            <AccountBar />
          </div>
        ) : (
          <p className="flex items-center gap-2 bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-900">
            <ShieldAlert className="size-4 shrink-0" /> Demostración local: sin autenticación y con datos en este navegador. No es seguro para producción.
          </p>
        )}
        <nav className="scrollbar-none mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`relative shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition ${tab === t.id ? 'bg-ink text-white' : 'text-ink-soft hover:bg-ink/5'}`}
            >
              {t.label}
              {t.id === 'solicitudes' && pendingClaims > 0 && <Count n={pendingClaims} />}
              {t.id === 'pedidos' && pendingOrders > 0 && <Count n={pendingOrders} />}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 pb-16">
        {tab === 'gestion' && <OwnerDashboard />}
        {tab === 'espacios' && <SpacesAdmin />}
        {tab === 'solicitudes' && <ClaimsAdmin />}
        {tab === 'tiendas' && <StoresAdmin />}
        {tab === 'productos' && <ProductsAdmin />}
        {tab === 'promociones' && <PromotionsAdmin />}
        {tab === 'pedidos' && <OrdersAdmin />}
        {tab === 'cancha' && <CourtAdmin />}
        {tab === 'invitaciones' && <DemoInvites />}
        {tab === 'integraciones' && <IntegrationsAdmin />}
      </main>
    </div>
  )
}

function Count({ n }: { n: number }) {
  return <span className="ml-1.5 rounded-full bg-coral px-1.5 py-0.5 text-[10px] text-white">{n}</span>
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card p-4 ${className}`}>{children}</div>
}

// ── Espacios ───────────────────────────────────────────────────────────────────

function SpacesAdmin() {
  const assignments = useCatalog((s) => s.assignments)
  const occupied = SPACES.filter((s) => assignments[s.id]).length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Espacios" value={SPACES.length} />
        <Stat label="Ocupados" value={occupied} />
        <Stat label="Disponibles" value={SPACES.length - occupied} />
      </div>
      {FLOORS.flatMap((f) => f.zones.map((z) => ({ f, z }))).map(({ f, z }) => (
        <section key={z.id}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
            <span className="size-3 rounded-full" style={{ background: z.color }} /> {f.name} · {f.layout === 'cross' ? `Pasillo ${z.id} · ` : ''}
            {z.name}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SPACES.filter((s) => s.zoneId === z.id).map((s) => (
              <SpaceCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      ))}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
          <span className="size-3 rounded-full" style={{ background: COURT_COLOR }} /> {FLOOR_BY_ID.P1.name} · Zona de deportes (canchas A y B)
        </h2>
        <p className="mb-2 text-xs text-ink-soft">Libre, se muestra vacía con «TU NEGOCIO AQUÍ». Al asignarle un negocio se activa: partido, reservas por hora y su nombre en el cartel.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SpaceCard s={COURT_SPACE} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
          <span className="size-3 rounded-full" style={{ background: ZONE_BY_ID.G.color }} /> {FLOOR_BY_ID.P1.name} · Isla de Entretenimiento (11 locales y la pista de karts)
        </h2>
        <p className="mb-2 text-xs text-ink-soft">Los locales y la pista se reclaman como cualquier espacio. Al asignarle un negocio a la pista, su nombre y logo aparecen sobre ella.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SpaceCard s={TRACK_SPACE} />
          {SPACES.filter((s) => s.zoneId === 'G').map((s) => (
            <SpaceCard key={s.id} s={s} />
          ))}
        </div>
      </section>
    </div>
  )
}

function SpaceCard({ s }: { s: SpaceSlot }) {
  const assignments = useCatalog((st) => st.assignments)
  const stores = useCatalog((st) => st.stores)
  const assignSpace = useCatalog((st) => st.assignSpace)
  const { storeById, spaceByStore } = useCatalogMaps()
  const claims = useClaims((st) => st.claims)
  const toast = useUI((st) => st.toast)
  const price = useSpacePrice(s.id)
  const custom = useSpacePricing((st) => st.spaces[s.id] !== undefined)
  const setSpacePrice = useSpacePricing((st) => st.setSpacePrice)
  const store = storeById[assignments[s.id]]
  const pending = claims.filter((c) => c.spaceId === s.id && c.status === 'pending').length
  return (
    <Card className={store ? '' : 'border-dashed'}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-extrabold">{s.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${store ? 'bg-emerald-100 text-emerald-800' : 'bg-sand-2 text-ink-soft'}`}>{store ? 'Ocupado' : 'Disponible'}</span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">{SPACE_TYPES[s.type].name}</p>
      <div className="mt-2">
        <PriceInput
          label={`Precio mensual del espacio ${s.label}`}
          value={price}
          onSave={(n) => {
            setSpacePrice(s.id, n)
            toast(`${s.label}: ${formatCOP(n)}/mes`, 'success')
          }}
        />
        {custom && (
          <button className="mt-1 flex items-center gap-1 text-[11px] font-bold text-brand" onClick={() => setSpacePrice(s.id, null)}>
            <RotateCcw className="size-3" /> Usar precio del tipo
          </button>
        )}
      </div>
      <div className="my-3 flex min-h-10 items-center gap-2">
        {store ? (
          <>
            <StoreLogo store={store} size={34} />
            <span className="text-sm font-bold">{store.name}</span>
          </>
        ) : (
          <span className="text-xs text-ink-soft">{pending ? `${pending} solicitud(es) pendiente(s)` : 'Sin solicitudes'}</span>
        )}
      </div>
      <select
        className={`${small} w-full`}
        value={assignments[s.id] ?? ''}
        aria-label={`Asignar tienda al espacio ${s.label}`}
        onChange={(e) => {
          const id = e.target.value || null
          const moved = id && spaceByStore[id] ? SPACE_BY_ID[spaceByStore[id]]?.label : null
          assignSpace(s.id, id)
          toast(id ? `${storeById[id].name} asignada a ${s.label}${moved ? ` (liberó ${moved})` : ''}` : `${s.label} liberado`, 'success')
        }}
      >
        <option value="">— Disponible —</option>
        {stores.map((st) => (
          <option key={st.id} value={st.id}>
            {st.name}
            {spaceByStore[st.id] && spaceByStore[st.id] !== s.id ? ' (ya tiene espacio)' : ''}
          </option>
        ))}
      </select>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
    </Card>
  )
}

// ── Solicitudes ────────────────────────────────────────────────────────────────

const BRAND_COLORS = ['#c0703f', '#3f7d8c', '#8a5a9b', '#b5485d', '#4b7f52', '#a0782c', '#36607a']

function ClaimsAdmin() {
  const claims = useClaims((s) => s.claims)
  const setStatus = useClaims((s) => s.setStatus)
  const removeClaim = useClaims((s) => s.remove)
  const stores = useCatalog((s) => s.stores)
  const upsertStore = useCatalog((s) => s.upsertStore)
  const assignSpace = useCatalog((s) => s.assignSpace)
  const assignments = useCatalog((s) => s.assignments)
  const toast = useUI((s) => s.toast)

  const approve = (c: SpaceClaim) => {
    // Siguiente número libre de la serie de tiendas aprobadas (nunca choca con ids existentes).
    const used = new Set(stores.map((s) => s.id))
    let n = stores.filter((s) => /^STORE-0\d\d$/.test(s.id)).length + 1
    while (used.has(`STORE-${String(n).padStart(3, '0')}`)) n++
    const cat = CATEGORY_BY_ID[c.categoryId]
    const store: Store = {
      id: `STORE-${String(n).padStart(3, '0')}`,
      name: c.businessName,
      logoText: c.businessName.split(/\s+/)[0].slice(0, 6).toUpperCase(),
      tagline: cat?.name ?? 'Nueva tienda',
      description: `Nueva tienda de ${c.ownerName}. Completa la descripción y el catálogo desde la pestaña Tiendas y Productos.`,
      categoryId: c.categoryId,
      zoneId: cat?.zoneId ?? 'D',
      brandColor: BRAND_COLORS[n % BRAND_COLORS.length],
      accentColor: '#f3ece0',
      facade: 'minimal',
      instagram: '@por.definir',
      whatsapp: c.whatsapp,
      status: 'open',
      setup: 'pending',
    }
    upsertStore(store)
    if (!assignments[c.spaceId]) {
      assignSpace(c.spaceId, store.id)
      toast(`${store.name} creada y asignada al espacio.`, 'success')
    } else {
      toast(`${store.name} creada. El espacio pedido ya está ocupado: asígnale otro en Espacios.`)
    }
    setStatus(c.id, 'approved', store.id)
    // Vincula a quien pidió el local para que lo vea en «Mi negocio» (reintenta mientras la tienda termina de guardarse en línea).
    if (remoteEnabled() && supabase && c.email) {
      void (async () => {
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 1500))
          const { data, error } = await supabase!.rpc('add_store_member', { p_store: store.id, p_email: c.email })
          if (!error && data === 'ok') return toast(`${c.email} ya puede gestionar ${store.name} desde «Mi negocio».`, 'success')
          if (!error && data === 'no_user') return toast(`${c.email} aún no tiene cuenta: vincúlalo luego en Tiendas → Dueños.`)
        }
        toast('No se pudo vincular al dueño automáticamente: hazlo en Tiendas → Dueños.', 'error')
      })()
    }
    // Las demás solicitudes del mismo espacio quedan pendientes para que el equipo decida.
  }

  if (!claims.length) return <Card>No hay solicitudes todavía. Selecciona un local disponible en el mapa y usa “Reclamar este espacio”.</Card>
  return (
    <div className="space-y-3">
      {claims.map((c) => (
        <Card key={c.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-bold text-ink-soft">
                {c.id} · {formatDateTime(c.createdAt)}
              </p>
              <p className="text-lg font-extrabold">{c.businessName}</p>
              <p className="text-sm text-ink-soft">
                {CATEGORY_BY_ID[c.categoryId]?.name} · {c.ownerName} · {c.whatsapp} · {c.email}
              </p>
              <p className="mt-1 text-xs">
                Espacio pedido: <b>{SPACE_BY_ID[c.spaceId]?.label}</b> · Tipo solicitado: <b>{SPACE_TYPES[c.spaceType].name}</b>
                {assignments[c.spaceId] && c.status === 'pending' && <span className="ml-1 text-amber-700">(hoy ocupado)</span>}
              </p>
            </div>
            {c.status === 'pending' ? (
              <div className="flex gap-2">
                <button className={btn.secondary} onClick={() => setStatus(c.id, 'rejected')}>
                  <X className="size-4" /> Rechazar
                </button>
                <button className={btn.primary} onClick={() => approve(c)}>
                  <Check className="size-4" /> Aprobar y crear tienda
                </button>
              </div>
            ) : (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${c.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                {c.status === 'approved' ? `Aprobada · ${c.storeId}` : 'Rechazada'}
              </span>
            )}
            <ConfirmButton label={`Eliminar la solicitud ${c.id}`} onConfirm={() => removeClaim(c.id)} />
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Tiendas ────────────────────────────────────────────────────────────────────

function StoresAdmin() {
  const stores = useCatalog((s) => s.stores)
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      {stores.map((s) => (editing === s.id ? <StoreEditor key={s.id} store={s} onDone={() => setEditing(null)} /> : <StoreRow key={s.id} store={s} onEdit={() => setEditing(s.id)} />))}
    </div>
  )
}

function StoreRow({ store, onEdit }: { store: Store; onEdit: () => void }) {
  const { spaceByStore } = useCatalogMaps()
  const count = useCatalog((s) => s.products.filter((p) => p.storeId === store.id).length)
  const remove = useCatalog((s) => s.deleteStore)
  const toast = useUI((s) => s.toast)
  const space = SPACE_BY_ID[spaceByStore[store.id]]
  return (
    <Card className="flex flex-wrap items-center gap-3">
      <StoreLogo store={store} size={44} />
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {store.name} <span className="font-mono text-xs text-ink-soft">{store.id}</span>
        </p>
        <p className="text-xs text-ink-soft">
          {CATEGORY_BY_ID[store.categoryId]?.name} · {space ? `${FLOOR_BY_ID[space.floorId].name}, espacio ${space.label}` : 'Sin espacio'} · {count} productos · {store.status === 'open' ? 'Abierta' : 'Pausada'}
        </p>
      </div>
      <button className={btn.secondary} onClick={onEdit}>
        Editar
      </button>
      <ConfirmButton
        label={`Eliminar la tienda ${store.name} con sus ${count} productos y promociones`}
        onConfirm={() => {
          remove(store.id)
          toast(`Tienda «${store.name}» eliminada, con sus productos y promociones.`, 'success')
        }}
      />
    </Card>
  )
}

function StoreEditor({ store, onDone }: { store: Store; onDone: () => void }) {
  const upsert = useCatalog((s) => s.upsertStore)
  const toast = useUI((s) => s.toast)
  const [f, setF] = useState(store)
  const set = <K extends keyof Store>(k: K, v: Store[K]) => setF((s) => ({ ...s, [k]: v }))
  return (
    <Card className="space-y-3 ring-2 ring-brand/20">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input className={input} value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Logo textual">
          <input className={input} value={f.logoText} maxLength={8} onChange={(e) => set('logoText', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Frase">
          <input className={input} value={f.tagline} onChange={(e) => set('tagline', e.target.value)} />
        </Field>
        <Field label="Categoría">
          <select
            className={input}
            value={f.categoryId}
            onChange={(e) => {
              set('categoryId', e.target.value)
              set('zoneId', CATEGORY_BY_ID[e.target.value].zoneId)
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {ZONE_BY_ID[c.zoneId].name} · {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción" wide>
          <textarea className={`${input} min-h-20`} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Color de marca">
          <input type="color" className="h-12 w-full rounded-xl border border-line" value={f.brandColor} onChange={(e) => set('brandColor', e.target.value)} />
        </Field>
        <Field label="Color de acento">
          <input type="color" className="h-12 w-full rounded-xl border border-line" value={f.accentColor} onChange={(e) => set('accentColor', e.target.value)} />
        </Field>
        <Field label="Fachada">
          <select className={input} value={f.facade} onChange={(e) => set('facade', e.target.value as FacadeStyle)}>
            <option value="awning">Toldo</option>
            <option value="arch">Arco</option>
            <option value="minimal">Minimalista</option>
          </select>
        </Field>
        <Field label="Estado comercial">
          <select className={input} value={f.status} onChange={(e) => set('status', e.target.value as Store['status'])}>
            <option value="open">Abierta (recibe pedidos)</option>
            <option value="paused">Pausada</option>
          </select>
        </Field>
        <Field label="Instagram">
          <input className={input} value={f.instagram} onChange={(e) => set('instagram', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 self-end rounded-xl border border-line bg-white px-3.5 py-3 text-sm font-semibold sm:col-span-2">
          <input type="checkbox" className="size-5 accent-brand" checked={isHighlighted(f)} onChange={(e) => set('highlight', e.target.checked)} />
          Tienda destacada: cartel grande en el techo y luz propia en el mall
        </label>
        <Field label="WhatsApp">
          <input className={input} value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
        </Field>
      </div>
      {remoteEnabled() && <StoreOwners storeId={store.id} />}
      <div className="flex justify-end gap-2">
        <button className={btn.secondary} onClick={onDone}>
          Cancelar
        </button>
        <button
          className={btn.primary}
          disabled={!f.name.trim() || !f.logoText.trim()}
          onClick={() => {
            upsert({ ...f, name: f.name.trim(), logoText: f.logoText.trim() })
            toast('Tienda actualizada', 'success')
            onDone()
          }}
        >
          Guardar
        </button>
      </div>
    </Card>
  )
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-bold text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

// ── Productos ──────────────────────────────────────────────────────────────────

const ICON_OPTIONS: ProductIcon[] = ['shirt', 'dress', 'pants', 'hat', 'shoe', 'sandal', 'bag', 'headphones', 'charger', 'phone', 'watch', 'laptop', 'speaker', 'perfume', 'lipstick', 'serum', 'brush', 'candle', 'coffee', 'gift', 'hammock', 'sweet']

function ProductsAdmin() {
  const stores = useCatalog((s) => s.stores)
  const products = useCatalog((s) => s.products)
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  const list = products.filter((p) => p.storeId === storeId)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${input} w-auto`} value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Tienda">
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className={btn.primary} onClick={() => setCreating(true)}>
          Nuevo producto
        </button>
      </div>
      {creating && <NewProduct storeId={storeId} onDone={() => setCreating(false)} />}
      {list.map((p) => (
        <ProductRow key={p.id} product={p} />
      ))}
      {!list.length && <Card>Esta tienda aún no tiene productos.</Card>}
    </div>
  )
}

function ProductRow({ product }: { product: Product }) {
  const upsert = useCatalog((s) => s.upsertProduct)
  const remove = useCatalog((s) => s.deleteProduct)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(String(product.price))
  const keys = Object.keys(product.inventory)
  const label = (k: string) => {
    const [v, s] = k.split('|')
    return [product.variants.find((x) => x.id === v)?.name, s !== '_' ? s : null].filter(Boolean).join(' · ') || 'Única'
  }
  const commit = () => {
    const n = Math.round(Number(price))
    if (!name.trim() || !Number.isFinite(n) || n <= 0) return
    if (name.trim() !== product.name || n !== product.price) upsert({ ...product, name: name.trim(), price: n })
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-soft">{product.id}</span>
        <input className={`${small} min-w-40 flex-1 font-semibold`} value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} aria-label="Nombre" />
        <label className="flex items-center gap-1 text-sm">
          $
          <input className={`${small} w-28`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} onBlur={commit} aria-label="Precio" />
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold">
          <input type="checkbox" className="size-4 accent-brand" checked={product.active} onChange={(e) => upsert({ ...product, active: e.target.checked })} /> Activo
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold">
          <input type="checkbox" className="size-4 accent-brand" checked={product.featured} onChange={(e) => upsert({ ...product, featured: e.target.checked })} /> Destacado
        </label>
        <button className={btn.ghost} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Inventario ({totalStock(product)})
        </button>
        <ConfirmButton label={`Eliminar ${product.name}`} onConfirm={() => remove(product.id)} />
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {keys.map((k) => (
            <label key={k} className="rounded-xl bg-sand p-2 text-xs">
              <span className="block truncate font-semibold">{label(k)}</span>
              <input
                className={`${small} mt-1 w-full`}
                inputMode="numeric"
                value={product.inventory[k]}
                onChange={(e) => upsert({ ...product, inventory: { ...product.inventory, [k]: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) } })}
              />
            </label>
          ))}
        </div>
      )}
    </Card>
  )
}

function NewProduct({ storeId, onDone }: { storeId: string; onDone: () => void }) {
  const upsert = useCatalog((s) => s.upsertProduct)
  const products = useCatalog((s) => s.products)
  const store = useCatalog((s) => s.stores.find((x) => x.id === storeId))
  const toast = useUI((s) => s.toast)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState(store?.categoryId ?? CATEGORIES[0].id)
  const [icon, setIcon] = useState<ProductIcon>('gift')
  const [description, setDescription] = useState('')
  const [variants, setVariants] = useState('')
  const [sizes, setSizes] = useState('')
  const [stock, setStock] = useState('5')
  const valid = name.trim().length > 1 && Number(price) > 0

  const save = () => {
    const vs = variants.split(',').map((x) => x.trim()).filter(Boolean)
    const ss = sizes.split(',').map((x) => x.trim()).filter(Boolean)
    const variantObjs = vs.map((v) => ({ id: v.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-'), name: v }))
    const inventory: Record<string, number> = {}
    for (const v of variantObjs.length ? variantObjs.map((x) => x.id) : [null]) for (const s of ss.length ? ss : [null]) inventory[stockKey(v, s)] = Number(stock) || 0
    const max = products.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0)
    upsert({
      id: remoteEnabled() ? uniqueId('P') : `P-${max + 1}`,
      storeId,
      name: name.trim(),
      description: description.trim() || 'Sin descripción.',
      price: Math.round(Number(price)),
      image: null,
      icon,
      categoryId,
      tags: name.toLowerCase().split(/\s+/),
      variants: variantObjs,
      sizes: ss,
      inventory,
      featured: false,
      active: true,
    })
    toast('Producto creado', 'success')
    onDone()
  }

  return (
    <Card className="space-y-3 ring-2 ring-brand/20">
      <p className="font-bold">Nuevo producto para {store?.name}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Precio (COP)">
          <input className={input} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Categoría">
          <select className={input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ilustración">
          <select className={input} value={icon} onChange={(e) => setIcon(e.target.value as ProductIcon)}>
            {ICON_OPTIONS.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </Field>
        <Field label="Variantes (separadas por coma)">
          <input className={input} value={variants} onChange={(e) => setVariants(e.target.value)} placeholder="Rojo, Azul" />
        </Field>
        <Field label="Tallas (separadas por coma)">
          <input className={input} value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S, M, L" />
        </Field>
        <Field label="Inventario por combinación">
          <input className={input} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Descripción">
          <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <button className={btn.secondary} onClick={onDone}>
          Cancelar
        </button>
        <button className={btn.primary} disabled={!valid} onClick={save}>
          Crear producto
        </button>
      </div>
    </Card>
  )
}

// ── Promociones ────────────────────────────────────────────────────────────────

const PROMO_TYPE_LABEL: Record<PromotionType, string> = { normal: 'Normal', flash: 'Relámpago', secret: 'Escondida' }

function PromotionsAdmin() {
  const promotions = useCatalog((s) => s.promotions)
  const setActive = useCatalog((s) => s.setPromotionActive)
  const restart = useCatalog((s) => s.restartPromotionWindow)
  const del = useCatalog((s) => s.deletePromotion)
  const { productById, storeById } = useCatalogMaps()
  const now = useNow()
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-3 border-dashed">
        <div className="min-w-0">
          <p className="font-bold">Demostración: promoción viva</p>
          <p className="text-xs text-ink-soft">
            Activa una oferta relámpago ficticia del 30 % en una tienda del piso 1 durante 5 minutos: la fachada se resalta, algunos visitantes se
            acercan a la vitrina y la oferta se puede agregar al carrito. Se puede repetir.
          </p>
        </div>
        <DemoPromoButton className={`${btn.secondary} shadow-none`} onDone={() => navigate('/')} />
      </Card>
      <button className={btn.primary} onClick={() => setCreating(true)}>
        Nueva promoción
      </button>
      {creating && <NewPromotion onDone={() => setCreating(false)} />}
      {promotions.map((p) => {
        const live = isPromotionLive(p, now)
        const expired = !!p.endsAt && Date.parse(p.endsAt) <= now
        return (
          <Card key={p.id} className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.type === 'flash' ? 'bg-sun/30' : p.type === 'secret' ? 'bg-ink text-sun' : 'bg-coral/15 text-coral'}`}>{PROMO_TYPE_LABEL[p.type]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {p.title} · −{p.discountPercent}% {p.code && <span className="font-mono text-xs">({p.code})</span>}
              </p>
              <p className="text-xs text-ink-soft">
                {storeById[p.storeId]?.name} · {productById[p.productId]?.name ?? 'Producto eliminado'} · {p.endsAt ? `hasta ${formatDateTime(p.endsAt)}` : 'sin vencimiento'}
              </p>
            </div>
            <span className={`text-xs font-bold ${live ? 'text-emerald-700' : 'text-ink-soft'}`}>{live ? 'Activa' : expired ? 'Vencida' : p.active ? 'Programada' : 'Inactiva'}</span>
            {p.type !== 'normal' && (
              <button className={btn.secondary} onClick={() => restart(p.id)} title={`Abre una ventana de ${p.durationHours ?? 6} h desde ahora`}>
                <RotateCcw className="size-4" /> Activar ahora
              </button>
            )}
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              <input type="checkbox" className="size-4 accent-brand" checked={p.active} onChange={(e) => setActive(p.id, e.target.checked)} /> Habilitada
            </label>
            <ConfirmButton label="Eliminar promoción" onConfirm={() => del(p.id)} />
          </Card>
        )
      })}
    </div>
  )
}

function NewPromotion({ onDone }: { onDone: () => void }) {
  const stores = useCatalog((s) => s.stores)
  const products = useCatalog((s) => s.products)
  const promotions = useCatalog((s) => s.promotions)
  const upsert = useCatalog((s) => s.upsertPromotion)
  const toast = useUI((s) => s.toast)
  const [type, setType] = useState<PromotionType>('flash')
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const storeProducts = useMemo(() => products.filter((p) => p.storeId === storeId), [products, storeId])
  const [productId, setProductId] = useState(storeProducts[0]?.id ?? '')
  const [discount, setDiscount] = useState('15')
  const [hours, setHours] = useState('6')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const pid = storeProducts.some((p) => p.id === productId) ? productId : storeProducts[0]?.id
  const d = Number(discount)
  const valid = !!pid && d > 0 && d < 90 && (type !== 'secret' || code.trim().length >= 3)

  return (
    <Card className="space-y-3 ring-2 ring-brand/20">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tipo">
          <select className={input} value={type} onChange={(e) => setType(e.target.value as PromotionType)}>
            <option value="normal">Normal (en la tienda)</option>
            <option value="flash">Relámpago (con contador)</option>
            <option value="secret">Escondida (se descubre explorando)</option>
          </select>
        </Field>
        <Field label="Tienda">
          <select className={input} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Producto">
          <select className={input} value={pid} onChange={(e) => setProductId(e.target.value)}>
            {storeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descuento (%)">
          <input className={input} inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Título">
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Fin de semana de lino" />
        </Field>
        {type !== 'normal' && (
          <Field label="Duración (horas)">
            <input className={input} inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        {type === 'secret' && (
          <Field label="Código">
            <input className={input} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="SECRETO10" />
          </Field>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button className={btn.secondary} onClick={onDone}>
          Cancelar
        </button>
        <button
          className={btn.primary}
          disabled={!valid}
          onClick={() => {
            const now = Date.now()
            const h = Math.max(1, Number(hours) || 6)
            const product = products.find((p) => p.id === pid)!
            upsert({
              id: `PROMO-${type[0].toUpperCase()}${promotions.length + 1}-${now.toString(36).slice(-4)}`,
              type,
              storeId,
              productId: pid!,
              title: title.trim() || `${PROMO_TYPE_LABEL[type]}: ${product.name}`,
              description: '',
              discountPercent: d,
              code: type === 'secret' ? code.trim() : undefined,
              startsAt: new Date(now).toISOString(),
              endsAt: type === 'normal' ? null : new Date(now + h * 3_600_000).toISOString(),
              durationHours: type === 'normal' ? undefined : h,
              active: true,
            } satisfies Promotion)
            toast('Promoción creada y activa', 'success')
            onDone()
          }}
        >
          Crear y activar
        </button>
      </div>
    </Card>
  )
}

// ── Pedidos ────────────────────────────────────────────────────────────────────


function OrdersAdmin() {
  const orders = useOrders((s) => s.orders)
  const setStatus = useOrders((s) => s.setSubOrderStatus)
  const stores = useCatalog((s) => s.stores)
  const [storeFilter, setStoreFilter] = useState('')
  if (!orders.length) return <Card>Aún no hay pedidos. Haz uno desde el carrito para verlo aquí dividido por tienda.</Card>
  return (
    <div className="space-y-4">
      <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        Vista de comerciante:
        <select className={`${input} w-auto`} value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="">Todas las tiendas (vista administrador)</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}: solo sus subórdenes
            </option>
          ))}
        </select>
      </label>
      {orders
        .filter((o) => !storeFilter || o.subOrders.some((s) => s.storeId === storeFilter))
        .map((o) => (
          <Card key={o.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono font-extrabold">{o.id}</p>
                <p className="text-xs text-ink-soft">
                  {formatDateTime(o.createdAt)} · {o.customer.name} · {o.customer.whatsapp} · {o.delivery.mode === 'pickup' ? 'Recoge en local' : `Domicilio: ${o.delivery.address}`}
                </p>
                {o.notes && <p className="text-xs text-ink-soft">Notas: {o.notes}</p>}
              </div>
              {!storeFilter && <StatusPill status={overallStatus(o)} />}
            </div>
            {o.subOrders
              .filter((s) => !storeFilter || s.storeId === storeFilter)
              .map((s) => (
                <div key={s.id} className="rounded-2xl border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold">
                      <span className="font-mono">{s.id}</span> · {s.storeName}
                    </p>
                    <select className={small} value={s.status} onChange={(e) => setStatus(s.id, e.target.value as OrderStatus)} aria-label={`Estado de ${s.id}`}>
                      {statusOptions(o.delivery.mode).map((st) => (
                        <option key={st} value={st}>
                          {ORDER_STATUS_LABEL[st]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ul className="mt-2 text-sm text-ink-soft">
                    {s.lines.map((l, i) => (
                      <li key={i}>
                        {l.qty} × {l.name} {l.variantName && `(${l.variantName})`} {l.size && `talla ${l.size}`} — {formatCOP(l.lineTotal)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-right text-sm font-extrabold">{formatCOP(s.subtotal)}</p>
                  {s.stockCommitted && <p className="text-[11px] text-emerald-700">Inventario descontado al confirmar.</p>}
                </div>
              ))}
          </Card>
        ))}
    </div>
  )
}

/** Comerciantes (correos) que administran la tienda desde «Mi negocio». */
function StoreOwners({ storeId }: { storeId: string }) {
  const toast = useUI((s) => s.toast)
  const [emails, setEmails] = useState<string[] | null>(null)
  const [email, setEmail] = useState('')
  const load = async () => {
    const { data } = await supabase!.rpc('store_member_emails', { p_store: storeId })
    setEmails((data as string[]) ?? [])
  }
  useEffect(() => {
    void load()
  }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="rounded-2xl bg-sand p-3">
      <p className="text-xs font-bold text-ink-soft">Dueños con acceso a «Mi negocio»</p>
      <p className="mt-1 text-sm">{emails === null ? 'Cargando…' : emails.length ? emails.join(', ') : 'Ninguno todavía'}</p>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const { data, error } = await supabase!.rpc('add_store_member', { p_store: storeId, p_email: email })
          if (error) toast(error.message, 'error')
          else if (data === 'no_user') toast('Esa persona debe entrar una vez a «Mi negocio» con su correo antes de vincularla.', 'error')
          else {
            toast('Dueño vinculado', 'success')
            setEmail('')
            void load()
          }
        }}
      >
        <input className={`${input} min-w-48 flex-1`} type="email" placeholder="correo@del-dueno.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className={btn.secondary} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}>
          Vincular
        </button>
      </form>
    </div>
  )
}

// ── Cancha ─────────────────────────────────────────────────────────────────────

function CourtAdmin() {
  const reservations = useReservations((s) => s.reservations)
  const cancel = useReservations((s) => s.cancel)
  if (!reservations.length) return <Card>Aún no hay reservas de la cancha.</Card>
  return (
    <div className="space-y-2">
      {reservations.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {r.day} · {r.hour}:00 <span className="font-mono text-xs text-ink-soft">{r.id}</span>
            </p>
            <p className="text-xs text-ink-soft">
              {r.name} · {r.whatsapp} · {r.players} jugadores · {formatCOP(r.price)}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-sand-2 text-ink-soft'}`}>{r.status === 'pending' ? 'Pendiente' : 'Cancelada'}</span>
          {r.status === 'pending' && <ConfirmButton label={`Cancelar ${r.id}`} onConfirm={() => cancel(r.id)} />}
        </Card>
      ))}
    </div>
  )
}

// ── Integraciones ──────────────────────────────────────────────────────────────

function IntegrationsAdmin() {
  const gd = growDesk()
  const toast = useUI((s) => s.toast)
  const [result, setResult] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const resetAll = () => {
    if (!armed) {
      setArmed(true)
      return
    }
    setArmed(false)
    if (remoteEnabled()) {
      // con base de datos no se borra nada: se (re)publican las tiendas de demostración
      void seedRemoteCatalog().then((err) => toast(err ? `No se pudo publicar: ${err}` : 'Tiendas y productos de demostración publicados en la base.', err ? 'error' : 'success'))
      return
    }
    useCatalog.getState().reset()
    useSpacePricing.getState().reset()
    useOrders.getState().reset()
    useClaims.getState().reset()
    useCart.getState().clear()
    usePersonal.getState().resetDiscoveries()
    toast('Datos de demostración restablecidos', 'success')
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-sand-2">
            <Plug className="size-5" />
          </div>
          <div>
            <p className="font-bold">GrowDesk</p>
            <p className="text-xs font-semibold text-ink-soft">Estado: {gd.isConnected('') ? 'conectado' : 'no conectado (integración futura)'}</p>
          </div>
        </div>
        <p className="text-sm text-ink-soft">
          La capa de servicios ya define el contrato para sincronizar productos, inventario, pedidos, clientes, promociones, ventas y reportes
          (<code className="text-xs">services/integrations/growdesk</code>). Hoy no existe ninguna sincronización real.
        </p>
        <button
          className={btn.secondary}
          onClick={async () => {
            const r = await gd.syncProducts('STORE-001')
            setResult(r.status === 'ok' ? 'Sincronizado' : `Respuesta: ${r.status} — ${r.reason}`)
          }}
        >
          Probar conexión
        </button>
        {result && <p className="rounded-xl bg-sand p-2 text-xs">{result}</p>}
      </Card>
      <Card className="space-y-3">
        <p className="font-bold">Datos de demostración</p>
        {remoteEnabled() ? (
          <p className="text-sm text-ink-soft">Conectado a la base de datos. Publica las tiendas, productos, promociones y locales de demostración (no borra lo que ya exista; los que tengan el mismo id se reemplazan).</p>
        ) : (
          <p className="text-sm text-ink-soft">Todo se guarda en localStorage. Puedes volver al estado inicial (5 tiendas, 15 espacios disponibles, promociones nuevas).</p>
        )}
        <button className={armed ? `${btn.secondary} border-red-300 text-red-700` : btn.secondary} onClick={resetAll} onBlur={() => setArmed(false)}>
          <RotateCcw className="size-4" />{' '}
          {remoteEnabled()
            ? armed
              ? 'Toca de nuevo para publicar'
              : 'Publicar datos de demostración'
            : armed
              ? 'Toca de nuevo: se borran pedidos, solicitudes y cambios'
              : 'Restablecer datos demo'}
        </button>
      </Card>
    </div>
  )
}

/** Borrado en dos toques (los diálogos nativos no siempre están disponibles, p. ej. dentro de un iframe). */
function ConfirmButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      className={`flex h-9 items-center justify-center gap-1 rounded-full px-2 text-xs font-bold text-red-600 hover:bg-red-50 ${armed ? 'bg-red-50' : ''}`}
      aria-label={armed ? `Confirmar: ${label}` : label}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      <Trash2 className="size-4" />
      {armed && '¿Seguro?'}
    </button>
  )
}
