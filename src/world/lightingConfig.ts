import { GATE, P1, toWorld } from '../config/mall'
import { COURT } from '../football/config'
import type { FloorId } from '../domain/types'

// Configuración de iluminación día / noche. La noche es una noche caribeña acogedora: base azul
// suave que deja leer la arquitectura y sus colores, más luz cálida (≈3000–3500 K) de tiendas,
// faroles, fuente, terraza y fortaleza. La escena usa `flat` (sin tone mapping), así que estos
// valores ya son los finales en pantalla.

export interface LightingPreset {
  hemiSky: string
  hemiGround: string
  hemi: number
  sun: string
  sunI: number
  /** Posición de la luz direccional (sol o luna). */
  sunPos: [number, number, number]
  ambient: string
  amb: number
}

export const DAY_LIGHTING: LightingPreset = {
  hemiSky: '#fff6e6',
  hemiGround: '#d9c7a4',
  hemi: 1.25,
  sun: '#ffe7c4',
  sunI: 2.1,
  sunPos: [28, 46, 18],
  ambient: '#ffffff',
  amb: 0.25,
}

/** Atardecer: sol bajo y anaranjado, sombras largas, cielo y suelo cálidos. */
export const SUNSET_LIGHTING: LightingPreset = {
  hemiSky: '#ffb88a',
  hemiGround: '#c98b62',
  hemi: 1.0,
  sun: '#ff9248',
  sunI: 1.75,
  sunPos: [44, 17, 8],
  ambient: '#ffb497',
  amb: 0.3,
}

export const NIGHT_LIGHTING: LightingPreset = {
  hemiSky: '#7d93c4', // cielo azul nocturno
  hemiGround: '#b59a74', // suelo beige cálido (rebote de faroles y piedra)
  hemi: 0.62,
  sun: '#b4c6ee', // luna
  sunI: 0.48,
  sunPos: [-24, 40, 26],
  ambient: '#8c9bc4', // azul grisáceo
  amb: 0.42,
}

/** Luz local real (sin sombras). Pocas y solo en calidad media o alta. */
export interface LocalLight {
  id: string
  floorId: FloorId | null
  /** Posición relativa al piso (o del mundo si `floorId` es null). */
  position: [number, number, number]
  color: string
  intensity: number
  distance: number
  /** Calidad mínima en la que existe. */
  minQuality: 'medium' | 'high'
}

export const LOCAL_LIGHTS: LocalLight[] = [
  { id: 'fuente', floorId: 'P1', position: [0, 3.2, 0], color: '#ffc98a', intensity: 14, distance: 15, minQuality: 'medium' },
  { id: 'terraza', floorId: 'P2', position: [2, 4.5, 2], color: '#ffbe7a', intensity: 11, distance: 18, minQuality: 'medium' },
  ...P1.zones.map((z) => {
    const [x, zz] = toWorld([0, 17], z.angle)
    return { id: `pasillo-${z.id}`, floorId: 'P1' as const, position: [x, 3.6, zz] as [number, number, number], color: '#ffcf96', intensity: 10, distance: 13, minQuality: 'high' as const }
  }),
  { id: 'cancha', floorId: 'P1', position: [COURT.center[0], 5.5, COURT.center[1]], color: '#fff2dc', intensity: 18, distance: 15, minQuality: 'medium' },
  { id: 'puerta', floorId: null, position: [GATE.x + 4, 4, GATE.z + 4], color: '#ffc27a', intensity: 16, distance: 14, minQuality: 'high' },
]

