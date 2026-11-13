import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ChevronDown, ChevronLeft, Clapperboard, Clock, Film, X } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { CHAINS, dayLabel, isoDay, nextDays, showsOf, useCine, DAYS_AHEAD, type CineChain, type CineMovie, type CineShow, type ChainId } from '../state/cine'
import { useCineUi } from '../state/cineUi'
import { useEffectiveCine, useEffectivePosters } from '../state/cineFeed'
import { LiveShowtimes } from '../cinema/LiveShowtimes'

// Las dos interacciones del cine. «Cartelera»: al tocar los carteles del frente se abre una vista tipo sala (cortinas,
// foco de luz) con los cuatro carteles. «Entrar al cine»: al tocar el edificio las puertas se abren y se ven las tres
// cadenas; al elegir una, sus películas con horarios. Lo que se ve lo carga la administración (pestaña Cine).

const EASE = [0.65, 0, 0.25, 1] as const
const GOLD = '#f3c969'
const VELVET = 'repeating-linear-gradient(90deg, #7a1020 0 16px, #5c0c18 16px 32px)'
const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Arte por defecto de un cartel sin imagen. */
function PosterArt({ title, hue = 0 }: { title?: string; hue?: number }) {
  const bg = ['linear-gradient(160deg,#7a4bd6,#1b2247)', 'linear-gradient(160deg,#1f9d8f,#1b2247)', 'linear-gradient(160deg,#d6533f,#1b2247)', 'linear-gradient(160deg,#c9a24b,#1b2247)'][hue % 4]
  return (
    <div className="grid size-full place-items-center p-2 text-center text-white" style={{ background: bg }}>
      <div>
        <Film className="mx-auto size-8 opacity-80" />
        <p className="mt-2 text-[10.5px] leading-tight font-extrabold [overflow-wrap:anywhere]">{title || 'PRÓXIMO ESTRENO'}</p>
      </div>
    </div>
  )
}

function Poster({ image, title, hue }: { image: string | null; title?: string; hue?: number }) {
  return image ? <img src={image} alt={title || 'Cartel de película'} className="size-full object-cover" loading="lazy" draggable={false} /> : <PosterArt title={title} hue={hue} />
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])
}

/** Fila de bombillos dorados (marquesina). */
function Bulbs({ n = 14 }: { n?: number }) {
  return (
    <div className="flex justify-center gap-2.5" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="size-1.5 rounded-full" style={{ background: GOLD, boxShadow: `0 0 8px ${GOLD}`, opacity: i % 2 ? 0.55 : 1 }} />
      ))}
    </div>
  )
}

/** Escenario de sala: fondo oscuro, foco de luz y cortinas de terciopelo a los lados. */
function Theatre({ children, onClose, label, bare = false }: { children: React.ReactNode; onClose: () => void; label: string; bare?: boolean }) {
  const stage: CSSProperties = bare
    ? { background: 'radial-gradient(120% 40% at 50% 100%, rgba(30,120,80,0.22), transparent 70%), #050507' }
    : { background: 'radial-gradient(90% 55% at 50% 0%, rgba(255,214,150,0.32), transparent 62%), linear-gradient(180deg,#1b0f1d 0%,#0b0710 100%)' }
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[70] overflow-y-auto text-white"
      style={stage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {!bare && (
        <>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[7%] min-w-[18px] md:w-[11%]" style={{ background: VELVET, boxShadow: '12px 0 28px rgba(0,0,0,.55)' }} aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[7%] min-w-[18px] md:w-[11%]" style={{ background: VELVET, boxShadow: '-12px 0 28px rgba(0,0,0,.55)' }} aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-6" style={{ background: 'linear-gradient(#4a0a14,#7a1020)', boxShadow: '0 8px 20px rgba(0,0,0,.5)' }} aria-hidden />
        </>
      )}
      <button onClick={onClose} aria-label="Cerrar" className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition active:scale-95">
        <X className="size-5" />
      </button>
      <div className={bare ? 'relative mx-auto min-h-full w-full max-w-md' : 'relative mx-auto min-h-full w-full max-w-4xl px-[calc(9%+4px)] pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] md:px-[14%]'}>{children}</div>
    </motion.div>
  )
}

function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center">
      <Bulbs />
      <h2 className="mt-3 text-[28px] font-black tracking-[0.14em]" style={{ color: '#fff3c4', textShadow: `0 0 18px ${GOLD}, 0 0 4px #ff5fa8` }}>
        {children}
      </h2>
      {sub && <p className="mt-1 text-[13px] text-white/70">{sub}</p>}
    </div>
  )
}

// ── Interacción 1: la cartelera ───────────────────────────────────────────────────────────────────

function Board() {
  const posters = useEffectivePosters()
  const lobbyOn = useCine((s) => s.lobbyOn)
  const [zoom, setZoom] = useState<number | null>(null)
  const close = () => useCineUi.getState().close()
  useEscape(zoom === null, close)
  return (
    <Theatre onClose={close} label="Cartelera del cine">
      <Title sub="En cartelera">CARTELERA</Title>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
        {posters.map((p, i) => (
          <button key={i} onClick={() => setZoom(i)} className="group text-left" aria-label={`Ver el cartel ${p.title || i + 1}`}>
            <div className="aspect-[2/3] overflow-hidden rounded-md transition group-active:scale-[0.97]" style={{ boxShadow: `0 0 0 3px #1b2247, 0 0 0 5px ${GOLD}, 0 10px 28px rgba(0,0,0,.55)` }}>
              <Poster image={p.image} title={p.title} hue={i} />
            </div>
            <p className="mt-3 line-clamp-2 text-center text-[13px] font-bold leading-tight text-white/90">{p.title || 'Próximo estreno'}</p>
          </button>
        ))}
      </div>
      {lobbyOn && (
        <div className="mt-8 flex justify-center">
          <button onClick={() => useCineUi.getState().open('lobby')} className="flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold text-[#2a1405] shadow-lg transition active:scale-95" style={{ background: `linear-gradient(180deg,#ffe19a,${GOLD})` }}>
            <Clapperboard className="size-5" /> Entrar al cine
          </button>
        </div>
      )}
      <AnimatePresence>
        {zoom !== null && (
          <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)}>
            <motion.div className="w-full max-w-[min(78vw,340px)]" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
              <div className="aspect-[2/3] overflow-hidden rounded-lg" style={{ boxShadow: `0 0 0 4px ${GOLD}, 0 20px 50px rgba(0,0,0,.6)` }}>
                <Poster image={posters[zoom].image} title={posters[zoom].title} hue={zoom} />
              </div>
              <p className="mt-4 text-center text-lg font-extrabold">{posters[zoom].title || 'Próximo estreno'}</p>
              <p className="mt-1 text-center text-xs text-white/60">Toca para cerrar</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Theatre>
  )
}

// ── Interacción 2: entrar al cine ─────────────────────────────────────────────────────────────────

/** Puertas del cine: dos hojas de terciopelo con barra dorada que se abren hacia adentro. */
function Doors({ open }: { open: boolean }) {
  const dur = reduceMotion() ? 0 : 1.5
  const leaf = (side: 'l' | 'r'): CSSProperties => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side === 'l' ? 'left' : 'right']: 0,
    width: '50%',
    background: `${VELVET}, #5c0c18`,
    transformOrigin: side === 'l' ? 'left center' : 'right center',
    boxShadow: 'inset 0 0 40px rgba(0,0,0,.6)',
    borderRight: side === 'l' ? '3px solid #2a0508' : undefined,
    borderLeft: side === 'r' ? '3px solid #2a0508' : undefined,
  })
  return (
    <motion.div className="pointer-events-none fixed inset-0 z-20" style={{ perspective: 1500 }} initial={false} animate={{ opacity: open ? 0 : 1 }} transition={{ duration: 0.5, delay: open ? dur * 0.85 : 0 }} aria-hidden>
      {(['l', 'r'] as const).map((side) => (
        <motion.div key={side} style={leaf(side)} initial={false} animate={{ rotateY: open ? (side === 'l' ? -104 : 104) : 0 }} transition={{ duration: dur, ease: EASE }}>
          <span className="absolute top-1/2 h-24 w-2.5 -translate-y-1/2 rounded-full" style={{ [side === 'l' ? 'right' : 'left']: 14, background: `linear-gradient(90deg,#fbe39a,${GOLD},#b98a2c)`, boxShadow: '0 2px 6px rgba(0,0,0,.5)' }} />
          <span className="absolute inset-x-5 top-8 h-1/4 rounded-sm border border-white/10" />
          <span className="absolute inset-x-5 bottom-10 h-1/4 rounded-sm border border-white/10" />
        </motion.div>
      ))}
      <div className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 text-center">
        <p className="text-4xl font-black tracking-[0.3em]" style={{ color: '#fff3c4', textShadow: `0 0 22px ${GOLD}, 0 0 6px #ff5fa8` }}>
          CINE
        </p>
      </div>
    </motion.div>
  )
}

/** Hora «HH:MM» de ahora, para apagar las funciones que ya pasaron. */
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** Una función: la hora con su formato e idioma; apagada si ya pasó; con aro dorado si es la próxima. */
function ShowChip({ show, color, past, next }: { show: CineShow; color: string; past: boolean; next: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold text-white ${past ? 'line-through opacity-40' : ''}`}
      style={{ background: `color-mix(in srgb, ${color} 70%, #000)`, boxShadow: next ? `0 0 0 2px ${GOLD}` : undefined }}
      aria-label={`${show.time}${show.format ? `, ${show.format}` : ''}${show.lang === 'DOB' ? ', doblada' : show.lang === 'SUB' ? ', subtitulada' : ''}${past ? ', ya pasó' : next ? ', próxima función' : ''}`}
    >
      <Clock className="size-3" /> {show.time}
      {(show.format || show.lang) && <span className="text-[10px] font-extrabold opacity-80">{[show.format, show.lang].filter(Boolean).join(' ')}</span>}
    </span>
  )
}

/** «12+» → «Recomendada para mayores de 12 años». */
function ageText(rating: string) {
  const n = parseInt(rating, 10)
  return n > 0 ? `Recomendada para mayores de ${n} años` : rating ? `Clasificación: ${rating}` : ''
}

/** Aviso de que lo que se ve es de ejemplo (la programación real aún no está cargada). */
function DemoNote() {
  return (
    <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[12px] leading-snug text-amber-100">
      <strong>Programación de ejemplo.</strong> Las películas y horarios son de muestra; la cartelera real llegará pronto.
    </p>
  )
}

type Pick = ChainId | 'all'

/** Selector de cine (píldora con lista): cambia las cadenas cuyas funciones se ven. */
function CinemaPicker({ value, chains, onChange }: { value: Pick; chains: CineChain[]; onChange: (v: Pick) => void }) {
  const [open, setOpen] = useState(false)
  const cur = CHAINS.find((c) => c.id === value)
  const options: { id: Pick; name: string; color?: string }[] = [{ id: 'all', name: 'Todos los cines' }, ...chains.map((c) => ({ id: c.id as Pick, name: CHAINS.find((x) => x.id === c.id)!.name, color: CHAINS.find((x) => x.id === c.id)!.color }))]
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} className="flex items-center gap-2 rounded-full border border-white/25 bg-black/45 py-2 pr-3 pl-4 text-[14px] font-bold backdrop-blur transition active:scale-95">
        {cur && <span className="size-2.5 rounded-full" style={{ background: cur.color }} />}
        {cur?.name ?? 'Todos los cines'}
        <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul role="listbox" className="absolute left-1/2 z-30 mt-2 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-[#14141a]/95 p-1 shadow-2xl backdrop-blur">
          {options.map((o) => (
            <li key={o.id} role="option" aria-selected={o.id === value}>
              <button
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold ${o.id === value ? 'bg-white/12' : ''}`}
              >
                <span className="size-2.5 rounded-full" style={{ background: o.color ?? '#fff' }} /> {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Fondo de cartel a todo el ancho que se funde a negro por abajo. */
function Hero({ movie, className = '' }: { movie: CineMovie; className?: string }) {
  return (
    <div className={`absolute inset-0 ${className}`} aria-hidden>
      {movie.image ? <img src={movie.image} alt="" className="size-full object-cover" draggable={false} /> : <PosterArt title={movie.title} hue={movie.title.length} />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #050507 2%, rgba(5,5,7,.55) 38%, rgba(5,5,7,0) 62%), linear-gradient(to bottom, rgba(5,5,7,.55), rgba(5,5,7,0) 22%)' }} />
    </div>
  )
}

/** Inicio: película destacada a pantalla completa (se desliza), pestañas Cartelera / Pronto y la lista de carteles. */
function Home({ movies, shows, soon, pick, chains, demo, onPick, onOpen }: { movies: CineMovie[]; shows: CineShow[]; soon: CineMovie[]; pick: Pick; chains: CineChain[]; demo: boolean; onPick: (v: Pick) => void; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<'now' | 'soon' | 'live'>('now')
  const [slide, setSlide] = useState(0)
  const today = isoDay(new Date())
  const featured = movies.slice(0, 5)
  const list = tab === 'now' ? movies : soon
  const todayCount = (id: string) => shows.filter((x) => x.movieId === id && x.day === today).length
  const tabBtn = (t: 'now' | 'soon' | 'live', label: string) => (
    <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${tab === t ? 'bg-white text-black' : 'bg-white/10 text-white/80'}`}>
      {label}
    </button>
  )
  return (
    <div>
      {featured.length > 0 && (
        <section className="relative h-[68dvh] min-h-[420px]" aria-label="Destacadas">
          <div
            className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          >
            {featured.map((m) => (
              <article key={m.id} className="relative h-full min-w-full snap-center">
                <Hero movie={m} />
                <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
                  {m.isNew && <span className="rounded-md bg-white px-2.5 py-1 text-[12px] font-extrabold text-black">Estreno</span>}
                  <h2 className="mt-2 text-[34px] leading-[1.02] font-black tracking-tight uppercase">{m.title}</h2>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-white/80">{m.synopsis || [m.genre, m.minutes ? `${m.minutes} min` : '', m.rating].filter(Boolean).join(' · ')}</p>
                  <button onClick={() => onOpen(m.id)} className="mt-4 flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-extrabold text-[#2a1405] shadow-lg transition active:scale-95" style={{ background: `linear-gradient(180deg,#ffe19a,${GOLD})` }}>
                    Ver horarios <ArrowRight className="size-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="absolute inset-x-0 top-[max(0.9rem,env(safe-area-inset-top))] flex justify-center">
            <CinemaPicker value={pick} chains={chains} onChange={onPick} />
          </div>
          {featured.length > 1 && (
            <div className="pointer-events-none absolute inset-x-0 top-[calc(max(0.9rem,env(safe-area-inset-top))+3.4rem)] flex justify-center gap-1.5" aria-hidden>
              {featured.map((m, i) => (
                <span key={m.id} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`} />
              ))}
            </div>
          )}
        </section>
      )}
      {featured.length === 0 && (
        <div className="px-5 pt-[max(4rem,env(safe-area-inset-top))]">
          <div className="flex justify-center">
            <CinemaPicker value={pick} chains={chains} onChange={onPick} />
          </div>
        </div>
      )}
      <section className="px-5 pt-4 pb-10">
        {demo && tab !== 'live' && <div className="mb-3"><DemoNote /></div>}
        <div className="flex gap-2" role="group" aria-label="Ver">
          {tabBtn('now', 'Cartelera')}
          {tabBtn('soon', 'Pronto')}
          {tabBtn('live', 'Salas en Cartagena')}
        </div>
        {tab === 'live' ? (
          <div className="mt-4">
            <LiveShowtimes />
          </div>
        ) : list.length ? (
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
            {list.map((m) => (
              <li key={m.id}>
                <button onClick={() => onOpen(m.id)} className="block w-full text-left transition active:scale-[0.97]" aria-label={`Ver ${m.title}`}>
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl ring-1 ring-white/15">
                    <Poster image={m.image} title={m.title} hue={m.title.length} />
                    {m.isNew && <span className="absolute top-2 left-2 rounded-md bg-white px-2 py-0.5 text-[10px] font-extrabold text-black">Estreno</span>}
                    {tab === 'soon' && <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold">Pronto</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-[14px] leading-tight font-extrabold">{m.title}</p>
                  <p className="mt-0.5 text-[11px] text-white/55">{tab === 'now' ? (todayCount(m.id) ? `${todayCount(m.id)} funciones hoy` : 'Funciones próximos días') : [m.genre, m.rating].filter(Boolean).join(' · ')}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-2xl bg-white/[0.06] p-5 text-center text-sm text-white/70">{tab === 'now' ? 'Aún no hay funciones en este cine.' : 'No hay películas por estrenar por ahora.'}</p>
        )}
      </section>
    </div>
  )
}

/** Detalle: cartel grande, sinopsis, género y duración, fichas de fecha y las funciones de cada cine ese día. */
function Detail({ movie, shows, chains, pick, demo, onPick, onBack, now, days }: { movie: CineMovie; shows: CineShow[]; chains: CineChain[]; pick: Pick; demo: boolean; onPick: (v: Pick) => void; onBack: () => void; now: string; days: string[] }) {
  const [day, setDay] = useState(days[0])
  const today = day === days[0]
  const shown = chains.filter((c) => pick === 'all' || c.id === pick)
  const rows = shown.map((c) => ({ chain: c, info: CHAINS.find((x) => x.id === c.id)!, list: showsOf(shows, movie.id, c.id, day) }))
  const upcoming = today ? rows.flatMap((r) => r.list).filter((x) => x.time >= now).sort((x, y) => x.time.localeCompare(y.time))[0] : undefined
  const hasShows = (d: string) => shown.some((c) => showsOf(shows, movie.id, c.id, d).length > 0)
  const age = ageText(movie.rating)
  const pills: { id: Pick; label: string; color?: string }[] = [{ id: 'all', label: 'Todos' }, ...chains.map((c) => ({ id: c.id as Pick, label: CHAINS.find((x) => x.id === c.id)!.name, color: CHAINS.find((x) => x.id === c.id)!.color }))]
  return (
    <div>
      <section className="relative h-[52dvh] min-h-[340px]">
        <Hero movie={movie} />
        <button onClick={onBack} aria-label="Volver" className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 grid size-11 place-items-center rounded-full bg-black/55 backdrop-blur transition active:scale-95">
          <ChevronLeft className="size-5" />
        </button>
      </section>
      <section className="-mt-16 px-5 pb-12">
        <div className="relative">
          {movie.isNew && <span className="rounded-md bg-white px-2.5 py-1 text-[12px] font-extrabold text-black">Estreno</span>}
          <h2 className="mt-2 text-[32px] leading-[1.02] font-black tracking-tight uppercase">{movie.title}</h2>
          {movie.synopsis && <p className="mt-3 text-[13px] leading-relaxed text-white/75">{movie.synopsis}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-4 text-[15px]">
            <div>
              <dt className="text-[13px] text-white/50">Género</dt>
              <dd className="font-semibold">{movie.genre || '—'}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-white/50">Duración</dt>
              <dd className="font-semibold">{movie.minutes ? `${movie.minutes} min` : '—'}</dd>
            </div>
          </dl>
          {age && <p className="mt-3 text-[13px] text-white/55">{age}</p>}
          {demo && <div className="mt-4"><DemoNote /></div>}

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Día">
            {days.map((d, i) => {
              const [y, m, dd] = d.split('-').map(Number)
              const wk = i === 0 ? 'Hoy' : new Date(y, m - 1, dd).toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')
              return (
                <button key={d} onClick={() => setDay(d)} aria-pressed={day === d} aria-label={dayLabel(d, days[0])} className={`relative flex h-[76px] w-[62px] shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition ${day === d ? 'border-white bg-white/10' : 'border-white/10 bg-white/[0.06]'} ${hasShows(d) ? '' : 'opacity-45'}`}>
                  <span className="text-[13px] text-white/70 capitalize">{wk}</span>
                  <span className="text-[24px] leading-none font-bold">{dd}</span>
                  {hasShows(d) && <span className="absolute bottom-1.5 size-1 rounded-full" style={{ background: GOLD }} />}
                </button>
              )
            })}
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Cine">
            {pills.map((p) => (
              <button key={p.id} onClick={() => onPick(p.id)} aria-pressed={pick === p.id} className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold transition ${pick === p.id ? 'bg-white text-black' : 'bg-white/10 text-white/80'}`}>
                {p.color && <span className="size-2 rounded-full" style={{ background: p.color }} />} {p.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            {rows.map(({ chain, info, list }) => (
              <div key={chain.id} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <p className="flex items-center gap-2 text-[14px] font-extrabold">
                  <span className="size-2.5 rounded-full" style={{ background: info.color }} /> {info.name}
                  {chain.mode === 'auto' && (
                    <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> En vivo
                    </span>
                  )}
                </p>
                {list.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {list.map((x) => (
                      <ShowChip key={x.id} show={x} color={info.color} past={today && x.time < now} next={upcoming?.id === x.id} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-1.5 text-[12px] text-white/45">Sin funciones este día</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function Lobby() {
  const chains = useCine((s) => s.chains)
  const { movies, shows, demo } = useEffectiveCine()
  const [phase, setPhase] = useState<'closed' | 'open'>(reduceMotion() ? 'open' : 'closed')
  const [openId, setOpenId] = useState<string | null>(null)
  const [pick, setPick] = useState<Pick>('all')
  const [clock, setClock] = useState(() => new Date())
  const close = () => useCineUi.getState().close()
  useEscape(true, close)
  useEffect(() => {
    if (phase === 'open') return
    const t = window.setTimeout(() => setPhase('open'), 450)
    return () => clearTimeout(t)
  }, [phase])
  // el reloj corre cada minuto: las funciones que pasan se apagan solas
  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const days = nextDays(DAYS_AHEAD, clock)
  const visible = chains.filter((c) => c.enabled)
  const visibleIds = new Set(visible.map((c) => c.id))
  const shownIds = new Set(pick === 'all' ? visibleIds : [pick].filter((id) => visibleIds.has(id)))
  // si se oculta la cadena elegida, se vuelve a «todos»
  useEffect(() => {
    if (pick !== 'all' && !visibleIds.has(pick)) setPick('all')
  }, [pick, visibleIds])
  const inShown = shows.filter((x) => shownIds.has(x.chain))
  const playingIds = new Set(inShown.map((x) => x.movieId))
  const anyIds = new Set(shows.filter((x) => visibleIds.has(x.chain)).map((x) => x.movieId))
  // estrenos primero, luego por título
  const order = (a: CineMovie, b: CineMovie) => Number(b.isNew) - Number(a.isNew) || a.title.localeCompare(b.title)
  const nowPlaying = movies.filter((m) => playingIds.has(m.id)).sort(order)
  const soon = movies.filter((m) => !anyIds.has(m.id)).sort(order)
  const movie = movies.find((m) => m.id === openId)
  return (
    <Theatre onClose={close} label="Dentro del cine" bare>
      <Doors open={phase === 'open'} />
      <motion.div initial={false} animate={{ opacity: phase === 'open' ? 1 : 0, y: phase === 'open' ? 0 : 14 }} transition={{ duration: 0.6, delay: phase === 'open' && !reduceMotion() ? 1.1 : 0 }}>
        {visible.length === 0 ? (
          <p className="mx-5 mt-24 rounded-2xl bg-white/[0.06] p-5 text-center text-sm text-white/70">El cine está cerrado por ahora.</p>
        ) : movie ? (
          <Detail key={movie.id} movie={movie} shows={shows} chains={visible} pick={pick} demo={demo} onPick={setPick} onBack={() => setOpenId(null)} now={hhmm(clock)} days={days} />
        ) : (
          <Home movies={nowPlaying} shows={inShown} soon={soon} pick={pick} chains={visible} demo={demo} onPick={setPick} onOpen={setOpenId} />
        )}
      </motion.div>
    </Theatre>
  )
}

/** Monta la vista abierta del cine (si la administración dejó la interacción encendida). */
export function CineHost() {
  const view = useCineUi((s) => s.view)
  const boardOn = useCine((s) => s.boardOn)
  const lobbyOn = useCine((s) => s.lobbyOn)
  const enabled = useCine((s) => s.enabled)
  const shown = enabled && ((view === 'board' && boardOn) || (view === 'lobby' && lobbyOn)) ? view : null
  return <AnimatePresence mode="wait">{shown === 'board' ? <Board key="board" /> : shown === 'lobby' ? <Lobby key="lobby" /> : null}</AnimatePresence>
}
