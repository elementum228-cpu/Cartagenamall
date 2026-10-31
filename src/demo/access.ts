import { supabase } from '../remote/client'

// Entrada a la versión de prueba con código de invitación. El código se valida en la base de datos
// (demo_enter), que también anota la entrada y controla cuántos dispositivos lo usan. Se vuelve a
// validar cada vez que se abre: si el administrador lo anula o vence, deja de entrar.

const CODE_KEY = 'cm:demo-code'
const DEVICE_KEY = 'cm:demo-device'

export type DemoAccess = { ok: true; name: string; expiresAt: string } | { ok: false; reason: 'invalid' | 'expired' | 'full' | 'offline' | 'none' }

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* sin almacenamiento: habrá que escribir el código cada vez */
  }
}

/** Identificador al azar de este navegador (para contar dispositivos por invitación). */
function deviceId() {
  let id = read(DEVICE_KEY)
  if (!id || id.length < 8) {
    const bytes = new Uint8Array(12)
    crypto.getRandomValues(bytes)
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    write(DEVICE_KEY, id)
  }
  return id
}

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '')

/** Código guardado o el que llega en el enlace (?c=CODIGO). El del enlace se quita de la barra. */
export function pendingCode(): string | null {
  const url = new URL(window.location.href)
  const fromLink = url.searchParams.get('c')
  if (fromLink) {
    url.searchParams.delete('c')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    return normalizeCode(fromLink)
  }
  return read(CODE_KEY)
}

export async function enterDemo(code: string): Promise<DemoAccess> {
  const c = normalizeCode(code)
  if (!c) return { ok: false, reason: 'none' }
  // sin base de datos configurada (desarrollo local) se entra directo
  if (!supabase) return { ok: true, name: 'Desarrollo', expiresAt: new Date(Date.now() + 864e5).toISOString() }
  const { data, error } = await supabase.rpc('demo_enter', { p_code: c, p_device: deviceId() })
  if (error) return { ok: false, reason: 'offline' }
  const r = data as { ok: boolean; reason?: 'invalid' | 'expired' | 'full'; name?: string; expires_at?: string }
  if (!r?.ok) {
    write(CODE_KEY, null)
    return { ok: false, reason: r?.reason ?? 'invalid' }
  }
  write(CODE_KEY, c)
  return { ok: true, name: r.name ?? '', expiresAt: r.expires_at ?? '' }
}

export function leaveDemo() {
  write(CODE_KEY, null)
}
