import { Check, ExternalLink, MapPin, TriangleAlert } from 'lucide-react'
import type { Store } from '../domain/types'
import { directionsUrl, parseMapsUrl, type StoreAddress } from '../lib/maps'
import { btn } from '../ui/bits'

const input = 'w-full rounded-2xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand'

/** Dirección del local y enlace de Google Maps: el cliente ve la dirección y toca «Cómo llegar». */
export function AddressEditor({ store, onChange }: { store: Store; onChange: (a: StoreAddress | undefined) => void }) {
  const a: StoreAddress = store.address ?? { text: '' }
  const set = (p: Partial<StoreAddress>) => {
    const next = { ...a, ...p }
    // se guarda tal cual lo escribe (para no pelear con el cursor); se limpia al guardar el perfil
    onChange(next.text || next.mapsUrl ? next : undefined)
  }
  const typed = (a.mapsUrl ?? '').trim()
  const link = parseMapsUrl(typed)
  const bad = !!typed && !link
  const target = directionsUrl({ text: a.text, mapsUrl: typed })
  return (
    <div className="space-y-2.5 sm:col-span-2">
      <p className="flex items-center gap-2 text-sm font-bold">
        <MapPin className="size-4" /> Dirección y Google Maps
      </p>
      <p className="text-xs text-ink-soft">Tus clientes ven la dirección en tu ficha y un botón «Cómo llegar» que abre Google Maps.</p>
      <label className="block text-xs font-bold text-ink-soft">
        Dirección
        <input className={`${input} mt-1`} value={a.text} maxLength={140} placeholder="Ej. Calle del Arsenal #8-29, Getsemaní" autoComplete="street-address" onChange={(e) => set({ text: e.target.value })} />
      </label>
      <label className="block text-xs font-bold text-ink-soft">
        Enlace de Google Maps (opcional)
        <input className={`${input} mt-1`} value={a.mapsUrl ?? ''} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://maps.app.goo.gl/…" onChange={(e) => set({ mapsUrl: e.target.value })} />
      </label>
      {bad ? (
        <p className="flex items-start gap-1.5 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> Ese enlace no es de Google Maps. Usa el que sale al tocar «Compartir» en tu local de Google Maps. Mientras tanto se usará tu dirección escrita.
        </p>
      ) : link ? (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <Check className="size-3.5" /> Enlace de Google Maps válido.
        </p>
      ) : (
        <p className="text-[11px] text-ink-soft">Sin enlace, «Cómo llegar» busca tu dirección en Google Maps. Con el enlace de tu local llega exacto. Para sacarlo: abre tu local en Google Maps → Compartir → Copiar enlace.</p>
      )}
      {target && (
        <a href={target} target="_blank" rel="noopener noreferrer" className={`${btn.ghost} inline-flex`}>
          <ExternalLink className="size-4" /> Probar «Cómo llegar»
        </a>
      )}
    </div>
  )
}
