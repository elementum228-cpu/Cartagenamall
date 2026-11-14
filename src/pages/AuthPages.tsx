import { AlertCircle, Eye, EyeOff, KeyRound, Lock, Mail, ShoppingBag, UserPlus, UserRound, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'

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

// Diseño de las pantallas de cuenta: sin tarjeta ni sombra pesada; un resplandor suave de marca arriba, un título claro y campos
// grandes (16 px, para que el iPhone no haga zoom) con ícono. Una sola acción principal por pantalla; la otra va como botón de contorno.
const FIELD =
  'field-clean peer h-14 w-full rounded-2xl border border-line bg-white pr-4 pl-12 text-[16px] text-ink outline-none transition placeholder:text-ink-soft/55 focus:border-teal focus:ring-4 focus:ring-teal/15'
const PRIMARY =
  'flex h-14 w-full items-center justify-center rounded-2xl bg-teal text-[16px] font-extrabold tracking-[-0.01em] text-white shadow-[0_12px_24px_-14px_rgb(0_141_135/0.9)] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60'
const OUTLINE =
  'flex h-14 w-full items-center justify-center rounded-2xl border border-line bg-white text-[15px] font-bold text-ink transition active:scale-[0.985]'

function Shell({ title, subtitle, icon: Icon, children, fromCheckout }: { title: string; subtitle?: string; icon: LucideIcon; children: React.ReactNode; fromCheckout: boolean }) {
  return (
    <div className="relative mx-auto max-w-md px-6 pt-16 pb-36 md:pt-24">
      {/* resplandor de marca: turquesa a la izquierda, ámbar a la derecha (solo color, sin sombras) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px]"
        style={{ background: 'radial-gradient(110% 80% at 15% 0%, rgb(19 185 173 / 0.2), transparent 62%), radial-gradient(80% 70% at 100% 8%, rgb(247 179 75 / 0.16), transparent 58%)' }}
      />
      <div className="relative">
        <span className="grid size-12 place-items-center rounded-[18px] bg-gradient-to-br from-teal-bright to-teal text-white">
          <Icon className="size-6" strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 text-[32px] leading-[1.05] font-extrabold tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] leading-snug text-ink-soft">{subtitle}</p>}
        {fromCheckout && (
          <p className="mt-5 flex items-center gap-2.5 rounded-2xl bg-teal/10 px-3.5 py-3 text-[14px] font-semibold text-teal">
            <ShoppingBag className="size-[18px] shrink-0" strokeWidth={2} />
            Inicia sesión para completar tu compra
          </p>
        )}
        {!remoteEnabled() ? <p className="mt-6 rounded-2xl bg-sand-2/70 p-4 text-sm text-ink-soft">Las cuentas no están disponibles en el modo demostración.</p> : children}
      </div>
    </div>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</span>
      <span className="relative block">
        {children}
        <Icon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-soft transition peer-focus:text-teal" strokeWidth={1.8} />
      </span>
    </label>
  )
}

function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Correo" icon={Mail}>
      <input className={FIELD} type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function PasswordField({ value, onChange, autoComplete, label = 'Contraseña' }: { value: string; onChange: (v: string) => void; autoComplete: string; label?: string }) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label} icon={Lock}>
      <input className={`${FIELD} pr-14`} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder="••••••••" value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="absolute inset-y-0 right-1 grid w-12 place-items-center text-ink-soft" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShow((v) => !v)}>
        {show ? <EyeOff className="size-5" strokeWidth={1.8} /> : <Eye className="size-5" strokeWidth={1.8} />}
      </button>
    </Field>
  )
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] leading-snug font-semibold text-red-700">
      <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={2} />
      {children}
    </p>
  )
}

/** Separador «o» entre la acción principal y la alternativa. */
function Or() {
  return (
    <div className="flex items-center gap-3 py-1 text-[12px] font-semibold text-ink-soft" aria-hidden>
      <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
    </div>
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
    <Shell title="Hola de nuevo" subtitle="Entra para ver tus pedidos, tus favoritos y tus puntos del Arcade." icon={UserRound} fromCheckout={fromCheckout}>
      <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
        <EmailField value={email} onChange={setEmail} />
        <div>
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
          <Link to="/recuperar" className="mt-2 ml-auto block w-fit py-1 text-[13px] font-semibold text-teal">¿Olvidaste tu contraseña?</Link>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button className={PRIMARY} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <div className="mt-5 flex flex-col gap-4">
        <Or />
        <Link to={`/registro${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className={OUTLINE}>Crear una cuenta nueva</Link>
      </div>
    </Shell>
  )
}

export function RegisterPage() {
  const { signUp } = useSession()
  const navigate = useNavigate()
  const { redirect, target } = useAfterAuth()
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
    <Shell title="Crea tu cuenta" subtitle="Gratis y en un minuto." icon={UserPlus} fromCheckout={false}>
      {confirm ? (
        <div className="mt-7 rounded-2xl bg-teal/10 p-5 text-[15px] leading-snug">
          <Mail className="mb-2 size-6 text-teal" strokeWidth={1.8} />
          <p className="font-bold">Revisa tu correo</p>
          <p className="mt-1 text-ink-soft">Te enviamos un mensaje a <b className="text-ink">{email}</b>. Confírmalo y luego inicia sesión.</p>
          <button className={`${PRIMARY} mt-4`} onClick={() => navigate(`/login${q}`)}>Ir a iniciar sesión</button>
        </div>
      ) : (
        <>
          <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
            <EmailField value={email} onChange={setEmail} />
            <div>
              <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
              <p className="mt-1.5 text-[12.5px] text-ink-soft">Mínimo 8 caracteres.</p>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <button className={PRIMARY} disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear cuenta'}</button>
          </form>
          <div className="mt-5 flex flex-col gap-4">
            <Or />
            <Link to={`/login${q}`} className={OUTLINE}>Ya tengo cuenta</Link>
          </div>
        </>
      )}
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
    <Shell title="Recupera tu contraseña" subtitle="Escribe tu correo y te enviamos un enlace para elegir una nueva." icon={KeyRound} fromCheckout={false}>
      {sent ? (
        <div className="mt-7 rounded-2xl bg-teal/10 p-5 text-[15px] leading-snug">
          <Mail className="mb-2 size-6 text-teal" strokeWidth={1.8} />
          <p className="font-bold">Enlace enviado</p>
          <p className="mt-1 text-ink-soft">Si <b className="text-ink">{email}</b> tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.</p>
        </div>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
          <EmailField value={email} onChange={setEmail} />
          {error && <ErrorNote>{error}</ErrorNote>}
          <button className={PRIMARY} disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace'}</button>
        </form>
      )}
      <Link to="/login" className="mt-5 block py-2 text-center text-[14px] font-bold text-teal">Volver a iniciar sesión</Link>
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
    <Shell title="Nueva contraseña" subtitle="Elige una que no uses en otros sitios." icon={KeyRound} fromCheckout={false}>
      {done ? (
        <div className="mt-7 rounded-2xl bg-teal/10 p-5 text-[15px] leading-snug">
          <p className="font-bold">¡Listo! Tu contraseña fue cambiada.</p>
          <button className={`${PRIMARY} mt-4`} onClick={() => navigate('/mi-cuenta', { replace: true })}>Ir a mi cuenta</button>
        </div>
      ) : s.userId ? (
        <form className="mt-6 flex flex-col gap-4" onSubmit={submit} noValidate>
          <div>
            <PasswordField value={password} onChange={setPassword} autoComplete="new-password" label="Contraseña nueva" />
            <p className="mt-1.5 text-[12.5px] text-ink-soft">Mínimo 8 caracteres.</p>
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button className={PRIMARY} disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      ) : !s.ready || !waited ? (
        <p className="mt-7 text-sm text-ink-soft">Verificando enlace…</p>
      ) : (
        <div className="mt-7 rounded-2xl bg-sand-2/70 p-5 text-[15px] leading-snug">
          <p className="font-bold">Este enlace no es válido o ya venció.</p>
          <Link to="/recuperar" className={`${PRIMARY} mt-4`}>Pedir un enlace nuevo</Link>
        </div>
      )}
    </Shell>
  )
}
