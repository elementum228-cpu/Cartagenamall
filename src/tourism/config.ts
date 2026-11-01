import { FORTRESS } from '../config/mall'
import type { BoatConfig, BoatId, ExperienceCategory } from './types'

// Ubicación del muelle: una puerta en la muralla del frente izquierdo (z = +half), entre el baluarte
// de la esquina y el pasillo de Belleza; el muelle sale hacia el mar (+z).

const S = FORTRESS.half
const WT = FORTRESS.wallThickness

export const HARBOR = {
  /** Centro de la puerta sobre el eje de la muralla. */
  x: -15,
  wallZ: S,
  /** Cara exterior de la muralla, donde arranca el muelle. */
  outerZ: S + WT / 2,
  /** Largo y ancho del muelle de madera (paseo amplio, al estilo del Muelle de los Pegasos). */
  length: 12,
  width: 4,
  /** Plataforma del final, donde atracan las lanchas: ancho (x) y fondo (z). */
  platformWidth: 10,
  platformDepth: 3,
  /** Altura de la cubierta del muelle. */
  deckY: 0.12,
} as const

/** Nivel del mar alrededor de la fortaleza (donde flotan las lanchas). */
export const SEA_Y = -0.5

/** Fin del muelle (z), donde empieza la plataforma. */
export const HARBOR_END_Z = HARBOR.outerZ + HARBOR.length
/** Borde de mar de la plataforma. */
export const HARBOR_FRONT_Z = HARBOR_END_Z + HARBOR.platformDepth
/** Atracadero del bote de paseo, frente a la plataforma (x, z); atraca mirando a +x. */
export const TOUR_BERTH: [number, number] = [HARBOR.x, HARBOR_FRONT_Z + 1.25]

/** Punto al que mira la cámara al tocar una lancha. */
export const HARBOR_FOCUS: [number, number] = [HARBOR.x + 1, HARBOR.outerZ + 7]

export const CATEGORY_LABEL: Record<ExperienceCategory, string> = {
  islas: 'Islas y pasadías',
  transporte: 'Transporte marítimo',
  bahia: 'Tours por la bahía',
  atardecer: 'Atardeceres',
  romantico: 'Planes románticos',
  yates: 'Yates y lanchas privadas',
}

export const BOATS: Record<BoatId, BoatConfig> = {
  mar: {
    id: 'mar',
    color: '#13b9ad',
    title: 'Escapadas al mar',
    subtitle: 'Barú, Tierra Bomba e Islas del Rosario',
    description: 'Pasadías en isla, playas de arena blanca, lanchas privadas y transporte marítimo desde la ciudad.',
    categories: ['islas', 'transporte', 'yates'],
    position: [HARBOR.x - 6.4, HARBOR.outerZ + HARBOR.length + 1.1],
    rotation: 0.06,
  },
  bahia: {
    id: 'bahia',
    color: '#f27b68',
    title: 'La bahía al atardecer',
    subtitle: 'Tours, cenas y planes románticos',
    description: 'Recorridos por la bahía, yates, cenas a bordo, fiestas y el atardecer frente a las murallas.',
    categories: ['bahia', 'atardecer', 'romantico', 'yates'],
    position: [HARBOR.x + 6.4, HARBOR.outerZ + HARBOR.length + 1.1],
    rotation: -0.06,
  },
}
export const BOAT_IDS = Object.keys(BOATS) as BoatId[]
