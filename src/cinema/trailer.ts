// Tráileres: solo se aceptan enlaces de YouTube o Vimeo, y se reproducen incrustados (sin cookies de seguimiento) únicamente cuando la
// persona toca «Ver tráiler». Nada se carga ni se reproduce solo.

export interface Trailer {
  provider: 'youtube' | 'vimeo'
  id: string
  /** Página del video en su plataforma (por si no se puede incrustar). */
  watch: string
  /** Reproductor incrustado, listo para abrir tras un toque. */
  embed: string
}

const YT_ID = /^[\w-]{11}$/
const VM_ID = /^\d{5,12}$/

/** Enlace de YouTube o Vimeo → datos del tráiler; cualquier otra cosa (o un enlace roto) → null. */
export function parseTrailer(raw: string | null | undefined): Trailer | null {
  if (!raw) return null
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '')
  let yt = ''
  if (host === 'youtu.be') yt = u.pathname.split('/')[1] ?? ''
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = u.pathname.split('/').filter(Boolean)
    if (u.pathname === '/watch') yt = u.searchParams.get('v') ?? ''
    else if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') yt = parts[1] ?? ''
  }
  if (YT_ID.test(yt)) return { provider: 'youtube', id: yt, watch: `https://www.youtube.com/watch?v=${yt}`, embed: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1&modestbranding=1` }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean).find((p) => VM_ID.test(p)) ?? ''
    if (VM_ID.test(id)) return { provider: 'vimeo', id, watch: `https://vimeo.com/${id}`, embed: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1&playsinline=1` }
  }
  return null
}
