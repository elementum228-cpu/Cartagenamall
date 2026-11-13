// Núcleo compartido del lector de cartelera: lo usan la función de Supabase `cine-sync` (Deno) y la app (Vite), así que
// aquí no hay nada propio de un entorno: solo tipos y funciones puras.

export type ChainId = 'cine-colombia' | 'royal-films' | 'procinal'
export const CHAIN_IDS: ChainId[] = ['cine-colombia', 'royal-films', 'procinal']

/** Una película tal como la entrega una cadena (sin unificar con las demás). */
export interface ProviderMovie {
  /** Identificador de la película en el sitio de la cadena. */
  externalId: string
  title: string
  image: string | null
  genre: string
  minutes: number | null
  rating: string
  synopsis: string
}

/** Una función tal como la entrega una cadena. Los textos de hora, día, formato e idioma se limpian al unir. */
export interface ProviderShow {
  externalMovieId: string
  /** Día: «AAAA-MM-DD» o «DD/MM/AAAA». */
  day: string
  /** Hora: «14:30», «2:30 PM»… */
  time: string
  /** Texto libre de la función («3D», «VIP», «Doblada», «Subtitulada»…). */
  label?: string
  /** Sede de la cadena en Cartagena (solo informativo). */
  theater?: string
}

/** Lo que devuelve el lector de una cadena en una consulta. */
export interface ProviderResult {
  movies: ProviderMovie[]
  shows: ProviderShow[]
}

/** Lector de una cadena: la función `cine-sync` ejecuta uno por cadena. */
export interface Provider {
  chain: ChainId
  /** Lee la programación de Cartagena. `fetchImpl` es el fetch del entorno (así se prueba con respuestas guardadas). */
  fetch(fetchImpl: typeof fetch): Promise<ProviderResult>
}

/** Resultado de la última lectura de una cadena, tal como se guarda. */
export interface FeedChainDoc {
  /** Momento de la última lectura buena (ISO), o null si nunca hubo una. */
  at: string | null
  /** ¿La última lectura funcionó? Si no, se conservan los últimos datos buenos. */
  ok: boolean
  /** Mensaje corto para el administrador. */
  message: string
  movies: ProviderMovie[]
  shows: ProviderShow[]
}

export interface FeedDoc {
  chains: Partial<Record<ChainId, FeedChainDoc>>
}

export type ShowFormat = '' | '2D' | '3D' | 'VIP'
export type ShowLang = '' | 'DOB' | 'SUB'

/** Película unificada entre cadenas. */
export interface MergedMovie {
  id: string
  title: string
  image: string | null
  genre: string
  minutes: number | null
  rating: string
  synopsis: string
}

/** Función ya limpia, lista para la app (mismo formato que las funciones manuales). */
export interface MergedShow {
  id: string
  movieId: string
  chain: ChainId
  day: string
  time: string
  format: ShowFormat
  lang: ShowLang
}
