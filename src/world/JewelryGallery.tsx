import { useMemo } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, STONE, STONE_DARK } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, GLASS, mat } from './materials'

// Galería de Joyería (vista previa de la propuesta A): un pabellón exclusivo junto a la muralla este,
// al lado de la entrada del mall. Una sola puerta con arco dorado, dos vigilantes y cordones rojos que
// guían la fila; adentro, piso de mármol con borde dorado, alfombra roja y ocho boutiques.
// Solo se dibuja con la vista previa encendida (?vista=joyeria): todavía no es parte del mall.

export const JEWELRY_PREVIEW = typeof location !== 'undefined' && /[?&]vista=joyeria/.test(location.search)

/** Centro del pabellón (x, z) y su tamaño: 24 en x, 16 en z. Mira al sur (+z), hacia la entrada. */
const C = { x: 46, z: 20 }
const W = 24
const D = 16
const Y = 0.12
const WH = 2.6
const GOLD = '#d9a441'
const RED = '#b9242b'
const NAVY = '#1d2b4a'

/** Textura de mármol: baldosas claras alternadas con vetas suaves. */
function useMarble() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 ? '#f3eee2' : '#dcd3bf'
        g.fillRect(i * 64, j * 64, 64, 64)
        g.strokeStyle = 'rgba(120,105,80,0.22)'
        g.lineWidth = 1
        for (let k = 0; k < 3; k++) {
          g.beginPath()
          g.moveTo(i * 64 + Math.random() * 64, j * 64)
          g.bezierCurveTo(i * 64 + 20, j * 64 + 20, i * 64 + 44, j * 64 + 40, i * 64 + Math.random() * 64, j * 64 + 64)
          g.stroke()
        }
      }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(W / 4, D / 4)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.28, metalness: 0.08 })
  }, [])
}

function Guard({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <group position={[x, Y, z]} rotation={[0, rot, 0]} scale={1.75}>
      <mesh geometry={GEO.capsule} material={mat(NAVY)} position={[0, 0.43, 0]} castShadow />
      <mesh geometry={GEO.box} material={mat(GOLD)} position={[0, 0.5, 0.2]} scale={[0.34, 0.05, 0.02]} />
      <mesh geometry={GEO.sphereSmooth} material={mat('#e0b08a')} position={[0, 0.95, 0]} scale={0.36} castShadow />
      <mesh geometry={GEO.cylinder} material={mat('#10172b')} position={[0, 1.15, 0]} scale={[0.3, 0.1, 0.3]} />
      <mesh geometry={GEO.box} material={mat('#10172b')} position={[0, 1.08, 0.16]} scale={[0.3, 0.03, 0.14]} />
    </group>
  )
}

/** Poste dorado con base. */
function Post({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.cylinder} material={mat(GOLD, { rough: 0.3 })} position={[0, 0.03, 0]} scale={[0.34, 0.06, 0.34]} />
      <mesh geometry={GEO.cylinder} material={mat(GOLD, { rough: 0.3 })} position={[0, 0.45, 0]} scale={[0.09, 0.9, 0.09]} />
      <mesh geometry={GEO.sphereSmooth} material={mat(GOLD, { rough: 0.25 })} position={[0, 0.94, 0]} scale={0.2} />
    </group>
  )
}

/** Cordón rojo entre dos postes (x0,z0) → (x1,z1). */
function Rope({ a, b }: { a: [number, number]; b: [number, number] }) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len = Math.hypot(dx, dz)
  return (
    <mesh geometry={GEO.box} material={mat(RED)} position={[(a[0] + b[0]) / 2, Y + 0.72, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]} scale={[len, 0.07, 0.07]} />
  )
}

/** Boutique abierta hacia `rot`: cuerpo, vitrina de vidrio y rótulo dorado. */
function Boutique({ x, z, rot, w = 4.2, d = 3.6, h = WH }: { x: number; z: number; rot: number; w?: number; d?: number; h?: number }) {
  return (
    <group position={[x, Y, z]} rotation={[0, rot, 0]}>
      <mesh geometry={GEO.box} material={mat('#f4efe4')} position={[0, h / 2, -d / 2 + 0.15]} scale={[w, h, 0.3]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat('#f4efe4')} position={[-w / 2 + 0.1, h / 2, 0]} scale={[0.2, h, d]} castShadow />
      <mesh geometry={GEO.box} material={mat('#f4efe4')} position={[w / 2 - 0.1, h / 2, 0]} scale={[0.2, h, d]} castShadow />
      <mesh geometry={GEO.box} material={mat('#f4efe4')} position={[0, h + 0.1, 0]} scale={[w + 0.2, 0.2, d + 0.1]} castShadow />
      <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.35 })} position={[0, h - 0.35, d / 2 + 0.02]} scale={[w - 0.3, 0.5, 0.08]} />
      <mesh geometry={GEO.box} material={GLASS} position={[0, 0.95, d / 2 - 0.1]} scale={[w - 0.6, 1.7, 0.05]} />
      <mesh geometry={GEO.box} material={mat('#e8dcc0')} position={[0, 0.5, d / 2 - 0.9]} scale={[w - 1.2, 1, 0.6]} />
      <mesh geometry={GEO.box} material={mat('#bfe6f2', { opacity: 0.55 })} position={[0, 1.05, d / 2 - 0.9]} scale={[w - 1.3, 0.12, 0.5]} />
      <mesh geometry={GEO.sphereSmooth} material={mat('#ffe9a8', { emissive: 0.9 })} position={[0, 1.35, d / 2 - 0.9]} scale={0.18} />
    </group>
  )
}

/** Gran pabellón de la galería (solo estructura). */
function Shell() {
  const marble = useMarble()
  const x0 = C.x - W / 2
  const z0 = C.z - D / 2
  const z1 = C.z + D / 2
  const ARCH_HALF = 3
  return (
    <>
      {/* losa de piedra sobre el agua, con borde de cordón */}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[C.x, (Y - 1.5) / 2, C.z]} scale={[W + 3, Y + 1.5, D + 3]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[C.x, -0.9, C.z]} scale={[W + 3.6, 1.2, D + 3.6]} />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[C.x, Y - 0.04, C.z]} scale={[W + 3.1, 0.12, D + 3.1]} />
      {/* piso de mármol, borde dorado y alfombra roja */}
      <mesh geometry={GEO.box} material={marble} position={[C.x, Y + 0.02, C.z]} scale={[W, 0.06, D]} receiveShadow />
      {[
        [C.x, z0 + 0.2, W, 0.3],
        [C.x, z1 - 0.2, W, 0.3],
        [x0 + 0.2, C.z, 0.3, D],
        [x0 + W - 0.2, C.z, 0.3, D],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[x, Y + 0.06, z]} scale={[w, 0.03, d]} />
      ))}
      <mesh geometry={GEO.box} material={mat(RED, { rough: 0.95 })} position={[C.x, Y + 0.08, C.z + 1]} scale={[3, 0.04, D + 2.6]} receiveShadow />
      <mesh geometry={GEO.box} material={mat(GOLD)} position={[C.x - 1.55, Y + 0.09, C.z + 1]} scale={[0.06, 0.03, D + 2.6]} />
      <mesh geometry={GEO.box} material={mat(GOLD)} position={[C.x + 1.55, Y + 0.09, C.z + 1]} scale={[0.06, 0.03, D + 2.6]} />
      {/* muros: fondo, laterales y frente con el hueco del arco */}
      {[
        [C.x, z0 - 0.15, W + 0.6, 0.3, WH],
        [x0 - 0.15, C.z, 0.3, D, WH],
        [x0 + W + 0.15, C.z, 0.3, D, 1.1],
        [C.x - (W / 2 + ARCH_HALF) / 2 - 0.0, z1 + 0.15, W / 2 - ARCH_HALF, 0.3, 1.1],
        [C.x + (W / 2 + ARCH_HALF) / 2, z1 + 0.15, W / 2 - ARCH_HALF, 0.3, 1.1],
      ].map(([x, z, w, d, h], i) => (
        <group key={i}>
          <mesh geometry={GEO.box} material={mat(STONE[1])} position={[x, h / 2, z]} scale={[w, h, d]} castShadow receiveShadow />
          <mesh geometry={GEO.box} material={mat(CORDON)} position={[x, h + 0.05, z]} scale={[w + 0.1, 0.12, d + 0.1]} />
        </group>
      ))}
      {/* arco dorado de entrada (frente sur) */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[C.x + s * (ARCH_HALF - 0.1), (WH + 1.6) / 2, z1 + 0.2]} scale={[0.7, WH + 1.6, 0.7]} castShadow />
          <mesh geometry={GEO.box} material={mat(CORDON)} position={[C.x + s * (ARCH_HALF - 0.1), 0.2, z1 + 0.2]} scale={[1, 0.4, 1]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={mat(GOLD, { rough: 0.3 })} position={[C.x, WH + 1.45, z1 + 0.2]} scale={[ARCH_HALF * 2 + 0.7, 0.55, 0.8]} castShadow />
      <mesh geometry={GEO.box} material={mat('#7a1620')} position={[C.x, WH + 1.45, z1 + 0.62]} scale={[ARCH_HALF * 2 - 0.4, 0.34, 0.05]} />
      <mesh geometry={GEO.sphereSmooth} material={mat('#ffe9a8', { emissive: 0.9 })} position={[C.x, WH + 2.05, z1 + 0.2]} scale={0.4} />
      {/* boutiques: tres a cada lado y dos al fondo */}
      {[0, 1, 2].map((i) => (
        <Boutique key={`l${i}`} x={x0 + 2.4} z={z0 + 2.6 + i * 4.6} rot={Math.PI / 2} />
      ))}
      {[0, 1, 2].map((i) => (
        <Boutique key={`r${i}`} x={x0 + W - 2.4} z={z0 + 2.6 + i * 4.6} rot={-Math.PI / 2} h={1.5} />
      ))}
      {[-1, 1].map((s) => (
        <Boutique key={`b${s}`} x={C.x + s * 5.4} z={z0 + 2} rot={0} w={5.2} d={3.2} />
      ))}
      {/* cordones rojos: pasillo de espera frente al arco */}
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={`p${i}`}>
          <Post x={C.x - 1.6} z={z1 + 1.1 + i * 1.9} />
          <Post x={C.x + 1.6} z={z1 + 1.1 + i * 1.9} />
          {i < 4 && (
            <>
              <Rope a={[C.x - 1.6, z1 + 1.1 + i * 1.9]} b={[C.x - 1.6, z1 + 1.1 + (i + 1) * 1.9]} />
              <Rope a={[C.x + 1.6, z1 + 1.1 + i * 1.9]} b={[C.x + 1.6, z1 + 1.1 + (i + 1) * 1.9]} />
            </>
          )}
        </group>
      ))}
      {/* explanada de acceso (piedra clara) hasta el borde de la losa */}
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[C.x, Y + 0.0, z1 + 5.6]} scale={[7, 0.12, 9.6]} receiveShadow />
      {/* vigilantes a ambos lados de la puerta, mirando hacia el frente */}
      <Guard x={C.x - 2.35} z={z1 + 0.3} rot={0} />
      <Guard x={C.x + 2.35} z={z1 + 0.3} rot={0} />
    </>
  )
}

/** Vista previa 3D de la propuesta A: la Galería de Joyería. */
export function JewelryGallery() {
  const night = useIsNight()
  const title = useMemo(() => getGlassPill('Galería de Joyería', { dot: GOLD, sub: 'Zona exclusiva · vista previa', dark: night }), [night])
  return (
    <group>
      <Batch version="galeria-joyeria">
        <Shell />
      </Batch>
      <ScreenLabel label={title} position={[C.x, 6.4, C.z + 2]} pixelHeight={34} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
      {/* luz cálida sobre la galería, más viva de noche */}
      <pointLight position={[C.x, 4.6, C.z]} color="#ffd98c" intensity={night ? 38 : 10} distance={22} decay={2} />
    </group>
  )
}
