import { Clapperboard, Copy, Download, Eye, EyeOff, ImagePlus, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { EventCard } from '../cinema/Events'
import { useCineUi } from '../state/cineUi'
import { readImageFile } from '../lib/image'
import { remoteEnabled } from '../remote/client'
import { runCineSync } from '../remote/sync'
import { uploadStadiumImage } from '../remote/photos'
import { parseTrailer } from '../cinema/trailer'
import { CHAINS, isoDay, EVENT_KINDS, EVENT_STATUS, MAX_EVENTS, MAX_MOVIES, newEvent, type CineEvent, type CineEventKind, type CineEventStatus, OFFICIAL_HOSTS, isOfficialLink, dayLabel, formatShows, newMovie, nextDays, parseShows, repeatWeek, showsOf, useCine, withShows, type CineChain, type CineMovie, type CineShow, type ChainId, type ChainMode } from '../state/cine'
import { CINE_COLOMBIA_SNAPSHOT, CINE_COLOMBIA_SNAPSHOT_DATE } from '../cinema/cineColombiaSnapshot'
import { importMovies, parseMovieList } from '../state/cineImport'
import { exampleCine } from '../state/cineExample'
import { useCineFeed } from '../state/cineFeed'
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

/** Enlace oficial de una película en una cadena: solo se acepta https de los dominios oficiales de esa cadena. */
function LinkInput({ chain, name, value, onChange }: { chain: ChainId; name: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  const bad = text.trim() !== '' && !isOfficialLink(chain, text)
  return (
    <label className="block">
      <span className="text-[11px] font-bold">{name}</span>
      <input
        className={`${input} mt-0.5 ${bad ? 'border-red-400' : ''}`}
        inputMode="url"
        placeholder={`https://… (sitio de ${name})`}
        value={text}
        aria-invalid={bad}
        onChange={(e) => {
          setText(e.target.value)
          // solo se guarda lo válido (o vacío, para quitarlo)
          if (!e.target.value.trim() || isOfficialLink(chain, e.target.value)) onChange(e.target.value.trim())
        }}
      />
      {bad && <span className="text-[11px] text-red-600">Debe ser un enlace https de {OFFICIAL_HOSTS[chain][0]}.</span>}
    </label>
  )
}

/** Tráiler oficial: solo enlaces de YouTube o Vimeo; solo se guarda si es válido (o vacío, para quitarlo). */
function TrailerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  const bad = text.trim() !== '' && !parseTrailer(text)
  return (
    <label className="block">
      <input
        className={`${input} ${bad ? 'border-red-400' : ''}`}
        inputMode="url"
        placeholder="Tráiler (YouTube o Vimeo)"
        value={text}
        aria-invalid={bad}
        onChange={(e) => {
          setText(e.target.value)
          if (!e.target.value.trim() || parseTrailer(e.target.value)) onChange(e.target.value.trim())
        }}
      />
      {bad && <span className="text-[11px] text-red-600">Pega un enlace https de YouTube o Vimeo.</span>}
    </label>
  )
}

const FIELD_LABEL = 'mb-1 block text-[12px] font-bold text-ink-soft'

/** Campo con su nombre siempre visible (en el celular los placeholders desaparecen al escribir y no se sabe qué es cada casilla). */
function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={FIELD_LABEL}>{label}</span>
      {children}
    </label>
  )
}

/** Imagen de portada del evento en proporción 16:9: es la que ven los clientes arriba de la tarjeta. */
function EventCover({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
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
    <div>
      <span className={FIELD_LABEL}>Imagen del evento (16:9)</span>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-line bg-sand md:max-w-sm">
        {value ? <img src={value} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-ink-soft"><span className="flex flex-col items-center gap-1 text-xs font-semibold"><ImagePlus className="size-6" /> Sin imagen</span></div>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? 'Subiendo…' : value ? 'Cambiar imagen' : 'Subir imagen'}
        </button>
        {value && (
          <button type="button" className={btn.ghost} onClick={() => onChange(null)}>
            <X className="size-4" /> Quitar
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f) }} />
    </div>
  )
}

/**
 * Un evento de MallPlay Cinema. Arriba dice si los clientes lo ven; abajo, la vista previa EXACTA de la tarjeta que verán (la misma
 * pieza del cine). Un evento solo se oculta si está en «Borrador» o no tiene nombre.
 */
function EventEditor({ event, movies, onChange, onRemove }: { event: CineEvent; movies: CineMovie[]; onChange: (e: CineEvent) => void; onRemove: () => void }) {
  const [url, setUrl] = useState(event.url)
  const [open, setOpen] = useState(true)
  const badUrl = url.trim() !== '' && !/^https:\/\/[^\s]+$/.test(url.trim())
  const hidden = event.status === 'draft' || !event.title.trim()
  const kind = EVENT_KINDS.find((k) => k.id === event.kind)
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-sand/50">
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${hidden ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
            {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {hidden ? (event.title.trim() ? 'Oculto · borrador' : 'Oculto · falta el nombre') : 'Visible para clientes'}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <button type="button" className={btn.ghost} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {open ? 'Cerrar' : 'Editar'}
            </button>
            <button type="button" className={btn.ghost} onClick={onRemove} aria-label="Quitar evento">
              <Trash2 className="size-4" />
            </button>
          </span>
        </div>
        <p className="mt-1.5 truncate text-[15px] font-extrabold">{event.title.trim() || 'Evento sin nombre'}</p>
      </div>

      {hidden && event.status === 'draft' && event.title.trim() && (
        <div className="mx-3 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-[12.5px] text-amber-900">
          <span>Está en borrador: los clientes no lo ven.</span>
          <button type="button" className={btn.primary} onClick={() => onChange({ ...event, status: 'soon' })}>
            Publicar como «Próximamente»
          </button>
        </div>
      )}

      {open && (
        <div className="space-y-3 border-t border-line p-3">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
            <div className="space-y-3 max-md:order-2">
              <EventCover value={event.image} onChange={(image) => onChange({ ...event, image })} />
              <Field label="Nombre del evento">
                <input className={input} placeholder="Ej.: Noche de estreno en grupo" maxLength={80} value={event.title} onChange={(e) => onChange({ ...event, title: e.target.value })} />
              </Field>
              <Field label="Descripción breve">
                <textarea className={`${input} min-h-20`} placeholder="Qué se hace, para quién y qué incluye" maxLength={300} value={event.description} onChange={(e) => onChange({ ...event, description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de evento" className="col-span-2 sm:col-span-1">
                  <select className={input} value={event.kind} onChange={(e) => onChange({ ...event, kind: e.target.value as CineEventKind })}>
                    {EVENT_KINDS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado" className="col-span-2 sm:col-span-1">
                  <select className={input} value={event.status} onChange={(e) => onChange({ ...event, status: e.target.value as CineEventStatus })}>
                    {EVENT_STATUS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fecha">
                  <input type="date" className={input} value={event.date} onChange={(e) => onChange({ ...event, date: e.target.value })} />
                </Field>
                <Field label="Hora">
                  <input type="time" className={input} value={event.time} onChange={(e) => onChange({ ...event, time: e.target.value })} />
                </Field>
                <Field label="Modalidad" className="col-span-2 sm:col-span-1">
                  <select className={input} value={event.mode} onChange={(e) => onChange({ ...event, mode: e.target.value as CineEvent['mode'] })}>
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                    <option value="mixto">Presencial y virtual</option>
                  </select>
                </Field>
                <Field label="Lugar o plataforma" className="col-span-2 sm:col-span-1">
                  <input className={input} placeholder="Ej.: Cine Colombia, sala 3" maxLength={80} value={event.place} onChange={(e) => onChange({ ...event, place: e.target.value })} />
                </Field>
                <Field label="Cupos totales">
                  <input className={input} placeholder="Sin límite" inputMode="numeric" value={event.capacity ?? ''} onChange={(e) => onChange({ ...event, capacity: e.target.value.trim() ? Number(e.target.value.replace(/\D/g, '')) : null })} />
                </Field>
                <Field label="Cupos tomados">
                  <input className={input} placeholder="0" inputMode="numeric" value={event.taken ?? ''} onChange={(e) => onChange({ ...event, taken: e.target.value.trim() ? Number(e.target.value.replace(/\D/g, '')) : null })} />
                </Field>
              </div>
              <Field label="Película del plan (opcional)">
                <select className={input} value={event.movieId} onChange={(e) => onChange({ ...event, movieId: e.target.value })}>
                  <option value="">Sin película asociada</option>
                  {movies.filter((m) => m.title.trim()).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={event.kind === 'plan' ? 'Enlace del plan en Planly' : 'Enlace para participar (opcional)'}>
                <input
                  className={`${input} ${badUrl ? 'border-red-400' : ''}`}
                  inputMode="url"
                  placeholder="https://…"
                  value={url}
                  aria-invalid={badUrl}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    if (!e.target.value.trim() || /^https:\/\/[^\s]+$/.test(e.target.value.trim())) onChange({ ...event, url: e.target.value.trim() })
                  }}
                />
                {badUrl && <span className="text-[11px] text-red-600">Debe empezar por https://</span>}
                <span className="mt-1 block text-[11px] text-ink-soft">El botón para unirse solo aparece cuando el estado es «Abierto» y hay enlace.</span>
              </Field>
            </div>

            {/* vista previa: la tarjeta real del cine, sobre su mismo fondo oscuro */}
            <div className="max-md:order-1 md:sticky md:top-24">
              <span className={FIELD_LABEL}>Así lo ven los clientes{hidden ? ' (cuando lo publiques)' : ''}</span>
              <div className="rounded-2xl bg-[#081827] p-3 text-white">
                <EventCard e={{ ...event, title: event.title.trim() || 'Evento sin nombre' }} />
              </div>
              <p className="mt-1.5 text-[11px] text-ink-soft">{kind?.hint}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EventsAdmin() {
  const navigate = useNavigate()
  const events = useCine((s) => s.events)
  const movies = useCine((s) => s.movies)
  const set = useCine((s) => s.set)
  return (
    <div className="space-y-3 rounded-3xl border border-line bg-card p-4">
      <div>
        <p className="font-bold">3 · Eventos de MallPlay Cinema</p>
        <p className="text-xs text-ink-soft">
          Planes en grupo con Planly, noches de estreno, trivias, cine en pareja, maratones, encuentros y noches de tráileres. Para un <b>plan</b>, elige la película y pega el enlace de Planly: el botón «Unirme al plan en Planly» lleva ahí. Cada evento muestra abajo cómo lo ven los clientes. Un evento nuevo ya aparece como «Próximamente»; ponlo en «Borrador» para ocultarlo y en «Abierto» (con enlace) para recibir inscripciones. Los cambios se publican solos ({events.length}/{MAX_EVENTS}).
        </p>
      </div>
      {events.map((ev, i) => (
        <EventEditor key={ev.id} event={ev} movies={movies} onChange={(next) => set({ events: events.map((x, k) => (k === i ? next : x)) })} onRemove={() => set({ events: events.filter((_, k) => k !== i) })} />
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.primary} disabled={events.length >= MAX_EVENTS} onClick={() => set({ events: [...events, { ...newEvent(), kind: 'plan', title: 'Plan de cine con Planly' }] })}>
          <Plus className="size-4" /> Agregar plan (Planly)
        </button>
        <button type="button" className={btn.secondary} disabled={events.length >= MAX_EVENTS} onClick={() => set({ events: [...events, newEvent()] })}>
          <Plus className="size-4" /> Otro evento
        </button>
        <button
          type="button"
          className={btn.secondary}
          onClick={() => {
            // abre el cine en la pestaña «Eventos»: exactamente lo que verá un cliente
            navigate('/')
            window.setTimeout(() => {
              useCineUi.getState().setTab('events')
              useCineUi.getState().open('lobby')
            }, 500)
          }}
        >
          <Eye className="size-4" /> Ver en el cine
        </button>
      </div>
    </div>
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
      <Photo label="Imagen horizontal (opcional, 16:9: se ve en el encabezado)" value={movie.backdrop ?? null} onChange={(backdrop) => onChange({ ...movie, backdrop })} />
      <input className={input} placeholder="Título de la película" maxLength={120} value={movie.title} onChange={(e) => onChange({ ...movie, title: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="Año (2026)" inputMode="numeric" maxLength={4} value={movie.year ?? ''} onChange={(e) => onChange({ ...movie, year: Number(e.target.value.replace(/\D/g, '')) || null })} />
        <TrailerInput value={movie.trailer ?? ''} onChange={(trailer) => onChange({ ...movie, trailer })} />
      </div>
      <label className="block text-xs font-bold">
        Última revisión de esta ficha
        <input type="date" className={`${input} mt-0.5 font-normal`} value={movie.updatedAt ?? ''} onChange={(e) => onChange({ ...movie, updatedAt: e.target.value })} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <input className={input} placeholder="Género" maxLength={40} value={movie.genre} onChange={(e) => onChange({ ...movie, genre: e.target.value })} />
        <input className={input} placeholder="Minutos" inputMode="numeric" value={movie.minutes ?? ''} onChange={(e) => onChange({ ...movie, minutes: Number(e.target.value.replace(/\D/g, '')) || null })} />
        <input className={input} placeholder="Clasif. (12+)" maxLength={8} value={movie.rating} onChange={(e) => onChange({ ...movie, rating: e.target.value })} />
      </div>
      <textarea className={`${input} min-h-20`} placeholder="Sinopsis (se ve en la pantalla de la película)" maxLength={400} value={movie.synopsis} onChange={(e) => onChange({ ...movie, synopsis: e.target.value })} />
      <div className="space-y-2 rounded-xl border border-line p-2.5">
        <p className="text-xs font-bold">Enlaces oficiales de esta película (opcional)</p>
        <p className="text-[11px] text-ink-soft">Pega el enlace de la película en el sitio de cada cine: el botón «Ver horarios» lleva directo ahí. Sin enlace, lleva a la cartelera del cine en Cartagena.</p>
        {CHAINS.map((c) => (
          <LinkInput key={c.id} chain={c.id} name={c.name} value={movie.links[c.id] ?? ''} onChange={(v) => onChange({ ...movie, links: v ? { ...movie.links, [c.id]: v } : Object.fromEntries(Object.entries(movie.links).filter(([k]) => k !== c.id)) })} />
        ))}
      </div>
      <label className="block text-xs font-bold">
        Fecha de estreno (opcional)
        <input type="date" className={`${input} mt-0.5 font-normal`} value={movie.release} onChange={(e) => onChange({ ...movie, release: e.target.value })} />
        <span className="font-normal text-ink-soft">Antes de esa fecha la película va sola a «Pronto»; el día del estreno pasa a «Cartelera».</span>
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={movie.soon} onChange={(e) => onChange({ ...movie, soon: e.target.checked })} /> Próximamente (aún no está en cartelera: va a «Pronto»)
      </label>
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

/** «hace 5 min», «hace 2 h», «hace 3 días». */
function ago(iso: string | null): string {
  if (!iso) return 'nunca'
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  if (min < 1440) return `hace ${Math.round(min / 60)} h`
  return `hace ${Math.round(min / 1440)} días`
}

/** Interruptor Manual / Automático de una cadena y el estado de su última lectura. */
function ModeSwitch({ chain, onChange }: { chain: CineChain; onChange: (m: ChainMode) => void }) {
  const feed = useCineFeed((s) => s.doc?.chains[chain.id])
  const opt = (m: ChainMode, label: string) => (
    <button key={m} type="button" aria-pressed={chain.mode === m} onClick={() => onChange(m)} className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold ${chain.mode === m ? 'bg-ink text-white' : 'text-ink-soft'}`}>
      {label}
    </button>
  )
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1 rounded-full bg-sand p-1" role="group" aria-label="Cómo se llena la programación">
        {opt('manual', 'Manual')}
        {opt('auto', 'Automático')}
      </div>
      {chain.mode === 'auto' && (
        <p className={`text-[11px] ${feed?.ok ? 'text-emerald-700' : 'text-amber-800'}`}>
          {!feed ? 'Aún sin lecturas: toca «Sincronizar ahora».' : feed.ok ? `Leída ${ago(feed.at)} · ${feed.message}` : `${feed.message}${feed.at ? ` Últimos datos buenos: ${ago(feed.at)}.` : ''}`}
        </p>
      )}
    </div>
  )
}

/** Lectura automática: pide a la función `cine-sync` leer las cadenas ahora. */
function AutoTools() {
  const toast = useUI((s) => s.toast)
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-2 rounded-2xl bg-sand p-3">
      <p className="flex items-center gap-2 text-sm font-bold">
        <RefreshCw className="size-4" /> Programación automática
      </p>
      <p className="text-xs text-ink-soft">Con una cadena en «Automático», sus funciones se leen de su sitio (solo Cartagena) y se actualizan solas; lo que cargues a mano para esa cadena queda guardado pero no se muestra. Si la lectura falla, se conservan los últimos datos buenos.</p>
      <button
        type="button"
        className={btn.secondary}
        disabled={busy || !remoteEnabled()}
        onClick={async () => {
          setBusy(true)
          try {
            const r = await runCineSync()
            const ok = r.chains.filter((c) => c.ok).length
            toast(`${ok} de ${r.chains.length} cadenas leídas.${r.chains.find((c) => !c.ok) ? ' ' + r.chains.find((c) => !c.ok)!.message : ''}`, ok === r.chains.length ? 'success' : 'error')
          } catch (e) {
            toast(e instanceof Error ? e.message : 'No se pudo sincronizar.', 'error')
          } finally {
            setBusy(false)
          }
        }}
      >
        <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} /> {busy ? 'Leyendo…' : 'Sincronizar ahora'}
      </button>
      {!remoteEnabled() && <p className="text-[11px] text-ink-soft">Necesita la base de datos conectada.</p>}
    </div>
  )
}

/** Carga rápida de películas: la cartelera de Cine Colombia de hoy, o una lista que se pega (JSON o líneas con «|»). */
function ImportTools() {
  const movies = useCine((s) => s.movies)
  const set = useCine((s) => s.set)
  const toast = useUI((s) => s.toast)
  const [text, setText] = useState('')
  const run = (items: Partial<CineMovie>[], errors: string[] = []) => {
    const r = importMovies(movies, items)
    set({ movies: r.movies })
    const all = [...errors, ...r.errors]
    toast(`${r.added} nuevas, ${r.updated} actualizadas${r.skipped ? `, ${r.skipped} omitidas` : ''}.${all.length ? ' ' + all[0] : ''}`, r.added + r.updated > 0 && !all.length ? 'success' : 'error')
    return r
  }
  return (
    <div className="space-y-2 rounded-2xl bg-sand p-3">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Download className="size-4" /> Cargar películas reales
      </p>
      <p className="text-xs text-ink-soft">
        Con un toque se cargan las películas que Cine Colombia tiene hoy en cartelera y preventa en Cartagena ({CINE_COLOMBIA_SNAPSHOT.length}), con título, géneros, duración, clasificación, estreno, sinopsis y enlace oficial. Sin carteles: súbelos en cada película. Las que ya tengas se completan sin borrar lo que escribiste. Es una foto del {CINE_COLOMBIA_SNAPSHOT_DATE}.
      </p>
      <button type="button" className={btn.secondary} onClick={() => run(CINE_COLOMBIA_SNAPSHOT)}>
        <Download className="size-4" /> Cargar cartelera de Cine Colombia
      </button>
      <details className="rounded-xl border border-line p-2">
        <summary className="cursor-pointer text-xs font-bold">Pegar una lista de películas</summary>
        <p className="mt-2 text-[11px] text-ink-soft">Una por línea: <code>Título | Género | Minutos | Clasificación | Estreno (sí/no) | Fecha AAAA-MM-DD | Enlace Cine Colombia | Enlace Royal Films | Enlace Procinal</code>. Solo el título es obligatorio. También acepta una lista JSON.</p>
        <textarea className={`${input} mt-2 min-h-28 font-mono text-xs`} placeholder={'Avengers: Doomsday | Acción | 166 | 12+ | no | 2026-12-17'} value={text} onChange={(e) => setText(e.target.value)} />
        <button
          type="button"
          className={`${btn.secondary} mt-2`}
          disabled={!text.trim()}
          onClick={() => {
            const p = parseMovieList(text)
            if (!p.items.length) return toast(p.errors[0] ?? 'No encontré películas en el texto.', 'error')
            run(p.items, p.errors)
            setText('')
          }}
        >
          Importar
        </button>
      </details>
    </div>
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
      {chains.find((c) => c.id === chain)?.mode === 'auto' ? (
        <p className="rounded-2xl bg-sand p-3 text-sm text-ink-soft">{info.name} está en «Automático»: sus funciones se leen de su sitio. Cámbiala a «Manual» (arriba, en Cadenas) para cargarlas aquí.</p>
      ) : movies.length === 0 ? (
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
/** Película que aún no se estrena: marcada «Próximamente» o con fecha de estreno futura (igual que en el cine). */
const upcoming = (m: CineMovie) => m.soon || (!!m.release && m.release > isoDay(new Date()))

export function CineAdmin() {
  const on = useCine((s) => s.enabled)
  const boardOn = useCine((s) => s.boardOn)
  const lobbyOn = useCine((s) => s.lobbyOn)
  const posters = useCine((s) => s.posters)
  const chains = useCine((s) => s.chains)
  const movies = useCine((s) => s.movies)
  const shows = useCine((s) => s.shows)
  const demo = useCine((s) => s.demo)
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
            <TrailerInput value={p.trailer ?? ''} onChange={(trailer) => set({ posters: posters.map((x, k) => (k === i ? { ...x, trailer } : x)) as typeof posters })} />
            <textarea className={`${input} min-h-20`} placeholder="Sinopsis (se ve en la ficha de la película)" maxLength={400} value={p.synopsis ?? ''} onChange={(e) => set({ posters: posters.map((x, k) => (k === i ? { ...x, synopsis: e.target.value } : x)) as typeof posters })} />
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

        <div className="flex items-start justify-between gap-3 rounded-2xl bg-sand p-3">
          <div>
            <p className="text-sm font-bold">Mostrar el ejemplo mientras no haya datos</p>
            <p className="text-xs text-ink-soft">Si no cargas películas (ni hay lectura automática), el cine y la cartelera muestran la programación de ejemplo con un aviso. Se apaga solo cuando cargas datos reales; apágalo aquí para no mostrar nada.</p>
          </div>
          <Switch on={demo} label="Mostrar el ejemplo mientras no haya datos" onChange={(v) => set({ demo: v })} />
        </div>

        <AutoTools />

        <div className="space-y-2">
          <p className="text-sm font-bold">Cadenas</p>
          {chains.map((c) => {
            const meta = CHAINS.find((x) => x.id === c.id)!
            return (
              <div key={c.id} className="rounded-2xl border border-line px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className="size-3 rounded-full" style={{ background: meta.color }} /> {meta.name}
                    <span className="text-xs font-normal text-ink-soft">{c.enabled ? 'visible' : 'oculta'}</span>
                  </span>
                  <Switch on={c.enabled} label={`Mostrar ${meta.name}`} onChange={(enabled) => set({ chains: chains.map((x) => (x.id === c.id ? { ...x, enabled } : x)) })} />
                </div>
                <ModeSwitch chain={c} onChange={(mode) => set({ chains: chains.map((x) => (x.id === c.id ? { ...x, mode } : x)) })} />
              </div>
            )
          })}
        </div>

        <ImportTools />

        <ExampleTools />

        <div className="space-y-4">
          <div>
            <p className="font-bold">Catálogo de películas</p>
            <p className="text-xs text-ink-soft">Cada película se carga una sola vez, con su sinopsis y su tráiler; sus horarios se ponen por cadena más abajo ({movies.length}/{MAX_MOVIES}). Las que marques «Próximamente» salen en esa pestaña del cine.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.secondary} disabled={movies.length >= MAX_MOVIES} onClick={() => set({ movies: [...movies, newMovie()] })}>
              <Plus className="size-4" /> Película en cartelera
            </button>
            <button type="button" className={btn.primary} disabled={movies.length >= MAX_MOVIES} onClick={() => set({ movies: [...movies, { ...newMovie(), soon: true }] })}>
              <Plus className="size-4" /> Próximamente
            </button>
          </div>
          {([
            ['En cartelera', (m: CineMovie) => !upcoming(m)],
            ['Próximamente', upcoming],
          ] as const).map(([title, pick]) => {
            const group = movies.map((m, i) => ({ m, i })).filter(({ m }) => pick(m))
            return (
              <div key={title} className="space-y-2">
                <p className="text-sm font-extrabold">
                  {title} <span className="font-semibold text-ink-soft">({group.length})</span>
                </p>
                {group.length === 0 && <p className="rounded-xl bg-sand/60 p-3 text-xs text-ink-soft">Aún no hay películas aquí.</p>}
                {group.map(({ m, i }) => (
                  <details key={m.id} className="group rounded-2xl border border-line bg-white" open={!m.title}>
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{m.title || 'Película nueva'}</span>
                      {!m.synopsis.trim() && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">Falta sinopsis</span>}
                      {!parseTrailer(m.trailer) && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">Falta tráiler</span>}
                      {m.release && <span className="shrink-0 text-[11px] text-ink-soft">{m.release}</span>}
                    </summary>
                    <div className="border-t border-line p-2">
                      <MovieEditor
                        movie={m}
                        onChange={(next) => set({ movies: movies.map((x, k) => (k === i ? next : x)) })}
                        onRemove={() => set({ movies: movies.filter((_, k) => k !== i), shows: shows.filter((x) => x.movieId !== m.id) })}
                      />
                    </div>
                  </details>
                ))}
              </div>
            )
          })}
        </div>

        <ShowsAdmin />
      </div>

      <EventsAdmin />
    </div>
  )
}
