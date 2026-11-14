import { CalendarDays, Clock, ExternalLink, MapPin, Sparkles, Users } from 'lucide-react'
import { EVENT_KINDS, publicEvents, seatsLeft, type CineEvent, type CineEventStatus } from '../state/cine'
import { useCineUi } from '../state/cineUi'
import { Notice, Picture, SectionHead, longDate } from './ui'

const STATUS_TEXT: Record<CineEventStatus, string> = { draft: 'Borrador', soon: 'Próximamente', open: 'Abierto', full: 'Completo', finished: 'Finalizado', cancelled: 'Cancelado' }
const STATUS_CLS: Record<CineEventStatus, string> = {
  draft: 'bg-white/15',
  soon: 'bg-white/90 text-[#081827]',
  open: 'bg-emerald-400 text-[#06281c]',
  full: 'bg-[#F4CD79] text-[#2a1405]',
  finished: 'bg-white/20 text-white/80',
  cancelled: 'bg-[#7C1429] text-white',
}
const MODE_TEXT = { presencial: 'Presencial', virtual: 'Virtual', mixto: 'Presencial y virtual' } as const

function EventCard({ e }: { e: CineEvent }) {
  const kind = EVENT_KINDS.find((k) => k.id === e.kind)
  const left = seatsLeft(e)
  const ended = e.status === 'finished' || e.status === 'cancelled'
  return (
    <article className={`overflow-hidden rounded-2xl bg-white/[0.07] ring-1 ring-white/12 ${ended ? 'opacity-75' : ''}`} aria-label={e.title}>
      <div className="relative aspect-[16/9] bg-[#10283F]">
        <Picture src={e.image} title={kind?.name} hue={e.title.length} />
        <span className={`absolute top-3 left-3 rounded-md px-2 py-0.5 text-[11px] font-extrabold ${STATUS_CLS[e.status]}`}>{STATUS_TEXT[e.status]}</span>
      </div>
      <div className="p-4">
        <p className="text-[11px] font-extrabold tracking-wider text-[#F4CD79] uppercase">{kind?.name}</p>
        <h4 className="mt-1 text-[19px] leading-tight font-black [overflow-wrap:anywhere]">{e.title}</h4>
        {e.description && <p className="mt-2 text-[13.5px] leading-snug text-white/75">{e.description}</p>}
        <ul className="mt-3 space-y-1.5 text-[13px] text-white/80">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 opacity-70" aria-hidden /> {e.date ? <span className="capitalize">{longDate(e.date)}</span> : 'Fecha por anunciar'}
          </li>
          {e.time && (
            <li className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 opacity-70" aria-hidden /> {e.time}
            </li>
          )}
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 opacity-70" aria-hidden /> {MODE_TEXT[e.mode]}
            {e.place ? ` · ${e.place}` : ''}
          </li>
          {left !== null && (
            <li className="flex items-center gap-2">
              <Users className="size-4 shrink-0 opacity-70" aria-hidden /> {e.status === 'full' || left === 0 ? 'Sin cupos' : `${left} cupo${left === 1 ? '' : 's'} disponible${left === 1 ? '' : 's'}`}
            </li>
          )}
        </ul>
        {e.status === 'open' && e.url ? (
          <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-teal text-[14.5px] font-extrabold text-white transition active:scale-[0.98]">
            Participar <ExternalLink className="size-4 opacity-80" aria-hidden />
          </a>
        ) : (
          <p className="mt-4 rounded-xl bg-white/[0.06] px-3 py-2.5 text-center text-[13px] font-bold text-white/70">
            {e.status === 'open' ? 'Inscripción por anunciar' : e.status === 'soon' ? 'Pronto abrirán las inscripciones' : e.status === 'full' ? 'Evento completo' : e.status === 'cancelled' ? 'Evento cancelado' : 'Evento finalizado'}
          </p>
        )}
      </div>
    </article>
  )
}

/** Cuando no hay eventos cargados: se dice y se muestra qué tipos de eventos tendrá el cine (sin inventar ninguno). */
function NoEvents() {
  return (
    <div className="space-y-3">
      <Notice icon={<Sparkles className="size-4" />} title="Pronto anunciaremos eventos" text="Aquí aparecerán las noches de estreno, trivias, maratones y más que organice MallPlay Cinema." />
      <ul className="flex flex-wrap gap-2" aria-label="Tipos de eventos que tendrá MallPlay Cinema">
        {EVENT_KINDS.map((k) => (
          <li key={k.id} className="rounded-full bg-white/8 px-3 py-1.5 text-[12.5px] font-bold text-white/75" title={k.hint}>
            {k.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Vista previa en el lobby: los dos primeros eventos visibles. */
export function EventsPreview({ events }: { events: CineEvent[] }) {
  const list = publicEvents(events).filter((e) => e.status !== 'finished' && e.status !== 'cancelled').slice(0, 2)
  return (
    <section aria-label="Eventos en MallPlay Cinema" className="space-y-3">
      <SectionHead
        title="Eventos en MallPlay Cinema"
        sub="Noches de estreno, trivias y más."
        action={
          list.length > 0 ? (
            <button onClick={() => useCineUi.getState().setTab('events')} className="shrink-0 rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-bold transition active:scale-95">
              Ver todos
            </button>
          ) : undefined
        }
      />
      {list.length === 0 ? <NoEvents /> : <div className="space-y-3">{list.map((e) => <EventCard key={e.id} e={e} />)}</div>}
    </section>
  )
}

/** Pestaña «Eventos». */
export function EventsTab({ events }: { events: CineEvent[] }) {
  const list = publicEvents(events)
  return (
    <section aria-label="Eventos" className="space-y-4">
      <SectionHead title="Eventos" sub="Lo que viene en MallPlay Cinema." />
      {list.length === 0 ? <NoEvents /> : <div className="grid gap-3 md:grid-cols-2">{list.map((e) => <EventCard key={e.id} e={e} />)}</div>}
    </section>
  )
}
