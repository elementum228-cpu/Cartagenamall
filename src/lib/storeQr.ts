import qrcode from 'qrcode-generator'
import mark from '../assets/mallplay-mark.png'
import type { Store } from '../domain/types'

/** Matriz del código QR (true = módulo oscuro). Corrección de errores «M»: aguanta un poco de suciedad al imprimirlo. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement | null>((res) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = () => res(null)
    im.src = src
  })

/** Afiche vertical listo para imprimir o mandar por WhatsApp: nombre del local, el QR y la invitación a escanear. */
export async function storeQrPoster(store: Pick<Store, 'name' | 'logo' | 'brandColor'>, url: string): Promise<Blob> {
  const F = 'Manrope, "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
  try {
    await Promise.all([document.fonts.load('800 60px Manrope'), document.fonts.load('600 30px Manrope')])
  } catch {
    /* sin la letra de la app se usa la del sistema */
  }
  const [logo, brand] = await Promise.all([store.logo ? loadImg(store.logo) : Promise.resolve(null), loadImg(mark)])
  const W = 1080
  const H = 1500
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, W, H)
  // franja de color de la marca arriba
  g.fillStyle = store.brandColor || '#008d87'
  g.fillRect(0, 0, W, 26)
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  let y = 150
  if (logo) {
    const r = 80
    g.save()
    g.beginPath()
    g.arc(W / 2, y, r, 0, Math.PI * 2)
    g.clip()
    const s = Math.max((r * 2) / logo.width, (r * 2) / logo.height)
    g.drawImage(logo, W / 2 - (logo.width * s) / 2, y - (logo.height * s) / 2, logo.width * s, logo.height * s)
    g.restore()
    g.strokeStyle = 'rgba(0,0,0,.1)'
    g.lineWidth = 4
    g.beginPath()
    g.arc(W / 2, y, r, 0, Math.PI * 2)
    g.stroke()
    y += r + 40
  } else y = 120
  // nombre (se achica si es largo)
  let size = 84
  g.font = `800 ${size}px ${F}`
  while (g.measureText(store.name).width > W - 160 && size > 40) {
    size -= 4
    g.font = `800 ${size}px ${F}`
  }
  g.fillStyle = '#10232d'
  y += size
  g.fillText(store.name, W / 2, y)
  g.font = `600 38px ${F}`
  g.fillStyle = '#5b6b75'
  y += 62
  g.fillText('Escanea y entra a mi local en MallPlay', W / 2, y)
  // QR
  const m = qrMatrix(url)
  const quiet = 4
  const cells = m.length + quiet * 2
  const box = 760
  const cell = Math.floor(box / cells)
  const qs = cell * cells
  const qx = Math.round((W - qs) / 2)
  const qy = y + 50
  g.fillStyle = '#ffffff'
  g.fillRect(qx, qy, qs, qs)
  g.fillStyle = '#10232d'
  for (let r = 0; r < m.length; r++) for (let col = 0; col < m.length; col++) if (m[r][col]) g.fillRect(qx + (col + quiet) * cell, qy + (r + quiet) * cell, cell, cell)
  g.strokeStyle = 'rgba(16,35,45,.12)'
  g.lineWidth = 4
  g.strokeRect(qx - 2, qy - 2, qs + 4, qs + 4)
  // pie con la marca de MallPlay
  const fy = H - 150
  g.fillStyle = '#10232d'
  g.font = `800 46px ${F}`
  if (brand) {
    const mh = 78
    const mw = (brand.width / brand.height) * mh
    const label = 'MallPlay'
    const tw = g.measureText(label).width
    const total = mw + 18 + tw
    g.drawImage(brand, (W - total) / 2, fy - mh / 2 - 8, mw, mh)
    g.textAlign = 'left'
    g.fillText(label, (W - total) / 2 + mw + 18, fy + 14)
    g.textAlign = 'center'
  } else g.fillText('MallPlay', W / 2, fy)
  g.fillStyle = '#5b6b75'
  g.font = `600 30px ${F}`
  g.fillText('Cartagena · tu mall, tu mundo', W / 2, fy + 70)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('sin imagen'))), 'image/png'))
}
