import { helmetColor, useHelmetsOn } from './helmets'
import { GEO, mat } from './materials'

const hash = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0)

/** Una persona en miniatura (mismo estilo que los visitantes del mall). */
export function Person({ color, skin }: { color: string; skin: string }) {
  const helmets = useHelmetsOn()
  return (
    <group>
      <mesh geometry={GEO.capsule} material={mat(color)} position={[0, 0.43, 0]} castShadow />
      <mesh geometry={GEO.sphereSmooth} material={mat(skin)} position={[0, 0.95, 0]} scale={0.36} castShadow />
      {helmets && <mesh geometry={GEO.helmet} material={mat(helmetColor(hash(color)))} position={[0, 0.97, 0]} scale={0.4} castShadow />}
    </group>
  )
}
