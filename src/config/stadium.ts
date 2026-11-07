// Estadio de Cartagena (inspirado en el Jaime Morón): una isla de castillo al norte de la fortaleza, unida
// por un puente corto a la muralla norte. Tiene tres estados que el administrador elige para todos:
// en construcción, casi terminado e inaugurado (ver state/stadium.ts).

export type StadiumPhase = 'construction' | 'almost' | 'open'

export const STADIUM = {
  /** Centro de la isla del estadio (x, z) en el mundo. */
  center: [9, -52] as [number, number],
  /** Escala del conjunto (isla, estadio, grúas): pequeño frente al mall. */
  scale: 0.6,
}

export const PHASES: { id: StadiumPhase; label: string; short: string; progress: number; note: string }[] = [
  { id: 'construction', label: 'En construcción', short: 'En obra', progress: 68, note: 'Grúas, obreros con casco y cartel de Próximamente.' },
  { id: 'almost', label: 'Casi terminado', short: 'Casi listo', progress: 94, note: 'Césped completo, luces encendidas y los últimos detalles de obra.' },
  { id: 'open', label: 'Inaugurado', short: 'Inaugurado', progress: 100, note: 'Estadio completo con hinchada, y el botón «Escuchar el estadio».' },
]
/** Tipo de evento con el estadio inaugurado y encendido: partido de fútbol o concierto (tarima y pantalla). */
export type StadiumEventKind = 'match' | 'concert'
export const EVENT_KINDS: { id: StadiumEventKind; label: string }[] = [
  { id: 'match', label: 'Partido de fútbol' },
  { id: 'concert', label: 'Concierto' },
]

export const phaseInfo = (p: StadiumPhase) => PHASES.find((x) => x.id === p) ?? PHASES[0]
