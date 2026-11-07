import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StadiumPhase } from '../config/stadium'
import { safeStorage } from './storage'

/**
 * Estado del estadio para todos: lo elige el administrador (en obra, casi terminado o inaugurado). Se guarda
 * en mall_settings «features» y se recuerda en este dispositivo.
 */
export const useStadiumPhase = create<{ phase: StadiumPhase; setPhase: (p: StadiumPhase) => void }>()(
  persist((set) => ({ phase: 'construction', setPhase: (phase) => set({ phase }) }), { name: 'cm:stadium-phase:v1', storage: safeStorage }),
)

/** «Escuchar el estadio»: suena el audio (si hay) mientras el estadio inaugurado está a la vista. */
export const useStadiumSound = create<{ playing: boolean; missing: boolean }>()(() => ({ playing: false, missing: false }))

let audio: HTMLAudioElement | null = null

export function stadiumAudioUrl() {
  return `${import.meta.env.BASE_URL}audio/estadio.mp3`
}

/** Reproduce o pausa el audio del estadio. Devuelve false si el archivo todavía no existe. */
export async function toggleStadiumSound(): Promise<boolean> {
  const { playing } = useStadiumSound.getState()
  if (playing) {
    audio?.pause()
    useStadiumSound.setState({ playing: false })
    return true
  }
  try {
    if (!audio) {
      audio = new Audio(stadiumAudioUrl())
      audio.loop = true
      audio.preload = 'auto'
      audio.addEventListener('pause', () => useStadiumSound.setState({ playing: false }))
      audio.addEventListener('error', () => useStadiumSound.setState({ playing: false, missing: true }))
    }
    await audio.play()
    useStadiumSound.setState({ playing: true, missing: false })
    return true
  } catch {
    audio = null
    useStadiumSound.setState({ playing: false, missing: true })
    return false
  }
}

export function stopStadiumSound() {
  audio?.pause()
  useStadiumSound.setState({ playing: false })
}
