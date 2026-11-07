import { CalendarDays, Check, ChevronLeft, HardHat, MessageCircle, Minus, Music2, Plus, Ticket as TicketIcon, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { appClock } from '../lib/clock'
import { formatCOP } from '../lib/format'
import { openWhatsApp, whatsappLink } from '../lib/restaurant'
import { useCatalog } from '../state/catalog'
import { useStadiumPhase } from '../state/stadium'
import { useActiveEvent, useSold, useStadiumConfig, useStadiumEvents, useTickets } from '../state/stadiumEvents'
import { useUI } from '../state/ui'
import { SectionTitle, btn, input } from '../ui/bits'
import { Sheet } from '../ui/Sheet'
import { fromPrice, isSoldOut, tierLeft, upcoming } from './logic'
import { TICKET_STATUS_LABEL, type StadiumEvent, type Ticket } from './types'

// Ventana del estadio: eventos próximos (partidos y conciertos), compra de boletas y «Mis boletas».
// Sin pagos en línea: la boleta se reserva con un código y el organizador la confirma por WhatsApp.

const GREEN = '#22a05a'
const MAX_PER_ORDER = 8

const dateParts = (iso: string) => {
  const d = new Date(iso)
  return {
    day: d.toLocaleDateString('es-CO', { day: 'numeric' }),
    month: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''),
    long: d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }),
    time: d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }),
  }
}

function useOperator() {
  const id = useStadiumConfig((s) => s.operatorStoreId)
  return useCatalog((s) => s.stores.find((st) => st.id === id) ?? null)
}

export function StadiumPanel() {
  const open = useUI((s) => s.stadiumOpen)
  return (
    <Sheet open={open} onClose={() => useUI.getState().openStadium(false)} title="Estadio de Cartagena" header={<Header />}>
      {open && <Body />}
    </Sheet>
  )
}

function Header() {
  const phase = useStadiumPhase((s) => s.phase)
  return (
    <div className="px-5 pt-3 pb-4" style={{ background: `linear-gradient(180deg, ${GREEN}22, transparent)` }}>
      <div className="flex items-center gap-3.5 pr-12">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-soft" style={{ background: GREEN }}>
          <Trophy className="size-7" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-extrabold tracking-tight">ESTADIO DE CARTAGENA</h2>
          <p className="text-[13px] text-ink-soft">{phase === 'open' ? 'Partidos y conciertos' : phase === 'almost' ? 'Casi listo: se inaugura pronto' : 'En construcción: próximamente'}</p>
        </div>
      </div>
    </div>
  )
}

type View = { name: 'list' } | { name: 'event'; id: string } | { name: 'done'; ticket: Ticket } | { name: 'mine' }

function Body() {
  const phase = useStadiumPhase((s) => s.phase)
  const events = useStadiumEvents((s) => s.events)
  const tickets = useTickets((s) => s.tickets)
  const [view, setView] = useState<View>({ name: 'list' })
  const now = appClock.now()
  const list = useMemo(() => upcoming(events, now), [events, now])

  if (phase !== 'open')
    return (
      <div className="space-y-4 px-5 pb-8">
        <div className="rounded-3xl bg-sand p-5 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-ink shadow-soft">
            <HardHat className="size-7" />
          </span>
          <p className="mt-3 text-lg font-extrabold tracking-tight">{phase === 'almost' ? 'Muy pronto' : 'Próximamente'}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {phase === 'almost' ? 'Las obras están por terminar.' : 'Estamos construyendo el estadio de Cartagena.'} Cuando abra tendrá partidos de fútbol y conciertos, y aquí podrás comprar tus boletas.
          </p>
        </div>
        {list.length > 0 && <p className="text-center text-xs text-ink-soft">Ya hay eventos programados. Se podrán comprar cuando el estadio abra.</p>}
      </div>
    )

  if (view.name === 'event') return <EventDetail id={view.id} onBack={() => setView({ name: 'list' })} onDone={(ticket) => setView({ name: 'done', ticket })} />
  if (view.name === 'done') return <Done ticket={view.ticket} onList={() => setView({ name: 'list' })} onMine={() => setView({ name: 'mine' })} />
  if (view.name === 'mine') return <Mine onBack={() => setView({ name: 'list' })} />

  return (
    <div className="space-y-4 px-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Próximos eventos</SectionTitle>
        <button className={`${btn.secondary} !px-3 !py-2 text-[13px]`} onClick={() => setView({ name: 'mine' })}>
          <TicketIcon className="size-4" /> Mis boletas{tickets.length ? ` (${tickets.length})` : ''}
        </button>
      </div>
      {!list.length ? (
        <p className="rounded-2xl bg-sand p-4 text-center text-sm text-ink-soft">Todavía no hay eventos programados. Vuelve pronto.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((e) => (
            <li key={e.id}>
              <EventCard ev={e} onOpen={() => setView({ name: 'event', id: e.id })} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EventCard({ ev, onOpen }: { ev: StadiumEvent; onOpen: () => void }) {
  const sold = useSold()
  const active = useActiveEvent()?.id === ev.id
  const p = dateParts(ev.startsAt)
  const from = fromPrice(ev, sold)
  const out = isSoldOut(ev, sold)
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3.5 rounded-3xl border border-line bg-card p-3 text-left shadow-soft transition active:scale-[0.99]">
      <div className="grid size-16 shrink-0 place-items-center rounded-2xl text-white" style={{ background: ev.kind === 'concert' ? '#7c4dff' : GREEN }}>
        <span className="text-center leading-none">
          <span className="block text-xl font-extrabold">{p.day}</span>
          <span className="block text-[11px] font-bold tracking-wide uppercase">{p.month}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft uppercase">
          {ev.kind === 'concert' ? <Music2 className="size-3.5" /> : <Trophy className="size-3.5" />}
          {ev.kind === 'concert' ? 'Concierto' : 'Partido'} · {p.time}
          {active && <span className="rounded-full bg-coral px-1.5 py-0.5 text-[10px] text-white">En escena</span>}
        </p>
        <p className="truncate text-[15px] font-extrabold">{ev.title}</p>
        {ev.subtitle && <p className="truncate text-[12.5px] text-ink-soft">{ev.subtitle}</p>}
        <p className="mt-0.5 text-[13px] font-bold">{out ? <span className="text-coral">Agotado</span> : from === null ? '' : from === 0 ? 'Entrada libre' : `Desde ${formatCOP(from)}`}</p>
      </div>
    </button>
  )
}

function EventDetail({ id, onBack, onDone }: { id: string; onBack: () => void; onDone: (t: Ticket) => void }) {
  const ev = useStadiumEvents((s) => s.events.find((e) => e.id === id))
  const sold = useSold()
  const add = useTickets((s) => s.add)
  const last = useTickets((s) => s.tickets[0])
  const toast = useUI((s) => s.toast)
  const [tierId, setTierId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [name, setName] = useState(last?.buyerName ?? '')
  const [wa, setWa] = useState(last?.whatsapp ?? '')
  const tier = ev?.tiers.find((t) => t.id === tierId) ?? null
  useEffect(() => {
    if (ev && !tierId) setTierId(ev.tiers.find((t) => tierLeft(t, sold, ev.id) > 0)?.id ?? null)
  }, [ev, sold, tierId])
  if (!ev) return null
  const p = dateParts(ev.startsAt)
  const left = tier ? tierLeft(tier, sold, ev.id) : 0
  const max = Math.min(MAX_PER_ORDER, left)
  const total = tier ? tier.price * qty : 0
  const valid = !!tier && qty >= 1 && qty <= max && name.trim().length > 1 && wa.replace(/\D/g, '').length >= 7

  return (
    <div className="space-y-4 px-5 pb-8">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-bold text-brand">
        <ChevronLeft className="size-4" /> Volver a los eventos
      </button>
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold text-ink-soft uppercase">
          {ev.kind === 'concert' ? <Music2 className="size-3.5" /> : <Trophy className="size-3.5" />} {ev.kind === 'concert' ? 'Concierto' : 'Partido'}
        </p>
        <h3 className="text-2xl font-extrabold tracking-tight">{ev.title}</h3>
        {ev.subtitle && <p className="text-sm text-ink-soft">{ev.subtitle}</p>}
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold capitalize">
          <CalendarDays className="size-4 text-brand" /> {p.long} · {p.time}
        </p>
        {ev.description && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{ev.description}</p>}
      </div>

      <div>
        <SectionTitle>Elige tu boleta</SectionTitle>
        <ul className="mt-2 space-y-2">
          {ev.tiers.map((t) => {
            const l = tierLeft(t, sold, ev.id)
            const on = tierId === t.id
            return (
              <li key={t.id}>
                <button
                  disabled={l === 0}
                  aria-pressed={on}
                  onClick={() => {
                    setTierId(t.id)
                    setQty((q) => Math.min(q, Math.max(1, Math.min(MAX_PER_ORDER, l))))
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-50 ${on ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}
                >
                  <span>
                    <span className="block text-[15px] font-bold">{t.name}</span>
                    <span className={`block text-[12px] ${on ? 'text-white/75' : 'text-ink-soft'}`}>{l === 0 ? 'Agotada' : l <= 20 ? `Quedan ${l}` : 'Disponible'}</span>
                  </span>
                  <span className="text-[15px] font-extrabold">{t.price === 0 ? 'Gratis' : formatCOP(t.price)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {tier && left > 0 && (
        <>
          <div className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3">
            <span className="text-sm font-bold">Cantidad</span>
            <span className="flex items-center gap-3">
              <button className={`${btn.icon} !size-9`} aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus className="size-4" />
              </button>
              <span className="w-6 text-center text-lg font-extrabold">{qty}</span>
              <button className={`${btn.icon} !size-9`} aria-label="Más" onClick={() => setQty((q) => Math.min(max, q + 1))}>
                <Plus className="size-4" />
              </button>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-ink-soft">
              Tu nombre
              <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="block text-xs font-bold text-ink-soft">
              WhatsApp
              <input className={`${input} mt-1`} inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="300 123 4567" autoComplete="tel" />
            </label>
          </div>
          <button
            className={`${btn.primary} w-full !py-4 text-base`}
            disabled={!valid}
            onClick={() => {
              const t = add({ event: ev, tierId: tier.id, qty, buyerName: name, whatsapp: wa })
              if (!t) return toast('No se pudo reservar la boleta.', 'error')
              onDone(t)
            }}
          >
            Reservar {qty} {qty === 1 ? 'boleta' : 'boletas'} · {total === 0 ? 'Gratis' : formatCOP(total)}
          </button>
          <p className="text-center text-[11.5px] text-ink-soft">No se cobra en la app: reservas con un código y el organizador te confirma el pago por WhatsApp.</p>
        </>
      )}
      {isSoldOut(ev, sold) && <p className="rounded-2xl bg-sand p-4 text-center text-sm font-bold text-coral">Las boletas de este evento se agotaron.</p>}
    </div>
  )
}

function waMessage(t: Ticket) {
  return `Hola, reservé boletas para «${t.eventTitle}» en el Estadio de Cartagena.\nCódigo: ${t.code}\n${t.qty} × ${t.tierName} · ${formatCOP(t.total)}\nA nombre de ${t.buyerName}. ¿Me confirman, por favor?`
}

function WriteOrganizer({ ticket, className = btn.secondary }: { ticket: Ticket; className?: string }) {
  const op = useOperator()
  const toast = useUI((s) => s.toast)
  return (
    <button
      className={className}
      onClick={() => {
        if (!op?.whatsapp) return toast('El organizador te contactará al WhatsApp que dejaste.', 'success')
        openWhatsApp(whatsappLink(op.whatsapp, waMessage(ticket)))
      }}
    >
      <MessageCircle className="size-4" /> Escribir al organizador
    </button>
  )
}

function Done({ ticket, onList, onMine }: { ticket: Ticket; onList: () => void; onMine: () => void }) {
  return (
    <div className="space-y-4 px-5 pb-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="size-7" />
      </span>
      <div>
        <h3 className="text-xl font-extrabold tracking-tight">¡Boletas reservadas!</h3>
        <p className="text-sm text-ink-soft">Guarda tu código. El organizador te confirma por WhatsApp.</p>
      </div>
      <TicketCard ticket={ticket} />
      <WriteOrganizer ticket={ticket} className={`${btn.primary} w-full`} />
      <div className="flex justify-center gap-2">
        <button className={btn.ghost} onClick={onMine}>
          Ver mis boletas
        </button>
        <button className={btn.ghost} onClick={onList}>
          Más eventos
        </button>
      </div>
    </div>
  )
}

function Mine({ onBack }: { onBack: () => void }) {
  const tickets = useTickets((s) => s.tickets)
  return (
    <div className="space-y-4 px-5 pb-8">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-bold text-brand">
        <ChevronLeft className="size-4" /> Volver a los eventos
      </button>
      <SectionTitle>Mis boletas</SectionTitle>
      {!tickets.length ? (
        <p className="rounded-2xl bg-sand p-4 text-center text-sm text-ink-soft">Aún no tienes boletas. Elige un evento y reserva las tuyas.</p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <TicketCard ticket={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const STATUS_STYLE: Record<Ticket['status'], string> = {
  pending: 'bg-amber-100 text-amber-900',
  confirmed: 'bg-emerald-100 text-emerald-800',
  used: 'bg-ink/10 text-ink-soft',
  cancelled: 'bg-red-100 text-red-700',
}

/** Boleta con su código grande (el comprador lo presenta en la entrada). */
export function TicketCard({ ticket: t }: { ticket: Ticket }) {
  const p = dateParts(t.startsAt)
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-card text-left shadow-soft">
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold">{t.eventTitle}</p>
          <p className="text-[12.5px] text-ink-soft capitalize">
            {p.long} · {p.time}
          </p>
          <p className="mt-1 text-[13px] font-semibold">
            {t.qty} × {t.tierName} · {t.total === 0 ? 'Gratis' : formatCOP(t.total)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[t.status]}`}>{TICKET_STATUS_LABEL[t.status]}</span>
      </div>
      <div className="border-t border-dashed border-line bg-sand/60 px-4 py-3 text-center">
        <p className="text-[10.5px] font-bold tracking-widest text-ink-soft uppercase">Código de entrada</p>
        <p className="font-mono text-2xl font-extrabold tracking-[0.18em]" style={{ opacity: t.status === 'cancelled' ? 0.35 : 1 }}>
          {t.code}
        </p>
      </div>
    </div>
  )
}
