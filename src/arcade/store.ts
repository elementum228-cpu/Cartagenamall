import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { rewardCode } from '../state/passport'
import { safeStorage } from '../state/storage'

// Puntos del Arcade: cada partida de «Nave Caribe» suma puntos que la persona canjea por premios. Todo vive en este
// dispositivo (igual que el pasaporte). Hay un tope por partida y por día para que nadie se lleve premios solo jugando
// horas: el juego es un pasatiempo y el premio, un incentivo para volver.

/** Puntaje del juego necesario para ganar 1 punto de premio. */
export const SCORE_PER_POINT = 10
/** Máximo de puntos por partida y por día. */
export const MAX_POINTS_PER_RUN = 60
export const DAILY_POINTS_CAP = 240

export interface ArcadeReward {
  id: string
  name: string
  detail: string
  cost: number
}

/** Premios iniciales (los valores finales los define el mall). */
export const ARCADE_REWARDS: ArcadeReward[] = [
  { id: 'ficha', name: 'Ficha extra de arcade', detail: 'Una partida de cortesía en los juegos de la isla de entretenimiento.', cost: 100 },
  { id: 'descuento', name: '10 % de descuento', detail: 'En tu próxima compra en cualquier tienda participante.', cost: 250 },
  { id: 'bono', name: 'Bono de $10.000', detail: 'Para usar en la tienda o restaurante que elijas.', cost: 600 },
]

export interface ArcadeRedemption {
  code: string
  rewardId: string
  name: string
  cost: number
  at: string
}

/** Puntos que da una partida con este puntaje, respetando el tope por partida y lo que queda del tope del día. */
export function awardFor(score: number, earnedToday: number): number {
  const raw = Math.min(MAX_POINTS_PER_RUN, Math.floor(Math.max(0, score) / SCORE_PER_POINT))
  return Math.max(0, Math.min(raw, DAILY_POINTS_CAP - earnedToday))
}

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface ArcadeState {
  /** Puntos disponibles para canjear. */
  points: number
  lifetime: number
  best: number
  plays: number
  day: string
  earnedToday: number
  redemptions: ArcadeRedemption[]
  /** Registra una partida terminada; devuelve cuántos puntos dio y si el tope del día lo recortó. */
  finishRun: (score: number) => { awarded: number; capped: boolean; record: boolean }
  redeem: (rewardId: string) => ArcadeRedemption | null
}

export const useArcade = create<ArcadeState>()(
  persist(
    (set, get) => ({
      points: 0,
      lifetime: 0,
      best: 0,
      plays: 0,
      day: dayKey(),
      earnedToday: 0,
      redemptions: [],
      finishRun: (score) => {
        const s = get()
        const today = dayKey()
        const earnedToday = s.day === today ? s.earnedToday : 0
        const awarded = awardFor(score, earnedToday)
        const wanted = Math.min(MAX_POINTS_PER_RUN, Math.floor(Math.max(0, score) / SCORE_PER_POINT))
        const record = score > s.best
        set({ points: s.points + awarded, lifetime: s.lifetime + awarded, best: Math.max(s.best, score), plays: s.plays + 1, day: today, earnedToday: earnedToday + awarded })
        return { awarded, capped: awarded < wanted, record }
      },
      redeem: (rewardId) => {
        const reward = ARCADE_REWARDS.find((r) => r.id === rewardId)
        const s = get()
        if (!reward || s.points < reward.cost) return null
        const r: ArcadeRedemption = { code: rewardCode(), rewardId, name: reward.name, cost: reward.cost, at: new Date().toISOString() }
        set({ points: s.points - reward.cost, redemptions: [r, ...s.redemptions].slice(0, 30) })
        return r
      },
    }),
    { name: 'cm:arcade:v1', storage: safeStorage },
  ),
)

/** Abre y cierra el juego (no se guarda). */
export const useArcadeUi = create<{ open: boolean; setOpen: (v: boolean) => void }>()((set) => ({ open: false, setOpen: (open) => set({ open }) }))
