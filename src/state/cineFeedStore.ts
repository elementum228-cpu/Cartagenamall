import { create } from 'zustand'
import { CHAIN_IDS, type FeedChainDoc, type FeedDoc, type ProviderMovie, type ProviderShow } from '../../supabase/functions/_shared/cine/types'

// Almacén mínimo de la programación leída automáticamente (lo usa la sincronización al arrancar). La mezcla con lo manual y el
// ejemplo viven en cineFeed.ts, que solo se descarga con las pantallas del cine.

/**
 * Programación leída automáticamente de los sitios de las cadenas (la escribe la función `cine-sync` en mall_settings
 * «cine_feed»; todos la leen). Cada cadena en modo «Automático» usa estos datos; en «Manual», lo que carga la administración.
 */
export const useCineFeed = create<{ doc: FeedDoc | null; set: (doc: FeedDoc | null) => void }>()((set) => ({ doc: null, set: (doc) => set({ doc }) }))

const str = (x: unknown, max = 400) => (typeof x === 'string' ? x.slice(0, max) : '')

function cleanChainDoc(v: unknown): FeedChainDoc | null {
  const o = (v ?? null) as Partial<FeedChainDoc> | null
  if (!o || typeof o !== 'object') return null
  const movies: ProviderMovie[] = (Array.isArray(o.movies) ? o.movies : []).slice(0, 80).map((m: Partial<ProviderMovie>) => ({
    externalId: str(m?.externalId, 80),
    title: str(m?.title, 120),
    image: typeof m?.image === 'string' && m.image ? m.image : null,
    genre: str(m?.genre, 40),
    minutes: typeof m?.minutes === 'number' && m.minutes > 0 ? Math.round(m.minutes) : null,
    rating: str(m?.rating, 8),
    synopsis: str(m?.synopsis),
  }))
  const shows: ProviderShow[] = (Array.isArray(o.shows) ? o.shows : []).slice(0, 1500).map((s: Partial<ProviderShow>) => ({ externalMovieId: str(s?.externalMovieId, 80), day: str(s?.day, 12), time: str(s?.time, 12), label: str(s?.label, 60), theater: str(s?.theater, 80) }))
  return { at: typeof o.at === 'string' ? o.at : null, ok: o.ok === true, message: str(o.message, 200), movies, shows }
}

/** Normaliza lo que viene de la base de datos. */
export function cleanFeed(v: unknown): FeedDoc | null {
  const o = (v ?? null) as { chains?: Record<string, unknown> } | null
  if (!o || typeof o !== 'object' || !o.chains) return null
  const chains: FeedDoc['chains'] = {}
  for (const id of CHAIN_IDS) {
    const c = cleanChainDoc(o.chains[id])
    if (c) chains[id] = c
  }
  return { chains }
}

