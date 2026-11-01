import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './storage'

// Temporadas del mall (decoración especial): automática según la fecha, o la que elija el
// administrador (se comparte con todos por la base de datos, ver remote/sync). Para previsualizar,
// ?temporada=halloween o ?temporada=ninguna en la dirección.

export type Season = 'none' | 'halloween'
export type SeasonMode = 'auto' | Season

export const SEASONS: { id: Season; name: string; window?: { from: [number, number]; to: [number, number] } }[] = [
  { id: 'none', name: 'Sin temporada' },
  // del 15 de octubre al 2 de noviembre (mes 1–12, día)
  { id: 'halloween', name: 'Halloween', window: { from: [10, 15], to: [11, 2] } },
]

interface SeasonState {
  mode: SeasonMode
  setMode: (mode: SeasonMode) => void
}

export const useSeasonSettings = create<SeasonState>()(
  persist((set) => ({ mode: 'auto', setMode: (mode) => set({ mode }) }), { name: 'cm:season:v1', storage: safeStorage }),
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

export function resolveSeason(mode: SeasonMode, date = new Date()): Season {
  if (urlSeason) return urlSeason
  return mode === 'auto' ? seasonByDate(date) : mode
}

/** Temporada activa ahora (se reevalúa si cambia la elección del administrador). */
export function useSeason(): Season {
  const mode = useSeasonSettings((s) => s.mode)
  return resolveSeason(mode)
}
