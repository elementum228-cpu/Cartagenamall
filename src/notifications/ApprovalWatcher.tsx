import { useEffect } from 'react'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { useCatalog } from '../state/catalog'
import { useUI } from '../state/ui'
import { useNotifications } from './store'
import { playTing } from './ting'

const announced = new Set<string>()

/**
 * Avisa a quien pidió un local cuando el administrador lo aprueba: aparece en la campanita «Tu solicitud fue aprobada · Toca para empezar»,
 * suena el «ting», y al tocarlo se abre la bienvenida del dueño. También revisa la sesión cada pocos segundos para enterarse sin recargar.
 */
export function ApprovalWatcher() {
  const userId = useSession((s) => s.userId)
  const storeIds = useSession((s) => s.storeIds)
  const stores = useCatalog((s) => s.stores)

  useEffect(() => {
    if (!remoteEnabled() || !userId) return
    const t = setInterval(() => {
      if (!document.hidden) void useSession.getState().refresh()
    }, 15000)
    return () => clearInterval(t)
  }, [userId])

  useEffect(() => {
    if (!remoteEnabled() || !userId) return
    for (const store of stores) {
      if (store.setup !== 'pending' || !storeIds.includes(store.id) || announced.has(store.id)) continue
      announced.add(store.id)
      const fresh = useNotifications.getState().push({
        id: `approved:${store.id}`,
        orderId: '',
        storeName: store.name,
        status: 'confirmed',
        title: `Tu solicitud de «${store.name}» fue aprobada`,
        subtitle: 'Toca para empezar',
        at: new Date().toISOString(),
        sticky: true,
        action: 'welcome',
      })
      if (!fresh) continue
      void playTing(true)
      navigator.vibrate?.([60, 50, 60])
      useUI.getState().toast(`¡Tu solicitud de «${store.name}» fue aprobada! Toca la campanita para empezar.`, 'success')
    }
  }, [userId, storeIds, stores])
  return null
}
