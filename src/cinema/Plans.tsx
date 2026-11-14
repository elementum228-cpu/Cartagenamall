import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, Check, ChevronLeft, Clock, Lock, MapPin, Share2, ShieldCheck, Ticket, Trash2, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useProfile } from '../remote/profile'
import { CHAINS, dayLabel, isoDay, nextDays, showsOf, type CineChain, type CineMovie, type CineShow, type ChainId } from '../state/cine'
import { useCineUi } from '../state/cineUi'
import { MAX_PLANS, useCineSocial } from '../state/cineSocial'
import { useUI } from '../state/ui'
import { announceChallenges, shareText } from './actions'
import type { GroupPlan, PlanPrivacy } from './types'
import { inviteText } from './invite'
import { C, Notice, SectionHead, longDate, shortDate } from './ui'
import { CINEMA_DIRECTORY } from './venues'

const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const cinemaName = (id: ChainId | null) => (id ? CHAINS.find((c) => c.id === id)?.name ?? '' : '')

/** Nombre para mostrar del organizador: solo el primer nombre (nunca teléfono ni otros datos). */
function organizerName() {
  const n = useProfile.getState().fullName.trim().split(/\s+/)[0]
  return n ? n.slice(0, 20) : 'Tú'
}

/** Tarjeta de un plan guardado en este dispositivo. */
export function PlanCard({ plan, onRemove }: { plan: GroupPlan; onRemove?: () => void }) {
  const left = Math.max(0, plan.maxParticipants - plan.participants.length)
  return (
    <article className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/12" aria-label={`Plan: ${plan.movieTitle}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-[#F4CD79] uppercase">
            <Ticket className="size-3.5" aria-hidden /> Plan de cine
          </p>
          <h4 className="mt-1 text-[18px] leading-tight font-black [overflow-wrap:anywhere]">{plan.movieTitle}</h4>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold">
          <Lock className="size-3" aria-hidden /> {plan.privacy === 'private' ? 'Privado' : 'Público'}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5 text-[13.5px] text-white/85">
        <li className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0 opacity-70" aria-hidden /> {plan.chain ? `${cinemaName(plan.chain)}${plan.venue ? ` · ${plan.venue}` : ''}` : 'Cine por definir'}
        </li>
        <li className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 opacity-70" aria-hidden /> {plan.day ? <span className="capitalize">{longDate(plan.day)}</span> : 'Fecha por definir'}
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-4 shrink-0 opacity-70" aria-hidden /> {plan.time || 'Hora por definir'}
        </li>
        <li className="flex items-center gap-2">
          <Users className="size-4 shrink-0 opacity-70" aria-hidden /> Organiza {plan.participants[0]?.name ?? 'Tú'} · {plan.participants.length} confirmado{plan.participants.length === 1 ? '' : 's'} · {left} cupo{left === 1 ? '' : 's'} libre{left === 1 ? '' : 's'}
        </li>
      </ul>
      <p className="mt-3 text-[12px] leading-snug text-white/55">Guardado en este dispositivo. Cada persona compra su entrada en el cine oficial.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => void shareText('Plan de cine en MallPlay', inviteText(plan))} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-teal text-[13.5px] font-extrabold text-white transition active:scale-[0.98]">
          <Share2 className="size-4" /> Invitar
        </button>
        {onRemove && (
          <button onClick={onRemove} aria-label={`Eliminar el plan de ${plan.movieTitle}`} className="grid size-11 place-items-center rounded-full bg-white/10 transition active:scale-95">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </article>
  )
}

/** Entrada al asistente + lo que ya se sabe del módulo social (honesto sobre lo que aún no existe). */
export function PlanTeaser() {
  return (
    <section aria-label="Arma tu salida" className="relative overflow-hidden rounded-3xl p-5 ring-1 ring-white/12" style={{ background: `radial-gradient(120% 90% at 100% 0%, rgba(244,205,121,.22), transparent 55%), linear-gradient(160deg, ${C.velvet}, #3a0a18 70%)` }}>
      <h3 className="text-[22px] leading-tight font-black tracking-tight text-[#F7F4EF]">Las mejores películas se disfrutan juntos 🍿</h3>
      <p className="mt-2 max-w-[34ch] text-[14px] leading-snug text-white/80">Organiza una salida, invita a tus amigos y conviértela en un plan inolvidable.</p>
      <button onClick={() => useCineUi.getState().openWizard(null)} className="mt-4 flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-extrabold text-[#2a1405] shadow-lg transition active:scale-[0.98]" style={{ background: `linear-gradient(180deg,#ffe9b0,${C.gold})` }}>
        <Users className="size-5" /> Crear un plan de cine
      </button>
    </section>
  )
}

/** Pestaña «Planes en grupo»: crear, mis planes (guardados aquí) y planes públicos (aún no disponibles). */
export function PlansTab() {
  const plans = useCineSocial((s) => s.plans)
  return (
    <div className="space-y-6">
      <PlanTeaser />
      <section aria-label="Mis planes" className="space-y-3">
        <SectionHead title="Mis planes" sub={`Guardados en este dispositivo (${plans.length}/${MAX_PLANS}).`} />
        {plans.length === 0 ? (
          <Notice icon={<Ticket className="size-4" />} title="Aún no tienes planes" text="Crea uno y compártelo por WhatsApp para invitar a tus amigos." />
        ) : (
          plans.map((p) => <PlanCard key={p.id} plan={p} onRemove={() => useCineSocial.getState().removePlan(p.id)} />)
        )}
      </section>
      <section aria-label="Planes públicos" className="space-y-3">
        <SectionHead title="¿Quién se apunta? 🍿" sub="Planes públicos de la comunidad." />
        <Notice tone="soon" icon={<ShieldCheck className="size-4" />} title="Planes públicos: próximamente" text="Antes de juntar a personas que no se conocen necesitamos reportes, bloqueo y moderación. Cuando estén listos, aquí verás los planes que sus organizadores decidan hacer públicos y podrás unirte. Por ahora, tus planes son privados y se comparten con un mensaje." />
      </section>
    </div>
  )
}

// ── Asistente ─────────────────────────────────────────────────────────────────────────────────────

const STEPS = ['Película', 'Cine', 'Fecha y hora', 'Grupo', 'Listo'] as const

function Chip({ on, children, onClick, disabled = false }: { on: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on} className={`flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-[14px] font-bold transition active:scale-95 disabled:opacity-40 ${on ? 'bg-[#F4CD79] text-[#2a1405]' : 'bg-white/10 text-white/85'}`}>
      {children}
    </button>
  )
}

/** Boleto que «cae» al guardar el plan (solo transform/opacity; sin movimiento, aparece quieto). */
function TicketStamp() {
  return (
    <motion.div initial={reduce() ? false : { scale: 0.6, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: -4, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="mx-auto grid h-20 w-36 place-items-center rounded-xl text-center shadow-[0_10px_30px_rgba(0,0,0,.45)]" style={{ background: `linear-gradient(135deg, ${C.gold}, #d9ab4d)`, color: '#2a1405' }}>
      <div>
        <Ticket className="mx-auto size-6" aria-hidden />
        <p className="mt-1 text-[12px] font-black tracking-widest">PLAN LISTO</p>
      </div>
    </motion.div>
  )
}

export function PlanWizard({ movies, chains, shows, demo }: { movies: CineMovie[]; chains: CineChain[]; shows: CineShow[]; demo: boolean }) {
  const wiz = useCineUi((s) => s.wizard)
  return <AnimatePresence>{wiz && <WizardBody key="wiz" preset={wiz.movieId} movies={movies} chains={chains} shows={shows} demo={demo} />}</AnimatePresence>
}

function WizardBody({ preset, movies, chains, shows, demo }: { preset: string | null; movies: CineMovie[]; chains: CineChain[]; shows: CineShow[]; demo: boolean }) {
  const [step, setStep] = useState(preset ? 1 : 0)
  const [movieId, setMovieId] = useState<string | null>(preset)
  const [chain, setChain] = useState<ChainId | null>(null)
  const [venue, setVenue] = useState('')
  const [day, setDay] = useState('')
  const [time, setTime] = useState('')
  const [privacy, setPrivacy] = useState<PlanPrivacy>('private')
  const [max, setMax] = useState(4)
  const [saved, setSaved] = useState<GroupPlan | null>(null)
  const days = useMemo(() => nextDays(7), [])
  const movie = movies.find((m) => m.id === movieId) ?? null
  const visible = chains.filter((c) => c.enabled)
  const venues = chain ? CINEMA_DIRECTORY.find((d) => d.id === chain)?.venues ?? [] : []
  // horarios reales de esa película en esa cadena y día (el ejemplo nunca se ofrece como horario real)
  const realTimes = !demo && movie && chain && day ? showsOf(shows, movie.id, chain, day) : []
  const close = () => useCineUi.getState().closeWizard()
  const last = step === STEPS.length - 1

  const canNext = step === 0 ? !!movie : true
  const save = () => {
    if (!movie) return
    const plan: GroupPlan = {
      id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      movieId: movie.id,
      movieTitle: movie.title,
      chain,
      venue,
      day,
      time,
      privacy,
      maxParticipants: max,
      participants: [{ id: 'me', name: organizerName(), role: 'organizer' }],
      createdAt: new Date().toISOString(),
      status: 'local',
    }
    if (!useCineSocial.getState().addPlan(plan)) {
      useUI.getState().toast(`Ya tienes ${MAX_PLANS} planes guardados. Elimina alguno para crear otro.`, 'error')
      return
    }
    setSaved(plan)
    announceChallenges()
  }

  return (
    <motion.div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/65 md:items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={close}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Crear un plan de cine"
        onClick={(e) => e.stopPropagation()}
        initial={reduce() ? false : { y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduce() ? { opacity: 0 } : { y: 60, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-white/12 text-white md:rounded-3xl"
        style={{ background: C.night2 }}
      >
        <header className="flex items-center gap-2 px-4 pt-4 pb-2">
          {step > 0 && !saved ? (
            <button onClick={() => setStep(step - 1)} aria-label="Paso anterior" className="grid size-11 place-items-center rounded-full bg-white/10 active:scale-95">
              <ChevronLeft className="size-5" />
            </button>
          ) : (
            <span className="size-11" aria-hidden />
          )}
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-extrabold tracking-wider text-[#F4CD79] uppercase">{saved ? 'Plan guardado' : `Paso ${step + 1} de ${STEPS.length}`}</p>
            <h2 className="truncate text-[17px] font-black">{saved ? '¡Listo!' : STEPS[step]}</h2>
          </div>
          <button onClick={close} aria-label="Cerrar" className="grid size-11 place-items-center rounded-full bg-white/10 active:scale-95">
            <X className="size-5" />
          </button>
        </header>
        {!saved && (
          <div className="mx-4 mb-2 flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#F4CD79]' : 'bg-white/15'}`} />
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {saved ? (
            <div className="space-y-4 pt-2 text-center">
              <TicketStamp />
              <p className="text-[14px] leading-snug text-white/80">Tu plan quedó guardado en este dispositivo. Invita a tus amigos con un mensaje y recuerden: cada uno compra su entrada en el cine oficial.</p>
              <PlanCard plan={saved} />
              <button onClick={() => (close(), useCineUi.getState().setTab('plans'))} className="text-[13px] font-bold text-white/70 underline underline-offset-2">
                Ver mis planes
              </button>
            </div>
          ) : step === 0 ? (
            <div className="pt-2">
              <p className="mb-3 text-[13px] text-white/65">¿Qué película quieren ver?</p>
              {movies.length === 0 ? (
                <Notice title="Aún no hay películas" text="Cuando la cartelera tenga películas podrás elegir una." />
              ) : (
                <ul className="grid grid-cols-1 gap-2">
                  {movies.map((m) => (
                    <li key={m.id}>
                      <button onClick={() => setMovieId(m.id)} aria-pressed={movieId === m.id} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.99] ${movieId === m.id ? 'bg-[#F4CD79]/20 ring-2 ring-[#F4CD79]' : 'bg-white/[0.06] ring-1 ring-white/10'}`}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-extrabold">{m.title}</span>
                          <span className="block text-[12px] text-white/55">{[m.genre, m.minutes ? `${m.minutes} min` : '', m.rating].filter(Boolean).join(' · ')}</span>
                        </span>
                        {movieId === m.id && <Check className="size-5 shrink-0 text-[#F4CD79]" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : step === 1 ? (
            <div className="space-y-4 pt-2">
              <p className="text-[13px] text-white/65">¿En qué cine? Si aún no lo saben, déjenlo pendiente.</p>
              <div className="flex flex-wrap gap-2">
                {visible.map((c) => (
                  <Chip
                    key={c.id}
                    on={chain === c.id}
                    onClick={() => {
                      setChain(c.id as ChainId)
                      setVenue('')
                      setTime('')
                    }}
                  >
                    <span className="size-2.5 rounded-full" style={{ background: CHAINS.find((x) => x.id === c.id)!.color }} /> {cinemaName(c.id as ChainId)}
                  </Chip>
                ))}
                <Chip
                  on={chain === null}
                  onClick={() => {
                    setChain(null)
                    setVenue('')
                    setTime('')
                  }}
                >
                  Aún no lo sé
                </Chip>
              </div>
              {venues.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-bold tracking-wider text-white/50 uppercase">Sede (verificada en el sitio oficial)</p>
                  <div className="flex flex-wrap gap-2">
                    {venues.map((v) => (
                      <Chip key={v.name} on={venue === v.name} onClick={() => setVenue(venue === v.name ? '' : v.name)}>
                        <MapPin className="size-3.5" aria-hidden /> {v.name}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : step === 2 ? (
            <div className="space-y-4 pt-2">
              <p className="text-[13px] text-white/65">¿Qué día? Pueden dejarlo por definir.</p>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <Chip
                    key={d}
                    on={day === d}
                    onClick={() => {
                      setDay(d)
                      setTime('')
                    }}
                  >
                    <span className="capitalize">{dayLabel(d, isoDay(new Date()))}</span>
                  </Chip>
                ))}
                <Chip on={day === ''} onClick={() => (setDay(''), setTime(''))}>
                  Por definir
                </Chip>
              </div>
              {day && chain && realTimes.length > 0 ? (
                <div>
                  <p className="mb-2 text-[12px] font-bold tracking-wider text-white/50 uppercase">Horario (según la cartelera cargada)</p>
                  <div className="flex flex-wrap gap-2">
                    {realTimes.map((s) => (
                      <Chip key={s.id} on={time === s.time} onClick={() => setTime(time === s.time ? '' : s.time)}>
                        {s.time}
                        {s.format ? ` · ${s.format}` : ''}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : (
                <Notice tone="soon" title="Horario por definir" text={day && chain ? 'MallPlay no tiene horarios verificados de esta película para ese día. Confírmenlos en el cine oficial antes de salir.' : 'Cuando elijan cine y día verán aquí los horarios, si están verificados.'} />
              )}
            </div>
          ) : step === 3 ? (
            <div className="space-y-5 pt-2">
              <div>
                <p className="mb-2 text-[13px] text-white/65">¿Quién puede verlo?</p>
                <div className="grid gap-2">
                  <button onClick={() => setPrivacy('private')} aria-pressed={privacy === 'private'} className={`flex items-start gap-3 rounded-2xl p-3.5 text-left ${privacy === 'private' ? 'bg-[#F4CD79]/20 ring-2 ring-[#F4CD79]' : 'bg-white/[0.06] ring-1 ring-white/10'}`}>
                    <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
                    <span>
                      <span className="block text-[15px] font-extrabold">Plan privado</span>
                      <span className="block text-[12.5px] leading-snug text-white/65">Solo van quienes inviten con el mensaje.</span>
                    </span>
                  </button>
                  <div className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3.5 opacity-70 ring-1 ring-white/10" aria-disabled="true">
                    <Users className="mt-0.5 size-5 shrink-0" aria-hidden />
                    <span>
                      <span className="block text-[15px] font-extrabold">Plan público <span className="ml-1 rounded bg-white/15 px-1.5 py-0.5 text-[10px] tracking-wide uppercase">Pronto</span></span>
                      <span className="block text-[12.5px] leading-snug text-white/65">Visible para la comunidad de MallPlay. Llegará con reportes, bloqueo y moderación.</span>
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[13px] text-white/65">¿Cuántas personas, contándote a ti?</p>
                <div className="flex items-center justify-center gap-5">
                  <button onClick={() => setMax(Math.max(2, max - 1))} aria-label="Menos personas" className="grid size-12 place-items-center rounded-full bg-white/12 text-2xl font-bold active:scale-95">
                    −
                  </button>
                  <p className="w-14 text-center text-[34px] font-black tabular-nums" aria-live="polite">
                    {max}
                  </p>
                  <button onClick={() => setMax(Math.min(12, max + 1))} aria-label="Más personas" className="grid size-12 place-items-center rounded-full bg-white/12 text-2xl font-bold active:scale-95">
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <p className="text-[13px] text-white/65">Revisa tu plan:</p>
              <dl className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10 text-[14px]">
                {[
                  ['Película', movie?.title ?? '—'],
                  ['Cine', chain ? `${cinemaName(chain)}${venue ? ` · ${venue}` : ''}` : 'Por definir'],
                  ['Fecha', day ? shortDate(day) : 'Por definir'],
                  ['Hora', time || 'Por definir'],
                  ['Privacidad', 'Privado (por invitación)'],
                  ['Personas', `Hasta ${max}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                    <dt className="text-white/55">{k}</dt>
                    <dd className="text-right font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
              <Notice tone="soon" icon={<ShieldCheck className="size-4" />} title="Cómo funciona hoy" text="El plan se guarda en este dispositivo y se comparte con un mensaje. MallPlay no reserva asientos ni vende entradas: cada persona compra la suya en el cine oficial. No se comparten teléfonos ni ubicación." />
            </div>
          )}
        </div>

        {!saved && (
          <footer className="border-t border-white/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button onClick={last ? save : () => setStep(step + 1)} disabled={!canNext} className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-extrabold text-[#2a1405] transition active:scale-[0.99] disabled:opacity-40" style={{ background: `linear-gradient(180deg,#ffe9b0,${C.gold})` }}>
              {last ? 'Guardar plan' : 'Continuar'}
            </button>
          </footer>
        )}
      </motion.div>
    </motion.div>
  )
}
