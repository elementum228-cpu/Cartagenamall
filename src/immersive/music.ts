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

// ---- YouTube: reproductor oficial incrustado, sin imagen, solo suena la pista ----
interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  setVolume: (v: number) => void
  getVolume: () => number
  destroy: () => void
}
type YTApi = { Player: new (el: HTMLElement, o: unknown) => YTPlayer }
let ytApi: Promise<YTApi> | null = null
let yt: { player: YTPlayer; host: HTMLElement } | null = null
let ytFade: number | undefined

function loadYT(): Promise<YTApi> {
  const w = window as unknown as { YT?: YTApi & { loaded?: number }; onYouTubeIframeAPIReady?: () => void }
  if (w.YT?.Player) return Promise.resolve(w.YT)
  if (!ytApi)
    ytApi = new Promise((resolve, reject) => {
      const prev = w.onYouTubeIframeAPIReady
      w.onYouTubeIframeAPIReady = () => {
        prev?.()
        resolve(w.YT as YTApi)
      }
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.onerror = () => {
        ytApi = null
        reject(new Error('youtube'))
      }
      document.head.appendChild(tag)
    })
  return ytApi
}

function startYouTube(id: string, fallback: string | null) {
  const token = id + ':' + Date.now()
  ytToken = token
  void loadYT()
    .then((api) => {
      if (ytToken !== token) return
      const host = document.createElement('div')
      // fuera de la vista pero «visible» para el navegador, para que no lo pause
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:200px;opacity:0;pointer-events:none'
      const inner = document.createElement('div')
      host.appendChild(inner)
      document.body.appendChild(host)
      const player = new api.Player(inner, {
        width: 200,
        height: 200,
        videoId: id,
        playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: id, playsinline: 1, disablekb: 1, fs: 0, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            if (ytToken !== token) return
            player.setVolume(0)
            player.playVideo()
            window.clearInterval(ytFade)
            const t0 = performance.now()
            ytFade = window.setInterval(() => {
              const u = Math.min(1, (performance.now() - t0) / 2600)
              player.setVolume(Math.round(MUSIC_VOLUME * 100 * u))
              if (u >= 1) window.clearInterval(ytFade)
            }, 80)
          },
          // el video no se puede incrustar o no existe: suena la clásica de siempre
          onError: () => {
            if (ytToken !== token) return
            stopYouTube(true)
            if (fallback) startMusic(fallback)
          },
        },
      })
      yt = { player, host }
    })
    .catch(() => {
      if (ytToken === token && fallback) startMusic(fallback)
    })
}
let ytToken = ''

function stopYouTube(now: boolean) {
  const cur = yt
  yt = null
  ytToken = ''
  window.clearInterval(ytFade)
  if (!cur) return
  const kill = () => {
    try {
      cur.player.destroy()
    } catch {
      /* ya destruido */
    }
    cur.host.remove()
  }
  if (now) return kill()
  const t0 = performance.now()
  const from = cur.player.getVolume?.() ?? 0
  const iv = window.setInterval(() => {
    const u = Math.min(1, (performance.now() - t0) / 900)
    try {
      cur.player.setVolume(Math.round(from * (1 - u)))
    } catch {
      /* sin reproductor */
    }
    if (u >= 1) {
      window.clearInterval(iv)
      kill()
    }
  }, 60)
}

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
export function startMusic(url: string | null, fallback: string | null = null, force = false) {
  stopMusic(true)
  if (!url || (!force && useInteriorSound.getState().muted)) return
  if (url.startsWith('yt:')) return startYouTube(url.slice(3), fallback)
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
  stopYouTube(now)
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
export function setMusicMuted(muted: boolean, url: string | null, fallback: string | null = null) {
  useInteriorSound.getState().setMuted(muted)
  if (muted) stopMusic()
  else startMusic(url, fallback)
}
