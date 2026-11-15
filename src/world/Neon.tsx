import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { GEO } from './materials'

// Tubos de neón que cambian de color despacio (el matiz recorre el arcoíris) y «respiran». De día se ven suaves; de noche brillan más.
// Cada tira usa un material propio que se actualiza una vez por cuadro: son pocas tiras y no se funden con el resto de la escena.

export interface NeonSeg {
  /** Centro de la tira (coordenadas del grupo donde se pone). */
  at: [number, number, number]
  /** Largo y eje (x o z). */
  len: number
  axis: 'x' | 'y' | 'z'
  /** Desfase del color (0–1) para que no todas vayan igual. */
  hue?: number
  /** Giro sobre el eje vertical (radianes), para formar anillos y diagonales. */
  rot?: number
}

export function NeonRun({ segs, thick = 0.12, speed = 0.08, reduceMotion = false }: { segs: NeonSeg[]; thick?: number; speed?: number; reduceMotion?: boolean }) {
  const night = useIsNight()
  const mats = useMemo(() => segs.map(() => new THREE.MeshBasicMaterial({ color: '#ff2bd6', toneMapped: false })), [segs])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    segs.forEach((sg, i) => {
      const h = ((sg.hue ?? 0) + t * speed) % 1
      const pulse = reduceMotion ? 0.55 : 0.5 + 0.12 * Math.sin(t * 2.4 + i)
      mats[i].color.copy(tmp.setHSL(h, 1, night ? 0.6 : 0.5 * (0.85 + pulse * 0.2)))
      const m = meshes.current[i]
      if (m) {
        const k = night ? 1.25 : 1
        m.scale.y = m.scale.z = thick * k * (0.9 + pulse * 0.2)
        if (sg.axis === 'z') m.scale.x = m.scale.y
        if (sg.axis === 'y') m.scale.set(m.scale.y, sg.len, m.scale.y)
      }
    })
  })
  return (
    <group>
      {segs.map((sg, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el
          }}
          geometry={GEO.box}
          material={mats[i]}
          position={sg.at}
          rotation={[0, sg.rot ?? 0, 0]}
          scale={sg.axis === 'x' ? [sg.len, thick, thick] : sg.axis === 'y' ? [thick, sg.len, thick] : [thick, thick, sg.len]}
          raycast={() => null}
          userData={{ dynamic: true }}
        />
      ))}
    </group>
  )
}
