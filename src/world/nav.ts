import { ESCALATOR, FLOORS, escToWorld, worldToEsc, FOOD_LAYOUT, LAYOUT, SPACES, onP1Walkway, spaceFrontPoint } from '../config/mall'
import type { FloorId } from '../domain/types'
import { DECOR_FOOTPRINTS } from './Decor'
import { FOOD_FOOTPRINTS } from './FoodCourt'
import { techKioskFootprints } from './TechDistrict'
import { BX, CART, DECK, DX, STAIR } from './cinemaLayout'

// Navegación de los visitantes que recorren los dos pisos: una cuadrícula de celdas libres por piso,
// construida a partir de los obstáculos reales de la escena (bancas, palmeras, faroles, islas, fuente,
// escaleras, mesas, terrazas de restaurantes…), búsqueda A* y suavizado por línea de vista. Todo en
// coordenadas de cada piso. Se construye una sola vez, al primer uso.

export type Point = [number, number]

/** Radio de un visitante: la cuadrícula deja este margen alrededor de cada obstáculo. */
export const AGENT_RADIUS = 0.25

interface Circle {
  x: number
  z: number
  r: number
}

/** Extremos de las escaleras en cada piso (dónde se sube y dónde se baja). */
export const ESCALATOR_ENDS = (() => {
  const [up, down] = ESCALATOR.lanesX
  const p2 = FLOORS.find((f) => f.id === 'P2')!.offset
  const top = ESCALATOR.topZ - 0.9
  const onP2 = (lx: number, lz: number): Point => {
    const [x, z] = escToWorld(lx, lz)
    return [x - p2[0], z - p2[1]]
  }
  return {
    /** Piso 1, al pie del carril que sube. */
    upStart: escToWorld(up, ESCALATOR.bottomZ + 1.2) as Point,
    /** Piso 2, al salir del carril que sube. */
    upEnd: onP2(up, top),
    /** Piso 2, al entrar al carril que baja. */
    downStart: onP2(down, top),
    /** Piso 1, al salir del carril que baja. */
    downEnd: escToWorld(down, ESCALATOR.bottomZ + 1.2) as Point,
  }
})()

function p1Free(x: number, z: number): boolean {
  const r = AGENT_RADIUS
  if (!onP1Walkway(x, z, -r)) return false
  // fuente (con los bombillos del borde)
  if (Math.hypot(x, z) < 2.85 + r) return false
  // cuerpo de las escaleras (el pie, en la plaza, sí se pisa)
  const [ex, ez] = worldToEsc(x, z)
  if (ex > ESCALATOR.lanesX[0] - ESCALATOR.width / 2 - r && ex < ESCALATOR.lanesX[1] + ESCALATOR.width / 2 + r && ez > ESCALATOR.topZ - r && ez < ESCALATOR.bottomZ + r) return false
  // islas comerciales del pasillo
  for (const sp of SPACES) {
    if (sp.floorId !== 'P1' || sp.type !== 'island') continue
    const h = sp.size[0] / 2 + r
    if (Math.abs(x - sp.position[0]) < h && Math.abs(z - sp.position[1]) < h) return false
  }
  return !DECOR_FOOTPRINTS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r) && !KIOSKS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r)
}
const KIOSKS = techKioskFootprints(FLOORS[0].zones.find((z) => z.id === 'B')!.angle)

/** Mesas exteriores frente a cada restaurante del piso 2 (ver RestaurantExtras). */
const P2_EXTRAS: Circle[] = SPACES.filter((s) => s.floorId === 'P2' && s.type !== 'island').flatMap((s) => {
  const [w, d] = s.size
  return [-1, 1].map((k) => {
    const lx = k * (w / 2 - 0.9)
    const lz = d / 2 + 1.4
    const c = Math.cos(s.rotation)
    const sn = Math.sin(s.rotation)
    return { x: s.position[0] + lx * c + lz * sn, z: s.position[1] - lx * sn + lz * c, r: 0.7 }
  })
})
const P2_ISLANDS: Circle[] = SPACES.filter((s) => s.floorId === 'P2' && s.type === 'island').map((s) => ({ x: s.position[0], z: s.position[1], r: 1.95 }))

/** Restaurantes de las filas del piso 2 (rectángulos girados): no se pisan. */
const P2_ROWS = SPACES.filter((s) => s.floorId === 'P2' && s.type !== 'island')
function inRow(sp: (typeof P2_ROWS)[number], x: number, z: number, m: number): boolean {
  const dx = x - sp.position[0]
  const dz = z - sp.position[1]
  const c = Math.cos(sp.rotation)
  const sn = Math.sin(sp.rotation)
  const lx = dx * c - dz * sn
  const lz = dx * sn + dz * c
  return Math.abs(lx) < sp.size[0] / 2 + m && Math.abs(lz) < sp.size[1] / 2 + m
}

/** Escalera al cine: baja desde el muro norte del piso 2 (hueco del rincón noroeste) hasta la plaza del cine. */
const P2_OFFSET = FLOORS.find((f) => f.id === 'P2')!.offset
export const CINE_STAIR = (() => {
  const wx = STAIR.x + DX
  return {
    /** Mundo: x de la escalera, z de arriba y de abajo, alturas de cada extremo. */
    x: wx,
    zTop: STAIR.zTop,
    zBot: STAIR.zBot,
    yTop: STAIR.yTop,
    yBot: DECK + 0.1,
    /** Piso 2 (coordenadas del piso): a un paso de la escalera. */
    p2Entry: [wx - P2_OFFSET[0], STAIR.zTop - P2_OFFSET[1] + 0.8] as Point,
    p2Top: [wx - P2_OFFSET[0], STAIR.zTop - P2_OFFSET[1]] as Point,
    /** Plaza del cine (mundo): a un paso del pie de la escalera. */
    plazaEntry: [wx, STAIR.zBot - 1.4] as Point,
    plazaBot: [wx, STAIR.zBot] as Point,
  }
})()
const NW_GAP_X = CINE_STAIR.p2Top[0]

function p2Free(x: number, z: number): boolean {
  const r = AGENT_RADIUS
  const H = FOOD_LAYOUT.half - 0.6
  if (Math.abs(x) > H - r) return false
  // muro norte: solo se cruza por el hueco de la escalera al cine
  const inGap = Math.abs(x - NW_GAP_X) < 1.4 && z > -H - 0.4
  if (!inGap && Math.abs(z) > H - r) return false
  // esquina recortada donde llegan las escaleras
  if (x + z > 2 * FOOD_LAYOUT.half - FOOD_LAYOUT.arrivalCut - 0.4 - r) return false
  if (P2_ROWS.some((s) => inRow(s, x, z, r))) return false
  const hit = (c: Circle) => Math.hypot(x - c.x, z - c.z) < c.r + r
  return !(P2_EXTRAS.some(hit) || P2_ISLANDS.some(hit) || FOOD_FOOTPRINTS.some(hit))
}

/** Plaza del cine (coordenadas del mundo): isla con el edificio al norte, cartelera al sur y la escalera al piso 2. */
const CINE_BOUNDS = { x0: -48.2, x1: -24.6, z0: -77.5, z1: -53.8 }
const CINE_CIRCLES: Circle[] = [
  [-46.5, -62],
  [-28.5, -66.5],
  [-46.5, -56],
].map(([x, z]) => ({ x, z, r: 0.5 }))
function cineFree(x: number, z: number): boolean {
  const r = AGENT_RADIUS
  const b = CINE_BOUNDS
  if (x < b.x0 + r || x > b.x1 - r || z < b.z0 + r || z > b.z1 - r) return false
  // el edificio con su marquesina y la escalinata de entrada
  if (x > BX + DX - 9.7 - r && x < BX + DX + 9.7 + r && z < -63.0 + r) return false
  // cuerpo de la escalera (su pie queda al sur de la plaza)
  if (Math.abs(x - CINE_STAIR.x) < STAIR.w / 2 + 0.6 + r && z > STAIR.zBot - 0.8) return false
  // cartelera del frente
  const cx = CART.x + DX
  if (Math.abs(x - cx) < 4.4 + r && z > CART.z - 1 - r && z < CART.z + 0.9 + r) return false
  return !CINE_CIRCLES.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r)
}

/** Montículo binario mínimo (índice de celda, prioridad) para A*. */
class MinHeap {
  private ids: number[] = []
  private keys: number[] = []
  get size() {
    return this.ids.length
  }
  push(id: number, key: number) {
    this.ids.push(id)
    this.keys.push(key)
    let i = this.ids.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.keys[p] <= this.keys[i]) break
      this.swap(i, p)
      i = p
    }
  }
  pop(): number {
    const top = this.ids[0]
    const lastId = this.ids.pop()!
    const lastKey = this.keys.pop()!
    if (this.ids.length) {
      this.ids[0] = lastId
      this.keys[0] = lastKey
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < this.ids.length && this.keys[l] < this.keys[m]) m = l
        if (r < this.ids.length && this.keys[r] < this.keys[m]) m = r
        if (m === i) break
        this.swap(i, m)
        i = m
      }
    }
    return top
  }
  private swap(a: number, b: number) {
    ;[this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]]
    ;[this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]]
  }
}

export class NavGrid {
  readonly cols: number
  readonly rows: number
  private readonly free: Uint8Array

  constructor(
    readonly x0: number,
    readonly z0: number,
    x1: number,
    z1: number,
    readonly isFree: (x: number, z: number) => boolean,
    readonly cell: number,
  ) {
    this.cols = Math.ceil((x1 - x0) / cell)
    this.rows = Math.ceil((z1 - z0) / cell)
    this.free = new Uint8Array(this.cols * this.rows)
    for (let j = 0; j < this.rows; j++)
      for (let i = 0; i < this.cols; i++) this.free[j * this.cols + i] = isFree(...this.center(i, j)) ? 1 : 0
  }

  private center(i: number, j: number): Point {
    return [this.x0 + (i + 0.5) * this.cell, this.z0 + (j + 0.5) * this.cell]
  }
  private cellOf([x, z]: Point): [number, number] {
    return [Math.floor((x - this.x0) / this.cell), Math.floor((z - this.z0) / this.cell)]
  }
  private ok(i: number, j: number) {
    return i >= 0 && j >= 0 && i < this.cols && j < this.rows && this.free[j * this.cols + i] === 1
  }

  /** ¿Se puede ir en línea recta? (muestreo fino contra el predicado real, no solo las celdas). */
  lineFree(a: Point, b: Point): boolean {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.15))
    for (let k = 0; k <= n; k++) {
      const u = k / n
      if (!this.isFree(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)) return false
    }
    return true
  }

  /** Celda libre más cercana a un punto (para destinos que caen junto a un obstáculo). */
  snap(p: Point): Point | null {
    if (this.isFree(p[0], p[1])) return p
    const [ci, cj] = this.cellOf(p)
    for (let rad = 1; rad < 12; rad++)
      for (let dj = -rad; dj <= rad; dj++)
        for (let di = -rad; di <= rad; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== rad || !this.ok(ci + di, cj + dj)) continue
          return this.center(ci + di, cj + dj)
        }
    return null
  }

  /** Ruta de `from` a `to` (A* en 8 direcciones + suavizado). Null si no hay camino. */
  path(from: Point, to: Point): Point[] | null {
    const a = this.snap(from)
    const b = this.snap(to)
    if (!a || !b) return null
    if (this.lineFree(a, b)) return [a, b]
    const [si, sj] = this.cellOf(a)
    const [ti, tj] = this.cellOf(b)
    const N = this.cols * this.rows
    const g = new Float32Array(N).fill(Infinity)
    const came = new Int32Array(N).fill(-1)
    const closed = new Uint8Array(N)
    const open = new MinHeap()
    const fScore = new Float32Array(N).fill(Infinity)
    const start = sj * this.cols + si
    const goal = tj * this.cols + ti
    if (!this.ok(si, sj) || !this.ok(ti, tj)) return null
    g[start] = 0
    fScore[start] = Math.hypot(ti - si, tj - sj)
    open.push(start, fScore[start])
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
    while (open.size) {
      const cur = open.pop()
      if (cur === goal) break
      if (closed[cur]) continue
      closed[cur] = 1
      const ci = cur % this.cols
      const cj = (cur - ci) / this.cols
      for (const [di, dj, cost] of dirs) {
        const ni = ci + di
        const nj = cj + dj
        if (!this.ok(ni, nj)) continue
        // sin cortar esquinas en diagonal
        if (di && dj && (!this.ok(ci + di, cj) || !this.ok(ci, cj + dj))) continue
        const nIdx = nj * this.cols + ni
        const ng = g[cur] + cost
        if (ng < g[nIdx]) {
          g[nIdx] = ng
          came[nIdx] = cur
          fScore[nIdx] = ng + Math.hypot(ti - ni, tj - nj)
          open.push(nIdx, fScore[nIdx])
        }
      }
    }
    if (came[goal] === -1 && goal !== start) return null
    const cells: Point[] = []
    for (let c = goal; c !== -1; c = came[c]) {
      const ci = c % this.cols
      cells.push(this.center(ci, (c - ci) / this.cols))
      if (c === start) break
    }
    cells.reverse()
    const raw: Point[] = [a, ...cells.slice(1, -1), b]
    // suavizado: desde cada punto, saltar al más lejano que se ve en línea recta
    const out: Point[] = [raw[0]]
    let k = 0
    while (k < raw.length - 1) {
      let far = k + 1
      for (let m = raw.length - 1; m > k + 1; m--)
        if (this.lineFree(raw[k], raw[m])) {
          far = m
          break
        }
      out.push(raw[far])
      k = far
    }
    return out
  }
}

let grids: Record<FloorId, NavGrid> | null = null
/** Cuadrículas de navegación de los dos pisos (se construyen una vez). */
export function navGrids(): Record<FloorId, NavGrid> {
  if (!grids) {
    const E = LAYOUT.wingEnd
    grids = {
      P1: new NavGrid(-E, -E, E, E, p1Free, 0.4),
      // la terraza de comidas es más apretada (mesas con taburetes): celdas más finas
      P2: new NavGrid(-FOOD_LAYOUT.half, -FOOD_LAYOUT.half, FOOD_LAYOUT.half, FOOD_LAYOUT.half, p2Free, 0.25),
    }
  }
  return grids
}

let cineGridCache: NavGrid | null = null
/** Cuadrícula de la plaza del cine (mundo). */
export function cinemaGrid(): NavGrid {
  if (!cineGridCache) cineGridCache = new NavGrid(CINE_BOUNDS.x0, CINE_BOUNDS.z0, CINE_BOUNDS.x1, CINE_BOUNDS.z1, cineFree, 0.3)
  return cineGridCache
}

export interface Poi {
  floorId: FloorId
  point: Point
  /** Hacia dónde mira al detenerse (vitrina, restaurante, baranda…). */
  look: Point
}

/** Lugares que los visitantes visitan en cada piso: vitrinas, restaurantes, bancas, terraza y miradores. */
let poiCache: Poi[] | null = null
export function pointsOfInterest(): Poi[] {
  if (poiCache) return poiCache
  const { P1, P2 } = navGrids()
  const out: Poi[] = []
  // Frente de cada local: se prueba a varias distancias hasta dar con un punto al que se llega
  // caminando desde las escaleras (en la terraza hay rincones encerrados por mesas).
  for (const sp of SPACES) {
    const floorId = sp.floorId as FloorId
    const grid = floorId === 'P1' ? P1 : P2
    const from = floorId === 'P1' ? ESCALATOR_ENDS.downEnd : ESCALATOR_ENDS.upEnd
    const tries = floorId === 'P2' && sp.type !== 'island' ? [2.9, 2.3, 3.5, 1.7, 4.2] : [0.9, 1.4, 1.9]
    for (const d of tries) {
      const p = grid.snap(spaceFrontPoint(sp, d))
      if (p && grid.path(from, p)) {
        out.push({ floorId, point: p, look: sp.position })
        break
      }
    }
  }
  const extra: Poi[] = [
    { floorId: 'P1', point: [5.5, 3.5], look: [0, 0] },
    { floorId: 'P1', point: [-3.5, -5.5], look: [0, 0] },
    { floorId: 'P1', point: [3.8, -6.2], look: [0, 0] },
    { floorId: 'P2', point: [12.4, 2], look: [20, 2] },
    { floorId: 'P2', point: [3, 12.4], look: [3, 20] },
    { floorId: 'P2', point: [-7, -6], look: [-11, -11] },
    { floorId: 'P2', point: [1.5, -2], look: [-2, 2] },
  ]
  for (const e of extra) {
    const grid = e.floorId === 'P1' ? P1 : P2
    const p = grid.snap(e.point)
    if (p && grid.path(e.floorId === 'P1' ? ESCALATOR_ENDS.downEnd : ESCALATOR_ENDS.upEnd, p)) out.push({ ...e, point: p })
  }
  poiCache = out
  return out
}

let cinePoiCache: Poi[] | null = null
/** Lugares de la plaza del cine donde los visitantes se detienen: la cartelera, la entrada y las palmeras. */
export function cinemaPois(): Poi[] {
  if (cinePoiCache) return cinePoiCache
  const grid = cinemaGrid()
  const board: Point = [CART.x + DX, CART.z]
  const door: Point = [BX + DX, -68]
  const spots: [Point, Point][] = [
    [[-38.5, -55.1], board],
    [[-35, -55.1], board],
    [[-31.5, -55.1], board],
    [[-40, -61.6], door],
    [[-37.5, -61.8], door],
    [[-35, -61.6], door],
    [[-45.5, -59], [-47.5, -59]],
    [[-30, -60.5], [-24, -60.5]],
    [[-27, -64], [-24, -66]],
    [[-44.5, -64.3], door],
  ]
  cinePoiCache = spots.flatMap(([p, look]) => {
    const q = grid.snap(p)
    return q && grid.path(CINE_STAIR.plazaEntry, q) ? [{ floorId: 'P1' as FloorId, point: q, look }] : []
  })
  return cinePoiCache
}
