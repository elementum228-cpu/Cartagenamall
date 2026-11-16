/**
 * Modo de captura limpia: abrir el mapa con `?captura` en la dirección muestra solo el mundo 3D, sin rótulos flotantes,
 * botones ni paneles, para sacar imágenes y videos promocionales.
 *
 * - `?captura` → de noche (por defecto). `?captura=dia` → de día.
 * - `&zoom=0.4` → qué tan lejos arranca la cámara respecto a la vista general (1 = igual; menor = más lejos, con más mar alrededor).
 *
 * La cámara se sigue moviendo con el dedo o el ratón, y deja alejarse más que en el uso normal.
 */
const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)

/** ¿Está activo el modo de captura? */
export const CAPTURE = !!params?.has('captura')
/** Momento del día forzado en el modo de captura. */
export const CAPTURE_NIGHT = CAPTURE && params?.get('captura') !== 'dia'
/** Factor de zoom inicial sobre la vista general (acotado para no perder la isla). */
export const CAPTURE_ZOOM = (() => {
  const z = Number(params?.get('zoom'))
  return Number.isFinite(z) && z > 0 ? Math.min(Math.max(z, 0.2), 3) : 0.5
})()

if (CAPTURE && typeof document !== 'undefined') document.documentElement.classList.add('captura')
