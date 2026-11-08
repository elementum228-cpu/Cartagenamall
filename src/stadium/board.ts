// Cartel del estadio: en un partido muestra los escudos de los dos equipos; en un concierto, la
// imagen del artista o del evento. Lo edita la administración (y el negocio que opera el estadio).

export interface BoardTeam {
  name: string
  /** Escudo: dirección pública (o imagen local en la demostración). */
  crest: string | null
  /** Posición y tamaño del escudo en el cartel (x, y: fracción del cartel; zoom: tamaño relativo). */
  fit?: ImageFit
}

/** Encuadre de la imagen dentro del cartel: `x` e `y` la mueven (fracción del ancho y del alto), `zoom` la acerca o la aleja (0,3 a 4). */
export interface ImageFit {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_FIT: ImageFit = { x: 0, y: 0, zoom: 1 }
export const MAX_ZOOM = 4
/** Por debajo de 1 la imagen queda más pequeña que el cartel (con fondo desenfocado alrededor). */
export const MIN_ZOOM = 0.3

export function cleanFit(raw: unknown): ImageFit {
  const r = (raw ?? {}) as Partial<ImageFit>
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  return { x: Math.max(-2, Math.min(2, n(r.x, 0))), y: Math.max(-2, Math.min(2, n(r.y, 0))), zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, n(r.zoom, 1))) }
}

/** Los textos del cartel, cada uno independiente: se puede cambiar, mover, agrandar y ocultar. */
export type TextId = 'title' | 'vs' | 'when' | 'caption'
export const TEXT_IDS: TextId[] = ['title', 'vs', 'when', 'caption']
export const TEXT_LABELS: Record<TextId, string> = { title: 'Título', vs: '«VS»', when: 'Fecha y hora', caption: 'Texto de abajo' }

export interface BoardText {
  /** Texto propio; vacío = el de siempre (nombre del evento, «VS», fecha del evento). */
  text?: string
  x?: number
  y?: number
  /** Tamaño relativo (0,4 a 3). */
  zoom?: number
  hidden?: boolean
}
export type BoardTexts = Partial<Record<TextId, BoardText>>

export const TEXT_MIN = 0.4
export const TEXT_MAX = 3

export function cleanTexts(raw: unknown): BoardTexts {
  const out: BoardTexts = {}
  const r = (raw ?? {}) as Record<string, unknown>
  const n = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined)
  for (const id of TEXT_IDS) {
    const t = r[id] as Partial<BoardText> | undefined
    if (!t || typeof t !== 'object') continue
    const c: BoardText = {}
    if (typeof t.text === 'string' && t.text) c.text = t.text.slice(0, 80)
    const x = n(t.x, -1.5, 1.5)
    const y = n(t.y, -1.5, 1.5)
    const zoom = n(t.zoom, TEXT_MIN, TEXT_MAX)
    if (x !== undefined) c.x = x
    if (y !== undefined) c.y = y
    if (zoom !== undefined) c.zoom = zoom
    if (t.hidden === true) c.hidden = true
    if (Object.keys(c).length) out[id] = c
  }
  return out
}

export interface EventBoard {
  home: BoardTeam
  away: BoardTeam
  /** Imagen del concierto o evento. */
  image: string | null
  /** Encuadre de la imagen: desplazamiento (fracción del cartel) y zoom (0,3 a 4). */
  fit?: ImageFit
  /** Textos del cartel, cada uno con su posición, tamaño y visibilidad. */
  texts?: BoardTexts
  /** Línea corta bajo la imagen o los escudos (p. ej. «Liga BetPlay · Fecha 12»). */
  caption: string
}

export const emptyBoard = (): EventBoard => ({
  home: { name: '', crest: null, fit: DEFAULT_FIT },
  away: { name: '', crest: null, fit: DEFAULT_FIT },
  image: null,
  fit: DEFAULT_FIT,
  texts: {},
  caption: '',
})

export const boardHasContent = (b?: EventBoard | null): boolean => !!b && (!!b.image || !!b.home.name.trim() || !!b.home.crest || !!b.away.name.trim() || !!b.away.crest)

/** El cartel de un evento manda si tiene contenido; si no, el cartel general del estadio. */
export const resolveBoard = (event: { board?: EventBoard } | null | undefined, general: EventBoard): EventBoard =>
  boardHasContent(event?.board) ? (event!.board as EventBoard) : general

/** Fecha corta para el cartel: «SÁB 14 NOV · 8:00 P. M.». */
export function boardWhen(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d
    .toLocaleDateString('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .replace(/\./g, '')
  const time = d.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${day} · ${time}`.toUpperCase()
}

/** Normaliza lo que llega de la base de datos (puede faltar algún campo). */
export function cleanBoard(raw: unknown): EventBoard {
  const r = (raw ?? {}) as Partial<EventBoard>
  const team = (t: Partial<BoardTeam> | undefined): BoardTeam => ({
    name: typeof t?.name === 'string' ? t.name.slice(0, 40) : '',
    crest: typeof t?.crest === 'string' && t.crest ? t.crest : null,
    fit: cleanFit(t?.fit),
  })
  return {
    home: team(r.home),
    away: team(r.away),
    image: typeof r.image === 'string' && r.image ? r.image : null,
    fit: cleanFit(r.fit),
    texts: cleanTexts(r.texts),
    caption: typeof r.caption === 'string' ? r.caption.slice(0, 80) : '',
  }
}
