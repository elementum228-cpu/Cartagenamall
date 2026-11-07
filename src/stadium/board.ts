// Cartel del estadio: en un partido muestra los escudos de los dos equipos; en un concierto, la
// imagen del artista o del evento. Lo edita la administración (y el negocio que opera el estadio).

export interface BoardTeam {
  name: string
  /** Escudo: dirección pública (o imagen local en la demostración). */
  crest: string | null
}

export interface EventBoard {
  home: BoardTeam
  away: BoardTeam
  /** Imagen del concierto o evento. */
  image: string | null
  /** Línea corta bajo la imagen o los escudos (p. ej. «Liga BetPlay · Fecha 12»). */
  caption: string
}

export const emptyBoard = (): EventBoard => ({
  home: { name: '', crest: null },
  away: { name: '', crest: null },
  image: null,
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
  })
  return {
    home: team(r.home),
    away: team(r.away),
    image: typeof r.image === 'string' && r.image ? r.image : null,
    caption: typeof r.caption === 'string' ? r.caption.slice(0, 80) : '',
  }
}
