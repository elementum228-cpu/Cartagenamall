import { Clapperboard, Copy, ImagePlus, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { readImageFile } from '../lib/image'
import { remoteEnabled } from '../remote/client'
import { uploadStadiumImage } from '../remote/photos'
import { CHAINS, MAX_MOVIES, dayLabel, formatShows, newMovie, nextDays, parseShows, repeatWeek, showsOf, useCine, withShows, type CineMovie, type CineShow, type ChainId } from '../state/cine'
import { exampleCine } from '../state/cineExample'
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

/** Una película del catálogo: cartel, título, género, duración, clasificación y sinopsis. */
function MovieEditor({ movie, onChange, onRemove }: { movie: CineMovie; onChange: (m: CineMovie) => void; onRemove: () => void }) {
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
      <textarea className={`${input} min-h-20`} placeholder="Sinopsis (se ve en la pantalla de la película)" maxLength={400} value={movie.synopsis} onChange={(e) => onChange({ ...movie, synopsis: e.target.value })} />
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={movie.isNew} onChange={(e) => onChange({ ...movie, isNew: e.target.checked })} /> Estreno (sale primero y lleva la etiqueta «Estreno»)
      </label>
    </div>
  )
}

/** Horas de una película en una cadena y un día: se escriben en una línea y se ordenan al salir del campo. */
function ShowsInput({ movie, chain, day, shows, onChange }: { movie: CineMovie; chain: ChainId; day: string; shows: CineShow[]; onChange: (text: string) => void }) {
  const current = formatShows(showsOf(shows, movie.id, chain, day))
  const [text, setText] = useState(current)
  return (
    <label className="block">
      <span className="text-sm font-bold">{movie.title || 'Sin título'}</span>
      <input
        className={`${input} mt-1`}
        placeholder="14:30, 17:00 3D, 20:15 VIP SUB"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          onChange(text)
          setText(formatShows(parseShows(text)))
        }}
      />
    </label>
  )
}

/** Para probar sin cargar nada a mano: un ejemplo completo (películas inventadas, 4 carteles y una semana de funciones) y volver a vaciar. */
function ExampleTools() {
  const movies = useCine((s) => s.movies)
  const shows = useCine((s) => s.shows)
  const set = useCine((s) => s.set)
  const toast = useUI((s) => s.toast)
  return (
    <div className="space-y-2 rounded-2xl bg-sand p-3">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Sparkles className="size-4" /> Probar con un ejemplo
      </p>
      <p className="text-xs text-ink-soft">Carga 6 películas inventadas con horarios en las tres cadenas durante toda la semana, y pone sus títulos en los 4 carteles. Reemplaza lo que haya en el catálogo y las funciones. Cuando termines de probar, bórralo.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn.secondary}
          onClick={() => {
            if ((movies.length || shows.length) && !window.confirm('Esto reemplaza el catálogo, las funciones y los carteles actuales por el ejemplo. ¿Continuar?')) return
            set(exampleCine())
            toast('Ejemplo cargado: ya puedes probar el cine.', 'success')
          }}
        >
          <Sparkles className="size-4" /> Cargar ejemplo
        </button>
        <button
          type="button"
          className={btn.ghost}
          disabled={!movies.length && !shows.length}
          onClick={() => {
            if (!window.confirm('Esto borra todas las películas y funciones del catálogo (los carteles no se tocan). ¿Continuar?')) return
            set({ movies: [], shows: [] })
            toast('Catálogo y funciones borrados.', 'success')
          }}
        >
          <Trash2 className="size-4" /> Borrar películas y funciones
        </button>
      </div>
    </div>
  )
}

/** Funciones: por día y por cadena, las horas de cada película del catálogo. */
function ShowsAdmin() {
  const movies = useCine((s) => s.movies)
  const shows = useCine((s) => s.shows)
  const chains = useCine((s) => s.chains)
  const set = useCine((s) => s.set)
  const toast = useUI((s) => s.toast)
  const days = nextDays()
  const [day, setDay] = useState(days[0])
  const [chain, setChain] = useState<ChainId>(CHAINS[0].id)
  const count = (c: ChainId, d: string) => shows.filter((x) => x.chain === c && x.day === d).length
  const info = CHAINS.find((c) => c.id === chain)!
  return (
    <div className="space-y-3">
      <div>
        <p className="font-bold">Funciones por día y cadena</p>
        <p className="text-xs text-ink-soft">Escribe las horas de cada película separadas por comas. Si aplica, agrega el formato (2D, 3D, VIP) y el idioma (DOB doblada, SUB subtitulada): 14:30, 17:00 3D, 20:15 VIP SUB.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Día">
        {days.map((d) => (
          <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${day === d ? 'border-brand bg-brand text-white' : 'border-line bg-card'}`}>
            {dayLabel(d)}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Cadena">
        {CHAINS.map((c) => (
          <button key={c.id} type="button" aria-pressed={chain === c.id} onClick={() => setChain(c.id)} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${chain === c.id ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>
            <span className="size-2.5 rounded-full" style={{ background: c.color }} /> {c.name}
            <span className="opacity-60">{count(c.id, day)}</span>
          </button>
        ))}
      </div>
      {!chains.find((c) => c.id === chain)?.enabled && <p className="rounded-xl bg-amber/20 p-2 text-xs">Esta cadena está oculta: sus funciones no se ven en el cine.</p>}
      {movies.length === 0 ? (
        <p className="rounded-2xl bg-sand p-3 text-sm text-ink-soft">Primero agrega películas al catálogo (arriba).</p>
      ) : (
        <div className="space-y-3">
          {movies.map((m) => (
            <ShowsInput key={`${m.id}|${chain}|${day}`} movie={m} chain={chain} day={day} shows={shows} onChange={(text) => set({ shows: withShows(shows, m.id, chain, day, text) })} />
          ))}
          <button
            type="button"
            className={btn.secondary}
            disabled={count(chain, day) === 0}
            onClick={() => {
              set({ shows: repeatWeek(shows, chain, day, days) })
              toast(`${info.name}: las funciones de ${dayLabel(day).toLowerCase()} se repitieron en los demás días.`, 'success')
            }}
          >
            <Copy className="size-4" /> Repetir {dayLabel(day).toLowerCase()} en toda la semana
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
  const movies = useCine((s) => s.movies)
  const shows = useCine((s) => s.shows)
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

      <div className="space-y-4 rounded-3xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">2 · Entrar al cine</p>
            <p className="text-xs text-ink-soft">Al tocar el cine se abren las puertas: el visitante elige el día y ve cada película con sus horarios en cada cadena (o entra por cine). Más adelante vendrán de una API en tiempo real; por ahora se cargan aquí.</p>
          </div>
          <Switch on={lobbyOn} label="Habilitar la entrada al cine" onChange={(v) => set({ lobbyOn: v })} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold">Cadenas</p>
          {chains.map((c) => {
            const meta = CHAINS.find((x) => x.id === c.id)!
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span className="size-3 rounded-full" style={{ background: meta.color }} /> {meta.name}
                  <span className="text-xs font-normal text-ink-soft">{c.enabled ? 'visible' : 'oculta'}</span>
                </span>
                <Switch on={c.enabled} label={`Mostrar ${meta.name}`} onChange={(enabled) => set({ chains: chains.map((x) => (x.id === c.id ? { ...x, enabled } : x)) })} />
              </div>
            )
          })}
        </div>

        <ExampleTools />

        <div className="space-y-3">
          <div>
            <p className="font-bold">Catálogo de películas</p>
            <p className="text-xs text-ink-soft">Cada película se carga una sola vez; sus horarios se ponen por cadena más abajo ({movies.length}/{MAX_MOVIES}).</p>
          </div>
          {movies.map((m, i) => (
            <MovieEditor
              key={m.id}
              movie={m}
              onChange={(next) => set({ movies: movies.map((x, k) => (k === i ? next : x)) })}
              onRemove={() => set({ movies: movies.filter((_, k) => k !== i), shows: shows.filter((x) => x.movieId !== m.id) })}
            />
          ))}
          <button type="button" className={btn.secondary} disabled={movies.length >= MAX_MOVIES} onClick={() => set({ movies: [...movies, newMovie()] })}>
            <Plus className="size-4" /> Agregar película
          </button>
        </div>

        <ShowsAdmin />
      </div>
    </div>
  )
}
