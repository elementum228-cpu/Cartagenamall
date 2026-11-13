import { createFeedProvider } from '../feed.ts'

/**
 * Royal Films. Sin API pública documentada: se activa con un feed autorizado. La prensa menciona también el dominio
 * royal-films.com; si la cadena compra en otro dominio, se agrega con CINEMA_ROYALFILMS_HOSTS (y se ajusta la cartelera
 * oficial con CINEMA_ROYALFILMS_OFFICIAL_URL).
 * Variables: CINEMA_ROYALFILMS_FEED_URL, CINEMA_ROYALFILMS_FEED_TOKEN (opcional), CINEMA_ROYALFILMS_OFFICIAL_URL y
 * CINEMA_ROYALFILMS_HOSTS (opcionales).
 */
export const royalfilms = createFeedProvider({
  id: 'royalfilms',
  name: 'Royal Films',
  officialUrls: { cartagena: 'https://cinemasroyal.com/cartelera/cartagena' },
  hosts: ['cinemasroyal.com'],
  envPrefix: 'CINEMA_ROYALFILMS',
})
