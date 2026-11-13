import { ProviderError } from './types.ts'

/**
 * Consulta educada a una fuente autorizada: dice quién consulta, pide JSON, no se queda esperando para siempre y traduce
 * los fallos a `ProviderError` (el detalle es solo para los registros del servidor; nunca incluye el token).
 */
export async function fetchJson(fetchImpl: typeof fetch, url: string, token: string | undefined, timeoutMs = 15000): Promise<unknown> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return 'url inválida'
    }
  })()
  try {
    const res = await fetchImpl(url, {
      signal: ctl.signal,
      headers: { accept: 'application/json', 'user-agent': 'MallPlayCine/1.0 (cartelera de Cartagena)', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) throw new ProviderError('http_error', `${host} respondió ${res.status}`)
    try {
      return await res.json()
    } catch {
      throw new ProviderError('invalid_response', `${host} no devolvió JSON`)
    }
  } catch (e) {
    if (e instanceof ProviderError) throw e
    if (e instanceof Error && e.name === 'AbortError') throw new ProviderError('timeout', `${host} no respondió a tiempo`)
    throw new ProviderError('network', `${host}: ${e instanceof Error ? e.name : 'error'}`)
  } finally {
    clearTimeout(timer)
  }
}
