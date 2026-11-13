import type { Provider } from '../types.ts'
import { cinecolombia } from './cinecolombia/index.ts'
import { procinal } from './procinal/index.ts'
import { royalfilms } from './royalfilms/index.ts'

/**
 * Cadenas que consulta la API, en el orden en que se muestran. Para sumar una (p. ej. otra cadena con presencia en
 * Cartagena confirmada en fuentes oficiales): crear `providers/<cadena>/index.ts` con `createFeedProvider(...)` (o un
 * adaptador propio que cumpla `Provider`) y agregarla aquí.
 */
export const providers: Provider[] = [cinecolombia, procinal, royalfilms]
