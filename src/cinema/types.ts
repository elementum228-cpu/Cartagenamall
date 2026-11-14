import type { ChainId } from '../state/cine'

// Modelos de MallPlay Cinema. Películas, funciones y eventos viven en `state/cine.ts` (los carga la administración o la lectura automática
// de las cadenas); aquí están los modelos de la parte social, que hoy se guardan SOLO en este dispositivo hasta que exista un servidor
// con moderación (ver `docs` en `state/cineSocial.ts`).
//
//   Movies           → CineMovie        (state/cine.ts)  título, sinopsis, género, duración, clasificación, cartel, imagen horizontal,
//                                          tráiler, fecha de estreno, año, fecha de revisión; «fuente»: ver MovieSource.
//   Cinemas          → CHAINS           (state/cine.ts)  Cine Colombia, Royal Films, Procinal.
//   CinemaLocations  → Venue            (cinema/venues.ts) solo las sedes verificadas en el sitio oficial.
//   Showtimes        → CineShow         (state/cine.ts)  película, cadena, día, hora, formato, idioma; el enlace oficial sale de movieLink().
//   CinemaEvents     → CineEvent        (state/cine.ts)  estados: borrador, próximamente, abierto, completo, finalizado, cancelado.
//   GroupPlans / PlanParticipants / MovieFavorites / CinemaChallenges → abajo.

/** De dónde sale la información de una película: se muestra para no hacer pasar un ejemplo por dato real. */
export type MovieSource = 'demo' | 'admin' | 'cadena'

export interface PlanParticipant {
  id: string
  /** Nombre o apodo para mostrar (nunca teléfono ni datos personales). */
  name: string
  role: 'organizer' | 'guest'
}

export type PlanPrivacy = 'private' | 'public'
/** `local`: guardado solo en este dispositivo. `published`: reservado para cuando exista el servidor (aún no se usa). */
export type PlanStatus = 'local' | 'published'

export interface GroupPlan {
  id: string
  movieId: string
  /** Copia del título: el plan sigue legible aunque la película salga de cartelera. */
  movieTitle: string
  chain: ChainId | null
  /** Sede (solo las verificadas), o '' si está por definir. */
  venue: string
  /** «AAAA-MM-DD» o '' (por definir). */
  day: string
  /** Hora real de una función cargada, o '' (por definir). */
  time: string
  privacy: PlanPrivacy
  maxParticipants: number
  participants: PlanParticipant[]
  createdAt: string
  status: PlanStatus
}

export interface MovieFavorite {
  id: string
  title: string
  savedAt: string
}

export type ChallengeId = 'explore' | 'discover5' | 'first-save' | 'trivia' | 'plan' | 'invite'

export interface CinemaChallenge {
  id: ChallengeId
  title: string
  detail: string
  /** Cuántas acciones hacen falta. */
  goal: number
  /** `false` = todavía no se puede completar (falta una función que aún no existe): se muestra como «Pronto». */
  available: boolean
}
