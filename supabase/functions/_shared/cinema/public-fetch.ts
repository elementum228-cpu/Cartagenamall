import { parseRobots, robotsAllows, type RobotsRules } from './robots.ts'
import { ProviderError } from './types.ts'

/** Nombre con el que el lector se presenta (y con el que se busca su grupo en robots.txt). */
export const AGENT = 'MallPlayCine'
const UA = `${AGENT}/1.0 (cartelera de Cartagena)`

/** Señales de que la página puso una verificación anti-bots: si aparecen, no se insiste ni se intenta resolver. */
const CHALLENGE = /captcha|cf-chl|just a moment|attention required|are you (a )?robot|verifica que eres humano|access denied/i
const MAX_BYTES = 2_000_000

export interface PublicFetchOptions {
  /** Pausa mínima entre dos consultas al mismo sitio (por defecto, 2 s). */
  minGapMs?: number
  timeoutMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

/**
 * Lector responsable de páginas públicas: antes de leer una página mira el robots.txt del sitio y la respeta; espacia las
 * consultas al mismo sitio; y si la página bloquea (403/429/503), pide verificación o no deja leerla, se detiene con
 * `ProviderError('blocked')` sin insistir ni intentar saltarse nada. Una instancia guarda su memoria de robots.txt (24 h) y
 * del último momento en que consultó cada sitio.
 */
export function createPublicFetcher(opts: PublicFetchOptions = {}) {
  const minGap = opts.minGapMs ?? 2000
  const timeoutMs = opts.timeoutMs ?? 15000
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const now = opts.now ?? Date.now
  const robots = new Map<string, { at: number; rules: RobotsRules }>()
  const lastAt = new Map<string, number>()

  async function throttle(host: string) {
    const wait = (lastAt.get(host) ?? -Infinity) + minGap - now()
    lastAt.set(host, Math.max(now(), (lastAt.get(host) ?? 0) + minGap))
    if (wait > 0) await sleep(wait)
  }

  async function get(fetchImpl: typeof fetch, url: string, accept: string): Promise<Response> {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      return await fetchImpl(url, { signal: ctl.signal, redirect: 'follow', headers: { accept, 'user-agent': UA, 'accept-language': 'es-CO,es;q=0.9' } })
    } catch (e) {
      const host = new URL(url).host
      if (e instanceof Error && e.name === 'AbortError') throw new ProviderError('timeout', `${host} no respondió a tiempo`)
      throw new ProviderError('network', `${host}: ${e instanceof Error ? e.name : 'error'}`)
    } finally {
      clearTimeout(timer)
    }
  }

  async function rulesFor(fetchImpl: typeof fetch, origin: string, host: string): Promise<RobotsRules> {
    const hit = robots.get(host)
    if (hit && now() - hit.at < 24 * 3600_000) return hit.rules
    await throttle(host)
    const res = await get(fetchImpl, `${origin}/robots.txt`, 'text/plain')
    let rules: RobotsRules
    if (res.status === 404 || res.status === 410) rules = { allow: [], disallow: [] } // sin robots.txt: sin restricciones
    else if (res.ok) rules = parseRobots((await res.text()).slice(0, 200_000), AGENT)
    else throw new ProviderError('blocked', `${host}: no se pudo leer robots.txt (${res.status})`) // sin saber qué permiten, no se lee
    robots.set(host, { at: now(), rules })
    return rules
  }

  /** Devuelve el texto de una página pública (HTML o JSON) de uno de los `allowedHosts`, si robots.txt lo permite. */
  return async function fetchPublicPage(fetchImpl: typeof fetch, url: string, allowedHosts: string[]): Promise<string> {
    let u: URL
    try {
      u = new URL(url)
    } catch {
      throw new ProviderError('invalid_response', 'URL de página inválida')
    }
    const host = u.hostname.toLowerCase()
    if (u.protocol !== 'https:' || !allowedHosts.some((h) => host === h || host.endsWith('.' + h))) throw new ProviderError('invalid_response', `${host} no es un sitio permitido`)
    const rules = await rulesFor(fetchImpl, u.origin, host)
    if (!robotsAllows(rules, u.pathname + u.search)) throw new ProviderError('blocked', `${host}: robots.txt no permite leer esta página`)
    await throttle(host)
    const res = await get(fetchImpl, u.toString(), 'text/html,application/json;q=0.9')
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) throw new ProviderError('blocked', `${host} respondió ${res.status}${res.headers.get('retry-after') ? ` (retry-after ${res.headers.get('retry-after')})` : ''}`)
    if (!res.ok) throw new ProviderError('http_error', `${host} respondió ${res.status}`)
    const body = await res.text()
    if (body.length > MAX_BYTES) throw new ProviderError('invalid_response', `${host}: respuesta demasiado grande`)
    if (CHALLENGE.test(body.slice(0, 20_000)) && body.length < 60_000) throw new ProviderError('blocked', `${host}: la página pide verificación`)
    return body
  }
}
