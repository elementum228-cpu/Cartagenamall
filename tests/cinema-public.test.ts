import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../supabase/functions/_shared/cinema/cache'
import { createPublicPageProvider } from '../supabase/functions/_shared/cinema/providers/page'
import { createPublicFetcher } from '../supabase/functions/_shared/cinema/public-fetch'
import { parseRobots, robotsAllows } from '../supabase/functions/_shared/cinema/robots'
import { createShowtimesService, readConfig } from '../supabase/functions/_shared/cinema/service'
import { ProviderError } from '../supabase/functions/_shared/cinema/types'

const rules = (txt: string) => parseRobots(txt, 'MallPlayCine')

describe('robots.txt', () => {
  it('respeta Disallow y Allow, con comodines y la regla más específica', () => {
    const r = rules(`User-agent: *\nDisallow: /admin\nDisallow: /*?sesion=\nDisallow: /privado$\nAllow: /admin/publico\n# comentario\n`)
    expect(robotsAllows(r, '/cartelera/cartagena')).toBe(true)
    expect(robotsAllows(r, '/admin/usuarios')).toBe(false)
    expect(robotsAllows(r, '/admin/publico/x')).toBe(true)
    expect(robotsAllows(r, '/cartelera?sesion=1')).toBe(false)
    expect(robotsAllows(r, '/privado')).toBe(false)
    expect(robotsAllows(r, '/privado/otro')).toBe(true)
  })
  it('un Disallow vacío no prohíbe nada, y el grupo propio manda sobre «*»', () => {
    expect(robotsAllows(rules('User-agent: *\nDisallow:\n'), '/lo-que-sea')).toBe(true)
    const own = rules('User-agent: *\nDisallow: /\n\nUser-agent: MallPlayCine\nAllow: /\n')
    expect(robotsAllows(own, '/cartelera')).toBe(true)
    const all = rules('User-agent: *\nDisallow: /\n')
    expect(robotsAllows(all, '/cartelera')).toBe(false)
    const other = rules('User-agent: OtroBot\nDisallow: /\n')
    expect(robotsAllows(other, '/cartelera')).toBe(true)
  })
})

/** Sitio de prueba: responde según la ruta y anota cada consulta. */
function site(routes: Record<string, { status?: number; body?: string; headers?: Record<string, string> }>) {
  const calls: string[] = []
  const f = (async (url: string) => {
    const u = new URL(url)
    calls.push(u.host + u.pathname)
    const r = routes[u.host + u.pathname] ?? { status: 404, body: '' }
    return new Response(r.body ?? '', { status: r.status ?? 200, headers: r.headers })
  }) as unknown as typeof fetch
  return { f, calls }
}
const HOSTS = ['cine.example']
const PAGE = 'https://www.cine.example/cartelera/cartagena'

describe('lector de páginas públicas', () => {
  const make = () => {
    const waits: number[] = []
    let t = 1_000_000
    return { waits, get: createPublicFetcher({ minGapMs: 2000, sleep: async (ms) => void (waits.push(ms), (t += ms)), now: () => t }) }
  }

  it('lee robots.txt primero y luego la página; sin robots.txt (404) se puede leer', async () => {
    const s = site({ 'www.cine.example/cartelera/cartagena': { body: '<html>hola</html>' } })
    expect(await make().get(s.f, PAGE, HOSTS)).toBe('<html>hola</html>')
    expect(s.calls).toEqual(['www.cine.example/robots.txt', 'www.cine.example/cartelera/cartagena'])
  })

  it('si robots.txt no permite la página, no la pide', async () => {
    const s = site({ 'www.cine.example/robots.txt': { body: 'User-agent: *\nDisallow: /cartelera' }, 'www.cine.example/cartelera/cartagena': { body: 'x' } })
    await expect(make().get(s.f, PAGE, HOSTS)).rejects.toMatchObject({ code: 'blocked' })
    expect(s.calls).toEqual(['www.cine.example/robots.txt'])
  })

  it('si no se puede saber qué permite robots.txt (error del servidor), no lee', async () => {
    const s = site({ 'www.cine.example/robots.txt': { status: 500 }, 'www.cine.example/cartelera/cartagena': { body: 'x' } })
    await expect(make().get(s.f, PAGE, HOSTS)).rejects.toMatchObject({ code: 'blocked' })
    expect(s.calls).not.toContain('www.cine.example/cartelera/cartagena')
  })

  it('403, 429 o 503 son «bloqueado»: una sola consulta, sin reintentar ni saltarse nada', async () => {
    for (const status of [403, 429, 503]) {
      const s = site({ 'www.cine.example/cartelera/cartagena': { status } })
      await expect(make().get(s.f, PAGE, HOSTS)).rejects.toMatchObject({ code: 'blocked' })
      expect(s.calls.filter((c) => c.endsWith('/cartelera/cartagena'))).toHaveLength(1)
    }
    const s404 = site({ 'www.cine.example/cartelera/cartagena': { status: 500 } })
    await expect(make().get(s404.f, PAGE, HOSTS)).rejects.toMatchObject({ code: 'http_error' })
  })

  it('una verificación anti-bots («Just a moment», captcha) es «bloqueado»; una página grande que solo menciona la palabra, no', async () => {
    const s = site({ 'www.cine.example/cartelera/cartagena': { body: '<title>Just a moment...</title>' } })
    await expect(make().get(s.f, PAGE, HOSTS)).rejects.toMatchObject({ code: 'blocked' })
    const big = site({ 'www.cine.example/cartelera/cartagena': { body: '<p>cartelera</p>' + ' captcha '.repeat(10) + 'x'.repeat(70_000) } })
    await expect(make().get(big.f, PAGE, HOSTS)).resolves.toContain('cartelera')
  })

  it('solo lee https de los sitios permitidos (y no hace ninguna consulta si no lo son)', async () => {
    const s = site({})
    await expect(make().get(s.f, 'https://otro.example/x', HOSTS)).rejects.toMatchObject({ code: 'invalid_response' })
    await expect(make().get(s.f, 'http://www.cine.example/x', HOSTS)).rejects.toMatchObject({ code: 'invalid_response' })
    await expect(make().get(s.f, 'https://cine.example.evil.co/x', HOSTS)).rejects.toMatchObject({ code: 'invalid_response' })
    expect(s.calls).toEqual([])
  })

  it('espacia las consultas al mismo sitio, recuerda robots.txt y no espera entre sitios distintos', async () => {
    const { waits, get } = make()
    const s = site({ 'www.cine.example/a': { body: 'a' }, 'www.cine.example/b': { body: 'b' }, 'www.otro.example/a': { body: 'c' } })
    await get(s.f, 'https://www.cine.example/a', ['cine.example'])
    await get(s.f, 'https://www.cine.example/b', ['cine.example'])
    expect(s.calls.filter((c) => c.endsWith('robots.txt'))).toHaveLength(1)
    // sitio A: robots→página (1 espera) y luego página→página (1 espera)
    expect(waits).toHaveLength(2)
    expect(waits.every((w) => w > 0 && w <= 2000)).toBe(true)
    // sitio B: solo robots→página (1 espera); no espera nada por haber consultado a A justo antes
    await get(s.f, 'https://www.otro.example/a', ['otro.example'])
    expect(waits).toHaveLength(3)
  })

  it('rechaza respuestas enormes', async () => {
    const s = site({ 'www.cine.example/cartelera/cartagena': { body: 'x'.repeat(2_100_000) } })
    await expect(make().get(s.f, PAGE, HOSTS)).rejects.toMatchObject({ code: 'invalid_response' })
  })
})

describe('proveedor de página pública', () => {
  // Página de PRUEBA con una estructura inventada solo para probar el mecanismo (no es la de ninguna cadena real).
  const FIXTURE = '<div data-sede="La Plazuela"><p data-peli="Película" data-min="100"><i data-hora="7:30 PM" data-fmt="3D Doblada" data-url="https://www.cine.example/comprar/1"></i><i data-hora="25:00"></i></p></div>'
  const parse = (html: string) => ({
    cinemas: [...html.matchAll(/data-sede="([^"]+)"/g)].map((m) => ({
      name: m[1],
      movies: [...html.matchAll(/data-peli="([^"]+)" data-min="(\d+)"/g)].map((p) => ({
        title: p[1],
        durationMinutes: Number(p[2]),
        showtimes: [...html.matchAll(/data-hora="([^"]+)"(?: data-fmt="([^"]*)")?(?: data-url="([^"]*)")?/g)].map((s) => ({ time: s[1], format: s[2], bookingUrl: s[3] })),
      })),
    })),
  })
  const provider = (body: string, p: typeof parse = parse) => {
    const s = site({ 'www.cine.example/cartelera': { body } })
    const prov = createPublicPageProvider({ id: 'procinal', name: 'Cine', officialUrls: { cartagena: 'https://www.cine.example/cartagena' }, hosts: ['cine.example'], envPrefix: 'CINEMA_PROCINAL', pageUrl: (_c, d) => `https://www.cine.example/cartelera?fecha=${d}`.replace('?fecha=' + '', '?fecha='), parse: p, fetcher: createPublicFetcher({ minGapMs: 0 }) })
    return { prov, s }
  }
  const ctx = (f: typeof fetch, env: Record<string, string> = {}) => ({ city: 'cartagena' as const, date: '2026-11-13', fetch: f, env: (k: string) => env[k] })

  it('lee la página, la interpreta y normaliza lo publicado', async () => {
    const { prov, s } = provider(FIXTURE)
    const out = await prov.fetchShowtimes(ctx(s.f))
    expect(out.cinemas[0].movies[0]).toMatchObject({ title: 'Película', durationMinutes: 100 })
    expect(out.cinemas[0].movies[0].showtimes).toEqual([{ time: '19:30', format: '3D', language: 'Doblada', bookingUrl: 'https://www.cine.example/comprar/1' }])
    expect(out.dropped).toBe(1)
  })

  it('un diseño que cambió (la interpretación falla o no trae funciones) es un fallo controlado, no datos vacíos', async () => {
    const boom = provider(FIXTURE, () => { throw new Error('selector no encontrado') })
    await expect(boom.prov.fetchShowtimes(ctx(boom.s.f))).rejects.toMatchObject({ code: 'invalid_response' })
    const empty = provider('<html>otra cosa</html>')
    await expect(empty.prov.fetchShowtimes(ctx(empty.s.f))).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('el interruptor de emergencia apaga la lectura de esa cadena', () => {
    const { prov } = provider(FIXTURE)
    expect(prov.isConfigured(() => undefined)).toBe(true)
    expect(prov.isConfigured((k) => (k === 'CINEMA_PROCINAL_PUBLIC_PAGE' ? 'off' : undefined))).toBe(false)
  })

  it('el servicio sigue la cartelera durante el día: refresca al vencer la caché y, si la página bloquea, conserva lo último y espera más antes de volver a mirar', async () => {
    const MIN = 60_000
    let body = FIXTURE
    let status = 200
    const f = (async (url: string) => (new URL(url).pathname.endsWith('robots.txt') ? new Response('', { status: 404 }) : new Response(body, { status }))) as unknown as typeof fetch
    const prov = createPublicPageProvider({ id: 'procinal', name: 'Cine', officialUrls: { cartagena: 'https://www.cine.example/cartagena' }, hosts: ['cine.example'], envPrefix: 'CINEMA_PROCINAL', pageUrl: () => 'https://www.cine.example/cartelera', parse, fetcher: createPublicFetcher({ minGapMs: 0 }) })
    const clock = { t: Date.parse('2026-11-13T15:00:00Z') }
    let reads = 0
    const counted = { ...prov, fetchShowtimes: (c: Parameters<typeof prov.fetchShowtimes>[0]) => (reads++, prov.fetchShowtimes(c)) }
    const svc = createShowtimesService({ providers: [counted], store: new MemoryStore(), env: () => undefined, fetch: f, now: () => new Date(clock.t), log: () => {} })
    const first = (await svc.getShowtimes('cartagena', '2026-11-13')).providers[0]
    expect(first.status).toBe('partial') // la fixture trae una función inválida descartada
    // la película se mueve durante el día: a los 21 minutos se vuelve a leer y aparece lo nuevo
    body = FIXTURE.replace('7:30 PM', '9:45 PM')
    clock.t += 21 * MIN
    const second = (await svc.getShowtimes('cartagena', '2026-11-13')).providers[0]
    expect(second.cinemas[0].movies[0].showtimes[0].time).toBe('21:45')
    expect(reads).toBe(2)
    // la página empieza a bloquear: se conserva lo último y no se vuelve a mirar hasta pasada la espera larga (60 min)
    status = 403
    clock.t += 21 * MIN
    const blocked = (await svc.getShowtimes('cartagena', '2026-11-13')).providers[0]
    expect(blocked.status).toBe('partial')
    expect(blocked.cinemas[0].movies[0].showtimes[0].time).toBe('21:45')
    expect(reads).toBe(3)
    clock.t += 30 * MIN
    await svc.getShowtimes('cartagena', '2026-11-13')
    expect(reads).toBe(3)
    clock.t += 31 * MIN
    await svc.getShowtimes('cartagena', '2026-11-13')
    expect(reads).toBe(4)
  })

  it('la espera tras un bloqueo se puede cambiar con CINEMA_BLOCKED_BACKOFF_MINUTES', () => {
    expect(readConfig(() => undefined).blockedBackoffMs).toBe(60 * 60_000)
    expect(readConfig((k) => (k === 'CINEMA_BLOCKED_BACKOFF_MINUTES' ? '120' : undefined)).blockedBackoffMs).toBe(120 * 60_000)
    expect(readConfig((k) => (k === 'CINEMA_BLOCKED_BACKOFF_MINUTES' ? '1' : undefined)).blockedBackoffMs).toBe(60 * 60_000)
  })

  it('ProviderError mantiene el código para el servicio', () => {
    expect(new ProviderError('blocked', 'x').code).toBe('blocked')
  })
})
