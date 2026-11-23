import { Hammer, RotateCcw, RotateCw, Save, Search, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SPACE_BY_ID } from '../config/mall'
import type { LocalDesign, LocalForm, Store } from '../domain/types'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useUI } from '../state/ui'
import { btn } from '../ui/bits'
import { AWNINGS, LOGO_SHAPES, LOGO_SIDES, ROOFS, ROOFS_ISLAND, SIDES, SIGNS, TOPPER_GROUPS, WINDOWS, WINDOWS_ISLAND, cleanDesign, designForBrand, designFromModel, modelsFor, type Option } from '../world/localDesign'

// «Arma tu local» (solo administración). A la izquierda, la vista previa 3D del local (la misma que sale en el mapa) que se queda fija; a la
// derecha, todo el módulo de construcción: buscador de tiendas, modelo, colores, estructura, letrero y logo, objeto en el techo y extras.
// Sirve para locales y para islas (los quioscos pequeños).

const LocalPreview = lazy(() => import('./LocalPreview'))

const SWATCHES = ['#f4b820', '#e8651f', '#c9553a', '#8b2f23', '#ffd9e6', '#f08fb3', '#6a5a8a', '#2c2540', '#1f6fb5', '#3f6b5a', '#3f8f55', '#f1e3c8', '#e9dfcd', '#2f3a4a', '#2b1a10', '#fbf6ea']

function Card({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3.5 rounded-3xl border border-line bg-card p-4">
      <div>
        <p className="flex items-center gap-2 text-[15px] font-extrabold">
          <span className="grid size-6 place-items-center rounded-full bg-ink text-[12px] text-white">{n}</span>
          {title}
        </p>
        {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Chips<T extends string | number>({ label, value, options, onPick }: { label: string; value: T; options: Option<T>[]; onPick: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-bold text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onPick(o.id)}
            className={`min-h-9 rounded-full px-3 text-[13px] font-bold transition active:scale-[0.97] ${value === o.id ? 'bg-ink text-white' : 'bg-sand-2 text-ink'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ColorField({ label, value, onPick }: { label: string; value: string; onPick: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-ink-soft">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((c) => (
          <button key={c} type="button" aria-label={`${label} ${c}`} aria-pressed={value.toLowerCase() === c} onClick={() => onPick(c)} className={`size-7 rounded-full ring-2 transition ${value.toLowerCase() === c ? 'ring-ink' : 'ring-black/10'}`} style={{ background: c }} />
        ))}
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} aria-label={`${label}: elegir otro color`} className="size-8 cursor-pointer rounded-full border border-line bg-white p-0.5" />
      </div>
    </div>
  )
}

/** Buscador de tiendas: escribe una parte del nombre y elige. */
function StorePicker({ stores, value, onPick, spaceLabel }: { stores: Store[]; value: string; onPick: (id: string) => void; spaceLabel: (id: string) => string }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'with' | 'without'>('all')
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const shown = useMemo(() => {
    const n = norm(q.trim())
    return stores.filter((s) => (!n || norm(s.name).includes(n) || norm(s.logoText).includes(n)) && (filter === 'all' || (filter === 'with') === !!s.design))
  }, [stores, q, filter])
  return (
    <div className="space-y-2.5">
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && shown[0] && onPick(shown[0].id)}
          placeholder="Buscar tienda por nombre…"
          aria-label="Buscar tienda"
          className="w-full rounded-xl border border-line bg-white py-2.5 pr-3 pl-9 text-sm font-semibold outline-none focus:border-brand"
        />
      </label>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Filtro">
        {(
          [
            ['all', 'Todas'],
            ['with', 'Con diseño'],
            ['without', 'Sin diseño'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="radio" aria-checked={filter === id} onClick={() => setFilter(id)} className={`rounded-full px-3 py-1 text-xs font-bold ${filter === id ? 'bg-ink text-white' : 'bg-sand-2 text-ink-soft'}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-ink-soft">{shown.length} de {stores.length}</span>
      </div>
      <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-2xl border border-line bg-white">
        {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-ink-soft">Ninguna tienda coincide.</li>}
        {shown.map((s) => (
          <li key={s.id}>
            <button onClick={() => onPick(s.id)} aria-current={s.id === value} className={`flex w-full items-center gap-3 px-3 py-2 text-left ${s.id === value ? 'bg-teal/10' : 'active:bg-sand'}`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white" style={{ background: s.brandColor }} aria-hidden>
                {s.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{s.name}</span>
                <span className="block truncate text-[11px] text-ink-soft">{spaceLabel(s.id)}</span>
              </span>
              {s.design && <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold text-brand">Personalizado</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LocalBuilder() {
  const stores = useCatalog((s) => s.stores)
  const upsert = useCatalog((s) => s.upsertStore)
  const toast = useUI((s) => s.toast)
  const { spaceByStore } = useCatalogMaps()
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const store: Store | undefined = stores.find((s) => s.id === storeId)
  const saved = useMemo(() => cleanDesign(store?.design), [store?.design])
  const [draft, setDraft] = useState<LocalDesign | null>(saved)
  const [turn, setTurn] = useState(0)
  const [cutaway, setCutaway] = useState(false)
  useEffect(() => setDraft(saved), [saved, storeId])

  const spaceOf = (id: string) => (spaceByStore[id] ? SPACE_BY_ID[spaceByStore[id]] : undefined)
  const spaceLabel = (id: string) => {
    const sp = spaceOf(id)
    return sp ? `${sp.label} · ${sp.type === 'island' ? 'Isla' : sp.type === 'premium' ? 'Local premium' : 'Local'}` : 'Sin local asignado'
  }

  if (!store) return <p className="rounded-2xl bg-sand p-4 text-sm text-ink-soft">Aún no hay tiendas creadas.</p>
  const space = spaceOf(store.id)
  const spaceForm: LocalForm | null = space ? (space.type === 'island' ? 'island' : 'local') : null
  const set = <K extends keyof LocalDesign>(k: K, v: LocalDesign[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const form = draft?.form ?? spaceForm ?? 'local'
  const isIsland = form === 'island'
  const width = space && space.type !== 'island' ? space.size[0] : 6
  const depth = space && space.type !== 'island' ? space.size[1] : 5
  const mismatch = !!draft && spaceForm !== null && draft.form !== spaceForm

  return (
    <div className="space-y-4 pb-24 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-6 lg:space-y-0">
      {/* izquierda: vista previa fija */}
      <div className="space-y-3 lg:sticky lg:top-44 lg:order-1">
        <div className="overflow-hidden rounded-3xl border border-line bg-[#e9d9bd] shadow-[0_10px_30px_-18px_rgba(6,44,66,0.5)]">
          <div className="relative aspect-[4/3] w-full lg:aspect-auto lg:h-[min(58dvh,540px)]">
            {draft ? (
              <Suspense fallback={<div className="grid h-full place-items-center text-sm font-semibold text-ink-soft">Cargando vista previa…</div>}>
                <LocalPreview cutaway={cutaway} store={store} design={draft} rotation={turn} width={isIsland ? 2.6 : width} depth={isIsland ? 2.6 : depth} />
              </Suspense>
            ) : (
              <div className="grid h-full place-items-center p-6 text-center text-sm font-semibold text-ink-soft">
                <div>
                  <Hammer className="mx-auto mb-2 size-8 opacity-50" />
                  {store.name} aún no tiene un diseño propio.
                  <br />
                  Elige un modelo de partida a la derecha y lo armas aquí.
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 bg-white/80 px-3 py-2 backdrop-blur">
            <span className="min-w-0 truncate text-xs font-bold text-ink">
              {store.name} · {spaceLabel(store.id)}
            </span>
            <div className="flex items-center gap-1.5">
              {!isIsland && (
                <label className="mr-1 flex items-center gap-1.5 text-xs font-bold text-ink-soft">
                  <input type="checkbox" className="size-4 accent-brand" checked={cutaway} onChange={(e) => setCutaway(e.target.checked)} /> Ver por dentro
                </label>
              )}
              <button className="grid size-9 place-items-center rounded-full bg-sand-2 disabled:opacity-40" aria-label="Girar a la izquierda" disabled={!draft} onClick={() => setTurn((t) => t - Math.PI / 4)}>
                <RotateCcw className="size-4" />
              </button>
              <button className="grid size-9 place-items-center rounded-full bg-sand-2 disabled:opacity-40" aria-label="Girar a la derecha" disabled={!draft} onClick={() => setTurn((t) => t + Math.PI / 4)}>
                <RotateCw className="size-4" />
              </button>
            </div>
          </div>
        </div>
        {mismatch && (
          <p className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
            Esta tienda está en {spaceForm === 'island' ? 'una isla' : 'un local'} y el diseño es de {draft!.form === 'island' ? 'isla' : 'local'}: en el mapa no se verá hasta que coincidan.
          </p>
        )}
        {!space && <p className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">Esta tienda aún no tiene un local asignado: puedes armarlo y se verá cuando se le asigne uno.</p>}
      </div>

      {/* derecha: el módulo de construcción */}
      <div className="space-y-4 lg:order-2">
        <Card n={1} title="Elige la tienda" hint="Busca por nombre y toca para armarle su local.">
          <StorePicker stores={stores} value={store.id} onPick={setStoreId} spaceLabel={spaceLabel} />
        </Card>

        <Card n={2} title="Modelo de partida" hint="Después puedes cambiarlo todo. Elegir otro modelo reinicia las opciones.">
          <Chips<LocalForm>
            label="Tipo"
            value={form}
            options={[
              { id: 'local', label: 'Local' },
              { id: 'island', label: 'Isla (quiosco)' },
            ]}
            onPick={(f) => setDraft(designFromModel(modelsFor(f)[0].id))}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {modelsFor(form).map((m) => (
              <button key={m.id} onClick={() => setDraft(designFromModel(m.id))} aria-pressed={draft?.model === m.id} className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left active:scale-[0.99] ${draft?.model === m.id ? 'border-ink bg-ink/5' : 'border-line bg-white'}`}>
                <span className="flex shrink-0 gap-0.5" aria-hidden>
                  {[m.design.wall, m.design.trim, m.design.awningColor].map((c) => (
                    <span key={c} className="size-5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold">{m.name}</span>
                  <span className="block text-[11px] leading-snug text-ink-soft">{m.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        {draft && (
          <>
            <Card n={3} title="Colores">
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Paredes" value={draft.wall} onPick={(v) => set('wall', v)} />
                <ColorField label="Detalles y letrero" value={draft.trim} onPick={(v) => set('trim', v)} />
                <ColorField label="Techo" value={draft.roofColor} onPick={(v) => set('roofColor', v)} />
                <ColorField label="Toldo, sillas y adornos" value={draft.awningColor} onPick={(v) => set('awningColor', v)} />
              </div>
              <button className="text-xs font-bold text-teal underline" onClick={() => setDraft(designForBrand(draft.model, store.brandColor))}>
                Usar el color de marca de la tienda en las paredes
              </button>
            </Card>

            <Card n={4} title="Estructura">
              <Chips label="Techo" value={draft.roof} options={isIsland ? ROOFS_ISLAND : ROOFS} onPick={(v) => set('roof', v)} />
              <Chips label={isIsland ? 'Mostrador' : 'Ventanas'} value={draft.windows} options={isIsland ? WINDOWS_ISLAND : WINDOWS} onPick={(v) => set('windows', v)} />
              <Chips label="Toldo" value={draft.awning} options={AWNINGS} onPick={(v) => set('awning', v)} />
              <Chips label={isIsland ? 'Frente del mostrador' : 'Costados'} value={draft.side} options={SIDES} onPick={(v) => set('side', v)} />
            </Card>

            <Card n={5} title="Letrero y logo">
              <Chips label="Letrero con el nombre" value={draft.sign} options={SIGNS} onPick={(v) => set('sign', v)} />
              <Chips label={isIsland ? 'Logo en un costado' : 'Pilar con el logo'} value={draft.logoSide} options={LOGO_SIDES} onPick={(v) => set('logoSide', v)} />
              <Chips label="Forma del logo" value={draft.logoShape} options={LOGO_SHAPES} onPick={(v) => set('logoShape', v)} />
              <p className="text-[11px] text-ink-soft">El logo es el de la tienda; si no tiene, se usan sus letras. «Colgante» sobresale de la fachada, como los letreros de calle.</p>
            </Card>

            <Card n={6} title="Objeto sobre el techo" hint="Banco de objetos low poly: elige el que mejor represente al negocio.">
              {TOPPER_GROUPS.map((g) => (
                <Chips key={g.title} label={g.title} value={draft.topper} options={g.items} onPick={(v) => set('topper', v)} />
              ))}
            </Card>

            <Card n={7} title="Extras">
              <Chips
                label={isIsland ? 'Banquitos al frente' : 'Mesas afuera'}
                value={draft.tables}
                options={Array.from({ length: !isIsland && draft.windows === 'open' ? 7 : 4 }, (_, n) => ({ id: n, label: n === 0 ? 'Ninguna' : String(n) }))}
                onPick={(v) => set('tables', v)}
              />
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    ['planters', 'Maceteros con plantas'],
                    ['lights', 'Luces y vitrinas encendidas de noche'],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" className="size-5 accent-brand" checked={draft[k]} onChange={(e) => set(k, e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>

      <div className="fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          className={`${btn.ghost} text-red-700`}
          onClick={() => {
            if (!window.confirm(`¿Quitar el diseño de ${store.name}? Volverá a su fachada de siempre.`)) return
            const { design: _d, ...rest } = store
            void _d
            upsert(rest as Store)
            setDraft(null)
            toast('Diseño quitado', 'success')
          }}
          disabled={!store.design}
        >
          <Trash2 className="size-4" /> Quitar diseño
        </button>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs font-bold text-amber-700">Cambios sin guardar</span>}
          <button
            className={btn.primary}
            disabled={!dirty || !draft}
            onClick={() => {
              if (!draft) return
              upsert({ ...store, design: draft })
              toast('Local guardado: ya se ve en el mapa', 'success')
            }}
          >
            <Save className="size-4" /> Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
