import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { watchAppHeight } from './lib/appHeight'

// Dos aplicaciones del mismo código: la completa y la versión de prueba (build con VITE_DEMO=1).
// La condición se resuelve al compilar: cada build solo incluye la que le toca.
async function boot(): Promise<ComponentType> {
  if (import.meta.env.VITE_DEMO === '1') return (await import('./demo/DemoApp')).default
  const [{ default: App }, { startRemoteSync }, { setupInstall }, { startPassport }] = await Promise.all([
    import('./App'),
    import('./remote/sync'),
    import('./pwa/install'),
    import('./state/passport'),
  ])
  // Con base de datos conectada: catálogo compartido y en vivo (sin ella, modo demostración).
  startRemoteSync()
  // instalar en el celular (aviso del navegador + service worker)
  setupInstall()
  // pasaporte: sellos por visitar pasillos, encontrar gemas y comprar
  startPassport()
  return App
}

watchAppHeight()

void boot().then((Root) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  ),
)
