import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cameraState } from './cameraState'

/**
 * Anti-superposición de carteles flotantes. Cada ScreenLabel se registra con una prioridad; este
 * gestor proyecta los candidatos a pantalla y, cuando dos se pisan, deja visible el más importante.
 */
export const LABEL_PRIORITY = {
  selected: 200,
  /** Los cuatro pasillos se ven siempre en la vista general: valen más que el cartel del piso. */
  corridorOverview: 125,
  floorSign: 120,
  store: 60,
  promo: 55,
  corridor: 40,
  section: 30,
} as const

export interface LabelEntry {
  object: THREE.Object3D
  priority: number
  aspect: number
  pixelHeight: number
  /** Escala mínima en pantallas chicas (ver Label.minUiScale). */
  minUiScale: number
  /** El propio cartel decide si aplica (zoom, piso visible). */
  eligible: boolean
  /** Resultado del gestor: no se pisa con otro más importante. */
  accepted: boolean
}

const entries = new Set<LabelEntry>()
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __cmLabels?: unknown }).__cmLabels = entries

export function registerLabel(e: LabelEntry) {
  entries.add(e)
  return () => void entries.delete(e)
}

/** ¿Todos sus ancestros están visibles? (un piso oculto oculta sus carteles). */
export function visibleInTree(o: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (!p.visible) return false
  return true
}

const v = new THREE.Vector3()
const MARGIN = 4

/** Zonas de pantalla que ocupan los botones del celular: ningún cartel del mapa debe quedar debajo de ellos. */
function hudZones(w: number, h: number): [number, number, number, number][] {
  return [
    [0, 0, w, 126], // cabecera y fila «Categorías / Descubre»
    [0, 126, 280, 170], // aviso contextual (oferta relámpago)
    [0, h * 0.34, 68, h * 0.68], // selector de pisos
    [w - 68, h - 260, w, h - 80], // opciones y volver al centro
    [0, h - 92, w, h], // pestañas
  ]
}
/** En la vista general del celular solo se muestran los carteles más importantes; el resto aparece al acercar. */
const OVERVIEW_MAX_LABELS = 6

export function useLabelDeclutter() {
  let frame = 0
  useFrame(({ camera, size }) => {
    if (frame++ % 3) return // cada 3 cuadros basta
    const compact = size.width < 768
    const rects: [number, number, number, number][] = compact ? hudZones(size.width, size.height) : []
    const overviewish = compact && cameraState.zoom / cameraState.fitZoom < 1.3
    let shown = 0
    const list = [...entries].filter((e) => e.eligible).sort((a, b) => b.priority - a.priority)
    for (const e of list) {
      e.object.getWorldPosition(v)
      v.project(camera)
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      const h = e.pixelHeight * Math.max(cameraState.uiScale, e.minUiScale)
      const w = h * e.aspect
      const r: [number, number, number, number] = [x - w / 2 - MARGIN, y - h / 2 - MARGIN, x + w / 2 + MARGIN, y + h / 2 + MARGIN]
      const hit = rects.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])
      // el cartel elegido (selected) nunca se oculta por el límite de la vista general
      const capped = overviewish && e.priority < LABEL_PRIORITY.selected && shown >= OVERVIEW_MAX_LABELS
      e.accepted = !hit && !capped
      if (e.accepted) {
        rects.push(r)
        shown++
      }
    }
    for (const e of entries) if (!e.eligible) e.accepted = true
  })
}
