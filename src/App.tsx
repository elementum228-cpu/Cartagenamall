import { ClipboardList, Compass, Heart, Scale, Search, ShoppingBag, ShoppingCart, Store, Zap } from 'lucide-react'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Link, MemoryRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ExploreView } from './features/ExploreView'
import { ProductSheet } from './features/ProductSheet'
import { SecretPromoModal } from './features/SecretPromoModal'
import { SpaceSheet } from './features/SpaceSheet'
import { FootballCourtInfoPanel } from './features/FootballCourtInfoPanel'
import { StoreSheet } from './features/StoreSheet'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { ComparePage } from './pages/ComparePage'
import { FavoritesPage } from './pages/FavoritesPage'
import { OffersPage } from './pages/OffersPage'
import { OrderDetailPage, OrdersPage } from './pages/OrdersPage'
import { ShopPage } from './pages/ShopPage'
import { useCartCount } from './state/cart'
import { usePersonal } from './state/personal'
import { useUI } from './state/ui'
import { PromotionEventDriver } from './promotions/PromotionEventDriver'
import { Toasts } from './ui/Toasts'

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

  // Al salir del mapa se cierra la selección de espacio (las fichas abiertas desde Comprar se mantienen).
  useEffect(() => {
    if (!exploring) {
      useUI.getState().selectSpace(null)
      useUI.getState().openCourt(false)
    }
    useUI.getState().openProduct(null)
  }, [location.pathname, exploring])

  return (
    <div className="fixed inset-0 flex flex-col">
      <TopBar />
      <main className="relative min-h-0 flex-1">
        {/* El mundo se mantiene montado: volver a Explorar es inmediato y conserva la cámara. */}
        <div className={exploring ? 'absolute inset-0' : 'invisible absolute inset-0'}>
          <ExploreView active={exploring} />
        </div>
        {!exploring && (
          <div className="absolute inset-0 overflow-y-auto bg-sand">
            <Routes>
              <Route path="/comprar" element={<ShopPage />} />
              <Route path="/carrito" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/pedidos" element={<OrdersPage />} />
              <Route path="/pedidos/:id" element={<OrderDetailPage />} />
              <Route path="/comparar" element={<ComparePage />} />
              <Route path="/favoritos" element={<FavoritesPage />} />
              <Route path="/ofertas" element={<OffersPage />} />
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
      <PromotionEventDriver exploring={exploring} />
      <CompareTray />
      <BottomNav />
      <StoreSheet />
      <SpaceSheet />
      <FootballCourtInfoPanel />
      <ProductSheet />
      <SecretPromoModal />
      <Toasts />
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
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${mode === m ? 'bg-ink text-white shadow-soft' : 'text-ink-soft hover:text-ink'}`}
    >
      {icon}
      {label}
    </button>
  )
  return (
    <div className="flex rounded-full bg-sand-2 p-1" role="group" aria-label="Modo de experiencia">
      {item('explore', 'Explorar', <Compass className="size-4" />, '/')}
      {item('shop', 'Comprar', <ShoppingBag className="size-4" />, '/comprar')}
    </div>
  )
}

function TopBar() {
  const count = useCartCount()
  const navigate = useNavigate()
  const compare = usePersonal((s) => s.compare.length)
  return (
    <header className="relative z-30 flex h-[60px] shrink-0 items-center gap-3 border-b border-line/70 bg-card/90 px-3 backdrop-blur md:px-5">
      <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Cartagena Mall, inicio">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
        <span className="leading-none">
          <span className="block text-[15px] font-extrabold tracking-tight">CARTAGENA MALL</span>
          <span className="hidden text-[10px] font-semibold text-ink-soft sm:block">Tu ciudad. Tu mall. Tu mundo.</span>
        </span>
      </Link>
      <div className="mx-auto hidden md:block">
        <ModeSwitch />
      </div>
      <nav className="hidden items-center gap-1 lg:flex">
        <NavLink to="/ofertas" className={({ isActive }) => `rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'text-brand' : 'text-ink-soft hover:text-ink'}`}>
          Ofertas
        </NavLink>
        <NavLink to="/pedidos" className={({ isActive }) => `rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'text-brand' : 'text-ink-soft hover:text-ink'}`}>
          Pedidos
        </NavLink>
        <NavLink to="/mi-negocio" className={({ isActive }) => `rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'text-brand' : 'text-ink-soft hover:text-ink'}`}>
          Mi negocio
        </NavLink>
        <NavLink to="/admin" className="rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
          Admin
        </NavLink>
      </nav>
      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <button className="grid size-10 place-items-center rounded-full hover:bg-ink/5" onClick={() => navigate('/comprar?foco=1')} aria-label="Buscar productos">
          <Search className="size-5" />
        </button>
        <Link to="/mi-negocio" className="grid size-10 place-items-center rounded-full hover:bg-ink/5 lg:hidden" aria-label="Mi negocio">
          <Store className="size-5" />
        </Link>
        <Link to="/favoritos" className="grid size-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Favoritos">
          <Heart className="size-5" />
        </Link>
        {compare > 0 && (
          <Link to="/comparar" className="relative hidden size-10 place-items-center rounded-full hover:bg-ink/5 md:grid" aria-label={`Comparador, ${compare} productos`}>
            <Scale className="size-5" />
            <Badge n={compare} />
          </Link>
        )}
        <Link to="/carrito" className="relative grid size-10 place-items-center rounded-full bg-ink text-white" aria-label={`Carrito, ${count} productos`}>
          <ShoppingCart className="size-5" />
          <Badge n={count} />
        </Link>
      </div>
    </header>
  )
}

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white ring-2 ring-card">{n > 99 ? '99+' : n}</span>
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
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-card/95 backdrop-blur md:hidden" aria-label="Navegación principal">
      <ul className="grid h-16 grid-cols-5">
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink to={t.to} end={t.end} className={({ isActive }) => `relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${isActive ? 'text-brand' : 'text-ink-soft'}`}>
              {({ isActive }) => (
                <>
                  <span className={`relative grid h-7 w-12 place-items-center rounded-full transition ${isActive ? 'bg-brand/12' : ''}`}>
                    <t.icon className="size-5" />
                    {t.badge ? <Badge n={t.badge} /> : null}
                  </span>
                  {t.label}
                </>
              )}
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
      className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-float md:hidden"
    >
      <Scale className="size-4" /> Comparar ({n})
    </Link>
  )
}
