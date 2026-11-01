import * as THREE from 'three'
import { FLOORS } from '../config/mall'
import type { FloorConfig, FloorId } from '../domain/types'

/**
 * Posición de cada piso en el mundo: su desplazamiento dentro de la fortaleza y su altura. El
 * piso 2 es una terraza elevada al fondo, así que la vista general muestra ambos sin solaparse.
 */
export function floorOrigin(floor: FloorConfig, _overview = false): THREE.Vector3 {
  return new THREE.Vector3(floor.offset[0], floor.elevation, floor.offset[1])
}

/** Centro de la vista general de la fortaleza (un poco hacia el fondo, donde está la terraza). */
export function overviewCenter(): THREE.Vector3 {
  return new THREE.Vector3(-5.5, 2.5, -5.5)
}

/** Origen animado actual de cada piso (lo actualiza MallFloor; lo leen ofertas escondidas). */
export const liveOrigins: Record<FloorId, THREE.Vector3> = Object.fromEntries(FLOORS.map((f) => [f.id, floorOrigin(f)]))
