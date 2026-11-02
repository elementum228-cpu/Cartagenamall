import { ArrowRight, BookOpen, ChevronRight, ClipboardList, Heart, Settings, Store, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { remoteEnabled } from '../remote/client'
import { AccountBar } from '../remote/AccountGate'
import { useSession } from '../remote/session'
import { btn } from '../ui/bits'
import { InstallButton } from '../pwa/InstallApp'

/** Pantalla de entrada para administradores y dueños de negocio. */
export function LoginPage() {
  const s = useSession()
  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-28">
      <div className="glass-strong rounded-[28px] p-5">
        <p className="text-xs font-bold tracking-wider text-brand uppercase">Cartagena Mall</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Tu cuenta</h1>
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
          <div className="mt-4 flex flex-col gap-2.5">
            <Link to="/registro" className={btn.primary}>
              Crear cuenta
            </Link>
            <Link to="/login" className={btn.secondary}>
              Ya tengo cuenta: iniciar sesión
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            <AccountBar />
            <Link to="/mi-cuenta" className={btn.primary}>
              Mi cuenta: solicitar un local <ArrowRight className="size-4" />
            </Link>
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

      {/* accesos del perfil: lo que en celular no cabe en la barra superior */}
      <nav aria-label="Accesos" className="glass-strong mt-4 overflow-hidden rounded-[26px] p-1.5">
        <Shortcut to="/pasaporte" icon={BookOpen} label="Mi pasaporte" hint="Sellos, búsqueda del tesoro y premios" />
        <Shortcut to="/favoritos" icon={Heart} label="Favoritos" hint="Tiendas y productos guardados" />
        <Shortcut to="/pedidos" icon={ClipboardList} label="Mis pedidos" hint="Estado de tus compras" />
        <Shortcut to="/mi-negocio" icon={Store} label="Mi negocio" hint="Logo, productos y promociones" />
        <Shortcut to="/admin" icon={Settings} label="Administración" hint="Gestión del mall y precios" />
      </nav>
      <InstallButton className={`${btn.secondary} mt-4 w-full`} />
    </div>
  )
}

function Shortcut({ to, icon: Icon, label, hint }: { to: string; icon: LucideIcon; label: string; hint: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-[20px] px-3 py-2.5 transition duration-200 hover:bg-white/70 active:scale-[0.99]">
      <span className="grid size-10 place-items-center rounded-2xl bg-teal/10 text-teal">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block truncate text-xs text-ink-soft">{hint}</span>
      </span>
      <ChevronRight className="size-5 text-ink-soft" strokeWidth={1.8} />
    </Link>
  )
}
