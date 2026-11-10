/**
 * Ampliación del piso 2 hacia el mar (propuesta). Con `?vista=piso2` la losa crece `P2_GROW` metros hacia el fondo
 * y el oeste, manteniendo en su sitio el frente y la llegada de las escaleras, y suma locales e islas.
 */
export const P2_GROW = typeof location !== 'undefined' && /[?&]vista=piso2/.test(location.search) ? 5 : 0
