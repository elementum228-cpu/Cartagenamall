import { Clapperboard, ImagePlus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { readImageFile } from '../lib/image'
import { remoteEnabled } from '../remote/client'
import { uploadStadiumImage } from '../remote/photos'
import { useCine } from '../state/cine'
import { useUI } from '../state/ui'
import { btn } from '../ui/bits'

/** Imagen que se reduce y, con base de datos, se sube a Storage; si no, queda en este navegador. */
function Photo({ value, onChange, label, tall = false }: { value: string | null; onChange: (v: string | null) => void; label: string; tall?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const toast = useUI((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const pick = async (f: File) => {
    setBusy(true)
    try {
      const data = await readImageFile(f, 'poster')
      onChange(remoteEnabled() ? await uploadStadiumImage(data) : data)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cargar la imagen.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      <div className={`grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-sand ${tall ? 'h-24 w-16' : 'h-16 w-28'}`}>
        {value ? <img src={value} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5 text-ink-soft" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold">{label}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} disabled={busy} onClick={() => ref.current?.click()}>
            {busy ? 'Subiendo…' : value ? 'Cambiar imagen' : 'Subir imagen'}
          </button>
          {value && (
            <button type="button" className={btn.ghost} onClick={() => onChange(null)}>
              <X className="size-4" /> Quitar
            </button>
          )}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void pick(f)
        }}
      />
    </div>
  )
}

/** Cine: la administración lo enciende o apaga y cambia la pantalla exterior y las dos carteleras. */
export function CineAdmin() {
  const on = useCine((s) => s.enabled)
  const screens = useCine((s) => s.screens)
  const posters = useCine((s) => s.posters)
  const set = useCine((s) => s.set)
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-bold">
              <Clapperboard className="size-4" /> Cine
            </p>
            <p className="mt-1 text-xs text-ink-soft">Isla del cine al norte del piso de comida: el edificio con marquesina, la plazoleta y la cartelera de tres pantallas.</p>
          </div>
          <button
            role="switch"
            aria-checked={on}
            aria-label="Habilitar el cine"
            onClick={() => set({ enabled: !on })}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-ink/20'}`}
          >
            <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <p className="mt-3 rounded-2xl bg-sand p-3 text-[12px] text-ink-soft">{on ? 'Habilitado para todos.' : 'Deshabilitado: nadie ve la isla del cine.'}</p>
      </div>

      <div className="space-y-4 rounded-3xl border border-line bg-card p-4">
        <div>
          <p className="font-bold">Cartelera del frente (3 pantallas)</p>
          <p className="text-xs text-ink-soft">Las películas de moda o la publicidad que quieras mostrar. Mejor imágenes verticales (2:3).</p>
        </div>
        {(['Pantalla izquierda', 'Pantalla central', 'Pantalla derecha'] as const).map((label, i) => (
          <Photo key={label} tall label={label} value={screens[i]} onChange={(v) => set({ screens: screens.map((x, k) => (k === i ? v : x)) as [string | null, string | null, string | null] })} />
        ))}
      </div>

      <div className="space-y-4 rounded-3xl border border-line bg-card p-4">
        <div>
          <p className="font-bold">Carteleras de la fachada</p>
          <p className="text-xs text-ink-soft">Los dos afiches a los lados de la puerta. Mejor imágenes verticales (2:3).</p>
        </div>
        <Photo tall label="Cartelera izquierda" value={posters[0]} onChange={(v) => set({ posters: [v, posters[1]] })} />
        <Photo tall label="Cartelera derecha" value={posters[1]} onChange={(v) => set({ posters: [posters[0], v] })} />
      </div>
    </div>
  )
}
