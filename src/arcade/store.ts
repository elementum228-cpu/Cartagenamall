import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { rewardCode } from '../state/passport'
import { safeStorage } from '../state/storage'
import { cleanNick, defaultNick, newPlayerId } from './board'

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

/** Una partida jugada en este dispositivo (se guardan las últimas 60). */
export interface ArcadeRun {
  score: number
  at: string
  /** Entró al ranking (partida verificada por el servidor). */
  ranked: boolean
  awarded: number
}
export const MAX_SAVED_RUNS = 60

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
  /** Historial de partidas de este dispositivo (la más reciente primero). */
  runs: ArcadeRun[]
  /** Música y efectos del juego (se puede apagar). */
  sound: boolean
  setSound: (on: boolean) => void
  /** Identificador aleatorio de este dispositivo en el ranking (nunca se muestra a otros). */
  playerId: string
  nickname: string
  /** Mis mejores partidas en este dispositivo (respaldo cuando el ranking en línea no está disponible). */
  localBest: { score: number; at: string }[]
  setNickname: (raw: string) => string
  /** Registra una partida terminada; devuelve cuántos puntos dio y si el tope del día lo recortó. */
  finishRun: (score: number, ranked?: boolean) => { awarded: number; capped: boolean; record: boolean }
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
      runs: [],
      sound: true,
      setSound: (sound) => set({ sound }),
      playerId: newPlayerId(),
      nickname: '',
      localBest: [],
      setNickname: (raw) => {
        const nick = cleanNick(raw)
        const ok = nick.length >= 2 ? nick : defaultNick(get().playerId)
        set({ nickname: ok })
        return ok
      },
      finishRun: (score, ranked = false) => {
        const s = get()
        const today = dayKey()
        const earnedToday = s.day === today ? s.earnedToday : 0
        const awarded = awardFor(score, earnedToday)
        const wanted = Math.min(MAX_POINTS_PER_RUN, Math.floor(Math.max(0, score) / SCORE_PER_POINT))
        const record = score > s.best
        const localBest = score > 0 ? [...s.localBest, { score, at: new Date().toISOString() }].sort((a, b) => b.score - a.score).slice(0, 5) : s.localBest
        const runs = score > 0 ? [{ score, at: new Date().toISOString(), ranked, awarded }, ...s.runs].slice(0, MAX_SAVED_RUNS) : s.runs
        set({ runs, localBest, points: s.points + awarded, lifetime: s.lifetime + awarded, best: Math.max(s.best, score), plays: s.plays + 1, day: today, earnedToday: earnedToday + awarded })
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

/** Abre y cierra el juego (no se guarda). `playing`: hay una partida en curso (la pantalla se vuelve de pantalla completa). */
export const useArcadeUi = create<{ open: boolean; setOpen: (v: boolean) => void; playing: boolean; setPlaying: (v: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set(open ? { open } : { open, playing: false }),
  playing: false,
  setPlaying: (playing) => set({ playing }),
}))
