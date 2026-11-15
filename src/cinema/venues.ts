import { CHAINS, type ChainId } from '../state/cine'

/**
 * Dónde ver cine en Cartagena: por cadena, el enlace a su cartelera de la ciudad y, donde se pudo verificar en su sitio
 * oficial, cada sala con su dirección y el enlace a su página. Los horarios se consultan en el sitio oficial de la cadena.
 *
 * Verificado el 13-nov-2026 en cinecolombia.com (datos estructurados de su página de Cartagena y enlaces de sus salas).
 * Procinal: la sala de Cartagena y su dirección vienen de la página oficial de la sala (procinal.com.co/ciudad/cartagena/teatros/plazuela).
 * Royal Films: su sitio no se pudo leer desde aquí; la sala (C.C. San Fernando, sobre la Av. Pedro de Heredia) coincide en todas las carteleras
 * y directorios consultados, pero la numeración exacta varía entre fuentes, por eso solo se muestra la referencia y no un número.
 */
export interface Venue {
  name: string
  address: string
  url: string
}

export interface ChainDirectory {
  id: ChainId
  name: string
  color: string
  /** Logo oficial optimizado (en /public/brands). */
  logo: string
  /** Cartelera oficial de la cadena en Cartagena. */
  url: string
  venues: Venue[]
}

const URLS: Record<ChainId, string> = {
  'cine-colombia': 'https://www.cinecolombia.com/cartagena',
  'royal-films': 'https://cinemasroyal.com/cartelera/cartagena',
  procinal: 'https://www.procinal.com.co/ciudad/cartagena',
}

const VENUES: Partial<Record<ChainId, Venue[]>> = {
  'cine-colombia': [
    { name: 'Caribe Plaza', address: 'Calle 29 # 22-108', url: 'https://www.cinecolombia.com/cartelera/cartagena/caribe-plaza' },
    { name: 'Paseo La Castellana', address: 'Calle 30 #30-31', url: 'https://www.cinecolombia.com/cartelera/cartagena/paseo-la-castellana' },
    { name: 'Plaza Bocagrande', address: 'Carrera 1 # 12-118', url: 'https://www.cinecolombia.com/cartelera/cartagena/plaza-bocagrande' },
  ],
  procinal: [{ name: 'La Plazuela', address: 'Multicentro La Plazuela · Diagonal 31 # 71-136, piso 2, local E4', url: 'https://procinal.com.co/ciudad/cartagena/teatros/plazuela' }],
  'royal-films': [{ name: 'Multicine San Fernando', address: 'C.C. San Fernando · Av. Pedro de Heredia', url: 'https://cinemasroyal.com/cartelera/cartagena' }],
}

export const CINEMA_DIRECTORY: ChainDirectory[] = CHAINS.map((c) => ({ id: c.id, name: c.name, color: c.color, logo: `${import.meta.env.BASE_URL}brands/${c.id}.webp`, url: URLS[c.id], venues: VENUES[c.id] ?? [] }))

/** A dónde lleva el botón de una película en una cadena: su enlace oficial si la administración lo cargó; si no, la cartelera de la cadena. */
export function movieLink(chain: ChainId, links: Partial<Record<ChainId, string>> | undefined): { url: string; direct: boolean } {
  const own = links?.[chain]
  return own ? { url: own, direct: true } : { url: URLS[chain], direct: false }
}
