// Modo «plato» del estudio de fotos: la foto se recorta en un cuadrado centrado en la comida (el plato del menú es
// un círculo que la muestra). Sin IA: se busca dónde está la comida comparando cada punto con el color de los bordes
// de la foto (mesa, mantel). Todo son funciones puras, para poder probarlas.

export interface PlateFit {
  /** Zoom: 1 = el cuadrado más grande posible; más = más cerca. */
  scale: number
  /** Desplazamiento del centro, como fracción del lado del cuadrado base (−0,5 a 0,5). */
  dx: number
  dy: number
}

export const PLATE_FIT0: PlateFit = { scale: 1, dx: 0, dy: 0 }
export const clampPlateFit = (f: PlateFit): PlateFit => ({ scale: Math.min(3, Math.max(1, f.scale)), dx: Math.min(0.5, Math.max(-0.5, f.dx)), dy: Math.min(0.5, Math.max(-0.5, f.dy)) })

/**
 * Dónde está la comida: centro (fracciones del ancho y del alto) y radio (fracción del lado mayor) de la zona que más se diferencia del color
 * de los bordes. Con una foto casi uniforme devuelve el centro con radio 0,5.
 * `px` = píxeles RGBA de la foto reducida (w×h).
 */
export function findFood(px: ArrayLike<number>, w: number, h: number): { cx: number; cy: number; r: number } {
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return [px[i], px[i + 1], px[i + 2]] as const
  }
  // color de fondo: promedio de un marco de 2 píxeles alrededor
  let br = 0
  let bg = 0
  let bb = 0
  let bn = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x > 1 && x < w - 2 && y > 1 && y < h - 2) continue
      const [r, g, b] = at(x, y)
      br += r
      bg += g
      bb += b
      bn++
    }
  if (!bn) return { cx: 0.5, cy: 0.5, r: 0.5 }
  br /= bn
  bg /= bn
  bb /= bn
  const dist: number[] = new Array(w * h)
  let max = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = at(x, y)
      const d = Math.hypot(r - br, g - bg, b - bb)
      dist[y * w + x] = d
      if (d > max) max = d
    }
  if (max < 30) return { cx: 0.5, cy: 0.5, r: 0.5 }
  const thr = Math.max(28, max * 0.35)
  // centro de masa y extensión (percentiles) de los puntos que se diferencian
  const xs: number[] = []
  const ys: number[] = []
  let sx = 0
  let sy = 0
  let sw = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = dist[y * w + x]
      if (d < thr) continue
      xs.push(x)
      ys.push(y)
      sx += x * d
      sy += y * d
      sw += d
    }
  if (xs.length < (w * h) / 40) return { cx: 0.5, cy: 0.5, r: 0.5 }
  xs.sort((a, b) => a - b)
  ys.sort((a, b) => a - b)
  const q = (a: number[], p: number) => a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * p)))]
  const x0 = q(xs, 0.04)
  const x1 = q(xs, 0.96)
  const y0 = q(ys, 0.04)
  const y1 = q(ys, 0.96)
  const cx = (sx / sw + (x0 + x1) / 2) / 2 / w
  const cy = (sy / sw + (y0 + y1) / 2) / 2 / h
  // radio en unidades del lado mayor de la foto (así es lo que espera autoPlateFit)
  const r = Math.max(x1 - x0, y1 - y0) / Math.max(w, h) / 2
  return { cx: Math.min(1, Math.max(0, cx)), cy: Math.min(1, Math.max(0, cy)), r: Math.min(0.5, Math.max(0.12, r)) }
}

/** Ajuste inicial que deja la comida centrada y llenando el círculo (con un pequeño margen). */
export function autoPlateFit(food: { cx: number; cy: number; r: number }, w: number, h: number): PlateFit {
  const side = Math.min(w, h)
  // radio de la comida en píxeles de la foto; el círculo debe abarcar r·1,22
  const rPx = food.r * Math.max(w, h)
  const view = Math.min(side, Math.max(rPx * 2 * 1.22, side * 0.34))
  const scale = side / view
  // desplazamiento del centro del cuadrado base (centrado en la foto) hacia la comida, en lados del cuadrado base
  const dx = ((food.cx - 0.5) * w) / side
  const dy = ((food.cy - 0.5) * h) / side
  return clampPlateFit({ scale, dx, dy })
}

/** Cuadrado de la foto (en píxeles) que se ve con ese ajuste: x, y de la esquina y lado. Nunca se sale de la foto. */
export function plateWindow(w: number, h: number, fit: PlateFit) {
  const f = clampPlateFit(fit)
  const side = Math.min(w, h)
  const view = side / f.scale
  const cx = w / 2 + f.dx * side
  const cy = h / 2 + f.dy * side
  const x = Math.min(w - view, Math.max(0, cx - view / 2))
  const y = Math.min(h - view, Math.max(0, cy - view / 2))
  return { x, y, side: view }
}

/** Recorta el cuadrado elegido y lo devuelve como foto (JPEG) del tamaño pedido. */
export function cropPlate(img: HTMLImageElement | HTMLCanvasElement, fit: PlateFit, size = 900): string {
  const w = 'naturalWidth' in img ? img.naturalWidth : img.width
  const h = 'naturalHeight' in img ? img.naturalHeight : img.height
  const win = plateWindow(w, h, fit)
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  c.getContext('2d')!.drawImage(img, win.x, win.y, win.side, win.side, 0, 0, size, size)
  return c.toDataURL('image/jpeg', 0.88)
}
