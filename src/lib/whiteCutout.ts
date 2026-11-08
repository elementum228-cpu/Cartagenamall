// Quita el fondo blanco (o casi blanco) de un escudo para que se vea sin recuadro: se parte desde el borde de
// la imagen y se borra solo el blanco conectado con él, así el blanco de adentro del escudo se conserva.

/** Brillo mínimo (0 a 255) para considerar «blanco» un píxel, según la tolerancia (0 a 100). */
const whiteFloor = (tol: number) => 255 - Math.round(tol * 1.2)

/**
 * Hace transparente el fondo claro conectado con el borde. Modifica `data` (RGBA). Devuelve cuántos píxeles
 * quitó. Los píxeles del contorno se suavizan según qué tan claros sean, para que no quede un halo blanco.
 */
export function clearBorderWhite(data: Uint8ClampedArray, w: number, h: number, tolerance = 28): number {
  const floor = whiteFloor(tolerance)
  const isBg = (i: number) => {
    const a = data[i + 3]
    if (a < 8) return true
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // claro y poco colorido
    return Math.min(r, g, b) >= floor && Math.max(r, g, b) - Math.min(r, g, b) <= 36
  }
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const p = y * w + x
    if (seen[p] || !isBg(p * 4)) return
    seen[p] = 1
    stack.push(p)
  }
  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }
  let removed = 0
  while (stack.length) {
    const p = stack.pop()!
    const x = p % w
    const y = (p - x) / w
    data[p * 4 + 3] = 0
    removed++
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }
  // borde suave: los píxeles claros que tocan el fondo quitado pierden parte de su opacidad
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (seen[p]) continue
      const touches = (x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (y > 0 && seen[p - w]) || (y < h - 1 && seen[p + w])
      if (!touches) continue
      const i = p * 4
      const light = (Math.min(data[i], data[i + 1], data[i + 2]) - (floor - 70)) / 70
      if (light > 0) data[i + 3] = Math.round(data[i + 3] * (1 - Math.min(1, light) * 0.85))
    }
  }
  return removed
}

/** ¿La imagen ya trae transparencia en las esquinas? Entonces no hace falta quitar nada. */
export function hasTransparentCorners(data: Uint8ClampedArray, w: number, h: number): boolean {
  const at = (x: number, y: number) => data[(y * w + x) * 4 + 3]
  return at(0, 0) < 250 && at(w - 1, 0) < 250 && at(0, h - 1) < 250 && at(w - 1, h - 1) < 250
}

/** Quita el fondo blanco de una imagen (dirección o data URL) y devuelve un PNG transparente en data URL. */
export async function removeWhiteBackground(src: string, tolerance = 28): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    if (!src.startsWith('data:') && !src.startsWith('blob:')) el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    el.src = src
  })
  const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, w, h)
  const px = g.getImageData(0, 0, w, h)
  if (!hasTransparentCorners(px.data, w, h)) clearBorderWhite(px.data, w, h, tolerance)
  g.putImageData(px, 0, 0)
  return c.toDataURL('image/png')
}
