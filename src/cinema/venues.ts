import { CHAINS, type ChainId } from '../state/cine'

/**
 * Dónde ver cine en Cartagena: por cadena, el enlace a su cartelera de la ciudad y, donde se pudo verificar en su sitio
 * oficial, cada sala con su dirección y el enlace a su página. Los horarios se consultan en el sitio oficial de la cadena.
 *
 * Verificado el 13-nov-2026 en cinecolombia.com (datos estructurados de su página de Cartagena y enlaces de sus salas).
 * Royal Films y Procinal: solo se enlaza su cartelera de Cartagena; sus salas no se listan hasta poder verificarlas en su
 * sitio (no se publican aquí sedes que solo aparecen en directorios o prensa).
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
}

export const CINEMA_DIRECTORY: ChainDirectory[] = CHAINS.map((c) => ({ id: c.id, name: c.name, color: c.color, url: URLS[c.id], venues: VENUES[c.id] ?? [] }))

/** A dónde lleva el botón de una película en una cadena: su enlace oficial si la administración lo cargó; si no, la cartelera de la cadena. */
export function movieLink(chain: ChainId, links: Partial<Record<ChainId, string>> | undefined): { url: string; direct: boolean } {
  const own = links?.[chain]
  return own ? { url: own, direct: true } : { url: URLS[chain], direct: false }
}
