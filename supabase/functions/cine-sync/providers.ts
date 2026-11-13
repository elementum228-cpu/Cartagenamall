import type { Provider } from '../_shared/cine/types.ts'

/**
 * Lectores de cada cadena (uno por archivo, cada uno devuelve películas y funciones de Cartagena con el formato de
 * `ProviderResult`). Una cadena sin lector aquí aparece en Administración como «lector aún no disponible» y sigue en
 * manual. Los lectores se escriben contra las respuestas reales de cada sitio:
 *   - Cine Colombia: https://www.cinecolombia.com/cartagena
 *   - Royal Films:   https://cinemasroyal.com/cartelera/cartagena
 *   - Procinal:      https://www.procinal.com.co/ciudad/cartagena
 */
export const providers: Provider[] = []
