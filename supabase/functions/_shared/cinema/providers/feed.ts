import { fetchJson } from '../http.ts'
import { normalizeCinemas } from '../normalizer.ts'
import { CITIES, ProviderError, type CitySlug, type Provider, type ProviderContext, type ProviderData, type ProviderId } from '../types.ts'

/**
 * Adaptador genérico de una cadena que entrega su programación por un **feed autorizado** (acuerdo con la cadena o con un
 * agregador licenciado). No lee páginas web ni sortea protecciones: sin feed configurado, la cadena queda «no disponible».
 *
 * Contrato del feed (GET `<FEED_URL>?city=<ciudad>&date=<AAAA-MM-DD>`, con `Authorization: Bearer <FEED_TOKEN>` si hay token):
 *   { "cinemas": [ { "id", "name", "address",
 *       "movies": [ { "title", "posterUrl", "durationMinutes", "rating",
 *           "showtimes": [ { "time": "19:30" | "7:30 PM", "format": "2D", "language": "Doblada", "bookingUrl": "https://…" } ] } ] } ] }
 * Los campos de texto pueden venir como la fuente los escriba: el normalizador los limpia. Si una cadena entrega otro formato,
 * se pasa `parse` para convertirlo a este.
 */
export interface FeedProviderConfig {
  id: ProviderId
  name: string
  /** Cartelera oficial por ciudad (adonde se redirige para comprar). */
  officialUrls: Partial<Record<CitySlug, string>>
  /** Dominios oficiales de la cadena: los enlaces de compra solo valen si son de aquí. */
  hosts: string[]
  /** Prefijo de las variables de entorno, p. ej. «CINEMA_CINECOLOMBIA» → `_FEED_URL`, `_FEED_TOKEN`, `_OFFICIAL_URL`, `_HOSTS`. */
  envPrefix: string
  /** Convierte la respuesta de la fuente al contrato de arriba (por defecto se usa tal cual). */
  parse?: (json: unknown) => unknown
}

export function createFeedProvider(cfg: FeedProviderConfig): Provider {
  const officialUrl: Provider['officialUrl'] = (city, env) => env(`${cfg.envPrefix}_OFFICIAL_URL`)?.trim() || cfg.officialUrls[city] || Object.values(cfg.officialUrls)[0] || `https://${cfg.hosts[0]}`
  const allowedHosts = (env: ProviderContext['env'], city: CitySlug): string[] => {
    const extra = (env(`${cfg.envPrefix}_HOSTS`) ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
    const own = (() => {
      try {
        return [new URL(officialUrl(city, env)).hostname.replace(/^www\./, '')]
      } catch {
        return []
      }
    })()
    return [...new Set([...cfg.hosts, ...extra, ...own])]
  }
  return {
    id: cfg.id,
    name: cfg.name,
    officialUrl,
    isConfigured: (env) => !!env(`${cfg.envPrefix}_FEED_URL`)?.trim(),
    async fetchShowtimes(ctx: ProviderContext): Promise<ProviderData> {
      const base = ctx.env(`${cfg.envPrefix}_FEED_URL`)?.trim()
      if (!base) throw new ProviderError('not_configured')
      let url: URL
      try {
        url = new URL(base)
      } catch {
        throw new ProviderError('invalid_response', 'La variable FEED_URL no es una URL válida')
      }
      if (url.protocol !== 'https:') throw new ProviderError('invalid_response', 'La variable FEED_URL debe ser https')
      url.searchParams.set('city', ctx.city)
      url.searchParams.set('date', ctx.date)
      const json = await fetchJson(ctx.fetch, url.toString(), ctx.env(`${cfg.envPrefix}_FEED_TOKEN`)?.trim() || undefined)
      const raw = cfg.parse ? cfg.parse(json) : json
      if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { cinemas?: unknown }).cinemas)) throw new ProviderError('invalid_response', 'La respuesta no trae la lista de sedes')
      return normalizeCinemas(raw, { allowedHosts: allowedHosts(ctx.env, ctx.city), officialUrl: officialUrl(ctx.city, ctx.env) })
    },
  }
}

/** Ciudades disponibles (para validar parámetros). */
export const CITY_SLUGS = Object.keys(CITIES) as CitySlug[]
