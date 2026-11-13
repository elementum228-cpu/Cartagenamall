// Lee la programación de las cadenas de cine en Cartagena y la deja en mall_settings «cine_feed» para toda la app.
//
// Quién puede llamarla:
//   - un administrador de la app (con su sesión): botón «Sincronizar ahora» en Administración → Cine;
//   - una tarea programada, con el encabezado `x-cron-secret` igual al secreto CINE_SYNC_SECRET.
//
// Cada cadena se lee por separado: si una falla (o su sitio devuelve una lectura vacía, señal de que cambió el diseño),
// se conservan sus últimos datos buenos y se avisa; las demás siguen.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { CHAIN_IDS, type ChainId, type FeedChainDoc, type FeedDoc, type ProviderResult } from '../_shared/cine/types.ts'
import { providers } from './providers.ts'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

/** Tiempo máximo por cadena. */
const CHAIN_TIMEOUT_MS = 25000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Tardó demasiado en responder.')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const secret = Deno.env.get('CINE_SYNC_SECRET')

  // ¿Quién llama? tarea programada (secreto) o administrador (sesión)
  const cron = !!secret && req.headers.get('x-cron-secret') === secret
  if (!cron) {
    const auth = req.headers.get('authorization')
    if (!auth) return json({ error: 'Sin sesión.' }, 401)
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: isAdmin } = await asUser.rpc('is_admin')
    if (isAdmin !== true) return json({ error: 'Solo administradores.' }, 403)
  }

  const db = createClient(url, serviceKey)
  const { data: prevRow } = await db.from('mall_settings').select('doc').eq('key', 'cine_feed').maybeSingle()
  const prev = ((prevRow?.doc as FeedDoc | undefined)?.chains ?? {}) as Partial<Record<ChainId, FeedChainDoc>>
  const now = new Date().toISOString()

  const report = await Promise.all(
    CHAIN_IDS.map(async (chain) => {
      const before: FeedChainDoc = prev[chain] ?? { at: null, ok: false, message: '', movies: [], shows: [] }
      const provider = providers.find((p) => p.chain === chain)
      let next: FeedChainDoc
      if (!provider) {
        next = { ...before, ok: false, message: 'Lector de esta cadena aún no disponible.' }
      } else {
        try {
          const res: ProviderResult = await withTimeout(provider.fetch(fetch), CHAIN_TIMEOUT_MS)
          if (!res.shows.length) throw new Error('La lectura vino sin funciones: ¿cambió el sitio? Se conservan los últimos datos.')
          next = { at: now, ok: true, message: `${res.movies.length} películas y ${res.shows.length} funciones.`, movies: res.movies, shows: res.shows }
        } catch (e) {
          next = { ...before, ok: false, message: e instanceof Error ? e.message.slice(0, 200) : 'Error al leer el sitio.' }
        }
      }
      prev[chain] = next
      return { id: chain, ok: next.ok, message: next.message, movies: next.movies.length, shows: next.shows.length }
    }),
  )

  const { error } = await db.from('mall_settings').upsert({ key: 'cine_feed', doc: { chains: prev } satisfies FeedDoc })
  if (error) return json({ error: 'No se pudo guardar: ' + error.message }, 500)
  return json({ ok: report.every((r) => r.ok), chains: report })
})
