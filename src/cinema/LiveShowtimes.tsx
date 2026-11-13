import { ExternalLink, RefreshCw, Ticket } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { dayLabel } from '../state/cine'
import { CinemaApiError, cinemaDays, fetchShowtimes, type ProviderBlock, type ProviderId, type ShowtimesResponse } from './api'
import { applyFilters, facets, groupByMovie, listRows, updatedAgo, type Filters } from './filters'
import { OFFICIAL_CINEMAS } from './official'

// «Salas de Cartagena»: los horarios de las salas de cine de la ciudad, de todas las cadenas, para ver rápido qué hay y
// comprar en el sitio oficial. Solo habla con el endpoint propio (cinema-showtimes); la compra siempre abre el sitio oficial
// de la cadena en una pestaña nueva. Sin datos de una cadena, se dice y se deja el enlace a su cartelera oficial.

const GOLD = '#f3c969'
const COLORS: Record<ProviderId, string> = { cinecolombia: '#d7263d', procinal: '#0f9d8a', royalfilms: '#8a5cf6' }
/** Cada cuánto se vuelve a pedir (el servidor tiene su propia caché; esto solo mantiene la pantalla al día). */
const REFRESH_MS = 5 * 60_000

type State = { kind: 'loading' } | { kind: 'ok'; day: string; data: ShowtimesResponse } | { kind: 'error'; message: string }

const external = 'noopener noreferrer'

function OfficialLinks({ only }: { only?: ProviderId[] }) {
  const list = OFFICIAL_CINEMAS.filter((c) => !only || only.includes(c.id))
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {list.map((c) => (
        <a key={c.id} href={c.url} target="_blank" rel={external} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-bold transition active:scale-95">
          <span className="size-2 rounded-full" style={{ background: COLORS[c.id] }} /> Cartelera de {c.name} <ExternalLink className="size-3.5 opacity-70" aria-hidden />
        </a>
      ))}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true" aria-label="Cargando horarios">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex animate-pulse gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
          <div className="aspect-[2/3] w-20 shrink-0 rounded-md bg-white/10" />
          <div className="flex-1 space-y-2.5 pt-1">
            <div className="h-4 w-2/3 rounded bg-white/10" />
            <div className="h-3 w-1/3 rounded bg-white/10" />
            <div className="flex gap-2 pt-2">
              {[0, 1, 2].map((k) => (
                <div key={k} className="h-7 w-16 rounded-full bg-white/10" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T | undefined; options: { id: T; label: string; color?: string }[]; onChange: (v: T | undefined) => void }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={label}>
      <span className="shrink-0 text-[11px] font-bold tracking-wider text-white/45 uppercase">{label}</span>
      <button onClick={() => onChange(undefined)} aria-pressed={!value} className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition ${!value ? 'bg-white text-black' : 'bg-white/10 text-white/80'}`}>
        Todos
      </button>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition ${value === o.id ? 'bg-white text-black' : 'bg-white/10 text-white/80'}`}>
          {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} />} {o.label}
        </button>
      ))}
    </div>
  )
}

/** Aviso de una cadena sin datos (o con datos algo viejos), con su enlace oficial. */
function ProviderNotice({ p, now }: { p: ProviderBlock; now: Date }) {
  const stale = p.status === 'partial'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
      <p className="flex items-center gap-2 text-[14px] font-extrabold">
        <span className="size-2.5 rounded-full" style={{ background: COLORS[p.id] }} /> {p.name}
      </p>
      <p className="mt-1 text-[13px] text-white/70">
        {p.message ?? 'Horarios no disponibles temporalmente'}
        {stale && p.lastUpdatedAt ? ` · ${updatedAgo(p.lastUpdatedAt, now)?.toLowerCase()}` : ''}
      </p>
      {!stale && (
        <a href={p.officialUrl} target="_blank" rel={external} className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-bold transition active:scale-95">
          Ver cartelera oficial de {p.name} <ExternalLink className="size-3.5 opacity-70" aria-hidden />
        </a>
      )}
    </div>
  )
}

export function LiveShowtimes() {
  const days = useMemo(() => cinemaDays(), [])
  const [day, setDay] = useState(days[0])
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [filters, setFilters] = useState<Filters>({})
  const [clock, setClock] = useState(() => new Date())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ctl = new AbortController()
    // al refrescar el mismo día se conservan los datos que ya se ven (sin parpadeo)
    setState((s) => (s.kind === 'ok' && s.day === day ? s : { kind: 'loading' }))
    fetchShowtimes(day, { signal: ctl.signal })
      .then((data) => setState({ kind: 'ok', day, data }))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setState((s) => (s.kind === 'ok' && s.day === day ? s : { kind: 'error', message: e instanceof CinemaApiError ? e.message : 'No pudimos consultar la cartelera. Intenta de nuevo en unos minutos.' }))
      })
    return () => ctl.abort()
  }, [day, tick])

  useEffect(() => {
    const refresh = window.setInterval(() => setTick((n) => n + 1), REFRESH_MS)
    const minute = window.setInterval(() => setClock(new Date()), 60_000)
    return () => {
      clearInterval(refresh)
      clearInterval(minute)
    }
  }, [])

  const data = state.kind === 'ok' ? state.data : null
  const rows = useMemo(() => (data ? listRows(data) : []), [data])
  const { formats, languages } = useMemo(() => facets(rows), [rows])
  const groups = useMemo(() => groupByMovie(applyFilters(rows, filters)), [rows, filters])
  const filtering = !!(filters.provider || filters.format || filters.language)
  const withData = data?.providers.filter((p) => p.status !== 'unavailable') ?? []
  const noData = data?.providers.filter((p) => p.status === 'unavailable') ?? []
  const partial = data?.providers.filter((p) => p.status === 'partial') ?? []
  const lastUpdate = data ? data.providers.map((p) => p.lastUpdatedAt).filter((x): x is string => !!x).sort().pop() ?? null : null

  return (
    <section aria-label="Horarios de las salas de cine de Cartagena" className="mt-1">
      <div className="flex items-start justify-between gap-3 pr-12">
        <div>
          <h3 className="text-[20px] font-black tracking-tight">Cine en Cartagena</h3>
          <p className="mt-0.5 text-[12px] text-white/55">{lastUpdate ? updatedAgo(lastUpdate, clock) : 'Horarios de las salas de la ciudad'}</p>
        </div>
        <button onClick={() => setTick((n) => n + 1)} aria-label="Actualizar horarios" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 transition active:scale-95">
          <RefreshCw className={`size-4 ${state.kind === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Día">
        {days.map((d) => (
          <button key={d} onClick={() => setDay(d)} aria-pressed={day === d} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold capitalize transition ${day === d ? 'bg-white text-black' : 'bg-white/10 text-white/80'}`}>
            {dayLabel(d, days[0])}
          </button>
        ))}
      </div>

      {state.kind === 'loading' && <Skeleton />}

      {state.kind === 'error' && (
        <div className="mt-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
          <p className="text-[14px] font-bold">{state.message}</p>
          <p className="mt-1 text-[12px] text-white/55">Mientras tanto, puedes ver la cartelera en el sitio de cada cine:</p>
          <OfficialLinks />
          <button onClick={() => setTick((n) => n + 1)} className="mt-3 rounded-full px-4 py-2 text-[13px] font-extrabold text-[#2a1405]" style={{ background: GOLD }}>
            Reintentar
          </button>
        </div>
      )}

      {data && (
        <>
          {withData.length > 0 && (
            <div className="mt-3 space-y-1">
              <Pills label="Cine" value={filters.provider} options={withData.map((p) => ({ id: p.id, label: p.name, color: COLORS[p.id] }))} onChange={(provider) => setFilters({ ...filters, provider })} />
              {formats.length > 0 && <Pills label="Formato" value={filters.format} options={formats.map((f) => ({ id: f, label: f }))} onChange={(format) => setFilters({ ...filters, format })} />}
              {languages.length > 0 && <Pills label="Idioma" value={filters.language} options={languages.map((l) => ({ id: l, label: l }))} onChange={(language) => setFilters({ ...filters, language })} />}
            </div>
          )}

          {withData.length === 0 && (
            <div className="mt-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
              <p className="text-[15px] font-extrabold">Horarios no disponibles temporalmente</p>
              <p className="mt-1 text-[13px] text-white/65">Aún no podemos mostrar los horarios de las salas de Cartagena aquí. Consúltalos y compra directamente en el sitio oficial de cada cine:</p>
              <OfficialLinks />
            </div>
          )}

          {withData.length > 0 && groups.length === 0 && (
            <div className="mt-4 rounded-2xl bg-white/[0.06] p-4 text-center ring-1 ring-white/10">
              <p className="text-[14px] font-bold">{filtering ? 'No hay funciones con estos filtros.' : 'No hay funciones para este día.'}</p>
              <p className="mt-1 text-[12px] text-white/55">{filtering ? 'Prueba quitando algún filtro o eligiendo otro día.' : 'Prueba con otro día.'}</p>
              {filtering && (
                <button onClick={() => setFilters({})} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-[13px] font-bold">
                  Quitar filtros
                </button>
              )}
            </div>
          )}

          <ul className="mt-4 space-y-3">
            {groups.map((g) => (
              <li key={g.title} className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                <div className="flex gap-3">
                  {g.posterUrl && <img src={g.posterUrl} alt="" loading="lazy" className="aspect-[2/3] w-16 shrink-0 rounded-md object-cover ring-1 ring-white/15" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] leading-tight font-extrabold">{g.title}</p>
                    <p className="mt-0.5 text-[12px] text-white/55">{[g.durationMinutes ? `${g.durationMinutes} min` : '', g.rating ?? ''].filter(Boolean).join(' · ')}</p>
                    <div className="mt-2 space-y-3">
                      {g.venues.map((v) => (
                        <div key={`${v.provider.id}|${v.cinema.id}`}>
                          <p className="flex items-center gap-1.5 text-[12px] font-bold text-white/85">
                            <span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[v.provider.id] }} />
                            <span className="min-w-0">
                              {v.provider.name} · {v.cinema.name}
                              {v.cinema.address && <span className="font-normal text-white/45"> · {v.cinema.address}</span>}
                            </span>
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {v.showtimes.map((s) => (
                              <a
                                key={`${s.time}|${s.format}|${s.language}`}
                                href={s.bookingUrl}
                                target="_blank"
                                rel={external}
                                aria-label={`Comprar en ${v.provider.name}: ${s.time}${s.format ? `, ${s.format}` : ''}${s.language ? `, ${s.language}` : ''} (abre el sitio oficial en una pestaña nueva)`}
                                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold text-white transition active:scale-95"
                                style={{ background: `color-mix(in srgb, ${COLORS[v.provider.id]} 70%, #000)` }}
                              >
                                {s.time}
                                {(s.format || s.language) && <span className="text-[10px] font-extrabold opacity-80">{[s.format, s.language].filter(Boolean).join(' · ')}</span>}
                                <ExternalLink className="size-3 opacity-70" aria-hidden />
                              </a>
                            ))}
                          </div>
                          <a href={v.showtimes[0]?.bookingUrl ?? v.provider.officialUrl} target="_blank" rel={external} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: GOLD }}>
                            <Ticket className="size-3.5" aria-hidden /> Comprar en {v.provider.name}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {(noData.length > 0 || partial.length > 0) && withData.length > 0 && (
            <div className="mt-4 space-y-2">
              {[...noData, ...partial].map((p) => (
                <ProviderNotice key={p.id} p={p} now={clock} />
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-5 text-center text-[11px] text-white/45">Horarios sujetos a cambios. Verifica la compra en el sitio oficial.</p>
    </section>
  )
}
