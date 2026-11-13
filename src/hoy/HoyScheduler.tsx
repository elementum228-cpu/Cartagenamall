import { useEffect } from 'react'
import { useEntry } from '../state/entry'
import { useUI } from '../state/ui'
import { useHoy } from './store'

/**
 * Programa el aviso de «MallPlay Hoy»: llega DESPUÉS de entrar al mall (cuando el portón terminó y no hay recorrido guiado en
 * curso), unos segundos más tarde y como notificación discreta; nunca encima del onboarding. Una vez al día (lo decide el estado).
 * Con `?hoy=leer` abre el lector y con `?hoy=aviso` repite el aviso (para pruebas).
 */
export function HoyScheduler() {
  const doorDone = useEntry((s) => s.doorDone)
  const touring = useUI((s) => s.tourStep !== null)
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('hoy')
    if (q === 'leer') useHoy.setState({ reader: true })
    if (q === 'aviso') {
      try {
        localStorage.removeItem('cm:hoy-seen')
      } catch {
        /* nada */
      }
    }
  }, [])
  useEffect(() => {
    if (!doorDone || touring) return
    const q = new URLSearchParams(location.search).get('hoy')
    const t = setTimeout(() => useHoy.getState().showNotice(), q === 'aviso' ? 800 : 3500)
    return () => clearTimeout(t)
  }, [doorDone, touring])
  return null
}
