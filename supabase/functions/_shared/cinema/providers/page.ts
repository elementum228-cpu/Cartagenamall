import { createPublicFetcher } from '../public-fetch.ts'
import { normalizeCinemas } from '../normalizer.ts'
import { ProviderError, type CitySlug, type Provider, type ProviderContext, type ProviderData, type ProviderId } from '../types.ts'

/**
 * Adaptador de una cadena que se lee de lo que **publica en su página pública** ese día (sin acuerdo ni feed). Se actualiza
 * con la caché del servicio (cada ~20 min por defecto) para ir siguiendo los cambios de la cartelera durante el día.
 *
 * Lo que hace por todos: respeta robots.txt, espacia las consultas, no insiste si la página bloquea o pide verificación, y
 * normaliza lo leído (`normalizeCinemas`). Lo único propio de cada cadena es `parse`: convierte lo que publica su página
 * (HTML o JSON) al contrato `{ cinemas: [...] }` (ver `providers/feed.ts`); se escribe contra la página real de cada cadena.
 */
export interface PublicPageConfig {
  id: ProviderId
  name: string
  officialUrls: Partial<Record<CitySlug, string>>
  /** Dominios de la cadena: la página y los enlaces de compra solo valen si son de aquí. */
  hosts: string[]
  envPrefix: string
  /** Dirección de la página con la cartelera de una ciudad y un día. */
  pageUrl(city: CitySlug, date: string): string
  /** Convierte lo publicado en la página (HTML o JSON, como texto) al contrato `{ cinemas: [...] }`. */
  parse(body: string, ctx: { city: CitySlug; date: string; url: string }): unknown
  /** Para pruebas: lector con su propia memoria de robots.txt. */
  fetcher?: ReturnType<typeof createPublicFetcher>
}

// Un lector por instancia del servidor: así se comparte la memoria de robots.txt y el espaciado entre consultas.
const shared = createPublicFetcher()

export function createPublicPageProvider(cfg: PublicPageConfig): Provider {
  const officialUrl: Provider['officialUrl'] = (city, env) => env(`${cfg.envPrefix}_OFFICIAL_URL`)?.trim() || cfg.officialUrls[city] || `https://${cfg.hosts[0]}`
  const allowedHosts = (env: ProviderContext['env'], city: CitySlug) => {
    const extra = (env(`${cfg.envPrefix}_HOSTS`) ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
    let own: string[] = []
    try {
      own = [new URL(officialUrl(city, env)).hostname.replace(/^www\./, '')]
    } catch { /* sin URL propia */ }
    return [...new Set([...cfg.hosts, ...extra, ...own])]
  }
  return {
    id: cfg.id,
    name: cfg.name,
    officialUrl,
    // Interruptor de emergencia por variable (CINEMA_<CADENA>_PUBLIC_PAGE=off); la administración también puede apagar la cadena.
    isConfigured: (env) => env(`${cfg.envPrefix}_PUBLIC_PAGE`)?.trim().toLowerCase() !== 'off',
    async fetchShowtimes(ctx: ProviderContext): Promise<ProviderData> {
      const url = cfg.pageUrl(ctx.city, ctx.date)
      const body = await (cfg.fetcher ?? shared)(ctx.fetch, url, allowedHosts(ctx.env, ctx.city))
      let raw: unknown
      try {
        raw = cfg.parse(body, { city: ctx.city, date: ctx.date, url })
      } catch {
        throw new ProviderError('invalid_response', 'No se pudo interpretar la página (¿cambió el diseño?)')
      }
      const out = normalizeCinemas(raw, { allowedHosts: allowedHosts(ctx.env, ctx.city), officialUrl: officialUrl(ctx.city, ctx.env) })
      // Cero sedes puede ser un día sin publicar o un diseño que cambió: se trata como fallo para conservar los últimos datos buenos.
      if (!out.cinemas.length) throw new ProviderError('invalid_response', 'La página no trajo funciones (¿día sin publicar o diseño distinto?)')
      return out
    },
  }
}
