import { ClipboardList, Compass, Heart, Scale, Search, ShoppingBag, ShoppingCart, UserRound, Zap } from 'lucide-react'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, MemoryRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { DoorIntro } from './features/DoorIntro'
import { GuidedTour } from './features/GuidedTour'
import { ExploreView } from './features/ExploreView'
import { ProductSheet } from './features/ProductSheet'
import { SecretPromoModal } from './features/SecretPromoModal'
import { SpaceSheet } from './features/SpaceSheet'
import { FootballCourtInfoPanel } from './features/FootballCourtInfoPanel'
import { StoreSheet } from './features/StoreSheet'
import { HarborSheet } from './features/HarborSheet'
import { ShowroomSheet } from './features/ShowroomSheet'
import { ShipLayer } from './ship/ShipLayer'
import { FlyInvite } from './airport/FlyInvite'
import { FlightLayer } from './airport/FlightLayer'
import { useAirportFeature } from './state/airportFeature'

/** Invitación y pantallas de vuelo: solo con el aeropuerto habilitado. */
function AirportLayers() {
  const on = useAirportFeature((s) => s.enabled)
  if (!on) return null
  return (
    <>
      <FlyInvite />
      <FlightLayer />
    </>
  )
}
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { ComparePage } from './pages/ComparePage'
import { FavoritesPage } from './pages/FavoritesPage'
import { LoginPage } from './pages/LoginPage'
import { MyAccountPage } from './pages/MyAccountPage'
import { AuthLoginPage, ForgotPasswordPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'
import { OffersPage } from './pages/OffersPage'
import { PassportPage } from './pages/PassportPage'
import { ClueModal, StampToast } from './features/passport/PassportOverlays'
import { OrderDetailPage, OrdersPage } from './pages/OrdersPage'
import { ShopPage } from './pages/ShopPage'
import { remoteEnabled } from './remote/client'
import { useCanAdmin, useSession } from './remote/session'
import { useCartCount } from './state/cart'
import { usePersonal } from './state/personal'
import { useUI } from './state/ui'
import { PromotionEventDriver } from './promotions/PromotionEventDriver'
import { Toasts } from './ui/Toasts'
import { MallMark } from './ui/MallMark'
import { InstallLayer } from './pwa/InstallApp'

const AdminRequestsPage = lazy(() => import('./pages/AdminRequestsPage'))
const AdminPage = lazy(() => import('./admin/AdminPage'))
const MerchantPage = lazy(() => import('./pages/MerchantPage'))

/**
 * VITE_ROUTER=memory: para entornos sin rutas reales (vista previa embebida). El panel se abre con
 * `#admin` en la URL.
 */
function Router({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_ROUTER === 'memory')
    return <MemoryRouter initialEntries={[location.hash === '#admin' ? '/admin' : '/']}>{children}</MemoryRouter>
  return <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>{children}</BrowserRouter>
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/admin/solicitudes"
          element={
            <Suspense fallback={<p className="p-6 text-sm text-ink-soft">Cargando…</p>}>
              <AdminRequestsPage />
              <Toasts />
            </Suspense>
          }
        />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<p className="p-6 text-sm text-ink-soft">Cargando panel…</p>}>
              <AdminPage />
              <Toasts />
            </Suspense>
          }
        />
        <Route path="*" element={<Shell />} />
      </Routes>
    </Router>
  )
}

function Shell() {
  const location = useLocation()
  const exploring = location.pathname === '/'
  // El portón de bienvenida solo al abrir el mall en la portada (no en enlaces directos a otras páginas).
  const [startedAtHome] = useState(exploring)

  // Al salir del mapa se cierra la selección de espacio (las fichas abiertas desde Comprar se mantienen).
  useEffect(() => {
    if (!exploring) {
      useUI.getState().selectSpace(null)
      useUI.getState().openCourt(false)
    }
    useUI.getState().openProduct(null)
  }, [location.pathname, exploring])

  return (
    <div className="fixed inset-0">
      {/* el mapa (o la página) ocupa toda la pantalla; las barras flotan encima */}
      <main className="absolute inset-0">
        {/* El mundo se mantiene montado: volver a Explorar es inmediato y conserva la cámara. */}
        <div className={exploring ? 'absolute inset-0' : 'invisible absolute inset-0'}>
          <ExploreView active={exploring} />
        </div>
        {!exploring && (
          <div className="absolute inset-0 overflow-y-auto bg-sand">
            {/* espacio para la barra flotante (no como relleno del contenedor: Safari lo suma a los
                elementos «sticky» y quedaría un hueco) */}
            <div className="h-[var(--chrome-top)]" aria-hidden />
            <Routes>
              <Route path="/comprar" element={<ShopPage />} />
              <Route path="/carrito" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/pedidos" element={<OrdersPage />} />
              <Route path="/pedidos/:id" element={<OrderDetailPage />} />
              <Route path="/comparar" element={<ComparePage />} />
              <Route path="/favoritos" element={<FavoritesPage />} />
              <Route path="/ofertas" element={<OffersPage />} />
              <Route path="/pasaporte" element={<PassportPage />} />
              <Route path="/entrar" element={<LoginPage />} />
              <Route path="/login" element={<AuthLoginPage />} />
              <Route path="/registro" element={<RegisterPage />} />
              <Route path="/recuperar" element={<ForgotPasswordPage />} />
              <Route path="/restablecer" element={<ResetPasswordPage />} />
              <Route path="/mi-cuenta" element={<MyAccountPage />} />
              <Route
                path="/mi-negocio"
                element={
                  <Suspense fallback={<p className="p-6 text-sm text-ink-soft">Cargando…</p>}>
                    <MerchantPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        )}
      </main>
      <TopBar />
      <PromotionEventDriver exploring={exploring} />
      <CompareTray />
      <BottomNav />
      <StoreSheet />
      <SpaceSheet />
      <FootballCourtInfoPanel />
      <HarborSheet />
      <ShowroomSheet />
      <ShipLayer />
      <AirportLayers />
      <ProductSheet />
      <SecretPromoModal />
      <Toasts />
      <GuidedTour />
      <InstallLayer />
      <StampToast />
      <ClueModal />
      <DoorIntro auto={startedAtHome} />
    </div>
  )
}

function NotFound() {
  return (
    <div className="p-10 text-center">
      <p className="text-lg font-bold">Este pasillo no existe</p>
      <Link to="/" className="mt-3 inline-block font-bold text-brand">
        Volver al centro comercial
      </Link>
    </div>
  )
}

function ModeSwitch() {
  const location = useLocation()
  const navigate = useNavigate()
  const mode = location.pathname === '/' ? 'explore' : location.pathname.startsWith('/comprar') ? 'shop' : null
  const item = (m: 'explore' | 'shop', label: string, icon: ReactNode, to: string) => (
    <button
      onClick={() => navigate(to)}
      aria-pressed={mode === m}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition duration-200 active:scale-[0.98] ${mode === m ? 'bg-teal text-white shadow-[var(--shadow-glow)]' : 'text-ink-soft hover:text-ink'}`}
    >
      {icon}
      {label}
    </button>
  )
  return (
    <div className="flex p-1" role="group" aria-label="Modo de experiencia">
      {item('explore', 'Explorar', <Compass className="size-4" strokeWidth={1.8} />, '/')}
      {item('shop', 'Comprar', <ShoppingBag className="size-4" strokeWidth={1.8} />, '/comprar')}
    </div>
  )
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-[13.5px] font-semibold transition duration-200 ${isActive ? 'bg-teal/12 text-teal' : 'text-ink-soft hover:text-ink'}`
const iconBtn = 'glass relative grid size-11 place-items-center rounded-full text-ink shadow-none transition duration-200 active:scale-[0.96]'

/** Barra superior flotante de vidrio. */
function TopBar() {
  const count = useCartCount()
  const navigate = useNavigate()
  const compare = usePersonal((s) => s.compare.length)
  const loggedIn = useSession((s) => !!s.userId)
  const canAdmin = useCanAdmin()
  return (
    // sin cápsula: el logo y cada botón flotan sueltos sobre el mapa, con aire entre ellos
    <header className="tour-hide chrome-in-top pointer-events-none fixed inset-x-3 top-[max(10px,env(safe-area-inset-top))] z-30 flex h-14 items-center gap-2 md:inset-x-5 md:top-[max(12px,env(safe-area-inset-top))] md:h-[60px] *:pointer-events-auto">
      <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-2xl pr-2" aria-label="Cartagena Mall, inicio">
        <MallMark size={40} />
        <span className="chrome-text text-[17px] font-bold tracking-[-0.01em]">Cartagena Mall</span>
      </Link>
      <div className="glass mx-auto hidden rounded-full md:block">
        <ModeSwitch />
      </div>
      <nav className="glass hidden items-center gap-0.5 rounded-full p-1 lg:flex" aria-label="Secciones">
        <NavLink to="/ofertas" className={navLink}>
          Ofertas
        </NavLink>
        <NavLink to="/pedidos" className={navLink}>
          Pedidos
        </NavLink>
        <NavLink to="/mi-negocio" className={navLink}>
          Mi negocio
        </NavLink>
        {canAdmin && (
          <NavLink to="/admin" className={navLink({ isActive: false })}>
            Admin
          </NavLink>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <button className={iconBtn} onClick={() => navigate('/comprar?foco=1')} aria-label="Buscar productos">
          <Search className="size-[21px]" strokeWidth={1.8} />
        </button>
        <Link to="/favoritos" className={`${iconBtn} max-md:hidden`} aria-label="Favoritos">
          <Heart className="size-[21px]" strokeWidth={1.8} />
        </Link>
        {compare > 0 && (
          <Link to="/comparar" className={`${iconBtn} max-md:hidden`} aria-label={`Comparador, ${compare} productos`}>
            <Scale className="size-[21px]" strokeWidth={1.8} />
            <Badge n={compare} />
          </Link>
        )}
        {!loggedIn && remoteEnabled() && (
          <Link to="/registro" className="grid h-11 place-items-center rounded-full bg-teal px-4 text-[14px] font-bold whitespace-nowrap text-white shadow-[var(--shadow-glow)] transition active:scale-[0.96]">
            Crear cuenta
          </Link>
        )}
        <NavLink to={loggedIn ? '/mi-cuenta' : '/login'} className={({ isActive }) => `${iconBtn} ${isActive ? '!bg-teal !text-white' : ''} ${loggedIn || !remoteEnabled() ? '' : 'max-sm:hidden'}`} aria-label={loggedIn ? 'Mi cuenta' : 'Iniciar sesión o crear cuenta'}>
          <UserRound className="size-[21px]" strokeWidth={1.8} />
        </NavLink>
        <Link to="/carrito" className="relative grid size-11 place-items-center rounded-full bg-teal text-white shadow-[var(--shadow-glow)] transition active:scale-[0.96] max-md:hidden" aria-label={`Carrito, ${count} productos`}>
          <ShoppingCart className="size-[19px]" strokeWidth={1.9} />
          <Badge n={count} />
        </Link>
      </div>
    </header>
  )
}

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[10.5px] font-bold text-white ring-2 ring-white/90">{n > 99 ? '99+' : n}</span>
}

function BottomNav() {
  const count = useCartCount()
  const tabs = [
    { to: '/', label: 'Explorar', icon: Compass, end: true },
    { to: '/comprar', label: 'Comprar', icon: ShoppingBag },
    { to: '/ofertas', label: 'Ofertas', icon: Zap },
    { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
    { to: '/carrito', label: 'Carrito', icon: ShoppingCart, badge: count },
  ]
  return (
    <nav
      className="tour-hide chrome-in-bottom glass fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-30 h-16 rounded-[26px] px-1.5 md:hidden"
      aria-label="Navegación principal"
    >
      <ul className="grid h-full grid-cols-5 items-center">
        {tabs.map((t) => (
          <li key={t.to} className="flex justify-center">
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `relative flex min-h-[48px] min-w-[58px] flex-col items-center justify-center gap-0.5 rounded-[18px] px-1.5 text-[10.5px] font-semibold transition duration-200 active:scale-[0.97] ${
                  isActive ? 'bg-teal/12 text-teal' : 'text-[#66737C]'
                }`
              }
            >
              <span className="relative">
                <t.icon className="size-[21px]" strokeWidth={1.8} />
                {t.badge ? <Badge n={t.badge} /> : null}
              </span>
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function CompareTray() {
  const n = usePersonal((s) => s.compare.length)
  const location = useLocation()
  if (!n || location.pathname === '/comparar' || location.pathname === '/') return null
  return (
    <Link
      to="/comparar"
      className="glass fixed bottom-[calc(var(--chrome-bottom)+8px)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-ink md:hidden"
    >
      <Scale className="size-4" /> Comparar ({n})
    </Link>
  )
}
