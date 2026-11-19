/**
 * Cierre general de sesiones: el servidor anota en mall_settings «session_epoch» la hora en que se cerraron todas las sesiones
 * (ver supabase/migrations/0032). Una sesión que empezó ANTES de esa hora debe cerrarse en este dispositivo.
 */
export function mustSignOut(epochAt: unknown, lastSignInAt: string | null | undefined): boolean {
  if (typeof epochAt !== 'string') return false
  const epoch = Date.parse(epochAt)
  if (Number.isNaN(epoch)) return false
  const since = lastSignInAt ? Date.parse(lastSignInAt) : NaN
  // sin fecha de inicio de sesión no se puede comparar con seguridad: se cierra solo si el cierre general es reciente (último día)
  if (Number.isNaN(since)) return Date.now() - epoch < 86_400_000
  return since < epoch
}
