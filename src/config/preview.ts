/**
 * Ampliación del piso 2 hacia el mar (aprobada): la losa crece `P2_GROW` metros hacia el fondo y el oeste, el frente
 * y la llegada de las escaleras quedan en su sitio, y el piso suma locales e islas.
 */
export const P2_GROW = 5

/** Propuesta (?vista=joyeria): puerta en la muralla oeste, zona de joyería y cristalería bajo el piso 2. */
export const JOYERIA = typeof location !== 'undefined' && /[?&]vista=joyeria/.test(location.search)
