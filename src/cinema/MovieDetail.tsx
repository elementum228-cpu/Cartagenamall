import { Bookmark, BookmarkCheck, ExternalLink, Info, Play, Share2, Ticket, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CHAINS, dayLabel, showsOf, type CineChain, type CineMovie, type CineShow, type ChainId } from '../state/cine'
import { useCineSocial } from '../state/cineSocial'
import { useUI } from '../state/ui'
import { announceChallenges, shareText } from './actions'
import { parseTrailer } from './trailer'
import { C, Notice, Picture, StatusTag } from './ui'
import { ChainCard } from './ChainCard'
import { CINEMA_DIRECTORY, movieLink } from './venues'

/** «12+» → «Recomendada para mayores de 12 años». */
function ageText(rating: string) {
  const n = parseInt(rating, 10)
  return n > 0 ? `Recomendada para mayores de ${n} años` : rating ? `Clasificación: ${rating}` : ''
}

/** Pantalla del tráiler: se abre con un toque, no descarga nada antes, y se quita (con su video) al cerrarla. */
function TrailerPlayer({ trailer, movie, meta, onTimes, onClose }: { trailer: { embed: string; watch: string; provider: string }; movie: CineMovie; meta: string[]; onTimes: () => void; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  const art = movie.image || movie.backdrop
  return (
    <motion.div role="dialog" aria-modal="true" aria-label={`Tráiler de ${movie.title}`} className="fixed inset-0 z-[90] overflow-y-auto bg-[#04080f] text-[#F7F4EF]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 0.3 }}>
      {/* ambiente: el cartel desenfocado tiñe la sala */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        {art && <img src={art} alt="" className="size-full scale-125 object-cover opacity-45 blur-3xl saturate-150" />}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 50% at 50% 28%, rgba(4,8,15,0) 0%, rgba(4,8,15,.75) 70%), linear-gradient(to bottom, rgba(4,8,15,.55), #04080f 88%)' }} />
      </div>

      <div className="relative mx-auto flex min-h-full max-w-[1100px] flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-8">
        <header className="flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <span className="flex items-center gap-2 text-[11px] font-black tracking-[0.28em] text-[#F4CD79]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#F4CD79]" aria-hidden /> TRÁILER OFICIAL
          </span>
          <button onClick={onClose} aria-label="Cerrar tráiler" className="grid size-11 place-items-center rounded-full bg-white/12 backdrop-blur transition active:scale-95">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-6 py-2 md:gap-8">
          {/* pantalla */}
          <motion.div initial={{ opacity: 0, y: 28, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.08 }} className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-[0_0_0_1px_rgba(255,255,255,.14),0_30px_80px_-20px_rgba(0,0,0,.9),0_0_90px_-30px_rgba(244,205,121,.35)] md:rounded-3xl">
            {!loaded && (
              <div className="absolute inset-0 grid place-items-center" aria-live="polite">
                {art && <img src={art} alt="" className="absolute inset-0 size-full object-cover opacity-40 blur-md" />}
                <span className="relative flex flex-col items-center gap-2 text-[12px] font-bold text-white/70">
                  <span className="size-9 animate-spin rounded-full border-[3px] border-white/20 border-t-[#F4CD79]" aria-hidden />
                  Cargando tráiler…
                </span>
              </div>
            )}
            <iframe
              src={trailer.embed}
              title={`Tráiler de ${movie.title}`}
              className="relative size-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              onLoad={() => setLoaded(true)}
            />
          </motion.div>

          {/* ficha corta */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22, ease: [0.22, 1, 0.36, 1] }} className="flex items-end gap-4 md:gap-6">
            <div className="aspect-[2/3] w-[78px] shrink-0 overflow-hidden rounded-lg shadow-[0_10px_30px_rgba(0,0,0,.6)] ring-1 ring-white/25 md:w-[110px]">
              <Picture src={movie.image} title={movie.title} hue={movie.title.length} />
            </div>
            <div className="min-w-0 pb-0.5">
              <h2 className="text-[24px] leading-[1.05] font-black tracking-tight [overflow-wrap:anywhere] md:text-[36px]">{movie.title}</h2>
              {meta.length > 0 && <p className="mt-1.5 text-[13px] font-semibold text-white/65">{meta.join(' · ')}{movie.rating ? ` · ${movie.rating}` : ''}</p>}
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="mt-4 grid gap-2.5 md:mx-auto md:w-full md:max-w-[560px] md:grid-cols-[1fr_auto]">
          <button onClick={onTimes} className="flex h-13 items-center justify-center gap-2 rounded-full text-[15px] font-extrabold text-[#2a1405] shadow-[0_10px_30px_-10px_rgba(244,205,121,.6)] transition active:scale-[0.98]" style={{ background: `linear-gradient(180deg,#ffe9b0,${C.gold})` }}>
            <Ticket className="size-4" /> Ver horarios
          </button>
          <a href={trailer.watch} target="_blank" rel="noopener noreferrer" className="flex h-13 items-center justify-center gap-1.5 rounded-full px-5 text-[13px] font-bold text-white/75 ring-1 ring-white/20 transition active:scale-95">
            Abrir en {trailer.provider === 'youtube' ? 'YouTube' : 'Vimeo'} <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </motion.div>
      </div>
    </motion.div>
  )
}

/** Tarjeta del tráiler en la ficha: una pantalla de cine con el cartel y un botón de play. */
function TrailerCard({ movie, onOpen }: { movie: CineMovie; onOpen: () => void }) {
  return (
    <button onClick={onOpen} aria-haspopup="dialog" aria-label={`Ver el tráiler de ${movie.title}`} className="group relative mt-5 block aspect-video w-full overflow-hidden rounded-2xl bg-[#10283F] text-left shadow-[0_14px_36px_-14px_rgba(0,0,0,.8)] ring-1 ring-white/15 transition active:scale-[0.99]">
      <Picture src={movie.backdrop || movie.image} title={movie.title} hue={movie.title.length} className="object-top transition duration-500 group-hover:scale-105" />
      <span className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(4,8,15,.85), rgba(4,8,15,.1) 60%), radial-gradient(circle at 50% 45%, rgba(0,0,0,.35), transparent 55%)' }} aria-hidden />
      <span className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-[60%] place-items-center rounded-full bg-white/95 text-[#2a1405] shadow-[0_8px_30px_rgba(0,0,0,.6),0_0_0_8px_rgba(255,255,255,.18)] transition group-active:scale-95">
        <Play className="ml-1 size-7 fill-current" aria-hidden />
      </span>
      <span className="absolute inset-x-4 bottom-3 flex items-center justify-between text-[12px] font-extrabold tracking-wide">
        <span>TRÁILER OFICIAL</span>
        <span className="text-white/70">Toca para ver</span>
      </span>
    </button>
  )
}

/** Una función cargada: la hora con su formato e idioma (apagada si ya pasó). Si es de ejemplo, borde punteado. */
function ShowChip({ show, color, past, demo }: { show: CineShow; color: string; past: boolean; demo: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold text-white ${past ? 'line-through opacity-40' : ''} ${demo ? 'border border-dashed border-white/60' : ''}`}
      style={{ background: `color-mix(in srgb, ${color} 70%, #000)` }}
      aria-label={`${show.time}${show.format ? `, ${show.format}` : ''}${show.lang === 'DOB' ? ', doblada' : show.lang === 'SUB' ? ', subtitulada' : ''}${past ? ', ya pasó' : ''}${demo ? ', ejemplo' : ''}`}
    >
      {show.time}
      {(show.format || show.lang) && <span className="text-[10px] font-extrabold opacity-80">{[show.format, show.lang].filter(Boolean).join(' ')}</span>}
    </span>
  )
}

interface Props {
  movie: CineMovie
  shows: CineShow[]
  chains: CineChain[]
  demo: boolean
  upcoming: boolean
  days: string[]
  now: string
}

/**
 * Ficha de una película: imagen horizontal, cartel, datos, acciones (tráiler, horarios, guardar, plan, compartir) y «¿Dónde puedo verla?»
 * con las cadenas, sus horarios cuando hay datos reales y, siempre, el botón al cine oficial. Lo que se desconoce se dice.
 */
export function MovieDetail({ movie, shows, chains, demo, upcoming, days, now }: Props) {
  const saved = useCineSocial((s) => s.favorites.some((f) => f.id === movie.id))
  const [trailerOpen, setTrailerOpen] = useState(false)
  const [day, setDay] = useState(days[0])
  const whereRef = useRef<HTMLElement>(null)
  const trailer = useMemo(() => parseTrailer(movie.trailer), [movie.trailer])
  const toast = useUI.getState().toast

  // al abrir la ficha: arriba del todo y cuenta para el reto «descubre cinco películas»
  useEffect(() => {
    document.getElementById('cine-scroll')?.scrollTo({ top: 0 })
    useCineSocial.getState().markSeen(movie.id)
    announceChallenges()
  }, [movie.id])

  const visible = chains.filter((c) => c.enabled)
  const today = day === days[0]
  const rows = visible.map((c) => {
    const info = CHAINS.find((x) => x.id === c.id)!
    return {
      chain: c,
      info,
      list: showsOf(shows, movie.id, c.id, day),
      link: movieLink(c.id as ChainId, movie.links),
      venues: CINEMA_DIRECTORY.find((d) => d.id === c.id)?.venues ?? [],
    }
  })
  const known = visible.filter((c) => shows.some((s) => s.movieId === movie.id && s.chain === c.id) || movie.links[c.id])
  const anyShows = days.some((d) => visible.some((c) => showsOf(shows, movie.id, c.id, d).length > 0))
  const age = ageText(movie.rating)
  const meta = [movie.year ? String(movie.year) : '', movie.genre, movie.minutes ? `${movie.minutes} min` : ''].filter(Boolean)

  const toggleSave = () => {
    const now = useCineSocial.getState().toggleFavorite(movie)
    toast(now ? 'Guardada en tus películas' : 'Quitada de tus guardadas', 'success')
    announceChallenges()
  }
  const share = () =>
    void shareText(
      `🎬 ${movie.title} — mírala en MallPlay Cinema`,
      `${movie.title}${meta.length ? ` (${meta.join(' · ')})` : ''}. Descubre dónde verla en MallPlay Cinema.`,
    )
  const seeTimes = () => whereRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })

  return (
    <div>
      <section className="relative h-[46dvh] max-h-[460px] min-h-[300px] lg:h-[40dvh] lg:max-h-[400px]">
        <div className="absolute inset-0" aria-hidden>
          <Picture src={movie.backdrop || movie.image} title={movie.title} hue={movie.title.length} priority />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${C.night} 2%, rgba(8,24,39,.6) 40%, rgba(8,24,39,0) 70%), linear-gradient(to bottom, rgba(8,24,39,.6), rgba(8,24,39,0) 24%)`,
            }}
          />
        </div>
      </section>

      <section className="relative -mt-24 px-5 pb-14 lg:-mt-28 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end gap-4 lg:gap-8">
            <div
              className="aspect-[2/3] w-[104px] shrink-0 overflow-hidden rounded-xl lg:w-[200px] shadow-[0_10px_30px_rgba(0,0,0,.55)] ring-2"
              style={{ ['--tw-ring-color' as string]: C.gold }}
            >
              <Picture src={movie.image} title={movie.title} hue={movie.title.length} priority />
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap gap-1.5">
                {demo && <StatusTag kind="demo" />}
                {movie.isNew && <StatusTag kind="new" />}
                <StatusTag kind={upcoming ? 'soon' : 'now'} />
              </div>
              <h2 className="mt-1.5 text-[28px] leading-[1.02] font-black tracking-tight text-[#F7F4EF] [overflow-wrap:anywhere] lg:text-[52px]">{movie.title}</h2>
            </div>
          </div>

          <div className="lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_470px] lg:items-start lg:gap-14">
            <div className="min-w-0">
              {meta.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-white/80">
                  {meta.map((m, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i > 0 && <span className="size-1 rounded-full bg-white/35" aria-hidden />}
                      {m}
                    </span>
                  ))}
                  {movie.rating && <span className="rounded-md border border-white/30 px-1.5 py-px text-[12px] font-extrabold">{movie.rating}</span>}
                </p>
              )}
              {movie.synopsis ? (
                <p className="mt-3 text-[14px] leading-relaxed text-white/80 lg:text-[16.5px]">{movie.synopsis}</p>
              ) : (
                <p className="mt-3 text-[13px] text-white/50">Sinopsis aún no disponible.</p>
              )}
              {age && <p className="mt-2 text-[12px] text-white/55">{age}</p>}
              {movie.release && upcoming && (
                <p className="mt-2 text-[13px] font-bold text-[#F4CD79]">
                  Estreno: {new Date(`${movie.release}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}

              {/* tráiler y acciones: un solo botón principal (horarios); lo demás, secundario */}
              {trailer && <TrailerCard movie={movie} onOpen={() => setTrailerOpen(true)} />}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button onClick={seeTimes} className="col-span-2 flex h-13 items-center justify-center gap-2 rounded-full text-[15px] font-extrabold text-[#2a1405] shadow-[0_10px_30px_-12px_rgba(244,205,121,.55)] transition active:scale-[0.98]" style={{ background: `linear-gradient(180deg,#ffe9b0,${C.gold})` }}>
                  <Ticket className="size-4" /> Ver horarios
                </button>
                <button onClick={toggleSave} aria-pressed={saved} className={`flex h-12 items-center justify-center gap-2 rounded-full text-[14px] font-bold ring-1 transition active:scale-[0.98] ${saved ? 'bg-white/15 text-[#F4CD79] ring-[#F4CD79]/60' : 'text-white/90 ring-white/25'}`}>
                  {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />} {saved ? 'Guardada' : 'Guardar'}
                </button>
                <button onClick={share} className="flex h-12 items-center justify-center gap-2 rounded-full text-[14px] font-bold text-white/90 ring-1 ring-white/25 transition active:scale-[0.98]">
                  <Share2 className="size-4" /> Compartir
                </button>
              </div>
              {!trailer && <p className="mt-2 text-[12px] text-white/45">Tráiler oficial aún no disponible.</p>}
              <AnimatePresence>
              {trailer && trailerOpen && (
                <TrailerPlayer
                  trailer={trailer}
                  movie={movie}
                  meta={meta}
                  onTimes={() => {
                    setTrailerOpen(false)
                    window.setTimeout(seeTimes, 80)
                  }}
                  onClose={() => setTrailerOpen(false)}
                />
              )}
              </AnimatePresence>
            </div>

            {/* dónde verla */}
            <section ref={whereRef} aria-label="¿Dónde puedo verla?" className="mt-9 scroll-mt-24 lg:mt-3 lg:rounded-3xl lg:bg-white/[0.04] lg:p-6 lg:ring-1 lg:ring-white/10">
              <h3 className="text-[22px] leading-tight font-black tracking-tight text-[#F7F4EF]">¿Dónde puedo verla?</h3>
              <p className="mt-1 text-[13px] leading-snug text-white/60">
                {known.length
                  ? `Verificada en: ${known.map((c) => CHAINS.find((x) => x.id === c.id)!.name).join(', ')}.`
                  : 'Todavía no sabemos en qué cines está. Revisa la cartelera oficial de cada cine.'}
              </p>
              {demo && (
                <div className="mt-3">
                  <Notice
                    tone="warn"
                    icon={<Info className="size-4" />}
                    title="Programación de ejemplo"
                    text="Las películas y horarios son de muestra, no son funciones reales. Consulta el cine oficial."
                  />
                </div>
              )}

              {anyShows && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Día">
                  {days.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDay(d)}
                      aria-pressed={day === d}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold capitalize transition ${day === d ? 'bg-white text-[#081827]' : 'bg-white/10 text-white/80'}`}
                    >
                      {dayLabel(d, days[0])}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {rows.map(({ chain, info, list, link, venues }) => (
                  <ChainCard key={chain.id} id={chain.id as ChainId} name={info.name} color={info.color} tagline={info.tagline} logo={CINEMA_DIRECTORY.find((d) => d.id === chain.id)?.logo} href={link.url} hint={link.direct ? undefined : `Abre la cartelera de ${info.name} en Cartagena.`} venues={venues} live={chain.mode === 'auto' && !demo && list.length > 0}>
                    {list.length ? (
                      <div className="flex flex-wrap gap-2">
                        {list.map((x) => (
                          <ShowChip key={x.id} show={x} color={info.color} past={today && x.time < now} demo={demo} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13.5px] text-white/65">Horarios aún no disponibles aquí.</p>
                    )}
                  </ChainCard>
                ))}
              </div>
              {visible.length === 0 && <Notice title="No hay cines disponibles por ahora" text="La administración tiene las cadenas apagadas." />}
              <p className="mt-4 text-[11.5px] leading-snug text-white/45">
                MallPlay te ayuda a decidir; la entrada se compra en el cine oficial. Horarios sujetos a cambios.
                {movie.updatedAt ? ` Ficha revisada el ${new Date(`${movie.updatedAt}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}.` : ''}
              </p>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
