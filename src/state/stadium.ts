import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StadiumEventKind, StadiumPhase } from '../config/stadium'
import { safeStorage } from './storage'

/**
 * Estado del estadio para todos: lo elige el administrador (en obra, casi terminado o inaugurado). Se guarda
 * en mall_settings «features» y se recuerda en este dispositivo.
 */
export const useStadiumPhase = create<{ phase: StadiumPhase; setPhase: (p: StadiumPhase) => void }>()(
  persist((set) => ({ phase: 'construction', setPhase: (phase) => set({ phase }) }), { name: 'cm:stadium-phase:v1', storage: safeStorage }),
)

/** Qué evento se juega o se canta en el estadio inaugurado (lo elige el administrador; se sincroniza con todos). */
export const useStadiumEvent = create<{ kind: StadiumEventKind; setKind: (k: StadiumEventKind) => void }>()(
  persist((set) => ({ kind: 'match', setKind: (kind) => set({ kind }) }), { name: 'cm:stadium-event:v1', storage: safeStorage }),
)

/**
 * Sonido del estadio: `playing` = estadio inaugurado «encendido» (suena la canción, luces, hinchada y partido);
 * `works` = «Escuchar obras» mientras está en construcción (pitido de la grúa y ruido de obra).
 */
export const useStadiumSound = create<{ playing: boolean; works: boolean }>()(() => ({ playing: false, works: false }))

type Kind = 'stadium' | 'works'
const FILE: Record<Kind, string> = { stadium: 'audio/estadio.mp3', works: 'audio/obras.mp3' }
const audios: Partial<Record<Kind, HTMLAudioElement>> = {}
const flag = (k: Kind) => (k === 'stadium' ? 'playing' : 'works')

export const stadiumAudioUrl = (k: Kind = 'stadium') => `${import.meta.env.BASE_URL}${FILE[k]}`

async function toggle(kind: Kind): Promise<boolean> {
  const key = flag(kind)
  if (useStadiumSound.getState()[key]) {
    audios[kind]?.pause()
    useStadiumSound.setState({ [key]: false })
    return true
  }
  try {
    let a = audios[kind]
    if (!a) {
      a = new Audio(stadiumAudioUrl(kind))
      a.loop = true
      a.preload = 'auto'
      a.addEventListener('pause', () => useStadiumSound.setState({ [key]: false }))
      a.addEventListener('error', () => useStadiumSound.setState({ [key]: false }))
      audios[kind] = a
    }
    await a.play()
    useStadiumSound.setState({ [key]: true })
    return true
  } catch {
    delete audios[kind]
    useStadiumSound.setState({ [key]: false })
    return false
  }
}

/** Enciende o apaga el estadio inaugurado (con su canción). Devuelve false si el audio no se pudo reproducir. */
export const toggleStadiumSound = () => toggle('stadium')
/** «Escuchar obras»: el sonido de la construcción. */
export const toggleWorksSound = () => toggle('works')

export function stopStadiumSound() {
  audios.stadium?.pause()
  audios.works?.pause()
  useStadiumSound.setState({ playing: false, works: false })
}
