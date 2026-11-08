import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../state/storage'

// Música de fondo del local: suave, con entrada y salida gradual. Suena al entrar (es un toque de la persona,
// así el navegador lo permite) y se apaga al salir. Cada visitante puede silenciarla, y se recuerda.

export const useInteriorSound = create<{ muted: boolean; setMuted: (m: boolean) => void }>()(
  persist((set) => ({ muted: false, setMuted: (muted) => set({ muted }) }), { name: 'cm:interior-sound:v1', storage: safeStorage }),
)

/** Volumen de fondo: bajito, para que acompañe y no cubra al visitante. */
export const MUSIC_VOLUME = 0.32

let audio: HTMLAudioElement | null = null
let fade: number | undefined

function ramp(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  window.clearInterval(fade)
  const from = el.volume
  const t0 = performance.now()
  fade = window.setInterval(() => {
    const u = Math.min(1, (performance.now() - t0) / ms)
    el.volume = Math.max(0, Math.min(1, from + (to - from) * u))
    if (u >= 1) {
      window.clearInterval(fade)
      done?.()
    }
  }, 40)
}

/** Empieza (o cambia) la música con entrada gradual. Si el navegador no deja reproducir, no pasa nada. */
export function startMusic(url: string | null) {
  stopMusic(true)
  if (!url || useInteriorSound.getState().muted) return
  try {
    const el = new Audio(url)
    el.loop = true
    el.volume = 0
    audio = el
    void el.play().then(() => ramp(el, MUSIC_VOLUME, 2600)).catch(() => {
      if (audio === el) audio = null
    })
  } catch {
    audio = null
  }
}

/** Apaga la música con salida gradual (o de golpe, al cambiar de pista). */
export function stopMusic(now = false) {
  const el = audio
  audio = null
  if (!el) return
  if (now) {
    window.clearInterval(fade)
    el.pause()
    return
  }
  ramp(el, 0, 900, () => el.pause())
}

/** Silencia o reactiva la música que está sonando. */
export function setMusicMuted(muted: boolean, url: string | null) {
  useInteriorSound.getState().setMuted(muted)
  if (muted) stopMusic()
  else startMusic(url)
}
