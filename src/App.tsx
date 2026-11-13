import {
  ClipboardList,
  Compass,
  Heart,
  Scale,
  Search,
  ShoppingBag,
  Store,
  ShoppingCart,
  UserRound,
  Zap,
} from "lucide-react";
import { Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  MemoryRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { DoorIntro } from "./features/DoorIntro";
import { HoyScheduler } from "./hoy/HoyScheduler";
import { useHoy } from "./hoy/store";
import { useFlight } from "./airport/flight";
import { useCineUi } from "./state/cineUi";
import { lazyWhen, prefetchIdle } from "./ui/lazyWhen";
import { RouteFallback } from "./ui/RouteFallback";
import { useEntry } from "./state/entry";
import { tourDone } from "./features/tourState";
import { ExploreView } from "./features/ExploreView";
import { RouteGuard, lazyPage } from "./ui/RouteGuard";
import { ShipLayer } from "./ship/ShipLayer";
import { useAirportFeature } from "./state/airportFeature";

import { FEATURES } from "./config/features";
import { LocalLink } from "./pages/LocalLink";
import { ClueModal, StampToast } from "./features/passport/PassportOverlays";
import { remoteEnabled } from "./remote/client";
import { useProfile } from "./remote/profile";
import { useCatalog } from "./state/catalog";
import { useCanAdmin, useSession } from "./remote/session";
import { useIsNight } from "./lib/useIsNight";
import { useCartCount } from "./state/cart";
import { usePersonal } from "./state/personal";
import { useUI } from "./state/ui";
import { PromotionEventDriver } from "./promotions/PromotionEventDriver";
import { Toasts } from "./ui/Toasts";
import { MallLogoWhite, MallMark, MallWordmark } from "./ui/MallMark";
import { InstallLayer } from "./pwa/InstallApp";
import { BellButton } from "./notifications/BellButton";
import { MerchantWatcher } from "./notifications/MerchantWatcher";
import { OrderWatcher } from "./notifications/OrderWatcher";
import { OwnerWelcome } from "./features/OwnerWelcome";
import { ApprovalWatcher } from "./notifications/ApprovalWatcher";

const AdminRequestsPage = lazyPage(() => import("./pages/AdminRequestsPage"));
const AdminPage = lazyPage(() => import("./admin/AdminPage"));
const MerchantPage = lazyPage(() => import("./pages/MerchantPage"));

// Páginas y paneles secundarios: cada uno se descarga solo cuando se necesita (y los más probables, en reposo después de entrar:
// ver `prefetchIdle` más abajo). El primer pintado solo carga la entrada, el mapa y la barra.
const named = <T extends ComponentType<any>>(load: () => Promise<Record<string, any>>, name: string) => {
  const C = lazyPage(() => load().then((m) => ({ default: m[name] as T })));
  return Object.assign(C, { preload: () => void load().catch(() => {}) });
};
const ShopPage = named(() => import("./pages/ShopPage"), "ShopPage");
const CartPage = named(() => import("./pages/CartPage"), "CartPage");
const CheckoutPage = named(() => import("./pages/CheckoutPage"), "CheckoutPage");
const ComparePage = named(() => import("./pages/ComparePage"), "ComparePage");
const FavoritesPage = named(() => import("./pages/FavoritesPage"), "FavoritesPage");
const LoginPage = named(() => import("./pages/LoginPage"), "LoginPage");
const MyAccountPage = named(() => import("./pages/MyAccountPage"), "MyAccountPage");
const OffersPage = named(() => import("./pages/OffersPage"), "OffersPage");
const PassportPage = named(() => import("./pages/PassportPage"), "PassportPage");
const OrdersPage = named(() => import("./pages/OrdersPage"), "OrdersPage");
const OrderDetailPage = named(() => import("./pages/OrdersPage"), "OrderDetailPage");
const AuthLoginPage = named(() => import("./pages/AuthPages"), "AuthLoginPage");
const RegisterPage = named(() => import("./pages/AuthPages"), "RegisterPage");
const ForgotPasswordPage = named(() => import("./pages/AuthPages"), "ForgotPasswordPage");
const ResetPasswordPage = named(() => import("./pages/AuthPages"), "ResetPasswordPage");

const StoreSheet = lazyWhen(() => import("./features/StoreSheet").then((m) => ({ default: m.StoreSheet })), () => useUI((s) => s.openStoreId !== null || s.selectedSpaceId !== null));
const SpaceSheet = lazyWhen(() => import("./features/SpaceSheet").then((m) => ({ default: m.SpaceSheet })), () => useUI((s) => s.selectedSpaceId !== null));
const ProductSheet = lazyWhen(() => import("./features/ProductSheet").then((m) => ({ default: m.ProductSheet })), () => useUI((s) => s.productSheetId !== null));
const SecretPromoModal = lazyWhen(() => import("./features/SecretPromoModal").then((m) => ({ default: m.SecretPromoModal })), () => useUI((s) => s.secretPromoId !== null));
const FootballCourtInfoPanel = lazyWhen(() => import("./features/FootballCourtInfoPanel").then((m) => ({ default: m.FootballCourtInfoPanel })), () => useUI((s) => s.courtOpen));
const KartTrackPanel = lazyWhen(() => import("./features/KartTrackPanel").then((m) => ({ default: m.KartTrackPanel })), () => useUI((s) => s.trackOpen));
const StadiumPanel = lazyWhen(() => import("./stadium/StadiumPanel").then((m) => ({ default: m.StadiumPanel })), () => useUI((s) => s.stadiumOpen));
const StoreInterior = lazyWhen(() => import("./immersive/StoreInterior").then((m) => ({ default: m.StoreInterior })), () => useUI((s) => s.interiorStoreId !== null));
const HarborSheet = lazyWhen(() => import("./features/HarborSheet").then((m) => ({ default: m.HarborSheet })), () => useUI((s) => s.harbor !== null));
const ShowroomSheet = lazyWhen(() => import("./features/ShowroomSheet").then((m) => ({ default: m.ShowroomSheet })), () => useUI((s) => s.showroom !== null));
const CineHost = lazyWhen(() => import("./features/CineViews").then((m) => ({ default: m.CineHost })), () => useCineUi((s) => s.view !== null));
const HoyHost = lazyWhen(() => import("./hoy/Hoy").then((m) => ({ default: m.HoyHost })), () => useHoy((s) => s.notice || s.reader));
const GuidedTour = lazyWhen(() => import("./features/GuidedTour").then((m) => ({ default: m.GuidedTour })), () => useUI((s) => s.tourStep !== null));
const FlyInvite = lazyWhen(() => import("./airport/FlyInvite").then((m) => ({ default: m.FlyInvite })), () => useUI((s) => s.airportOpen));
const FlightLayer = lazyWhen(() => import("./airport/FlightLayer").then((m) => ({ default: m.FlightLayer })), () => useFlight((s) => s.step !== null || s.world !== "mall" || s.returnOpen));

/** Invitación y pantallas de vuelo: solo con el aeropuerto habilitado (y su código, solo al usarlos). */
function AirportLayers() {
  const on = useAirportFeature((s) => s.enabled);
  if (!on) return null;
  return (
    <>
      <FlyInvite />
      <FlightLayer />
    </>
  );
}

/**
 * VITE_ROUTER=memory: para entornos sin rutas reales (vista previa embebida). El panel se abre con
 * `#admin` en la URL.
 */
function Router({ children }: { children: ReactNode }) {
  if (
    import.meta.env.VITE_ROUTER === "memory" ||
    import.meta.env.VITE_DEMO === "1"
  )
    return (
      <MemoryRouter
        initialEntries={[location.hash === "#admin" ? "/admin" : "/"]}
      >
        {children}
      </MemoryRouter>
    );
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      {children}
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <Router>
      <RouteGuard>
        <Routes>
          <Route
            path="/admin/solicitudes"
            element={
              <Suspense
                fallback={
                  <p className="p-6 text-sm text-ink-soft">Cargando…</p>
                }
              >
                <AdminRequestsPage />
                <Toasts />
              </Suspense>
            }
          />
          <Route
            path="/admin/*"
            element={
              <Suspense
                fallback={
                  <p className="p-6 text-sm text-ink-soft">Cargando panel…</p>
                }
              >
                <AdminPage />
                <Toasts />
              </Suspense>
            }
          />
          <Route path="*" element={<Shell />} />
        </Routes>
      </RouteGuard>
    </Router>
  );
}

function Shell() {
  const location = useLocation();
  const exploring = location.pathname === "/";
  // El portón de bienvenida solo al abrir el mall en la portada (no en enlaces directos a otras páginas).
  const [startedAtHome] = useState(exploring);

  // Cuando el portón termina (o si no hay), el navegador va trayendo en reposo lo que la persona probablemente abrirá: las
  // fichas de tienda y los espacios, el periódico, el recorrido (solo la primera vez) y las páginas de compra.
  const doorDone = useEntry((s) => s.doorDone);
  useEffect(() => {
    if (!doorDone) return;
    return prefetchIdle([
      StoreSheet.preload,
      SpaceSheet.preload,
      ...(tourDone() ? [] : [GuidedTour.preload]),
      HoyHost.preload,
      ShopPage.preload,
      ProductSheet.preload,
      OffersPage.preload,
      CartPage.preload,
    ]);
  }, [doorDone]);

  // Al salir del mapa se cierra la selección de espacio (las fichas abiertas desde Comprar se mantienen).
  useEffect(() => {
    if (!exploring) {
      useUI.getState().selectSpace(null);
      useUI.getState().openCourt(false);
    }
    useUI.getState().openProduct(null);
  }, [location.pathname, exploring]);

  // En el iPhone instalado, el contenedor fijo a veces termina un poco antes del borde de abajo y deja ver el fondo de la
  // página (una franja blanca). En el mapa el fondo toma el color del mar (día o noche), así esa franja no se nota.
  const night = useIsNight();
  useEffect(() => {
    const color = exploring ? (night ? "#17415c" : "#5ea9a2") : "";
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
    return () => {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    };
  }, [exploring, night]);

  return (
    <div className="fixed inset-0">
      {/* el mapa (o la página) ocupa toda la pantalla; las barras flotan encima */}
      <main className="absolute inset-0">
        {/* El mundo se mantiene montado: volver a Explorar es inmediato y conserva la cámara. */}
        <div
          className={
            exploring ? "absolute inset-0" : "invisible absolute inset-0"
          }
        >
          <ExploreView active={exploring} />
        </div>
        {!exploring && (
          <div className="absolute inset-0 overflow-y-auto bg-sand">
            {/* espacio para la barra flotante (no como relleno del contenedor: Safari lo suma a los
                elementos «sticky» y quedaría un hueco) */}
            <div className="h-[var(--chrome-top)]" aria-hidden />
            <RouteGuard resetKey={location.pathname}>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/local/:code" element={<LocalLink by="local" />} />
                <Route
                  path="/tienda/:code"
                  element={<LocalLink by="tienda" />}
                />
                <Route path="/comprar" element={<ShopPage />} />
                <Route path="/carrito" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/pedidos" element={<OrdersPage />} />
                <Route path="/pedidos/:id" element={<OrderDetailPage />} />
                <Route
                  path="/comparar"
                  element={
                    FEATURES.compare ? (
                      <ComparePage />
                    ) : (
                      <Navigate to="/comprar" replace />
                    )
                  }
                />
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
                    <Suspense
                      fallback={
                        <p className="p-6 text-sm text-ink-soft">Cargando…</p>
                      }
                    >
                      <MerchantPage />
                    </Suspense>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </RouteGuard>
          </div>
        )}
      </main>
      <TopBar />
      <OrderWatcher />
      <MerchantWatcher />
      <OwnerWelcome />
      <ApprovalWatcher />
      <PromotionEventDriver exploring={exploring} />
      {FEATURES.compare && <CompareTray />}
      <BottomNav />
      <StoreSheet />
      <SpaceSheet />
      <FootballCourtInfoPanel />
      <KartTrackPanel />
      <StadiumPanel />
      <StoreInterior />
      <HarborSheet />
      <CineHost />
      <ShowroomSheet />
      <ShipLayer />
      <AirportLayers />
      <ProductSheet />
      <SecretPromoModal />
      <HoyScheduler />
      <HoyHost />
      <Toasts />
      <GuidedTour />
      <InstallLayer />
      <StampToast />
      <ClueModal />
      <DoorIntro auto={startedAtHome} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="p-10 text-center">
      <p className="text-lg font-bold">Este pasillo no existe</p>
      <Link to="/" className="mt-3 inline-block font-bold text-brand">
        Volver al centro comercial
      </Link>
    </div>
  );
}

function ModeSwitch() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode =
    location.pathname === "/"
      ? "explore"
      : location.pathname.startsWith("/comprar")
        ? "shop"
        : null;
  const item = (
    m: "explore" | "shop",
    label: string,
    icon: ReactNode,
    to: string,
  ) => (
    <button
      onClick={() => navigate(to)}
      aria-pressed={mode === m}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition duration-200 active:scale-[0.98] ${mode === m ? "bg-teal text-white shadow-[var(--shadow-glow)]" : "text-ink-soft hover:text-ink"}`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="flex p-1" role="group" aria-label="Modo de experiencia">
      {item(
        "explore",
        "Explorar",
        <Compass className="size-4" strokeWidth={1.8} />,
        "/",
      )}
      {item(
        "shop",
        "Comprar",
        <ShoppingBag className="size-4" strokeWidth={1.8} />,
        "/comprar",
      )}
    </div>
  );
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-[13.5px] font-semibold transition duration-200 ${isActive ? "bg-teal/12 text-teal" : "text-ink-soft hover:text-ink"}`;
const iconBtn =
  "glass relative grid size-11 place-items-center rounded-full text-ink shadow-none transition duration-200 active:scale-[0.96]";

/** Barra superior flotante de vidrio. */
function TopBar() {
  const count = useCartCount();
  const navigate = useNavigate();
  const compare = usePersonal((s) => s.compare.length);
  const loggedIn = useSession((s) => !!s.userId);
  // dentro del mall (mapa) el logo va todo en blanco; en las páginas claras, con su cuadro blanco
  const onMap = useLocation().pathname === "/";
  const storeIds = useSession((s) => s.storeIds);
  const canAdmin = useCanAdmin();
  const avatar = useProfile((p) => p.avatar);
  const owns = useCatalog((c) =>
    c.stores.some((x) => x.setup !== "pending" && storeIds.includes(x.id)),
  );
  return (
    // sin cápsula: el logo y cada botón flotan sueltos sobre el mapa, con aire entre ellos
    <header className="tour-hide chrome-in-top pointer-events-none fixed inset-x-3 top-[max(10px,env(safe-area-inset-top))] z-30 flex h-14 items-center gap-2 md:inset-x-5 md:top-[max(12px,env(safe-area-inset-top))] md:h-[60px] *:pointer-events-auto">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-2.5 rounded-2xl pr-2"
        aria-label="MallPlay, inicio"
      >
        {onMap ? (
          <MallLogoWhite />
        ) : (
          <>
            <MallMark size={40} />
            <MallWordmark className="chrome-text text-[18px] font-extrabold tracking-[-0.02em]" />
          </>
        )}
      </Link>
      <div className="glass mx-auto hidden rounded-full md:block">
        <ModeSwitch />
      </div>
      <nav
        className="glass hidden items-center gap-0.5 rounded-full p-1 lg:flex"
        aria-label="Secciones"
      >
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
        <button
          className={`${iconBtn} ${owns ? "max-sm:hidden" : ""}`}
          onClick={() => navigate("/comprar?foco=1")}
          aria-label="Buscar productos"
        >
          <Search className="size-[21px]" strokeWidth={1.8} />
        </button>
        <Link
          to="/favoritos"
          className={`${iconBtn} max-md:hidden`}
          aria-label="Favoritos"
        >
          <Heart className="size-[21px]" strokeWidth={1.8} />
        </Link>
        {FEATURES.compare && compare > 0 && (
          <Link
            to="/comparar"
            className={`${iconBtn} max-md:hidden`}
            aria-label={`Comparador, ${compare} productos`}
          >
            <Scale className="size-[21px]" strokeWidth={1.8} />
            <Badge n={compare} />
          </Link>
        )}
        {owns && (
          <NavLink
            to="/mi-negocio"
            className={({ isActive }) =>
              `${iconBtn} ${isActive ? "!bg-teal !text-white" : ""}`
            }
            aria-label="Mi negocio: modo dueño"
          >
            <Store className="size-[21px]" strokeWidth={1.8} />
          </NavLink>
        )}
        <BellButton className={iconBtn} />
        {!loggedIn && remoteEnabled() && (
          <Link
            to="/registro"
            className="grid h-11 place-items-center rounded-full bg-teal px-4 text-[14px] font-bold whitespace-nowrap text-white shadow-[var(--shadow-glow)] transition active:scale-[0.96]"
          >
            Crear cuenta
          </Link>
        )}
        <NavLink
          to={loggedIn ? "/mi-cuenta" : "/login"}
          className={({ isActive }) =>
            `${iconBtn} ${isActive ? "!bg-teal !text-white" : ""} ${loggedIn || !remoteEnabled() ? "" : "max-sm:hidden"}`
          }
          aria-label={loggedIn ? "Mi cuenta" : "Iniciar sesión o crear cuenta"}
        >
          {loggedIn && avatar ? (
            <img
              src={avatar}
              alt=""
              className="size-9 rounded-full object-cover"
            />
          ) : (
            <UserRound className="size-[21px]" strokeWidth={1.8} />
          )}
        </NavLink>
        <Link
          to="/carrito"
          className="relative grid size-11 place-items-center rounded-full bg-teal text-white shadow-[var(--shadow-glow)] transition active:scale-[0.96] max-md:hidden"
          aria-label={`Carrito, ${count} productos`}
        >
          <ShoppingCart className="size-[19px]" strokeWidth={1.9} />
          <Badge n={count} />
        </Link>
      </div>
    </header>
  );
}

/** Globito con la cantidad. `icon`: sobre un ícono pequeño, sale por la esquina para no taparlo. */
function Badge({ n, icon = false }: { n: number; icon?: boolean }) {
  if (!n) return null;
  return (
    <span
      className={`absolute grid h-[17px] min-w-[17px] place-items-center rounded-full bg-coral px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white/90 ${icon ? "-top-2.5 -right-3.5" : "-top-1 -right-1"}`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function BottomNav() {
  const count = useCartCount();
  const { pathname } = useLocation();
  if (pathname.startsWith("/mi-negocio")) return null;
  const tabs = [
    { to: "/", label: "Explorar", icon: Compass, end: true },
    { to: "/comprar", label: "Comprar", icon: ShoppingBag },
    { to: "/ofertas", label: "Ofertas", icon: Zap },
    { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
    { to: "/carrito", label: "Carrito", icon: ShoppingCart, badge: count },
  ];
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
                  isActive ? "bg-teal/12 text-teal" : "text-[#66737C]"
                }`
              }
            >
              <span className="relative">
                <t.icon className="size-[21px]" strokeWidth={1.8} />
                {t.badge ? <Badge n={t.badge} icon /> : null}
              </span>
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function CompareTray() {
  const n = usePersonal((s) => s.compare.length);
  const location = useLocation();
  if (!n || location.pathname === "/comparar" || location.pathname === "/")
    return null;
  return (
    <Link
      to="/comparar"
      className="glass fixed bottom-[calc(var(--chrome-bottom)+8px)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-ink md:hidden"
    >
      <Scale className="size-4" /> Comparar ({n})
    </Link>
  );
}
