import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../state/storage'
import type { Cat } from './data'

export interface Slot {
  name: string
  text: string
  image: string | null
}
export interface EdPromo {
  id: string
  store: string
  cat: Cat
  big: string
  title: string
  text: string
  /** Fin de la oferta (ISO). */
  endsAt: string
  flash: boolean
  left: number
  ended: boolean
  image: string | null
}
export interface Edition {
  headline: string
  event: { kicker: string; title: string; text: string; when: string; where: string; image: string | null }
  lastHour: { title: string; text: string; image: string | null }
  soon: { title: string; text: string }
  sponsor: Slot
  recommended: Slot
  banner: Slot
  promos: EdPromo[]
  secret: { title: string; need: number }
}

const H = 3600_000
const iso = (ms: number) => new Date(Date.now() + ms).toISOString()
const none: Slot = { name: '', text: '', image: null }

/** Edición de ejemplo (la que se ve mientras la administración no publique la suya). */
export function sampleEdition(): Edition {
  const P = (id: string, store: string, cat: Cat, big: string, title: string, text: string, ms: number, left: number, flash = false, ended = false): EdPromo => ({ id, store, cat, big, title, text, endsAt: iso(ms), left, flash, ended, image: null })
  return {
    headline: 'Cartagena tiene nuevos planes para descubrir hoy.',
    event: { kicker: 'Evento del día', title: 'Este sábado: torneo nocturno en la Isla Deportiva.', text: 'Fútbol 5 y pádel bajo luces, música y comida en las canchas. Cupos limitados.', when: 'Sábado · 7:00 p. m.', where: 'Zona de deportes · Piso 1', image: null },
    lastHour: { title: 'Abrió la Galería de Joyería', text: 'Un salón exclusivo con cuatro boutiques, alfombra roja y vigilantes. Entra por la nueva puerta de vidrio.', image: null },
    soon: { title: 'Nueva zona de entretenimiento', text: 'Más espacio sobre el mar para el 2.º piso y una isla de karts y videojuegos.' },
    sponsor: { ...none },
    recommended: { ...none },
    banner: { ...none },
    promos: [
      P('fafi', "Fafi's Food", 'Gastronomía', 'Combo', 'Costillas al barril + patacones', 'Por $29.900. El plato más pedido de la semana, caliente y al momento.', 3 * H + 24 * 60_000, 12, true),
      P('lau', 'Lau Beauty Studio', 'Belleza', '2x1', 'Higiene facial', 'Llega con una amiga y paga una sola limpieza profunda.', 7 * H, 6),
      P('tec', 'Tienda Tecnología', 'Tecnología', '15% OFF', 'Accesorios para tu celular', 'Cargadores, fundas y audífonos con descuento directo en caja.', 22 * H, 40),
      P('moda', 'Moda Caribe', 'Moda', '30% OFF', 'Segunda prenda', 'Lleva dos prendas de la nueva colección y la segunda cuesta 30% menos.', 11 * H, 18),
      P('gym', 'Gym Bahía', 'Deportes', 'Regalo', 'Pase gratis por compra', 'Con tu primera mensualidad te regalamos una semana para un amigo.', 30 * H, 25),
      P('cafe', 'Café del Centro', 'Gastronomía', '2x1', 'Café de origen', 'Dos cafés por el precio de uno, de 3 a 5 de la tarde.', -H, 0, false, true),
    ],
    secret: { title: 'Un descuento de 40% en un local sorpresa', need: 3 },
  }
}

/** Edición publicada por la administración (null = se muestra la de ejemplo). */
export const useEdition = create<{ ed: Edition | null; set: (e: Edition | null) => void }>()(
  persist((set) => ({ ed: null, set: (ed) => set({ ed }) }), { name: 'cm:hoy-edition:v1', storage: safeStorage }),
)

/** La edición que se lee hoy. */
export function useEditionData(): Edition {
  const ed = useEdition((s) => s.ed)
  return useMemo(() => ed ?? sampleEdition(), [ed])
}
