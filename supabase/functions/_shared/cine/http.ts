/** Lectura educada de un sitio: avisa quién consulta, pide español de Colombia y no se queda esperando para siempre. */
export async function politeFetch(fetchImpl: typeof fetch, url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      ...init,
      signal: ctl.signal,
      headers: { 'user-agent': 'MallPlayCine/1.0 (cartelera de Cartagena)', 'accept-language': 'es-CO,es;q=0.9', ...(init.headers as Record<string, string> | undefined) },
    })
    if (!res.ok) throw new Error(`${new URL(url).host} respondió ${res.status}`)
    return res
  } finally {
    clearTimeout(timer)
  }
}
