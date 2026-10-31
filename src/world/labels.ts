import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cameraState } from './cameraState'

/**
 * Anti-superposición de carteles flotantes. Cada ScreenLabel se registra con una prioridad; este
 * gestor proyecta los candidatos a pantalla y, cuando dos se pisan, deja visible el más importante.
 */
export const LABEL_PRIORITY = {
  selected: 200,
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

export function useLabelDeclutter() {
  let frame = 0
  useFrame(({ camera, size }) => {
    if (frame++ % 3) return // cada 3 cuadros basta
    const rects: [number, number, number, number][] = []
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
      e.accepted = !hit
      if (!hit) rects.push(r)
    }
    for (const e of entries) if (!e.eligible) e.accepted = true
  })
}
