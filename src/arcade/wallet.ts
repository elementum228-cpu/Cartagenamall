import { remoteEnabled, supabase } from '../remote/client'
import type { ArcadeRedemption } from './store'

// «Guardar en la wallet»: le pide a la función `wallet-pass` el enlace de Google Wallet o el archivo de Apple Wallet del bono. Cada
// billetera solo aparece si el servidor la tiene configurada (ver docs/wallet.md); sin base de datos conectada no aparece ninguna.

export interface WalletSupport {
  google: boolean
  apple: boolean
}

export type WalletKind = 'google' | 'apple'

let cached: Promise<WalletSupport> | null = null

/** Qué billeteras están listas. Se pregunta una sola vez; si la función no responde, ninguna. */
export function walletSupport(): Promise<WalletSupport> {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const force = (window as unknown as { __cmWallet?: WalletSupport }).__cmWallet
    if (force) return Promise.resolve(force)
  }
  if (!remoteEnabled() || !supabase) return Promise.resolve({ google: false, apple: false })
  cached ??= supabase.functions
    .invoke('wallet-pass', { body: { action: 'status' } })
    .then(({ data, error }) => (error || !data ? { google: false, apple: false } : { google: !!data.google, apple: !!data.apple }))
    .catch(() => ({ google: false, apple: false }))
  return cached
}

/** Cuál ofrecer primero según el aparato: iPhone/iPad → Apple; Android → Google; computador → las dos. */
export function walletKinds(s: WalletSupport, ua = typeof navigator === 'undefined' ? '' : navigator.userAgent, touchMac = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)): WalletKind[] {
  const ios = /iPhone|iPad|iPod/.test(ua) || touchMac
  const android = /Android/.test(ua)
  const all: WalletKind[] = ios ? ['apple'] : android ? ['google'] : ['apple', 'google']
  return all.filter((k) => s[k])
}

/** Pide el enlace de la wallet para este bono. Devuelve la dirección a la que hay que ir (o `null` si no se pudo). */
export async function walletLink(kind: WalletKind, r: ArcadeRedemption): Promise<string | null> {
  if (!supabase) return null
  const pass = { code: r.code, storeName: r.storeName ?? '', title: r.name, detail: r.detail ?? '', until: r.until ?? '', at: r.at }
  const { data, error } = await supabase.functions.invoke('wallet-pass', { body: { action: kind === 'google' ? 'google' : 'apple-link', pass } })
  return error || !data?.url ? null : (data.url as string)
}
