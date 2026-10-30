import * as THREE from 'three'

/**
 * Valores "calientes" de la cámara, leídos cada frame por otros objetos del mundo (rótulos que
 * escalan con el zoom, ofertas escondidas que aparecen al acercarse). Vive fuera de React para
 * no provocar renders 60 veces por segundo.
 */
export const cameraState = {
  fitZoom: 10,
  zoom: 10,
  target: new THREE.Vector3(),
  /** Escala de rótulos según el ancho de pantalla (más compactos en celulares). */
  uiScale: 1,
  /**
   * Corrimiento aplicado al objetivo para dejar visible una tienda junto a un panel. El punto que la
   * persona realmente mira es `target - viewOffset` (lo usan las ofertas escondidas).
   */
  viewOffset: new THREE.Vector3(),
  /** Espacio presionado (modo mano): los clics no seleccionan, solo se arrastra. */
  handMode: false,
  /** Altura del piso que se está mirando: el arrastre se mantiene sobre este plano. */
  groundY: 0,
  /** El mapa está visible (modo Explorar): el teclado solo actúa entonces. */
  active: true,
}

/** Dirección isométrica cámara→objetivo (de dónde mira). */
export const ISO_DIR = new THREE.Vector3(1, 1.15, 1).normalize()
export const CAMERA_DISTANCE = 90
/** Elevación aproximada usada para compensar paneles sobre la escena. */
export const ELEVATION_SIN = ISO_DIR.y
