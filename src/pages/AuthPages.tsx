import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useProfile, type Role } from '../remote/profile'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { btn, input } from '../ui/bits'

/** Solo rutas internas: evita redirecciones a sitios externos. */
function safeRedirect(r: string | null): string | null {
  return r && r.startsWith('/') && !r.startsWith('//') && !r.includes('\\') ? r : null
}

/** Tras entrar: vuelve a la ruta pedida; si no, cliente → inicio y negocio → panel. */
function useAfterAuth() {
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const s = useSession()
  const { role, loading } = useProfile()
  const target = !s.userId || loading || !role ? null : (redirect ?? (role === 'negocio' ? '/panel-negocio' : '/'))
  return { redirect, target, fromCheckout: redirect?.startsWith('/checkout') ?? false }
}

function Shell({ title, children, fromCheckout }: { title: string; children: React.ReactNode; fromCheckout: boolean }) {
  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-28">
      <div className="glass-strong rounded-[28px] p-5">
        <p className="text-xs font-bold tracking-wider text-brand uppercase">Cartagena Mall</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
        {fromCheckout && <p className="mt-3 rounded-2xl bg-sand p-3 text-sm font-semibold">Inicia sesión para completar tu compra</p>}
        {!remoteEnabled() ? <p className="mt-4 rounded-2xl bg-sand p-3 text-sm text-ink-soft">Las cuentas no están disponibles en el modo demostración.</p> : children}
      </div>
    </div>
  )
}

function PasswordField({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block text-xs font-bold text-ink">
      Contraseña
      <span className="relative mt-1 block">
        <input className={`${input} pr-12`} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
        <button
          type="button"
          className="absolute inset-y-0 right-1 grid w-10 place-items-center text-ink-soft"
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  )
}

const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

export function AuthLoginPage() {
  const { signInWithPassword } = useSession()
  const { redirect, target, fromCheckout } = useAfterAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (target) return <Navigate to={target} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validEmail(email)) return setError('Escribe un correo válido.')
    if (password.length < 8) return setError('La contraseña tiene mínimo 8 caracteres.')
    setBusy(true)
    setError(null)
    const err = await signInWithPassword(email, password)
    setBusy(false)
    if (err) setError(err)
  }
  return (
    <Shell title="Iniciar sesión" fromCheckout={fromCheckout}>
      <form className="mt-4 flex flex-col gap-3" onSubmit={submit} noValidate>
        <label className="block text-xs font-bold text-ink">
          Correo
          <input className={`${input} mt-1`} type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
        <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿No tienes cuenta?{' '}
        <Link to={`/registro${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-bold text-brand">Regístrate</Link>
      </p>
    </Shell>
  )
}

export function RegisterPage() {
  const { signUp } = useSession()
  const navigate = useNavigate()
  const { redirect, target, fromCheckout } = useAfterAuth()
  const [role, setRole] = useState<Role>('cliente')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [business, setBusiness] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => setError(null), [role])
  if (target) return <Navigate to={target} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validEmail(email)) return setError('Escribe un correo válido.')
    if (password.length < 8) return setError('La contraseña debe tener mínimo 8 caracteres.')
    if (role === 'negocio' && business.trim().length < 2) return setError('Escribe el nombre de tu negocio.')
    setBusy(true)
    setError(null)
    const r = await signUp(email, password, role, business)
    setBusy(false)
    if (r.error) setError(r.error)
    else if (r.needsConfirm) setConfirm(true)
  }
  return (
    <Shell title="Crear cuenta" fromCheckout={fromCheckout}>
      {confirm ? (
        <div className="mt-4 text-sm">
          <p>Te enviamos un correo a <b>{email}</b>. Confírmalo y luego inicia sesión.</p>
          <button className={`${btn.secondary} mt-3 w-full`} onClick={() => navigate(`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`)}>Ir a iniciar sesión</button>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Tipo de cuenta" className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-sand p-1">
            {(['cliente', 'negocio'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                className={`rounded-xl py-2.5 text-sm font-bold transition ${role === r ? 'bg-white text-brand shadow-soft' : 'text-ink-soft'}`}
              >
                {r === 'cliente' ? 'Cliente' : 'Negocio'}
              </button>
            ))}
          </div>
          <form className="mt-3 flex flex-col gap-3" onSubmit={submit} noValidate>
            {role === 'negocio' && (
              <label className="block text-xs font-bold text-ink">
                Nombre del negocio
                <input className={`${input} mt-1`} autoComplete="organization" value={business} onChange={(e) => setBusiness(e.target.value)} />
              </label>
            )}
            <label className="block text-xs font-bold text-ink">
              Correo
              <input className={`${input} mt-1`} type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
            <p className="-mt-1 text-xs text-ink-soft">Mínimo 8 caracteres.</p>
            {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
            <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear cuenta'}</button>
          </form>
        </>
      )}
      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿Ya tienes cuenta?{' '}
        <Link to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-bold text-brand">Inicia sesión</Link>
      </p>
    </Shell>
  )
}
