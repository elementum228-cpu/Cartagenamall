import type { ParsedMenu } from './menuParser'
import { remoteEnabled, supabase } from '../remote/client'

// Lectura de menús con IA: reduce las imágenes, las manda a la función «leer-menu» (que las lee con Claude) y devuelve lo mismo que el
// lector por reglas, para que la pantalla de revisión sea una sola.

export class MenuAiError extends Error {}

const MAX_SIDE = 1800

/** Reduce una imagen (JPG, PNG, WebP o página de PDF ya dibujada) a un JPEG liviano en base64. */
export async function prepareImage(blob: Blob): Promise<{ media_type: 'image/jpeg'; data: string }> {
  const bmp = await createImageBitmap(blob)
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * k))
  const h = Math.max(1, Math.round(bmp.height * k))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, w, h)
  g.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const url = canvas.toDataURL('image/jpeg', 0.86)
  return { media_type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) }
}

interface AiResponse {
  sections?: { name?: string; items?: { name?: string; price?: number | null; description?: string; dubious?: boolean }[] }[]
}

/** Convierte la respuesta de la función en el menú que muestra la pantalla de revisión. */
export function fromAi(r: AiResponse): ParsedMenu {
  const sections = (r.sections ?? [])
    .map((s) => ({
      name: (s.name ?? '').trim() || 'Menú',
      items: (s.items ?? [])
        .filter((i) => (i.name ?? '').trim())
        .map((i) => {
          const price = typeof i.price === 'number' && i.price > 0 ? Math.round(i.price) : null
          return {
            name: (i.name ?? '').trim(),
            price,
            prices: price !== null ? [price] : [],
            description: (i.description ?? '').trim(),
            flag: price === null ? ('sin-precio' as const) : i.dubious ? ('precio-dudoso' as const) : undefined,
          }
        }),
    }))
    .filter((s) => s.items.length)
  return { sections, items: sections.reduce((n, s) => n + s.items.length, 0) }
}

/** Manda las imágenes a la función y devuelve los platos. Lanza MenuAiError con un mensaje listo para mostrar. */
export async function readMenuWithAi(images: { media_type: string; data: string }[], storeId: string): Promise<ParsedMenu> {
  if (!remoteEnabled() || !supabase) throw new MenuAiError('Leer imágenes con IA necesita la base de datos conectada: no está disponible en la versión de demostración.')
  const { data, error } = await supabase.functions.invoke('leer-menu', { body: { storeId, images } })
  if (error) {
    let msg = ''
    try {
      const res = (error as { context?: Response }).context
      if (res) msg = ((await res.json()) as { error?: string }).error ?? ''
    } catch {
      /* sin cuerpo legible */
    }
    throw new MenuAiError(msg || 'No se pudo leer el menú con IA. Revisa tu conexión e intenta de nuevo.')
  }
  const menu = fromAi(data as AiResponse)
  if (!menu.items) throw new MenuAiError('No encontré platos en la imagen. Prueba con una foto más clara y de frente.')
  return menu
}
