import type { Cinema, CitySlug, ProviderErrorCode, ProviderId } from './types.ts'

/** Último resultado guardado de una cadena para una ciudad y un día. */
export interface CacheEntry {
  providerId: ProviderId
  city: CitySlug
  /** «AAAA-MM-DD». */
  date: string
  cinemas: Cinema[]
  /** Funciones descartadas por inválidas en la última lectura buena. */
  dropped: number
  /** Última lectura BUENA (ISO), o null si nunca la hubo. */
  fetchedAt: string | null
  /** Último intento, bueno o malo (ISO). */
  lastAttemptAt: string | null
  /** Código del último error (null si el último intento funcionó). Nunca texto técnico. */
  lastErrorCode: ProviderErrorCode | null
}

/** Un intento de consulta, para el historial (sin datos personales, sin tokens ni URLs completas). */
export interface FetchAttempt {
  providerId: ProviderId
  city: CitySlug
  date: string
  ok: boolean
  errorCode: ProviderErrorCode | null
  detail: string
  durationMs: number
}

/** Dónde se guarda la caché. En producción: memoria del servidor + Supabase (ver `cinema-showtimes/store.ts`). */
export interface ShowtimesStore {
  get(providerId: ProviderId, city: CitySlug, date: string): Promise<CacheEntry | null>
  set(entry: CacheEntry): Promise<void>
  logAttempt?(attempt: FetchAttempt): Promise<void>
}

const key = (p: string, c: string, d: string) => `${p}|${c}|${d}`

/** Caché en memoria (por instancia del servidor). */
export class MemoryStore implements ShowtimesStore {
  private map = new Map<string, CacheEntry>()
  async get(p: ProviderId, c: CitySlug, d: string) {
    return this.map.get(key(p, c, d)) ?? null
  }
  async set(e: CacheEntry) {
    this.map.set(key(e.providerId, e.city, e.date), e)
  }
}

/** Memoria primero y, si no está, el almacén duradero; al guardar, en los dos. */
export class LayeredStore implements ShowtimesStore {
  constructor(
    private memory: ShowtimesStore,
    private durable: ShowtimesStore,
  ) {}
  async get(p: ProviderId, c: CitySlug, d: string) {
    const hit = await this.memory.get(p, c, d)
    if (hit) return hit
    const stored = await this.durable.get(p, c, d)
    if (stored) await this.memory.set(stored)
    return stored
  }
  async set(e: CacheEntry) {
    await this.memory.set(e)
    await this.durable.set(e)
  }
  async logAttempt(a: FetchAttempt) {
    await this.durable.logAttempt?.(a)
  }
}
