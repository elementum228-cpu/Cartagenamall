import { create } from 'zustand'

// Instalar la app en el celular. Android/Chrome/Edge avisan con `beforeinstallprompt` y se instala
// con un toque; Safari en iPhone no tiene ese aviso: allá se instala desde Compartir → «Agregar a
// inicio», así que se muestran esos pasos.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallState {
  /** Aviso del navegador guardado para instalar con un toque (Android/escritorio). */
  deferred: BeforeInstallPromptEvent | null
  installed: boolean
  /** Hoja con las instrucciones abierta. */
  sheet: boolean
  openSheet: (open: boolean) => void
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

export const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export const useInstall = create<InstallState>()((set) => ({
  deferred: null,
  installed: isStandalone(),
  sheet: false,
  openSheet: (sheet) => set({ sheet }),
}))

/** Instala con el aviso del navegador si existe; si no, abre los pasos. Devuelve si quedó instalada. */
export async function installApp(): Promise<boolean> {
  const { deferred } = useInstall.getState()
  if (!deferred) {
    useInstall.getState().openSheet(true)
    return false
  }
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  useInstall.setState({ deferred: null, installed: outcome === 'accepted' })
  return outcome === 'accepted'
}

/** Se llama una vez al arrancar: escucha el aviso del navegador y registra el service worker. */
export function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    useInstall.setState({ deferred: e as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, deferred: null, sheet: false }))
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // Si la página ya terminó de cargar (el módulo llega tarde, por la carga perezosa) el evento `load` no vuelve a salir.
    // Lo que la página ya bajó antes de que el service worker tomara el control (la entrada, el mapa, las tipografías…) no pasó por él,
    // así que no estaría guardado: se le pasa la lista para que lo guarde (sale del caché del navegador, casi no cuesta red). Sin esto,
    // abrir la app sin conexión daría una pantalla en blanco.
    const share = () => {
      const urls = performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .filter((u) => u.startsWith(location.origin) && u.includes('/assets/'))
      if (urls.length) void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'precache', urls }))
    }
    const register = () =>
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .then(() => {
          setTimeout(share, 4000)
          setTimeout(share, 25000) // lo que se bajó en reposo después (paneles, arcade)
        })
        .catch(() => {
          /* sin service worker la app funciona igual, solo no se puede instalar */
        })
    if (document.readyState === 'complete') setTimeout(register, 3000)
    else window.addEventListener('load', () => setTimeout(register, 3000))
  }
}
