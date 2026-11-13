import { Clapperboard, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { readImageFile } from '../lib/image'
import { remoteEnabled } from '../remote/client'
import { uploadStadiumImage } from '../remote/photos'
import { CHAINS, MAX_MOVIES, newMovie, parseShowtimes, useCine, type CineChain, type CineMovie } from '../state/cine'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'

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

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-ink/20'}`}>
      <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
    </button>
  )
}

/** Una película: cartel, título, género, duración, clasificación y horarios (separados por comas). */
function MovieEditor({ movie, onChange, onRemove }: { movie: CineMovie; onChange: (m: CineMovie) => void; onRemove: () => void }) {
  const [times, setTimes] = useState(movie.showtimes.join(', '))
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-sand/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <Photo tall label="Cartel" value={movie.image} onChange={(image) => onChange({ ...movie, image })} />
        <button type="button" className={btn.ghost} onClick={onRemove} aria-label="Quitar película">
          <Trash2 className="size-4" />
        </button>
      </div>
      <input className={input} placeholder="Título de la película" maxLength={120} value={movie.title} onChange={(e) => onChange({ ...movie, title: e.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <input className={input} placeholder="Género" maxLength={40} value={movie.genre} onChange={(e) => onChange({ ...movie, genre: e.target.value })} />
        <input className={input} placeholder="Minutos" inputMode="numeric" value={movie.minutes ?? ''} onChange={(e) => onChange({ ...movie, minutes: Number(e.target.value.replace(/\D/g, '')) || null })} />
        <input className={input} placeholder="Clasif. (12+)" maxLength={8} value={movie.rating} onChange={(e) => onChange({ ...movie, rating: e.target.value })} />
      </div>
      <input
        className={input}
        placeholder="Horarios: 14:30, 17:00, 20:15"
        value={times}
        onChange={(e) => setTimes(e.target.value)}
        onBlur={() => {
          const showtimes = parseShowtimes(times)
          setTimes(showtimes.join(', '))
          onChange({ ...movie, showtimes })
        }}
      />
    </div>
  )
}

function ChainEditor({ chain, onChange }: { chain: CineChain; onChange: (c: CineChain) => void }) {
  const meta = CHAINS.find((c) => c.id === chain.id)!
  const [open, setOpen] = useState(false)
  const setMovie = (i: number, m: CineMovie) => onChange({ ...chain, movies: chain.movies.map((x, k) => (k === i ? m : x)) })
  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="size-3 shrink-0 rounded-full" style={{ background: meta.color }} />
          <span className="min-w-0">
            <span className="block truncate font-bold">{meta.name}</span>
            <span className="block text-xs text-ink-soft">
              {chain.movies.length} {chain.movies.length === 1 ? 'película' : 'películas'} · {chain.enabled ? 'visible' : 'oculta'}
            </span>
          </span>
        </button>
        <Switch on={chain.enabled} label={`Mostrar ${meta.name}`} onChange={(enabled) => onChange({ ...chain, enabled })} />
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {chain.movies.map((m, i) => (
            <MovieEditor key={m.id} movie={m} onChange={(next) => setMovie(i, next)} onRemove={() => onChange({ ...chain, movies: chain.movies.filter((_, k) => k !== i) })} />
          ))}
          <button type="button" className={btn.secondary} disabled={chain.movies.length >= MAX_MOVIES} onClick={() => onChange({ ...chain, movies: [...chain.movies, newMovie()] })}>
            <Plus className="size-4" /> Agregar película {chain.movies.length >= MAX_MOVIES && `(máximo ${MAX_MOVIES})`}
          </button>
        </div>
      )}
    </div>
  )
}

/** Cine: la administración lo enciende o apaga y gestiona sus dos interacciones (cartelera y entrada al cine). */
export function CineAdmin() {
  const on = useCine((s) => s.enabled)
  const boardOn = useCine((s) => s.boardOn)
  const lobbyOn = useCine((s) => s.lobbyOn)
  const posters = useCine((s) => s.posters)
  const chains = useCine((s) => s.chains)
  const set = useCine((s) => s.set)
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-bold">
              <Clapperboard className="size-4" /> Cine
            </p>
            <p className="mt-1 text-xs text-ink-soft">Isla del cine al norte del piso de comida: el edificio con marquesina, la plazoleta y la cartelera de cuatro carteles.</p>
          </div>
          <Switch on={on} label="Habilitar el cine" onChange={(enabled) => set({ enabled })} />
        </div>
        <p className="mt-3 rounded-2xl bg-sand p-3 text-[12px] text-ink-soft">{on ? 'Habilitado para todos.' : 'Deshabilitado: nadie ve la isla del cine.'}</p>
      </div>

      <div className="space-y-4 rounded-3xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">1 · Cartelera (carteles)</p>
            <p className="text-xs text-ink-soft">Al tocar la cartelera del frente se abre una vista tipo sala con estos cuatro carteles. También salen en la fachada (los dos primeros).</p>
          </div>
          <Switch on={boardOn} label="Habilitar la cartelera" onChange={(v) => set({ boardOn: v })} />
        </div>
        {posters.map((p, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-line bg-sand/50 p-3">
            <Photo tall label={`Cartel ${i + 1}`} value={p.image} onChange={(image) => set({ posters: posters.map((x, k) => (k === i ? { ...x, image } : x)) as typeof posters })} />
            <input className={input} placeholder="Título (opcional)" maxLength={60} value={p.title} onChange={(e) => set({ posters: posters.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) as typeof posters })} />
          </div>
        ))}
        <p className="text-[11px] text-ink-soft">Mejor imágenes verticales (2:3).</p>
      </div>

      <div className="space-y-3 rounded-3xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">2 · Entrar al cine</p>
            <p className="text-xs text-ink-soft">Al tocar el cine se abren las puertas y se ven las cadenas con sus películas y horarios. Más adelante vendrán de una API en tiempo real; por ahora se cargan aquí.</p>
          </div>
          <Switch on={lobbyOn} label="Habilitar la entrada al cine" onChange={(v) => set({ lobbyOn: v })} />
        </div>
        {chains.map((c) => (
          <ChainEditor key={c.id} chain={c} onChange={(next) => set({ chains: chains.map((x) => (x.id === c.id ? next : x)) })} />
        ))}
      </div>
    </div>
  )
}
