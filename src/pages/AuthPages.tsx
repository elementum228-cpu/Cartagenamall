import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { btn, input } from '../ui/bits'

/** Solo rutas internas: evita redirecciones a sitios externos. */
function safeRedirect(r: string | null): string | null {
  return r && r.startsWith('/') && !r.startsWith('//') && !r.includes('\\') ? r : null
}

/** Tras entrar: vuelve a la ruta pedida; si no, a /mi-cuenta. */
function useAfterAuth() {
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const s = useSession()
  const target = s.userId ? (redirect ?? '/mi-cuenta') : null
  return { redirect, target, fromCheckout: redirect?.startsWith('/checkout') ?? false }
}

function Shell({ title, children, fromCheckout }: { title: string; children: React.ReactNode; fromCheckout: boolean }) {
  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-28">
      <div className="glass-strong rounded-[28px] p-5">
        <p className="text-xs font-bold tracking-wider text-brand uppercase">MallPlay</p>
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
        <Link to="/recuperar" className="text-center text-sm font-semibold text-brand">¿Olvidaste tu contraseña?</Link>
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  if (target) return <Navigate to={target} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validEmail(email)) return setError('Escribe un correo válido.')
    if (password.length < 8) return setError('La contraseña debe tener mínimo 8 caracteres.')
    setBusy(true)
    setError(null)
    const r = await signUp(email, password)
    setBusy(false)
    if (r.error) setError(r.error)
    else if (r.needsConfirm) setConfirm(true)
  }
  const q = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
  return (
    <Shell title="Crear cuenta" fromCheckout={fromCheckout}>
      {confirm ? (
        <div className="mt-4 text-sm">
          <p>Te enviamos un correo a <b>{email}</b>. Confírmalo y luego inicia sesión.</p>
          <button className={`${btn.secondary} mt-3 w-full`} onClick={() => navigate(`/login${q}`)}>Ir a iniciar sesión</button>
        </div>
      ) : (
        <form className="mt-4 flex flex-col gap-3" onSubmit={submit} noValidate>
          <label className="block text-xs font-bold text-ink">
            Correo
            <input className={`${input} mt-1`} type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
          <p className="-mt-1 text-xs text-ink-soft">Mínimo 8 caracteres.</p>
          {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
          <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear cuenta'}</button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿Ya tienes cuenta? <Link to={`/login${q}`} className="font-bold text-brand">Inicia sesión</Link>
      </p>
    </Shell>
  )
}

/** /recuperar: pide el correo y envía el enlace para elegir una contraseña nueva. */
export function ForgotPasswordPage() {
  const { resetPassword } = useSession()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validEmail(email)) return setError('Escribe un correo válido.')
    setBusy(true)
    setError(null)
    const err = await resetPassword(email)
    setBusy(false)
    if (err) setError(err)
    else setSent(true)
  }
  return (
    <Shell title="Recuperar contraseña" fromCheckout={false}>
      {sent ? (
        <p className="mt-4 text-sm">
          Si <b>{email}</b> tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.
        </p>
      ) : (
        <form className="mt-4 flex flex-col gap-3" onSubmit={submit} noValidate>
          <p className="text-sm text-ink-soft">Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva.</p>
          <label className="block text-xs font-bold text-ink">
            Correo
            <input className={`${input} mt-1`} type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
          <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace'}</button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-bold text-brand">Volver a iniciar sesión</Link>
      </p>
    </Shell>
  )
}

/** /restablecer: destino del enlace del correo; el enlace inicia una sesión temporal para cambiar la contraseña. */
export function ResetPasswordPage() {
  const s = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), 3000)
    return () => clearTimeout(id)
  }, [])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('La contraseña debe tener mínimo 8 caracteres.')
    setBusy(true)
    setError(null)
    const err = await s.setPassword(password)
    setBusy(false)
    if (err) setError(/same|different/i.test(err) ? 'Elige una contraseña distinta a la anterior.' : 'No pudimos cambiar la contraseña. Pide un enlace nuevo.')
    else setDone(true)
  }
  return (
    <Shell title="Nueva contraseña" fromCheckout={false}>
      {done ? (
        <div className="mt-4 text-sm">
          <p className="font-semibold">¡Listo! Tu contraseña fue cambiada.</p>
          <button className={`${btn.primary} mt-3 w-full`} onClick={() => navigate('/mi-cuenta', { replace: true })}>Ir a mi cuenta</button>
        </div>
      ) : s.userId ? (
        <form className="mt-4 flex flex-col gap-3" onSubmit={submit} noValidate>
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
          <p className="-mt-1 text-xs text-ink-soft">Mínimo 8 caracteres.</p>
          {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
          <button className={`${btn.primary} w-full`} disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      ) : !s.ready || !waited ? (
        <p className="mt-4 text-sm text-ink-soft">Verificando enlace…</p>
      ) : (
        <div className="mt-4 text-sm">
          <p>Este enlace no es válido o ya venció.</p>
          <Link to="/recuperar" className={`${btn.primary} mt-3 w-full`}>Pedir un enlace nuevo</Link>
        </div>
      )}
    </Shell>
  )
}
