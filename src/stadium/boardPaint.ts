import type { StadiumEventKind } from '../config/stadium'
import { boardHasContent, type BoardTeam, type EventBoard } from './board'

// Dibuja el cartel del estadio en un lienzo 2D. Lo usan el estadio en 3D (como textura) y la vista previa
// de la administración, así lo que se ve al editar es lo que se verá en el estadio.

export const BOARD_W = 1024
export const BOARD_H = 448
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

function cover(g: CanvasRenderingContext2D, img: HTMLImageElement) {
  const k = Math.max(BOARD_W / img.naturalWidth, BOARD_H / img.naturalHeight)
  const w = img.naturalWidth * k
  const h = img.naturalHeight * k
  g.drawImage(img, (BOARD_W - w) / 2, (BOARD_H - h) / 2, w, h)
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
      cover(g, poster)
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
      for (let i = 0; i < 9; i++) g.fillRect(70 + i * 105, 40, 48, 368)
    }
    g.fillStyle = '#ffffff'
    fit(g, heading, '900', 62, BOARD_W - 100, 30)
    g.fillText(heading, BOARD_W / 2, board.caption || when ? 352 : 400)
    const line = [when, board.caption.toUpperCase()].filter(Boolean).join('   ·   ')
    if (line) {
      g.fillStyle = '#f6c619'
      fit(g, line, '800', 30, BOARD_W - 100, 18)
      g.fillText(line, BOARD_W / 2, 408)
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
  fit(g, heading, '800', 36, BOARD_W - 120, 20)
  g.fillText(heading, BOARD_W / 2, 74)

  const hasTeams = boardHasContent(board) && !!(board.home.name || board.home.crest || board.away.name || board.away.crest)
  if (!hasTeams) {
    g.fillStyle = '#ffffff'
    g.font = `900 92px ${FONT}`
    g.fillText('¡HOY HAY FÚTBOL!', BOARD_W / 2, 230)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.font = `700 34px ${FONT}`
    g.fillText(when || 'Fútbol · Conciertos · Eventos', BOARD_W / 2, 310)
  } else {
    // solo los escudos, grandes, uno a cada lado
    crest(g, 200, 240, 320, board.home, home)
    crest(g, 824, 240, 320, board.away, away)
    g.fillStyle = '#f6c619'
    g.font = `900 120px ${FONT}`
    g.fillText('VS', BOARD_W / 2, 252)
    if (when) {
      const [day, time] = when.split(' · ')
      g.fillStyle = '#ffffff'
      g.font = `800 30px ${FONT}`
      g.fillText(day, BOARD_W / 2, 318)
      if (time) {
        g.fillStyle = 'rgba(255,255,255,0.85)'
        g.font = `700 28px ${FONT}`
        g.fillText(time, BOARD_W / 2, 354)
      }
    }
  }
  if (board.caption) {
    g.fillStyle = 'rgba(255,255,255,0.78)'
    fit(g, board.caption, '700', 28, BOARD_W - 120, 16)
    g.fillText(board.caption, BOARD_W / 2, 428)
  }
}
