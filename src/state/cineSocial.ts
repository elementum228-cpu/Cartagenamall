import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CineMovie } from './cine'
import type { ChallengeId, CinemaChallenge, GroupPlan, MovieFavorite } from '../cinema/types'
import { safeStorage } from './storage'

/**
 * Lo social y personal de MallPlay Cinema, guardado EN ESTE DISPOSITIVO:
 *  · películas guardadas,
 *  · planes de cine (borradores locales: se pueden compartir como mensaje, pero NO son planes públicos ni hay lista compartida),
 *  · avance de los retos de cine.
 * Los planes públicos, unirse a un plan y la moderación necesitan un servidor (tablas con permisos, reportes y bloqueo): hasta que
 * exista, la interfaz lo dice claramente y no finge que funciona.
 */

export const CHALLENGES: CinemaChallenge[] = [
  { id: 'explore', title: 'Explora MallPlay Cinema', detail: 'Entra al cine y recorre el lobby.', goal: 1, available: true },
  { id: 'discover5', title: 'Descubre cinco películas', detail: 'Abre la ficha de cinco películas distintas.', goal: 5, available: true },
  { id: 'first-save', title: 'Guarda tu primera película', detail: 'Toca «Guardar» en una película.', goal: 1, available: true },
  { id: 'plan', title: 'Crea un plan de cine', detail: 'Arma una salida con tus amigos.', goal: 1, available: true },
  { id: 'trivia', title: 'Participa en una trivia', detail: 'Llegará con los eventos de MallPlay Cinema.', goal: 1, available: false },
  { id: 'invite', title: 'Invita a un amigo', detail: 'Se podrá comprobar cuando existan los planes compartidos.', goal: 1, available: false },
]

export const MAX_FAVORITES = 60
export const MAX_PLANS = 12
const MAX_SEEN = 60

interface CineSocialState {
  favorites: MovieFavorite[]
  /** Películas cuya ficha se abrió (para el reto «descubre cinco»). */
  seen: string[]
  /** Marcas permanentes: no se pierden si luego se quita una película guardada o se borra un plan. */
  explored: boolean
  everSaved: boolean
  everPlanned: boolean
  plans: GroupPlan[]
  /** Retos ya completados, con la fecha: cada uno se celebra una sola vez. */
  done: Partial<Record<ChallengeId, string>>

  isSaved: (id: string) => boolean
  /** Guarda o quita. Devuelve `true` si quedó guardada. */
  toggleFavorite: (m: Pick<CineMovie, 'id' | 'title'>) => boolean
  markSeen: (movieId: string) => void
  markExplored: () => void
  addPlan: (plan: GroupPlan) => boolean
  removePlan: (id: string) => void
  /** Revisa los retos y devuelve los que se completaron AHORA (para avisar una sola vez). */
  settle: (now?: Date) => ChallengeId[]
}

/** Avance actual de un reto. */
export function progressOf(id: ChallengeId, s: Pick<CineSocialState, 'seen' | 'explored' | 'everSaved' | 'everPlanned' | 'favorites' | 'plans'>): number {
  switch (id) {
    case 'explore':
      return s.explored ? 1 : 0
    case 'discover5':
      return Math.min(5, s.seen.length)
    case 'first-save':
      return s.everSaved || s.favorites.length > 0 ? 1 : 0
    case 'plan':
      return s.everPlanned || s.plans.length > 0 ? 1 : 0
    default:
      return 0
  }
}

export const useCineSocial = create<CineSocialState>()(
  persist(
    (set, get) => ({
      favorites: [],
      seen: [],
      explored: false,
      everSaved: false,
      everPlanned: false,
      plans: [],
      done: {},
      isSaved: (id) => get().favorites.some((f) => f.id === id),
      toggleFavorite: (m) => {
        const s = get()
        if (s.favorites.some((f) => f.id === m.id)) {
          set({ favorites: s.favorites.filter((f) => f.id !== m.id) })
          return false
        }
        set({ favorites: [{ id: m.id, title: m.title, savedAt: new Date().toISOString() }, ...s.favorites].slice(0, MAX_FAVORITES), everSaved: true })
        return true
      },
      markSeen: (movieId) => {
        const s = get()
        if (s.seen.includes(movieId)) return
        set({ seen: [movieId, ...s.seen].slice(0, MAX_SEEN) })
      },
      markExplored: () => {
        if (!get().explored) set({ explored: true })
      },
      addPlan: (plan) => {
        const s = get()
        if (s.plans.length >= MAX_PLANS) return false
        set({ plans: [plan, ...s.plans], everPlanned: true })
        return true
      },
      removePlan: (id) => set({ plans: get().plans.filter((p) => p.id !== id) }),
      settle: (now = new Date()) => {
        const s = get()
        const fresh: ChallengeId[] = []
        const done = { ...s.done }
        for (const c of CHALLENGES) {
          if (!c.available || done[c.id]) continue
          if (progressOf(c.id, s) >= c.goal) {
            done[c.id] = now.toISOString()
            fresh.push(c.id)
          }
        }
        if (fresh.length) set({ done })
        return fresh
      },
    }),
    { name: 'cm:cine-social:v1', storage: safeStorage, partialize: (s) => ({ favorites: s.favorites, seen: s.seen, explored: s.explored, everSaved: s.everSaved, everPlanned: s.everPlanned, plans: s.plans, done: s.done }) as never },
  ),
)
