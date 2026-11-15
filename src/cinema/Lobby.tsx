import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { ArrowRight, ChevronLeft, Clapperboard, Info, Play, Ticket, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { detectProfile } from '../lib/deviceProfile'
import { DAYS_AHEAD, nextDays, useCine, type CineMovie } from '../state/cine'
import { partitionMovies, useEffectiveCine } from '../state/cineFeed'
import { useCineSocial } from '../state/cineSocial'
import { useCineUi, type CineTab } from '../state/cineUi'
import { Directory } from './Directory'
import { EventsPreview, EventsTab } from './Events'
import { LiveShowtimes } from './LiveShowtimes'
import { MovieDetail } from './MovieDetail'
import { announceChallenges } from './actions'
import { C, GlassPill, Notice, Picture, SectionHead, StatusTag, shortDate } from './ui'

// MallPlay Cinema, el lobby: se llega desde las puertas rojas del cine del mapa. Pantalla completa, de arriba abajo: película destacada,
// navegación rápida por secciones y, en la cartelera, funciones de hoy, «arma tu salida», eventos y «antes o después». Todo con datos
// reales de la administración o de la lectura oficial; lo que no existe se dice (nada de horarios, planes ni eventos inventados).

const EASE = [0.65, 0, 0.25, 1] as const
/** Curva de Apple: arranca rápido y se asienta suave. */
const APPLE = [0.22, 1, 0.36, 1] as const
/** Cambio de pantalla (lobby ⇄ ficha): sale con un leve retroceso y entra subiendo desde abajo, solo con transform y opacidad. */
const SCREEN = {
  initial: { opacity: 0, y: 26, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.46, ease: APPLE } },
  exit: { opacity: 0, y: -10, scale: 0.99, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } },
}
const TAB_ORDER: CineTab[] = ['now', 'soon', 'cines', 'events']
const VELVET = 'repeating-linear-gradient(90deg, #7a1020 0 16px, #5c0c18 16px 32px)'
const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/**
 * Puertas del cine: dos hojas de terciopelo que se abren hacia adentro mientras la imagen «se acerca». Entre 0,6 y 0,9 s según el
 * equipo; con movimiento reducido no hay puertas, solo un fundido corto.
 */
function Doors({ open, dur }: { open: boolean; dur: number }) {
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
    <motion.div className="pointer-events-none fixed inset-0 z-30" style={{ perspective: 1500 }} initial={false} animate={{ opacity: open ? 0 : 1, scale: open ? 1.08 : 1 }} transition={{ opacity: { duration: 0.35, delay: open ? dur * 0.75 : 0 }, scale: { duration: dur + 0.2, ease: EASE } }} aria-hidden>
      {(['l', 'r'] as const).map((side) => (
        <motion.div key={side} style={leaf(side)} initial={false} animate={{ rotateY: open ? (side === 'l' ? -104 : 104) : 0 }} transition={{ duration: dur, ease: EASE }}>
          <span className="absolute top-1/2 h-24 w-2.5 -translate-y-1/2 rounded-full" style={{ [side === 'l' ? 'right' : 'left']: 14, background: `linear-gradient(90deg,#fbe39a,${C.gold},#b98a2c)`, boxShadow: '0 2px 6px rgba(0,0,0,.5)' }} />
          <span className="absolute inset-x-5 top-8 h-1/4 rounded-sm border border-white/10" />
          <span className="absolute inset-x-5 bottom-10 h-1/4 rounded-sm border border-white/10" />
        </motion.div>
      ))}
      <div className="absolute top-[18%] left-1/2 -translate-x-1/2 text-center">
        <p className="text-4xl font-black tracking-[0.3em]" style={{ color: '#fff3c4', textShadow: `0 0 14px ${C.gold}` }}>
          CINE
        </p>
      </div>
    </motion.div>
  )
}

const TABS: { id: CineTab; label: string }[] = [
  { id: 'now', label: 'Cartelera' },
  { id: 'soon', label: 'Próximamente' },
  { id: 'cines', label: 'Cines' },
  { id: 'events', label: 'Eventos' },
]

function movieTag(m: CineMovie, upcoming: boolean) {
  return m.isNew ? 'new' : upcoming ? 'soon' : 'now'
}

/** Sección 01: película destacada (máximo cuatro), con carrusel táctil por desplazamiento y puntos. */
function Hero({ movies, upcoming, demo }: { movies: CineMovie[]; upcoming: Set<string>; demo: boolean }) {
  const [slide, setSlide] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  if (movies.length === 0) {
    return (
      <section className="relative grid h-[min(46dvh,380px)] place-items-center overflow-hidden px-6 text-center" style={{ background: `radial-gradient(90% 70% at 50% 0%, rgba(244,205,121,.25), transparent 60%), linear-gradient(180deg, ${C.velvet}, ${C.night})` }}>
        <div>
          <Clapperboard className="mx-auto size-10 text-[#F4CD79]" aria-hidden />
          <h2 className="mt-3 text-[28px] leading-tight font-black tracking-tight">Tu próxima película comienza aquí</h2>
          <p className="mx-auto mt-2 max-w-[32ch] text-[14px] text-white/75">Muy pronto verás aquí los estrenos. Mientras tanto, consulta la cartelera de los cines de Cartagena.</p>
          <button onClick={() => useCineUi.getState().setTab('cines')} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-[14px] font-extrabold transition active:scale-95">
            Ver cines <ArrowRight className="size-4" />
          </button>
        </div>
      </section>
    )
  }
  return (
    <section className="relative h-[min(64dvh,560px)] min-h-[420px] lg:h-[min(72dvh,720px)]" aria-roledescription="carrusel" aria-label="Películas destacadas">
      <div
        ref={ref}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const i = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth)
          if (i !== slide) setSlide(i)
        }}
      >
        {movies.map((m, i) => (
          <article key={m.id} className="relative h-full min-w-full snap-center" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${movies.length}: ${m.title}`}>
            <div className="absolute inset-0" aria-hidden>
              <Picture src={m.backdrop || m.image} title={m.title} hue={m.title.length} priority={i === 0} className={m.backdrop ? '' : 'object-top'} />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${C.night} 6%, rgba(8,24,39,.9) 34%, rgba(8,24,39,.45) 54%, rgba(8,24,39,.05) 74%), linear-gradient(to bottom, rgba(8,24,39,.7), rgba(8,24,39,0) 26%)` }} />
            </div>
            {/* sin imagen horizontal, en pantallas anchas el cartel vertical se ve completo a un lado */}
            {!m.backdrop && m.image && (
              <div className="pointer-events-none absolute inset-x-0 bottom-14 mx-auto hidden max-w-[1360px] justify-end px-8 md:flex lg:px-12" aria-hidden>
                <div className="aspect-[2/3] w-[220px] lg:w-[270px] xl:w-[310px] overflow-hidden rounded-xl shadow-[0_14px_40px_rgba(0,0,0,.6)] ring-2" style={{ ['--tw-ring-color' as string]: C.gold }}>
                  <Picture src={m.image} title={m.title} hue={m.title.length} />
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1360px] px-5 pb-12 md:px-8 lg:px-12 lg:pb-16">
              <div className="flex flex-wrap gap-1.5">
                {demo && <StatusTag kind="demo" />}
                <StatusTag kind={movieTag(m, upcoming.has(m.id))} />
              </div>
              <h2 className="mt-2 max-w-[18ch] text-[34px] leading-[1.02] font-black tracking-tight text-[#F7F4EF] uppercase [overflow-wrap:anywhere] md:text-[48px] lg:max-w-[20ch] lg:text-[64px]">{m.title}</h2>
              <p className="mt-3 flex flex-wrap gap-1.5">
                {[m.year ? String(m.year) : '', m.genre, m.minutes ? `${m.minutes} min` : '', m.rating].filter(Boolean).map((x) => (
                  <GlassPill key={x} size="sm">{x}</GlassPill>
                ))}
              </p>
              {m.synopsis && <p className="mt-2 line-clamp-2 max-w-[52ch] text-[13.5px] leading-snug text-white/75 lg:max-w-[60ch] lg:text-[16px]">{m.synopsis}</p>}
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button onClick={() => useCineUi.getState().openMovie(m.id)} className="flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-extrabold text-[#2a1405] shadow-lg transition active:scale-[0.98]" style={{ background: `linear-gradient(180deg,#ffe9b0,${C.gold})` }}>
                  <Play className="size-4 fill-current" /> Ver película
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {movies.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5" aria-hidden>
          {movies.map((m, i) => (
            <span key={m.id} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-6 bg-[#F4CD79]' : 'w-1.5 bg-white/40'}`} />
          ))}
        </div>
      )}
    </section>
  )
}

/** Cartel vertical (tarjeta). */
function PosterCard({ m, upcoming, demo, fixed = false }: { m: CineMovie; upcoming: boolean; demo: boolean; fixed?: boolean }) {
  const sub = [m.genre, m.minutes ? `${m.minutes} min` : ''].filter(Boolean).join(' · ')
  return (
    <button onClick={() => useCineUi.getState().openMovie(m.id)} className={`block text-left transition active:scale-[0.97] ${fixed ? 'w-[132px] shrink-0 snap-start md:w-full' : 'w-full'}`} aria-label={`Ver ${m.title}`}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#10283F] ring-1 ring-white/15">
        <Picture src={m.image} title={m.title} hue={m.title.length} />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {demo && <StatusTag kind="demo" />}
          {(upcoming || m.isNew) && <StatusTag kind={movieTag(m, upcoming)} />}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-[14px] leading-tight font-extrabold text-[#F7F4EF]">{m.title}</p>
      <p className="mt-0.5 line-clamp-1 text-[11.5px] text-white/55">{upcoming && m.release ? `Estreno: ${shortDate(m.release)}` : sub || m.rating}</p>
    </button>
  )
}

/** Sección 04 en la portada: lleva a las funciones de hoy (que traen sus datos solo al abrirlas). */
function TodayTeaser() {
  return (
    <button onClick={() => useCineUi.getState().setTab('cines')} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.07] p-4 text-left ring-1 ring-white/12 transition active:scale-[0.99]" aria-label="Ver funciones de hoy por cine">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal text-white">
        <Ticket className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-extrabold">Funciones de hoy</span>
        <span className="block text-[13px] text-white/60">Horarios en Cine Colombia, Royal Films y Procinal</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-white/60" aria-hidden />
    </button>
  )
}

export default function Lobby() {
  const chains = useCine((s) => s.chains)
  const events = useCine((s) => s.events)
  const { movies, shows, demo } = useEffectiveCine()
  const tab = useCineUi((s) => s.tab)
  const movieId = useCineUi((s) => s.movieId)
  const [clock, setClock] = useState(() => new Date())
  // puertas: duración según el equipo; con movimiento reducido no hay puertas
  const reduced = reduceMotion()
  const dur = useMemo(() => (reduced ? 0 : detectProfile().tier === 'low' ? 0.6 : 0.85), [reduced])
  const [open, setOpen] = useState(reduced)
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    if (open) return
    const t = window.setTimeout(() => setOpen(true), 220)
    return () => clearTimeout(t)
  }, [open])
  useEffect(() => {
    useCineSocial.getState().markExplored()
    announceChallenges()
  }, [])
  // el reloj corre cada minuto: las funciones que pasan se apagan solas
  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const ui = useCineUi.getState()
      if (ui.wizard) ui.closeWizard()
      else if (ui.movieId) ui.openMovie(null)
      else ui.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const visible = chains.filter((c) => c.enabled)
  const { nowPlaying, soon } = useMemo(() => partitionMovies(movies, shows, visible.map((c) => c.id), 'all'), [movies, shows, visible])
  const upcoming = useMemo(() => new Set(soon.map((m) => m.id)), [soon])
  const featured = useMemo(() => (nowPlaying.length ? nowPlaying : soon).slice(0, 4), [nowPlaying, soon])
  const days = nextDays(DAYS_AHEAD, clock)
  const movie = movies.find((m) => m.id === movieId)
  const content = useMemo(() => [...nowPlaying, ...soon], [nowPlaying, soon])
  const close = () => useCineUi.getState().close()
  // al abrir una ficha se recuerda dónde estaba el lobby; al volver se regresa justo ahí
  const lobbyScroll = useRef(0)
  const prevTab = useRef<CineTab>(tab)
  const dir = TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(prevTab.current) ? 1 : -1
  useEffect(() => {
    prevTab.current = tab
  }, [tab])
  useEffect(() => {
    if (movieId) lobbyScroll.current = document.getElementById('cine-scroll')?.scrollTop ?? 0
  }, [movieId])
  const restoreScroll = () => {
    const el = document.getElementById('cine-scroll')
    if (el) el.scrollTop = useCineUi.getState().movieId ? 0 : lobbyScroll.current
  }

  return (
    <motion.div role="dialog" aria-modal="true" aria-label="MallPlay Cinema" id="cine-scroll" onScroll={(e) => { const v = e.currentTarget.scrollTop > 24; if (v !== solid) setSolid(v) }} className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain text-[#F7F4EF]" style={{ background: C.night }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
    <MotionConfig reducedMotion="user">
      {!reduced && <Doors open={open} dur={dur} />}
      <motion.div initial={false} animate={{ opacity: open ? 1 : 0, y: open ? 0 : 12 }} transition={{ duration: 0.45, delay: open && !reduced ? dur * 0.7 : 0 }}>
        {/* barra superior: volver al mall */}
        <header className={`pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 transition-colors duration-200 ${solid ? 'bg-[#081827] shadow-[0_6px_16px_rgba(0,0,0,.35)]' : 'bg-gradient-to-b from-[#081827]/80 to-transparent'}`}>
          <button onClick={() => (movie ? useCineUi.getState().openMovie(null) : close())} aria-label={movie ? 'Volver al lobby del cine' : 'Volver al mall'} className="pointer-events-auto flex h-11 items-center gap-1 rounded-full bg-black/55 pr-4 pl-2.5 text-[14px] font-bold backdrop-blur transition active:scale-95">
            <ChevronLeft className="size-5" /> {movie ? 'Lobby' : 'Mall'}
          </button>
          <span className="pointer-events-none hidden self-center text-[13px] font-black tracking-[0.3em] text-[#F4CD79] md:block" aria-hidden>
            MALLPLAY CINEMA
          </span>
          <button onClick={close} aria-label="Cerrar el cine y volver al mall" className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/55 backdrop-blur transition active:scale-95">
            <X className="size-5" />
          </button>
        </header>

        <AnimatePresence mode="wait" initial={false} onExitComplete={() => restoreScroll()}>
        {movie ? (
          <motion.div key={`movie-${movie.id}`} {...SCREEN}>
            <MovieDetail key={movie.id} movie={movie} shows={shows} chains={visible} demo={demo} upcoming={upcoming.has(movie.id)} days={days} now={hhmm(clock)} />
          </motion.div>
        ) : visible.length === 0 ? (
          <motion.div key="closed" {...SCREEN} className="mx-auto max-w-md px-5 pt-28">
            <Notice icon={<Info className="size-4" />} title="El cine está cerrado por ahora" text="Vuelve pronto: MallPlay Cinema volverá a abrir sus puertas." />
          </motion.div>
        ) : (
          <motion.div key="lobby" {...SCREEN}>
            <Hero movies={featured} upcoming={upcoming} demo={demo} />

            {/* sección 02: navegación rápida */}
            <nav aria-label="Secciones de MallPlay Cinema" className="sticky top-[calc(max(0.75rem,env(safe-area-inset-top))+2.75rem+0.5rem)] z-10 -mt-px" style={{ background: C.night }}>
              <div role="tablist" className="mx-auto flex max-w-[1360px] gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] md:px-8 lg:px-12 [&::-webkit-scrollbar]:hidden">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => useCineUi.getState().setTab(t.id)} className={`relative h-10 shrink-0 rounded-full px-4 text-[13.5px] font-bold whitespace-nowrap transition-colors duration-300 active:scale-95 lg:h-11 lg:px-5 lg:text-[14.5px] ${tab === t.id ? 'text-white' : 'text-white/55'}`}>
                    {tab === t.id && <motion.span layoutId="cine-tab-pill" className="absolute inset-0 rounded-full bg-white/[0.12] ring-1 ring-white/25" transition={{ type: 'spring', stiffness: 420, damping: 34 }} aria-hidden />}
                    <span className="relative">{t.label}</span>
                  </button>
                ))}
              </div>
            </nav>

            <main className="mx-auto max-w-[1360px] space-y-9 px-4 pt-5 pb-16 md:px-8 lg:space-y-12 lg:px-12 lg:pt-8" aria-live="polite">
              {demo && tab !== 'events' && (
                <Notice tone="warn" icon={<Info className="size-4" />} title="Cartelera de ejemplo" text="Las películas y horarios que ves son de muestra; la cartelera real llegará pronto. Para horarios reales, consulta el cine oficial." />
              )}

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab} className="space-y-9 lg:space-y-12" initial={{ opacity: 0, x: dir * 36 }} animate={{ opacity: 1, x: 0, transition: { duration: 0.38, ease: APPLE } }} exit={{ opacity: 0, x: dir * -24, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}>
              {tab === 'now' && (
                <>
                  <section aria-label="En cartelera en Cartagena" className="space-y-3">
                    <SectionHead title="En cartelera en Cartagena" sub={nowPlaying.length ? 'Toca una película para ver su ficha.' : undefined} />
                    {nowPlaying.length ? (
                      <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-5 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden">
                        {nowPlaying.map((m) => (
                          <li key={m.id} className="shrink-0 md:shrink">
                            <PosterCard m={m} upcoming={false} demo={demo} fixed />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Notice icon={<Clapperboard className="size-4" />} title="Aún no hay películas en cartelera" text="Cuando la cartelera esté cargada las verás aquí. Mientras tanto, mira los horarios en el sitio oficial de cada cine." />
                    )}
                  </section>
                  <TodayTeaser />
                  <EventsPreview events={events} />
                </>
              )}

              {tab === 'soon' && (
                <section aria-label="Próximamente" className="space-y-3">
                  <SectionHead title="Próximamente" sub="Estrenos que vienen." />
                  {soon.length ? (
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5 md:gap-x-5 lg:grid-cols-6">
                      {soon.map((m) => (
                        <li key={m.id}>
                          <PosterCard m={m} upcoming demo={demo} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Notice icon={<Clapperboard className="size-4" />} title="No hay estrenos anunciados por ahora" text="Cuando haya fechas confirmadas aparecerán aquí. Nunca mostramos fechas que no estén verificadas." />
                  )}
                </section>
              )}

              {tab === 'cines' && (
                <div className="space-y-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-12 lg:space-y-0">
                  <LiveShowtimes />
                  <Directory chains={visible} />
                </div>
              )}

              {tab === 'events' && <EventsTab events={events} />}

              {tab === 'now' && content.length > 6 && (
                <section aria-label="Todas las películas" className="space-y-3">
                  <SectionHead title="Todas las películas" />
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5 md:gap-x-5 lg:grid-cols-6">
                    {content.map((m) => (
                      <li key={m.id}>
                        <PosterCard m={m} upcoming={upcoming.has(m.id)} demo={demo} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
                </motion.div>
              </AnimatePresence>
            </main>
          </motion.div>
        )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
    </motion.div>
  )
}

