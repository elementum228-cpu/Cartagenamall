// Isla de Entretenimiento: geometría compartida por el mundo 3D (world/Entertainment) y los espacios
// reclamables (config/mall). Rectángulo de esquinas redondeadas al oeste de la fortaleza, unido a la
// muralla por un puente corto frente a Planly; 11 locales en hileras contra la muralla y, en el centro,
// una pista de karts que también se reclama.

/** Cara exterior de la muralla oeste: donde arranca el puente (junto a la garita, frente a Planly). */
export const ENT_WALL_X = -(31 + 1.1)
export const ENT_BRIDGE_LEN = 22
export const ENT_BRIDGE_Z = 10
/** Semiejes del castillo-isla, radio de las esquinas y media apertura de la puerta (lado este). */
export const ENT_HX = 15
export const ENT_HZ = 12
/** Centro de la isla (mundo). */
export const ENT_CENTER: [number, number] = [ENT_WALL_X - ENT_BRIDGE_LEN + 0.6 - ENT_HX, ENT_BRIDGE_Z]

/** Local abierto: ancho de fachada y fondo. */
export const ENT_UNIT: [number, number] = [4.4, 3.2]

/** Locales en hileras pegadas a la muralla: norte (4), sur (4) y oeste (3); el lado este es la entrada. */
export const ENT_SLOTS: { at: [number, number]; rot: number }[] = (() => {
  const [uw, ud] = ENT_UNIT
  const out: { at: [number, number]; rot: number }[] = []
  const zb = ENT_HZ - 0.55 - ud / 2
  const xb = ENT_HX - 0.55 - ud / 2
  const row = (n: number, f: (c: number) => { at: [number, number]; rot: number }) => {
    for (let i = 0; i < n; i++) out.push(f((i - (n - 1) / 2) * uw))
  }
  row(4, (c) => ({ at: [ENT_CENTER[0] + c - 1, ENT_CENTER[1] - zb], rot: 0 }))
  row(4, (c) => ({ at: [ENT_CENTER[0] + c - 1, ENT_CENTER[1] + zb], rot: Math.PI }))
  row(3, (c) => ({ at: [ENT_CENTER[0] - xb, ENT_CENTER[1] + c], rot: Math.PI / 2 }))
  return out
})()

/** Rubro sugerido de cada local (mismo orden que ENT_SLOTS). */
export const ENT_SUGGESTED = ['Arcade', 'Videojuegos', 'Realidad virtual', 'Esports', 'Helados', 'Comida rápida', 'Simuladores', 'Tienda gamer', 'Juegos de mesa', 'Café gamer', 'Karts y accesorios']

/** Pista de karts: centro (la isla) y óvalo. */
export const ENT_TRACK = { a: 3.6, r: 4.0, w: 2.9 } as const
export const ENT_COLOR = '#e0558a'

/** Datos comerciales de la pista de karts (demostración, COP). */
export const TRACK_INFO = {
  name: 'Pista de karts',
  category: 'Karts y carreras',
  description: 'Pista de karts al aire libre dentro de la isla de entretenimiento, con luces nocturnas y arco de salida. Cada turno es una carrera privada de una hora para tu grupo (hasta 8 pilotos): casco, karts y cronometraje incluidos.',
  features: ['Pista iluminada para correr de noche', 'Karts para adultos y juveniles', 'Casco y cronometraje incluidos', 'Turno privado de 1 hora para tu grupo', 'Podio y fotos de la carrera', 'Locales de comida y juegos al lado'],
  /** Precio por turno de 1 hora (demostración). */
  pricePerTurn: 160_000,
  nightPricePerTurn: 200_000,
  nightFrom: 18,
  openHours: [10, 22] as [number, number],
  maxPilots: 8,
  events: [
    { title: 'Gran Premio MallPlay', when: 'Sábados · 7:00 p. m.', detail: 'Clasificación y final. Inscripción por piloto.' },
    { title: 'Karts para empresas', when: 'Entre semana · con reserva', detail: 'Eventos de integración con cronometraje y premios.' },
    { title: 'Escuela de pilotos', when: 'Domingos · 10:00 a. m.', detail: 'Para jóvenes de 12 a 17 años, con instructor.' },
  ],
}
export const trackPriceAt = (hour: number) => (hour >= TRACK_INFO.nightFrom ? TRACK_INFO.nightPricePerTurn : TRACK_INFO.pricePerTurn)
