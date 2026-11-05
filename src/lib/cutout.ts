// Recorte de fondo en el navegador (sin servidor y sin costo por foto).
// Modelo U²-Net pequeño (u2netp, licencia Apache-2.0) ejecutado con onnxruntime-web (MIT). Pesa unos 4,6 MB y se
// descarga una sola vez; luego el navegador lo guarda.

import type * as Ort from 'onnxruntime-web'

const SIZE = 320
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]
const WORK_MAX = 1000

let session: Promise<Ort.InferenceSession> | null = null

const base = () => import.meta.env.BASE_URL

async function getSession() {
  session ??= (async () => {
    const ort = await import('onnxruntime-web/wasm')
    ort.env.wasm.numThreads = 1
    ort.env.wasm.wasmPaths = { wasm: `${base()}ort/ort-wasm-simd-threaded.wasm` }
    return ort.InferenceSession.create(`${base()}models/u2netp.onnx`, { executionProviders: ['wasm'] })
  })()
  // si falla la descarga, la próxima vez se vuelve a intentar
  session.catch(() => (session = null))
  return session
}

/** Pasa el mapa de probabilidad del modelo a una máscara (0–255) algo más dura en los bordes. */
export function maskFromScores(scores: ArrayLike<number>): Uint8ClampedArray {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < scores.length; i++) {
    lo = Math.min(lo, scores[i])
    hi = Math.max(hi, scores[i])
  }
  const span = hi - lo || 1
  const out = new Uint8ClampedArray(scores.length)
  for (let i = 0; i < scores.length; i++) {
    const m = (scores[i] - lo) / span
    out[i] = Math.round(Math.min(1, Math.max(0, (m - 0.25) / 0.5)) * 255)
  }
  return out
}

/** Caja que contiene los píxeles con transparencia menor a `min` (en 0–255). Null si no hay nada. */
export function alphaBounds(alpha: ArrayLike<number>, w: number, h: number, min = 40) {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha[y * w + x] > min) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** Quita el fondo de una imagen. Devuelve la foto con el fondo transparente (mismo encuadre que la original). */
export async function removeBackground(src: HTMLImageElement | ImageBitmap, onStage?: (s: 'model' | 'run') => void): Promise<HTMLCanvasElement> {
  onStage?.('model')
  const [ort, sess] = [await import('onnxruntime-web/wasm'), await getSession()]
  onStage?.('run')
  const sw = 'naturalWidth' in src ? src.naturalWidth : src.width
  const sh = 'naturalHeight' in src ? src.naturalHeight : src.height
  const k = Math.min(1, WORK_MAX / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * k))
  const h = Math.max(1, Math.round(sh * k))

  const photo = document.createElement('canvas')
  photo.width = w
  photo.height = h
  const pctx = photo.getContext('2d', { willReadFrequently: true })!
  pctx.drawImage(src, 0, 0, w, h)

  // entrada del modelo: 320×320, normalizada
  const small = document.createElement('canvas')
  small.width = SIZE
  small.height = SIZE
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(photo, 0, 0, SIZE, SIZE)
  const px = sctx.getImageData(0, 0, SIZE, SIZE).data
  let max = 1
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2])
  const input = new Float32Array(3 * SIZE * SIZE)
  for (let i = 0; i < SIZE * SIZE; i++)
    for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + i] = (px[i * 4 + c] / max - MEAN[c]) / STD[c]

  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) })
  const mask = maskFromScores(out[sess.outputNames[0]].data as Float32Array)

  // máscara 320×320 → tamaño de la foto (con suavizado) y se usa como transparencia
  const mc = document.createElement('canvas')
  mc.width = SIZE
  mc.height = SIZE
  const mctx = mc.getContext('2d')!
  const mi = mctx.createImageData(SIZE, SIZE)
  for (let i = 0; i < SIZE * SIZE; i++) {
    mi.data[i * 4] = mi.data[i * 4 + 1] = mi.data[i * 4 + 2] = 255
    mi.data[i * 4 + 3] = mask[i]
  }
  mctx.putImageData(mi, 0, 0)
  const big = document.createElement('canvas')
  big.width = w
  big.height = h
  const bctx = big.getContext('2d', { willReadFrequently: true })!
  bctx.imageSmoothingQuality = 'high'
  bctx.drawImage(mc, 0, 0, w, h)
  const alpha = bctx.getImageData(0, 0, w, h).data

  const img = pctx.getImageData(0, 0, w, h)
  const a = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i++) {
    a[i] = alpha[i * 4 + 3]
    img.data[i * 4 + 3] = a[i]
  }
  if (!alphaBounds(a, w, h)) throw new Error('No se encontró el producto en la foto. Prueba con una foto más clara.')
  pctx.putImageData(img, 0, 0)
  // Se devuelve con el tamaño completo de la foto de trabajo (sin recortar al contorno): así el retoque puede
  // restaurar partes desde la foto original, que tiene exactamente el mismo encuadre.
  return photo
}

/** Recorta un producto con transparencia a su contorno (con un pequeño margen). */
export function trimToContent(src: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const tctx = tmp.getContext('2d', { willReadFrequently: true })!
  tctx.drawImage(src, 0, 0)
  const data = tctx.getImageData(0, 0, w, h).data
  const a = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3]
  const box = alphaBounds(a, w, h) ?? { x: 0, y: 0, w, h }
  const pad = Math.round(Math.max(box.w, box.h) * 0.02)
  const x = Math.max(0, box.x - pad)
  const y = Math.max(0, box.y - pad)
  const cw = Math.min(w - x, box.w + pad * 2)
  const ch = Math.min(h - y, box.h + pad * 2)
  const res = document.createElement('canvas')
  res.width = cw
  res.height = ch
  res.getContext('2d')!.drawImage(tmp, x, y, cw, ch, 0, 0, cw, ch)
  return res
}
