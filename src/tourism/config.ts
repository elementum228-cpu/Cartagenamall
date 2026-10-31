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
  /** Largo y ancho del muelle de madera. */
  length: 8.5,
  width: 2.4,
  /** Altura de la cubierta del muelle. */
  deckY: 0.12,
} as const

/** Punto al que mira la cámara al tocar una lancha. */
export const HARBOR_FOCUS: [number, number] = [HARBOR.x + 1, HARBOR.outerZ + 3.5]

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
    position: [HARBOR.x - 4.4, HARBOR.outerZ + 7.4],
    rotation: 0.12,
  },
  bahia: {
    id: 'bahia',
    color: '#f27b68',
    title: 'La bahía al atardecer',
    subtitle: 'Tours, cenas y planes románticos',
    description: 'Recorridos por la bahía, yates, cenas a bordo, fiestas y el atardecer frente a las murallas.',
    categories: ['bahia', 'atardecer', 'romantico', 'yates'],
    position: [HARBOR.x + 4.4, HARBOR.outerZ + 7.6],
    rotation: -0.1,
  },
}
export const BOAT_IDS = Object.keys(BOATS) as BoatId[]
