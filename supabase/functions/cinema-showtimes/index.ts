// GET /functions/v1/cinema-showtimes?city=cartagena&date=AAAA-MM-DD
//
// Horarios de cine de una ciudad, normalizados, de todas las cadenas. La app nunca consulta a las cadenas: solo a esta función,
// que sirve desde la caché (TTL configurable) y, cuando vence, consulta las fuentes AUTORIZADAS de cada cadena (ver README).
// Una cadena sin fuente autorizada sale como «Horarios no disponibles temporalmente», con el enlace oficial a su cartelera.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { LayeredStore, MemoryStore } from '../_shared/cinema/cache.ts'
import { providers } from '../_shared/cinema/providers/registry.ts'
import { createShowtimesService, validateRequest } from '../_shared/cinema/service.ts'
import { SupabaseStore } from './store.ts'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, OPTIONS',
}
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', ...extra } })

const env = (k: string) => Deno.env.get(k)
const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!)

// «Apagada» por la administración (tabla cinema_sources.enabled), con una memoria de un minuto para no consultar en cada petición.
let enabledAt = 0
let enabledSet: Set<string> | null = null
async function isEnabled(id: string): Promise<boolean> {
  if (!enabledSet || Date.now() - enabledAt > 60_000) {
    const { data, error } = await db.from('cinema_sources').select('id, enabled')
    if (error || !data) return true // sin tabla o sin respuesta: no se apaga nada
    enabledSet = new Set(data.filter((r) => r.enabled !== false).map((r) => r.id as string))
    enabledAt = Date.now()
    // cadenas nuevas que aún no están en la tabla: encendidas
    for (const p of providers) if (!data.some((r) => r.id === p.id)) enabledSet.add(p.id)
  }
  return enabledSet.has(id)
}

// Un servicio por instancia: la memoria se conserva mientras la instancia siga viva.
const service = createShowtimesService({
  providers,
  store: new LayeredStore(new MemoryStore(), new SupabaseStore(db)),
  env,
  fetch,
  now: () => new Date(),
  log: (event, data) => console.error(JSON.stringify({ event, ...data })),
  isEnabled,
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET') return json({ error: { code: 'method_not_allowed', message: 'Usa GET.' } }, 405)
  const q = new URL(req.url).searchParams
  const check = validateRequest({ city: q.get('city'), date: q.get('date') }, new Date())
  if (!check.ok) return json({ error: { code: check.code, message: check.message } }, 400)
  try {
    const body = await service.getShowtimes(check.city, check.date)
    // Las respuestas valen lo mismo que la caché del servidor: los navegadores pueden reutilizarlas un minuto.
    return json(body, 200, { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' })
  } catch (e) {
    console.error(JSON.stringify({ event: 'cinema.handler_failed', error: e instanceof Error ? e.message : String(e) }))
    return json({ error: { code: 'unavailable', message: 'No pudimos consultar la cartelera por ahora. Intenta de nuevo en unos minutos.' } }, 503)
  }
})
