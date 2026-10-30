import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import { appClock } from '../lib/clock'
import { cameraState } from './cameraState'
import { nightState } from './night'
import { LABEL_PRIORITY, registerLabel, visibleInTree, type LabelEntry } from './labels'
import { GEO } from './materials'
import type { Label } from './labelTexture'

/**
 * Rótulo que siempre mira a la cámara y mantiene un tamaño en pantalla casi constante
 * (`pixelHeight`), para que los nombres se lean tanto en vista general como de cerca.
 * `minZoomRatio`/`maxZoomRatio` lo ocultan según el zoom relativo al encuadre general.
 */
export function ScreenLabel({
  label,
  position,
  pixelHeight = 30,
  maxWorldHeight = Infinity,
  minZoomRatio = 0,
  maxZoomRatio = Infinity,
  lit = false,
  priority = LABEL_PRIORITY.store,
  onClick,
  popAt = null,
  yieldExcept,
}: {
  label: Label
  position: [number, number, number]
  pixelHeight?: number
  maxWorldHeight?: number
  minZoomRatio?: number
  maxZoomRatio?: number
  /** Letrero iluminado (tiendas): de noche conserva su brillo; los demás se atenúan. */
  lit?: boolean
  /** Prioridad frente a otros carteles cuando se pisan (ver labels.ts). */
  priority?: number
  onClick?: () => void
  /** Momento (reloj de la app) en que el cartel "salta" una vez para anunciarse (p. ej. una oferta nueva). */
  popAt?: number | null
  /**
   * Cartel que flota sobre otros locales: si el toque también cae sobre otro local (cualquiera que no
   * sea este espacio), el toque sigue hacia ese local y el cartel no lo bloquea.
   */
  yieldExcept?: string
}) {
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const entry = useRef<LabelEntry | null>(null)
  useEffect(() => {
    if (!group.current) return
    const e: LabelEntry = { object: group.current, priority, aspect: label.aspect, pixelHeight, eligible: false, accepted: true }
    entry.current = e
    return registerLabel(e)
  }, [priority, label.aspect, pixelHeight])
  useFrame(() => {
    // de noche: los carteles se atenúan apenas (los iluminados, menos) para no deslumbrar ni perder legibilidad
    if (material.current) material.current.color.setScalar(1 - (lit ? 0.05 : 0.1) * nightState.t)
    const g = group.current
    if (!g) return
    let h = Math.min((pixelHeight * cameraState.uiScale) / cameraState.zoom, maxWorldHeight)
    if (popAt !== null) {
      // salto amortiguado de ~1 s, repetido una vez a los 3 s
      const t = ((appClock.now() - popAt) / 1000) % 3
      const n = (appClock.now() - popAt) / 1000
      if (n >= 0 && n < 6 && t < 1) h *= 1 + 0.35 * Math.sin(t * Math.PI) * (1 - t)
    }
    g.scale.set(h * label.aspect, h, 1)
    const ratio = cameraState.zoom / cameraState.fitZoom
    const eligible = ratio >= minZoomRatio && ratio <= maxZoomRatio && visibleInTree(g)
    const e = entry.current
    if (e) e.eligible = eligible
    g.visible = eligible && (e?.accepted ?? true)
  })
  return (
    <Billboard position={position}>
      <group ref={group}>
        <mesh
          geometry={GEO.plane}
          renderOrder={10}
          onClick={
            onClick
              ? (e) => {
                  if (cameraState.handMode || e.delta > 8 || !group.current?.visible || !visibleInTree(group.current)) return
                  // Una oferta escondida bajo el cartel tiene prioridad: el toque sigue hacia ella.
                  if (e.intersections.some((i) => i.object.userData.secretGem)) return
                  if (yieldExcept && e.intersections.some((i) => { const sp = spaceOf(i.object); return sp && sp !== yieldExcept })) return
                  e.stopPropagation()
                  onClick()
                }
              : undefined
          }
        >
          <meshBasicMaterial ref={material} map={label.texture} transparent depthTest={false} toneMapped={false} />
        </mesh>
      </group>
    </Billboard>
  )
}

/** Espacio (local) al que pertenece un objeto del mundo, si lo hay. */
function spaceOf(o: THREE.Object3D | null): string | undefined {
  for (let x = o; x; x = x.parent) if (x.userData.spaceId) return x.userData.spaceId as string
  return undefined
}
