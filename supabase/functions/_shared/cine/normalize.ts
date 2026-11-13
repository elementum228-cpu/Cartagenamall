import type { ShowFormat, ShowLang } from './types.ts'

/**
 * Clave para reconocer la misma película en cadenas distintas: sin tildes ni mayúsculas, sin lo que va entre
 * paréntesis («(3D)», «(2025)») ni etiquetas de formato o idioma («3D», «Doblada», «Subtitulada»…).
 */
export function normalizeTitle(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(3d|2d|4dx|imax|vip|dob|doblada|doblado|sub|subtitulada|subtitulado|esp|espanol|castellano|digital|dbox)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Formato de una función a partir de su texto libre. */
export function detectFormat(label: string): ShowFormat {
  const t = label.toLowerCase()
  if (/\bvip\b/.test(t)) return 'VIP'
  if (/\b3\s?d\b/.test(t)) return '3D'
  if (/\b2\s?d\b/.test(t)) return '2D'
  return ''
}

/** Idioma de una función a partir de su texto libre (doblada o subtitulada). */
export function detectLang(label: string): ShowLang {
  const t = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (/\bsub(titulad[ao]s?)?\b/.test(t)) return 'SUB'
  if (/\bdob(lad[ao]s?)?\b|\bespanol\b|\bcastellano\b/.test(t)) return 'DOB'
  return ''
}

const two = (n: number) => String(n).padStart(2, '0')

/** «14:30», «2:30 PM», «2:30 p. m.», «14.30», «14h30» → «HH:MM», o '' si no es una hora. */
export function toHHMM(text: string): string {
  const m = /(\d{1,2})\s*[:.h]\s*(\d{2})\s*([ap])?\.?\s*m?\.?/i.exec(text.trim())
  if (!m) return ''
  let h = Number(m[1])
  const min = Number(m[2])
  const ap = m[3]?.toLowerCase()
  if (min > 59 || h > 23) return ''
  if (ap) {
    if (h < 1 || h > 12) return ''
    if (ap === 'p' && h < 12) h += 12
    if (ap === 'a' && h === 12) h = 0
  }
  return `${two(h)}:${two(min)}`
}

/** «AAAA-MM-DD» o «DD/MM/AAAA» → «AAAA-MM-DD», o '' si no es un día válido. */
export function toISODay(text: string): string {
  const t = text.trim()
  let y: number, mo: number, d: number
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else return ''
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return ''
  return `${y}-${two(mo)}-${two(d)}`
}
