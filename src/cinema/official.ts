import type { ProviderId } from './api'

/**
 * Cartelera oficial de cada cadena en Cartagena. La app la usa cuando no hay horarios (o no se pudo consultar el servidor):
 * siempre queda un camino al sitio oficial. Debe coincidir con los proveedores del servidor (lo comprueba una prueba).
 */
export const OFFICIAL_CINEMAS: { id: ProviderId; name: string; url: string }[] = [
  { id: 'cinecolombia', name: 'Cine Colombia', url: 'https://www.cinecolombia.com/cartagena' },
  { id: 'procinal', name: 'Procinal', url: 'https://www.procinal.com.co/ciudad/cartagena' },
  { id: 'royalfilms', name: 'Royal Films', url: 'https://cinemasroyal.com/cartelera/cartagena' },
]
