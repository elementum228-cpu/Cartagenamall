import { Ban, CalendarPlus, Copy, KeyRound, Link2, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { formatDateTime } from '../lib/format'
import { supabase } from '../remote/client'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'

// Invitaciones a la versión de prueba: el administrador crea un código por persona (con
// vencimiento y número de dispositivos), lo comparte como enlace, ve quién entró y lo anula.

interface Invite {
  code: string
  name: string
  expires_at: string
  max_devices: number
  revoked: boolean
  created_at: string
}
interface Visit {
  code: string
  device: string
  at: string
}

const URL_KEY = 'cm:demo-url'
const DAYS = [3, 7, 15, 30]

/** Código legible: inicio del nombre + 4 caracteres al azar (sin letras que se confunden). */
function makeCode(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  const tail = Array.from(bytes, (b) => abc[b % abc.length]).join('')
  return `${base.length >= 2 ? base : 'INV'}-${tail}`
}

function readUrl() {
  try {
    return localStorage.getItem(URL_KEY) ?? (import.meta.env.VITE_DEMO_URL as string | undefined) ?? ''
  } catch {
    return ''
  }
}

export function DemoInvites() {
  const toast = useUI((s) => s.toast)
  const [invites, setInvites] = useState<Invite[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [demoUrl, setDemoUrl] = useState(readUrl)
  const [name, setName] = useState('')
  const [days, setDays] = useState(7)
  const [devices, setDevices] = useState(2)

  const load = useCallback(async () => {
    if (!supabase) return setLoading(false)
    const [inv, vis] = await Promise.all([
      supabase.from('demo_invites').select('*').order('created_at', { ascending: false }),
      supabase.from('demo_visits').select('code, device, at').order('at', { ascending: false }).limit(1000),
    ])
    if (inv.error) toast('No se pudieron cargar las invitaciones. ¿Corriste el SQL 0003 en Supabase?', 'error')
    setInvites((inv.data as Invite[]) ?? [])
    setVisits((vis.data as Visit[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const m: Record<string, { devices: Set<string>; entries: number; last: string | null }> = {}
    for (const v of visits) {
      const s = (m[v.code] ??= { devices: new Set(), entries: 0, last: null })
      s.devices.add(v.device)
      s.entries++
      if (!s.last || v.at > s.last) s.last = v.at
    }
    return m
  }, [visits])

  const linkFor = (code: string) => {
    const base = demoUrl.trim().replace(/\/+$/, '')
    return base ? `${base}/?c=${code}` : code
  }
  const share = async (inv: Invite) => {
    const ok = await copyText(linkFor(inv.code))
    toast(ok ? (demoUrl.trim() ? `Enlace de ${inv.name} copiado` : `Código de ${inv.name} copiado`) : linkFor(inv.code))
  }

  const create = async () => {
    if (!supabase || name.trim().length < 2) return
    const code = makeCode(name)
    const expires_at = new Date(Date.now() + days * 864e5).toISOString()
    const { error } = await supabase.from('demo_invites').insert({ code, name: name.trim(), expires_at, max_devices: devices })
    if (error) return toast('No se pudo crear la invitación.', 'error')
    setName('')
    await load()
    const ok = await copyText(linkFor(code))
    toast(ok ? `Invitación creada y copiada: ${code}` : `Invitación creada: ${code}`, 'success')
  }
  const update = async (code: string, patch: Partial<Invite>) => {
    if (!supabase) return
    const { error } = await supabase.from('demo_invites').update(patch).eq('code', code)
    if (error) toast('No se pudo guardar el cambio.', 'error')
    await load()
  }
  const remove = async (code: string) => {
    if (!supabase) return
    await supabase.from('demo_invites').delete().eq('code', code)
    await load()
  }

  if (!supabase)
    return <p className="rounded-2xl bg-amber-100 p-4 text-sm font-semibold text-amber-900">Las invitaciones necesitan la base de datos conectada (Supabase).</p>

  const now = Date.now()
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-card p-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <KeyRound className="size-5 text-brand" /> Versión de prueba por invitación
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Cada persona entra con su propio código: solo ve el mall 3D y las tiendas de ejemplo, con su nombre como marca de agua. Puedes anularlo cuando quieras y ver desde cuántos dispositivos entró.
        </p>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-bold text-ink-soft">Dirección de la versión de prueba</span>
          <div className="flex items-center gap-2">
            <Link2 className="size-4 shrink-0 text-ink-soft" />
            <input
              className={input}
              value={demoUrl}
              placeholder="https://cartagenamall-demo.pages.dev"
              onChange={(e) => {
                setDemoUrl(e.target.value)
                try {
                  localStorage.setItem(URL_KEY, e.target.value)
                } catch {
                  /* nada */
                }
              }}
            />
          </div>
        </label>
      </section>

      <section className="rounded-3xl border border-line bg-card p-4">
        <p className="font-bold">Nueva invitación</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_140px_150px_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Para quién</span>
            <input className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la persona" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Válida por</span>
            <select className={input} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Dispositivos</span>
            <select className={input} value={devices} onChange={(e) => setDevices(Number(e.target.value))}>
              {[1, 2, 3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? '1 dispositivo' : `Hasta ${n}`}
                </option>
              ))}
            </select>
          </label>
          <button className={btn.primary} disabled={name.trim().length < 2} onClick={() => void create()}>
            <UserPlus className="size-4" /> Crear y copiar
          </button>
        </div>
      </section>

      <section className="space-y-2">
        {loading ? (
          <p className="text-sm text-ink-soft">Cargando…</p>
        ) : !invites.length ? (
          <p className="rounded-3xl border border-dashed border-line p-4 text-sm text-ink-soft">Aún no has creado invitaciones.</p>
        ) : (
          invites.map((inv) => {
            const s = stats[inv.code]
            const expired = Date.parse(inv.expires_at) <= now
            const status = inv.revoked ? 'Anulada' : expired ? 'Vencida' : 'Activa'
            return (
              <article key={inv.code} className="rounded-2xl border border-line bg-card p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {inv.name} <span className="font-mono text-sm font-semibold text-ink-soft">· {inv.code}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      Vence {formatDateTime(inv.expires_at)} · {s ? s.devices.size : 0}/{inv.max_devices} dispositivos · {s ? `${s.entries} ${s.entries === 1 ? 'entrada' : 'entradas'}, la última ${formatDateTime(s.last!)}` : 'aún no ha entrado'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${status === 'Activa' ? 'bg-emerald-100 text-emerald-800' : 'bg-sand-2 text-ink-soft'}`}>{status}</span>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                  {status === 'Activa' && (
                    <button className={btn.ghost} onClick={() => void share(inv)}>
                      <Copy className="size-4" /> Copiar enlace
                    </button>
                  )}
                  <button className={btn.ghost} onClick={() => void update(inv.code, { expires_at: new Date(Math.max(now, Date.parse(inv.expires_at)) + 7 * 864e5).toISOString() })}>
                    <CalendarPlus className="size-4" /> +7 días
                  </button>
                  {inv.revoked ? (
                    <button className={btn.ghost} onClick={() => void update(inv.code, { revoked: false })}>
                      <RotateCcw className="size-4" /> Reactivar
                    </button>
                  ) : (
                    <button className={`${btn.ghost} text-red-600`} onClick={() => void update(inv.code, { revoked: true })}>
                      <Ban className="size-4" /> Anular
                    </button>
                  )}
                  <button className={`${btn.ghost} text-red-600`} onClick={() => void remove(inv.code)} aria-label={`Eliminar la invitación de ${inv.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}
