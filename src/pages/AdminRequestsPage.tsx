import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../remote/client'
import { useProfile } from '../remote/profile'
import { useSession } from '../remote/session'
import { STATUS_LABEL, STATUS_STYLE, type RequestStatus, type StoreRequest } from '../state/storeRequests'
import { btn } from '../ui/bits'

type Row = StoreRequest & { profiles: { email: string | null } | null }

/** /admin/solicitudes: solo para role 'admin'. */
export default function AdminRequestsPage() {
  const s = useSession()
  const { role, loading } = useProfile()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<RequestStatus | 'todas'>('pendiente')
  const isAdmin = role === 'admin'
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error: err } = await supabase.from('store_requests').select('*, profiles(email)').order('created_at', { ascending: false })
    if (err) setError('No pudimos cargar las solicitudes.')
    else setRows(data as unknown as Row[])
  }, [])
  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  if (!supabase) return <p className="p-6 text-sm">Sin base de datos conectada.</p>
  if (!s.ready || (s.userId && (loading || role === null))) return <p className="p-6 text-sm text-ink-soft">Cargando…</p>
  if (!s.userId) return <Navigate to="/login?redirect=/admin/solicitudes" replace />
  if (!isAdmin) return <Navigate to="/mi-cuenta" replace />

  const decide = async (id: string, status: RequestStatus) => {
    setError(null)
    const { error: err } = await supabase!.rpc('decide_store_request', { p_id: id, p_status: status })
    if (err) setError('No pudimos actualizar la solicitud.')
    else setRows((r) => r?.map((x) => (x.id === id ? { ...x, status } : x)) ?? r)
  }
  const remove = async (id: string) => {
    setError(null)
    const { error: err, count } = await supabase!.from('store_requests').delete({ count: 'exact' }).eq('id', id)
    if (err || !count) setError('No pudimos eliminar la solicitud.')
    else setRows((r) => r?.filter((x) => x.id !== id) ?? r)
  }
  const shown = rows?.filter((r) => filter === 'todas' || r.status === filter) ?? []
  return (
    <div className="mx-auto min-h-dvh max-w-2xl bg-sand px-4 pt-6 pb-16">
      <Link to="/mi-cuenta" className="text-sm font-bold text-brand">← Mi cuenta</Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Solicitudes de locales</h1>
      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {(['pendiente', 'aprobada', 'rechazada', 'todas'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === f ? 'bg-brand text-white' : 'bg-card text-ink'}`}>
            {f === 'todas' ? 'Todas' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      {rows === null ? (
        <p className="mt-4 text-sm text-ink-soft">Cargando…</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No hay solicitudes en esta lista.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{r.business_name}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{r.category} · {r.phone} · {r.profiles?.email ?? 'sin correo'}</p>
              <p className="mt-2 text-sm">{r.description}</p>
              <p className="mt-1 text-xs text-ink-soft">{new Date(r.created_at).toLocaleString('es-CO')}</p>
              {r.status === 'pendiente' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className={btn.primary} onClick={() => void decide(r.id, 'aprobada')}>Aprobar</button>
                  <button className={btn.secondary} onClick={() => void decide(r.id, 'rechazada')}>Rechazar</button>
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <button
                  className="inline-flex items-center gap-1 text-xs font-bold text-red-600 underline-offset-2 hover:underline"
                  onClick={() => {
                    if (confirmId === r.id) void remove(r.id)
                    else setConfirmId(r.id)
                  }}
                  onBlur={() => setConfirmId(null)}
                >
                  <Trash2 className="size-3.5" /> {confirmId === r.id ? '¿Seguro? Toca otra vez para eliminar' : 'Eliminar solicitud'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
