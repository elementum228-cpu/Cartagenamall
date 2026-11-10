import * as THREE from 'three'
import { GEO, GLASS, mat } from './materials'
import { glowMat } from './night'
import { glassSheen } from './FoodCourt'

/**
 * Escaparates 3D: ventanas de ~3,4 m con objetos reales detrás del vidrio (maniquíes, zapatos, gafas, regalos, tecnología),
 * una franja de cartel arriba y luz cálida. El vidrio lleva el mismo reflejo de cielo que la fachada del mall.
 */
export const WIN = 3.4
let reflMat: THREE.MeshBasicMaterial | null = null
const refl = () => (reflMat ??= new THREE.MeshBasicMaterial({ map: glassSheen().map, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
const SHOW_COLORS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f', '#6b5b95', '#2bb3a3', '#f08a4b']

export function Window({ i, H = 3.75, glass = true }: { i: number; H?: number; glass?: boolean }) {
  const t = i % 5
  const c = (k: number) => SHOW_COLORS[(k + i * 3) % SHOW_COLORS.length]
  const wood = mat('#8a6a4a')
  const dark = mat('#2b2f3a')
  const light = glowMat('#fff0c8', 2, { dayGlow: 0.55 })
  const D = 0.85
  const skin = mat('#d9b08c')
  const pm = (k: number) => mat(c(k), { emissive: 0.35 })
  const backGlow = glowMat('#ffd9a0', 1.3, { dayGlow: 0.18 })
  return (
    <group>
      {/* fondo cálido, suelo, techo y luz */}
      <mesh geometry={GEO.box} material={backGlow} position={[0, H / 2, 0.04]} scale={[WIN - 0.1, H, 0.06]} />
      <mesh geometry={GEO.box} material={glowMat('#e9b678', 0.9, { dayGlow: 0.12 })} position={[0, 0.08, D / 2]} scale={[WIN - 0.1, 0.16, D]} />
      <mesh geometry={GEO.box} material={light} position={[0, H - 0.18, D / 2]} scale={[WIN - 0.4, 0.1, D - 0.2]} />
      {t === 0 && (
        <>
          {/* maniquíes con ropa */}
          {[-1, 0, 1].map((k) => (
            <group key={k} position={[k * 0.95, 0.16, 0.5]}>
              <mesh geometry={GEO.cylinder} material={dark} position={[0, 0.06, 0]} scale={[0.4, 0.05, 0.4]} />
              <mesh geometry={GEO.cylinder} material={dark} position={[0, 0.55, 0]} scale={[0.05, 1.0, 0.05]} />
              <mesh geometry={GEO.rounded} material={pm(k + 1)} position={[0, 1.2, 0]} scale={[0.5, 0.75, 0.28]} />
              <mesh geometry={GEO.cylinder} material={pm(k + 4)} position={[0, 0.8, 0]} scale={[0.46, 0.45, 0.3]} />
              <mesh geometry={GEO.sphereSmooth} material={skin} position={[0, 1.78, 0]} scale={0.26} />
            </group>
          ))}
          <mesh geometry={GEO.box} material={wood} position={[0, 2.85, 0.25]} scale={[WIN - 0.5, 0.05, 0.05]} />
          {[-1.2, -0.6, 0, 0.6, 1.2].map((x, k) => (
            <mesh key={k} geometry={GEO.rounded} material={pm(k)} position={[x, 2.45, 0.25]} scale={[0.36, 0.7, 0.08]} />
          ))}
        </>
      )}
      {t === 1 && (
        <>
          {[0, 1, 2].map((r) => (
            <group key={r} position={[0, 0.16 + r * 1.05, 0]}>
              <mesh geometry={GEO.box} material={wood} position={[0, 0.7, 0.4]} scale={[WIN - 0.4, 0.06, 0.6]} />
              {[-1.1, -0.45, 0.2, 0.85].map((x, k) => (
                <group key={k} position={[x, 0.78, 0.4]}>
                  <mesh geometry={GEO.rounded} material={pm(k + r)} position={[0, 0.12, 0]} scale={[0.5, 0.22, 0.2]} />
                  <mesh geometry={GEO.box} material={dark} position={[0, 0.02, 0]} scale={[0.52, 0.05, 0.22]} />
                </group>
              ))}
            </group>
          ))}
        </>
      )}
      {t === 2 && (
        <>
          {[0, 1, 2].map((r) => (
            <group key={r} position={[0, 0.16 + r * 1.05, 0]}>
              <mesh geometry={GEO.box} material={wood} position={[0, 0.7, 0.4]} scale={[WIN - 0.4, 0.06, 0.6]} />
              {[-0.9, 0.2, 1.1].map((x, k) => (
                <group key={k} position={[x, 0.9, 0.4]}>
                  <mesh geometry={GEO.torus} material={pm(k + r)} position={[-0.17, 0, 0]} scale={0.14} />
                  <mesh geometry={GEO.torus} material={pm(k + r)} position={[0.17, 0, 0]} scale={0.14} />
                  <mesh geometry={GEO.box} material={pm(k + r)} position={[0, 0.02, 0]} scale={[0.08, 0.03, 0.03]} />
                </group>
              ))}
            </group>
          ))}
        </>
      )}
      {t === 3 && (
        <>
          {[-1.1, -0.35, 0.4, 1.05].map((x, k) => {
            const h = 0.45 + (k % 2) * 0.35
            return (
              <group key={k} position={[x, 0.16, 0.45]}>
                <mesh geometry={GEO.box} material={pm(k)} position={[0, h / 2, 0]} scale={[0.6, h, 0.6]} castShadow />
                <mesh geometry={GEO.box} material={mat('#ffffff')} position={[0, h / 2, 0]} scale={[0.1, h + 0.01, 0.62]} />
                <mesh geometry={GEO.box} material={mat('#ffffff')} position={[0, h / 2, 0]} scale={[0.62, h + 0.01, 0.1]} />
              </group>
            )
          })}
          {[-0.9, 0.1, 1.0].map((x, k) => (
            <group key={`b${k}`} position={[x, 0, 0.35]}>
              <mesh geometry={GEO.cylinder} material={wood} position={[0, 1.5, 0]} scale={[0.02, 2.4, 0.02]} />
              <mesh geometry={GEO.sphereSmooth} material={mat(c(k + 4), { rough: 0.3 })} position={[0, 2.8 - (k % 2) * 0.4, 0]} scale={[0.55, 0.65, 0.55]} />
            </group>
          ))}
        </>
      )}
      {t === 4 && (
        <>
          <mesh geometry={GEO.box} material={dark} position={[0, 2.1, 0.25]} scale={[2.0, 1.15, 0.1]} />
          <mesh geometry={GEO.box} material={glowMat(c(2), 1.6, { dayGlow: 0.6 })} position={[0, 2.1, 0.31]} scale={[1.9, 1.05, 0.02]} />
          <mesh geometry={GEO.box} material={wood} position={[0, 1.2, 0.4]} scale={[WIN - 0.4, 0.06, 0.6]} />
          {[-1.1, -0.55, 0, 0.55, 1.1].map((x, k) => (
            <group key={k} position={[x, 1.38, 0.4]}>
              <mesh geometry={GEO.rounded} material={dark} scale={[0.26, 0.34, 0.04]} />
              <mesh geometry={GEO.box} material={glowMat(c(k), 1.4, { dayGlow: 0.5 })} position={[0, 0, 0.025]} scale={[0.22, 0.28, 0.01]} />
            </group>
          ))}
          {[-0.8, 0, 0.8].map((x, k) => (
            <group key={`h${k}`} position={[x, 0.45, 0.5]}>
              <mesh geometry={GEO.cylinder} material={pm(k + 3)} position={[-0.13, 0.12, 0]} scale={[0.18, 0.08, 0.18]} />
              <mesh geometry={GEO.cylinder} material={pm(k + 3)} position={[0.13, 0.12, 0]} scale={[0.18, 0.08, 0.18]} />
              <mesh geometry={GEO.box} material={dark} position={[0, 0.28, 0]} scale={[0.3, 0.04, 0.04]} />
            </group>
          ))}
        </>
      )}
      {/* vidrio con reflejo, en el frente */}
      {glass && (
        <>
          <mesh geometry={GEO.box} material={GLASS} position={[0, H / 2, D]} scale={[WIN - 0.1, H, 0.04]} />
          <mesh geometry={GEO.plane} material={refl()} position={[0, H / 2, D + 0.03]} scale={[WIN - 0.1, H, 1]} />
        </>
      )}
      {/* marcos */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} geometry={GEO.box} material={mat('#d6dade')} position={[sd * (WIN / 2 - 0.05), H / 2, D / 2]} scale={[0.1, H, D]} />
      ))}
    </group>
  )
}

