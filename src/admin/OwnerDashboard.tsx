import { Building2, Eye, MapPin, RotateCcw, Search, Trophy, Utensils } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { COURT_SPACE, FLOORS, FLOOR_BY_ID, SHOP_SPACE_TYPES, SPACES, SPACE_TYPES, ZONE_BY_ID } from '../config/mall'
import type { SpaceSlot, SpaceType, Store } from '../domain/types'
import { COURT_COLOR } from '../football/open'
import { formatCOP } from '../lib/format'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useClaims } from '../state/claims'
import { spacePrice, typePrice, useSpacePricing, validPrice } from '../state/spacePricing'
import { useUI } from '../state/ui'
import { StoreLogo } from '../ui/bits'

// Vista del dueño del centro comercial: ocupación e ingresos de un vistazo, precios por tipo de
// espacio, amenidades y la lista de todos los espacios con su precio editable.

const ALL_SPACES: SpaceSlot[] = [...SPACES, COURT_SPACE]
type Filter = 'todos' | 'disponibles' | 'ocupados'

interface Row {
  space: SpaceSlot
  store: Store | null
  pending: number
  price: number
  custom: boolean
}

function useRows(): Row[] {
  const assignments = useCatalog((s) => s.assignments)
  const { storeById } = useCatalogMaps()
  const claims = useClaims((s) => s.claims)
  const pricing = useSpacePricing()
  return useMemo(
    () =>
      ALL_SPACES.map((space) => ({
        space,
        store: storeById[assignments[space.id]] ?? null,
        pending: claims.filter((c) => c.spaceId === space.id && c.status === 'pending').length,
        price: spacePrice(pricing, space),
        custom: pricing.spaces[space.id] !== undefined,
      })),
    [assignments, storeById, claims, pricing],
  )
}

export function OwnerDashboard() {
  const rows = useRows()
  const occupied = rows.filter((r) => r.store)
  const income = occupied.reduce((t, r) => t + r.price, 0)
  const potential = rows.reduce((t, r) => t + r.price, 0)
  const pending = rows.reduce((t, r) => t + r.pending, 0)
  const pct = Math.round((occupied.length / rows.length) * 100)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Gestión del centro comercial</h2>
        <p className="text-sm text-ink-soft">Todos los espacios y amenidades del mall, su ocupación y el precio mensual de cada uno. Los precios que cambies se ven al instante en el mapa y en las fichas para reclamar.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Espacios en arriendo" value={rows.length} />
        <Kpi label="Ocupados" value={`${occupied.length} · ${pct}%`} bar={pct} />
        <Kpi label="Disponibles" value={rows.length - occupied.length} />
        <Kpi label="Solicitudes por revisar" value={pending} />
        <Kpi label="Ingreso mensual (ocupados)" value={formatCOP(income)} strong />
        <Kpi label="Ingreso con todo ocupado" value={formatCOP(potential)} />
      </div>
      <p className="-mt-3 text-xs text-ink-soft">Ingresos calculados con los precios de esta lista (referencia): la app no cobra ni registra pagos.</p>

      <TypePrices rows={rows} />
      <Amenities rows={rows} />
      <SpaceList rows={rows} />
    </div>
  )
}

function Kpi({ label, value, strong, bar }: { label: string; value: ReactNode; strong?: boolean; bar?: number }) {
  return (
    <div className={`rounded-3xl border p-4 ${strong ? 'border-brand/30 bg-brand/5' : 'border-line bg-card'}`}>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className={`mt-0.5 text-xl font-extrabold tracking-tight ${strong ? 'text-brand' : ''}`}>{value}</p>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-2">
          <div className="h-full rounded-full bg-brand" style={{ width: `${bar}%` }} />
        </div>
      )}
    </div>
  )
}

/** Campo de precio en pesos: se guarda al salir del campo o con Enter. */
function PriceInput({ value, onSave, label }: { value: number; onSave: (n: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = Number(draft.replace(/\D/g, ''))
    setDraft(null)
    if (validPrice(n) && n !== value) onSave(n)
  }
  const shown = draft ?? value.toLocaleString('es-CO')
  return (
    <label className="flex items-center rounded-xl border border-line bg-white px-2.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
      <span className="text-sm font-bold text-ink-soft">$</span>
      <input
        aria-label={label}
        inputMode="numeric"
        className="w-full min-w-0 bg-transparent px-1.5 py-2 text-[15px] font-bold outline-none"
        value={shown}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setDraft(null)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      <span className="shrink-0 text-xs text-ink-soft">/mes</span>
    </label>
  )
}

function TypePrices({ rows }: { rows: Row[] }) {
  const pricing = useSpacePricing()
  const toast = useUI((s) => s.toast)
  const types: SpaceType[] = [...SHOP_SPACE_TYPES, 'court']
  return (
    <section>
      <h3 className="mb-1 text-sm font-extrabold">Precio por tipo de espacio</h3>
      <p className="mb-3 text-xs text-ink-soft">Se aplica a todos los espacios de ese tipo, salvo los que tengan un precio propio en la lista de abajo.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {types.map((t) => {
          const count = rows.filter((r) => r.space.type === t).length
          const changed = pricing.types[t] !== undefined
          return (
            <div key={t} className="rounded-3xl border border-line bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-extrabold">{SPACE_TYPES[t].name}</p>
                <span className="text-xs text-ink-soft">
                  {count} {count === 1 ? 'espacio' : 'espacios'}
                </span>
              </div>
              <div className="mt-2">
                <PriceInput
                  label={`Precio mensual de ${SPACE_TYPES[t].name}`}
                  value={typePrice(pricing, t)}
                  onSave={(n) => {
                    pricing.setTypePrice(t, n)
                    toast(`${SPACE_TYPES[t].name}: ${formatCOP(n)}/mes`, 'success')
                  }}
                />
              </div>
              <p className="mt-1.5 flex items-center justify-between text-[11px] text-ink-soft">
                Referencia: {formatCOP(SPACE_TYPES[t].monthlyPriceCOP)}
                {changed && (
                  <button className="flex items-center gap-1 font-bold text-brand" onClick={() => pricing.setTypePrice(t, null)}>
                    <RotateCcw className="size-3" /> Restablecer
                  </button>
                )}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Amenities({ rows }: { rows: Row[] }) {
  const pricing = useSpacePricing()
  const navigate = useNavigate()
  const court = rows.find((r) => r.space.id === COURT_SPACE.id)!
  const food = rows.filter((r) => r.space.zoneId === 'E')
  const foodBusy = food.filter((r) => r.store).length
  const foodZone = ZONE_BY_ID.E
  const foodFloor = FLOOR_BY_ID[FLOORS.find((f) => f.zones.some((z) => z.id === 'E'))!.id]
  return (
    <section>
      <h3 className="mb-3 text-sm font-extrabold">Amenidades</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl border border-line bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl text-white" style={{ background: COURT_COLOR }}>
              <Trophy className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">Cancha sintética · Fútbol 5</p>
              <p className="text-xs text-ink-soft">{FLOOR_BY_ID.P1.name} · Jardín de la fortaleza</p>
            </div>
            <Status row={court} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <PriceInput label="Precio mensual de la cancha" value={court.price} onSave={(n) => pricing.setSpacePrice(COURT_SPACE.id, n)} />
            <button className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-ink-soft hover:bg-ink/5" onClick={() => viewOnMap(COURT_SPACE, navigate)}>
              <Eye className="size-4" /> Ver
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {court.store ? (
              <>
                La opera <b className="text-ink">{court.store.name}</b>: partido y reservas por hora activos.
              </>
            ) : (
              'Libre: se muestra vacía con «TU NEGOCIO AQUÍ». Asígnale un negocio en Espacios para activarla.'
            )}
          </p>
        </div>
        <div className="rounded-3xl border border-line bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl text-white" style={{ background: foodZone.color }}>
              <Utensils className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{foodZone.name}</p>
              <p className="text-xs text-ink-soft">{foodFloor.name}</p>
            </div>
            <span className="rounded-full bg-sand-2 px-2.5 py-1 text-xs font-bold">
              {foodBusy}/{food.length} ocupados
            </span>
          </div>
          <p className="mt-3 text-sm">
            Ingreso mensual: <b>{formatCOP(food.filter((r) => r.store).reduce((t, r) => t + r.price, 0))}</b>
            <span className="text-ink-soft"> de {formatCOP(food.reduce((t, r) => t + r.price, 0))} posibles</span>
          </p>
          <p className="mt-1 text-xs text-ink-soft">Los precios de cada puesto se ajustan en la lista de abajo (filtra por «{foodZone.name}»).</p>
        </div>
      </div>
    </section>
  )
}

function Status({ row }: { row: Row }) {
  if (row.store) return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Ocupado</span>
  if (row.pending) return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">En revisión</span>
  return <span className="rounded-full bg-sand-2 px-2.5 py-1 text-xs font-bold text-ink-soft">Disponible</span>
}

function viewOnMap(space: SpaceSlot, navigate: ReturnType<typeof useNavigate>) {
  navigate('/')
  const ui = useUI.getState()
  ui.setFloor(space.floorId)
  if (space.id === COURT_SPACE.id) ui.requestFocus({ kind: 'court' })
  else ui.requestFocus({ kind: 'space', id: space.id })
}

const groupName = (space: SpaceSlot) => {
  if (space.id === COURT_SPACE.id) return `${FLOOR_BY_ID.P1.name} · Amenidades`
  const zone = ZONE_BY_ID[space.zoneId]
  return `${FLOOR_BY_ID[space.floorId].name} · ${zone.id === 'E' ? zone.name : `Pasillo ${zone.id} · ${zone.name}`}`
}

function SpaceList({ rows }: { rows: Row[] }) {
  const pricing = useSpacePricing()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('todos')
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = rows.filter(
    (r) =>
      (filter === 'todos' || (filter === 'ocupados') === !!r.store) &&
      (!needle || [r.space.label, r.store?.name ?? '', SPACE_TYPES[r.space.type].name, groupName(r.space)].some((t) => t.toLowerCase().includes(needle))),
  )
  const groups = [...new Set(shown.map((r) => groupName(r.space)))]

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold">Todos los espacios</h3>
          <p className="text-xs text-ink-soft">Cambia el precio de un espacio puntual; «Usar precio del tipo» lo devuelve al general.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-2.5">
            <Search className="size-4 text-ink-soft" />
            <input className="w-40 bg-transparent py-2 text-sm outline-none" placeholder="Buscar local o negocio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar espacio" />
          </label>
          <div className="flex rounded-xl bg-sand-2 p-1 text-xs font-bold">
            {(['todos', 'disponibles', 'ocupados'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-lg px-2.5 py-1.5 capitalize ${filter === f ? 'bg-white shadow-sm' : 'text-ink-soft'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>
      {!shown.length && <p className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">Ningún espacio coincide.</p>}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g} className="overflow-hidden rounded-3xl border border-line bg-card">
            <p className="flex items-center gap-2 border-b border-line bg-sand/60 px-4 py-2 text-xs font-extrabold">
              <Building2 className="size-3.5" /> {g}
            </p>
            <ul className="divide-y divide-line">
              {shown
                .filter((r) => groupName(r.space) === g)
                .map((r) => (
                  <li key={r.space.id} className="grid items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_200px_auto]">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-extrabold">{r.space.label}</p>
                      <p className="text-xs text-ink-soft">{SPACE_TYPES[r.space.type].name}</p>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      {r.store ? (
                        <>
                          <StoreLogo store={r.store} size={28} />
                          <span className="truncate text-sm font-bold">{r.store.name}</span>
                        </>
                      ) : (
                        <Status row={r} />
                      )}
                    </div>
                    <div>
                      <PriceInput label={`Precio mensual del espacio ${r.space.label}`} value={r.price} onSave={(n) => pricing.setSpacePrice(r.space.id, n)} />
                      {r.custom && (
                        <button className="mt-1 flex items-center gap-1 text-[11px] font-bold text-brand" onClick={() => pricing.setSpacePrice(r.space.id, null)}>
                          <RotateCcw className="size-3" /> Usar precio del tipo ({formatCOP(typePrice(pricing, r.space.type))})
                        </button>
                      )}
                    </div>
                    <button className="flex items-center justify-center gap-1.5 justify-self-start rounded-xl px-3 py-2 text-sm font-bold text-ink-soft hover:bg-ink/5" onClick={() => viewOnMap(r.space, navigate)}>
                      <MapPin className="size-4" /> Ver en el mapa
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
