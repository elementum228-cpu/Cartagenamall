import { useCourtOperator } from '../football/open'
import { CalendarDays, Check, Clock, Info, Shirt, Trophy, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { COURT_INFO, demoTaken, priceAt } from '../football/config'
import { appClock } from '../lib/clock'
import { formatCOP } from '../lib/format'
import { useReservations } from '../state/reservations'
import { useUI } from '../state/ui'
import { remoteEnabled } from '../remote/client'
import { courtTakenHours } from '../remote/sync'
import { SectionTitle, btn, input } from '../ui/bits'
import { Sheet } from '../ui/Sheet'

// Panel comercial de la cancha sintética: información, imágenes de demostración, características,
// precios, horarios y un flujo de reserva de prueba (sin pagos; los datos son ficticios).

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`

export function FootballCourtInfoPanel() {
  const open = useUI((s) => s.courtOpen)
  const close = () => useUI.getState().openCourt(false)
  return (
    <Sheet open={open} onClose={close} title="Cancha sintética" header={<Header />}>
      {open && <Body />}
    </Sheet>
  )
}

function Header() {
  const operator = useCourtOperator()
  return (
    <div className="px-5 pt-3 pb-4" style={{ background: 'linear-gradient(160deg, #d8f0dc, #fffdf9 85%)' }}>
      <div className="flex items-center gap-3.5 pr-12">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#1f7a3d] text-white shadow-soft">
          <BallIcon className="size-8" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-extrabold tracking-tight">CANCHA SINTÉTICA</h2>
          <p className="text-[13px] text-ink-soft">
            {operator ? <>Opera: <b className="text-ink">{operator.name}</b> · </> : null}
            {COURT_INFO.category} · Recreación
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className="rounded-full bg-ink px-2 py-0.5 text-white">Piso 1</span>
            <span className="rounded-full bg-[#1f7a3d] px-2 py-0.5 text-white">Jardín exterior</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Demostración</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Body() {
  const booking = useRef<HTMLElement>(null)
  return (
    <div className="space-y-6 px-5 pt-4 pb-8">
      <p className="text-[14px] leading-relaxed text-ink-soft">{COURT_INFO.description}</p>
      <button className={`${btn.primary} w-full`} onClick={() => booking.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
        <CalendarDays className="size-4" /> Reservar cancha
      </button>
      <p className="-mt-3 flex items-start gap-1.5 text-[11px] text-ink-soft">
        <Info className="mt-px size-3.5 shrink-0" />{' '}
        {remoteEnabled() ? 'Precios y torneos de demostración. Las reservas se guardan y ocupan el horario; no se cobra nada.' : 'Horarios, precios y torneos de demostración: no es disponibilidad real y no se cobra nada.'}
      </p>

      <section>
        <SectionTitle>Imágenes (ilustraciones de demostración)</SectionTitle>
        <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
          <Illustration kind="aerial" caption="Vista de la cancha" />
          <Illustration kind="night" caption="Iluminación nocturna" />
          <Illustration kind="goal" caption="Arcos de fútbol 5" />
        </div>
      </section>

      <section>
        <SectionTitle>Características</SectionTitle>
        <ul className="grid gap-2 sm:grid-cols-2">
          {COURT_INFO.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-[#1f7a3d]" /> {f}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Precio por hora</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-line bg-white p-3">
            <p className="text-xs font-bold text-ink-soft">Día · hasta las 6 p. m.</p>
            <p className="text-lg font-extrabold">{formatCOP(COURT_INFO.pricePerHour)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-3">
            <p className="text-xs font-bold text-ink-soft">Noche · con iluminación</p>
            <p className="text-lg font-extrabold">{formatCOP(COURT_INFO.nightPricePerHour)}</p>
          </div>
        </div>
      </section>

      <section ref={booking} className="scroll-mt-4">
        <SectionTitle>Horarios disponibles</SectionTitle>
        <Booking />
      </section>

      <MyReservations />

      <section>
        <SectionTitle>Eventos y torneos</SectionTitle>
        <ul className="space-y-2">
          {COURT_INFO.events.map((e) => (
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
  const [players, setPlayers] = useState('10')
  const d = days[day]
  const key = dayKey(d)
  const now = new Date(appClock.now())
  const hours = Array.from({ length: COURT_INFO.openHours[1] - COURT_INFO.openHours[0] }, (_, i) => COURT_INFO.openHours[0] + i)
  // con base de datos: horarios ocupados reales (de cualquier persona); sin ella, de demostración
  const [taken, setTaken] = useState<Set<number> | null>(null)
  useEffect(() => {
    if (!remoteEnabled()) return
    let alive = true
    setTaken(null)
    void courtTakenHours(key).then((hours) => alive && setTaken(new Set(hours ?? [])))
    return () => {
      alive = false
    }
  }, [key, reservations])
  const mine = (h: number) => reservations.some((r) => r.day === key && r.hour === h && r.status === 'pending')
  const isTaken = (h: number) => (remoteEnabled() ? (taken?.has(h) ?? false) : demoTaken(key, h))
  const state = (h: number) => (day === 0 && h <= now.getHours() ? 'past' : mine(h) ? 'mine' : isTaken(h) ? 'taken' : 'free')
  const valid = hour !== null && name.trim().length > 1 && whatsapp.replace(/\D/g, '').length >= 7

  return (
    <div className="space-y-3">
      <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Día">
        {days.map((dd, i) => (
          <button
            key={i}
            onClick={() => {
              setDay(i)
              setHour(null)
            }}
            aria-pressed={day === i}
            className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 text-xs font-bold transition ${day === i ? 'border-[#1f7a3d] bg-[#1f7a3d] text-white' : 'border-line bg-white'}`}
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
              className={`rounded-xl border px-2 py-2 text-left text-xs transition ${
                hour === h ? 'border-[#1f7a3d] bg-[#1f7a3d]/10 ring-2 ring-[#1f7a3d]/30' : 'border-line bg-white'
              } ${disabled ? 'cursor-not-allowed opacity-45' : 'hover:border-[#1f7a3d]'}`}
            >
              <span className="block font-bold">{hourLabel(h)}</span>
              <span className="block text-[10px] text-ink-soft">{st === 'free' ? formatCOP(priceAt(h)) : st === 'taken' ? 'Ocupado' : st === 'mine' ? 'Tu reserva' : '—'}</span>
            </button>
          )
        })}
      </div>
      {hour !== null && (
        <div className="space-y-3 rounded-3xl border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Clock className="size-4 text-[#1f7a3d]" /> {DAY_NAMES[d.getDay()]} {d.getDate()} · {hourLabel(hour)} · {formatCOP(priceAt(hour))}
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
              <span className="mb-1 block text-xs font-bold text-ink-soft">Jugadores</span>
              <select className={input} value={players} onChange={(e) => setPlayers(e.target.value)}>
                {[6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => (
                  <option key={n} value={n}>
                    {n} jugadores
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className={`${btn.primary} w-full`}
            disabled={!valid}
            onClick={() => {
              const r = add({ day: key, hour, name: name.trim(), whatsapp: whatsapp.trim(), players: Number(players), price: priceAt(hour) })
              toast(`Reserva ${r.id} enviada: pendiente de confirmación (demostración, sin cobro).`, 'success')
              setHour(null)
            }}
          >
            <CalendarDays className="size-4" /> Reservar cancha
          </button>
          <p className="text-[11px] text-ink-soft">Demostración: no hay pago. La cancha confirmaría la reserva por WhatsApp.</p>
        </div>
      )}
    </div>
  )
}

function MyReservations() {
  const all = useReservations((s) => s.reservations)
  const reservations = useMemo(() => all.filter((r) => r.status === 'pending'), [all])
  const cancel = useReservations((s) => s.cancel)
  if (!reservations.length) return null
  return (
    <section>
      <SectionTitle>Mis reservas</SectionTitle>
      <ul className="space-y-2">
        {reservations.map((r) => {
          const [y, m, dd] = r.day.split('-').map(Number)
          const date = new Date(y, m - 1, dd)
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#1f7a3d]/10 text-[#1f7a3d]">
                <Users className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {DAY_NAMES[date.getDay()]} {dd} · {hourLabel(r.hour)}
                </span>
                <span className="block text-xs text-ink-soft">
                  <span className="font-mono">{r.id}</span> · {r.players} jugadores · {formatCOP(r.price)} · Pendiente de confirmación
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

function BallIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m12 7.5 3.4 2.5-1.3 4h-4.2l-1.3-4Z" fill="currentColor" />
      <path d="M12 2.5v5M15.4 10l4.8-1.6M14.1 14l3 4M9.9 14l-3 4M8.6 10 3.8 8.4" />
    </svg>
  )
}

/** Ilustraciones vectoriales de demostración (no son fotos reales). */
function Illustration({ kind, caption }: { kind: 'aerial' | 'night' | 'goal'; caption: string }) {
  const night = kind === 'night'
  return (
    <figure className="w-48 shrink-0">
      <svg viewBox="0 0 192 120" className="h-28 w-48 rounded-2xl" role="img" aria-label={caption}>
        <rect width="192" height="120" fill={night ? '#16233d' : '#d8ecd9'} />
        {kind === 'goal' ? (
          <>
            <rect x="0" y="78" width="192" height="42" fill="#3f9a4a" />
            <path d="M40 80V34h112v46" fill="none" stroke="#fff" strokeWidth="5" />
            <path d="M44 38h104v40H44Z" fill="none" stroke="#ffffff99" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="120" cy="96" r="9" fill="#fff" stroke="#222" strokeWidth="2" />
          </>
        ) : (
          <>
            <g transform="translate(96 62) skewX(-28) scale(1 0.62)">
              <rect x="-72" y="-58" width="144" height="116" fill={night ? '#2f7d3a' : '#46a552'} />
              <rect x="-66" y="-52" width="132" height="104" fill="none" stroke="#fff" strokeWidth="2.5" />
              <line x1="0" y1="-52" x2="0" y2="52" stroke="#fff" strokeWidth="2.5" />
              <circle cx="0" cy="0" r="16" fill="none" stroke="#fff" strokeWidth="2.5" />
              <rect x="-66" y="-16" width="14" height="32" fill="none" stroke="#fff" strokeWidth="2.5" />
              <rect x="52" y="-16" width="14" height="32" fill="none" stroke="#fff" strokeWidth="2.5" />
            </g>
            {night &&
              [
                [22, 14],
                [170, 14],
                [22, 108],
                [170, 108],
              ].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="7" fill="#fff6d8" opacity="0.95" />)}
            {[
              [80, 56, '#e0735f'],
              [106, 70, '#2bb3b1'],
              [96, 50, '#2bb3b1'],
              [118, 58, '#e0735f'],
            ].map(([x, y, c]) => (
              <circle key={`${x}${y}`} cx={x as number} cy={y as number} r="4" fill={c as string} />
            ))}
          </>
        )}
      </svg>
      <figcaption className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
        <Shirt className="size-3" /> {caption} · ilustración
      </figcaption>
    </figure>
  )
}
