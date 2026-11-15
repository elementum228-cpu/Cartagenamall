import type { Tier } from './deviceProfile'

/**
 * ¿El portón usa la versión liviana? Sin 3D en las hojas, sin SVG del pasillo, sin rayos ni desenfoques: solo degradados y movimientos
 * de transformación/opacidad (que corren fuera del hilo principal). Se elige en gama baja, con ahorro de datos o cuando, al mirar los
 * primeros cuadros, el teléfono va por debajo de ~35 cuadros por segundo (`medianFrameMs` > 28).
 */
export function isLiteDoor(o: { tier: Tier; saveData?: boolean; medianFrameMs?: number }): boolean {
  return o.tier === 'low' || o.saveData === true || (o.medianFrameMs !== undefined && o.medianFrameMs > 28)
}

/** Mediana de una lista de duraciones de cuadro (ms). */
export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
