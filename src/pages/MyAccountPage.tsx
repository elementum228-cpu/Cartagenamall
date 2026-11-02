import { Camera, ChevronRight, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { remoteEnabled, supabase } from '../remote/client'
import { saveProfile, useProfile } from '../remote/profile'
import { readImageFile } from '../lib/image'
import { useUI } from '../state/ui'
import { useCatalog } from '../state/catalog'
import { useWelcome } from '../features/OwnerWelcome'
import { PasswordForm } from '../remote/AccountGate'
import { useSession } from '../remote/session'
import { REQUEST_CATEGORIES, STATUS_LABEL, STATUS_STYLE, type StoreRequest } from '../state/storeRequests'
import { StoreLogo, btn, input } from '../ui/bits'

/** Mi cuenta: datos básicos y solicitud de local. */
export function MyAccountPage() {
  const s = useSession()
  const role = useProfile((p) => p.role)
  const [reqs, setReqs] = useState<StoreRequest[] | null>(null)
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState(false)
  const pendingStore = useCatalog((c) => c.stores.find((x) => x.setup === 'pending' && s.storeIds.includes(x.id)))
  const reopenWelcome = useWelcome((w) => w.reopen)
  const allStores = useCatalog((c) => c.stores)
  const readyStores = allStores.filter((x) => x.setup !== 'pending' && s.storeIds.includes(x.id))

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
    <div className="mx-auto max-w-lg px-4 pt-8 pb-28">
      <div className="glass-strong rounded-[28px] p-5">
        <ProfileCard
          email={s.email}
          top={
            <>
              {pendingStore && (
                <button onClick={reopenWelcome} className="rounded-2xl bg-brand p-4 text-left text-white shadow-soft transition active:scale-[0.98]">
                  <span className="block text-sm font-bold opacity-90">🎉 ¡Tu solicitud fue aprobada!</span>
                  <span className="block text-lg font-extrabold">{pendingStore.name} ya es tuyo</span>
                  <span className="block text-sm opacity-90">Toca para empezar</span>
                </button>
              )}
              {readyStores.length > 0 && (
                <div>
                  <p className="mb-1.5 px-1 text-xs font-bold tracking-wide text-ink-soft uppercase">Mis negocios</p>
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                    {readyStores.map((st) => (
                      <li key={st.id}>
                        <Link to={`/mi-negocio?tienda=${st.id}`} className="flex items-center gap-3 p-3 transition active:bg-sand">
                          <StoreLogo store={st} size={46} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[16px] leading-tight font-bold">{st.name}</span>
                            <span className="block text-[13px] font-semibold text-brand">Modo dueño · Ir a mi negocio</span>
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-ink-soft" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {s.isAdmin && (
                <Link to="/admin" className="flex items-center justify-between rounded-2xl border border-line bg-card p-3.5 font-bold transition active:scale-[0.98]">
                  Administración del mall <ChevronRight className="size-5" />
                </Link>
              )}
              {role === 'admin' && (
                <Link to="/admin/solicitudes" className="flex items-center justify-between rounded-2xl border border-line bg-card p-3.5 font-bold transition active:scale-[0.98]">
                  Solicitudes de locales <ChevronRight className="size-5" />
                </Link>
              )}
            </>
          }
        />

        <div className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5">
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
                  {/* mientras la configuración está pendiente, el local no aparece: primero la bienvenida */}
                  {pendingStore ? (
                    <button onClick={reopenWelcome} className={`${btn.primary} mt-3 w-full`}>
                      Toca para empezar
                    </button>
                  ) : (
                    <Link to="/mi-negocio" className={`${btn.primary} mt-3 w-full`}>
                      Gestionar mi local
                    </Link>
                  )}
                </>
              )}
              {current.status === 'rechazada' && <p className="mt-2 text-xs text-ink-soft">No pudimos aprobar esta solicitud. Puedes enviar una nueva.</p>}
            </div>
          ) : null}
          {reqs !== null && !active && !open && (
            <button className={btn.primary} onClick={() => setOpen(true)}>
              Quiero un local en MallPlay
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
          <button className={btn.ghost} onClick={() => setPwd(!pwd)}>
            Cambiar contraseña
          </button>
          {pwd && <PasswordForm onDone={() => setPwd(false)} />}
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


/** Perfil personalizable: foto, nombre, celular y «sobre mí». Todo opcional. */
function ProfileCard({ email, top }: { email: string | null; top?: ReactNode }) {
  const p = useProfile()
  const toast = useUI((s) => s.toast)
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(p.fullName)
  const [phone, setPhone] = useState(p.phone)
  const [bio, setBio] = useState(p.bio)
  const [busy, setBusy] = useState(false)
  // los datos llegan de la base después de cargar la página
  useEffect(() => {
    setName(p.fullName)
    setPhone(p.phone)
    setBio(p.bio)
  }, [p.fullName, p.phone, p.bio])
  const dirty = name.trim() !== p.fullName || phone.trim() !== p.phone || bio.trim() !== p.bio
  const shown = name.trim() || p.fullName

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = await readImageFile(file, 'avatar')
      const err = await saveProfile({ avatar: data })
      toast(err ?? 'Foto de perfil actualizada', err ? 'error' : 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cargar la foto.', 'error')
    }
  }
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (phone.trim() && phone.replace(/\D/g, '').length < 7) return toast('Escribe un celular válido o déjalo vacío.', 'error')
    setBusy(true)
    const err = await saveProfile({ fullName: name, phone, bio })
    setBusy(false)
    toast(err ?? 'Perfil guardado', err ? 'error' : 'success')
  }

  return (
    <div>
      <p className="text-xs font-bold tracking-wider text-brand uppercase">MallPlay</p>
      <div className="mt-3 flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="group relative shrink-0" aria-label="Cambiar foto de perfil">
          {p.avatar ? (
            <img src={p.avatar} alt="Tu foto de perfil" className="size-24 rounded-full object-cover ring-2 ring-white shadow-soft" />
          ) : (
            <span className="grid size-24 place-items-center rounded-full text-4xl font-extrabold text-white ring-2 ring-white shadow-soft" style={{ background: p.color }}>
              {(shown || email || '?').trim().slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full bg-ink text-white shadow-soft transition group-active:scale-90">
            <Camera className="size-4" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0]).then(() => (e.target.value = ''))} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{shown || 'Mi cuenta'}</h1>
          <p className="text-sm break-all text-ink-soft">{email}</p>
          {p.avatar && (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft underline-offset-2 hover:underline"
              onClick={async () => toast((await saveProfile({ avatar: null })) ?? 'Foto quitada', 'success')}
            >
              <Trash2 className="size-3" /> Quitar foto
            </button>
          )}
        </div>
      </div>

      {top && <div className="mt-4 flex flex-col gap-2.5">{top}</div>}

      <form className="mt-5 flex flex-col gap-3" onSubmit={save} noValidate>
        <label className="block text-xs font-bold">
          Nombre <span className="font-medium text-ink-soft">(opcional)</span>
          <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder="Cómo te llamas" />
        </label>
        <label className="block text-xs font-bold">
          Celular <span className="font-medium text-ink-soft">(opcional)</span>
          <input className={`${input} mt-1`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="300 123 4567" />
        </label>
        <label className="block text-xs font-bold">
          Correo de la cuenta
          <input className={`${input} mt-1 opacity-70`} value={email ?? ''} readOnly />
        </label>
        <label className="block text-xs font-bold">
          Sobre mí <span className="font-medium text-ink-soft">(opcional)</span>
          <textarea className={`${input} mt-1`} rows={2} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} placeholder="Algo corto sobre ti" />
        </label>
        <button className={btn.primary} disabled={!dirty || busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
