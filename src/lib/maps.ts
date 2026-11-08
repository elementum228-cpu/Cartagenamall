// Dirección de un local y su enlace de Google Maps. El dueño escribe la dirección y, si quiere, pega el enlace de
// Google Maps de su local; sin enlace, se arma una búsqueda con la dirección. Solo se aceptan enlaces de Google Maps.

export interface StoreAddress {
  /** Dirección escrita (calle, barrio, ciudad). */
  text: string
  /** Enlace de Google Maps pegado por el dueño (opcional). */
  mapsUrl?: string
}

/** Ciudad que se agrega a la búsqueda cuando la dirección no la trae. */
export const DEFAULT_CITY = 'Cartagena, Colombia'

/**
 * Devuelve el enlace normalizado (https) si es de Google Maps, o null si no lo es. Acepta los enlaces de la barra
 * del navegador, los de «Compartir» (maps.app.goo.gl), los de perfil de negocio (g.page) y los antiguos goo.gl/maps.
 */
export function parseMapsUrl(raw: string | undefined | null): string | null {
  const t = (raw ?? '').trim()
  if (!t || /\s/.test(t)) return null
  let u: URL
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const path = u.pathname
  const ok =
    host === 'maps.app.goo.gl' ||
    host === 'g.page' ||
    (host === 'goo.gl' && path.startsWith('/maps')) ||
    (host === 'maps.google.com') ||
    (/(^|\.)google\.[a-z.]+$/.test(host) && path.startsWith('/maps'))
  if (!ok) return null
  u.protocol = 'https:'
  return u.toString()
}

/** Búsqueda en Google Maps con la dirección escrita (agrega la ciudad si no aparece). */
export function searchUrl(address: string, city = DEFAULT_CITY): string {
  const t = address.trim()
  const q = /cartagena/i.test(t) ? t : `${t}, ${city}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** Adonde lleva «Cómo llegar»: el enlace del dueño si es válido; si no, la búsqueda con su dirección; si no hay nada, null. */
export function directionsUrl(addr: StoreAddress | undefined | null): string | null {
  if (!addr) return null
  const link = parseMapsUrl(addr.mapsUrl)
  if (link) return link
  return addr.text?.trim() ? searchUrl(addr.text) : null
}

/** ¿Hay algo que mostrar de la dirección? */
export const hasAddress = (addr: StoreAddress | undefined | null): boolean => !!addr && (!!addr.text?.trim() || !!parseMapsUrl(addr.mapsUrl))

/** Limpia lo que llega de la base de datos o del formulario. */
export function cleanAddress(raw: unknown): StoreAddress | undefined {
  const r = (raw ?? {}) as Partial<StoreAddress>
  const text = typeof r.text === 'string' ? r.text.trim().slice(0, 140) : ''
  const link = parseMapsUrl(typeof r.mapsUrl === 'string' ? r.mapsUrl : '')
  if (!text && !link) return undefined
  return link ? { text, mapsUrl: link } : { text }
}
