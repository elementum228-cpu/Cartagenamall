// Cancha sintética de fútbol 5: jardín exterior derecho del piso 1, entre los pasillos A (Moda) y
// B (Tecnología). Coordenadas del piso 1; el eje largo de la cancha corre a lo largo de x (en la
// vista isométrica, de arriba a la izquierda hacia abajo a la derecha, como en la referencia).

export const COURT = {
  center: [16.6, -19.8] as [number, number],
  /**
   * Giro de la cancha (eje y). Con π/2 el eje largo corre de norte a sur: así ningún arco queda
   * detrás de la muralla del este (que tapa lo que está pegado a ella en la vista isométrica), y el
   * lado de la puerta, las bancas y el público miran hacia la cámara.
   */
  rotation: Math.PI / 2,
  /** Largo (entre líneas de fondo, eje x) y ancho (eje z) del campo de juego. */
  length: 14,
  width: 9,
  /** Margen entre las líneas y el cerramiento. */
  runoff: 1.1,
  fenceHeight: 2.4,
  goal: { width: 2.6, height: 1.05, depth: 0.7 },
  /** Lado del acceso (puerta en el cerramiento, hacia el pasillo B). */
  gateX: 0,
  y: 0.16,
} as const

export const HALF_L = COURT.length / 2
export const HALF_W = COURT.width / 2
export const FENCE_X = HALF_L + COURT.runoff
export const FENCE_Z = HALF_W + COURT.runoff

/** Coordenadas de la cancha (x a lo largo, z a lo ancho) → piso 1. */
export function courtToWorld(x: number, z: number): [number, number] {
  const c = Math.cos(COURT.rotation)
  const s = Math.sin(COURT.rotation)
  return [COURT.center[0] + x * c + z * s, COURT.center[1] - x * s + z * c]
}

/** ¿Un punto del piso 1 cae dentro del cerramiento de la cancha (con margen)? */
export function onCourt(x: number, z: number, margin = 0): boolean {
  const dx = x - COURT.center[0]
  const dz = z - COURT.center[1]
  const c = Math.cos(COURT.rotation)
  const s = Math.sin(COURT.rotation)
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  return Math.abs(lx) < FENCE_X + margin && Math.abs(lz) < FENCE_Z + margin
}

// ── Datos comerciales (demostración) ───────────────────────────────────────

export const COURT_INFO = {
  name: 'Cancha Sintética',
  category: 'Fútbol 5',
  description: 'Cancha de césped sintético para fútbol 5 dentro de la fortaleza, con iluminación nocturna, cerramiento completo y bancas para acompañantes.',
  features: ['Césped sintético de última generación', 'Fútbol 5 · 14 × 9 m (escala del mall)', 'Iluminación nocturna con 4 torres', 'Cerramiento con malla y acceso lateral', 'Balones y petos incluidos', 'Bancas para acompañantes'],
  /** Precio por hora (demostración, COP). */
  pricePerHour: 120_000,
  nightPricePerHour: 150_000,
  /** Desde esta hora rige la tarifa nocturna. */
  nightFrom: 18,
  openHours: [9, 23] as [number, number],
  events: [
    { title: 'Torneo relámpago de los jueves', when: 'Jueves · 7:00 p. m.', detail: 'Equipos de 5 + 2 suplentes. Inscripción por equipo.' },
    { title: 'Escuelita de fútbol infantil', when: 'Sábados · 9:00 a. m.', detail: 'De 6 a 12 años, con entrenador.' },
    { title: 'Fútbol mixto', when: 'Domingos · 5:00 p. m.', detail: 'Partidos abiertos para equipos mixtos.' },
  ],
}

/**
 * Horarios ocupados de demostración: determinísticos por fecha y hora (no es disponibilidad real).
 * `dayKey` = 'AAAA-MM-DD'.
 */
export function demoTaken(dayKey: string, hour: number): boolean {
  let h = 2166136261
  for (const c of `${dayKey}|${hour}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const r = ((h >>> 0) % 1000) / 1000
  // las horas de la noche están más pedidas
  return r < (hour >= 18 ? 0.45 : 0.2)
}

export const priceAt = (hour: number) => (hour >= COURT_INFO.nightFrom ? COURT_INFO.nightPricePerHour : COURT_INFO.pricePerHour)
