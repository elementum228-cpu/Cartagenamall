import { useUI } from '../state/ui'

// Estado mínimo del recorrido guiado (sale de GuidedTour.tsx para que la puerta de entrada y el botón de opciones puedan
// iniciarlo sin cargar las 23 KB de las tarjetas del recorrido: ese código solo se descarga cuando el recorrido empieza).

const DONE_KEY = 'cm:tour-done'

export function tourDone() {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}

export function markDone() {
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    /* sin almacenamiento: se ofrece de nuevo la próxima vez */
  }
}

export function startTour() {
  useUI.getState().setTourStep(0)
}
