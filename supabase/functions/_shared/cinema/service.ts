import type { CacheEntry, ShowtimesStore } from './cache.ts'
import { CITIES, ProviderError, STALE_MESSAGE, UNAVAILABLE_MESSAGE, type CitySlug, type Provider, type ProviderBlock, type ProviderErrorCode, type ShowtimesResponse } from './types.ts'

export interface ServiceConfig {
  /** Cuánto vale una lectura buena antes de volver a consultar (por defecto, 20 minutos). */
  ttlMs: number
  /** Tras un fallo, cuánto se espera para reintentar (por defecto, 5 minutos): no se martilla una fuente caída. */
  errorBackoffMs: number
  /** Tiempo máximo por cadena. */
  timeoutMs: number
}

const num = (raw: string | undefined, def: number, min: number, max: number) => {
  const n = Number(raw)
  return Number.isFinite(n) && n >= min && n <= max ? n : def
}

/** Lee la configuración de las variables CINEMA_CACHE_TTL_MINUTES, CINEMA_ERROR_BACKOFF_MINUTES y CINEMA_PROVIDER_TIMEOUT_SECONDS. */
export function readConfig(env: (k: string) => string | undefined): ServiceConfig {
  return {
    ttlMs: num(env('CINEMA_CACHE_TTL_MINUTES'), 20, 1, 24 * 60) * 60_000,
    errorBackoffMs: num(env('CINEMA_ERROR_BACKOFF_MINUTES'), 5, 1, 24 * 60) * 60_000,
    timeoutMs: num(env('CINEMA_PROVIDER_TIMEOUT_SECONDS'), 20, 3, 60) * 1000,
  }
}

export interface ServiceDeps {
  providers: Provider[]
  store: ShowtimesStore
  env: (k: string) => string | undefined
  fetch: typeof fetch
  now: () => Date
  /** Registro del servidor (errores con detalle técnico; nunca llega al usuario). */
  log: (event: string, data: Record<string, unknown>) => void
  config?: Partial<ServiceConfig>
  /** ¿La administración dejó esta cadena encendida? (por defecto, sí). Apagada, sale «no disponible» sin consultar nada. */
  isEnabled?: (providerId: string) => boolean | Promise<boolean>
}

const two = (n: number) => String(n).padStart(2, '0')
/** «Hoy» en Colombia (UTC−5, sin horario de verano), como «AAAA-MM-DD». */
export function bogotaToday(now: Date): string {
  const d = new Date(now.getTime() - 5 * 3600_000)
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`
}

/** Días hacia adelante que se pueden consultar (hoy + 7). */
export const MAX_DAYS_AHEAD = 7

export type RequestCheck = { ok: true; city: CitySlug; date: string } | { ok: false; code: 'unsupported_city' | 'invalid_date' | 'date_out_of_range'; message: string }

/** Valida ciudad y fecha de la petición. La ciudad por defecto es Cartagena; la fecha, hoy. */
export function validateRequest(params: { city?: string | null; date?: string | null }, now: Date): RequestCheck {
  const slug = (params.city ?? 'cartagena')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
  if (!(slug in CITIES)) return { ok: false, code: 'unsupported_city', message: 'Por ahora solo consultamos la cartelera de Cartagena.' }
  const today = bogotaToday(now)
  const date = params.date?.trim() || today
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const valid = !!m && (() => { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] })()
  if (!valid) return { ok: false, code: 'invalid_date', message: 'La fecha debe tener el formato AAAA-MM-DD.' }
  const dayMs = (s: string) => Date.parse(s + 'T00:00:00Z')
  const diff = Math.round((dayMs(date) - dayMs(today)) / 86_400_000)
  if (diff < 0 || diff > MAX_DAYS_AHEAD) return { ok: false, code: 'date_out_of_range', message: `Solo hay horarios de hoy a los próximos ${MAX_DAYS_AHEAD} días.` }
  return { ok: true, city: slug as CitySlug, date }
}

/** Quita URLs completas (pueden llevar claves en la consulta) y acorta, para guardar el detalle de un error en los registros. */
export function sanitizeDetail(detail: string): string {
  return detail.replace(/https?:\/\/([^\s/?#]+)[^\s]*/g, '$1').slice(0, 200)
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new ProviderError('timeout', 'Tardó demasiado')), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

/**
 * Servicio de horarios: por cada cadena devuelve datos de la caché si son recientes; si no, consulta su fuente autorizada.
 * Si la fuente falla se devuelve el último resultado bueno (estado «partial»); si nunca lo hubo, «unavailable» con el
 * enlace oficial. Una cadena sin fuente configurada sale «unavailable» sin consultar nada. Las consultas simultáneas a la
 * misma fuente se juntan en una sola.
 */
export function createShowtimesService(deps: ServiceDeps) {
  const cfg = { ...readConfig(deps.env), ...deps.config }
  const inflight = new Map<string, Promise<ProviderBlock>>()

  const ageMs = (iso: string | null) => (iso ? deps.now().getTime() - Date.parse(iso) : Infinity)

  async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn()
    } catch (e) {
      deps.log('cinema.store_failed', { label, error: e instanceof Error ? e.message : String(e) })
      return null
    }
  }

  async function resolveProvider(p: Provider, city: CitySlug, date: string): Promise<ProviderBlock> {
    const officialUrl = p.officialUrl(city, deps.env)
    const base = { id: p.id, name: p.name, officialUrl }
    const unavailable = (): ProviderBlock => ({ ...base, status: 'unavailable', lastUpdatedAt: null, message: UNAVAILABLE_MESSAGE, cinemas: [] })
    if (!p.isConfigured(deps.env) || (deps.isEnabled && !(await safe('enabled', async () => deps.isEnabled!(p.id))))) return unavailable()

    const entry = await safe('get', () => deps.store.get(p.id, city, date))
    const fromEntry = (e: CacheEntry, fresh: boolean): ProviderBlock => {
      if (!fresh) return { ...base, status: 'partial', lastUpdatedAt: e.fetchedAt, message: STALE_MESSAGE, cinemas: e.cinemas }
      if (e.dropped > 0) return { ...base, status: 'partial', lastUpdatedAt: e.fetchedAt, message: 'Algunas funciones no se pudieron mostrar', cinemas: e.cinemas }
      return { ...base, status: 'available', lastUpdatedAt: e.fetchedAt, ...(e.cinemas.length ? {} : { message: 'Sin funciones para esta fecha' }), cinemas: e.cinemas }
    }
    const stale = (): ProviderBlock => (entry?.fetchedAt ? fromEntry(entry, false) : unavailable())

    if (entry?.fetchedAt && ageMs(entry.fetchedAt) < cfg.ttlMs) return fromEntry(entry, true)
    if (entry?.lastErrorCode && ageMs(entry.lastAttemptAt) < cfg.errorBackoffMs) return stale()

    const started = deps.now().getTime()
    const nowIso = deps.now().toISOString()
    try {
      const data = await withTimeout(p.fetchShowtimes({ city, date, fetch: deps.fetch, env: deps.env }), cfg.timeoutMs)
      const next: CacheEntry = { providerId: p.id, city, date, cinemas: data.cinemas, dropped: data.dropped, fetchedAt: nowIso, lastAttemptAt: nowIso, lastErrorCode: null }
      await safe('set', () => deps.store.set(next))
      await safe('log', async () => deps.store.logAttempt?.({ providerId: p.id, city, date, ok: true, errorCode: null, detail: '', durationMs: deps.now().getTime() - started }))
      return fromEntry(next, true)
    } catch (e) {
      const code: ProviderErrorCode = e instanceof ProviderError ? e.code : 'network'
      const detail = sanitizeDetail(e instanceof ProviderError ? e.detail : e instanceof Error ? e.name : '')
      deps.log('cinema.provider_failed', { provider: p.id, city, date, code, detail })
      const failed: CacheEntry = { providerId: p.id, city, date, cinemas: entry?.cinemas ?? [], dropped: entry?.dropped ?? 0, fetchedAt: entry?.fetchedAt ?? null, lastAttemptAt: nowIso, lastErrorCode: code }
      await safe('set', () => deps.store.set(failed))
      await safe('log', async () => deps.store.logAttempt?.({ providerId: p.id, city, date, ok: false, errorCode: code, detail, durationMs: deps.now().getTime() - started }))
      return stale()
    }
  }

  return {
    config: cfg,
    /** Horarios de una ciudad y un día, de todas las cadenas (cada una por separado: si una falla, las demás siguen). */
    async getShowtimes(city: CitySlug, date: string): Promise<ShowtimesResponse> {
      const blocks = await Promise.all(
        deps.providers.map((p) => {
          const k = `${p.id}|${city}|${date}`
          const running = inflight.get(k)
          if (running) return running
          const job = resolveProvider(p, city, date).finally(() => inflight.delete(k))
          inflight.set(k, job)
          return job
        }),
      )
      const updated = blocks.map((b) => b.lastUpdatedAt).filter((x): x is string => !!x).sort().pop()
      return { city: CITIES[city].name, date, updatedAt: updated ?? deps.now().toISOString(), providers: blocks }
    },
  }
}
