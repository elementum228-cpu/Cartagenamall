// Estadio de Cartagena (inspirado en el Jaime Morón): una isla al norte de la fortaleza, unida por un puente
// corto a la muralla norte. Mientras `phase` sea 'construction', el mundo vive en obra: grúas, obreros
// con casco y un cartel de «Próximamente». Al inaugurarlo basta cambiar la fase.

export const STADIUM = {
  /** Centro de la isla del estadio (x, z) en el mundo. */
  center: [9, -52] as [number, number],
  /** Escala del conjunto (isla, estadio, grúas): pequeño frente al mall. */
  scale: 0.6,
  phase: 'construction' as 'construction' | 'open',
  /** Avance de obra que muestra el cartel (solo ambientación). */
  progress: 68,
}

/** ¿El mundo está en obra? Los visitantes llevan casco y hay grúas moviéndose. */
export const UNDER_CONSTRUCTION = STADIUM.phase === 'construction'
