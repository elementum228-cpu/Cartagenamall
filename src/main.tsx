import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { startRemoteSync } from './remote/sync'

// Con base de datos conectada: catálogo compartido y en vivo (sin ella, modo demostración).
startRemoteSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
