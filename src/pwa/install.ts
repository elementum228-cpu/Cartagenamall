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
  if (import.meta.env.PROD && 'serviceWorker' in navigator)
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
        /* sin service worker la app funciona igual, solo no se puede instalar */
      })
    })
}
