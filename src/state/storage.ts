import { createJSONStorage } from 'zustand/middleware'

// localStorage puede no existir o lanzar (modo privado, cuota llena). La app sigue funcionando en
// memoria en ese caso.
const memory = new Map<string, string>()
let lastWriteFailed = false

/** true si la última escritura no cupo en localStorage (los datos quedan solo hasta recargar). */
export const storageWriteFailed = () => lastWriteFailed

export const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return memory.get(k) ?? null
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
      lastWriteFailed = false
    } catch {
      lastWriteFailed = true
      memory.set(k, v)
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k)
    } catch {
      memory.delete(k)
    }
  },
}))
