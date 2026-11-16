import { remoteEnabled, supabase } from '../remote/client'
import { useArcade, type ArcadeRedemption } from './store'

// Bonos en el servidor: al canjear se registran (supabase/migrations/0030) para que el negocio los valide en caja y no se usen dos veces.
// Sin base de datos conectada (demostración) todo sigue funcionando en el dispositivo, sin validación.

/** El identificador del premio tal como lo publicó la tienda (el canje lo guarda con el prefijo `tienda:`). */
export const rawRewardId = (r: Pick<ArcadeRedemption, 'rewardId' | 'storeId'>) => (r.storeId && r.rewardId.startsWith(`${r.storeId}:`) ? r.rewardId.slice(r.storeId.length + 1) : r.rewardId)

/** Registra el bono en el servidor (una vez). Si no hay red, queda pendiente y se reintenta al abrirlo. */
export async function syncVoucher(r: ArcadeRedemption): Promise<void> {
  if (!remoteEnabled() || !supabase || r.synced || !r.storeId) return
  const { error } = await supabase.rpc('voucher_issue', { p_code: r.code, p_store: r.storeId, p_reward: rawRewardId(r) })
  if (error) console.warn('voucher_issue', error.message)
  else useArcade.getState().markSynced(r.code)
}

/** ¿El negocio ya lo marcó como usado? `null` si no se pudo saber. */
export async function voucherUsed(code: string): Promise<boolean | null> {
  if (!remoteEnabled() || !supabase) return null
  const { data, error } = await supabase.rpc('voucher_status', { p_code: code })
  return error || !data ? null : !!(data as { used: boolean }).used
}

export interface VoucherRow {
  code: string
  title: string
  detail?: string | null
  until?: string | null
  issued_at: string
  used_at: string | null
  expired?: boolean
}

export async function lookupVoucher(storeId: string, code: string): Promise<VoucherRow | null> {
  if (!supabase) throw new Error('sin conexión')
  const { data, error } = await supabase.rpc('voucher_lookup', { p_store: storeId, p_code: code })
  if (error) throw new Error(error.message)
  return (data as VoucherRow | null) ?? null
}

export type UseResult = 'ok' | 'used' | 'expired' | 'not_found'
export async function useVoucher(storeId: string, code: string): Promise<UseResult> {
  if (!supabase) throw new Error('sin conexión')
  const { data, error } = await supabase.rpc('voucher_use', { p_store: storeId, p_code: code })
  if (error) throw new Error(error.message)
  return data as UseResult
}

export async function recentVouchers(storeId: string): Promise<VoucherRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('voucher_recent', { p_store: storeId })
  if (error) throw new Error(error.message)
  return (data as VoucherRow[]) ?? []
}

/** Normaliza lo que se teclea: acepta «cm q9gm8c», «CM-Q9GM8C» o solo «Q9GM8C». */
export function normalizeCode(raw: string): string {
  const t = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return t.startsWith('CM') ? `CM-${t.slice(2)}` : `CM-${t}`
}

/** Registra en el servidor los bonos que quedaron pendientes (canjeados sin red o antes de que existiera la validación). */
export function syncPending(): void {
  for (const r of useArcade.getState().redemptions) if (!r.synced && !r.used) void syncVoucher(r)
}
