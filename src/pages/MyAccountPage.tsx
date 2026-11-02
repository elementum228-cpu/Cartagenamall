import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { remoteEnabled, supabase } from '../remote/client'
import { useProfile } from '../remote/profile'
import { useSession } from '../remote/session'
import { REQUEST_CATEGORIES, STATUS_LABEL, STATUS_STYLE, type StoreRequest } from '../state/storeRequests'
import { btn, input } from '../ui/bits'

/** Mi cuenta: datos básicos y solicitud de local. */
export function MyAccountPage() {
  const s = useSession()
  const role = useProfile((p) => p.role)
  const [reqs, setReqs] = useState<StoreRequest[] | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !s.userId) return
    const { data } = await supabase.from('store_requests').select('*').eq('user_id', s.userId).order('created_at', { ascending: false })
    setReqs((data as StoreRequest[]) ?? [])
  }, [s.userId])
  useEffect(() => void load(), [load])

  if (!remoteEnabled()) return <p className="p-6 text-sm text-ink-soft">Las cuentas no están disponibles en el modo demostración.</p>
  if (!s.ready) return <p className="p-6 text-sm text-ink-soft">Cargando…</p>
  if (!s.userId) return <Navigate to="/login?redirect=/mi-cuenta" replace />

  const current = reqs?.[0]
  const active = current && current.status !== 'rechazada'
  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-28">
      <div className="glass-strong rounded-[28px] p-5">
        <p className="text-xs font-bold tracking-wider text-brand uppercase">Cartagena Mall</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Mi cuenta</h1>
        <p className="mt-1 text-sm break-all text-ink-soft">{s.email}</p>

        <div className="mt-4 flex flex-col gap-2.5">
          {role === 'admin' && (
            <Link to="/admin/solicitudes" className={btn.secondary}>
              Ver solicitudes de locales
            </Link>
          )}
          {reqs === null ? (
            <p className="text-sm text-ink-soft">Cargando…</p>
          ) : current ? (
            <div className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{current.business_name}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[current.status]}`}>{STATUS_LABEL[current.status]}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {current.category} · {current.phone}
              </p>
              <p className="mt-2 text-sm">{current.description}</p>
              {current.status === 'pendiente' && <p className="mt-2 text-xs text-ink-soft">Estamos revisando tu solicitud. Te avisaremos aquí mismo.</p>}
              {current.status === 'aprobada' && (
                <>
                  <p className="mt-2 text-xs font-semibold text-emerald-700">¡Tu local fue aprobado!</p>
                  <Link to="/mi-negocio" className={`${btn.primary} mt-3 w-full`}>
                    Gestionar mi local
                  </Link>
                </>
              )}
              {current.status === 'rechazada' && <p className="mt-2 text-xs text-ink-soft">No pudimos aprobar esta solicitud. Puedes enviar una nueva.</p>}
            </div>
          ) : null}
          {reqs !== null && !active && !open && (
            <button className={btn.primary} onClick={() => setOpen(true)}>
              Quiero un local en Cartagena Mall
            </button>
          )}
          {open && !active && (
            <RequestForm
              userId={s.userId}
              onDone={() => {
                setOpen(false)
                void load()
              }}
              onCancel={() => setOpen(false)}
            />
          )}
          <button className={btn.ghost} onClick={() => void s.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestForm({ userId, onDone, onCancel }: { userId: string; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ business_name: '', category: REQUEST_CATEGORIES[0], phone: '', description: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (f.business_name.trim().length < 2) return setError('Escribe el nombre de tu negocio.')
    if (f.phone.replace(/\D/g, '').length < 7) return setError('Escribe un teléfono válido.')
    if (f.description.trim().length < 10) return setError('Cuéntanos un poco más (mínimo 10 caracteres).')
    setBusy(true)
    setError(null)
    const { error: err } = await supabase!.from('store_requests').insert({
      user_id: userId,
      business_name: f.business_name.trim(),
      category: f.category,
      phone: f.phone.trim(),
      description: f.description.trim(),
    })
    setBusy(false)
    if (err) setError(err.code === '23505' ? 'Ya tienes una solicitud activa.' : 'No pudimos enviar tu solicitud. Inténtalo de nuevo.')
    else onDone()
  }
  return (
    <form className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4" onSubmit={submit} noValidate>
      <label className="block text-xs font-bold">
        Nombre del negocio
        <input className={`${input} mt-1`} value={f.business_name} onChange={set('business_name')} maxLength={80} />
      </label>
      <label className="block text-xs font-bold">
        Categoría
        <select className={`${input} mt-1`} value={f.category} onChange={set('category')}>
          {REQUEST_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-bold">
        Teléfono
        <input className={`${input} mt-1`} type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} maxLength={20} />
      </label>
      <label className="block text-xs font-bold">
        Descripción breve
        <textarea className={`${input} mt-1`} rows={3} value={f.description} onChange={set('description')} maxLength={500} />
      </label>
      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
      <button className={btn.primary} disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
      <button type="button" className={btn.ghost} onClick={onCancel}>Cancelar</button>
    </form>
  )
}
