import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { startRemoteSync } from './remote/sync'
import { setupInstall } from './pwa/install'
import { startPassport } from './state/passport'

// Con base de datos conectada: catálogo compartido y en vivo (sin ella, modo demostración).
startRemoteSync()
// instalar en el celular (aviso del navegador + service worker)
setupInstall()
// pasaporte: sellos por visitar pasillos, encontrar gemas y comprar
startPassport()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
