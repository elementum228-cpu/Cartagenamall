import { Gift, Plus, Ticket, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cleanRewards, liveRewards, newStoreReward, useArcadeRewards, type StoreReward } from '../arcade/rewards'
import { useCatalog } from '../state/catalog'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'

// Premios del Arcade por tienda: la administración crea una promoción para un negocio (un descuento, un regalo, un servicio) y fija
// cuántos tiquetes cuesta. Los jugadores la ven en «Recompensas» (la isla del arcade) y la canjean con los tiquetes que ganan jugando;
// al canjear reciben un código para mostrar en la tienda.

const PRESETS = [
  { label: '20 % de descuento', title: '20 % de descuento en tu compra', cost: 80 },
  { label: 'Producto o plato gratis', title: 'Un producto de regalo', cost: 150 },
  { label: 'Servicio gratis', title: 'Un servicio gratis', cost: 200 },
]

function Row({ r, onChange, onRemove, stores }: { r: StoreReward; onChange: (r: StoreReward) => void; onRemove: () => void; stores: { id: string; name: string }[] }) {
  const [cost, setCost] = useState(String(r.cost))
  return (
    <li className={`space-y-2.5 rounded-2xl border p-3 ${r.active ? 'border-line bg-white' : 'border-line bg-sand/60 opacity-80'}`}>
      <div className="flex items-start gap-2">
        <select
          className={`${input} flex-1`}
          value={r.storeId}
          aria-label="Tienda que ofrece el premio"
          onChange={(e) => {
            const st = stores.find((x) => x.id === e.target.value)
            onChange({ ...r, storeId: e.target.value, storeName: st?.name ?? '' })
          }}
        >
          <option value="">Elige la tienda…</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button onClick={onRemove} aria-label="Quitar este premio" className={btn.icon}>
          <Trash2 className="size-4" />
        </button>
      </div>
      <input className={input} maxLength={80} placeholder="Premio (ej.: 20 % de descuento en tu compra)" value={r.title} onChange={(e) => onChange({ ...r, title: e.target.value })} />
      <textarea className={`${input} min-h-16`} maxLength={200} placeholder="Condiciones (opcional): vigencia, horarios, restricciones…" value={r.detail} onChange={(e) => onChange({ ...r, detail: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-xs font-bold text-ink-soft">
            <Ticket className="size-3.5" /> Tiquetes que cuesta
          </span>
          <input
            className={input}
            inputMode="numeric"
            value={cost}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6)
              setCost(v)
              const n = Number(v)
              if (n >= 1) onChange({ ...r, cost: n })
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-soft">Válido hasta (opcional)</span>
          <input className={input} type="date" value={r.until} onChange={(e) => onChange({ ...r, until: e.target.value })} />
        </label>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-5" checked={r.active} onChange={(e) => onChange({ ...r, active: e.target.checked })} />
        Visible para los jugadores
      </label>
      {!r.storeId && <p className="text-xs text-amber-700">Elige la tienda para que el premio aparezca con su nombre.</p>}
    </li>
  )
}

export function ArcadeRewardsAdmin() {
  const toast = useUI((s) => s.toast)
  const rewards = useArcadeRewards((s) => s.rewards)
  const catalog = useCatalog((s) => s.stores)
  const stores = useMemo(() => catalog.map((s) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name, 'es')), [catalog])
  const live = liveRewards(rewards).length
  const commit = (next: StoreReward[]) => useArcadeRewards.getState().set(next)
  const add = (preset?: (typeof PRESETS)[number]) => {
    const r = { ...newStoreReward(), ...(preset ? { title: preset.title, cost: preset.cost } : {}) }
    commit([...rewards, r])
    toast('Premio agregado: elige la tienda y publícalo')
  }
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-extrabold">
        <Gift className="size-5" /> Premios de las tiendas (por tiquetes)
      </h2>
      <p className="mb-3 text-sm text-ink-soft">
        Crea una promoción para un negocio y fija cuántos tiquetes cuesta. Los jugadores la ven en el cuarto de recompensas del Arcade y la canjean con los tiquetes que
        ganan jugando; al canjear reciben un código para mostrar en la tienda. Hoy hay {live} {live === 1 ? 'premio visible' : 'premios visibles'}.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => add(p)} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-ink ring-1 ring-line">
            + {p.label}
          </button>
        ))}
        <button onClick={() => add()} className={`${btn.secondary} !py-1.5`}>
          <Plus className="size-4" /> Otro premio
        </button>
      </div>
      {rewards.length === 0 ? (
        <p className="rounded-xl bg-sand/60 p-3 text-sm text-ink-soft">Aún no hay premios. Toca uno de los botones de arriba para empezar.</p>
      ) : (
        <ul className="space-y-3">
          {rewards.map((r) => (
            <Row key={r.id} r={r} stores={stores} onChange={(n) => commit(rewards.map((x) => (x.id === r.id ? n : x)))} onRemove={() => commit(rewards.filter((x) => x.id !== r.id))} />
          ))}
        </ul>
      )}
      {rewards.some((r) => !cleanRewards([r]).length) && <p className="mt-2 text-xs text-amber-700">Los premios sin nombre no se guardan: escribe qué se regala.</p>}
    </section>
  )
}
