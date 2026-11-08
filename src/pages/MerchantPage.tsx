import { messageFor } from '../lib/messages'
import { absoluteUrl, localPath } from '../lib/links'
import { copyText } from '../lib/clipboard'
import { MessagesEditor } from './MerchantMessages'
import { MusicEditor } from './MerchantMusic'
import { EventsManager } from '../stadium/EventsManager'
import { useStadiumConfig } from '../state/stadiumEvents'
import {
  PartyPopper,
  Trophy,
  BarChart3,
  ChevronDown,
  Copy,
  Zap,
  ArrowLeftRight,
  ClipboardList,
  ImagePlus,
  Info,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Store as StoreIcon,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES, CATEGORY_BY_ID, FLOOR_BY_ID, SPACE_BY_ID, ZONE_BY_ID } from '../config/mall'
import type { DeliveryMode, FacadeStyle, OrderStatus, Product, ProductIcon, Store } from '../domain/types'
import { formatCOP, formatDateTime } from '../lib/format'
import { readImageFile, storedBytes } from '../lib/image'
import { uploadStorePhoto } from '../remote/photos'
import { stockKey, totalStock } from '../lib/inventory'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { AccountGate } from '../remote/AccountGate'
import { uniqueId } from '../lib/ids'
import { catalogWords, isRestaurant, whatsappLink } from '../lib/restaurant'
import { StatusPill } from './OrdersPage'
import { useWelcome } from '../features/OwnerWelcome'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useMerchant } from '../state/merchant'
import { useOrders } from '../state/orders'
import { storageWriteFailed } from '../state/storage'
import { useUI } from '../state/ui'
import { ProductImage } from '../ui/ProductImage'
import { EmptyState, StoreLogo, btn, input } from '../ui/bits'
import { MerchantPromotions } from './MerchantPromotions'
import { CategoriesManager, CategoryPicker } from './MerchantCategories'
import { MerchantDashboard } from './MerchantDashboard'
import { StoreColors } from '../ui/StoreColors'
import { PhotoBackgroundEditor } from '../ui/PhotoBackground'
import { ProductPhotoField, type PhotoState } from './MerchantPhoto'
import { PlatePhotoField } from './MerchantPlate'
import { instagramHandle } from '../lib/instagram'
import { categoryWords, groupOf, groupsWithProducts, storeCategories } from '../lib/storeCategories'

// «Mi negocio»: el comerciante edita su perfil (logo, colores, fachada), su catálogo con fotos y
// atiende sus subórdenes. Lo que guarda aparece al instante en el mall 3D, en Comprar y en su ficha.

type Tab = 'resumen' | 'perfil' | 'articulos' | 'promociones' | 'pedidos' | 'estadio'

const ICON_LABELS: Record<ProductIcon, string> = {
  shirt: 'Camisa',
  dress: 'Vestido',
  pants: 'Pantalón',
  hat: 'Sombrero',
  shoe: 'Zapato',
  sandal: 'Sandalia',
  bag: 'Bolso',
  headphones: 'Audífonos',
  charger: 'Cargador',
  phone: 'Celular',
  watch: 'Reloj',
  laptop: 'Portátil',
  speaker: 'Parlante',
  perfume: 'Perfume',
  lipstick: 'Labial',
  serum: 'Sérum',
  brush: 'Brocha',
  candle: 'Vela',
  coffee: 'Café',
  gift: 'Regalo',
  hammock: 'Hamaca',
  sweet: 'Dulce',
  plate: 'Plato',
  fish: 'Pescado',
  dessert: 'Postre',
  drink: 'Bebida',
  meat: 'Carne',
  noodles: 'Sopa / fideos',
  croissant: 'Panadería',
}

/** Aviso honesto cuando el navegador ya no tiene espacio para guardar. */
function useSaveToast() {
  const toast = useUI((s) => s.toast)
  return (ok: string) => {
    // La escritura a localStorage es síncrona dentro del set de zustand.
    if (storageWriteFailed()) toast('No hay espacio en este navegador: el cambio se verá hasta recargar. Usa fotos más livianas o borra algunas.', 'error')
    else toast(ok, 'success')
  }
}

export default function MerchantPage() {
  return (
    <AccountGate need="merchant">
      <MerchantContent />
    </AccountGate>
  )
}

function MerchantContent() {
  const allStores = useCatalog((s) => s.stores)
  const session = useSession()
  // con base de datos: solo las tiendas que la cuenta administra (el admin, todas)
  // el dueño ve su local solo cuando termina la bienvenida (primero el aviso y la animación); el administrador ve todos
  const stores = useMemo(
    () => (remoteEnabled() && !session.isAdmin ? allStores.filter((s) => session.storeIds.includes(s.id) && s.setup !== 'pending') : allStores),
    [allStores, session.isAdmin, session.storeIds],
  )
  const waiting = useMemo(
    () => (remoteEnabled() && !session.isAdmin ? allStores.find((s) => session.storeIds.includes(s.id) && s.setup === 'pending') : undefined),
    [allStores, session.isAdmin, session.storeIds],
  )
  const reopenWelcome = useWelcome((w) => w.reopen)
  const storeId = useMerchant((s) => s.storeId)
  const setStoreId = useMerchant((s) => s.setStoreId)
  const [params, setParams] = useSearchParams()
  const requested = params.get('tienda')
  const [tab, setTab] = useState<Tab>(() =>
    ['pedidos', 'articulos', 'promociones', 'perfil', 'resumen', 'estadio'].includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'resumen',
  )
  const [startNew, setStartNew] = useState(params.get('nuevo') === '1')
  const pending = useOrders((o) =>
    o.orders.reduce(
      (n, ord) => n + ord.subOrders.filter((x) => x.storeId === (requested ?? storeId) && (x.status === 'pending_confirmation' || x.status === 'received')).length,
      0,
    ),
  )
  // Desde la ficha de una tienda se llega con ?tienda=: queda como la tienda de la sesión.
  useEffect(() => {
    if (!requested) return
    if (stores.some((s) => s.id === requested)) setStoreId(requested)
    const t = params.get('tab')
    if (t === 'pedidos' || t === 'articulos' || t === 'promociones' || t === 'perfil' || t === 'resumen' || t === 'estadio') setTab(t)
    if (params.get('nuevo') === '1') setStartNew(true)
    setParams({}, { replace: true })
  }, [requested, stores, setStoreId, setParams])
  const store = stores.find((s) => s.id === (requested ?? storeId))
  const operatorId = useStadiumConfig((s) => s.operatorStoreId)

  if (!store && waiting)
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-teal/12 text-teal">
          <PartyPopper className="size-8" />
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">¡{waiting.name} ya es tuyo!</h1>
        <p className="mt-1 text-sm text-ink-soft">Tu solicitud fue aprobada. Empieza para dejar tu local listo.</p>
        <button className={`${btn.primary} mt-5 w-full`} onClick={reopenWelcome}>
          Toca para empezar
        </button>
      </div>
    )
  if (!store) return <StorePicker stores={stores} preselect={requested} onPick={setStoreId} />

  return (
    <div className="mx-auto max-w-4xl px-4 pt-4 pb-28 md:pb-10">
      <DemoNotice />
      <Header store={store} onSwitch={() => setStoreId(null)} />
      <nav className="scrollbar-none mt-4 hidden gap-1 overflow-x-auto md:flex" aria-label="Secciones de mi negocio">
        {(
          [
            ['resumen', 'Resumen', BarChart3],
            ['perfil', 'Perfil y logo', StoreIcon],
            ['articulos', catalogWords(store).tab, Package],
            ['promociones', 'Promociones', Zap],
            ['pedidos', 'Pedidos', ClipboardList],
            ...(store.id === operatorId ? ([['estadio', 'Estadio', Trophy]] as const) : []),
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${tab === id ? 'bg-ink text-white' : 'text-ink-soft hover:bg-ink/5'}`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-4">
        {tab === 'resumen' && <MerchantDashboard key={store.id} store={store} goTab={setTab} />}
        {tab === 'perfil' && <ProfileEditor key={store.id} store={store} />}
        {tab === 'articulos' && <ProductsManager store={store} startNew={startNew} onStarted={() => setStartNew(false)} />}
        {tab === 'promociones' && <MerchantPromotions store={store} />}
        {tab === 'pedidos' && <MerchantOrders store={store} />}
        {tab === 'estadio' && store.id === operatorId && <EventsManager />}
      </div>

      {/* móvil: barra propia del negocio (reemplaza a la del mall) */}
      <nav className="glass fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-30 rounded-[26px] px-1.5 md:hidden" aria-label="Secciones de mi negocio">
        <ul className="grid h-16 auto-cols-fr grid-flow-col items-center">
          {(
            [
              ['resumen', 'Resumen', BarChart3],
              ['perfil', 'Perfil', StoreIcon],
              ['articulos', catalogWords(store).tab, Package],
              ['promociones', 'Promos', Zap],
              ['pedidos', 'Pedidos', ClipboardList],
              ...(store.id === operatorId ? ([['estadio', 'Estadio', Trophy]] as const) : []),
            ] as const
          ).map(([id, label, Icon]) => (
            <li key={id} className="flex justify-center">
              <button
                onClick={() => setTab(id)}
                aria-current={tab === id}
                className={`relative flex min-h-[48px] min-w-[50px] flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 text-[10px] font-semibold transition active:scale-[0.97] ${tab === id ? 'bg-teal/12 text-teal' : 'text-[#66737C]'}`}
              >
                <Icon className="size-[21px]" strokeWidth={1.8} />
                {label}
                {id === 'pedidos' && pending > 0 && (
                  <span className="absolute top-0 right-1 grid min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[10px] leading-[18px] font-bold text-white">
                    {pending}
                  </span>
                )}
              </button>
            </li>
          ))}
          <li className="flex justify-center">
            <Link
              to="/"
              className="flex min-h-[48px] min-w-[50px] flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 text-[10px] font-semibold text-[#66737C] active:scale-[0.97]"
            >
              <MapPin className="size-[21px]" strokeWidth={1.8} />
              Al mall
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  )
}

function DemoNotice() {
  if (remoteEnabled()) return null
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-amber-100 px-3.5 py-2.5 text-xs font-semibold text-amber-900">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>
        Demostración sin cuentas: lo que guardas se ve al instante en el mall, pero solo en este navegador. Para que otras personas lo vean desde sus teléfonos hace falta conectar
        una base de datos y un inicio de sesión (siguiente paso del proyecto).
      </span>
    </p>
  )
}

function StorePicker({ stores, preselect, onPick }: { stores: Store[]; preselect: string | null; onPick: (id: string) => void }) {
  const navigate = useNavigate()
  const { spaceByStore } = useCatalogMaps()
  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-28 md:pb-10">
      <DemoNotice />
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Mi negocio</h1>
      <p className="mt-1 text-sm text-ink-soft">Elige tu tienda para subir tu logo, cargar tu menú, catálogo o servicios y atender tus pedidos.</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {stores.map((s) => {
          const sp = SPACE_BY_ID[spaceByStore[s.id]]
          return (
            <li key={s.id}>
              <button
                onClick={() => onPick(s.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:border-brand active:scale-[0.99] ${preselect === s.id ? 'border-brand' : 'border-line'}`}
              >
                <StoreLogo store={s} size={44} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{s.name}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {CATEGORY_BY_ID[s.categoryId]?.name} · {sp ? `${FLOOR_BY_ID[sp.floorId].name}, local ${sp.label}` : 'Sin local asignado'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-6 rounded-3xl border border-dashed border-line bg-card p-4 text-sm">
        <p className="font-bold">¿Aún no tienes local?</p>
        <p className="mt-1 text-ink-soft">Elige un espacio libre en el mapa («TU NEGOCIO AQUÍ») y envía la solicitud. Cuando se apruebe, tu tienda aparece en esta lista.</p>
        <button className={`${btn.secondary} mt-3`} onClick={() => navigate('/')}>
          <MapPin className="size-4 text-brand" /> Ver locales disponibles
        </button>
      </div>
    </div>
  )
}

/** Abierto / Cerrado: un local cerrado se ve, pero no recibe pedidos. */
function OpenToggle({ store }: { store: Store }) {
  const upsertStore = useCatalog((s) => s.upsertStore)
  const toast = useUI((s) => s.toast)
  const open = store.status === 'open'
  return (
    <button
      role="switch"
      aria-checked={open}
      onClick={() => {
        upsertStore({ ...store, status: open ? 'paused' : 'open' })
        toast(open ? 'Local cerrado: no recibe pedidos.' : 'Local abierto: ya recibe pedidos.', 'success')
      }}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition active:scale-[0.98] ${open ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-line bg-card text-ink-soft'}`}
    >
      <span className={`relative h-5 w-9 rounded-full transition ${open ? 'bg-emerald-500' : 'bg-ink/25'}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${open ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {open ? 'Abierto' : 'Cerrado'}
    </button>
  )
}

function Header({ store, onSwitch }: { store: Store; onSwitch: () => void }) {
  const navigate = useNavigate()
  const { spaceByStore } = useCatalogMaps()
  const sp = spaceByStore[store.id]
  const space = SPACE_BY_ID[sp]
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-card p-4"
      style={{
        background: `linear-gradient(160deg, ${store.accentColor}, #fffdf9 80%)`,
      }}
    >
      <StoreLogo store={store} size={60} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-ink-soft">Mi negocio</p>
        <h1 className="truncate text-xl font-extrabold tracking-tight">{store.name}</h1>
        <p className="truncate text-xs text-ink-soft">
          {ZONE_BY_ID[store.zoneId].name} · {space ? `${FLOOR_BY_ID[space.floorId].name}, local ${space.label}` : 'Sin local asignado todavía'}
        </p>
      </div>
      <div className="flex basis-full flex-wrap gap-2 sm:basis-auto">
        <OpenToggle store={store} />
        {space && (
          <button
            className={btn.secondary}
            onClick={() => {
              navigate('/')
              useUI.getState().setFloor(space.floorId)
              useUI.getState().selectSpace(sp)
              useUI.getState().requestFocus({ kind: 'space', id: sp })
            }}
          >
            <MapPin className="size-4 text-brand" /> Ver en el mall
          </button>
        )}
        <button className={btn.ghost} onClick={onSwitch} aria-label="Cambiar de negocio">
          <ArrowLeftRight className="size-4" />
          <span className="hidden sm:inline">Cambiar</span>
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-bold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-soft">{hint}</span>}
    </label>
  )
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card p-4 ${className}`}>{children}</div>
}

/** Botón que abre el selector de archivos (cámara o galería en móvil) y entrega la imagen reducida. */
function ImagePicker({ kind, storeId, label, onImage, children }: { kind: 'logo' | 'product'; storeId?: string; label: string; onImage: (dataUrl: string) => void; children?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null)
  const toast = useUI((s) => s.toast)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          try {
            if (kind === 'product' && storeId && remoteEnabled()) {
              // Con base de datos compartida la foto va a Storage (1280 px). Si falla, se guarda reducida como antes.
              try {
                onImage(await uploadStorePhoto(storeId, await readImageFile(file, 'product-hd')))
                return
              } catch {
                toast('No se pudo subir a la nube; se guardó en este dispositivo.')
              }
            }
            onImage(await readImageFile(file, kind))
          } catch (err) {
            toast(err instanceof Error ? err.message : 'No se pudo usar la imagen.', 'error')
          } finally {
            setBusy(false)
          }
        }}
      />
      <button type="button" className={btn.secondary} disabled={busy} onClick={() => ref.current?.click()}>
        {children ?? <ImagePlus className="size-4" />}
        {busy ? 'Procesando…' : label}
      </button>
    </>
  )
}

// ── Perfil ─────────────────────────────────────────────────────────────────────

/** Enlace directo al local: quien lo abre llega al mall con la cámara sobre este local. */
function StoreLinkCard({ store }: { store: Store }) {
  const { spaceByStore } = useCatalogMaps()
  const toast = useUI((s) => s.toast)
  const url = absoluteUrl(localPath(store, SPACE_BY_ID[spaceByStore[store.id]]))
  return (
    <Card className="space-y-2">
      <div>
        <p className="text-sm font-bold">Enlace de tu local</p>
        <p className="text-[12px] text-ink-soft">Compártelo en Instagram, WhatsApp o tu tarjeta: quien lo abra llega directo a tu local en el mall.</p>
      </div>
      <div className="flex items-center gap-2">
        <input readOnly className={`${input} !h-11 min-w-0 flex-1 truncate font-mono text-[12.5px]`} value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de tu local" />
        <button
          type="button"
          className={btn.primary}
          onClick={async () => toast((await copyText(url)) ? 'Enlace copiado.' : 'Selecciona el enlace y cópialo.')}
        >
          <Copy className="size-4" /> Copiar
        </button>
      </div>
    </Card>
  )
}

function ProfileEditor({ store }: { store: Store }) {
  const upsert = useCatalog((s) => s.upsertStore)
  const saved = useSaveToast()
  const [f, setF] = useState(store)
  const set = <K extends keyof Store>(k: K, v: Store[K]) => setF((s) => ({ ...s, [k]: v }))
  const zoneCategories = CATEGORIES.filter((c) => c.zoneId === store.zoneId)
  const dirty = JSON.stringify(f) !== JSON.stringify(store)
  const valid = f.name.trim().length > 1 && f.logoText.trim().length > 0

  return (
    <div className="space-y-4">
      <Card>
        <p className="font-bold">Logo</p>
        <p className="text-xs text-ink-soft">Aparece en el letrero de tu local en el mall, en tu ficha y en Comprar. Mejor cuadrado y con fondo claro.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StoreLogo store={f} size={84} />
          <div className="flex flex-wrap gap-2">
            <ImagePicker kind="logo" label={f.logo ? 'Cambiar logo' : 'Subir logo'} onImage={(d) => set('logo', d)} />
            {f.logo && (
              <button className={btn.ghost} onClick={() => set('logo', null)}>
                <X className="size-4" /> Quitar logo
              </button>
            )}
          </div>
        </div>
      </Card>

      <StoreLinkCard store={store} />
      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre del negocio">
          <input className={input} value={f.name} maxLength={28} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Nombre corto del letrero" hint="Se usa cuando no hay logo (máx. 8 letras).">
          <input className={input} value={f.logoText} maxLength={8} onChange={(e) => set('logoText', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Frase" wide>
          <input className={input} value={f.tagline} maxLength={60} onChange={(e) => set('tagline', e.target.value)} />
        </Field>
        <Field label="Descripción" wide>
          <textarea className={`${input} min-h-24`} value={f.description} maxLength={400} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Categoría" hint={`Dentro de ${ZONE_BY_ID[store.zoneId].name}. Cambiar de zona lo decide la administración.`}>
          <select className={input} value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {zoneCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fachada del local">
          <select className={input} value={f.facade} onChange={(e) => set('facade', e.target.value as FacadeStyle)}>
            <option value="awning">Toldo a rayas</option>
            <option value="arch">Arco con apliques</option>
            <option value="minimal">Minimalista con luz</option>
          </select>
        </Field>
        <StoreColors store={f} onChange={(c) => setF((x) => ({ ...x, ...c }))} />
        <PhotoBackgroundEditor storeId={f.id} value={f.photoBg} onChange={(photoBg) => setF((x) => ({ ...x, photoBg }))} />
        <Field
          label="Instagram"
          hint={
            instagramHandle(f.instagram)
              ? `Tus clientes llegan a instagram.com/${instagramHandle(f.instagram)}`
              : 'Escribe tu usuario (@minegocio): aparece como botón en tu ficha.'
          }
        >
          <input className={input} value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@minegocio" autoCapitalize="none" />
        </Field>
        <Field label="WhatsApp">
          <input className={input} inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
        </Field>
        <MessagesEditor store={f} onChange={(m) => setF((x) => ({ ...x, messages: m }))} />
        <MusicEditor store={f} onChange={(music) => setF((x) => ({ ...x, music }))} />
        <Field label="Estado" wide>
          <select className={input} value={f.status} onChange={(e) => set('status', e.target.value as Store['status'])}>
            <option value="open">Abierto: recibe pedidos</option>
            <option value="paused">Cerrado: se ve, pero no recibe pedidos</option>
          </select>
        </Field>
      </Card>

      <div className="sticky bottom-[calc(var(--chrome-bottom)+8px)] z-10 flex justify-end gap-2 md:bottom-4">
        {dirty && (
          <button className={btn.secondary} onClick={() => setF(store)}>
            Descartar
          </button>
        )}
        <button
          className={btn.primary}
          disabled={!dirty || !valid}
          onClick={() => {
            const next = {
              ...f,
              name: f.name.trim(),
              logoText: f.logoText.trim(),
            }
            upsert(next)
            setF(next)
            saved('Perfil guardado. Ya se ve en el mall.')
          }}
        >
          Guardar cambios
        </button>
      </div>
    </div>
  )
}

// ── Artículos ──────────────────────────────────────────────────────────────────

function ProductsManager({ store, startNew, onStarted }: { store: Store; startNew?: boolean; onStarted?: () => void }) {
  const products = useCatalog((s) => s.products)
  const upsert = useCatalog((s) => s.upsertProduct)
  const remove = useCatalog((s) => s.deleteProduct)
  const saved = useSaveToast()
  const [editing, setEditing] = useState<string | 'new' | null>(startNew ? 'new' : null)
  /** Datos de partida para un artículo nuevo: copia de otro, o lo que se repite al agregar varios seguidos. */
  const [seed, setSeed] = useState<Product | undefined>()
  const [nonce, setNonce] = useState(0)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  useEffect(() => {
    if (!startNew) return
    setEditing('new')
    onStarted?.()
  }, [startNew, onStarted])
  const mine = useMemo(() => products.filter((p) => p.storeId === store.id), [products, store.id])
  const food = isRestaurant(store)
  const words = catalogWords(store)
  const editingProduct = editing && editing !== 'new' ? mine.find((p) => p.id === editing) : undefined

  const newOne = (from?: Product) => {
    setSeed(from)
    setNonce((n) => n + 1)
    setEditing('new')
  }

  if (editing)
    return (
      <ProductEditor
        key={`${editing}-${nonce}`}
        store={store}
        product={editingProduct}
        seed={editing === 'new' ? seed : undefined}
        onDone={() => {
          setSeed(undefined)
          setEditing(null)
        }}
        onAnother={(last) =>
          newOne({
            ...last,
            name: '',
            price: 0,
            image: null,
            description: '',
            id: '',
            variants: [],
            sizes: [],
            inventory: {},
            featured: false,
          })
        }
      />
    )

  const groups = groupsWithProducts(store, mine)
  const needle = q.trim().toLowerCase()
  const shownList = mine.filter((p) => (!cat || groupOf(store, p).id === cat) && (!needle || `${p.name} ${p.description}`.toLowerCase().includes(needle)))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-ink-soft">
            {mine.length} {words.plural} · {mine.filter((p) => p.active).length} visibles
          </p>
          {!remoteEnabled() && <p className="text-[11px] text-ink-soft">Espacio usado en este navegador: {(catalogBytes() / 1_048_576).toFixed(1)} MB de unos 5 MB</p>}
        </div>
        <button className={btn.primary} onClick={() => newOne()}>
          <Plus className="size-4" /> {words.add}
        </button>
      </div>
      <details className="group rounded-2xl border border-line bg-card" open={!mine.length}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-sm font-bold">{categoryWords(store).title}</span>
            <span className="block text-[12px] text-ink-soft">
              {storeCategories(store).length ? `${storeCategories(store).length} creadas · toca para ordenar o agregar` : 'Crea categorías para que tus clientes filtren'}
            </span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-ink-soft transition group-open:rotate-180" />
        </summary>
        <div className="px-1 pb-1">
          <CategoriesManager store={store} />
        </div>
      </details>
      {mine.length > 5 && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
            <Search className="size-4 shrink-0 text-ink-soft" />
            <input
              className="h-11 w-full bg-transparent text-[15px] outline-none"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar en tus ${words.plural}…`}
              aria-label="Buscar"
            />
            {q && (
              <button onClick={() => setQ('')} aria-label="Borrar búsqueda" className="text-ink-soft">
                <X className="size-4" />
              </button>
            )}
          </label>
          {groups.length > 1 && (
            <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4">
              {[
                { id: null as string | null, name: 'Todo', n: mine.length },
                ...groups.map((g) => ({
                  id: g.id as string | null,
                  name: g.name,
                  n: mine.filter((p) => groupOf(store, p).id === g.id).length,
                })),
              ].map((g) => (
                <button
                  key={g.id ?? 'all'}
                  onClick={() => setCat(g.id)}
                  aria-pressed={cat === g.id}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition ${cat === g.id ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink-soft'}`}
                >
                  {g.name} · {g.n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {mine.length > 5 && !shownList.length && <p className="rounded-2xl bg-sand p-4 text-sm text-ink-soft">No hay {words.plural} con eso.</p>}
      {!mine.length && (
        <EmptyState icon={<Package className="size-6" />} title={`Aún no tienes ${words.plural} en tu ${words.title.toLowerCase()}`}>
          {food
            ? 'Agrega tu primer plato con foto y precio. Aparecerá en el menú de tu ficha y en Comprar.'
            : store.businessType === 'service'
              ? 'Agrega tu primer servicio con foto y precio. Aparecerá en el catálogo de servicios de tu ficha y en Comprar.'
              : 'Agrega tu primer producto con foto, precio e inventario. Aparecerá en el catálogo de tu ficha y en Comprar.'}
        </EmptyState>
      )}
      <ul className="space-y-2">
        {shownList.map((p) => (
          <li key={p.id} className={`rounded-2xl border border-line bg-card p-2.5 ${p.active ? '' : 'opacity-75'}`}>
            <div className="flex items-center gap-3">
              <ProductImage product={p} brandColor={store.brandColor} className="size-16 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-tight font-bold">{p.name}</p>
                <p className="text-sm font-extrabold">{formatCOP(p.price)}</p>
                <p className="text-[11px] text-ink-soft">
                  {groupOf(store, p).name} · {totalStock(p) > 0 ? `${totalStock(p)} en inventario` : 'Agotado'} {p.featured && '· Destacado'}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={p.active}
                aria-label={`Mostrar ${p.name} en la tienda`}
                onClick={() => {
                  upsert({ ...p, active: !p.active })
                  saved(!p.active ? `${p.name} visible` : `${p.name} oculto`)
                }}
                className="flex shrink-0 flex-col items-center gap-1 text-[10px] font-bold text-ink-soft"
              >
                <span className={`relative h-6 w-11 rounded-full transition ${p.active ? 'bg-emerald-500' : 'bg-ink/25'}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${p.active ? 'left-[22px]' : 'left-0.5'}`} />
                </span>
                {p.active ? 'Visible' : 'Oculto'}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1 border-t border-line pt-2">
              <button className={`${btn.ghost} !px-2.5 !py-1.5 text-[13px]`} onClick={() => setEditing(p.id)} aria-label={`Editar ${p.name}`}>
                <Pencil className="size-4" /> Editar
              </button>
              <button className={`${btn.ghost} !px-2.5 !py-1.5 text-[13px]`} onClick={() => newOne(p)} aria-label={`Duplicar ${p.name}`}>
                <Copy className="size-4" /> Duplicar
              </button>
              <span className="ml-auto">
                <ConfirmDelete label={`Eliminar ${p.name}`} onConfirm={() => remove(p.id)} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Precio con puntos de miles mientras se escribe: 150000 → 150.000. */
const withThousands = (digits: string) => (digits ? Number(digits).toLocaleString('es-CO') : '')

function ProductEditor({ store, product, seed, onDone, onAnother }: { store: Store; product?: Product; seed?: Product; onDone: () => void; onAnother?: (saved: Product) => void }) {
  const upsert = useCatalog((s) => s.upsertProduct)
  const products = useCatalog((s) => s.products)
  const saved = useSaveToast()
  const zoneCategories = CATEGORIES.filter((c) => c.zoneId === store.zoneId)
  // `base` rellena el formulario: el artículo que se edita, o el que se está copiando / repitiendo.
  const base = product ?? seed
  const isCopy = !product && !!seed?.name
  const [name, setName] = useState(isCopy ? `${seed!.name} (copia)` : (product?.name ?? ''))
  const [price, setPrice] = useState(base?.price ? String(base.price) : '')
  const [description, setDescription] = useState(base?.description === 'Sin descripción.' ? '' : (base?.description ?? ''))
  const [categoryId, setCategoryId] = useState(base?.categoryId ?? store.categoryId)
  const [shopCategory, setShopCategory] = useState(base?.shopCategory ?? '')
  const ownCategories = storeCategories(store)
  const [icon, setIcon] = useState<ProductIcon>(base?.icon ?? 'gift')
  const [photo, setPhoto] = useState<PhotoState>({ image: base?.image ?? null, original: base?.photoOriginal, cutout: base?.cutout, fit: base?.photoFit, studio: base?.photoStudio, plate: base?.photoPlate })
  const [variants, setVariants] = useState(base?.variants.map((v) => v.name).join(', ') ?? '')
  const [sizes, setSizes] = useState(base?.sizes.join(', ') ?? '')
  const [stock, setStock] = useState(isCopy ? String(Math.max(...Object.values(seed!.inventory), 0) || 5) : '5')
  const [featured, setFeatured] = useState(base?.featured ?? false)
  const [active, setActive] = useState(base?.active ?? true)
  const valid = name.trim().length > 1 && Number(price) > 0

  const [saving, setSaving] = useState(false)
  /** Con base de datos, las fotos (final, original y recorte) viajan a Storage; sin ella solo se guarda la final. */
  const persistPhotos = async () => {
    const up = async (u?: string | null) => {
      if (!u || !u.startsWith('data:') || !remoteEnabled()) return u ?? undefined
      try {
        return await uploadStorePhoto(store.id, u)
      } catch {
        return u
      }
    }
    if (!remoteEnabled()) return { image: photo.image, original: undefined, cutout: undefined }
    const [image, original, cutout] = await Promise.all([up(photo.image), up(photo.original), up(photo.cutout)])
    return { image: image ?? null, original, cutout }
  }

  const save = async (another = false) => {
    setSaving(true)
    const photos = await persistPhotos()
    setSaving(false)
    const vs = variants
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    const ss = sizes
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    const slug = (v: string) =>
      v
        .toLowerCase()
        .normalize('NFD')
        .replace(/[^a-z0-9]+/g, '-')
    const variantObjs = vs.map((v) => product?.variants.find((x) => x.name === v) ?? { id: slug(v), name: v })
    // Se conserva el inventario de las combinaciones que siguen existiendo; las nuevas toman el valor indicado.
    const inventory: Record<string, number> = {}
    for (const v of variantObjs.length ? variantObjs.map((x) => x.id) : [null])
      for (const s of ss.length ? ss : [null]) {
        const k = stockKey(v, s)
        inventory[k] = product?.inventory[k] ?? (Number(stock) || 0)
      }
    const max = products.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0)
    const out: Product = {
      id: product?.id ?? (remoteEnabled() ? uniqueId('P') : `P-${max + 1}`),
      storeId: store.id,
      name: name.trim(),
      description: description.trim() || 'Sin descripción.',
      price: Math.round(Number(price)),
      image: photos.image,
      photoOriginal: photos.original,
      cutout: photos.cutout,
      photoFit: photos.cutout ? photo.fit : undefined,
      photoStudio: photos.cutout ? photo.studio : undefined,
      photoPlate: photos.image ? photo.plate : undefined,
      icon,
      categoryId,
      shopCategory: ownCategories.some((c) => c.id === shopCategory) ? shopCategory : undefined,
      tags: name.toLowerCase().split(/\s+/),
      compareGroup: product?.compareGroup,
      variants: variantObjs,
      sizes: ss,
      inventory,
      featured,
      active,
    }
    upsert(out)
    if (another && onAnother) {
      saved(`«${out.name}» creado. Agrega el siguiente.`)
      onAnother(out)
      return
    }
    saved(product ? 'Artículo actualizado' : 'Artículo creado. Ya aparece en tu tienda.')
    onDone()
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-lg font-extrabold">{product ? `Editar ${catalogWords(store).one}` : catalogWords(store).add}</p>
        <button className={btn.ghost} onClick={onDone} aria-label="Cerrar">
          <X className="size-5" />
        </button>
      </div>
      {isRestaurant(store) ? (
        <PlatePhotoField
          value={photo}
          onChange={setPhoto}
          placeholder={<ProductImage product={{ ...(product ?? ({} as Product)), name: name || 'Plato', image: null, icon, variants: [] }} brandColor={store.brandColor} className="size-full rounded-full" />}
        />
      ) : (
      <ProductPhotoField
        store={store}
        value={photo}
        onChange={setPhoto}
        placeholder={<ProductImage product={{ ...(product ?? ({} as Product)), name: name || 'Artículo', image: null, icon, variants: [] }} brandColor={store.brandColor} className="size-40 rounded-2xl" />}
      />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input className={input} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} autoFocus={!product} onFocus={(e) => isCopy && e.currentTarget.select()} />
        </Field>
        <Field label="Precio (COP)">
          <input
            className={input}
            inputMode="numeric"
            value={withThousands(price)}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="45.000"
          />
        </Field>
        <Field label="Descripción" wide>
          <textarea className={`${input} min-h-20`} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={categoryWords(store).title} wide>
          <CategoryPicker store={store} value={shopCategory} onChange={setShopCategory} />
        </Field>
        {!product && (
          <Field label="Unidades disponibles" hint="Por cada combinación de color y talla.">
            <input className={input} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        <details className="group rounded-2xl border border-line bg-sand/40 sm:col-span-2" open={!!(product && (product.variants.length || product.sizes.length))}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
            <span>
              Más opciones
              <span className="block text-[11px] font-medium text-ink-soft">Colores, tallas, rubro, ilustración y destacado</span>
            </span>
            <ChevronDown className="size-5 shrink-0 text-ink-soft transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            <Field label="Rubro (para las búsquedas)">
              <select className={input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {zoneCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ilustración si no hay foto">
              <select className={input} value={icon} onChange={(e) => setIcon(e.target.value as ProductIcon)}>
                {(Object.keys(ICON_LABELS) as ProductIcon[]).map((i) => (
                  <option key={i} value={i}>
                    {ICON_LABELS[i]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Colores o variantes (opcional)" hint="Separados por coma: Rojo, Azul">
              <input className={input} value={variants} onChange={(e) => setVariants(e.target.value)} />
            </Field>
            <Field label="Tallas (opcional)" hint="Separadas por coma: S, M, L">
              <input className={input} value={sizes} onChange={(e) => setSizes(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="size-5 accent-brand" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Destacado
              </label>
            </div>
          </div>
        </details>
        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
          <input type="checkbox" className="size-5 accent-brand" checked={active} onChange={(e) => setActive(e.target.checked)} /> Visible en la tienda
        </label>
      </div>
      {product && <InventoryEditor product={product} />}
      <div className="flex flex-wrap justify-end gap-2">
        <button className={btn.secondary} onClick={onDone}>
          Cancelar
        </button>
        {!product && onAnother && (
          <button className={btn.secondary} disabled={!valid || saving} onClick={() => void save(true)}>
            Guardar y agregar otro
          </button>
        )}
        <button className={btn.primary} disabled={!valid || saving} onClick={() => void save()}>
          {saving ? 'Guardando…' : product ? `Guardar ${catalogWords(store).one}` : `Crear ${catalogWords(store).one}`}
        </button>
      </div>
    </Card>
  )
}

/** Inventario por combinación del artículo ya guardado (se guarda al cambiar cada valor). */
function InventoryEditor({ product }: { product: Product }) {
  const upsert = useCatalog((s) => s.upsertProduct)
  const live = useCatalog((s) => s.products.find((p) => p.id === product.id)) ?? product
  const keys = Object.keys(live.inventory)
  const label = (k: string) => {
    const [v, s] = k.split('|')
    return [live.variants.find((x) => x.id === v)?.name, s !== '_' ? s : null].filter(Boolean).join(' · ') || 'Unidades'
  }
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-ink-soft">Inventario</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {keys.map((k) => (
          <label key={k} className="rounded-xl bg-sand p-2 text-xs">
            <span className="block truncate font-semibold">{label(k)}</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand"
              inputMode="numeric"
              value={live.inventory[k]}
              onChange={(e) =>
                upsert({
                  ...live,
                  inventory: {
                    ...live.inventory,
                    [k]: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0),
                  },
                })
              }
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function ConfirmDelete({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      className={`flex h-10 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-bold text-red-600 hover:bg-red-50 ${armed ? 'bg-red-50' : ''}`}
      aria-label={armed ? `Confirmar: ${label}` : label}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      <Trash2 className="size-4" />
      {armed && '¿Seguro?'}
    </button>
  )
}

// ── Pedidos ────────────────────────────────────────────────────────────────────

/** Siguiente paso de un pedido y cómo se llama el botón que lo avanza. */
function nextStep(mode: DeliveryMode, status: OrderStatus): { to: OrderStatus; label: string } | null {
  switch (status) {
    case 'received':
    case 'pending_confirmation':
      return { to: 'confirmed', label: 'Confirmar pedido' }
    case 'confirmed':
      return { to: 'preparing', label: 'Empezar a preparar' }
    case 'preparing':
      return { to: 'ready', label: 'Marcar listo' }
    case 'ready':
      return mode === 'delivery' ? { to: 'on_the_way', label: 'Salió en camino' } : { to: 'delivered', label: 'Marcar entregado' }
    case 'on_the_way':
      return { to: 'delivered', label: 'Marcar entregado' }
    default:
      return null
  }
}

function MerchantOrders({ store }: { store: Store }) {
  const orders = useOrders((s) => s.orders)
  const setStatus = useOrders((s) => s.setSubOrderStatus)
  const archive = useOrders((s) => s.archiveSubOrder)
  const [view, setView] = useState<'active' | 'done'>('active')
  const all = orders.flatMap((o) => o.subOrders.filter((s) => s.storeId === store.id && !s.archived).map((s) => ({ order: o, sub: s })))
  const isDone = (st: OrderStatus) => st === 'delivered' || st === 'cancelled'
  const active = all.filter((x) => !isDone(x.sub.status))
  const done = all.filter((x) => isDone(x.sub.status))
  const shown = view === 'active' ? active : done

  if (!all.length)
    return (
      <EmptyState icon={<ClipboardList className="size-6" />} title="Aún no tienes pedidos">
        Cuando alguien compre en tu tienda, aquí verás solo tu parte del pedido para confirmarla.
      </EmptyState>
    )
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-sand p-1" role="tablist">
        {(
          [
            ['active', `Por atender (${active.length})`],
            ['done', `Entregados (${done.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${view === id ? 'bg-white text-brand shadow-soft' : 'text-ink-soft'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'done' && done.length > 1 && (
        <button className="text-xs font-bold text-ink-soft underline-offset-2 hover:underline" onClick={() => done.forEach((x) => archive(x.sub.id))}>
          Quitar todos los entregados y cancelados
        </button>
      )}
      {!shown.length && (
        <p className="rounded-2xl bg-sand p-4 text-sm text-ink-soft">{view === 'active' ? 'No tienes pedidos por atender. ¡Buen trabajo!' : 'Aún no hay pedidos entregados.'}</p>
      )}
      <ul className="space-y-3">
        {shown.map(({ order, sub }) => {
          const next = nextStep(order.delivery.mode, sub.status)
          return (
            <li key={sub.id}>
              <Card className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-extrabold">{order.customer.name}</p>
                    <p className="text-xs text-ink-soft">
                      {formatDateTime(order.createdAt)} · {order.delivery.mode === 'pickup' ? 'Recoge en el local' : `Domicilio: ${order.delivery.address}`}
                    </p>
                  </div>
                  <StatusPill status={sub.status} />
                </div>
                <ul className="text-sm">
                  {sub.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>
                        {l.qty} × {l.name} {l.variantName && `(${l.variantName})`} {l.size && `talla ${l.size}`}
                      </span>
                      <span className="whitespace-nowrap text-ink-soft">{formatCOP(l.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                {order.notes && <p className="rounded-xl bg-sand px-3 py-2 text-xs text-ink-soft">Nota del cliente: {order.notes}</p>}
                <div className="flex items-center justify-between">
                  <a
                    href={whatsappLink(
                      order.customer.whatsapp,
                      messageFor(store, 'toCustomer', {
                        cliente: order.customer.name,
                      }),
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-brand underline-offset-2 hover:underline"
                  >
                    Escribir al cliente · {order.customer.whatsapp}
                  </a>
                  <span className="text-lg font-extrabold">{formatCOP(sub.subtotal)}</span>
                </div>
                {next && (
                  <div className="flex gap-2">
                    <button className={`${btn.primary} flex-1`} onClick={() => setStatus(sub.id, next.to)}>
                      {next.label}
                    </button>
                    <button className={btn.ghost} onClick={() => setStatus(sub.id, 'cancelled')} aria-label="Cancelar pedido">
                      Cancelar
                    </button>
                  </div>
                )}
                {isDone(sub.status) && (
                  <button className={`${btn.secondary} w-full`} onClick={() => archive(sub.id)}>
                    <Trash2 className="size-4" /> Quitar de mi lista
                  </button>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Espacio aproximado que ocupa el catálogo guardado (para avisar antes de llenar el navegador). */
function catalogBytes() {
  try {
    return storedBytes(localStorage.getItem('cm:catalog:v1'))
  } catch {
    return 0
  }
}
