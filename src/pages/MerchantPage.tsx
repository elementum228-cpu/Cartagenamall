import { Zap, ArrowLeftRight, Camera, ClipboardList, ImagePlus, Info, MapPin, Package, Pencil, Plus, Store as StoreIcon, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES, CATEGORY_BY_ID, FLOOR_BY_ID, SPACE_BY_ID, ZONE_BY_ID } from '../config/mall'
import type { FacadeStyle, OrderStatus, Product, ProductIcon, Store } from '../domain/types'
import { formatCOP, formatDateTime } from '../lib/format'
import { readImageFile, storedBytes } from '../lib/image'
import { stockKey, totalStock } from '../lib/inventory'
import { ORDER_STATUS_LABEL } from '../services/orders'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { AccountGate } from '../remote/AccountGate'
import { uniqueId } from '../lib/ids'
import { isRestaurant } from '../lib/restaurant'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useMerchant } from '../state/merchant'
import { useOrders } from '../state/orders'
import { storageWriteFailed } from '../state/storage'
import { useUI } from '../state/ui'
import { ProductImage } from '../ui/ProductImage'
import { EmptyState, StoreLogo, btn, input } from '../ui/bits'
import { MerchantPromotions } from './MerchantPromotions'

// «Mi negocio»: el comerciante edita su perfil (logo, colores, fachada), su catálogo con fotos y
// atiende sus subórdenes. Lo que guarda aparece al instante en el mall 3D, en Comprar y en su ficha.

type Tab = 'perfil' | 'articulos' | 'promociones' | 'pedidos'

const ICON_LABELS: Record<ProductIcon, string> = {
  shirt: 'Camisa', dress: 'Vestido', pants: 'Pantalón', hat: 'Sombrero', shoe: 'Zapato', sandal: 'Sandalia', bag: 'Bolso',
  headphones: 'Audífonos', charger: 'Cargador', phone: 'Celular', watch: 'Reloj', laptop: 'Portátil', speaker: 'Parlante',
  perfume: 'Perfume', lipstick: 'Labial', serum: 'Sérum', brush: 'Brocha', candle: 'Vela', coffee: 'Café', gift: 'Regalo',
  hammock: 'Hamaca', sweet: 'Dulce', plate: 'Plato', fish: 'Pescado', dessert: 'Postre', drink: 'Bebida', meat: 'Carne',
  noodles: 'Sopa / fideos', croissant: 'Panadería',
}

const STATUSES: OrderStatus[] = ['received', 'pending_confirmation', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']

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
  const stores = useMemo(() => (remoteEnabled() && !session.isAdmin ? allStores.filter((s) => session.storeIds.includes(s.id)) : allStores), [allStores, session.isAdmin, session.storeIds])
  const storeId = useMerchant((s) => s.storeId)
  const setStoreId = useMerchant((s) => s.setStoreId)
  const [params, setParams] = useSearchParams()
  const requested = params.get('tienda')
  const [tab, setTab] = useState<Tab>('perfil')
  // Desde la ficha de una tienda se llega con ?tienda=: queda como la tienda de la sesión.
  useEffect(() => {
    if (!requested) return
    if (stores.some((s) => s.id === requested)) setStoreId(requested)
    setParams({}, { replace: true })
  }, [requested, stores, setStoreId, setParams])
  const store = stores.find((s) => s.id === (requested ?? storeId))

  if (!store) return <StorePicker stores={stores} preselect={requested} onPick={setStoreId} />

  return (
    <div className="mx-auto max-w-4xl px-4 pt-4 pb-28 md:pb-10">
      <DemoNotice />
      <Header store={store} onSwitch={() => setStoreId(null)} />
      <nav className="scrollbar-none mt-4 flex gap-1 overflow-x-auto" aria-label="Secciones de mi negocio">
        {(
          [
            ['perfil', 'Perfil y logo', StoreIcon],
            ['articulos', isRestaurant(store) ? 'Menú' : 'Artículos', Package],
            ['promociones', 'Promociones', Zap],
            ['pedidos', 'Pedidos', ClipboardList],
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
        {tab === 'perfil' && <ProfileEditor key={store.id} store={store} />}
        {tab === 'articulos' && <ProductsManager store={store} />}
        {tab === 'promociones' && <MerchantPromotions store={store} />}
        {tab === 'pedidos' && <MerchantOrders store={store} />}
      </div>
    </div>
  )
}

function DemoNotice() {
  if (remoteEnabled()) return null
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-amber-100 px-3.5 py-2.5 text-xs font-semibold text-amber-900">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>
        Demostración sin cuentas: lo que guardas se ve al instante en el mall, pero solo en este navegador. Para que otras personas lo vean desde sus
        teléfonos hace falta conectar una base de datos y un inicio de sesión (siguiente paso del proyecto).
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
      <p className="mt-1 text-sm text-ink-soft">Elige tu tienda para subir tu logo, cargar tus artículos y atender tus pedidos.</p>
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
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-card p-4" style={{ background: `linear-gradient(160deg, ${store.accentColor}, #fffdf9 80%)` }}>
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
function ImagePicker({ kind, label, onImage, children }: { kind: 'logo' | 'product'; label: string; onImage: (dataUrl: string) => void; children?: ReactNode }) {
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
        <Field label="Color de marca">
          <input type="color" className="h-12 w-full rounded-xl border border-line" value={f.brandColor} onChange={(e) => set('brandColor', e.target.value)} />
        </Field>
        <Field label="Color de fondo">
          <input type="color" className="h-12 w-full rounded-xl border border-line" value={f.accentColor} onChange={(e) => set('accentColor', e.target.value)} />
        </Field>
        <Field label="Instagram">
          <input className={input} value={f.instagram} onChange={(e) => set('instagram', e.target.value)} />
        </Field>
        <Field label="WhatsApp">
          <input className={input} inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
        </Field>
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
            const next = { ...f, name: f.name.trim(), logoText: f.logoText.trim() }
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

function ProductsManager({ store }: { store: Store }) {
  const products = useCatalog((s) => s.products)
  const upsert = useCatalog((s) => s.upsertProduct)
  const remove = useCatalog((s) => s.deleteProduct)
  const saved = useSaveToast()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const mine = useMemo(() => products.filter((p) => p.storeId === store.id), [products, store.id])
  const food = isRestaurant(store)
  const editingProduct = editing && editing !== 'new' ? mine.find((p) => p.id === editing) : undefined

  if (editing) return <ProductEditor key={editing} store={store} product={editingProduct} onDone={() => setEditing(null)} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-ink-soft">
            {mine.length} {food ? 'platos' : 'artículos'} · {mine.filter((p) => p.active).length} visibles
          </p>
          <p className="text-[11px] text-ink-soft">Espacio usado en este navegador: {(catalogBytes() / 1_048_576).toFixed(1)} MB de unos 5 MB</p>
        </div>
        <button className={btn.primary} onClick={() => setEditing('new')}>
          <Plus className="size-4" /> {food ? 'Nuevo plato' : 'Nuevo artículo'}
        </button>
      </div>
      {!mine.length && (
        <EmptyState icon={<Package className="size-6" />} title={food ? 'Aún no tienes platos en tu menú' : 'Aún no tienes artículos'}>
          {food ? 'Agrega tu primer plato con foto y precio. Aparecerá en el menú de tu ficha y en Comprar.' : 'Agrega tu primer producto con foto, precio e inventario. Aparecerá en tu ficha y en Comprar.'}
        </EmptyState>
      )}
      <ul className="space-y-2">
        {mine.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5">
            <ProductImage product={p} brandColor={store.brandColor} className="size-16 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm leading-tight font-bold">{p.name}</p>
              <p className="text-sm font-extrabold">{formatCOP(p.price)}</p>
              <p className="text-[11px] text-ink-soft">
                {totalStock(p)} en inventario {p.featured && '· Destacado'}
              </p>
            </div>
            <label className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-ink-soft">
              <input
                type="checkbox"
                className="size-5 accent-brand"
                checked={p.active}
                onChange={(e) => {
                  upsert({ ...p, active: e.target.checked })
                  saved(e.target.checked ? `${p.name} visible` : `${p.name} oculto`)
                }}
                aria-label={`Mostrar ${p.name}`}
              />
              Visible
            </label>
            <button className={btn.icon} onClick={() => setEditing(p.id)} aria-label={`Editar ${p.name}`}>
              <Pencil className="size-4" />
            </button>
            <ConfirmDelete label={`Eliminar ${p.name}`} onConfirm={() => remove(p.id)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProductEditor({ store, product, onDone }: { store: Store; product?: Product; onDone: () => void }) {
  const upsert = useCatalog((s) => s.upsertProduct)
  const products = useCatalog((s) => s.products)
  const saved = useSaveToast()
  const zoneCategories = CATEGORIES.filter((c) => c.zoneId === store.zoneId)
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? store.categoryId)
  const [icon, setIcon] = useState<ProductIcon>(product?.icon ?? 'gift')
  const [image, setImage] = useState<string | null>(product?.image ?? null)
  const [variants, setVariants] = useState(product?.variants.map((v) => v.name).join(', ') ?? '')
  const [sizes, setSizes] = useState(product?.sizes.join(', ') ?? '')
  const [stock, setStock] = useState('5')
  const [featured, setFeatured] = useState(product?.featured ?? false)
  const [active, setActive] = useState(product?.active ?? true)
  const valid = name.trim().length > 1 && Number(price) > 0

  const save = () => {
    const vs = variants.split(',').map((x) => x.trim()).filter(Boolean)
    const ss = sizes.split(',').map((x) => x.trim()).filter(Boolean)
    const slug = (v: string) => v.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')
    const variantObjs = vs.map((v) => product?.variants.find((x) => x.name === v) ?? { id: slug(v), name: v })
    // Se conserva el inventario de las combinaciones que siguen existiendo; las nuevas toman el valor indicado.
    const inventory: Record<string, number> = {}
    for (const v of variantObjs.length ? variantObjs.map((x) => x.id) : [null])
      for (const s of ss.length ? ss : [null]) {
        const k = stockKey(v, s)
        inventory[k] = product?.inventory[k] ?? (Number(stock) || 0)
      }
    const max = products.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0)
    upsert({
      id: product?.id ?? (remoteEnabled() ? uniqueId('P') : `P-${max + 1}`),
      storeId: store.id,
      name: name.trim(),
      description: description.trim() || 'Sin descripción.',
      price: Math.round(Number(price)),
      image,
      icon,
      categoryId,
      tags: name.toLowerCase().split(/\s+/),
      compareGroup: product?.compareGroup,
      variants: variantObjs,
      sizes: ss,
      inventory,
      featured,
      active,
    })
    saved(product ? 'Artículo actualizado' : 'Artículo creado. Ya aparece en tu tienda.')
    onDone()
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-lg font-extrabold">{product ? 'Editar artículo' : 'Nuevo artículo'}</p>
        <button className={btn.ghost} onClick={onDone} aria-label="Cerrar">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {image ? (
          <img src={image} alt="Foto del artículo" className="size-28 rounded-2xl object-cover ring-1 ring-line" />
        ) : (
          <ProductImage product={{ ...(product ?? ({} as Product)), name: name || 'Artículo', image: null, icon, variants: [] }} brandColor={store.brandColor} className="size-28 rounded-2xl" />
        )}
        <div className="flex flex-col gap-2">
          <ImagePicker kind="product" label={image ? 'Cambiar foto' : 'Subir foto'} onImage={setImage}>
            <Camera className="size-4" />
          </ImagePicker>
          {image && (
            <button className={btn.ghost} onClick={() => setImage(null)}>
              <X className="size-4" /> Quitar foto
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input className={input} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Precio (COP)">
          <input className={input} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="45000" />
        </Field>
        <Field label="Descripción" wide>
          <textarea className={`${input} min-h-20`} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Categoría">
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
        {!product && (
          <Field label="Unidades disponibles" hint="Por cada combinación de color y talla.">
            <input className={input} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-brand" checked={active} onChange={(e) => setActive(e.target.checked)} /> Visible en la tienda
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-brand" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Destacado
          </label>
        </div>
      </div>
      {product && <InventoryEditor product={product} />}
      <div className="flex justify-end gap-2">
        <button className={btn.secondary} onClick={onDone}>
          Cancelar
        </button>
        <button className={btn.primary} disabled={!valid} onClick={save}>
          {product ? 'Guardar artículo' : 'Crear artículo'}
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
              onChange={(e) => upsert({ ...live, inventory: { ...live.inventory, [k]: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) } })}
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

function MerchantOrders({ store }: { store: Store }) {
  const orders = useOrders((s) => s.orders)
  const setStatus = useOrders((s) => s.setSubOrderStatus)
  const mine = orders.flatMap((o) => o.subOrders.filter((s) => s.storeId === store.id).map((s) => ({ order: o, sub: s })))
  if (!mine.length)
    return (
      <EmptyState icon={<ClipboardList className="size-6" />} title="Aún no tienes pedidos">
        Cuando alguien compre en tu tienda, aquí verás solo tu parte del pedido para confirmarla.
      </EmptyState>
    )
  return (
    <ul className="space-y-3">
      {mine.map(({ order, sub }) => (
        <li key={sub.id}>
          <Card className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-extrabold">{sub.id}</p>
                <p className="text-xs text-ink-soft">
                  {formatDateTime(order.createdAt)} · {order.customer.name} · {order.customer.whatsapp} ·{' '}
                  {order.delivery.mode === 'pickup' ? 'Recoge en el local' : `Domicilio: ${order.delivery.address}`}
                </p>
              </div>
              <select
                className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                value={sub.status}
                onChange={(e) => setStatus(sub.id, e.target.value as OrderStatus)}
                aria-label={`Estado de ${sub.id}`}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {ORDER_STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </div>
            <ul className="text-sm text-ink-soft">
              {sub.lines.map((l, i) => (
                <li key={i}>
                  {l.qty} × {l.name} {l.variantName && `(${l.variantName})`} {l.size && `talla ${l.size}`} — {formatCOP(l.lineTotal)}
                </li>
              ))}
            </ul>
            <p className="text-right text-sm font-extrabold">{formatCOP(sub.subtotal)}</p>
          </Card>
        </li>
      ))}
    </ul>
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
