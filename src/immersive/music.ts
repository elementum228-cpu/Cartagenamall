import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../state/storage'

// Música de fondo del local: suave, con entrada y salida gradual. Suena al entrar (es un toque de la persona,
// así el navegador lo permite) y se apaga al salir. Cada visitante puede silenciarla, y se recuerda.

export const useInteriorSound = create<{ muted: boolean; setMuted: (m: boolean) => void }>()(
  persist((set) => ({ muted: false, setMuted: (muted) => set({ muted }) }), { name: 'cm:interior-sound:v1', storage: safeStorage }),
)

/** Volumen de fondo: bajito, para que acompañe y no cubra al visitante. */
export const MUSIC_VOLUME = 0.4

/** Estado real de la música: el botón del local lo muestra tal cual (no «activa» mientras el navegador la tiene bloqueada). */
export const useMusicStatus = create<{ status: 'idle' | 'playing' | 'blocked' }>()(() => ({ status: 'idle' }))
const setStatus = (status: 'idle' | 'playing' | 'blocked') => useMusicStatus.setState({ status })

let audio: HTMLAudioElement | null = null
// Un solo elemento de audio para toda la app: en iPhone, el navegador solo deja sonar al que ya «desbloqueó» un toque
// de la persona. Con el primer toque en cualquier parte de la app lo desbloqueamos (en silencio) y desde entonces la
// música puede empezar sola al entrar a un local, aunque el sonido se decida segundos después (p. ej. el respaldo de YouTube).
let shared: HTMLAudioElement | null = null
const getAudio = () => (shared ??= new Audio())
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
if (typeof window !== 'undefined') {
  let unlocked = false
  const unlock = () => {
    if (unlocked) return
    const el = getAudio()
    if (audio === el || !el.paused) {
      unlocked = true
      return
    }
    try {
      el.src = SILENT
      void el
        .play()
        .then(() => {
          unlocked = true
          if (audio !== el) el.pause()
        })
        .catch(() => undefined)
    } catch {
      /* sin audio */
    }
  }
  // en iPhone solo cuentan como «toque de la persona» el clic y el final del toque (no al deslizar)
  for (const ev of ['click', 'touchend', 'keydown'] as const) window.addEventListener(ev, unlock, { capture: true })
}

/** Cada pista lleva su propia rampa de volumen: una pista vieja no puede pisar la de la nueva. */
const fades = new WeakMap<HTMLAudioElement, number>()

// ---- YouTube: reproductor oficial incrustado, sin imagen, solo suena la pista ----
interface YTPlayer {
  playVideo: () => void
  unMute?: () => void
  pauseVideo: () => void
  setVolume: (v: number) => void
  getVolume: () => number
  destroy: () => void
}
type YTApi = { Player: new (el: HTMLElement, o: unknown) => YTPlayer }
let ytApi: Promise<YTApi> | null = null
let yt: { player: YTPlayer; host: HTMLElement } | null = null
/** Todos los reproductores de YouTube vivos (también los que se están apagando): al cambiar de local se eliminan todos. */
const ytAll = new Set<{ player: YTPlayer; host: HTMLElement }>()
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
      // en pantalla pero invisible (no fuera de ella): así el navegador no lo trata como oculto ni lo pausa
      host.style.cssText = 'position:fixed;right:0;bottom:0;width:200px;height:200px;opacity:0.01;pointer-events:none;z-index:-1;overflow:hidden'
      const inner = document.createElement('div')
      host.appendChild(inner)
      document.body.appendChild(host)
      let started = false
      let blockedTimer: number | undefined
      let offRetry: (() => void) | null = null
      const cleanup = () => {
        window.clearTimeout(blockedTimer)
        offRetry?.()
        offRetry = null
      }
      const begin = () => {
        if (started || ytToken !== token) return
        started = true
        setStatus('playing')
        cleanup()
        // si mientras esperábamos sonó la clásica de respaldo, se apaga: ahora suena YouTube
        if (audio) stopAudio(true)
        window.clearInterval(ytFade)
        player.setVolume(0)
        const t0 = performance.now()
        ytFade = window.setInterval(() => {
          const u = Math.min(1, (performance.now() - t0) / 2600)
          player.setVolume(Math.round(MUSIC_VOLUME * 100 * u))
          if (u >= 1) window.clearInterval(ytFade)
        }, 80)
      }
      const player = new api.Player(inner, {
        width: 200,
        height: 200,
        videoId: id,
        playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: id, playsinline: 1, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, enablejsapi: 1, origin: location.origin },
        events: {
          onReady: () => {
            if (ytToken !== token) return
            player.unMute?.()
            player.setVolume(0)
            player.playVideo()
            // si en unos segundos no empezó, el navegador bloqueó el autoplay: suena la clásica y, con el primer toque, se reintenta YouTube
            blockedTimer = window.setTimeout(() => {
              if (started || ytToken !== token) return
              if (fallback && !audio) playAudio(fallback)
              else if (!fallback) setStatus('blocked')
              const retry = () => {
                offRetry?.()
                offRetry = null
                if (ytToken !== token) return
                player.unMute?.()
                player.playVideo()
              }
              window.addEventListener('pointerdown', retry, { once: true })
              window.addEventListener('keydown', retry, { once: true })
              offRetry = () => {
                window.removeEventListener('pointerdown', retry)
                window.removeEventListener('keydown', retry)
              }
            }, 3500)
          },
          // 1 = reproduciendo
          onStateChange: (e: { data: number }) => {
            if (e.data === 1) begin()
            // el video terminó (por si el bucle del reproductor falla): arranca de nuevo
            else if (e.data === 0 && ytToken === token) player.playVideo()
          },
          // el video no se puede incrustar o no existe: suena la clásica de siempre
          onError: () => {
            if (ytToken !== token) return
            cleanup()
            stopYouTube(true)
            if (fallback) playAudio(fallback)
          },
        },
      })
      yt = { player, host }
      ytAll.add(yt)
    })
    .catch(() => {
      if (ytToken === token && fallback) playAudio(fallback)
    })
}
let ytToken = ''

function stopYouTube(now: boolean) {
  const cur = yt
  yt = null
  ytToken = ''
  window.clearInterval(ytFade)
  if (now) {
    // cambio de local (o apagado de golpe): nada de YouTube puede quedar sonando, ni siquiera lo que se estaba apagando
    for (const o of ytAll) {
      try {
        o.player.destroy()
      } catch {
        /* ya destruido */
      }
      o.host.remove()
    }
    ytAll.clear()
    return
  }
  if (!cur) return
  const kill = () => {
    try {
      cur.player.destroy()
    } catch {
      /* ya destruido */
    }
    cur.host.remove()
    ytAll.delete(cur)
  }
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
  window.clearInterval(fades.get(el))
  const from = el.volume
  const t0 = performance.now()
  const id = window.setInterval(() => {
    const u = Math.min(1, (performance.now() - t0) / ms)
    el.volume = Math.max(0, Math.min(1, from + (to - from) * u))
    if (u >= 1) {
      window.clearInterval(id)
      fades.delete(el)
      done?.()
    }
  }, 40)
  fades.set(el, id)
}

/** Empieza (o cambia) la música con entrada gradual. Si el navegador no deja reproducir, no pasa nada. */
export function startMusic(url: string | null, fallback: string | null = null, force = false) {
  stopMusic(true)
  setStatus('idle')
  if (!url || (!force && useInteriorSound.getState().muted)) return
  if (url.startsWith('yt:')) return startYouTube(url.slice(3), fallback)
  playAudio(url)
}

/** Pista de audio normal (archivo): empieza con entrada gradual. */
function playAudio(url: string) {
  if (audio) stopAudio(true)
  try {
    const el = getAudio()
    el.pause()
    el.src = url
    el.loop = true
    el.volume = 0
    audio = el
    void el
      .play()
      .then(() => {
        // si mientras tanto cambió o se apagó la pista, no la subimos
        if (audio === el) {
          setStatus('playing')
          ramp(el, MUSIC_VOLUME, 2600)
        }
      })
      .catch(() => {
        // el navegador pidió un toque antes de dejar sonar: con el primero que haga, empieza
        if (audio !== el) return
        setStatus('blocked')
        const retry = () => {
          off()
          if (audio !== el) return
          void el
            .play()
            .then(() => {
              if (audio !== el) return
              setStatus('playing')
              ramp(el, MUSIC_VOLUME, 2600)
            })
            .catch(() => undefined)
        }
        const off = () => {
          window.removeEventListener('pointerdown', retry)
          window.removeEventListener('keydown', retry)
        }
        window.addEventListener('pointerdown', retry, { once: true })
        window.addEventListener('keydown', retry, { once: true })
      })
  } catch {
    audio = null
  }
}

/** Apaga la música con salida gradual (o de golpe, al cambiar de pista). */
export function stopMusic(now = false) {
  stopYouTube(now)
  stopAudio(now)
  setStatus('idle')
}

function stopAudio(now: boolean) {
  const el = audio
  audio = null
  if (!el) return
  if (now) {
    window.clearInterval(fades.get(el))
    el.pause()
    return
  }
  ramp(el, 0, 900, () => {
    // si mientras bajaba empezó otra pista en el mismo elemento, no la apagues
    if (audio !== el) el.pause()
  })
}

/** Silencia o reactiva la música que está sonando. */
export function setMusicMuted(muted: boolean, url: string | null, fallback: string | null = null) {
  useInteriorSound.getState().setMuted(muted)
  if (muted) stopMusic()
  else startMusic(url, fallback)
}
