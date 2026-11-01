import { FORTRESS } from '../config/mall'

// Aeropuerto Cartagena Mall: plataforma por fuera de la muralla este (al final del pasillo de
// Tecnología, junto a las canchas). Terminal pegada a la muralla, torre de control, plataforma con
// un avión y una pista paralela a la muralla. Desde aquí se vuela a Isla Descuento.

const OUT = FORTRESS.half + FORTRESS.wallThickness / 2

export const AIRPORT = {
  /** Plataforma: de la muralla hacia el mar (x) y a lo largo de ella (z). */
  x0: OUT,
  x1: 53,
  z0: -22,
  z1: 10,
  deckY: 0.12,
} as const

/** Pista: eje en x, ancho y largo (a lo largo de z). */
export const RUNWAY = { x: 50.4, width: 4, z0: AIRPORT.z0 + 1, z1: AIRPORT.z1 - 1 } as const
/** Terminal (centro, ancho en x, fondo en z, alto): su fachada de vidrio mira al mar (+x). */
export const TERMINAL = { x: OUT + 3.6, z: -1.5, w: 7, d: 11, h: 3.4 } as const
export const TOWER = { x: OUT + 3, z: -15.5 } as const
/** Avión en la plataforma, con la nariz hacia +z. */
export const PLANE = { x: 44.2, z: -2.5 } as const

/** A dónde mira la cámara al tocar el aeropuerto. */
export const AIRPORT_FOCUS: [number, number] = [42.5, -5]
