import { DoorOpen } from 'lucide-react'
import { useCatalog } from '../state/catalog'
import { useBeta } from '../state/beta'
import { sceneOf } from '../immersive/logic'

const SCENE_LABEL = { shop: 'Tienda', restaurant: 'Restaurante', service: 'Servicios' } as const

/** Beta «Entrar al local»: la administración la enciende para todos y elige qué locales la tienen. */
export function InteriorAdmin() {
  const on = useBeta((s) => s.interior)
  const setOn = useBeta((s) => s.setInterior)
  const stores = useCatalog((s) => s.stores)
  const upsert = useCatalog((s) => s.upsertStore)
  const enabled = stores.filter((s) => s.interior).length
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-bold">
              <DoorOpen className="size-4" /> Entrar al local (beta)
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              En vez de abrir una ficha, el visitante entra al local: el fondo es el de la tienda y lo que vende flota delante, con una barra para comprar. Funciona para tiendas, restaurantes y servicios.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={on}
            aria-label="Encender la beta Entrar al local"
            onClick={() => setOn(!on)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-ink/20'}`}
          >
            <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <p className="mt-3 rounded-2xl bg-sand p-3 text-[12px] text-ink-soft">
          {on ? `Encendida para todos. ${enabled} ${enabled === 1 ? 'local la tiene' : 'locales la tienen'} habilitada; en los demás todo sigue como antes.` : 'Apagada: nadie la ve, aunque haya locales habilitados.'}
        </p>
      </div>

      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="font-bold">Locales habilitados</p>
        <p className="mb-3 text-xs text-ink-soft">Elige con cuáles locales probar. El botón «Entrar al local» aparece en su ficha.</p>
        <ul className="divide-y divide-line">
          {stores.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{s.name}</p>
                <p className="text-xs text-ink-soft">
                  {SCENE_LABEL[sceneOf(s)]}
                  {s.photoBg ? ' · con fondo propio' : ' · fondo por defecto'}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs font-bold text-ink-soft">
                <input type="checkbox" className="size-5 accent-brand" checked={!!s.interior} onChange={(e) => upsert({ ...s, interior: e.target.checked })} aria-label={`Habilitar ${s.name}`} />
                Habilitado
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
