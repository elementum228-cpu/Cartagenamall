import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { CacheEntry, FetchAttempt, ShowtimesStore } from '../_shared/cinema/cache.ts'
import type { CitySlug, ProviderErrorCode, ProviderId } from '../_shared/cinema/types.ts'

/** Caché duradera en Supabase (tablas de la migración 0025). Solo se usa con la llave de servicio, desde la función. */
export class SupabaseStore implements ShowtimesStore {
  constructor(private db: SupabaseClient) {}

  async get(providerId: ProviderId, city: CitySlug, date: string): Promise<CacheEntry | null> {
    const { data, error } = await this.db
      .from('cinema_showtimes_cache')
      .select('payload, dropped, fetched_at, last_attempt_at, last_error_code')
      .eq('provider_id', providerId)
      .eq('city', city)
      .eq('date', date)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return {
      providerId,
      city,
      date,
      cinemas: Array.isArray(data.payload) ? data.payload : [],
      dropped: data.dropped ?? 0,
      fetchedAt: data.fetched_at,
      lastAttemptAt: data.last_attempt_at,
      lastErrorCode: (data.last_error_code as ProviderErrorCode | null) ?? null,
    }
  }

  async set(e: CacheEntry): Promise<void> {
    const { error } = await this.db.from('cinema_showtimes_cache').upsert({
      provider_id: e.providerId,
      city: e.city,
      date: e.date,
      payload: e.cinemas,
      dropped: e.dropped,
      fetched_at: e.fetchedAt,
      last_attempt_at: e.lastAttemptAt,
      last_error_code: e.lastErrorCode,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
  }

  async logAttempt(a: FetchAttempt): Promise<void> {
    const now = new Date().toISOString()
    await this.db.from('cinema_fetch_log').insert({ provider_id: a.providerId, city: a.city, date: a.date, ok: a.ok, error_code: a.errorCode, detail: a.detail || null, duration_ms: a.durationMs })
    await this.db
      .from('cinema_sources')
      .update(a.ok ? { last_attempt_at: now, last_success_at: now, last_error_code: null, updated_at: now } : { last_attempt_at: now, last_error_code: a.errorCode, updated_at: now })
      .eq('id', a.providerId)
  }
}
