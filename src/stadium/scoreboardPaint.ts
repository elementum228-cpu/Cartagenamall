import { loadCrest } from './boardPaint'
import type { EventBoard } from './board'
import { goalActive, matchLabel, type MatchState } from './match'

// Dibuja el marcador del estadio (escudos, goles y reloj en vivo). Va como textura de la pantalla interior.

export const SCORE_W = 1024
export const SCORE_H = 384
const FONT = '"Plus Jakarta Sans", Manrope, sans-serif'

/** Cambia cuando hay que redibujar el marcador (marcador, estado, reloj —cada segundo—, parpadeo del gol, escudos). */
export function scoreKey(m: MatchState, board: EventBoard, now: number): string {
  return [m.status, m.home, m.away, matchLabel(m, now), goalActive(m, now) ? Math.floor(now / 400) % 2 : -1, board.home.crest, board.away.crest].join('|')
}

export async function paintScoreboard(canvas: HTMLCanvasElement, input: { match: MatchState; board: EventBoard; now: number }): Promise<void> {
  const { match: m, board, now } = input
  const [home, away] = await Promise.all([loadCrest(board.home.crest), loadCrest(board.away.crest)])
  const g = canvas.getContext('2d')
  if (!g) return
  canvas.width = SCORE_W
  canvas.height = SCORE_H
  const goal = goalActive(m, now)
  const flash = goal && Math.floor(now / 400) % 2 === 0
  const bg = g.createLinearGradient(0, 0, 0, SCORE_H)
  bg.addColorStop(0, goal ? (flash ? '#1f7a43' : '#134d2a') : '#12302a')
  bg.addColorStop(1, '#07140f')
  g.fillStyle = bg
  g.fillRect(0, 0, SCORE_W, SCORE_H)
  g.fillStyle = '#22a05a'
  g.fillRect(0, 0, SCORE_W, 14)
  g.fillStyle = '#f6c619'
  g.fillRect(0, 14, SCORE_W, 7)
  g.textAlign = 'center'

  const crest = (img: HTMLImageElement | HTMLCanvasElement | null, cx: number, name: string) => {
    const size = 210
    const cy = 190
    if (img) {
      const iw = 'naturalWidth' in img ? img.naturalWidth : img.width
      const ih = 'naturalHeight' in img ? img.naturalHeight : img.height
      const k = Math.min(size / iw, size / ih)
      g.drawImage(img, cx - (iw * k) / 2, cy - (ih * k) / 2, iw * k, ih * k)
      return
    }
    // sin escudo: círculo con las iniciales
    g.fillStyle = 'rgba(255,255,255,0.14)'
    g.beginPath()
    g.arc(cx, cy, size * 0.42, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = `900 80px ${FONT}`
    g.textBaseline = 'middle'
    g.fillText(
      name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || '?',
      cx,
      cy,
    )
    g.textBaseline = 'alphabetic'
  }
  crest(home, 150, board.home.name)
  crest(away, SCORE_W - 150, board.away.name)

  // marcador
  g.fillStyle = '#ffffff'
  g.font = `900 210px ${FONT}`
  g.fillText(String(m.home), SCORE_W / 2 - 120, 258)
  g.fillText(String(m.away), SCORE_W / 2 + 120, 258)
  g.fillStyle = '#f6c619'
  g.font = `900 150px ${FONT}`
  g.fillText(':', SCORE_W / 2, 240)

  // estado y reloj en vivo
  g.fillStyle = m.status === 'live' ? '#ff5a4a' : '#f6c619'
  g.font = `900 58px ${FONT}`
  g.fillText(matchLabel(m, now), SCORE_W / 2, 358)

  if (goal) {
    // aviso de gol parpadeante sobre el marcador
    g.fillStyle = flash ? '#f6c619' : '#ffffff'
    g.font = `900 78px ${FONT}`
    g.fillText(goal === 'home' ? '¡GOOOL!' : '¡GOL!', SCORE_W / 2, 98)
  }
}
