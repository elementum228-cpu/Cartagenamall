import { FORTRESS } from '../config/mall'
import type { BoatConfig, BoatId, ExperienceCategory } from './types'

// Muelle turístico al estilo del Muelle de los Pegasos: una puerta en la muralla del frente izquierdo
// (z = +half) sale a una plaza de piedra con los pegasos; de ella nacen dos malecones que abrazan una
// dársena rectangular abierta al mar (+z). Las lanchas atracan en el malecón este y el barco pirata
// en el oeste.

const S = FORTRESS.half
const WT = FORTRESS.wallThickness

export const HARBOR = {
  /** Centro de la puerta sobre el eje de la muralla. */
  x: -15,
  wallZ: S,
  /** Cara exterior de la muralla, donde arranca la plaza. */
  outerZ: S + WT / 2,
  /** Plaza de los pegasos: de la muralla hasta headZ, entre west y east. */
  west: -27,
  east: -3,
  headZ: S + WT / 2 + 5,
  /** Ancho de cada malecón y dónde terminan (boca de la dársena). */
  quayWidth: 3.5,
  endZ: 54,
  /** Altura del piso del muelle. */
  deckY: 0.12,
} as const

/** Agua de la dársena (entre los malecones): x de west+quay a east-quay, z de headZ a endZ. */
export const BASIN = { x0: HARBOR.west + HARBOR.quayWidth, x1: HARBOR.east - HARBOR.quayWidth, z0: HARBOR.headZ, z1: HARBOR.endZ }

/** Nivel del mar alrededor de la fortaleza (donde flotan las lanchas). */
export const SEA_Y = -0.5

/** Barco pirata: atraca contra el malecón oeste, con la proa hacia la boca de la dársena. */
export const PIRATE_BERTH: [number, number] = [BASIN.x0 + 1.95, HARBOR.headZ + 8.6]

/** Barco de los descuentos: atraca por fuera del malecón este, con la proa hacia la muralla. */
export const SHIP_BERTH: [number, number] = [HARBOR.east + 2.35, HARBOR.headZ + 8.8]

/** Punto al que mira la cámara al tocar una lancha o el barco. */
export const HARBOR_FOCUS: [number, number] = [HARBOR.x - 2, HARBOR.headZ + 6]

export const CATEGORY_LABEL: Record<ExperienceCategory, string> = {
  islas: 'Islas y pasadías',
  transporte: 'Transporte marítimo',
  bahia: 'Tours por la bahía',
  atardecer: 'Atardeceres',
  romantico: 'Planes románticos',
  yates: 'Yates y lanchas privadas',
  eventos: 'Eventos y fiestas a bordo',
}

export const BOATS: Record<BoatId, BoatConfig> = {
  mar: {
    id: 'mar',
    color: '#13b9ad',
    title: 'Escapadas al mar',
    subtitle: 'Barú, Tierra Bomba e Islas del Rosario',
    description: 'Pasadías en isla, playas de arena blanca, lanchas privadas y transporte marítimo desde la ciudad.',
    categories: ['islas', 'transporte', 'yates'],
    position: [BASIN.x1 - 1.1, HARBOR.headZ + 4.4],
    rotation: 0,
  },
  bahia: {
    id: 'bahia',
    color: '#f27b68',
    title: 'La bahía al atardecer',
    subtitle: 'Tours, cenas y planes románticos',
    description: 'Recorridos por la bahía, yates, cenas a bordo, fiestas y el atardecer frente a las murallas.',
    categories: ['bahia', 'atardecer', 'romantico', 'yates'],
    position: [BASIN.x1 - 1.1, HARBOR.headZ + 12.6],
    rotation: 0,
  },
  pirata: {
    id: 'pirata',
    color: '#c8963e',
    title: 'Barco pirata',
    subtitle: 'Fiestas, eventos y paseos por la bahía',
    description: 'El barco más llamativo del muelle: fiestas con música, cumpleaños, eventos de empresa y lanzamientos de marca navegando frente a las murallas.',
    categories: ['eventos', 'atardecer', 'bahia'],
    position: PIRATE_BERTH,
    rotation: 0,
  },
}
/** Todo lo que se puede tocar en el muelle. */
export const BOAT_IDS = Object.keys(BOATS) as BoatId[]
/** Las dos lanchas amarradas (el barco pirata se dibuja aparte: navega). */
export const LAUNCH_IDS: BoatId[] = ['mar', 'bahia']
