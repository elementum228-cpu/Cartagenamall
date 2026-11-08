// Sonido de gol del equipo local: el grito de gol y, a los 6 segundos, los fuegos artificiales. El gol del visitante
// no suena. El archivo está en public/audio (no pasa por la caché del service worker).

const URL_GOL = `${import.meta.env.BASE_URL}audio/gol-local.mp3`

import { create } from 'zustand'

/**
 * Prueba de gol solo en este dispositivo (la administración la usa para ver y oír el gol sin tocar el marcador de
 * todos): no se guarda ni se sincroniza.
 */
export const useGoalPreview = create<{ n: number; at: number }>()(() => ({ n: 0, at: 0 }))
export const previewGoal = () => useGoalPreview.setState((s) => ({ n: s.n + 1, at: Date.now() }))

let current: HTMLAudioElement | null = null

/** Detiene el sonido de gol que esté sonando. */
export function stopGoalSound() {
  current?.pause()
  current = null
}

/** Suena el gol. Si el navegador no deja reproducir sin que la persona haya tocado la página, simplemente no suena. */
export function playGoalSound() {
  if (typeof document === 'undefined' || document.hidden) return
  stopGoalSound()
  try {
    const a = new Audio(URL_GOL)
    a.volume = 0.9
    current = a
    void a.play().catch(() => {
      if (current === a) current = null
    })
  } catch {
    current = null
  }
}
