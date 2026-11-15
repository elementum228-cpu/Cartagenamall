// /functions/v1/wallet-pass
//
// Pases de Wallet para los bonos del Arcade (ver _shared/wallet/pass.ts).
//   POST { action: 'status' }                 → { google, apple }   (qué billeteras están configuradas aquí)
//   POST { action: 'google', pass }           → { url }             enlace «Guardar en Google Wallet»
//   POST { action: 'apple-link', pass }       → { url }             enlace de descarga del .pkpass (el iPhone lo abre en Wallet)
//   GET  ?d=<pase codificado>                 → archivo .pkpass firmado
//
// DESPLIEGUE: el GET lo abre el navegador sin cabeceras de sesión, así que la función se despliega SIN verificación de JWT:
//   supabase functions deploy wallet-pass --no-verify-jwt
//
// SECRETOS (supabase secrets set …). Cada billetera se activa sola cuando están todos los suyos:
//   Google Wallet: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_EMAIL, GOOGLE_WALLET_SA_PRIVATE_KEY
//   Apple Wallet:  APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT_PEM, APPLE_PASS_KEY_PEM, APPLE_WWDR_PEM
//   Opcional:      WALLET_ALLOWED_ORIGINS (orígenes del sitio, separados por coma, para el JWT de Google)
// Los pasos para conseguirlos están en docs/wallet.md.
import { zipSync } from 'npm:fflate@0.8.2'
import forge from 'npm:node-forge@1.3.1'
import { buildPkpass, cleanPass, decodePass, encodePass, googleSaveUrl, signManifest, type AppleConfig, type GoogleConfig, type PassInput } from '../_shared/wallet/pass.ts'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } })

const env = (k: string) => Deno.env.get(k) ?? ''
const google = (): GoogleConfig | null => {
  const c = { issuerId: env('GOOGLE_WALLET_ISSUER_ID'), serviceEmail: env('GOOGLE_WALLET_SA_EMAIL'), privateKey: env('GOOGLE_WALLET_SA_PRIVATE_KEY') }
  return c.issuerId && c.serviceEmail && c.privateKey ? c : null
}
const apple = (): AppleConfig | null => {
  const nl = (s: string) => s.replace(/\\n/g, '\n')
  const c = { passTypeId: env('APPLE_PASS_TYPE_ID'), teamId: env('APPLE_TEAM_ID'), certPem: nl(env('APPLE_PASS_CERT_PEM')), keyPem: nl(env('APPLE_PASS_KEY_PEM')), wwdrPem: nl(env('APPLE_WWDR_PEM')) }
  return c.passTypeId && c.teamId && c.certPem && c.keyPem && c.wwdrPem ? c : null
}
const origins = () => (env('WALLET_ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).filter(Boolean)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const cfg = apple()
    const pass = decodePass(url.searchParams.get('d') ?? '')
    if (!cfg) return json({ error: 'Apple Wallet no está configurado' }, 503)
    if (!pass) return json({ error: 'pase inválido' }, 400)
    try {
      const file = await buildPkpass(cfg, pass, { zipSync, sign: (m) => signManifest(forge, m, cfg) })
      return new Response(file, {
        status: 200,
        headers: { ...CORS, 'content-type': 'application/vnd.apple.pkpass', 'content-disposition': `attachment; filename="bono-${pass.code}.pkpass"`, 'cache-control': 'no-store' },
      })
    } catch (e) {
      console.error('pkpass', e)
      return json({ error: 'no se pudo crear el pase' }, 500)
    }
  }

  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405)
  const raw = await req.text()
  if (raw.length > 20_000) return json({ error: 'cuerpo demasiado grande' }, 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  if (body.action === 'status') return json({ google: !!google(), apple: !!apple() })

  const pass: PassInput | null = cleanPass(body.pass)
  if (!pass) return json({ error: 'datos del bono inválidos' }, 400)

  if (body.action === 'google') {
    const cfg = google()
    if (!cfg) return json({ error: 'Google Wallet no está configurado' }, 503)
    try {
      return json({ url: await googleSaveUrl(cfg, pass, origins()) })
    } catch (e) {
      console.error('google wallet', e)
      return json({ error: 'no se pudo firmar el pase' }, 500)
    }
  }
  if (body.action === 'apple-link') {
    if (!apple()) return json({ error: 'Apple Wallet no está configurado' }, 503)
    // la dirección pública de la función (la de la petición puede ser una interna del gateway)
    const base = env('SUPABASE_URL') ? `${env('SUPABASE_URL')}/functions/v1/wallet-pass` : `${url.origin}${url.pathname}`
    return json({ url: `${base}?d=${encodePass(pass)}` })
  }
  return json({ error: 'acción desconocida' }, 400)
})
