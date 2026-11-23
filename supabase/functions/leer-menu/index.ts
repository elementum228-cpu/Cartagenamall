// POST /functions/v1/leer-menu
//
// Lee con IA (Claude) las imágenes de un menú y devuelve los platos con su precio, ordenados por sección.
//   { storeId, images: [{ media_type: 'image/jpeg', data: '<base64>' }, …] }  → { sections: [{ name, items: [{ name, price, description }] }] }
//   { action: 'status' }                                                     → { enabled }   (¿está la llave configurada?)
//
// Solo puede usarla un administrador o alguien que pertenezca a esa tienda (así nadie gasta la cuenta de IA sin permiso).
// La función se despliega CON verificación de JWT (la de siempre) y además comprueba aquí la sesión y la pertenencia.
//
//   supabase functions deploy leer-menu
//
// SECRETOS (supabase secrets set …):
//   ANTHROPIC_API_KEY   obligatorio: la llave de la API de Anthropic.
//   MENU_MODEL          opcional: el modelo a usar (por defecto claude-opus-5-5).
// Pasos y costos en docs/leer-menu-ia.md.
import Anthropic from 'npm:@anthropic-ai/sdk@1'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cleanAiMenu, cleanImages, MENU_SCHEMA, MENU_SYSTEM, MENU_USER } from '../_shared/menu/read.ts'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } })

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const MODEL = Deno.env.get('MENU_MODEL') || 'claude-opus-5-5'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405)

  const raw = await req.text()
  if (raw.length > 28_000_000) return json({ error: 'las imágenes pesan demasiado' }, 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  // 1) ¿quién es? (el token de la persona, no la llave pública de la app)
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await db.auth.getUser(token)
  const uid = auth.user?.id
  if (!uid) return json({ error: 'Inicia sesión para leer un menú.' }, 401)

  if (body.action === 'status') return json({ enabled: !!apiKey })

  // 2) ¿puede usar esa tienda? administrador o miembro
  const storeId = typeof body.storeId === 'string' ? body.storeId : ''
  if (!storeId) return json({ error: 'falta la tienda' }, 400)
  const [{ data: admin }, { data: member }] = await Promise.all([
    db.from('admins').select('user_id').eq('user_id', uid).maybeSingle(),
    db.from('store_members').select('user_id').eq('user_id', uid).eq('store_id', storeId).maybeSingle(),
  ])
  if (!admin && !member) return json({ error: 'No tienes permiso sobre esa tienda.' }, 403)

  if (!apiKey) return json({ error: 'La lectura con IA aún no está activada en el servidor.' }, 503)
  const images = cleanImages(body.images)
  if (!images) return json({ error: 'Las imágenes no son válidas (máximo 6, JPG, PNG o WebP).' }, 400)

  // 3) a leer
  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: MENU_SYSTEM,
      // sacar texto de una imagen no necesita pensar mucho: esfuerzo bajo = más rápido y barato
      output_config: { effort: 'low', format: { type: 'json_schema', schema: MENU_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [...images.map((i) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: i.media_type, data: i.data } })), { type: 'text' as const, text: MENU_USER }],
        },
      ],
    })
    if (response.stop_reason === 'refusal') return json({ error: 'La IA no pudo leer esta imagen.' }, 422)
    if (response.stop_reason === 'max_tokens') return json({ error: 'El menú es demasiado largo para leerlo de una vez: súbelo por partes.' }, 422)
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const menu = cleanAiMenu(JSON.parse(text))
    return json(menu)
  } catch (e) {
    console.error('leer-menu', e)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Hay muchas lecturas a la vez. Intenta de nuevo en un minuto.' }, 429)
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'La llave de la IA no es válida: revisa ANTHROPIC_API_KEY.' }, 503)
    return json({ error: 'No se pudo leer el menú. Intenta con una foto más clara.' }, 502)
  }
})
