// Reduce una imagen elegida por el comerciante antes de guardarla: localStorage tiene ~5 MB para
// todo el catálogo, así que los logos quedan en 256 px y las fotos de producto en 640 px.

export type ImageKind = 'logo' | 'product' | 'product-hd' | 'avatar' | 'crest' | 'poster'

const LIMITS: Record<ImageKind, { max: number; type: string; quality: number }> = {
  logo: { max: 256, type: 'image/png', quality: 1 },
  product: { max: 640, type: 'image/jpeg', quality: 0.8 },
  avatar: { max: 320, type: 'image/jpeg', quality: 0.85 },
  // Fotos que van a Supabase Storage (no a localStorage): más resolución para verse bien en pantallas grandes.
  'product-hd': { max: 1280, type: 'image/jpeg', quality: 0.84 },
  // Cartel del estadio: escudos con fondo transparente y afiche del concierto.
  crest: { max: 384, type: 'image/png', quality: 1 },
  poster: { max: 1280, type: 'image/jpeg', quality: 0.82 },
}

/** Tamaño máximo del archivo original (antes de reducirlo). */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

export async function readImageFile(file: File, kind: ImageKind): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('La imagen pesa más de 12 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      el.src = url
    })
    const { max, type, quality } = LIMITS[kind]
    if (kind === 'avatar') {
      // foto de perfil: recorte cuadrado centrado
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const size = Math.min(max, side)
      const c = document.createElement('canvas')
      c.width = size
      c.height = size
      const cx = c.getContext('2d')!
      cx.fillStyle = '#ffffff'
      cx.fillRect(0, 0, size, size)
      cx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
      return c.toDataURL(type, quality)
    }
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(img, 0, 0, w, h)
    const out = canvas.toDataURL(type, quality)
    // Un logo fotográfico en PNG puede pesar mucho: en ese caso se guarda como JPEG.
    if (kind === 'logo' && out.length > 160_000) {
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      return canvas.toDataURL('image/jpeg', 0.85)
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Bytes aproximados que ocupa un texto en localStorage (UTF-16). */
export const storedBytes = (s: string | null) => (s ? s.length * 2 : 0)
