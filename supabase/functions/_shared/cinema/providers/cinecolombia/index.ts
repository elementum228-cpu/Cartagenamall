import { createFeedProvider } from '../feed.ts'

/**
 * Cine Colombia. Sin API pública documentada: se activa con un feed autorizado (acuerdo con la cadena o agregador licenciado).
 * Variables: CINEMA_CINECOLOMBIA_FEED_URL, CINEMA_CINECOLOMBIA_FEED_TOKEN (opcional), CINEMA_CINECOLOMBIA_OFFICIAL_URL y
 * CINEMA_CINECOLOMBIA_HOSTS (opcionales).
 */
export const cinecolombia = createFeedProvider({
  id: 'cinecolombia',
  name: 'Cine Colombia',
  officialUrls: { cartagena: 'https://www.cinecolombia.com/cartagena' },
  hosts: ['cinecolombia.com'],
  envPrefix: 'CINEMA_CINECOLOMBIA',
})
