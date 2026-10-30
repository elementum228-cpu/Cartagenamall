const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export const formatCOP = (n: number) => cop.format(n).replace(/ /g, ' ')

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatRemaining(ms: number) {
  if (ms <= 0) return '00:00:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (x: number) => String(x).padStart(2, '0')
  return h >= 24 ? `${Math.floor(h / 24)} d ${pad(h % 24)} h` : `${pad(h)}:${pad(m)}:${pad(sec)}`
}

export const normalizeText = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
