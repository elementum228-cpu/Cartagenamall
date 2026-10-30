import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { FloorId } from '../domain/types'
import { GEO, mat, PALETTE } from './materials'
import { glowMat, lightPoolMat } from './night'
import type { PathLight } from './pathLights'

// Iluminación de recorridos, configurable por datos (`pathLights.ts`): halos cálidos en el piso y
// balizas bajas. Una InstancedMesh por color/intensidad: unas pocas llamadas de dibujo en total.

function Instances({ material, geometry, items }: { material: THREE.Material; geometry: THREE.BufferGeometry; items: { p: [number, number, number]; s: [number, number, number]; r?: [number, number, number] }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.rotation.set(...(it.r ?? [0, 0, 0]))
      o.scale.set(...it.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} renderOrder={2} raycast={() => null} />
}

/**
 * `boost` compensa la falta de luces locales reales en calidad media/baja (los halos suben un poco),
 * para que la noche se vea igual de cálida en los tres niveles.
 */
export function MallPathLighting({ lights, floorId, y = 0.245, boost = 1 }: { lights: PathLight[]; floorId: FloorId; y?: number; boost?: number }) {
  const groups = useMemo(() => {
    const byKey = new Map<string, { color: string; intensity: number; items: { p: [number, number, number]; s: [number, number, number]; r: [number, number, number] }[] }>()
    for (const l of lights) {
      if (!l.active || l.floorId !== floorId) continue
      const key = `${l.color}|${l.intensity}`
      const g = byKey.get(key) ?? { color: l.color, intensity: l.intensity, items: [] }
      g.items.push({ p: [l.position[0], y + (l.radius > 5 ? 0.005 : 0.01), l.position[1]], s: [l.radius * 2, l.radius * 2, 1], r: [-Math.PI / 2, 0, 0] })
      byKey.set(key, g)
    }
    return [...byKey.values()]
  }, [lights, floorId, y])
  const bollards = useMemo(
    () => lights.filter((l) => l.active && l.floorId === floorId && l.fixture === 'bollard'),
    [lights, floorId],
  )
  return (
    <group>
      {groups.map((g) => (
        <Instances key={`${g.color}${g.intensity}${boost}`} geometry={GEO.plane} material={lightPoolMat(g.color, Math.min(1, g.intensity * boost))} items={g.items} />
      ))}
      <Instances geometry={GEO.cylinderLow} material={mat(PALETTE.metal)} items={bollards.map((b) => ({ p: [b.position[0], y + 0.3, b.position[1]], s: [0.22, 0.6, 0.22] }))} />
      <Instances
        geometry={GEO.cylinderLow}
        material={glowMat('#ffe0a8', 2.2, { dayGlow: 0.3 })}
        items={bollards.map((b) => ({ p: [b.position[0], y + 0.68, b.position[1]], s: [0.26, 0.16, 0.26] }))}
      />
    </group>
  )
}
