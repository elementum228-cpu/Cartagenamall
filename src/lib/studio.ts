import type { PhotoSlot } from '../domain/types'

// Estudio de fotos: pone un producto ya recortado (con fondo transparente) sobre el fondo de la tienda,
// con su sombra de contacto, para que todo el catálogo tenga el mismo encuadre.

/** Apoyo por defecto: centrado, sobre la parte baja del fondo. */
export const DEFAULT_SLOT: PhotoSlot = { x: 0.5, y: 0.84, w: 0.46, h: 0.6 }

export const clampSlot = (s: PhotoSlot): PhotoSlot => ({
  x: Math.min(0.95, Math.max(0.05, s.x)),
  y: Math.min(0.98, Math.max(0.2, s.y)),
  w: Math.min(0.95, Math.max(0.1, s.w)),
  h: Math.min(0.95, Math.max(0.1, s.h)),
})

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image()
    // Las fotos viven en Supabase Storage (otro dominio): sin esto el lienzo queda "contaminado" y no se puede exportar.
    if (!src.startsWith('data:')) el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('No se pudo cargar la imagen.'))
    el.src = src
  })
}

/** Tamaño y posición del producto dentro del lienzo, según el apoyo del fondo. Se separa para poder probarlo. */
export function placeProduct(slot: PhotoSlot, size: number, pw: number, ph: number) {
  const s = clampSlot(slot)
  const scale = Math.min((s.w * size) / pw, (s.h * size) / ph)
  const w = pw * scale
  const h = ph * scale
  return { x: s.x * size - w / 2, y: s.y * size - h, w, h, baseY: s.y * size, cx: s.x * size }
}

/** Dibuja el fondo (cuadrado, recortado al centro) con el producto apoyado en su sitio. */
export function drawComposite(ctx: CanvasRenderingContext2D, size: number, bg: HTMLImageElement, product: CanvasImageSource & { width: number; height: number }, slot: PhotoSlot) {
  const side = Math.min(bg.naturalWidth, bg.naturalHeight)
  ctx.drawImage(bg, (bg.naturalWidth - side) / 2, (bg.naturalHeight - side) / 2, side, side, 0, 0, size, size)
  const p = placeProduct(slot, size, product.width, product.height)
  // sombra de contacto: elipse suave en la base
  ctx.save()
  const rx = p.w * 0.42
  const ry = Math.max(4, p.w * 0.07)
  ctx.translate(p.cx, p.baseY)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, 'rgba(20,40,70,0.34)')
  g.addColorStop(1, 'rgba(20,40,70,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.drawImage(product, p.x, p.y, p.w, p.h)
}

export async function composeOnBackground(bgUrl: string, product: CanvasImageSource & { width: number; height: number }, slot: PhotoSlot, size = 1000): Promise<string> {
  const bg = await loadImage(bgUrl)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  drawComposite(canvas.getContext('2d')!, size, bg, product, slot)
  return canvas.toDataURL('image/jpeg', 0.9)
}
