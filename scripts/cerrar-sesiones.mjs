#!/usr/bin/env node
// Cierra TODAS las sesiones de TODAS las cuentas en todos los dispositivos (cierre de emergencia).
//
//   npm run cerrar-sesiones -- --confirmar
//
// Necesita dos variables de entorno (la llave de servicio es secreta: nunca la subas al repositorio):
//   SUPABASE_URL                 https://TU-PROYECTO.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    la llave «service_role» (Supabase → Project Settings → API)
// Antes hay que haber aplicado la migración supabase/migrations/0032_cerrar_todas_las_sesiones.sql.

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const fail = (msg, code = 1) => {
  console.error(`\n✗ ${msg}\n`)
  process.exit(code)
}

if (!url || !key) fail('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.', 2)
if (!process.argv.includes('--confirmar')) {
  console.log(`
Esto cierra la sesión de TODAS las cuentas (clientes, negocios y administradores) en TODOS los dispositivos.
Las cuentas no se borran: cada persona tendrá que volver a entrar.

Para continuar:  npm run cerrar-sesiones -- --confirmar
`)
  process.exit(0)
}

const res = await fetch(`${url}/rest/v1/rpc/cerrar_todas_las_sesiones`, {
  method: 'POST',
  headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: '{}',
}).catch((e) => fail(`No se pudo conectar: ${e.message}`))

const text = await res.text()
if (!res.ok) fail(`El servidor respondió ${res.status}: ${text.slice(0, 300)}\n  ¿Aplicaste la migración 0032_cerrar_todas_las_sesiones.sql?`)

let out = {}
try {
  out = JSON.parse(text)
} catch {
  /* respuesta sin forma esperada: igual se informa */
}
console.log(`\n✓ Sesiones cerradas: ${out.sessions ?? '?'} (tokens de renovación: ${out.tokens ?? '?'}).`)
console.log('  Quien tenga la app abierta saldrá al volver a primer plano; un acceso ya emitido puede durar hasta 1 hora.\n')
