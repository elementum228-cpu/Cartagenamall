import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

// Temporadas del mall (decoración especial). Por defecto el mall se ve normal; el administrador
// puede fijar una temporada o dejarla automática por fecha (se comparte con todos por la base de
// datos, ver remote/sync). Además, el botón «Tema Halloween» de las opciones del mapa la prueba solo
// en este dispositivo (para mostrarla en una demo). ?temporada=halloween también la previsualiza.

export type Season = 'none' | 'halloween'
export type SeasonMode = 'auto' | Season

export const SEASONS: { id: Season; name: string; window?: { from: [number, number]; to: [number, number] } }[] = [
  { id: 'none', name: 'Sin temporada' },
  // del 15 de octubre al 2 de noviembre (mes 1–12, día)
  { id: 'halloween', name: 'Halloween', window: { from: [10, 15], to: [11, 2] } },
]

interface SeasonState {
  /** Elección del administrador (compartida). */
  mode: SeasonMode
  /** Prueba local de una temporada (solo este dispositivo, no se comparte). */
  preview: Season | null
  setMode: (mode: SeasonMode) => void
  setPreview: (season: Season | null) => void
}

export const useSeasonSettings = create<SeasonState>()(
  persist(
    (set) => ({ mode: 'none', preview: null, setMode: (mode) => set({ mode }), setPreview: (preview) => set({ preview }) }),
    { name: 'cm:season:v2', storage: safeStorage },
  ),
)

/** Temporada que toca por fecha. */
export function seasonByDate(date: Date): Season {
  const md = (date.getMonth() + 1) * 100 + date.getDate()
  for (const s of SEASONS) {
    if (!s.window) continue
    const from = s.window.from[0] * 100 + s.window.from[1]
    const to = s.window.to[0] * 100 + s.window.to[1]
    if (from <= to ? md >= from && md <= to : md >= from || md <= to) return s.id
  }
  return 'none'
}

function fromUrl(): Season | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('temporada')
  if (v === 'ninguna' || v === 'none') return 'none'
  return SEASONS.some((s) => s.id === v) ? (v as Season) : null
}
const urlSeason = fromUrl()

export function resolveSeason(mode: SeasonMode, date = new Date(), preview: Season | null = null): Season {
  if (urlSeason) return urlSeason
  if (preview) return preview
  return mode === 'auto' ? seasonByDate(date) : mode
}

/** Temporada activa ahora (se reevalúa si cambia la elección del administrador). */
export function useSeason(): Season {
  const mode = useSeasonSettings((s) => s.mode)
  const preview = useSeasonSettings((s) => s.preview)
  return resolveSeason(mode, new Date(), preview)
}
