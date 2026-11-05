/** Usuario de Instagram escrito como el dueño quiera (@usuario, usuario, o el enlace del perfil). null si no hay uno válido. */
export function instagramHandle(raw: string | undefined | null): string | null {
  let h = (raw ?? '').trim()
  if (!h) return null
  const m = h.match(/instagram\.com\/([^/?#\s]+)/i)
  if (m) h = m[1]
  h = h.replace(/^@+/, '').replace(/\/+$/, '')
  // «por.definir» es el valor que queda al aprobar un negocio nuevo
  if (!/^[A-Za-z0-9._]{2,30}$/.test(h) || h.toLowerCase() === 'por.definir') return null
  return h
}

export const instagramUrl = (raw: string | undefined | null) => {
  const h = instagramHandle(raw)
  return h ? `https://www.instagram.com/${h}/` : null
}
