import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StadiumEventKind, StadiumPhase } from '../config/stadium'
import { ConcertMix } from '../audio/crowdMix'
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
export const useStadiumSound = create<{ playing: boolean; works: boolean; preview: boolean }>()(() => ({ playing: false, works: false, preview: false }))

/** Canción del concierto (la elige el administrador) y cuánto se oye el público. Se sincroniza con todos. */
export interface StadiumSong {
  /** Dirección del audio subido; sin ella suena la canción por defecto del estadio. */
  url: string | null
  title: string
  /** Volumen del ambiente de hinchada (0–1). */
  crowd: number
}
export const useStadiumSong = create<StadiumSong & { setSong: (p: Partial<StadiumSong>) => void }>()(
  persist((set) => ({ url: null, title: '', crowd: 0.9, setSong: (p) => set(p) }), { name: 'cm:stadium-song:v1', storage: safeStorage }),
)

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
export async function toggleStadiumSound(): Promise<boolean> {
  // concierto: la canción del administrador mezclada con el ambiente del público
  if (useStadiumEvent.getState().kind === 'concert') return toggleConcert()
  return toggle('stadium')
}

const concert = new ConcertMix()
const previewMix = new ConcertMix()
const songUrl = () => useStadiumSong.getState().url ?? stadiumAudioUrl('stadium')
useStadiumSong.subscribe((s) => {
  concert.setCrowd(s.crowd)
  previewMix.setCrowd(s.crowd)
})

async function toggleConcert(): Promise<boolean> {
  if (concert.playing) {
    concert.stop()
    useStadiumSound.setState({ playing: false })
    return true
  }
  try {
    previewMix.stop()
    useStadiumSound.setState({ preview: false })
    await concert.start(songUrl(), useStadiumSong.getState().crowd)
    useStadiumSound.setState({ playing: true })
    return true
  } catch {
    concert.stop()
    useStadiumSound.setState({ playing: false })
    return false
  }
}

/** Administración: oír la mezcla del concierto (canción + público) sin encender el estadio. */
export async function toggleSongPreview(): Promise<boolean> {
  if (previewMix.playing) {
    previewMix.stop()
    useStadiumSound.setState({ preview: false })
    return true
  }
  try {
    concert.stop()
    useStadiumSound.setState({ playing: false })
    await previewMix.start(songUrl(), useStadiumSong.getState().crowd)
    useStadiumSound.setState({ preview: true })
    return true
  } catch {
    previewMix.stop()
    useStadiumSound.setState({ preview: false })
    return false
  }
}
/** «Escuchar obras»: el sonido de la construcción. */
export const toggleWorksSound = () => toggle('works')

export function stopStadiumSound() {
  audios.stadium?.pause()
  audios.works?.pause()
  concert.stop()
  previewMix.stop()
  useStadiumSound.setState({ playing: false, works: false, preview: false })
}
