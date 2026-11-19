import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useSession } from '../remote/session'
import { rewardCode } from '../state/passport'
import { safeStorage } from '../state/storage'
import { cleanNick, defaultNick, newPlayerId } from './board'
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from './engine'
import { currentLiveRewards } from './rewards'

// Puntos del Arcade: cada partida de «Nave Caribe» suma puntos que la persona canjea por premios. Todo vive en este
// dispositivo (igual que el pasaporte). Hay un tope por partida y por día para que nadie se lleve premios solo jugando
// horas: el juego es un pasatiempo y el premio, un incentivo para volver.

/** Máximo de tiquetes por partida: solo se alcanza con un puntaje altísimo. */
export const MAX_POINTS_PER_RUN = 100
/**
 * Escala de cada juego para convertir puntaje en tiquetes. La curva es suave: al principio cada 10 puntos dan ~1 tiquete (con escala 1000)
 * y, a medida que el puntaje crece, cada punto extra rinde menos, así que la mayoría de partidas da entre 30 y 70 tiquetes y los 100 quedan
 * para puntajes enormes. Es más chica donde el puntaje máximo posible es menor (los bolos tienen 9 lanzamientos de 100 puntos como mucho).
 */
export const TICKET_SCALE = { nave: 1000, cangrejos: 1000, bolos: 300 } as const
export type TicketGame = keyof typeof TICKET_SCALE
/** Sin tope diario de tiquetes: el límite del día son las 5 monedas (cada moneda = una partida). */
export const DAILY_POINTS_CAP = Infinity
/** Monedas gratis cada día: cada una abre una partida en cualquiera de los juegos. */
export const DAILY_COINS = 5

/** Una partida jugada en este dispositivo (se guardan las últimas 60). */
export interface ArcadeRun {
  score: number
  at: string
  /** Entró al ranking (partida verificada por el servidor). */
  ranked: boolean
  awarded: number
  /** Dificultad con la que se jugó (0 fácil … 3 extremo). */
  difficulty?: number
}
export const MAX_SAVED_RUNS = 60

export interface ArcadeRedemption {
  /** Tienda que ofrece el premio. */
  storeId?: string
  storeName?: string
  /** Condiciones y vencimiento del premio al canjearlo (para el bono). */
  detail?: string
  until?: string
  /** La persona ya lo usó en la tienda. */
  used?: boolean
  /** Ya quedó registrado en el servidor (para que el negocio lo valide). */
  synced?: boolean
  code: string
  rewardId: string
  name: string
  cost: number
  at: string
}

/** Puntos que da una partida con este puntaje, respetando el tope por partida y lo que queda del tope del día. */
export function awardFor(score: number, earnedToday: number, scale: number = TICKET_SCALE.nave): number {
  return Math.max(0, Math.min(ticketsFor(score, scale), DAILY_POINTS_CAP - earnedToday))
}

/** Tiquetes de una partida con este puntaje: curva que se aplana hacia el tope (MAX_POINTS_PER_RUN). */
export function ticketsFor(score: number, scale: number = TICKET_SCALE.nave): number {
  return Math.round(MAX_POINTS_PER_RUN * (1 - Math.exp(-Math.max(0, score) / scale)))
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
  /** Monedas del día (se renuevan solas cada día). */
  coinDay: string
  coins: number
  /** Gasta una moneda; devuelve `false` si ya no quedan hoy. */
  spendCoin: () => boolean
  /** Música y efectos del juego (se puede apagar). */
  sound: boolean
  setSound: (on: boolean) => void
  /** Dificultad elegida para la próxima partida: a más difícil, todo baja más rápido y el puntaje se multiplica. */
  difficulty: Difficulty
  setDifficulty: (d: Difficulty) => void
  /** Identificador aleatorio de este dispositivo en el ranking (nunca se muestra a otros). */
  playerId: string
  nickname: string
  /** Mis mejores partidas en este dispositivo (respaldo cuando el ranking en línea no está disponible). */
  localBest: { score: number; at: string }[]
  setNickname: (raw: string) => string
  /** Registra una partida terminada; devuelve cuántos puntos dio y si el tope del día lo recortó. */
  finishRun: (score: number, ranked?: boolean, difficulty?: Difficulty, scale?: number) => { awarded: number; capped: boolean; record: boolean }
  redeem: (rewardId: string) => ArcadeRedemption | null
  markSynced: (code: string) => void
  /** Premio que la persona se puso como meta (id completo `tienda:premio`); null si no hay. */
  goal: string | null
  setGoal: (id: string | null) => void
  /** Marca un bono como usado (o lo devuelve a disponible). */
  markUsed: (code: string, used: boolean) => void
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
      coinDay: dayKey(),
      coins: DAILY_COINS,
      spendCoin: () => {
        // la administración prueba todas las experiencias: monedas ilimitadas
        if (useSession.getState().isAdmin) return true
        const s = get()
        const today = dayKey()
        const left = s.coinDay === today ? s.coins : DAILY_COINS
        if (left <= 0) return false
        set({ coinDay: today, coins: left - 1 })
        return true
      },
      sound: true,
      setSound: (sound) => set({ sound }),
      difficulty: DEFAULT_DIFFICULTY,
      setDifficulty: (d) => set({ difficulty: DIFFICULTIES[d] ? d : DEFAULT_DIFFICULTY }),
      playerId: newPlayerId(),
      nickname: '',
      localBest: [],
      setNickname: (raw) => {
        const nick = cleanNick(raw)
        const ok = nick.length >= 2 ? nick : defaultNick(get().playerId)
        set({ nickname: ok })
        return ok
      },
      finishRun: (score, ranked = false, difficulty = get().difficulty, scale = TICKET_SCALE.nave) => {
        const s = get()
        const today = dayKey()
        const earnedToday = s.day === today ? s.earnedToday : 0
        const awarded = awardFor(score, earnedToday, scale)
        const wanted = ticketsFor(score, scale)
        const record = score > s.best
        const localBest = score > 0 ? [...s.localBest, { score, at: new Date().toISOString() }].sort((a, b) => b.score - a.score).slice(0, 5) : s.localBest
        const runs = score > 0 ? [{ score, at: new Date().toISOString(), ranked, awarded, difficulty }, ...s.runs].slice(0, MAX_SAVED_RUNS) : s.runs
        set({ runs, localBest, points: s.points + awarded, lifetime: s.lifetime + awarded, best: Math.max(s.best, score), plays: s.plays + 1, day: today, earnedToday: earnedToday + awarded })
        return { awarded, capped: awarded < wanted, record }
      },
      redeem: (rewardId) => {
        // los premios son las promociones que las tiendas cargaron desde la administración (activas y sin vencer)
        const reward = currentLiveRewards().find((r) => r.id === rewardId)
        const s = get()
        if (!reward || s.points < reward.cost) return null
        const r: ArcadeRedemption = { code: rewardCode(), rewardId, name: reward.title, storeId: reward.storeId || undefined, storeName: reward.storeName || undefined, detail: reward.detail || undefined, until: reward.until || undefined, cost: reward.cost, at: new Date().toISOString() }
        set({ points: s.points - reward.cost, redemptions: [r, ...s.redemptions].slice(0, 30), goal: s.goal === rewardId ? null : s.goal })
        void import('./vouchers').then((m) => m.syncVoucher(r))
        return r
      },
      goal: null,
      setGoal: (goal) => set({ goal }),
      markSynced: (code) => set((s) => ({ redemptions: s.redemptions.map((r) => (r.code === code ? { ...r, synced: true } : r)) })),
      markUsed: (code, used) => set((s) => ({ redemptions: s.redemptions.map((r) => (r.code === code ? { ...r, used } : r)) })),
    }),
    { name: 'cm:arcade:v1', storage: safeStorage },
  ),
)

/** Abre y cierra el juego (no se guarda). `playing`: hay una partida en curso (la pantalla se vuelve de pantalla completa). */
export type ArcadeGameId = 'nave' | 'cangrejos' | 'bolos'
export type ArcadeTab = 'games' | 'play' | 'rank' | 'prizes'
export const useArcadeUi = create<{ open: boolean; setOpen: (v: boolean) => void; game: ArcadeGameId; openGame: (g: ArcadeGameId) => void; tab: ArcadeTab; setTab: (t: ArcadeTab) => void; openPrizes: () => void; playing: boolean; setPlaying: (v: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set(open ? { open, game: 'nave', tab: 'games', playing: false } : { open, playing: false }),
  game: 'nave',
  tab: 'play',
  setTab: (tab) => set({ tab }),
  openGame: (game) => set({ open: true, game, tab: 'play' }),
  /** Abre el arcade directo en «Premios» (el cuarto de recompensas de la isla). */
  openPrizes: () => set({ open: true, game: 'nave', tab: 'prizes', playing: false }),
  playing: false,
  setPlaying: (playing) => set({ playing }),
}))

if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __cmArcadeUi?: unknown }).__cmArcadeUi = useArcadeUi

/** Monedas que le quedan hoy a la persona (5 al empezar el día). */
export const useCoinsLeft = () => {
  const admin = useSession((s) => s.isAdmin)
  const left = useArcade((s) => (s.coinDay === dayKey() ? s.coins : DAILY_COINS))
  return admin ? Infinity : left
}

/** Tiquetes que lleva una partida con este puntaje (sin el tope del día): para mostrarlos mientras se juega. */
export const liveTickets = (score: number, scale: number = TICKET_SCALE.nave) => ticketsFor(score, scale)
