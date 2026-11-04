import { createJSONStorage } from 'zustand/middleware'

// localStorage puede no existir o lanzar (modo privado, cuota llena). La app sigue funcionando en
// memoria en ese caso.
const memory = new Map<string, string>()
// La presentación vive en el mismo sitio que la app real: sus datos van con otro prefijo para no mezclarse.
const P = import.meta.env.VITE_DEMO === '1' ? 'demo:' : ''
let lastWriteFailed = false

/** true si la última escritura no cupo en localStorage (los datos quedan solo hasta recargar). */
export const storageWriteFailed = () => lastWriteFailed

export const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try {
      return localStorage.getItem(P + k)
    } catch {
      return memory.get(k) ?? null
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(P + k, v)
      lastWriteFailed = false
    } catch {
      lastWriteFailed = true
      memory.set(k, v)
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(P + k)
    } catch {
      memory.delete(k)
    }
  },
}))
