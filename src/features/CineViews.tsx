import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, Clapperboard, Clock, Film, X } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { CHAINS, dayLabel, isoDay, nextDays, showsOf, useCine, DAYS_AHEAD, type CineChain, type CineMovie, type CineShow, type ChainId } from '../state/cine'
import { useCineUi } from '../state/cineUi'

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
function Theatre({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  const stage: CSSProperties = {
    background: 'radial-gradient(90% 55% at 50% 0%, rgba(255,214,150,0.32), transparent 62%), linear-gradient(180deg,#1b0f1d 0%,#0b0710 100%)',
  }
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
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[7%] min-w-[18px] md:w-[11%]" style={{ background: VELVET, boxShadow: '12px 0 28px rgba(0,0,0,.55)' }} aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[7%] min-w-[18px] md:w-[11%]" style={{ background: VELVET, boxShadow: '-12px 0 28px rgba(0,0,0,.55)' }} aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-6" style={{ background: 'linear-gradient(#4a0a14,#7a1020)', boxShadow: '0 8px 20px rgba(0,0,0,.5)' }} aria-hidden />
      <button onClick={onClose} aria-label="Cerrar" className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition active:scale-95">
        <X className="size-5" />
      </button>
      <div className="relative mx-auto min-h-full w-full max-w-4xl px-[calc(9%+4px)] pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] md:px-[14%]">{children}</div>
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
  const posters = useCine((s) => s.posters)
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
    <motion.div className="pointer-events-none absolute inset-0 z-20" style={{ perspective: 1500 }} initial={false} animate={{ opacity: open ? 0 : 1 }} transition={{ duration: 0.5, delay: open ? dur * 0.85 : 0 }} aria-hidden>
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
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold text-white ${past ? 'line-through opacity-40' : ''}`}
      style={{ background: `color-mix(in srgb, ${color} 70%, #000)`, boxShadow: next ? `0 0 0 2px ${GOLD}` : undefined }}
      aria-label={`${show.time}${show.format ? `, ${show.format}` : ''}${show.lang === 'DOB' ? ', doblada' : show.lang === 'SUB' ? ', subtitulada' : ''}${past ? ', ya pasó' : next ? ', próxima función' : ''}`}
    >
      <Clock className="size-3" /> {show.time}
      {(show.format || show.lang) && <span className="text-[10px] font-extrabold opacity-80">{[show.format, show.lang].filter(Boolean).join(' ')}</span>}
    </span>
  )
}

const meta = (m: CineMovie) => [m.genre, m.minutes ? `${m.minutes} min` : '', m.rating].filter(Boolean).join(' · ')

/** Película con sus horarios en cada cadena del día elegido (o solo en una cadena). */
function FilmCard({ movie, chains, shows, day, now, onlyChain }: { movie: CineMovie; chains: CineChain[]; shows: CineShow[]; day: string; now: string; onlyChain?: ChainId }) {
  const today = day === isoDay(new Date())
  const rows = chains.filter((c) => !onlyChain || c.id === onlyChain).map((c) => ({ chain: c, list: showsOf(shows, movie.id, c.id, day) }))
  // la próxima función de la película en el día (entre las cadenas que se ven)
  const upcoming = today ? rows.flatMap((r) => r.list).filter((x) => x.time >= now).sort((x, y) => x.time.localeCompare(y.time))[0] : undefined
  return (
    <li className="flex gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
      <div className="aspect-[2/3] w-20 shrink-0 self-start overflow-hidden rounded-md" style={{ boxShadow: `0 0 0 2px ${GOLD}` }}>
        <Poster image={movie.image} title={movie.title} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-extrabold leading-tight">{movie.title || 'Sin título'}</p>
        {meta(movie) && <p className="mt-1 text-xs text-white/65">{meta(movie)}</p>}
        <div className="mt-2.5 space-y-2">
          {rows.map(({ chain, list }) => {
            const info = CHAINS.find((x) => x.id === chain.id)!
            return (
              <div key={chain.id}>
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-white/80">
                  <span className="size-2 rounded-full" style={{ background: info.color }} /> {info.name}
                </p>
                {list.length ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {list.map((x) => (
                      <ShowChip key={x.id} show={x} color={info.color} past={today && x.time < now} next={upcoming?.id === x.id} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-0.5 text-[11px] text-white/40">Sin funciones este día</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </li>
  )
}

type Mode = 'film' | 'chain'

function Lobby() {
  const chains = useCine((s) => s.chains)
  const movies = useCine((s) => s.movies)
  const shows = useCine((s) => s.shows)
  const [phase, setPhase] = useState<'closed' | 'open'>(reduceMotion() ? 'open' : 'closed')
  const [mode, setMode] = useState<Mode>('film')
  const [chainId, setChainId] = useState<ChainId | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const days = nextDays(DAYS_AHEAD, clock)
  const [day, setDay] = useState(days[0])
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
  const now = hhmm(clock)
  const visible = chains.filter((c) => c.enabled)
  const visibleIds = new Set(visible.map((c) => c.id))
  /** Películas con al menos una función ese día en las cadenas que se ven (y en la elegida, si se mira un solo cine). */
  const playing = (only?: ChainId) => movies.filter((m) => shows.some((x) => x.movieId === m.id && x.day === day && (only ? x.chain === only : visibleIds.has(x.chain))))
  const info = CHAINS.find((c) => c.id === chainId)
  const tab = (m: Mode, label: string) => (
    <button
      key={m}
      onClick={() => {
        setMode(m)
        setChainId(null)
      }}
      aria-pressed={mode === m}
      className={`flex-1 rounded-full py-2 text-[13px] font-extrabold transition ${mode === m ? 'text-[#2a1405]' : 'text-white/75'}`}
      style={mode === m ? { background: `linear-gradient(180deg,#ffe19a,${GOLD})` } : undefined}
    >
      {label}
    </button>
  )
  const empty = (text: string) => <p className="mt-6 rounded-2xl bg-white/[0.06] p-5 text-center text-sm text-white/70">{text}</p>
  return (
    <Theatre onClose={close} label="Dentro del cine">
      <Doors open={phase === 'open'} />
      <motion.div initial={false} animate={{ opacity: phase === 'open' ? 1 : 0, y: phase === 'open' ? 0 : 14 }} transition={{ duration: 0.6, delay: phase === 'open' && !reduceMotion() ? 1.1 : 0 }}>
        <Title sub="Horarios en todos los cines">CARTELERA</Title>
        {visible.length === 0 ? (
          empty('El cine está cerrado por ahora.')
        ) : (
          <>
            <div className="mt-5 flex gap-1 rounded-full bg-white/10 p-1" role="group" aria-label="Ver por">
              {tab('film', 'Por película')}
              {tab('chain', 'Por cine')}
            </div>
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Día">
              {days.map((d) => (
                <button key={d} onClick={() => setDay(d)} aria-pressed={day === d} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold capitalize transition ${day === d ? 'bg-white text-[#2a1405]' : 'bg-white/10 text-white/80'}`}>
                  {dayLabel(d, days[0])}
                </button>
              ))}
            </div>

            {mode === 'film' ? (
              playing().length ? (
                <ul className="mt-4 space-y-3">
                  {playing().map((m) => (
                    <FilmCard key={m.id} movie={m} chains={visible} shows={shows} day={day} now={now} />
                  ))}
                </ul>
              ) : (
                empty('Aún no hay funciones para este día. Prueba con otro día.')
              )
            ) : chainId && info ? (
              <>
                <button onClick={() => setChainId(null)} className="mt-4 flex items-center gap-1 rounded-full bg-white/10 py-2 pr-4 pl-2 text-[13px] font-bold transition active:scale-95">
                  <ChevronLeft className="size-4" /> Cines
                </button>
                <div className="mt-3 text-center">
                  <h3 className="text-xl font-black" style={{ textShadow: `0 0 16px ${info.color}` }}>
                    {info.name}
                  </h3>
                  <p className="text-[13px] text-white/65">{info.tagline}</p>
                </div>
                {playing(info.id).length ? (
                  <ul className="mt-4 space-y-3">
                    {playing(info.id).map((m) => (
                      <FilmCard key={m.id} movie={m} chains={visible} shows={shows} day={day} now={now} onlyChain={info.id} />
                    ))}
                  </ul>
                ) : (
                  empty('Esta cadena no tiene funciones este día.')
                )}
              </>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {visible.map((c) => {
                  const meta = CHAINS.find((x) => x.id === c.id)!
                  const count = playing(c.id).length
                  return (
                    <li key={c.id}>
                      <button onClick={() => setChainId(c.id)} className="flex w-full items-center gap-4 rounded-2xl bg-white/[0.07] p-4 text-left ring-1 ring-white/10 transition active:scale-[0.98]">
                        <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(145deg, ${meta.color}, color-mix(in srgb, ${meta.color} 55%, #000))` }}>
                          <Clapperboard className="size-7" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[17px] font-extrabold">{meta.name}</span>
                          <span className="block text-xs text-white/65">{meta.tagline}</span>
                          <span className="mt-1 block text-xs font-bold" style={{ color: GOLD }}>
                            {count ? `${count} ${count === 1 ? 'película' : 'películas'} este día` : 'Sin funciones este día'}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
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
