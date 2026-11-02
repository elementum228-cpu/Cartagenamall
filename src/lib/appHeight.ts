/**
 * iPhone con la app instalada (probado en iPhone 17 Pro Max): a veces la ventana que reporta el navegador (innerHeight) es más
 * corta que la pantalla y la app queda «subida», con una franja abajo. Se toma la mayor altura que reporte el dispositivo
 * (pantalla, `100lvh`) y, si es más grande que la ventana, se fija la altura de la app a esa. Se publica en --app-height; sin
 * diferencia la variable no se define. Con `?debug=viewport` en la dirección se muestran las medidas para diagnosticar.
 */
function lvhPx() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100lvh;visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const h = probe.getBoundingClientRect().height
  probe.remove()
  return h
}

export function watchAppHeight() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const debug = location.search.includes('debug=viewport')
  if (!standalone && !debug) return
  let label: HTMLDivElement | null = null
  const apply = () => {
    const portrait = window.innerHeight >= window.innerWidth
    const screenH = portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width)
    const lvh = lvhPx()
    const full = Math.max(screenH, lvh)
    // con el teclado abierto innerHeight no cambia en iOS; si la ventana fuera muy chica (<60 %), no se toca
    const apply = standalone && full - window.innerHeight > 1 && window.innerHeight > full * 0.6
    if (apply) document.documentElement.style.setProperty('--app-height', `${full}px`)
    else document.documentElement.style.removeProperty('--app-height')
    if (debug) {
      if (!label) {
        label = document.createElement('div')
        label.style.cssText = 'position:fixed;left:6px;top:70px;z-index:99999;background:rgba(0,0,0,.75);color:#fff;font:11px/1.35 monospace;padding:6px 8px;border-radius:8px;pointer-events:none;white-space:pre'
        document.body.appendChild(label)
      }
      const root = document.querySelector('#root > div')?.getBoundingClientRect().height
      label.textContent = `standalone ${standalone}\ninnerH ${window.innerHeight}  screenH ${screen.height}\nlvh ${Math.round(lvh)}  vv ${Math.round(window.visualViewport?.height ?? 0)}\nroot ${Math.round(root ?? 0)}  app-h ${apply ? full : '-'}`
    }
  }
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', () => setTimeout(apply, 250))
  if (debug) setInterval(apply, 1500)
}
