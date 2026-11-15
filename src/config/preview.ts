/**
 * Ampliación del piso 2 hacia el mar (aprobada): la losa crece `P2_GROW` metros hacia el fondo y el oeste, el frente
 * y la llegada de las escaleras quedan en su sitio, y el piso suma locales e islas.
 */
export const P2_GROW = 5

/** Zona de joyería aprobada: puerta en la muralla oeste, salón exclusivo con 4 locales y cristalería bajo el piso 2. */
export const JOYERIA = true

/** Zona Arcade (propuesta de diseño): solo se ve con «?arcade=1» en la dirección, hasta que el equipo la apruebe. */
export const ARCADE_ZONE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('arcade')
