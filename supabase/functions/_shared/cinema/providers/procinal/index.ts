import { createFeedProvider } from '../feed.ts'

/**
 * Procinal. Sin API pública documentada: se activa con un feed autorizado.
 * Variables: CINEMA_PROCINAL_FEED_URL, CINEMA_PROCINAL_FEED_TOKEN (opcional), CINEMA_PROCINAL_OFFICIAL_URL y
 * CINEMA_PROCINAL_HOSTS (opcionales).
 */
export const procinal = createFeedProvider({
  id: 'procinal',
  name: 'Procinal',
  officialUrls: { cartagena: 'https://www.procinal.com.co/ciudad/cartagena' },
  hosts: ['procinal.com.co'],
  envPrefix: 'CINEMA_PROCINAL',
})
