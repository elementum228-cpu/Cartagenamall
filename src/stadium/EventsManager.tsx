import { CalendarPlus, Check, MessageCircle, Music2, Pencil, Plus, Radio, Trash2, Trophy, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { EVENT_KINDS } from '../config/stadium'
import { formatCOP } from '../lib/format'
import { openWhatsApp, whatsappLink } from '../lib/restaurant'
import { remoteEnabled } from '../remote/client'
import { MAX_SONG_BYTES, uploadStadiumSong } from '../remote/photos'
import { stopStadiumSound, useStadiumEvent, useStadiumPhase } from '../state/stadium'
import { newEventId, useCanManageStadium, useSold, useStadiumConfig, useStadiumEvents, useTickets } from '../state/stadiumEvents'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'
import { NEXT_TICKET_STATUS, tierLeft, validateEvent } from './logic'
import { TICKET_STATUS_LABEL, type StadiumEvent, type TicketTier } from './types'

// Gestión de eventos y boletas del estadio: la usan el administrador y el negocio que opera el estadio.

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const blank = (): StadiumEvent => {
  const d = new Date(Date.now() + 7 * 86400_000)
  d.setHours(20, 0, 0, 0)
  return {
    id: newEventId(),
    title: '',
    subtitle: '',
    kind: 'concert',
    startsAt: d.toISOString(),
    description: '',
    status: 'draft',
    tiers: [{ id: 't1', name: 'General', price: 50000, capacity: 200 }],
    songUrl: null,
    createdAt: new Date().toISOString(),
  }
}

export function EventsManager() {
  const can = useCanManageStadium()
  const events = useStadiumEvents((s) => s.events)
  const [editing, setEditing] = useState<StadiumEvent | null>(null)
  const sorted = useMemo(() => [...events].sort((a, b) => b.startsAt.localeCompare(a.startsAt)), [events])
  if (!can) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold">Eventos y boletas</p>
          <p className="text-xs text-ink-soft">Partidos y conciertos. Lo publicado aparece al tocar el estadio.</p>
        </div>
        {!editing && (
          <button className={btn.primary} onClick={() => setEditing(blank())}>
            <CalendarPlus className="size-4" /> Nuevo evento
          </button>
        )}
      </div>
      {editing ? (
        <EventForm key={editing.id} initial={editing} isNew={!events.some((e) => e.id === editing.id)} onClose={() => setEditing(null)} />
      ) : !sorted.length ? (
        <p className="rounded-2xl bg-sand p-4 text-center text-sm text-ink-soft">Aún no hay eventos. Crea el primero.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((e) => (
            <EventRow key={e.id} ev={e} onEdit={() => setEditing(e)} />
          ))}
        </ul>
      )}
    </div>
  )
}

const STATUS_LABEL = { draft: 'Borrador', published: 'Publicado', cancelled: 'Cancelado' } as const

function EventRow({ ev, onEdit }: { ev: StadiumEvent; onEdit: () => void }) {
  const sold = useSold()
  const active = useStadiumConfig((s) => s.activeEventId === ev.id)
  const setConfig = useStadiumConfig((s) => s.set)
  const setKind = useStadiumEvent((s) => s.setKind)
  const setPhase = useStadiumPhase((s) => s.setPhase)
  const toast = useUI((s) => s.toast)
  const [open, setOpen] = useState(false)
  const total = ev.tiers.reduce((n, t) => n + t.capacity, 0)
  const left = ev.tiers.reduce((n, t) => n + tierLeft(t, sold, ev.id), 0)
  return (
    <li className="rounded-2xl border border-line bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft uppercase">
            {ev.kind === 'concert' ? <Music2 className="size-3.5" /> : <Trophy className="size-3.5" />}
            {new Date(ev.startsAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {STATUS_LABEL[ev.status]}
            {active && <span className="rounded-full bg-coral px-1.5 py-0.5 text-[10px] text-white">En escena</span>}
          </p>
          <p className="truncate font-bold">{ev.title}</p>
          <p className="text-xs text-ink-soft">
            Vendidas {total - left} de {total}
            {ev.songUrl ? ' · con canción' : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button className={`${btn.icon} !size-9`} aria-label="Editar" onClick={onEdit}>
            <Pencil className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className={btn.secondary}
          onClick={() => {
            stopStadiumSound()
            if (active) {
              setConfig({ activeEventId: null })
              return toast('El evento salió de escena.')
            }
            setConfig({ activeEventId: ev.id })
            setKind(ev.kind)
            setPhase('open')
            toast(`«${ev.title}» está en escena en el estadio.`, 'success')
          }}
        >
          <Radio className="size-4" /> {active ? 'Quitar de escena' : 'Poner en escena'}
        </button>
        <button className={btn.ghost} onClick={() => setOpen((o) => !o)}>
          {open ? 'Ocultar boletas' : 'Ver boletas'}
        </button>
      </div>
      {open && <TicketList ev={ev} />}
    </li>
  )
}

function TicketList({ ev }: { ev: StadiumEvent }) {
  const all = useTickets((s) => s.tickets)
  const setStatus = useTickets((s) => s.setStatus)
  const list = all.filter((t) => t.eventId === ev.id)
  if (!list.length) return <p className="mt-3 rounded-xl bg-sand p-3 text-center text-xs text-ink-soft">Aún no hay reservas.</p>
  return (
    <ul className="mt-3 space-y-2">
      {list.map((t) => (
        <li key={t.id} className="rounded-xl bg-sand p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-bold">
                {t.buyerName} · <span className="font-mono">{t.code}</span>
              </p>
              <p className="text-xs text-ink-soft">
                {t.qty} × {t.tierName} · {t.total === 0 ? 'Gratis' : formatCOP(t.total)} · {t.whatsapp}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-bold">{TICKET_STATUS_LABEL[t.status]}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {NEXT_TICKET_STATUS[t.status].map((next) => (
              <button key={next} className={`${next === 'cancelled' ? btn.ghost : btn.secondary} !px-3 !py-1.5 text-xs`} onClick={() => setStatus(t.id, next)}>
                {next === 'confirmed' ? 'Confirmar pago' : next === 'used' ? 'Marcar usada' : 'Cancelar'}
              </button>
            ))}
            <button
              className={`${btn.ghost} !px-3 !py-1.5 text-xs`}
              onClick={() =>
                openWhatsApp(
                  whatsappLink(t.whatsapp, `Hola ${t.buyerName}, sobre tus boletas ${t.code} para «${t.eventTitle}»: ${t.status === 'confirmed' ? 'ya están confirmadas.' : 'te escribo para confirmar el pago.'}`),
                )
              }
            >
              <MessageCircle className="size-3.5" /> Escribir
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function EventForm({ initial, isNew, onClose }: { initial: StadiumEvent; isNew: boolean; onClose: () => void }) {
  const [ev, setEv] = useState<StadiumEvent>(initial)
  const [busy, setBusy] = useState(false)
  const upsert = useStadiumEvents((s) => s.upsert)
  const remove = useStadiumEvents((s) => s.remove)
  const toast = useUI((s) => s.toast)
  const file = useRef<HTMLInputElement>(null)
  const patch = (p: Partial<StadiumEvent>) => setEv((e) => ({ ...e, ...p }))
  const setTier = (id: string, p: Partial<TicketTier>) => patch({ tiers: ev.tiers.map((t) => (t.id === id ? { ...t, ...p } : t)) })

  const pick = async (f: File) => {
    if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|wav|ogg|mp4)$/i.test(f.name)) return toast('Elige un archivo de audio.', 'error')
    if (f.size > MAX_SONG_BYTES) return toast('El audio pesa más de 10 MB.', 'error')
    setBusy(true)
    try {
      patch({ songUrl: remoteEnabled() ? await uploadStadiumSong(f) : URL.createObjectURL(f) })
      toast('Canción cargada.', 'success')
    } catch (e) {
      toast(e instanceof Error ? `No se pudo subir: ${e.message}` : 'No se pudo subir la canción.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const save = (status: StadiumEvent['status']) => {
    const next = { ...ev, status, tiers: ev.tiers.map((t) => ({ ...t, name: t.name.trim(), price: Math.round(t.price), capacity: Math.round(t.capacity) })) }
    const problem = validateEvent(next)
    if (problem) return toast(problem, 'error')
    upsert(next)
    toast(status === 'published' ? 'Evento publicado.' : 'Evento guardado.', 'success')
    onClose()
  }

  return (
    <div className="space-y-3 rounded-3xl border border-line bg-card p-4">
      <div className="flex gap-2">
        {EVENT_KINDS.map((k) => (
          <button key={k.id} aria-pressed={ev.kind === k.id} onClick={() => patch({ kind: k.id })} className={`rounded-full px-4 py-2 text-sm font-bold ${ev.kind === k.id ? 'bg-ink text-white' : 'border border-line bg-white text-ink-soft'}`}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-ink-soft">
          Nombre del evento
          <input className={`${input} mt-1`} value={ev.title} maxLength={60} onChange={(e) => patch({ title: e.target.value })} placeholder={ev.kind === 'concert' ? 'Concierto de Luister La Voz' : 'Real Cartagena vs. Barranquilla'} />
        </label>
        <label className="block text-xs font-bold text-ink-soft">
          {ev.kind === 'concert' ? 'Artista invitado' : 'Rival o categoría'} (opcional)
          <input className={`${input} mt-1`} value={ev.subtitle} maxLength={60} onChange={(e) => patch({ subtitle: e.target.value })} />
        </label>
        <label className="block text-xs font-bold text-ink-soft">
          Fecha y hora
          <input type="datetime-local" className={`${input} mt-1`} value={toLocalInput(ev.startsAt)} onChange={(e) => e.target.value && patch({ startsAt: new Date(e.target.value).toISOString() })} />
        </label>
      </div>
      <label className="block text-xs font-bold text-ink-soft">
        Descripción (opcional)
        <textarea className={`${input} mt-1 min-h-20`} value={ev.description} maxLength={400} onChange={(e) => patch({ description: e.target.value })} />
      </label>

      <div>
        <p className="text-xs font-bold text-ink-soft">Tipos de boleta</p>
        <ul className="mt-1 space-y-2">
          {ev.tiers.map((t) => (
            <li key={t.id} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_8rem_6rem_auto]">
              <label className="block text-[11px] font-bold text-ink-soft">
                Nombre
                <input className={`${input} mt-0.5`} value={t.name} maxLength={30} onChange={(e) => setTier(t.id, { name: e.target.value })} />
              </label>
              <button className={`${btn.icon} !size-10 sm:order-last`} aria-label="Quitar tipo" disabled={ev.tiers.length === 1} onClick={() => patch({ tiers: ev.tiers.filter((x) => x.id !== t.id) })}>
                <X className="size-4" />
              </button>
              <label className="block text-[11px] font-bold text-ink-soft">
                Precio COP
                <input className={`${input} mt-0.5`} inputMode="numeric" value={t.price} onChange={(e) => setTier(t.id, { price: Number(e.target.value.replace(/\D/g, '')) })} />
              </label>
              <label className="block text-[11px] font-bold text-ink-soft">
                Cupo
                <input className={`${input} mt-0.5`} inputMode="numeric" value={t.capacity} onChange={(e) => setTier(t.id, { capacity: Number(e.target.value.replace(/\D/g, '')) })} />
              </label>
            </li>
          ))}
        </ul>
        <button className={`${btn.ghost} mt-2`} onClick={() => patch({ tiers: [...ev.tiers, { id: `t${Date.now().toString(36)}`, name: '', price: 0, capacity: 100 }] })}>
          <Plus className="size-4" /> Agregar tipo
        </button>
      </div>

      {ev.kind === 'concert' && (
        <div className="rounded-2xl bg-sand p-3">
          <p className="text-xs font-bold text-ink-soft">Canción de este concierto</p>
          <p className="text-[11px] text-ink-soft">Suena en el estadio (con el público) mientras este evento esté «en escena».</p>
          <input
            ref={file}
            type="file"
            accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
            className="hidden"
            aria-label="Subir canción del evento"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void pick(f)
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={btn.secondary} disabled={busy} onClick={() => file.current?.click()}>
              <Upload className="size-4" /> {busy ? 'Subiendo…' : ev.songUrl ? 'Cambiar canción' : 'Subir canción'}
            </button>
            {ev.songUrl && (
              <button className={btn.ghost} onClick={() => patch({ songUrl: null })}>
                <Trash2 className="size-4" /> Quitar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button className={btn.primary} onClick={() => save('published')}>
          <Check className="size-4" /> {ev.status === 'published' ? 'Guardar' : 'Publicar'}
        </button>
        {ev.status !== 'published' && (
          <button className={btn.secondary} onClick={() => save('draft')}>
            Guardar borrador
          </button>
        )}
        {ev.status === 'published' && (
          <button className={btn.secondary} onClick={() => save('cancelled')}>
            Cancelar evento
          </button>
        )}
        <button className={btn.ghost} onClick={onClose}>
          Cerrar
        </button>
        {!isNew && (
          <button
            className={`${btn.ghost} text-coral`}
            onClick={() => {
              if (!window.confirm('¿Eliminar este evento? Sus boletas dejarán de verse.')) return
              if (useStadiumConfig.getState().activeEventId === ev.id) useStadiumConfig.getState().set({ activeEventId: null })
              remove(ev.id)
              onClose()
            }}
          >
            <Trash2 className="size-4" /> Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
