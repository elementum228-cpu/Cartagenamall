import { useSyncExternalStore } from 'react'

// ¿Hay conexión? Se apoya en los avisos del navegador (online / offline). No es infalible (un wifi sin internet cuenta como «con conexión»),
// por eso las partes que hablan con el servidor siempre manejan el fallo por su cuenta; esto solo sirve para avisarle a la persona y
// ofrecerle algo que hacer (jugar) mientras tanto.

const listeners = new Set<() => void>()
const read = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
let state = read()

function set(next: boolean) {
  if (next === state) return
  state = next
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => set(true))
  window.addEventListener('offline', () => set(false))
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** `true` mientras el dispositivo tenga conexión. */
export const useOnline = () => useSyncExternalStore(subscribe, () => state, () => true)

/** Lectura puntual (fuera de React). */
export const isOnline = () => state
