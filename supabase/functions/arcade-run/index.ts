// POST /functions/v1/arcade-run
//
// Partidas verificadas del Arcade («Nave Caribe»). El navegador NUNCA manda su puntaje:
//   1) { action: 'start', player_id }                          → { run_id, seed }   (la semilla la pone el servidor)
//   2) { action: 'finish', run_id, player_id, nickname, inputs, difficulty } → repite la partida con la misma lógica del juego y guarda
//      el puntaje que calcula ELLA (el del navegador no existe para el servidor).
// Con esto, mandar «un puntaje alto» a mano no sirve: hay que entregar movimientos que, repetidos aquí, den ese puntaje, y la
// partida no puede terminar antes del tiempo real que dura jugarla. (Un programa que juegue de verdad sigue siendo posible: por
// eso los ganadores de la semana los revisa la administración antes de entregar premios; ver arcade_admin_week.)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { MAX_STEPS, replay } from '../_shared/arcade/sim.ts'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } })

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
/** La base (migración 0029) rechaza puntajes mayores a 5.000.000: una partida legítima nunca debe fallar por eso. */
const MAX_SCORE = 4_900_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405)
  const raw = await req.text()
  if (raw.length > 1_000_000) return json({ error: 'cuerpo demasiado grande' }, 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  const player = String(body.player_id ?? '')
  if (!UUID.test(player)) return json({ error: 'jugador inválido' }, 400)

  if (body.action === 'start') {
    const { data, error } = await db.rpc('arcade_run_start', { p_player: player })
    if (error) return json({ error: error.message }, error.code === '54000' ? 429 : 400)
    return json(data)
  }

  if (body.action === 'finish') {
    const runId = String(body.run_id ?? '')
    if (!UUID.test(runId)) return json({ error: 'partida inválida' }, 400)
    const inputs = body.inputs
    if (!Array.isArray(inputs) || !inputs.every((n) => typeof n === 'number')) return json({ error: 'registro inválido' }, 400)

    const { data: run, error: runErr } = await db.from('arcade_runs').select('seed, player_id, status').eq('id', runId).maybeSingle()
    if (runErr || !run || run.player_id !== player || run.status !== 'open') return json({ error: 'partida desconocida o ya usada' }, 400)

    // La dificultad la declara el navegador, pero no se puede mentir con ella: la partida se repite con esa dificultad y solo
    // da puntaje si esos movimientos sobreviven en ella. Sin dato = Normal (clientes anteriores).
    const difficulty = body.difficulty === undefined ? 1 : Number(body.difficulty)
    const res = replay(run.seed as number, inputs as number[], difficulty)
    if (!res || !res.over) {
      await db.from('arcade_runs').update({ status: 'rejected', reject_reason: res ? 'no terminó' : 'registro inválido', finished_at: new Date().toISOString() }).eq('id', runId)
      return json({ error: 'partida no válida' }, 422)
    }
    const { data, error } = await db.rpc('arcade_run_record', {
      p_run: runId,
      p_player: player,
      p_nickname: String(body.nickname ?? ''),
      p_score: Math.min(res.score, MAX_SCORE),
      p_steps: Math.min(res.steps, MAX_STEPS),
      p_inputs: inputs,
    })
    if (error) return json({ error: error.message }, error.code === '54000' ? 429 : 400)
    return json(data)
  }

  return json({ error: 'acción desconocida' }, 400)
})
