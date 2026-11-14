import { motion } from 'motion/react'
import { ArrowRight, ChevronLeft, Clapperboard, ExternalLink, Info, Play, Ticket, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { detectProfile } from '../lib/deviceProfile'
import { DAYS_AHEAD, nextDays, useCine, type CineMovie } from '../state/cine'
import { partitionMovies, useEffectiveCine } from '../state/cineFeed'
import { useCineSocial } from '../state/cineSocial'
import { useCineUi, type CineTab } from '../state/cineUi'
import { Directory } from './Directory'
import { EventsPreview, EventsTab } from './Events'
import { Challenges } from './Challenges'
import { LiveShowtimes } from './LiveShowtimes'
import { MovieDetail } from './MovieDetail'
import { PlanTeaser, PlanWizard, PlansTab } from './Plans'
import { AfterBefore } from './Promos'
import { announceChallenges } from './actions'
import { C, Notice, Picture, SectionHead, StatusTag, shortDate } from './ui'
import { CINEMA_DIRECTORY } from './venues'

// MallPlay Cinema, el lobby: se llega desde las puertas rojas del cine del mapa. Pantalla completa, de arriba abajo: película destacada,
// navegación rápida por secciones y, en la cartelera, funciones de hoy, «arma tu salida», eventos y «antes o después». Todo con datos
// reales de la administración o de la lectura oficial; lo que no existe se dice (nada de horarios, planes ni eventos inventados).

const EASE = [0.65, 0, 0.25, 1] as const
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
  { id: 'cines', label: 'Cines en Cartagena' },
  { id: 'plans', label: 'Planes en grupo' },
  { id: 'events', label: 'Eventos' },
  { id: 'promos', label: 'Promociones' },
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
    <section className="relative h-[min(64dvh,560px)] min-h-[420px]" aria-roledescription="carrusel" aria-label="Películas destacadas">
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
              <Picture src={m.backdrop || m.image} title={m.title} hue={m.title.length} priority={i === 0} />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${C.night} 6%, rgba(8,24,39,.9) 34%, rgba(8,24,39,.45) 54%, rgba(8,24,39,.05) 74%), linear-gradient(to bottom, rgba(8,24,39,.7), rgba(8,24,39,0) 26%)` }} />
            </div>
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-5 pb-12 md:px-8">
              <div className="flex flex-wrap gap-1.5">
                {demo && <StatusTag kind="demo" />}
                <StatusTag kind={movieTag(m, upcoming.has(m.id))} />
              </div>
              <h2 className="mt-2 max-w-[18ch] text-[34px] leading-[1.02] font-black tracking-tight text-[#F7F4EF] uppercase [overflow-wrap:anywhere] md:text-[48px]">{m.title}</h2>
              <p className="mt-2 text-[13.5px] font-semibold text-white/80">{[m.year ? String(m.year) : '', m.genre, m.minutes ? `${m.minutes} min` : '', m.rating].filter(Boolean).join(' · ')}</p>
              {m.synopsis && <p className="mt-2 line-clamp-2 max-w-[52ch] text-[13.5px] leading-snug text-white/75">{m.synopsis}</p>}
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button onClick={() => useCineUi.getState().openMovie(m.id)} className="flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-extrabold text-[#2a1405] shadow-lg transition active:scale-[0.98]" style={{ background: `linear-gradient(180deg,#ffe9b0,${C.gold})` }}>
                  <Play className="size-4 fill-current" /> Ver película
                </button>
                <button onClick={() => useCineUi.getState().openWizard(m.id)} className="flex h-12 items-center gap-2 rounded-full bg-white/15 px-5 text-[15px] font-extrabold backdrop-blur-sm transition active:scale-[0.98]">
                  <Users className="size-4" /> Crear plan
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
    <button onClick={() => useCineUi.getState().openMovie(m.id)} className={`block text-left transition active:scale-[0.97] ${fixed ? 'w-[132px] shrink-0 snap-start md:w-[168px]' : 'w-full'}`} aria-label={`Ver ${m.title}`}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#10283F] ring-1 ring-white/15">
        <Picture src={m.image} title={m.title} hue={m.title.length} />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {demo && <StatusTag kind="demo" />}
          <StatusTag kind={movieTag(m, upcoming)} />
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
    <section aria-label="Funciones de hoy" className="space-y-3">
      <SectionHead title="Funciones de hoy" sub="Horarios por cine, con la fuente a la vista." />
      <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/12">
        <p className="text-[14px] leading-snug text-white/80">Mira qué hay hoy en Cine Colombia, Royal Films y Procinal. Cuando un cine tiene horarios verificados los verás aquí; si no, te llevamos directo a su cartelera oficial.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => useCineUi.getState().setTab('cines')} className="flex h-11 items-center gap-2 rounded-full bg-teal px-5 text-[14px] font-extrabold text-white transition active:scale-[0.98]">
            <Ticket className="size-4" /> Ver funciones de hoy
          </button>
          {CINEMA_DIRECTORY.map((d) => (
            <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-[13px] font-bold transition active:scale-95">
              <span className="size-2 rounded-full" style={{ background: d.color }} /> {d.name} <ExternalLink className="size-3 opacity-70" aria-hidden />
            </a>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-white/50">Consultar en el cine oficial: ahí se compra la entrada.</p>
      </div>
    </section>
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

  return (
    <motion.div role="dialog" aria-modal="true" aria-label="MallPlay Cinema" id="cine-scroll" className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain text-[#F7F4EF]" style={{ background: C.night }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      {!reduced && <Doors open={open} dur={dur} />}
      <motion.div initial={false} animate={{ opacity: open ? 1 : 0, y: open ? 0 : 12 }} transition={{ duration: 0.45, delay: open && !reduced ? dur * 0.7 : 0 }}>
        {/* barra superior: volver al mall */}
        <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-[#081827] via-[#081827]/85 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-5">
          <button onClick={() => (movie ? useCineUi.getState().openMovie(null) : close())} aria-label={movie ? 'Volver al lobby del cine' : 'Volver al mall'} className="pointer-events-auto flex h-11 items-center gap-1 rounded-full bg-black/55 pr-4 pl-2.5 text-[14px] font-bold backdrop-blur transition active:scale-95">
            <ChevronLeft className="size-5" /> {movie ? 'Lobby' : 'Mall'}
          </button>
          <button onClick={close} aria-label="Cerrar el cine y volver al mall" className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/55 backdrop-blur transition active:scale-95">
            <X className="size-5" />
          </button>
        </header>

        {movie ? (
          <div className="mx-auto max-w-3xl">
            <MovieDetail key={movie.id} movie={movie} shows={shows} chains={visible} demo={demo} upcoming={upcoming.has(movie.id)} days={days} now={hhmm(clock)} />
          </div>
        ) : visible.length === 0 ? (
          <div className="mx-auto max-w-md px-5 pt-28">
            <Notice icon={<Info className="size-4" />} title="El cine está cerrado por ahora" text="Vuelve pronto: MallPlay Cinema volverá a abrir sus puertas." />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl">
            <Hero movies={featured} upcoming={upcoming} demo={demo} />

            {/* sección 02: navegación rápida */}
            <nav aria-label="Secciones de MallPlay Cinema" className="sticky top-[calc(max(0.75rem,env(safe-area-inset-top))+3.4rem)] z-10 -mt-px" style={{ background: C.night }}>
              <div role="tablist" className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => useCineUi.getState().setTab(t.id)} className={`h-10 shrink-0 rounded-full px-4 text-[13.5px] font-bold whitespace-nowrap transition active:scale-95 ${tab === t.id ? 'bg-[#F4CD79] text-[#2a1405]' : 'bg-white/10 text-white/85'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </nav>

            <main className="space-y-9 px-4 pt-5 pb-16 md:px-8" aria-live="polite">
              {demo && tab !== 'plans' && tab !== 'events' && tab !== 'promos' && (
                <Notice tone="warn" icon={<Info className="size-4" />} title="Cartelera de ejemplo" text="Las películas y horarios que ves son de muestra; la cartelera real llegará pronto. Para horarios reales, consulta el cine oficial." />
              )}

              {tab === 'now' && (
                <>
                  <section aria-label="En cartelera en Cartagena" className="space-y-3">
                    <SectionHead title="En cartelera en Cartagena" sub={nowPlaying.length ? 'Toca una película para ver su ficha.' : undefined} />
                    {nowPlaying.length ? (
                      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:-mx-8 md:px-8 [&::-webkit-scrollbar]:hidden">
                        {nowPlaying.map((m) => (
                          <li key={m.id} className="shrink-0">
                            <PosterCard m={m} upcoming={false} demo={demo} fixed />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Notice icon={<Clapperboard className="size-4" />} title="Aún no hay películas en cartelera" text="Cuando la cartelera esté cargada las verás aquí. Mientras tanto, mira los horarios en el sitio oficial de cada cine." />
                    )}
                  </section>
                  <TodayTeaser />
                  <PlanTeaser />
                  <EventsPreview events={events} />
                  <AfterBefore limit={4} />
                  <Challenges />
                </>
              )}

              {tab === 'soon' && (
                <section aria-label="Próximamente" className="space-y-3">
                  <SectionHead title="Próximamente" sub="Estrenos que vienen." />
                  {soon.length ? (
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
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
                <div className="space-y-8">
                  <LiveShowtimes />
                  <Directory chains={visible} />
                </div>
              )}

              {tab === 'plans' && <PlansTab />}
              {tab === 'events' && <EventsTab events={events} />}
              {tab === 'promos' && <AfterBefore />}

              {tab === 'now' && content.length > 6 && (
                <section aria-label="Todas las películas" className="space-y-3">
                  <SectionHead title="Todas las películas" />
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
                    {content.map((m) => (
                      <li key={m.id}>
                        <PosterCard m={m} upcoming={upcoming.has(m.id)} demo={demo} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="flex justify-center pt-2">
                <button onClick={close} className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-[14px] font-extrabold transition active:scale-95">
                  <ChevronLeft className="size-4" /> Volver al mall
                </button>
              </div>
            </main>
          </div>
        )}
      </motion.div>
      <PlanWizard movies={content} chains={visible} shows={shows} demo={demo} />
    </motion.div>
  )
}

