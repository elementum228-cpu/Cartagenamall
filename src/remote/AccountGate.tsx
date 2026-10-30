import { KeyRound, LogIn, LogOut, Mail, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'
import { remoteEnabled } from './client'
import { useSession } from './session'

/**
 * Con base de datos conectada, /admin y «Mi negocio» piden iniciar sesión (contraseña o enlace al correo).
 * `need`: 'admin' exige ser administrador; 'merchant' cualquier sesión (la lista de tiendas se
 * filtra por las que la persona administra). Sin base de datos se muestra el contenido tal cual
 * (modo demostración).
 */
export function AccountGate({ need, children }: { need: 'admin' | 'merchant'; children: ReactNode }) {
  const s = useSession()
  if (!remoteEnabled()) return <>{children}</>
  if (!s.ready) return <p className="p-6 text-sm text-ink-soft">Verificando sesión…</p>
  if (!s.userId) return <SignIn need={need} />
  if (need === 'admin' && !s.isAdmin)
    return (
      <Notice title="Esta cuenta no es administradora">
        Entraste como <b>{s.email}</b>. Pide a un administrador que te agregue, o entra con otra cuenta.
      </Notice>
    )
  return <>{children}</>
}

/** Barra con la cuenta actual y el botón para salir. */
export function AccountBar() {
  const s = useSession()
  const [editing, setEditing] = useState(false)
  if (!remoteEnabled() || !s.userId) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900">
      <ShieldCheck className="size-4" /> Guardando en línea como {s.email}
      {s.isAdmin && <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] text-white">Admin</span>}
      <span className="ml-auto flex items-center gap-3">
        <button className="flex items-center gap-1 font-bold underline-offset-2 hover:underline" onClick={() => setEditing(!editing)}>
          <KeyRound className="size-3.5" /> Contraseña
        </button>
        <button className="flex items-center gap-1 font-bold underline-offset-2 hover:underline" onClick={() => void s.signOut()}>
          <LogOut className="size-3.5" /> Salir
        </button>
      </span>
      {editing && <PasswordForm onDone={() => setEditing(false)} />}
    </div>
  )
}

function SignIn({ need }: { need: 'admin' | 'merchant' }) {
  return (
    <Notice title={need === 'admin' ? 'Administración · inicia sesión' : 'Mi negocio · inicia sesión'}>
      <SignInForm />
      <p className="mt-3 text-xs text-ink-soft">
        {need === 'admin' ? 'Solo las cuentas administradoras ven pedidos, solicitudes y reservas.' : 'Verás las tiendas que un administrador vinculó a tu correo.'}
      </p>
    </Notice>
  )
}

/** Entrar con correo y contraseña; el enlace al correo queda como alternativa. */
export function SignInForm() {
  const { signIn, signInWithPassword } = useSession()
  const toast = useUI((s) => s.toast)
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && (mode === 'link' || password.length > 0)

  if (sent)
    return (
      <p className="mt-2">
        Te enviamos un enlace a <b>{email}</b>. Ábrelo una sola vez, en este mismo navegador.{' '}
        <button className="font-bold text-brand underline-offset-2 hover:underline" onClick={() => setSent(false)}>
          Volver
        </button>
      </p>
    )
  return (
    <form
      className="mt-3 flex flex-col gap-2.5"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const err = mode === 'password' ? await signInWithPassword(email, password) : await signIn(email)
        setBusy(false)
        if (err) toast(err, 'error')
        else if (mode === 'link') setSent(true)
      }}
    >
      <label className="text-xs font-bold text-ink">
        Correo
        <input className={`${input} mt-1`} type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {mode === 'password' && (
        <label className="text-xs font-bold text-ink">
          Contraseña
          <input className={`${input} mt-1`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      )}
      <button className={btn.primary} disabled={!valid || busy}>
        {mode === 'password' ? <LogIn className="size-4" /> : <Mail className="size-4" />}
        {busy ? 'Un momento…' : mode === 'password' ? 'Entrar' : 'Enviarme el enlace'}
      </button>
      <button type="button" className="text-xs font-bold text-ink-soft underline-offset-2 hover:underline" onClick={() => setMode(mode === 'password' ? 'link' : 'password')}>
        {mode === 'password' ? 'No tengo contraseña: enviarme un enlace al correo' : 'Entrar con contraseña'}
      </button>
    </form>
  )
}

/** Crear o cambiar la contraseña de la cuenta con la que se entró. */
function PasswordForm({ onDone }: { onDone: () => void }) {
  const setPassword = useSession((s) => s.setPassword)
  const toast = useUI((s) => s.toast)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="flex w-full flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const err = await setPassword(pw)
        setBusy(false)
        if (err) toast(err, 'error')
        else {
          toast('Contraseña guardada', 'success')
          onDone()
        }
      }}
    >
      <input className={input} type="password" autoComplete="new-password" placeholder="Nueva contraseña (mínimo 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
      <button className={btn.primary} disabled={pw.length < 6 || busy}>
        {busy ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-3xl border border-line bg-card p-5">
        <p className="text-lg font-extrabold">{title}</p>
        <div className="mt-1 text-sm text-ink-soft">{children}</div>
      </div>
    </div>
  )
}
