/**
 * Limitador de cuadros por segundo para el bucle del mundo 3D. El navegador entrega un cuadro por refresco de pantalla
 * (60, 90 o 120 por segundo); dibujar todos en pantallas de 90/120 Hz gasta batería y GPU sin que se note. `shouldRender`
 * dice si ya pasó el intervalo mínimo desde el último cuadro dibujado (con un margen para que, a 60 Hz exactos, nunca se
 * salte uno por el temblor del reloj), y `step` entrega el tiempo de animación en segundos, con tope: al volver de otra
 * pestaña o tras un tirón, la escena no salta de golpe.
 */
export function createFrameGate(maxFps: number, maxStep = 0.1) {
  const minGap = 1000 / maxFps - 2
  let last = 0
  let time = 0
  return {
    /** ¿Toca dibujar en este cuadro? (`now` en milisegundos, como el de requestAnimationFrame). */
    shouldRender(now: number): boolean {
      return !last || now - last >= minGap
    },
    /** Marca el cuadro como dibujado y devuelve el tiempo de animación acumulado (segundos). */
    step(now: number): number {
      time += last ? Math.min((now - last) / 1000, maxStep) : 1 / 60
      last = now
      return time
    },
    /** Pestaña oculta o vista en pausa: el próximo cuadro empieza de cero (sin un salto de tiempo). */
    reset(): void {
      last = 0
    },
    /** Parte del reloj de la escena para que no haya un salto en la primera animación. */
    start(elapsed: number): void {
      time = elapsed
    },
  }
}
