import { useMemo } from 'react'
import type { Store } from '../domain/types'
import { useCatalog } from '../state/catalog'

// Premios del Arcade: cada negocio crea los suyos en «Promociones» (Mi negocio → Premio del Arcade): qué regala y cuántos tiquetes pide.
// Viven dentro de la tienda (store.arcadeRewards), así que se guardan y se sincronizan igual que el resto de sus datos y solo el
// dueño (o la administración) puede cambiarlos. El Arcade los junta de todas las tiendas para el cuarto de recompensas.

export interface StoreReward {
  id: string
  storeId: string
  storeName: string
  title: string
  detail: string
  /** Tiquetes que cuesta. */
  cost: number
  active: boolean
  /** Última fecha (AAAA-MM-DD) en que se puede canjear; vacío = sin vencimiento. */
  until: string
}

export type StoreRewardDoc = NonNullable<Store['arcadeRewards']>[number]

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export const MAX_REWARDS_PER_STORE = 8
export const MAX_REWARD_COST = 100000

export const newStoreReward = (): StoreRewardDoc => ({ id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, title: '', detail: '', cost: 100, active: true, until: '' })

/** Limpia los premios de una tienda: solo los completos y con valores razonables. */
export function cleanRewards(raw: unknown): StoreRewardDoc[] {
  if (!Array.isArray(raw)) return []
  const out: StoreRewardDoc[] = []
  for (const r of raw.slice(0, MAX_REWARDS_PER_STORE)) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const title = str(o.title, 80)
    const cost = Math.round(Number(o.cost))
    if (!title || !Number.isFinite(cost) || cost < 1 || cost > MAX_REWARD_COST) continue
    const until = typeof o.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.until) ? o.until : ''
    out.push({ id: str(o.id, 40) || `r${out.length}`, title, detail: str(o.detail, 200), cost, active: o.active !== false, until })
  }
  return out
}

/** Todos los premios de las tiendas, con el nombre de quien los ofrece. */
export function rewardsFromStores(stores: Pick<Store, 'id' | 'name' | 'arcadeRewards'>[]): StoreReward[] {
  return stores.flatMap((s) => cleanRewards(s.arcadeRewards).map((r) => ({ ...r, id: `${s.id}:${r.id}`, storeId: s.id, storeName: s.name })))
}

/** Promociones que se pueden canjear hoy: activas y sin vencer. */
export function liveRewards(list: StoreReward[], today = new Date()): StoreReward[] {
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return list.filter((r) => r.active && (!r.until || r.until >= day))
}

/** Los premios que hoy se pueden canjear en el Arcade (de todas las tiendas). */
export function useLiveRewards(): StoreReward[] {
  const stores = useCatalog((s) => s.stores)
  return useMemo(() => liveRewards(rewardsFromStores(stores)), [stores])
}

/** Lo mismo, sin React (para canjear). */
export const currentLiveRewards = () => liveRewards(rewardsFromStores(useCatalog.getState().stores))
