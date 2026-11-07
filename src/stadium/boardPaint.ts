import type { StadiumEventKind } from '../config/stadium'
import { DEFAULT_FIT, MIN_ZOOM, boardHasContent, type BoardTeam, type EventBoard, type ImageFit } from './board'

// Dibuja el cartel del estadio en un lienzo 2D. Lo usan el estadio en 3D (como textura) y la vista previa
// de la administración, así lo que se ve al editar es lo que se verá en el estadio.

export const BOARD_W = 1024
export const BOARD_H = 576
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
  const cx = Math.max(0, Math.min(BOARD_W, (side === 'home' ? 200 : 824) + f.x * BOARD_W))
  const cy = Math.max(0, Math.min(BOARD_H, 300 + f.y * BOARD_H))
  return { cx, cy, size: 380 * Math.max(MIN_ZOOM, f.zoom) }
}

function crest(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, team: BoardTeam, img: HTMLImageElement | null) {
  // halo suave detrás del escudo
  const halo = g.createRadialGradient(cx, cy, size * 0.2, cx, cy, size * 0.75)
  halo.addColorStop(0, 'rgba(255,255,255,0.22)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = halo
  g.fillRect(cx - size, cy - size, size * 2, size * 2)
  if (img) {
    const k = Math.min(size / img.naturalWidth, size / img.naturalHeight)
    const w = img.naturalWidth * k
    const h = img.naturalHeight * k
    g.drawImage(img, cx - w / 2, cy - h / 2, w, h)
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

/** Dibuja el cartel completo. Espera a que carguen las imágenes. */
export async function paintBoard(canvas: HTMLCanvasElement, input: BoardInput): Promise<void> {
  const { kind, board, title, when } = input
  const [home, away, poster] = await Promise.all([loadImage(board.home.crest), loadImage(board.away.crest), loadImage(board.image)])
  const g = canvas.getContext('2d')
  if (!g) return
  canvas.width = BOARD_W
  canvas.height = BOARD_H
  g.textAlign = 'center'
  const heading = (title || 'ESTADIO DE CARTAGENA').toUpperCase()

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
    g.fillStyle = '#ffffff'
    fit(g, heading, '900', 62, BOARD_W - 100, 30)
    g.fillText(heading, BOARD_W / 2, board.caption || when ? BOARD_H - 106 : BOARD_H - 56)
    const line = [when, board.caption.toUpperCase()].filter(Boolean).join('   ·   ')
    if (line) {
      g.fillStyle = '#f6c619'
      fit(g, line, '800', 30, BOARD_W - 100, 18)
      g.fillText(line, BOARD_W / 2, BOARD_H - 48)
    }
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
  g.fillStyle = '#f6c619'
  fit(g, heading, '900', 44, BOARD_W - 120, 22)
  g.fillText(heading, BOARD_W / 2, 80)

  const hasTeams = boardHasContent(board) && !!(board.home.name || board.home.crest || board.away.name || board.away.crest)
  if (!hasTeams) {
    g.fillStyle = '#ffffff'
    g.font = `900 92px ${FONT}`
    g.fillText('¡HOY HAY FÚTBOL!', BOARD_W / 2, 300)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.font = `700 34px ${FONT}`
    g.fillText(when || 'Fútbol · Conciertos · Eventos', BOARD_W / 2, 390)
  } else {
    // solo los escudos, grandes; cada uno se puede mover y cambiar de tamaño desde la administración
    const h = crestBox(board.home, 'home')
    const a = crestBox(board.away, 'away')
    crest(g, h.cx, h.cy, h.size, board.home, home)
    crest(g, a.cx, a.cy, a.size, board.away, away)
    g.fillStyle = '#f6c619'
    g.font = `900 150px ${FONT}`
    g.fillText('VS', BOARD_W / 2, 330)
    if (when) {
      const [day, time] = when.split(' · ')
      g.fillStyle = '#ffffff'
      g.font = `900 40px ${FONT}`
      g.fillText(day, BOARD_W / 2, 406)
      if (time) {
        g.fillStyle = 'rgba(255,255,255,0.85)'
        g.font = `800 36px ${FONT}`
        g.fillText(time, BOARD_W / 2, 452)
      }
    }
  }
  if (board.caption) {
    g.fillStyle = 'rgba(255,255,255,0.78)'
    fit(g, board.caption, '800', 34, BOARD_W - 120, 18)
    g.fillText(board.caption, BOARD_W / 2, BOARD_H - 28)
  }
}
