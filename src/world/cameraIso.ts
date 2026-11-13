import * as THREE from 'three'

/** Dirección isométrica cámara→objetivo (de dónde mira). */
export const ISO_DIR = new THREE.Vector3(1, 1.15, 1).normalize()
export const CAMERA_DISTANCE = 90
/** Elevación aproximada usada para compensar paneles sobre la escena. */
export const ELEVATION_SIN = ISO_DIR.y
