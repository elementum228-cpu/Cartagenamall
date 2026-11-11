import { BatchScope } from './Batch'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { FloorConfig } from '../domain/types'
import { floorOrigin, liveOrigins } from './floors'

/**
 * - full: piso en detalle (activo, o vista general).
 * - shell: solo la estructura, como contexto (pisos de abajo del activo).
 * - hidden: no se dibuja (pisos de arriba del activo: taparían la vista).
 */
export type FloorMode = 'full' | 'shell' | 'hidden'

const ENTER_LIFT = 2.6

/**
 * Un piso del mall. Mantiene montado todo su contenido (cambiar de piso no reconstruye la escena):
 * solo cambia qué se dibuja y anima la llegada del piso con una transición ligera.
 */
export function MallFloor({ floor, mode, overview, shell, detail }: { floor: FloorConfig; mode: FloorMode; overview: boolean; shell: ReactNode; detail: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const detailGroup = useRef<THREE.Group>(null)
  const enter = useRef(0)
  const prevMode = useRef<FloorMode>(mode)

  useEffect(() => {
    if (prevMode.current === 'hidden' && mode !== 'hidden') enter.current = 1
    prevMode.current = mode
  }, [mode])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const target = floorOrigin(floor, overview)
    g.position.lerp(target, Math.min(1, dt * 6))
    if (g.position.distanceToSquared(target) < 1e-6) g.position.copy(target)
    if (enter.current > 0) {
      enter.current = Math.max(0, enter.current - dt * 2.4)
      const e = enter.current * enter.current
      g.position.y = target.y + ENTER_LIFT * e
      g.scale.setScalar(1 - 0.04 * e)
    } else if (g.scale.x !== 1) g.scale.setScalar(1)
    liveOrigins[floor.id].copy(g.position)
  })

  return (
    <group ref={group} visible={mode !== 'hidden'} userData={{ audit: `piso-${floor.id}` }}>
      <BatchScope>{shell}</BatchScope>
      <group ref={detailGroup} visible={mode === 'full'}>
        <BatchScope>{detail}</BatchScope>
      </group>
    </group>
  )
}
