import type { StadiumEventKind } from '../config/stadium'
import { clearBorderWhite, hasTransparentCorners } from '../lib/whiteCutout'
import { DEFAULT_FIT, MIN_ZOOM, TEXT_IDS, TEXT_MAX, TEXT_MIN, boardHasContent, type BoardTeam, type EventBoard, type ImageFit, type TextId } from './board'

// Dibuja el cartel del estadio en un lienzo 2D. Lo usan el estadio en 3D (como textura) y la vista previa
// de la administración, así lo que se ve al editar es lo que se verá en el estadio.

export const BOARD_W = 1280
export const BOARD_H = 544
const FONT = '"Plus Jakarta Sans", Manrope, sans-serif'

export interface BoardInput {
  kind: StadiumEventKind
  board: EventBoard
  /** Nombre del evento en escena (o del estadio). */
  title: string
  /** Fecha ya formateada, p. ej. «SÁB 14 NOV · 8:00 P. M.». */
  when: string
}

const images = new Map<string, Promise<HTMLImageElement | null>>()

/** Carga una imagen (con CORS para poder usarla como textura). Devuelve null si falla. */
export function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  let p = images.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const el = new Image()
      if (!url.startsWith('data:') && !url.startsWith('blob:')) el.crossOrigin = 'anonymous'
      el.onload = () => resolve(el)
      el.onerror = () => resolve(null)
      el.src = url
    })
    images.set(url, p)
  }
  return p
}

/** Reduce el tamaño del texto hasta que quepa en `maxW`. */
function fit(g: CanvasRenderingContext2D, text: string, weight: string, size: number, maxW: number, min = 18) {
  let s = size
  g.font = `${weight} ${s}px ${FONT}`
  while (g.measureText(text).width > maxW && s > min) {
    s -= 2
    g.font = `${weight} ${s}px ${FONT}`
  }
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

const hue = (name: string) => [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 40)

/** Dónde va el escudo de cada equipo (centro y tamaño, en píxeles del cartel), con su posición y tamaño elegidos. */
export function crestBox(team: BoardTeam, side: 'home' | 'away') {
  const f = team.fit ?? DEFAULT_FIT
  const cx = Math.max(0, Math.min(BOARD_W, BOARD_W * (side === 'home' ? 0.2 : 0.8) + f.x * BOARD_W))
  const cy = Math.max(0, Math.min(BOARD_H, BOARD_H * 0.54 + f.y * BOARD_H))
  return { cx, cy, size: BOARD_H * 0.74 * Math.max(MIN_ZOOM, f.zoom) }
}

const crestCache = new Map<string, Promise<HTMLImageElement | HTMLCanvasElement | null>>()

/**
 * Carga un escudo y le quita el fondo blanco (si lo trae), así se ve sin recuadro aunque se haya subido
 * con fondo. Si la imagen ya es transparente o no se puede procesar, se usa tal cual.
 */
export function loadCrest(url: string | null | undefined): Promise<HTMLImageElement | HTMLCanvasElement | null> {
  if (!url) return Promise.resolve(null)
  let p = crestCache.get(url)
  if (!p) {
    p = loadImage(url).then((img) => {
      if (!img) return null
      try {
        const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d', { willReadFrequently: true })!
        g.drawImage(img, 0, 0, w, h)
        const px = g.getImageData(0, 0, w, h)
        if (hasTransparentCorners(px.data, w, h)) return img
        clearBorderWhite(px.data, w, h)
        g.putImageData(px, 0, 0)
        return c
      } catch {
        return img
      }
    })
    crestCache.set(url, p)
  }
  return p
}

function crest(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, team: BoardTeam, img: HTMLImageElement | HTMLCanvasElement | null) {
  // halo suave detrás del escudo
  const halo = g.createRadialGradient(cx, cy, size * 0.2, cx, cy, size * 0.75)
  halo.addColorStop(0, 'rgba(255,255,255,0.22)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = halo
  g.fillRect(cx - size, cy - size, size * 2, size * 2)
  if (img) {
    const iw = 'naturalWidth' in img ? img.naturalWidth : img.width
    const ih = 'naturalHeight' in img ? img.naturalHeight : img.height
    const k = Math.min(size / iw, size / ih)
    g.drawImage(img, cx - (iw * k) / 2, cy - (ih * k) / 2, iw * k, ih * k)
    return
  }
  // sin escudo: un escudo genérico con las iniciales
  const w = size * 0.8
  const h = size * 0.95
  g.beginPath()
  g.moveTo(cx - w / 2, cy - h / 2)
  g.lineTo(cx + w / 2, cy - h / 2)
  g.lineTo(cx + w / 2, cy + h * 0.1)
  g.quadraticCurveTo(cx + w / 2, cy + h * 0.38, cx, cy + h / 2)
  g.quadraticCurveTo(cx - w / 2, cy + h * 0.38, cx - w / 2, cy + h * 0.1)
  g.closePath()
  g.fillStyle = `hsl(${hue(team.name)} 55% 38%)`
  g.fill()
  g.lineWidth = 8
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.stroke()
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `900 ${size * 0.34}px ${FONT}`
  g.fillText(initials(team.name), cx, cy - h * 0.04)
  g.textBaseline = 'alphabetic'
}

/**
 * Dibuja la imagen en el lienzo `W`×`H` con el encuadre elegido: `zoom` 1 la deja cubriendo todo el cartel; más
 * la acerca; menos la hace más pequeña (el resto se rellena con la misma imagen desenfocada). `x`/`y` la mueven.
 * La imagen no se sale del cartel: si es más grande no deja bordes vacíos y si es más pequeña queda entera.
 */
export function drawCover(g: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, fit: ImageFit = DEFAULT_FIT) {
  const base = Math.max(W / img.naturalWidth, H / img.naturalHeight)
  const k = base * Math.max(MIN_ZOOM, fit.zoom)
  const w = img.naturalWidth * k
  const h = img.naturalHeight * k
  const place = (size: number, box: number, off: number) => {
    const c = (box - size) / 2 + off * box
    return size >= box ? Math.max(box - size, Math.min(0, c)) : Math.max(0, Math.min(box - size, c))
  }
  if (w < W - 0.5 || h < H - 0.5) {
    // fondo: la misma imagen, grande y desenfocada, oscurecida
    g.save()
    if ('filter' in g) g.filter = `blur(${Math.round(W / 50)}px)`
    const bw = img.naturalWidth * base * 1.15
    const bh = img.naturalHeight * base * 1.15
    g.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh)
    g.restore()
    g.fillStyle = 'rgba(0,0,0,0.5)'
    g.fillRect(0, 0, W, H)
  }
  g.drawImage(img, place(w, W, fit.x), place(h, H, fit.y), w, h)
}

// ── textos independientes ───────────────────────────────────────────────────────────────────────────────
interface TextDefault {
  cx: number
  cy: number
  size: number
  weight: string
  color: string
}
const TEXT_DEFAULTS: Record<StadiumEventKind, Partial<Record<TextId, TextDefault>>> = {
  match: {
    title: { cx: BOARD_W / 2, cy: 80, size: 44, weight: '900', color: '#f6c619' },
    vs: { cx: BOARD_W / 2, cy: BOARD_H * 0.5, size: 170, weight: '900', color: '#f6c619' },
    when: { cx: BOARD_W / 2, cy: BOARD_H * 0.79, size: 44, weight: '900', color: '#ffffff' },
    caption: { cx: BOARD_W / 2, cy: BOARD_H - 28, size: 34, weight: '800', color: 'rgba(255,255,255,0.78)' },
  },
  concert: {
    title: { cx: BOARD_W / 2, cy: BOARD_H - 130, size: 62, weight: '900', color: '#ffffff' },
    when: { cx: BOARD_W / 2, cy: BOARD_H - 82, size: 34, weight: '800', color: '#f6c619' },
    caption: { cx: BOARD_W / 2, cy: BOARD_H - 34, size: 30, weight: '800', color: '#f6c619' },
  },
}

/** Lo que dice cada texto cuando no se le puso uno propio. */
function defaultContent(id: TextId, input: BoardInput): string {
  switch (id) {
    case 'title':
      return (input.title || 'ESTADIO DE CARTAGENA').toUpperCase()
    case 'vs':
      return 'VS'
    case 'when':
      return input.when
    case 'caption':
      return input.board.caption
  }
}

/** Texto que se muestra (el propio o el de siempre) y si está oculto. */
export function textContent(id: TextId, input: BoardInput): string {
  const cfg = input.board.texts?.[id]
  if (cfg?.hidden) return ''
  return cfg?.text?.trim() || defaultContent(id, input)
}

/** Centro de un texto en el cartel (píxeles), con su posición elegida. */
export function textBox(kind: StadiumEventKind, id: TextId, board: EventBoard) {
  const d = TEXT_DEFAULTS[kind][id]
  if (!d) return null
  const cfg = board.texts?.[id]
  return {
    cx: Math.max(0, Math.min(BOARD_W, d.cx + (cfg?.x ?? 0) * BOARD_W)),
    cy: Math.max(0, Math.min(BOARD_H, d.cy + (cfg?.y ?? 0) * BOARD_H)),
    size: d.size * Math.max(TEXT_MIN, Math.min(TEXT_MAX, cfg?.zoom ?? 1)),
    d,
  }
}

/** Piezas del cartel que se pueden mover con el dedo: escudos (partido) y textos visibles, con su centro. */
export function boardElements(input: BoardInput): { id: 'home' | 'away' | TextId; cx: number; cy: number }[] {
  const out: { id: 'home' | 'away' | TextId; cx: number; cy: number }[] = []
  if (input.kind === 'match') {
    const h = crestBox(input.board.home, 'home')
    const a = crestBox(input.board.away, 'away')
    out.push({ id: 'home', cx: h.cx, cy: h.cy }, { id: 'away', cx: a.cx, cy: a.cy })
  }
  for (const id of TEXT_IDS) {
    const b = textBox(input.kind, id, input.board)
    if (b && textContent(id, input)) out.push({ id, cx: b.cx, cy: b.cy })
  }
  return out
}

function drawText(g: CanvasRenderingContext2D, id: TextId, input: BoardInput) {
  const b = textBox(input.kind, id, input.board)
  const text = textContent(id, input)
  if (!b || !text) return
  g.textAlign = 'center'
  g.fillStyle = b.d.color
  const own = !!input.board.texts?.[id]?.text?.trim()
  // la fecha del partido va en dos renglones (día y hora) cuando no se escribió otra cosa
  if (id === 'when' && input.kind === 'match' && !own && text.includes(' · ')) {
    const [day, time] = text.split(' · ')
    fit(g, day, b.d.weight, b.size, BOARD_W - 40, 12)
    g.fillText(day, b.cx, b.cy - b.size * 0.55)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    fit(g, time, '800', b.size * 0.9, BOARD_W - 40, 12)
    g.fillText(time, b.cx, b.cy + b.size * 0.5)
    return
  }
  fit(g, text, b.d.weight, b.size, BOARD_W - 40, 12)
  g.fillText(text, b.cx, b.cy)
}

/** Dibuja el cartel completo. Espera a que carguen las imágenes. */
export async function paintBoard(canvas: HTMLCanvasElement, input: BoardInput): Promise<void> {
  const { kind, board } = input
  const [home, away, poster] = await Promise.all([loadCrest(board.home.crest), loadCrest(board.away.crest), loadImage(board.image)])
  const g = canvas.getContext('2d')
  if (!g) return
  canvas.width = BOARD_W
  canvas.height = BOARD_H
  g.textAlign = 'center'

  if (kind === 'concert') {
    if (poster) {
      drawCover(g, poster, BOARD_W, BOARD_H, board.fit)
      const shade = g.createLinearGradient(0, BOARD_H * 0.45, 0, BOARD_H)
      shade.addColorStop(0, 'rgba(0,0,0,0)')
      shade.addColorStop(1, 'rgba(0,0,0,0.82)')
      g.fillStyle = shade
      g.fillRect(0, 0, BOARD_W, BOARD_H)
    } else {
      const bg = g.createLinearGradient(0, 0, BOARD_W, BOARD_H)
      bg.addColorStop(0, '#2a1459')
      bg.addColorStop(1, '#7c4dff')
      g.fillStyle = bg
      g.fillRect(0, 0, BOARD_W, BOARD_H)
      g.fillStyle = 'rgba(255,255,255,0.1)'
      for (let i = 0; i < 9; i++) g.fillRect(70 + i * 105, 50, 48, BOARD_H - 100)
    }
    for (const id of TEXT_IDS) drawText(g, id, input)
    return
  }

  // partido
  const bg = g.createLinearGradient(0, 0, 0, BOARD_H)
  bg.addColorStop(0, '#12302a')
  bg.addColorStop(1, '#07140f')
  g.fillStyle = bg
  g.fillRect(0, 0, BOARD_W, BOARD_H)
  g.fillStyle = '#22a05a'
  g.fillRect(0, 0, BOARD_W, 16)
  g.fillStyle = '#f6c619'
  g.fillRect(0, 16, BOARD_W, 8)

  const hasTeams = boardHasContent(board) && !!(board.home.name || board.home.crest || board.away.name || board.away.crest)
  if (!hasTeams) {
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.font = `900 92px ${FONT}`
    g.fillText('¡HOY HAY FÚTBOL!', BOARD_W / 2, BOARD_H * 0.55)
  } else {
    // los escudos van sin recuadro, grandes; cada uno se mueve y cambia de tamaño desde la administración
    const h = crestBox(board.home, 'home')
    const a = crestBox(board.away, 'away')
    crest(g, h.cx, h.cy, h.size, board.home, home)
    crest(g, a.cx, a.cy, a.size, board.away, away)
  }
  for (const id of TEXT_IDS) if (id !== 'vs' || hasTeams) drawText(g, id, input)
}
