// Integración de horarios de cine por ciudad. Núcleo compartido por la función `cinema-showtimes` (Deno) y la app (Vite):
// aquí solo hay tipos y funciones puras.

/** Ciudades con cobertura. Para sumar una, agregarla aquí y a cada proveedor que opere en ella. */
export const CITIES = { cartagena: { name: 'Cartagena' } } as const
export type CitySlug = keyof typeof CITIES

export type ProviderId = 'cinecolombia' | 'procinal' | 'royalfilms'

/**
 * Estado de una cadena en la respuesta:
 *  - available: datos recientes.
 *  - partial: datos algo viejos (la última consulta falló y se muestran los últimos buenos) o con funciones descartadas por inválidas.
 *  - unavailable: no hay datos (sin fuente autorizada configurada, o nunca se pudo consultar).
 */
export type ProviderStatus = 'available' | 'unavailable' | 'partial'

/** Función (una hora de una película en una sede). Todo viene normalizado. */
export interface Showtime {
  /** «HH:MM» (24 h). */
  time: string
  /** «2D», «3D», «IMAX», «4DX», «VIP», «XD»… o null si la fuente no lo dice. */
  format: string | null
  /** «Doblada», «Subtitulada», «Español»… o null si la fuente no lo dice. */
  language: string | null
  /** Enlace OFICIAL para comprar (siempre del sitio de la cadena; si la fuente no trae uno válido, la cartelera oficial). */
  bookingUrl: string
}

export interface MovieShowtimes {
  title: string
  posterUrl: string | null
  durationMinutes: number | null
  rating: string | null
  showtimes: Showtime[]
}

export interface Cinema {
  id: string
  name: string
  address: string | null
  movies: MovieShowtimes[]
}

export interface ProviderBlock {
  id: ProviderId
  name: string
  status: ProviderStatus
  /** Cartelera oficial de la cadena en la ciudad. */
  officialUrl: string
  /** Última vez que se obtuvieron datos buenos (null si nunca). */
  lastUpdatedAt: string | null
  /** Mensaje corto para mostrar al usuario cuando el estado no es «available». */
  message?: string
  cinemas: Cinema[]
}

export interface ShowtimesResponse {
  city: string
  /** «AAAA-MM-DD». */
  date: string
  /** Momento de los datos más recientes de la respuesta (ISO). */
  updatedAt: string
  providers: ProviderBlock[]
}

export interface ProviderContext {
  city: CitySlug
  date: string
  fetch: typeof fetch
  env: (name: string) => string | undefined
}

/** Resultado de consultar una fuente: sedes ya normalizadas y cuántas funciones se descartaron por inválidas. */
export interface ProviderData {
  cinemas: Cinema[]
  dropped: number
}

/** Adaptador de una cadena. Para sumar una: crear su carpeta en `providers/` y registrarla en `providers/registry.ts`. */
export interface Provider {
  id: ProviderId
  name: string
  /** Cartelera oficial por ciudad (donde se redirige para comprar). */
  officialUrl(city: CitySlug, env: ProviderContext['env']): string
  /** ¿Hay una fuente autorizada configurada (variables de entorno)? Sin ella, la cadena sale «no disponible». */
  isConfigured(env: ProviderContext['env']): boolean
  /** Consulta la fuente autorizada. Lanza `ProviderError` si falla. */
  fetchShowtimes(ctx: ProviderContext): Promise<ProviderData>
}

export type ProviderErrorCode = 'timeout' | 'http_error' | 'network' | 'invalid_response' | 'not_configured'

/** Error de una fuente. `detail` es para los registros del servidor y nunca se muestra al usuario. */
export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    public detail = '',
  ) {
    super(code)
    this.name = 'ProviderError'
  }
}

/** Texto genérico que ve el usuario cuando no hay datos de una cadena. */
export const UNAVAILABLE_MESSAGE = 'Horarios no disponibles temporalmente'
export const STALE_MESSAGE = 'Mostrando los últimos horarios disponibles; pueden haber cambiado'
