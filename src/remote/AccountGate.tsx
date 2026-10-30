import { LogOut, Mail, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'
import { remoteEnabled } from './client'
import { useSession } from './session'

/**
 * Con base de datos conectada, /admin y «Mi negocio» piden iniciar sesión con un enlace al correo.
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
  if (!remoteEnabled() || !s.userId) return null
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900">
      <ShieldCheck className="size-4" /> Guardando en línea como {s.email}
      {s.isAdmin && <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] text-white">Admin</span>}
      <button className="ml-auto flex items-center gap-1 font-bold underline-offset-2 hover:underline" onClick={() => void s.signOut()}>
        <LogOut className="size-3.5" /> Salir
      </button>
    </p>
  )
}

function SignIn({ need }: { need: 'admin' | 'merchant' }) {
  const signIn = useSession((s) => s.signIn)
  const toast = useUI((s) => s.toast)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const valid = /^\S+@\S+\.\S+$/.test(email.trim())
  return (
    <Notice title={need === 'admin' ? 'Administración · inicia sesión' : 'Mi negocio · inicia sesión'}>
      {sent ? (
        <p>
          Te enviamos un enlace a <b>{email}</b>. Ábrelo en este mismo navegador para entrar.
        </p>
      ) : (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            const err = await signIn(email)
            setBusy(false)
            if (err) toast(err, 'error')
            else setSent(true)
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Correo</span>
            <input className={input} type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className={btn.primary} disabled={!valid || busy}>
            <Mail className="size-4" /> {busy ? 'Enviando…' : 'Enviarme el enlace'}
          </button>
        </form>
      )}
      <p className="mt-2 text-xs text-ink-soft">
        {need === 'admin' ? 'Solo las cuentas administradoras ven pedidos, solicitudes y reservas.' : 'Verás las tiendas que un administrador vinculó a tu correo.'}
      </p>
    </Notice>
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
