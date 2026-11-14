import { CHALLENGES, useCineSocial } from '../state/cineSocial'
import { useUI } from '../state/ui'

/** Aviso (una sola vez) de cada reto de cine que se completó con lo último que hizo la persona. */
export function announceChallenges() {
  const fresh = useCineSocial.getState().settle()
  for (const id of fresh) {
    const c = CHALLENGES.find((x) => x.id === id)
    if (c) useUI.getState().toast(`🏅 Reto de cine completado: ${c.title}`, 'success')
  }
}

/** Dirección de la app (sin parámetros) para invitar. */
export const appUrl = () => `${location.origin}${import.meta.env.BASE_URL}`

/**
 * Comparte un texto con el menú del teléfono (WhatsApp, etc.). Sin ese menú, abre WhatsApp con el mensaje escrito (sin número: la
 * persona elige a quién) y, si tampoco se puede, copia el mensaje.
 */
export async function shareText(title: string, text: string): Promise<'shared' | 'whatsapp' | 'copied' | 'cancelled'> {
  const url = appUrl()
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
  if (nav.share) {
    try {
      await nav.share({ title, text, url })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  const message = `${text}\n${url}`
  try {
    await navigator.clipboard.writeText(message)
    useUI.getState().toast('Mensaje copiado: pégalo en WhatsApp o donde quieras.', 'success')
    return 'copied'
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    return 'whatsapp'
  }
}
