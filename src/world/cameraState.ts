/** Vector mínimo (x, y, z) compatible con THREE.Vector3 para copy/set: así este módulo no arrastra `three` a quien solo lee la cámara. */
class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  set(x: number, y: number, z: number) {
    this.x = x
    this.y = y
    this.z = z
    return this
  }
  copy(v: { x: number; y: number; z: number }) {
    this.x = v.x
    this.y = v.y
    this.z = v.z
    return this
  }
}

/**
 * Valores "calientes" de la cámara, leídos cada frame por otros objetos del mundo (rótulos que
 * escalan con el zoom, ofertas escondidas que aparecen al acercarse). Vive fuera de React para
 * no provocar renders 60 veces por segundo.
 */
export const cameraState = {
  fitZoom: 10,
  zoom: 10,
  target: new Vec3(),
  /** Escala de rótulos según el ancho de pantalla (más compactos en celulares). */
  uiScale: 1,
  /**
   * Corrimiento aplicado al objetivo para dejar visible una tienda junto a un panel. El punto que la
   * persona realmente mira es `target - viewOffset` (lo usan las ofertas escondidas).
   */
  viewOffset: new Vec3(),
  /** Espacio presionado (modo mano): los clics no seleccionan, solo se arrastra. */
  handMode: false,
  /** Altura del piso que se está mirando: el arrastre se mantiene sobre este plano. */
  groundY: 0,
  /** El mapa está visible (modo Explorar): el teclado solo actúa entonces. */
  active: true,
}
