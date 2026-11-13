import { describe, expect, it } from 'vitest'
import { LayeredStore, MemoryStore, type FetchAttempt, type ShowtimesStore } from '../supabase/functions/_shared/cinema/cache'
import { createFeedProvider } from '../supabase/functions/_shared/cinema/providers/feed'
import { providers as registry } from '../supabase/functions/_shared/cinema/providers/registry'
import { bogotaToday, createShowtimesService, readConfig, sanitizeDetail, validateRequest } from '../supabase/functions/_shared/cinema/service'
import { ProviderError, STALE_MESSAGE, UNAVAILABLE_MESSAGE, type Cinema, type Provider, type ProviderId } from '../supabase/functions/_shared/cinema/types'

const MIN = 60_000
const DATE = '2026-11-13'

const cinema: Cinema = { id: 's1', name: 'Sede 1', address: null, movies: [{ title: 'Película', posterUrl: null, durationMinutes: 100, rating: '12+', showtimes: [{ time: '19:30', format: '2D', language: null, bookingUrl: 'https://www.cinecolombia.com/comprar' }] }] }

/** Proveedor de prueba: `behave` decide qué pasa en cada consulta. */
function fake(id: ProviderId, behave: () => Promise<{ cinemas: Cinema[]; dropped: number }>, configured = true) {
  const calls = { n: 0 }
  const p: Provider = {
    id,
    name: id.toUpperCase(),
    officialUrl: () => `https://${id}.example/cartagena`,
    isConfigured: () => configured,
    fetchShowtimes: async () => {
      calls.n++
      return behave()
    },
  }
  return { p, calls }
}

function setup(ps: Provider[], extra: { store?: ShowtimesStore; isEnabled?: (id: string) => boolean; env?: Record<string, string> } = {}) {
  const clock = { t: Date.parse('2026-11-13T15:00:00Z') }
  const logs: { event: string; data: Record<string, unknown> }[] = []
  const store = extra.store ?? new MemoryStore()
  const svc = createShowtimesService({
    providers: ps,
    store,
    env: (k) => extra.env?.[k],
    fetch: (() => Promise.reject(new Error('sin red'))) as typeof fetch,
    now: () => new Date(clock.t),
    log: (event, data) => logs.push({ event, data }),
    isEnabled: extra.isEnabled,
  })
  return { svc, clock, logs, store }
}

describe('configuración', () => {
  it('el TTL por defecto es de 20 minutos y se cambia con CINEMA_CACHE_TTL_MINUTES', () => {
    expect(readConfig(() => undefined).ttlMs).toBe(20 * MIN)
    expect(readConfig((k) => (k === 'CINEMA_CACHE_TTL_MINUTES' ? '45' : undefined)).ttlMs).toBe(45 * MIN)
    for (const bad of ['0', '-5', 'abc', '99999', '']) expect(readConfig((k) => (k === 'CINEMA_CACHE_TTL_MINUTES' ? bad : undefined)).ttlMs).toBe(20 * MIN)
  })
})

describe('validar la petición', () => {
  const now = new Date('2026-11-13T15:00:00Z')
  it('por defecto: Cartagena y hoy (hora de Colombia)', () => {
    expect(validateRequest({}, now)).toEqual({ ok: true, city: 'cartagena', date: DATE })
    expect(validateRequest({ city: ' Cartagena ', date: '' }, now)).toMatchObject({ ok: true, city: 'cartagena' })
  })
  it('«hoy» sigue la hora de Colombia, no la del servidor', () => {
    expect(bogotaToday(new Date('2026-11-14T03:00:00Z'))).toBe('2026-11-13') // 22:00 en Colombia
    expect(bogotaToday(new Date('2026-11-14T05:00:00Z'))).toBe('2026-11-14')
  })
  it('rechaza ciudades sin cobertura, fechas mal escritas y fuera de rango', () => {
    expect(validateRequest({ city: 'bogota' }, now)).toMatchObject({ ok: false, code: 'unsupported_city' })
    expect(validateRequest({ date: '13/11/2026' }, now)).toMatchObject({ ok: false, code: 'invalid_date' })
    expect(validateRequest({ date: '2026-02-31' }, now)).toMatchObject({ ok: false, code: 'invalid_date' })
    expect(validateRequest({ date: '2026-11-12' }, now)).toMatchObject({ ok: false, code: 'date_out_of_range' })
    expect(validateRequest({ date: '2026-11-20' }, now)).toMatchObject({ ok: true })
    expect(validateRequest({ date: '2026-11-21' }, now)).toMatchObject({ ok: false, code: 'date_out_of_range' })
  })
})

describe('el servicio de horarios', () => {
  it('una cadena sin fuente autorizada sale «no disponible», con su enlace oficial y sin consultar nada', async () => {
    const a = fake('procinal', async () => ({ cinemas: [cinema], dropped: 0 }), false)
    const { svc } = setup([a.p])
    const r = await svc.getShowtimes('cartagena', DATE)
    expect(r.providers[0]).toMatchObject({ id: 'procinal', status: 'unavailable', message: UNAVAILABLE_MESSAGE, officialUrl: 'https://procinal.example/cartagena', lastUpdatedAt: null, cinemas: [] })
    expect(a.calls.n).toBe(0)
  })

  it('la respuesta lleva ciudad, fecha, hora de actualización y cadenas', async () => {
    const a = fake('cinecolombia', async () => ({ cinemas: [cinema], dropped: 0 }))
    const { svc, clock } = setup([a.p])
    const r = await svc.getShowtimes('cartagena', DATE)
    expect(r).toMatchObject({ city: 'Cartagena', date: DATE, updatedAt: new Date(clock.t).toISOString() })
    expect(r.providers[0]).toMatchObject({ id: 'cinecolombia', status: 'available', lastUpdatedAt: new Date(clock.t).toISOString() })
    expect(r.providers[0].cinemas[0].movies[0].showtimes[0].bookingUrl).toMatch(/^https:\/\//)
  })

  it('sirve de la caché dentro del TTL y vuelve a consultar al vencer', async () => {
    const a = fake('cinecolombia', async () => ({ cinemas: [cinema], dropped: 0 }))
    const { svc, clock } = setup([a.p])
    await svc.getShowtimes('cartagena', DATE)
    clock.t += 19 * MIN
    await svc.getShowtimes('cartagena', DATE)
    expect(a.calls.n).toBe(1)
    clock.t += 2 * MIN
    await svc.getShowtimes('cartagena', DATE)
    expect(a.calls.n).toBe(2)
  })

  it('cada fecha tiene su propia caché', async () => {
    const a = fake('cinecolombia', async () => ({ cinemas: [cinema], dropped: 0 }))
    const { svc } = setup([a.p])
    await svc.getShowtimes('cartagena', DATE)
    await svc.getShowtimes('cartagena', '2026-11-14')
    expect(a.calls.n).toBe(2)
  })

  it('si la fuente falla, devuelve el último resultado bueno (parcial) y no expone el error técnico', async () => {
    let fail = false
    const a = fake('cinecolombia', async () => {
      if (fail) throw new ProviderError('http_error', 'feed.secreto.com respondió 500 token=ABC123')
      return { cinemas: [cinema], dropped: 0 }
    })
    const { svc, clock, logs } = setup([a.p])
    const first = await svc.getShowtimes('cartagena', DATE)
    fail = true
    clock.t += 25 * MIN
    const r = await svc.getShowtimes('cartagena', DATE)
    const p = r.providers[0]
    expect(p.status).toBe('partial')
    expect(p.message).toBe(STALE_MESSAGE)
    expect(p.cinemas).toEqual(first.providers[0].cinemas)
    expect(p.lastUpdatedAt).toBe(first.providers[0].lastUpdatedAt)
    expect(JSON.stringify(r)).not.toMatch(/secreto|ABC123|500|http_error/)
    // el detalle técnico sí queda en el registro del servidor
    expect(logs.some((l) => l.event === 'cinema.provider_failed' && l.data.code === 'http_error')).toBe(true)
  })

  it('si nunca hubo datos y la fuente falla, la cadena sale «no disponible» con su enlace oficial', async () => {
    const a = fake('procinal', async () => {
      throw new ProviderError('network', 'sin red')
    })
    const { svc } = setup([a.p])
    const r = await svc.getShowtimes('cartagena', DATE)
    expect(r.providers[0]).toMatchObject({ status: 'unavailable', message: UNAVAILABLE_MESSAGE, officialUrl: 'https://procinal.example/cartagena', cinemas: [] })
  })

  it('tras un fallo no martilla la fuente: espera el tiempo de reintento y luego vuelve a probar', async () => {
    const a = fake('cinecolombia', async () => {
      throw new ProviderError('timeout')
    })
    const { svc, clock } = setup([a.p])
    await svc.getShowtimes('cartagena', DATE)
    clock.t += 2 * MIN
    await svc.getShowtimes('cartagena', DATE)
    expect(a.calls.n).toBe(1)
    clock.t += 4 * MIN
    await svc.getShowtimes('cartagena', DATE)
    expect(a.calls.n).toBe(2)
  })

  it('una cadena que falla no afecta a las demás', async () => {
    const bad = fake('cinecolombia', async () => {
      throw new Error('explotó')
    })
    const good = fake('royalfilms', async () => ({ cinemas: [cinema], dropped: 0 }))
    const { svc } = setup([bad.p, good.p])
    const r = await svc.getShowtimes('cartagena', DATE)
    expect(r.providers.map((p) => [p.id, p.status])).toEqual([['cinecolombia', 'unavailable'], ['royalfilms', 'available']])
  })

  it('funciones descartadas por inválidas marcan la cadena como parcial', async () => {
    const a = fake('cinecolombia', async () => ({ cinemas: [cinema], dropped: 3 }))
    const { svc } = setup([a.p])
    expect((await svc.getShowtimes('cartagena', DATE)).providers[0].status).toBe('partial')
  })

  it('una fuente que responde sin funciones ese día es válida: disponible, con un aviso', async () => {
    const a = fake('cinecolombia', async () => ({ cinemas: [], dropped: 0 }))
    const { svc } = setup([a.p])
    expect((await svc.getShowtimes('cartagena', DATE)).providers[0]).toMatchObject({ status: 'available', message: 'Sin funciones para esta fecha', cinemas: [] })
  })

  it('las consultas simultáneas a una misma fuente se juntan en una', async () => {
    const a = fake('cinecolombia', async () => {
      await new Promise((r) => setTimeout(r, 10))
      return { cinemas: [cinema], dropped: 0 }
    })
    const { svc } = setup([a.p])
    await Promise.all([svc.getShowtimes('cartagena', DATE), svc.getShowtimes('cartagena', DATE), svc.getShowtimes('cartagena', DATE)])
    expect(a.calls.n).toBe(1)
  })

  it('la administración puede apagar una cadena: sale «no disponible» sin consultar', async () => {
    const a = fake('cinecolombia', async () => ({ cinemas: [cinema], dropped: 0 }))
    const { svc } = setup([a.p], { isEnabled: () => false })
    expect((await svc.getShowtimes('cartagena', DATE)).providers[0].status).toBe('unavailable')
    expect(a.calls.n).toBe(0)
  })

  it('si la caché duradera falla, se sigue sirviendo (y se registra)', async () => {
    const broken: ShowtimesStore = { get: async () => { throw new Error('db caída') }, set: async () => { throw new Error('db caída') } }
    const a = fake('cinecolombia', async () => ({ cinemas: [cinema], dropped: 0 }))
    const { svc, logs } = setup([a.p], { store: broken })
    expect((await svc.getShowtimes('cartagena', DATE)).providers[0].status).toBe('available')
    expect(logs.some((l) => l.event === 'cinema.store_failed')).toBe(true)
  })

  it('guarda cada intento (bueno o malo) para el historial', async () => {
    const attempts: FetchAttempt[] = []
    const mem = new MemoryStore()
    const store: ShowtimesStore = { get: (p, c, d) => mem.get(p, c, d), set: (e) => mem.set(e), logAttempt: async (a) => void attempts.push(a) }
    let fail = false
    const a = fake('cinecolombia', async () => {
      if (fail) throw new ProviderError('timeout', 'https://feed.example/x?token=SECRETO')
      return { cinemas: [cinema], dropped: 0 }
    })
    const { svc, clock } = setup([a.p], { store })
    await svc.getShowtimes('cartagena', DATE)
    fail = true
    clock.t += 25 * MIN
    await svc.getShowtimes('cartagena', DATE)
    expect(attempts.map((x) => [x.ok, x.errorCode])).toEqual([[true, null], [false, 'timeout']])
    expect(JSON.stringify(attempts)).not.toContain('SECRETO')
  })
})

describe('almacenes', () => {
  it('el almacén en capas guarda en los dos y lee primero de memoria', async () => {
    const mem = new MemoryStore()
    const durable = new MemoryStore()
    const layered = new LayeredStore(mem, durable)
    const entry = { providerId: 'procinal' as const, city: 'cartagena' as const, date: DATE, cinemas: [cinema], dropped: 0, fetchedAt: '2026-11-13T15:00:00.000Z', lastAttemptAt: '2026-11-13T15:00:00.000Z', lastErrorCode: null }
    await layered.set(entry)
    expect(await mem.get('procinal', 'cartagena', DATE)).toEqual(entry)
    expect(await durable.get('procinal', 'cartagena', DATE)).toEqual(entry)
    const fresh = new LayeredStore(new MemoryStore(), durable)
    expect(await fresh.get('procinal', 'cartagena', DATE)).toEqual(entry)
  })

  it('sanitizeDetail quita las URLs completas (pueden llevar claves)', () => {
    expect(sanitizeDetail('falló https://feed.example/api?token=SECRETO&x=1 otra vez')).toBe('falló feed.example otra vez')
    expect(sanitizeDetail('x'.repeat(500))).toHaveLength(200)
  })
})

describe('proveedor de feed autorizado', () => {
  const feedBody = { cinemas: [{ name: 'La Plazuela', movies: [{ title: 'Película', showtimes: [{ time: '7:30 PM', format: '3D', language: 'DOB', bookingUrl: 'https://www.procinal.com.co/comprar/9' }] }] }] }
  const make = () =>
    createFeedProvider({ id: 'procinal', name: 'Procinal', officialUrls: { cartagena: 'https://www.procinal.com.co/ciudad/cartagena' }, hosts: ['procinal.com.co'], envPrefix: 'CINEMA_PROCINAL' })
  const ctx = (env: Record<string, string>, fetchImpl: typeof fetch) => ({ city: 'cartagena' as const, date: DATE, fetch: fetchImpl, env: (k: string) => env[k] })

  it('sin FEED_URL no está configurado', () => {
    expect(make().isConfigured(() => undefined)).toBe(false)
    expect(make().isConfigured((k) => (k === 'CINEMA_PROCINAL_FEED_URL' ? 'https://feed.example/x' : undefined))).toBe(true)
  })

  it('consulta con ciudad y fecha, manda el token y normaliza lo recibido', async () => {
    let seen: { url: string; auth: string | null } | null = null
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, auth: new Headers(init.headers).get('authorization') }
      return new Response(JSON.stringify(feedBody), { status: 200 })
    }) as unknown as typeof fetch
    const out = await make().fetchShowtimes(ctx({ CINEMA_PROCINAL_FEED_URL: 'https://feed.example/v1/showtimes', CINEMA_PROCINAL_FEED_TOKEN: 'tok' }, f))
    expect(seen!.url).toBe(`https://feed.example/v1/showtimes?city=cartagena&date=${DATE}`)
    expect(seen!.auth).toBe('Bearer tok')
    expect(out.cinemas[0].movies[0].showtimes[0]).toMatchObject({ time: '19:30', format: '3D', language: 'Doblada', bookingUrl: 'https://www.procinal.com.co/comprar/9' })
  })

  it('exige https, y una respuesta sin sedes o con error HTTP es un fallo controlado', async () => {
    const ok = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    await expect(make().fetchShowtimes(ctx({ CINEMA_PROCINAL_FEED_URL: 'http://feed.example/x' }, ok))).rejects.toMatchObject({ code: 'invalid_response' })
    await expect(make().fetchShowtimes(ctx({ CINEMA_PROCINAL_FEED_URL: 'https://feed.example/x' }, ok))).rejects.toMatchObject({ code: 'invalid_response' })
    const err = (async () => new Response('x', { status: 503 })) as unknown as typeof fetch
    await expect(make().fetchShowtimes(ctx({ CINEMA_PROCINAL_FEED_URL: 'https://feed.example/x' }, err))).rejects.toMatchObject({ code: 'http_error' })
    const down = (async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
    await expect(make().fetchShowtimes(ctx({ CINEMA_PROCINAL_FEED_URL: 'https://feed.example/x' }, down))).rejects.toMatchObject({ code: 'network' })
  })

  it('el detalle del error nunca lleva el token', async () => {
    const err = (async () => new Response('x', { status: 401 })) as unknown as typeof fetch
    try {
      await make().fetchShowtimes(ctx({ CINEMA_PROCINAL_FEED_URL: 'https://feed.example/x?k=1', CINEMA_PROCINAL_FEED_TOKEN: 'TOKEN-SECRETO' }, err))
    } catch (e) {
      expect(JSON.stringify({ m: (e as Error).message, d: (e as ProviderError).detail })).not.toContain('TOKEN-SECRETO')
    }
  })

  it('HOSTS suma dominios oficiales de compra', async () => {
    const body = { cinemas: [{ name: 'S', movies: [{ title: 'A', showtimes: [{ time: '10:00', bookingUrl: 'https://tickets.royal-films.com/x' }] }] }] }
    const f = (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch
    const without = await make().fetchShowtimes(ctx({ CINEMA_PROCINAL_FEED_URL: 'https://feed.example/x' }, f))
    expect(without.cinemas[0].movies[0].showtimes[0].bookingUrl).toBe('https://www.procinal.com.co/ciudad/cartagena')
    const withHost = await make().fetchShowtimes(ctx({ CINEMA_PROCINAL_FEED_URL: 'https://feed.example/x', CINEMA_PROCINAL_HOSTS: 'royal-films.com' }, f))
    expect(withHost.cinemas[0].movies[0].showtimes[0].bookingUrl).toBe('https://tickets.royal-films.com/x')
  })
})

describe('registro de cadenas', () => {
  it('están las tres cadenas iniciales, con su cartelera oficial en Cartagena', () => {
    expect(registry.map((p) => p.id)).toEqual(['cinecolombia', 'procinal', 'royalfilms'])
    const urls = Object.fromEntries(registry.map((p) => [p.id, p.officialUrl('cartagena', () => undefined)]))
    expect(urls).toEqual({
      cinecolombia: 'https://www.cinecolombia.com/cartagena',
      procinal: 'https://www.procinal.com.co/ciudad/cartagena',
      royalfilms: 'https://cinemasroyal.com/cartelera/cartagena',
    })
  })

  it('sin variables de entorno ninguna cadena está configurada: todas salen «no disponibles» (nada inventado)', async () => {
    const { svc } = setup(registry)
    const r = await svc.getShowtimes('cartagena', DATE)
    expect(r.providers.map((p) => p.status)).toEqual(['unavailable', 'unavailable', 'unavailable'])
    expect(r.providers.every((p) => p.cinemas.length === 0 && p.message === UNAVAILABLE_MESSAGE)).toBe(true)
  })

  it('la URL oficial se puede cambiar por variable de entorno', () => {
    const royal = registry.find((p) => p.id === 'royalfilms')!
    expect(royal.officialUrl('cartagena', (k) => (k === 'CINEMA_ROYALFILMS_OFFICIAL_URL' ? 'https://royal-films.com/cartagena' : undefined))).toBe('https://royal-films.com/cartagena')
  })
})
