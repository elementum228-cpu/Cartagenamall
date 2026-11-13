import { Suspense, useEffect, useState, type ComponentType } from 'react'
import { lazyPage } from './RouteGuard'

/**
 * Panel de carga diferida: el código del componente se descarga la primera vez que `useOpen()` es verdadero (y se queda
 * montado después, para que sus animaciones de cierre funcionen). Hasta entonces no cuesta ni un byte. `preload()` lo trae
 * en reposo (ver `prefetchIdle`) para que, al abrirlo, ya esté listo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWhen(load: () => Promise<{ default: ComponentType<any> }>, useOpen: () => boolean) {
  const Lazy = lazyPage(load)
  function Gate() {
    const open = useOpen()
    const [seen, setSeen] = useState(open)
    useEffect(() => {
      if (open) setSeen(true)
    }, [open])
    if (!seen) return null
    return (
      <Suspense fallback={null}>
        <Lazy />
      </Suspense>
    )
  }
  Gate.preload = () => void load().catch(() => {})
  return Gate
}

/** Trae el código de estos paneles cuando el navegador está en reposo (uno por vez), salvo con ahorro de datos o red lenta. */
export function prefetchIdle(loaders: (() => void)[], delayMs = 2500) {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  if (nav.connection?.saveData || /(^|-)2g$|^3g$/.test(nav.connection?.effectiveType ?? '')) return () => {}
  let i = 0
  let timer = 0
  const idle = (cb: () => void) => ((window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200)))(cb, { timeout: 4000 })
  const next = () => {
    if (i >= loaders.length) return
    loaders[i++]()
    timer = window.setTimeout(() => idle(next), 250)
  }
  timer = window.setTimeout(() => idle(next), delayMs)
  return () => clearTimeout(timer)
}
