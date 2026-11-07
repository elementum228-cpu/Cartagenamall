import type { StadiumPhase } from '../config/stadium'

// Geometría del estadio sin three: el contorno de la grada y qué tramos están terminados en cada estado.
// Se separa de Stadium.tsx para poder probarla.

export const PX = 9 // medio largo de la cancha
export const PZ = 5.6
export const BOWL_X = PX + 1.6
export const BOWL_Z = PZ + 1.6
export const BOWL_R = 3.2

// ── geometría paramétrica: contorno de rectángulo redondeado con correspondencia entre desplazamientos ───
export type Pt = { x: number; z: number; nx: number; nz: number }
export function ring(hx: number, hz: number, r: number, ns = 8, nc = 6): Pt[] {
  const pts: Pt[] = []
  const sx = hx - r
  const sz = hz - r
  const side = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number) => {
    for (let i = 0; i <= ns; i++) {
      const t = i / ns
      pts.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz })
    }
  }
  const corner = (cx: number, cz: number, a0: number, a1: number) => {
    for (let i = 0; i <= nc; i++) {
      const a = a0 + ((a1 - a0) * i) / nc
      pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) })
    }
  }
  side(hx, -sz, hx, sz, 1, 0) // este
  corner(sx, sz, 0, Math.PI / 2) // sureste
  side(sx, hz, -sx, hz, 0, 1) // sur
  corner(-sx, sz, Math.PI / 2, Math.PI)
  side(-hx, sz, -hx, -sz, -1, 0) // oeste
  corner(-sx, -sz, Math.PI, 1.5 * Math.PI)
  side(-sx, -hz, sx, -hz, 0, -1) // norte
  corner(sx, -sz, 1.5 * Math.PI, 2 * Math.PI)
  return pts
}
export const BASE = ring(BOWL_X, BOWL_Z, BOWL_R)
export const N = BASE.length
export const at = (i: number, d: number): [number, number] => {
  const p = BASE[Math.min(Math.max(i, 0), N - 1)]
  return [p.x + p.nx * d, p.z + p.nz * d]
}

/** ¿Está terminada esa parte del estadio? El tercio este y la esquina sureste siguen en obra. */
export const built = (i: number, phase: StadiumPhase) => {
  if (phase === 'open') return true
  const { x, z } = BASE[Math.min(Math.max(i, 0), N - 1)]
  // casi terminado: solo queda en obra un pedazo de la esquina sureste
  if (phase === 'almost') return !(x > 7 && z > 2.5)
  return !(x > 4.5 || (z > 5 && x > -4))
}
/** Un tramo (de i a i+1) está terminado si sus dos extremos lo están. */
export const segBuilt = (i: number, phase: StadiumPhase) => built(i, phase) && built(i + 1, phase)

