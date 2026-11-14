import { create } from 'zustand'

const KEY = 'cm:hoy-seen'
const today = () => new Date().toISOString().slice(0, 10)
export const hoySeenToday = () => {
  try {
    return localStorage.getItem(KEY) === today()
  } catch {
    return false
  }
}

/** Estado de «MallPlay Hoy»: aviso de llegada de la edición y lector abierto. */
export const useHoy = create<{ notice: boolean; reader: boolean; showNotice: () => void; later: () => void; read: () => void; close: () => void }>()((set) => ({
  notice: false,
  reader: false,
  showNotice: () => {
    if (!hoySeenToday()) set({ notice: true })
  },
  later: () => {
    try {
      localStorage.setItem(KEY, today())
    } catch {
      /* sin almacenamiento */
    }
    set({ notice: false })
  },
  read: () => {
    try {
      localStorage.setItem(KEY, today())
    } catch {
      /* sin almacenamiento */
    }
    set({ notice: false, reader: true })
  },
  close: () => set({ reader: false }),
}))
