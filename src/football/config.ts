// Zona de deportes: una cancha de fútbol 5 (A) y una de pádel (B) en el jardín exterior derecho del
// piso 1, entre los pasillos A (Moda) y B (Tecnología). Coordenadas del piso 1; el eje largo de la cancha corre a lo largo de x (en la
// vista isométrica, de arriba a la izquierda hacia abajo a la derecha, como en la referencia).

export const COURT = {
  /** Centro de la zona de deportes (las dos canchas y el pasillo entre ellas). */
  center: [20.15, -19.8] as [number, number],
  /**
   * Giro de la cancha A (eje y). Con π/2 el eje largo corre de norte a sur: ningún arco queda
   * detrás de la muralla del este. La cancha B va espejada (−π/2): las dos puertas, las bancas y el
   * público dan al pasillo central.
   */
  rotation: Math.PI / 2,
  /** Largo (entre líneas de fondo, eje x) y ancho (eje z) de cada campo. */
  length: 12,
  width: 6.2,
  /** Margen entre las líneas y el cerramiento. */
  runoff: 0.85,
  fenceHeight: 2.4,
  goal: { width: 2.2, height: 1, depth: 0.6 },
  /** Lado del acceso (puerta en el cerramiento, hacia el pasillo central). */
  gateX: 0,
  y: 0.16,
} as const;

export const HALF_L = COURT.length / 2;
export const HALF_W = COURT.width / 2;
export const FENCE_X = HALF_L + COURT.runoff;
export const FENCE_Z = HALF_W + COURT.runoff;

/** Zona de deportes: cancha de fútbol 5 (A) y cancha de pádel (B) enfrentadas. */
export const COURTS = [
  {
    id: "A",
    name: "Cancha A",
    sport: "futbol" as "futbol" | "padel",
    sportLabel: "Fútbol 5",
    center: [14.65, -19.8] as [number, number],
    rotation: Math.PI / 2,
  },
  {
    id: "B",
    name: "Cancha B",
    sport: "padel" as "futbol" | "padel",
    sportLabel: "Pádel",
    center: [25.65, -19.8] as [number, number],
    rotation: -Math.PI / 2,
  },
] as const;
export type CourtId = (typeof COURTS)[number]["id"];
/** Medio ancho y medio largo de toda la zona (las dos canchas), en x y z del piso. */
export const SPORTS_HALF: [number, number] = [
  (COURTS[1].center[0] - COURTS[0].center[0]) / 2 + FENCE_Z,
  FENCE_X,
];

/** Coordenadas de una cancha (x a lo largo, z a lo ancho) → piso 1. */
export function courtToWorld(
  x: number,
  z: number,
  court = 0,
): [number, number] {
  const { center, rotation } = COURTS[court];
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return [center[0] + x * c + z * s, center[1] - x * s + z * c];
}

/** ¿Un punto del piso 1 cae dentro del cerramiento de alguna cancha (con margen)? */
export function onCourt(x: number, z: number, margin = 0): boolean {
  return COURTS.some(({ center, rotation }) => {
    const dx = x - center[0];
    const dz = z - center[1];
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    return Math.abs(lx) < FENCE_X + margin && Math.abs(lz) < FENCE_Z + margin;
  });
}

// ── Datos comerciales (demostración) ───────────────────────────────────────

export const COURT_INFO = {
  name: "Zona de deportes",
  category: "Fútbol 5 y pádel",
  description:
    "Una cancha de fútbol 5 (A) y una cancha de pádel con paredes de vidrio (B) dentro de la fortaleza, con iluminación nocturna, cerramiento completo y bancas para acompañantes. Reserva la que esté libre.",
  features: [
    "Césped sintético de última generación",
    "Cancha A: fútbol 5 · Cancha B: pádel",
    "Pádel con paredes de vidrio y red",
    "Iluminación nocturna con 4 torres",
    "Balones, petos, palas y pelotas incluidos",
    "Bancas para acompañantes",
  ],
  /** Precio por hora (demostración, COP). */
  pricePerHour: 120_000,
  nightPricePerHour: 150_000,
  /** Desde esta hora rige la tarifa nocturna. */
  nightFrom: 18,
  openHours: [9, 23] as [number, number],
  events: [
    {
      title: "Torneo relámpago de los jueves",
      when: "Jueves · 7:00 p. m.",
      detail: "Equipos de 5 + 2 suplentes. Inscripción por equipo.",
    },
    {
      title: "Escuelita de fútbol infantil",
      when: "Sábados · 9:00 a. m.",
      detail: "De 6 a 12 años, con entrenador.",
    },
    {
      title: "Fútbol mixto",
      when: "Domingos · 5:00 p. m.",
      detail: "Partidos abiertos para equipos mixtos.",
    },
  ],
};

/**
 * Horarios ocupados de demostración: determinísticos por fecha y hora (no es disponibilidad real).
 * `dayKey` = 'AAAA-MM-DD'.
 */
export function demoTaken(
  dayKey: string,
  hour: number,
  court: CourtId | "KARTS" = "A",
): boolean {
  let h = 2166136261;
  for (const c of `${dayKey}|${hour}|${court === "A" ? "" : court}`)
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = ((h >>> 0) % 1000) / 1000;
  // las horas de la noche están más pedidas
  return r < (hour >= 18 ? 0.45 : 0.2);
}

export const priceAt = (hour: number) =>
  hour >= COURT_INFO.nightFrom
    ? COURT_INFO.nightPricePerHour
    : COURT_INFO.pricePerHour;
