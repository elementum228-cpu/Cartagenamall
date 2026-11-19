import { Hammer, RotateCcw, RotateCw, Save, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { SPACE_BY_ID } from '../config/mall'
import type { LocalDesign, Store } from '../domain/types'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useUI } from '../state/ui'
import { AWNINGS, LOCAL_MODELS, LOGO_SIDES, ROOFS, SIDES, SIGNS, TOPPERS, WINDOWS, cleanDesign, designForBrand, designFromModel, type Option } from '../world/localDesign'
import { btn } from '../ui/bits'

// «Arma tu local» (solo administración): se elige una tienda ya creada y se le arma el edificio: modelo de partida, colores, techo, ventanas,
// toldo, letrero, pilar con el logo, objeto que corona el techo, mesas y maceteros. La vista previa es el mismo dibujo que sale en el mapa.

const LocalPreview = lazy(() => import('./LocalPreview'))

const SWATCHES = ['#f4b820', '#e8651f', '#c9553a', '#8b2f23', '#ffd9e6', '#f08fb3', '#6a5a8a', '#2c2540', '#1f6fb5', '#3f6b5a', '#3f8f55', '#f1e3c8', '#e9dfcd', '#2f3a4a', '#2b1a10', '#fbf6ea']

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
  // al cambiar de tienda (o al guardarse desde otro lado) se vuelve a su diseño guardado
  useEffect(() => setDraft(saved), [saved, storeId])

  if (!store) return <p className="rounded-2xl bg-sand p-4 text-sm text-ink-soft">Aún no hay tiendas creadas.</p>
  const space = spaceByStore[store.id] ? SPACE_BY_ID[spaceByStore[store.id]] : undefined
  const island = space?.type === 'island'
  const set = <K extends keyof LocalDesign>(k: K, v: LocalDesign[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const width = space && space.type !== 'island' ? space.size[0] : 6
  const depth = space && space.type !== 'island' ? space.size[1] : 5

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="flex items-center gap-2 font-bold">
          <Hammer className="size-4" /> Arma tu local
        </p>
        <p className="mt-1 text-xs text-ink-soft">Elige una tienda ya creada y constrúyele su edificio: fachada, techo, letrero, objeto en el techo y mesas. Se ve igual en el mapa.</p>
        <label className="mt-3 block text-xs font-bold text-ink-soft">
          Tienda
          <select className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink" value={store.id} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.design ? ' · personalizado' : ''}
              </option>
            ))}
          </select>
        </label>
        {!space && <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">Esta tienda aún no tiene un local asignado en el mapa: puedes armarlo, y se verá cuando se le asigne uno.</p>}
        {island && <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">Esta tienda está en una isla comercial: las islas conservan su mostrador. El diseño se verá cuando tenga un local.</p>}
      </div>

      {!draft ? (
        <div className="rounded-3xl border border-line bg-card p-4">
          <p className="font-bold">Elige un modelo de partida</p>
          <p className="mb-3 text-xs text-ink-soft">Después puedes cambiar todo: colores, techo, toldo, letrero y lo que lleva arriba.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {LOCAL_MODELS.map((m) => (
              <button key={m.id} onClick={() => setDraft(designFromModel(m.id))} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left active:scale-[0.99]">
                <span className="flex shrink-0 gap-0.5" aria-hidden>
                  {[m.design.wall, m.design.trim, m.design.awningColor].map((c) => (
                    <span key={c} className="size-6 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold">{m.name}</span>
                  <span className="block text-[11.5px] text-ink-soft">{m.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="sticky top-[calc(var(--chrome-top)+4px)] z-10 overflow-hidden rounded-3xl border border-line bg-[#e9d9bd] shadow-[0_10px_30px_-18px_rgba(6,44,66,0.5)]">
            <div className="aspect-[4/3] w-full max-h-[46dvh]">
              <Suspense fallback={<div className="grid h-full place-items-center text-sm font-semibold text-ink-soft">Cargando vista previa…</div>}>
                <LocalPreview store={store} design={draft} rotation={turn} width={width} depth={depth} />
              </Suspense>
            </div>
            <div className="flex items-center justify-between gap-2 bg-white/80 px-3 py-2 backdrop-blur">
              <span className="min-w-0 truncate text-xs font-bold text-ink">{store.name}</span>
              <div className="flex gap-1.5">
                <button className="grid size-9 place-items-center rounded-full bg-sand-2" aria-label="Girar a la izquierda" onClick={() => setTurn((t) => t - Math.PI / 4)}>
                  <RotateCcw className="size-4" />
                </button>
                <button className="grid size-9 place-items-center rounded-full bg-sand-2" aria-label="Girar a la derecha" onClick={() => setTurn((t) => t + Math.PI / 4)}>
                  <RotateCw className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-line bg-card p-4">
            <div>
              <p className="mb-1.5 text-xs font-bold text-ink-soft">Modelo de partida (cambiarlo reinicia las opciones de abajo)</p>
              <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {LOCAL_MODELS.map((m) => (
                  <button key={m.id} onClick={() => setDraft(designFromModel(m.id))} aria-pressed={draft.model === m.id} className={`shrink-0 rounded-2xl px-3 py-2 text-left text-[12.5px] font-extrabold transition ${draft.model === m.id ? 'bg-ink text-white' : 'bg-sand-2 text-ink'}`}>
                    {m.name}
                  </button>
                ))}
              </div>
              <button className="mt-2 text-xs font-bold text-teal underline" onClick={() => setDraft(designForBrand(draft.model, store.brandColor))}>
                Usar el color de marca de la tienda en las paredes
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Paredes" value={draft.wall} onPick={(v) => set('wall', v)} />
              <ColorField label="Detalles y letrero" value={draft.trim} onPick={(v) => set('trim', v)} />
              <ColorField label="Techo" value={draft.roofColor} onPick={(v) => set('roofColor', v)} />
              <ColorField label="Toldo, sillas y adornos" value={draft.awningColor} onPick={(v) => set('awningColor', v)} />
            </div>
            <Chips label="Techo" value={draft.roof} options={ROOFS} onPick={(v) => set('roof', v)} />
            <Chips label="Ventanas" value={draft.windows} options={WINDOWS} onPick={(v) => set('windows', v)} />
            <Chips label="Toldo" value={draft.awning} options={AWNINGS} onPick={(v) => set('awning', v)} />
            <Chips label="Costados" value={draft.side} options={SIDES} onPick={(v) => set('side', v)} />
            <Chips label="Letrero con el nombre" value={draft.sign} options={SIGNS} onPick={(v) => set('sign', v)} />
            <Chips label="Pilar con el logo" value={draft.logoSide} options={LOGO_SIDES} onPick={(v) => set('logoSide', v)} />
            <Chips label="Sobre el techo" value={draft.topper} options={TOPPERS} onPick={(v) => set('topper', v)} />
            <Chips
              label="Mesas afuera"
              value={draft.tables}
              options={[0, 1, 2, 3].map((n) => ({ id: n as 0 | 1 | 2 | 3, label: n === 0 ? 'Ninguna' : String(n) }))}
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
          </div>

          <div className="sticky bottom-[max(10px,env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur">
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
                disabled={!dirty}
                onClick={() => {
                  upsert({ ...store, design: draft })
                  toast('Local guardado: ya se ve en el mapa', 'success')
                }}
              >
                <Save className="size-4" /> Guardar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
