import { ArrowRight, Settings, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { remoteEnabled } from '../remote/client'
import { AccountBar, SignInForm } from '../remote/AccountGate'
import { useSession } from '../remote/session'
import { btn } from '../ui/bits'

/** Pantalla de entrada para administradores y dueños de negocio. */
export function LoginPage() {
  const s = useSession()
  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-28">
      <div className="rounded-3xl border border-line bg-card p-5 shadow-soft">
        <p className="text-xs font-bold tracking-wider text-brand uppercase">Cartagena Mall</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-ink-soft">Para administradores y dueños de negocio: crea tiendas, sube productos y gestiona pedidos.</p>

        {!remoteEnabled() ? (
          <p className="mt-4 rounded-2xl bg-sand p-3 text-sm text-ink-soft">
            Este sitio funciona en modo demostración (sin base de datos), así que no hace falta entrar: abre{' '}
            <Link to="/admin" className="font-bold text-brand">
              Administración
            </Link>{' '}
            o{' '}
            <Link to="/mi-negocio" className="font-bold text-brand">
              Mi negocio
            </Link>
            .
          </p>
        ) : !s.ready ? (
          <p className="mt-4 text-sm text-ink-soft">Verificando sesión…</p>
        ) : !s.userId ? (
          <SignInForm />
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            <AccountBar />
            {s.isAdmin && (
              <Link to="/admin" className={btn.primary}>
                <Settings className="size-4" /> Administración: tiendas, locales y pedidos <ArrowRight className="size-4" />
              </Link>
            )}
            <Link to="/mi-negocio" className={s.isAdmin ? btn.secondary : btn.primary}>
              <Store className="size-4" /> Mi negocio: logo, productos y promociones <ArrowRight className="size-4" />
            </Link>
            {!s.isAdmin && s.storeIds.length === 0 && (
              <p className="text-xs text-ink-soft">Tu cuenta aún no tiene tiendas asignadas. Pide a un administrador que vincule tu correo a tu tienda.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
