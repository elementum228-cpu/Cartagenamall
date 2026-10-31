import * as THREE from 'three'

export interface Label {
  texture: THREE.CanvasTexture
  aspect: number
}

const cache = new Map<string, Label>()

// ── Contraste: el comerciante elige su color de marca y puede ser casi blanco ──────────────────
function luminance(hex: string) {
  const c = new THREE.Color(hex) // lineal
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
/**
 * El color tal cual si ya se lee sobre `bg`; si no (menos de 2,2:1, p. ej. una marca casi blanca),
 * el mismo tono oscurecido hasta leerse bien (4,5:1). `min` permite exigir menos (bordes).
 */
export function readableOn(color: string, bg: string, min = 2.2) {
  if (contrast(color, bg) >= min) return color
  const c = new THREE.Color(color)
  const black = new THREE.Color('#1f1b16')
  const target = Math.max(min, 4.5)
  for (let i = 0; i < 16 && contrast(`#${c.getHexString()}`, bg) < target; i++) c.lerp(black, 0.2)
  return `#${c.getHexString()}`
}

const SCALE = 2
const FONT = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif'

/**
 * Rótulos como CanvasTexture: no requieren descargar fuentes dentro de WebGL y se cachean por
 * contenido, así que 20 espacios con "DISPONIBLE" comparten una sola textura.
 */
export function getLabel(text: string, o: { bg: string; fg: string; sub?: string; weight?: number; radius?: number; border?: string }): Label {
  const key = JSON.stringify([text, o])
  const hit = cache.get(key)
  if (hit) return hit

  const H = 128
  const pad = 44
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const main = `${o.weight ?? 800} ${o.sub ? 50 : 60}px ${FONT}`
  const subFont = `600 30px ${FONT}`
  ctx.font = main
  let w = ctx.measureText(text).width
  if (o.sub) {
    ctx.font = subFont
    w = Math.max(w, ctx.measureText(o.sub).width)
  }
  const W = Math.ceil(w + pad * 2)
  // Se dibuja al doble de resolución: los letreros quedan nítidos en pantallas 3× (iPhone) y al
  // acercar la cámara. Las coordenadas de dibujo siguen en unidades de 128 px de alto.
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  ctx.scale(SCALE, SCALE)

  const r = o.radius ?? 36
  ctx.fillStyle = o.bg
  ctx.beginPath()
  ctx.roundRect(4, 4, W - 8, H - 8, r)
  ctx.fill()
  if (o.border) {
    ctx.strokeStyle = o.border
    ctx.lineWidth = 6
    ctx.stroke()
  }
  // texto ilegible (p. ej. blanco sobre un color de marca muy claro): se cambia por uno oscuro
  ctx.fillStyle = contrast(o.fg, o.bg) < 2.5 ? readableOn(o.bg, o.bg) : o.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = main
  if (o.sub) {
    ctx.fillText(text, W / 2, 50)
    ctx.font = subFont
    ctx.globalAlpha = 0.85
    ctx.fillText(o.sub, W / 2, 92)
  } else {
    ctx.fillText(text, W / 2, H / 2 + 3)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  const label = { texture, aspect: W / H }
  cache.set(key, label)
  return label
}

export function clearLabelCache() {
  cache.forEach((l) => l.texture.dispose())
  cache.clear()
}

/**
 * Letrero de la entrada monumental: símbolo de puerta colonial, CARTAGENA MALL y lema.
 * Texto oscuro sobre piedra clara, como letras en relieve.
 */
export function getGateSign(title: string, tagline: string): Label {
  const key = `gate|${title}|${tagline}`
  const hit = cache.get(key)
  if (hit) return hit
  const W = 1024
  const H = 400
  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#efe2c6'
  ctx.beginPath()
  ctx.roundRect(8, 8, W - 16, H - 16, 26)
  ctx.fill()
  ctx.strokeStyle = '#c9b089'
  ctx.lineWidth = 8
  ctx.stroke()
  // símbolo: puerta de arco con dos hojas
  const cx = W / 2
  ctx.strokeStyle = '#6b5236'
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - 42, 150)
  ctx.lineTo(cx - 42, 92)
  ctx.arc(cx, 92, 42, Math.PI, 0)
  ctx.lineTo(cx + 42, 150)
  ctx.moveTo(cx - 60, 150)
  ctx.lineTo(cx + 60, 150)
  ctx.moveTo(cx, 62)
  ctx.lineTo(cx, 150)
  ctx.stroke()
  ctx.fillStyle = '#5b4a35'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 104px ${FONT}`
  ctx.fillText(title, cx, 232)
  ctx.font = `600 46px ${FONT}`
  ctx.globalAlpha = 0.85
  ctx.fillText(tagline, cx, 322)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const label = { texture, aspect: W / H }
  cache.set(key, label)
  return label
}

/** Cartel de zona para el arco del pasillo: letra en un círculo de color y nombre grande sobre fondo claro. */
export function getZoneSign(letter: string, name: string, color: string): Label {
  const key = `zone|${letter}|${name}|${color}`
  const hit = cache.get(key)
  if (hit) return hit
  const H = 200
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const nameFont = `800 84px ${FONT}`
  const subFont = `800 40px ${FONT}`
  ctx.font = nameFont
  const W = Math.ceil(200 + ctx.measureText(name).width + 56)
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#fffaf0'
  ctx.beginPath()
  ctx.roundRect(6, 6, W - 12, H - 12, 40)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(100, H / 2, 66, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 88px ${FONT}`
  ctx.fillText(letter, 100, H / 2 + 4)
  ctx.textAlign = 'left'
  ctx.fillStyle = color
  ctx.font = subFont
  ctx.fillText(`PASILLO ${letter}`, 190, 58)
  ctx.fillStyle = '#2f2a24'
  ctx.font = nameFont
  ctx.fillText(name, 186, 126)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  const label = { texture, aspect: W / H }
  cache.set(key, label)
  return label
}

/**
 * Cartel de tienda sobre fondo claro con borde de marca. Con `sub` (rótulo flotante) lleva la inicial
 * o el logo en un círculo y el rubro debajo; sin `sub` (letrero de fachada) es el nombre, con el logo
 * a la izquierda si lo hay. El logo se dibuja cuando termina de cargar (la textura se actualiza).
 */
export function getStoreSign(name: string, color: string, sub?: string, logo?: string | null): Label {
  const key = `store|${name}|${color}|${sub ?? ''}|${logo ? `${logo.length}:${logo.slice(-48)}` : ''}`
  const hit = cache.get(key)
  if (hit) return hit
  const H = sub ? 172 : 128
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const nameFont = `800 ${sub ? 60 : 66}px ${FONT}`
  const subFont = `700 40px ${FONT}`
  ctx.font = nameFont
  let tw = ctx.measureText(name).width
  if (sub) {
    ctx.font = subFont
    tw = Math.max(tw, ctx.measureText(sub).width)
  }
  const left = sub ? 150 : logo ? 140 : 44
  const W = Math.ceil(left + tw + 44)
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  ctx.scale(SCALE, SCALE)

  // Nombre, borde e inicial en el color de marca, oscurecido si es muy claro para el fondo crema.
  const ink = readableOn(color, '#fffaf0')
  const edge = contrast(color, '#fffaf0') < 1.4 ? readableOn(color, '#fffaf0') : color
  const draw = (img: HTMLImageElement | null) => {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#fffaf0'
    ctx.beginPath()
    ctx.roundRect(5, 5, W - 10, H - 10, sub ? 34 : 24)
    ctx.fill()
    ctx.strokeStyle = edge
    ctx.lineWidth = 9
    ctx.stroke()
    ctx.textBaseline = 'middle'
    // Marca: círculo (rótulo) o cuadrado redondeado (fachada) con el logo o la inicial.
    const r = sub ? 54 : 46
    const cx = sub ? 80 : 70
    if (sub || img) {
      ctx.save()
      ctx.beginPath()
      if (sub) ctx.arc(cx, H / 2, r, 0, Math.PI * 2)
      else ctx.roundRect(cx - r, H / 2 - r, r * 2, r * 2, 16)
      ctx.fillStyle = img ? '#ffffff' : ink
      ctx.fill()
      if (img) {
        ctx.clip()
        const k = Math.min((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight)
        const w = img.naturalWidth * k
        const h = img.naturalHeight * k
        ctx.drawImage(img, cx - w / 2, H / 2 - h / 2, w, h)
      } else {
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.font = `800 60px ${FONT}`
        ctx.fillText(name.trim().charAt(0).toUpperCase(), cx, H / 2 + 3)
      }
      ctx.restore()
    }
    ctx.textBaseline = 'middle'
    if (sub) {
      ctx.textAlign = 'left'
      ctx.fillStyle = '#2f2a24'
      ctx.font = nameFont
      ctx.fillText(name, left, 64)
      ctx.fillStyle = ink
      ctx.font = subFont
      ctx.fillText(sub, left + 2, 124)
    } else {
      ctx.fillStyle = ink
      ctx.textAlign = 'center'
      ctx.font = nameFont
      ctx.fillText(name, left + (W - left - 44) / 2, H / 2 + 3)
    }
  }
  draw(null)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  if (logo) {
    const img = new Image()
    // Logos en Supabase Storage (otro dominio): sin crossOrigin el lienzo queda «contaminado» y
    // WebGL no puede usarlo, y el cartel se vería en blanco.
    // Además la URL lleva una marca propia: si el navegador ya guardó el logo en caché pedido sin
    // CORS (una <img> normal), esa copia no trae el permiso y el letrero quedaría sin logo.
    const remote = !logo.startsWith('data:')
    if (remote) img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!usableImage(img)) return // se queda el cartel con el nombre
      draw(img)
      texture.needsUpdate = true
    }
    img.src = remote ? `${logo}${logo.includes('?') ? '&' : '?'}cm=3d` : logo
  }
  const label = { texture, aspect: W / H }
  cache.set(key, label)
  return label
}

/**
 * ¿Se puede dibujar la imagen sin contaminar el lienzo? Se prueba en uno aparte: un lienzo
 * contaminado ya no se recupera y no serviría como textura.
 */
function usableImage(img: HTMLImageElement) {
  try {
    const test = document.createElement('canvas')
    test.width = test.height = 1
    const c = test.getContext('2d')!
    c.drawImage(img, 0, 0, 1, 1)
    c.getImageData(0, 0, 1, 1)
    return true
  } catch {
    return false
  }
}

/** Cartel grande de una oferta que se está presentando: etiqueta RELÁMPAGO, descuento enorme y producto. */
export function getPromoBanner(discount: number, product: string, store: string): Label {
  const key = `banner|${discount}|${product}|${store}`
  const hit = cache.get(key)
  if (hit) return hit
  const H = 220
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const big = `800 120px ${FONT}`
  const name = `800 44px ${FONT}`
  const sub = `700 34px ${FONT}`
  ctx.font = big
  const bw = ctx.measureText(`−${discount}%`).width
  ctx.font = name
  const shown = product.length > 26 ? `${product.slice(0, 25)}…` : product
  ctx.font = sub
  const tail = ctx.measureText(`en ${store} · toca para verla`).width
  ctx.font = name
  const tw = Math.max(ctx.measureText(shown).width, tail, 380)
  const W = Math.ceil(36 + bw + 30 + tw + 40)
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#f5b544'
  ctx.beginPath()
  ctx.roundRect(6, 6, W - 12, H - 12, 44)
  ctx.fill()
  ctx.strokeStyle = '#2a1d05'
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.fillStyle = '#2a1d05'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = big
  ctx.fillText(`−${discount}%`, 36, H / 2 + 6)
  const x = 36 + bw + 30
  // etiqueta oscura con el rayo
  ctx.fillStyle = '#2a1d05'
  ctx.font = `800 30px ${FONT}`
  const tagW = ctx.measureText('OFERTA RELÁMPAGO').width + 70
  ctx.beginPath()
  ctx.roundRect(x - 6, 30, tagW, 50, 25)
  ctx.fill()
  ctx.fillStyle = '#ffd36b'
  // rayo dibujado (los emojis no se ven igual en todos los dispositivos)
  ctx.beginPath()
  ctx.moveTo(x + 22, 36)
  ctx.lineTo(x + 10, 58)
  ctx.lineTo(x + 20, 58)
  ctx.lineTo(x + 14, 75)
  ctx.lineTo(x + 32, 50)
  ctx.lineTo(x + 22, 50)
  ctx.lineTo(x + 28, 36)
  ctx.closePath()
  ctx.fill()
  ctx.fillText('OFERTA RELÁMPAGO', x + 42, 56)
  ctx.fillStyle = '#2a1d05'
  ctx.font = name
  ctx.fillText(shown, x, 118)
  ctx.font = sub
  ctx.globalAlpha = 0.8
  ctx.fillText(`en ${store} · toca para verla`, x, 166)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  const label = { texture, aspect: W / H }
  cache.set(key, label)
  return label
}
