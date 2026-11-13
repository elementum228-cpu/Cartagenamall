import { useEffect } from 'react'
import { useEntry } from '../state/entry'
import { useUI } from '../state/ui'
import { useHoy } from './store'
import { detectProfile } from '../lib/deviceProfile'
import { tourDone } from '../features/tourState'

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
    // La primera visita es para conocer el mall (recorrido guiado): el periódico espera a la siguiente. En celulares básicos
    // llega mucho más tarde y solo si la persona está tranquila (sin fichas, recorrido ni interior abiertos).
    if (q !== 'aviso' && !tourDone()) return
    const delay = q === 'aviso' ? 800 : detectProfile().tier === 'low' ? 20000 : 6000
    let t = setTimeout(function tryShow() {
      const u = useUI.getState()
      const busy = u.openStoreId !== null || u.selectedSpaceId !== null || u.interiorStoreId !== null || u.productSheetId !== null
      if (busy || document.hidden) t = setTimeout(tryShow, 5000)
      else useHoy.getState().showNotice()
    }, delay)
    return () => clearTimeout(t)
  }, [doorDone, touring])
  return null
}
