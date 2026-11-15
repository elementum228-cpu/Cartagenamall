import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../state/storage'

// Premios del Arcade que ofrecen las tiendas: la administración crea cada promoción («20 % de descuento», «una porción de costillas»…) con
// su precio en tiquetes y quién la ofrece. Se guardan en el servidor (mall_settings «arcade_rewards») para que todos vean lo mismo y,
// sin conexión, se recuerdan en este dispositivo.

export interface StoreReward {
  id: string
  storeId: string
  /** Nombre de la tienda al crearla (así el Arcade no necesita cargar el catálogo). */
  storeName: string
  title: string
  detail: string
  /** Tiquetes que cuesta. */
  cost: number
  active: boolean
  /** Última fecha (AAAA-MM-DD) en que se puede canjear; vacío = sin vencimiento. */
  until: string
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export const newStoreReward = (): StoreReward => ({ id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, storeId: '', storeName: '', title: '', detail: '', cost: 100, active: true, until: '' })

/** Limpia lo que llega del servidor o del almacenamiento: solo promociones completas y con valores razonables. */
export function cleanRewards(raw: unknown): StoreReward[] {
  if (!Array.isArray(raw)) return []
  const out: StoreReward[] = []
  for (const r of raw.slice(0, 60)) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const title = str(o.title, 80)
    const cost = Math.round(Number(o.cost))
    if (!title || !Number.isFinite(cost) || cost < 1 || cost > 100000) continue
    const until = typeof o.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.until) ? o.until : ''
    out.push({ id: str(o.id, 40) || `r${out.length}`, storeId: str(o.storeId, 60), storeName: str(o.storeName, 60), title, detail: str(o.detail, 200), cost, active: o.active !== false, until })
  }
  return out
}

/** Promociones que se pueden canjear hoy: activas y sin vencer. */
export function liveRewards(list: StoreReward[], today = new Date()): StoreReward[] {
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return list.filter((r) => r.active && (!r.until || r.until >= day))
}

interface RewardsState {
  rewards: StoreReward[]
  set: (rewards: StoreReward[]) => void
}

export const useArcadeRewards = create<RewardsState>()(
  persist((set) => ({ rewards: [], set: (rewards) => set({ rewards: cleanRewards(rewards) }) }), { name: 'cm:arcade-rewards:v1', storage: safeStorage, partialize: (s) => ({ rewards: s.rewards }) as never }),
)
