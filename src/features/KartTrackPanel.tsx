import { CalendarDays, Check, Clock, Flag, Info, Trophy, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ENT_COLOR, TRACK_INFO, trackPriceAt } from '../entertainment/config'
import { TRACK_SPACE } from '../config/mall'
import { demoTaken } from '../football/config'
import { appClock } from '../lib/clock'
import { formatCOP } from '../lib/format'
import { courtTakenHours } from '../remote/sync'
import { remoteEnabled } from '../remote/client'
import { useCatalog } from '../state/catalog'
import { useReservations } from '../state/reservations'
import { useUI } from '../state/ui'
import { SectionTitle, btn, input } from '../ui/bits'
import { Sheet } from '../ui/Sheet'

// Panel de la pista de karts: información, características, precios, horarios y reserva de turnos de
// una hora. Usa el mismo sistema de reservas que la zona de deportes (clave de pista 'KARTS').
// Sin pagos: el operador confirma la reserva por WhatsApp.

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`

/** Tienda que opera la pista (asignada por el administrador), o null si está libre. */
export function useTrackOperator() {
  return useCatalog((s) => {
    const id = s.assignments[TRACK_SPACE.id]
    return id ? (s.stores.find((st) => st.id === id) ?? null) : null
  })
}

export function KartTrackPanel() {
  const open = useUI((s) => s.trackOpen)
  return (
    <Sheet open={open} onClose={() => useUI.getState().openTrack(false)} title="Pista de karts" header={<Header />}>
      {open && <Body />}
    </Sheet>
  )
}

function Header() {
  const operator = useTrackOperator()
  return (
    <div className="px-5 pt-3 pb-4" style={{ background: `linear-gradient(180deg, ${ENT_COLOR}1a, transparent)` }}>
      <div className="flex items-center gap-3.5 pr-12">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-soft" style={{ background: ENT_COLOR }}>
          <Flag className="size-7" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-extrabold tracking-tight">PISTA DE KARTS</h2>
          <p className="text-[13px] text-ink-soft">
            {operator ? (
              <>
                Opera: <b className="text-ink">{operator.name}</b> ·{' '}
              </>
            ) : null}
            {TRACK_INFO.category}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded-full bg-ink px-2 py-0.5 text-white">Piso 1</span>
            <span className="rounded-full px-2 py-0.5 text-white" style={{ background: ENT_COLOR }}>
              Isla de Entretenimiento
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Demostración</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Body() {
  const booking = useRef<HTMLElement>(null)
  const operator = useTrackOperator()
  return (
    <div className="space-y-6 px-5 pt-4 pb-8">
      <p className="text-[14px] leading-relaxed text-ink-soft">{TRACK_INFO.description}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button className={`${btn.primary} w-full`} onClick={() => booking.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <CalendarDays className="size-4" /> Reservar turno
        </button>
        {operator && (
          <button className={`${btn.secondary} w-full`} onClick={() => useUI.getState().openStore(operator.id)}>
            Ver a {operator.name}
          </button>
        )}
      </div>
      <p className="-mt-3 flex items-start gap-1.5 text-[11px] text-ink-soft">
        <Info className="mt-px size-3.5 shrink-0" />{' '}
        {remoteEnabled() ? 'Precios y eventos de demostración. Las reservas se guardan y ocupan el horario; no se cobra nada.' : 'Horarios, precios y eventos de demostración: no es disponibilidad real y no se cobra nada.'}
      </p>

      <section>
        <SectionTitle>Características</SectionTitle>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TRACK_INFO.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0" style={{ color: ENT_COLOR }} /> {f}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Precio por turno de 1 hora</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-line bg-white p-3">
            <p className="text-xs font-bold text-ink-soft">Día · hasta las 6 p. m.</p>
            <p className="text-lg font-extrabold">{formatCOP(TRACK_INFO.pricePerTurn)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-3">
            <p className="text-xs font-bold text-ink-soft">Noche · pista iluminada</p>
            <p className="text-lg font-extrabold">{formatCOP(TRACK_INFO.nightPricePerTurn)}</p>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-soft">Cada turno es una carrera privada para tu grupo, hasta {TRACK_INFO.maxPilots} pilotos.</p>
      </section>

      <section ref={booking} className="scroll-mt-4">
        <SectionTitle>Horarios disponibles</SectionTitle>
        <Booking />
      </section>

      <MyReservations />

      <section>
        <SectionTitle>Eventos y carreras</SectionTitle>
        <ul className="space-y-2">
          {TRACK_INFO.events.map((e) => (
            <li key={e.title} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
                <Trophy className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{e.title}</span>
                <span className="block text-xs text-ink-soft">
                  {e.when} · {e.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Booking() {
  const reservations = useReservations((s) => s.reservations)
  const add = useReservations((s) => s.add)
  const toast = useUI((s) => s.toast)
  const days = useMemo(() => {
    const now = new Date(appClock.now())
    return Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))
  }, [])
  const [day, setDay] = useState(0)
  const [hour, setHour] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [pilots, setPilots] = useState('4')
  const d = days[day]
  const key = dayKey(d)
  const now = new Date(appClock.now())
  const hours = Array.from({ length: TRACK_INFO.openHours[1] - TRACK_INFO.openHours[0] }, (_, i) => TRACK_INFO.openHours[0] + i)
  // con base de datos: horarios ocupados reales (de cualquier persona); sin ella, de demostración
  const [taken, setTaken] = useState<Set<number> | null>(null)
  useEffect(() => {
    if (!remoteEnabled()) return
    let alive = true
    setTaken(null)
    void courtTakenHours(key, 'KARTS').then((h) => alive && setTaken(new Set(h ?? [])))
    return () => {
      alive = false
    }
  }, [key, reservations])
  const mine = (h: number) => reservations.some((r) => r.day === key && r.hour === h && r.court === 'KARTS' && r.status === 'pending')
  const isTaken = (h: number) => (remoteEnabled() ? (taken?.has(h) ?? false) : demoTaken(key, h, 'KARTS'))
  const state = (h: number) => (day === 0 && h <= now.getHours() ? 'past' : mine(h) ? 'mine' : isTaken(h) ? 'taken' : 'free')
  const valid = hour !== null && name.trim().length > 1 && whatsapp.replace(/\D/g, '').length >= 7
  const on = 'border-[color:var(--ent)] bg-[color:var(--ent)] text-white'

  return (
    <div className="space-y-3" style={{ ['--ent' as string]: ENT_COLOR }}>
      <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Día">
        {days.map((dd, i) => (
          <button
            key={i}
            onClick={() => {
              setDay(i)
              setHour(null)
            }}
            aria-pressed={day === i}
            className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 text-xs font-bold transition ${day === i ? on : 'border-line bg-white'}`}
          >
            <span className="opacity-80">{i === 0 ? 'Hoy' : DAY_NAMES[dd.getDay()]}</span>
            <span className="text-base">{dd.getDate()}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Hora">
        {hours.map((h) => {
          const st = state(h)
          const disabled = st !== 'free'
          return (
            <button
              key={h}
              disabled={disabled}
              onClick={() => setHour(h)}
              aria-pressed={hour === h}
              aria-label={`${hourLabel(h)}${st === 'taken' ? (remoteEnabled() ? ', ocupado' : ', ocupado (demostración)') : st === 'mine' ? ', ya reservado por ti' : st === 'past' ? ', ya pasó' : ''}`}
              className={`rounded-xl border px-2 py-2 text-left text-xs transition ${hour === h ? 'border-[color:var(--ent)] bg-[color:var(--ent)]/10 ring-2 ring-[color:var(--ent)]/30' : 'border-line bg-white'} ${disabled ? 'cursor-not-allowed opacity-45' : 'hover:border-[color:var(--ent)]'}`}
            >
              <span className="block font-bold">{hourLabel(h)}</span>
              <span className="block text-[10px] text-ink-soft">{st === 'free' ? formatCOP(trackPriceAt(h)) : st === 'taken' ? 'Ocupado' : st === 'mine' ? 'Tu reserva' : '—'}</span>
            </button>
          )
        })}
      </div>
      {hour !== null && (
        <div className="space-y-3 rounded-3xl border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Clock className="size-4" style={{ color: ENT_COLOR }} /> {DAY_NAMES[d.getDay()]} {d.getDate()} · {hourLabel(hour)} · {formatCOP(trackPriceAt(hour))}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Nombre de quien reserva</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-ink-soft">WhatsApp</span>
              <input className={input} inputMode="tel" placeholder="300 123 4567" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-ink-soft">Pilotos</span>
              <select className={input} value={pilots} onChange={(e) => setPilots(e.target.value)}>
                {Array.from({ length: TRACK_INFO.maxPilots }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'piloto' : 'pilotos'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className={`${btn.primary} w-full`}
            disabled={!valid}
            onClick={() => {
              const r = add({ day: key, hour, court: 'KARTS', name: name.trim(), whatsapp: whatsapp.trim(), players: Number(pilots), price: trackPriceAt(hour) })
              toast(`Reserva ${r.id} enviada: pendiente de confirmación (demostración, sin cobro).`, 'success')
              setHour(null)
            }}
          >
            <CalendarDays className="size-4" /> Reservar turno
          </button>
          <p className="text-[11px] text-ink-soft">Demostración: no hay pago. La pista confirmaría la reserva por WhatsApp.</p>
        </div>
      )}
    </div>
  )
}

function MyReservations() {
  const all = useReservations((s) => s.reservations)
  const reservations = useMemo(() => all.filter((r) => r.status === 'pending' && r.court === 'KARTS'), [all])
  const cancel = useReservations((s) => s.cancel)
  if (!reservations.length) return null
  return (
    <section>
      <SectionTitle>Mis reservas de la pista</SectionTitle>
      <ul className="space-y-2">
        {reservations.map((r) => {
          const [y, m, dd] = r.day.split('-').map(Number)
          const date = new Date(y, m - 1, dd)
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `${ENT_COLOR}1a`, color: ENT_COLOR }}>
                <Users className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {DAY_NAMES[date.getDay()]} {dd} · {hourLabel(r.hour)}
                </span>
                <span className="block text-xs text-ink-soft">
                  <span className="font-mono">{r.id}</span> · {r.players} pilotos · {formatCOP(r.price)} · Pendiente de confirmación
                </span>
              </span>
              <button className={`${btn.ghost} text-red-600`} onClick={() => cancel(r.id)} aria-label={`Cancelar reserva ${r.id}`}>
                <X className="size-4" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
