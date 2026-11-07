/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  lazy,
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";

// Evita la «pantalla blanca»: si una página falla al cargar o al dibujarse, se muestra un aviso con
// «Recargar» en vez de dejar la app en blanco. Tras una actualización del sitio, un celular con la versión
// anterior puede pedir archivos que ya no existen: en ese caso se recarga sola, una vez.

const RELOAD_KEY = "cm:chunk-reloaded";
const isChunkError = (e: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError/i.test(
    String((e as Error)?.message ?? e),
  );

function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** `lazy` que, si el archivo de la página ya no existe (versión nueva publicada), recarga la app una vez. */
export function lazyPage<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    load().catch((e) => {
      if (isChunkError(e) && reloadOnce()) return new Promise<never>(() => {});
      throw e;
    }),
  );
}

export class RouteGuard extends Component<
  { children: ReactNode; resetKey?: string },
  { error: Error | null; key?: string }
> {
  state: { error: Error | null; key?: string } = {
    error: null,
    key: this.props.resetKey,
  };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(
    p: { resetKey?: string },
    s: { error: Error | null; key?: string },
  ) {
    // al cambiar de página se vuelve a intentar
    return p.resetKey !== s.key ? { error: null, key: p.resetKey } : null;
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error en la página:", error, info.componentStack);
    if (isChunkError(error)) reloadOnce();
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-lg font-extrabold tracking-tight">
          Algo no cargó bien
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Puede ser una actualización reciente. Recarga para traer la versión
          más nueva.
        </p>
        <button
          className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-bold text-white"
          onClick={() => {
            try {
              sessionStorage.removeItem(RELOAD_KEY);
            } catch {
              /* sin almacenamiento */
            }
            window.location.reload();
          }}
        >
          Recargar
        </button>
      </div>
    );
  }
}
