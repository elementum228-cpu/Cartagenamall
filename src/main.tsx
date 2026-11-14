import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { watchAppHeight } from './lib/appHeight'
import { detectProfile, shouldPreload3D } from './lib/deviceProfile'

// Dos aplicaciones del mismo código: la completa y la versión de prueba (build con VITE_DEMO=1).
// La condición se resuelve al compilar: cada build solo incluye la que le toca.
async function boot(): Promise<ComponentType> {
  // Solo en desarrollo: banco de pruebas del edificio de Veneplast (no existe en la versión publicada).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('veneplast-preview')) return (await import('./dev/VeneplastPreview')).default
  if (import.meta.env.VITE_DEMO === '1') return (await import('./demo/DemoApp')).default
  // El mundo 3D es lo primero que se ve (en dispositivos que lo aguantan): su código empieza a bajar ya, en paralelo, en vez de
  // esperar a que la app lo pida. Sin WebGL (plano 2D) no se descarga.
  if (!/^\/(admin|negocio|mi-negocio|mercader)/.test(window.location.pathname) && shouldPreload3D(detectProfile())) {
    // Equipos aptos: en paralelo con la app. Gama baja: justo después de pintar la puerta, para no competir con ella por red y CPU.
    if (detectProfile().tier !== 'low') void import('./world/WorldCanvas')
  }
  const [{ default: App }, { startRemoteSync }, { setupInstall }, { startPassport }, { watchQualityAttr }] = await Promise.all([
    import('./App'),
    import('./remote/sync'),
    import('./pwa/install'),
    import('./state/passport'),
    import('./lib/qualityAttr'),
  ])
  // Con base de datos conectada: catálogo compartido y en vivo (sin ella, modo demostración).
  startRemoteSync()
  // instalar en el celular (aviso del navegador + service worker)
  setupInstall()
  // pasaporte: sellos por visitar pasillos, encontrar gemas y comprar
  startPassport()
  watchQualityAttr()
  return App
}

watchAppHeight()

void boot().then((Root) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
  // Gama baja: el motor 3D baja cuando la puerta ya se pintó (dos cuadros después), sin competir con ella.
  if (import.meta.env.VITE_DEMO !== '1' && detectProfile().tier === 'low' && !/^\/(admin|negocio|mi-negocio|mercader)/.test(window.location.pathname) && shouldPreload3D(detectProfile()))
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => void import('./world/WorldCanvas'), 300)))
})
