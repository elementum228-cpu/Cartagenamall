/**
 * iPhone con la app instalada: a veces la ventana que reporta el navegador (innerHeight) es más corta que la pantalla
 * y la app queda «subida», con una franja abajo. Si pasa, se fija la altura de la app a la de la pantalla.
 * Se publica en --app-height; sin diferencia, la variable no se define y todo sigue igual.
 */
export function watchAppHeight() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (!standalone) return
  const apply = () => {
    const portrait = window.innerHeight >= window.innerWidth
    const full = portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width)
    // con el teclado abierto innerHeight no cambia en iOS; si cambiara mucho (>40 %), no se toca
    if (full - window.innerHeight > 1 && window.innerHeight > full * 0.6) document.documentElement.style.setProperty('--app-height', `${full}px`)
    else document.documentElement.style.removeProperty('--app-height')
  }
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', () => setTimeout(apply, 250))
}
