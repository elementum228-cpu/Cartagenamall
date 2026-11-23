import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { LocalDesign, LogoShape, Store } from '../domain/types'
import { GEO, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { readableOn } from './localDesign'

// «Arma tu local»: dibuja un local a partir de su `LocalDesign` (modelo, colores, techo, ventanas, toldo, letrero, pilar con logo, objeto en el
// techo, mesas y maceteros). Es un edificio aislado, como George's: el padre decide posición y giro, y la fachada mira a +z. Todo es low poly.

type V3 = [number, number, number]

export function Bx({ p, s, m, cast = false, r }: { p: V3; s: V3; m: THREE.Material; cast?: boolean; r?: V3 }) {
  return <mesh geometry={GEO.box} material={m} position={p} scale={s} rotation={r} castShadow={cast} />
}

// ── texturas (pequeñas, creadas una vez por diseño) ────────────────────────────────────────────────────────────────────────────────

export function canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat = false) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Nombre del negocio en una franja: letra gruesa, centrada y ajustada al ancho. */
export function nameTexture(name: string, fg: string) {
  return canvasTex(1024, 192, (g) => {
    g.clearRect(0, 0, 1024, 192)
    g.fillStyle = fg
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let size = 128
    const text = name.toUpperCase()
    g.font = `800 ${size}px system-ui, "Segoe UI", sans-serif`
    const w = g.measureText(text).width
    if (w > 920) size = Math.floor((size * 920) / w)
    g.font = `800 ${size}px system-ui, "Segoe UI", sans-serif`
    g.fillText(text, 512, 100)
  })
}

/** Logo del negocio dentro de un disco: la imagen subida o, sin ella, sus letras. */
export function useLogoTexture(store: Pick<Store, 'logo' | 'logoText' | 'brandColor'>, ring: string) {
  const [img, setImg] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!store.logo) return setImg(null)
    let on = true
    let made: THREE.Texture | null = null
    new THREE.TextureLoader().load(store.logo, (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      made = t
      if (on) setImg(t)
    })
    return () => {
      on = false
      made?.dispose()
    }
  }, [store.logo])
  const letters = useMemo(
    () =>
      canvasTex(256, 256, (g) => {
        g.fillStyle = '#fffaf0'
        g.fillRect(0, 0, 256, 256)
        g.fillStyle = store.brandColor || ring
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        const t = (store.logoText || '★').slice(0, 8)
        g.font = `800 ${t.length > 4 ? 64 : t.length > 2 ? 92 : 130}px system-ui, sans-serif`
        g.fillText(t, 128, 136)
      }),
    [store.logoText, store.brandColor, ring],
  )
  useEffect(() => () => letters.dispose(), [letters])
  return img ?? letters
}

export function sideTexture(kind: 'lattice' | 'brick', wall: string, trim: string) {
  const c = new THREE.Color(wall)
  const dark = c.clone().multiplyScalar(0.72).getStyle()
  const light = c.clone().lerp(new THREE.Color('#ffffff'), 0.25).getStyle()
  return canvasTex(
    128,
    128,
    (g) => {
      g.fillStyle = wall
      g.fillRect(0, 0, 128, 128)
      if (kind === 'lattice') {
        g.fillStyle = dark
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) g.fillRect(x * 16 + 4, y * 16 + 4, 8, 8)
      } else {
        g.fillStyle = dark
        for (let row = 0; row < 8; row++) {
          g.fillRect(0, row * 16 + 14, 128, 2)
          const off = row % 2 ? 0 : 32
          for (let x = off; x < 128; x += 64) g.fillRect(x, row * 16, 2, 14)
          g.fillStyle = light
          g.fillRect(2, row * 16 + 2, 60, 3)
          g.fillStyle = dark
        }
      }
      void trim
    },
    true,
  )
}

// ── piezas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Paja: hileras finas (como las capas de un techo de palma) con fibras verticales claras y oscuras. Siempre igual para el mismo color. */
export function strawTexture(base: string) {
  const c = new THREE.Color(base)
  const dark = c.clone().multiplyScalar(0.6).getStyle()
  const mid = c.clone().multiplyScalar(0.82).getStyle()
  const light = c.clone().lerp(new THREE.Color('#fff2cf'), 0.4).getStyle()
  return canvasTex(
    256,
    256,
    (g) => {
      g.fillStyle = c.getStyle()
      g.fillRect(0, 0, 256, 256)
      let seed = 11
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      // hileras: cada capa de paja se solapa con la de arriba
      for (let y = 0; y < 256; y += 16) {
        g.fillStyle = mid
        g.globalAlpha = 0.55
        g.fillRect(0, y, 256, 3)
        g.fillStyle = light
        g.globalAlpha = 0.25
        g.fillRect(0, y + 3, 256, 2)
      }
      g.globalAlpha = 1
      // fibras
      for (let i = 0; i < 700; i++) {
        g.strokeStyle = rnd() > 0.5 ? dark : light
        g.globalAlpha = 0.2 + rnd() * 0.35
        g.lineWidth = 0.8 + rnd() * 1.3
        const x = rnd() * 256
        const y = rnd() * 256
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + (rnd() - 0.5) * 3, y + 6 + rnd() * 14)
        g.stroke()
      }
      g.globalAlpha = 1
    },
    true,
  )
}

/** Flecos de paja: tiras verticales de distinto largo sobre fondo transparente. */
function fringeTexture(base: string) {
  const c = new THREE.Color(base)
  const dark = c.clone().multiplyScalar(0.62).getStyle()
  const light = c.clone().lerp(new THREE.Color('#fff2cf'), 0.25).getStyle()
  return canvasTex(
    256,
    64,
    (g) => {
      g.clearRect(0, 0, 256, 64)
      let seed = 5
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (let i = 0; i < 220; i++) {
        const x = (i / 220) * 256 + rnd() * 2
        const len = 34 + rnd() * 28
        g.strokeStyle = rnd() > 0.45 ? c.getStyle() : rnd() > 0.5 ? dark : light
        g.lineWidth = 1.3 + rnd() * 1.2
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x + (rnd() - 0.5) * 2, len)
        g.stroke()
      }
    },
    true,
  )
}

/** Altura del techo de paja según el ancho del local: siempre alto y empinado, como un bohío. */
export const thatchRise = (w: number) => Math.max(2.8, (w + 1.1) * 0.42)

/** Faldón a cuatro aguas con cumbrera corta: dos trapecios largos y dos triángulos en los extremos. */
function hipGeometry(w: number, d: number, rise: number) {
  const hw = w / 2
  const hd = d / 2
  const alongX = hw >= hd
  const rl = Math.max(0.35, alongX ? hw - hd : hd - hw)
  const T = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, uv: number[]) => ({ p: [ax, ay, az, bx, by, bz, cx, cy, cz], uv })
  const tris: { p: number[]; uv: number[] }[] = []
  const quad = (a: number[], b: number[], c: number[], e: number[], len: number, h: number) => {
    // a,b: base; c,e: cumbrera (c sobre b, e sobre a)
    tris.push(T(...(a as [number, number, number]), ...(b as [number, number, number]), ...(c as [number, number, number]), [0, 0, len, 0, len * 0.85, h]))
    tris.push(T(...(a as [number, number, number]), ...(c as [number, number, number]), ...(e as [number, number, number]), [0, 0, len * 0.85, h, len * 0.15, h]))
  }
  const slope = Math.hypot(rise, alongX ? hd : hw)
  if (alongX) {
    quad([-hw, 0, hd], [hw, 0, hd], [rl, rise, 0], [-rl, rise, 0], w, slope) // frente
    quad([hw, 0, -hd], [-hw, 0, -hd], [-rl, rise, 0], [rl, rise, 0], w, slope) // fondo
    tris.push(T(hw, 0, hd, hw, 0, -hd, rl, rise, 0, [0, 0, d, 0, d / 2, slope]))
    tris.push(T(-hw, 0, -hd, -hw, 0, hd, -rl, rise, 0, [0, 0, d, 0, d / 2, slope]))
  } else {
    quad([hw, 0, hd], [hw, 0, -hd], [0, rise, -rl], [0, rise, rl], d, slope)
    quad([-hw, 0, -hd], [-hw, 0, hd], [0, rise, rl], [0, rise, -rl], d, slope)
    tris.push(T(-hw, 0, hd, hw, 0, hd, 0, rise, rl, [0, 0, w, 0, w / 2, slope]))
    tris.push(T(hw, 0, -hd, -hw, 0, -hd, 0, rise, -rl, [0, 0, w, 0, w / 2, slope]))
  }
  const pos: number[] = []
  const uvs: number[] = []
  for (const t of tris) {
    pos.push(...t.p)
    uvs.push(...t.uv)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.computeVertexNormals()
  return { geo: g, rl, alongX }
}

/**
 * Techo de bohío: pirámide alta de paja (a cuatro aguas) con cumbrera de tronco oscuro y una cortina de flecos en todo el borde.
 * Con `fin`, además lleva la aleta alta de las palapas del Caribe.
 */
export function ThatchRoof({ w, d, y, rise, zc, color, wood, fin = false }: { w: number; d: number; y: number; rise: number; zc: number; color: string; wood: string; fin?: boolean }) {
  const tex = useMemo(() => strawTexture(color), [color])
  const fr = useMemo(() => fringeTexture(color), [color])
  const hip = useMemo(() => hipGeometry(w, d, rise), [w, d, rise])
  useEffect(
    () => () => {
      tex.dispose()
      fr.dispose()
      hip.geo.dispose()
    },
    [tex, fr, hip],
  )
  useEffect(() => {
    tex.repeat.set(w / 3.2, 0.5)
    fr.repeat.set(w / 2.4, 1)
  }, [tex, fr, w])
  const strawM = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }), [tex])
  const fringeM = useMemo(() => new THREE.MeshStandardMaterial({ map: fr, roughness: 1, alphaTest: 0.5, side: THREE.DoubleSide }), [fr])
  const hw = w / 2
  const hd = d / 2
  const drop = 0.85
  // cortina de flecos siguiendo la inclinación del faldón
  const tiltX = Math.atan2(rise, hd) * 0.0
  void tiltX
  const finGeo = useMemo(() => {
    if (!fin) return null
    const s = new THREE.Shape()
    s.moveTo(-1.35, 0)
    s.lineTo(1.35, 0)
    s.quadraticCurveTo(0.7, 1.2, 0.15, 2.3)
    s.lineTo(-0.05, 2.35)
    s.quadraticCurveTo(-0.55, 1.2, -1.35, 0)
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false })
    g.translate(0, 0, -0.25)
    g.rotateY(Math.PI / 2)
    return g
  }, [fin])
  useEffect(() => () => finGeo?.dispose(), [finGeo])
  const ridgeLen = hip.rl * 2 + 0.5
  return (
    <group position={[0, y, zc]}>
      <mesh geometry={hip.geo} material={strawM} castShadow />
      {/* cumbrera: tronco oscuro */}
      <mesh position={[0, rise + 0.06, 0]} rotation={hip.alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, ridgeLen, 8]} />
        <meshStandardMaterial color="#3a2415" roughness={0.9} />
      </mesh>
      {/* flecos en los cuatro lados */}
      {[
        { p: [0, -drop / 2 + 0.04, hd] as V3, r: 0, ww: w },
        { p: [0, -drop / 2 + 0.04, -hd] as V3, r: Math.PI, ww: w },
        { p: [hw, -drop / 2 + 0.04, 0] as V3, r: Math.PI / 2, ww: d },
        { p: [-hw, -drop / 2 + 0.04, 0] as V3, r: -Math.PI / 2, ww: d },
      ].map((f, i) => (
        <mesh key={i} position={f.p} rotation={[0, f.r, 0]} material={fringeM}>
          <planeGeometry args={[f.ww, drop]} />
        </mesh>
      ))}
      {fin && finGeo && (
        <group position={[-hw * 0.15, rise * 0.4, hd * 0.2]} scale={1.45}>
          <mesh geometry={finGeo} material={strawM} castShadow />
          <Bx p={[0.27, 1.0, 0]} s={[0.03, 1.9, 0.9]} m={mat(wood)} />
        </group>
      )}
    </group>
  )
}

/** Marca del negocio: disco, placa cuadrada o (colgante) placa de dos caras que sobresale de la fachada. */
export function LogoMark({ shape, r, tex, rim }: { shape: LogoShape; r: number; tex: THREE.Texture; rim: THREE.Material }) {
  if (shape === 'round') return <Disc r={r} tex={tex} rim={rim} />
  const w = r * 1.75
  return (
    <group>
      <Bx p={[0, 0, 0]} s={[w + 0.16, w + 0.16, 0.14]} m={rim} cast />
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[w, w]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Disc({ r, tex, rim, z = 0 }: { r: number; tex: THREE.Texture; rim: THREE.Material; z?: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={GEO.cylinder} material={rim} rotation={[Math.PI / 2, 0, 0]} scale={[r * 2, 0.16, r * 2]} castShadow />
      <mesh position={[0, 0, 0.09]}>
        <circleGeometry args={[r * 0.88, 28]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Table({ x, z, top, chair }: { x: number; z: number; top: THREE.Material; chair: THREE.Material }) {
  const leg = mat('#2b2420')
  return (
    <group position={[x, 0.08, z]}>
      <mesh geometry={GEO.cylinder} material={top} position={[0, 0.62, 0]} scale={[0.66, 0.06, 0.66]} castShadow />
      <mesh geometry={GEO.cylinderLow} material={leg} position={[0, 0.3, 0]} scale={[0.07, 0.6, 0.07]} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.6, 0, 0.04]} rotation={[0, s * -0.3, 0]}>
          <Bx p={[0, 0.3, 0]} s={[0.36, 0.06, 0.36]} m={chair} cast />
          <Bx p={[0, 0.54, s * 0.16]} s={[0.36, 0.42, 0.05]} m={chair} />
          {[
            [-0.14, -0.14],
            [0.14, -0.14],
            [-0.14, 0.14],
            [0.14, 0.14],
          ].map(([lx, lz]) => (
            <Bx key={`${lx}${lz}`} p={[lx, 0.15, lz]} s={[0.04, 0.3, 0.04]} m={leg} />
          ))}
        </group>
      ))}
    </group>
  )
}

function PizzaSlice() {
  const geo = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-0.85, 0.9)
    sh.lineTo(0.85, 0.9)
    sh.lineTo(0, -1.0)
    sh.closePath()
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false })
    g.translate(0, 0, -0.11)
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group position={[0, 1.15, 0]} rotation={[-0.12, 0.15, 0]}>
      <mesh geometry={geo} material={mat('#f2b441')} castShadow />
      <Bx p={[0, 0.92, 0]} s={[1.9, 0.3, 0.34]} m={mat('#d9a05a')} />
      {[
        [-0.35, 0.45],
        [0.32, 0.4],
        [0.0, -0.05],
        [-0.12, -0.5],
        [0.18, -0.3],
      ].map(([x, y], i) => (
        <mesh key={i} geometry={GEO.cylinder} material={mat('#c8372d')} position={[x, y, 0.13]} rotation={[Math.PI / 2, 0, 0]} scale={[0.3, 0.06, 0.3]} />
      ))}
      <mesh geometry={GEO.cylinder} material={mat('#58b04a')} position={[0.4, 0.05, 0.13]} rotation={[Math.PI / 2, 0, 0]} scale={[0.13, 0.05, 0.13]} />
    </group>
  )
}

/** Objetos que coronan el techo: hechos con formas simples y colores planos. Miden unos 2 m. */
export function TopperModel({ kind, tex, rim, accent, shape = 'round' }: { kind: LocalDesign['topper']; tex: THREE.Texture; rim: THREE.Material; accent: string; shape?: LogoShape }) {
  switch (kind) {
    case 'logo':
      return (
        <group position={[0, 1.15, 0]}>
          <LogoMark shape={shape} r={1.05} tex={tex} rim={rim} />
        </group>
      )
    case 'cap':
      return (
        <group position={[0, 0.2, 0]} rotation={[0, -0.35, 0]}>
          <mesh geometry={GEO.sphereSmooth} material={mat(accent)} position={[0, 0.55, 0]} scale={[2.0, 1.3, 2.0]} castShadow />
          <Bx p={[0, 0.2, 1.05]} s={[1.5, 0.12, 1.1]} m={mat('#f2f2f2')} cast />
          <mesh geometry={GEO.sphere} material={mat('#f2f2f2')} position={[0, 1.2, 0]} scale={0.22} />
          <Bx p={[0, 0.78, 0.98]} s={[0.55, 0.4, 0.04]} m={mat('#fffaf0')} />
        </group>
      )
    case 'burger':
      return (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={GEO.cylinder} material={mat('#e2a24a')} position={[0, 0.12, 0]} scale={[2, 0.24, 2]} castShadow />
          <mesh geometry={GEO.cylinder} material={mat('#7a3b1d')} position={[0, 0.38, 0]} scale={[1.9, 0.26, 1.9]} />
          <mesh geometry={GEO.cylinder} material={mat('#ffd23f')} position={[0, 0.56, 0]} scale={[1.8, 0.06, 1.8]} rotation={[0, 0.8, 0]} />
          <mesh geometry={GEO.cylinder} material={mat('#58b04a')} position={[0, 0.68, 0]} scale={[2.1, 0.12, 2.1]} />
          <mesh geometry={GEO.cylinder} material={mat('#d9432f')} position={[0, 0.82, 0]} scale={[1.8, 0.14, 1.8]} />
          <mesh geometry={GEO.sphereSmooth} material={mat('#e8ad55')} position={[0, 1.02, 0]} scale={[2.0, 0.95, 2.0]} castShadow />
          {[
            [-0.4, 1.46, 0.1],
            [0.3, 1.5, -0.3],
            [0.1, 1.55, 0.4],
            [-0.2, 1.45, -0.5],
            [0.6, 1.36, 0.3],
          ].map(([x, y, z], i) => (
            <Bx key={i} p={[x, y, z]} s={[0.12, 0.05, 0.07]} m={mat('#fff3d6')} r={[0.3, i, 0.2]} />
          ))}
        </group>
      )
    case 'pizza':
      return <PizzaSlice />
    case 'coffee':
      return (
        <group position={[0, 0.1, 0]}>
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.8, 0.58, 1.6, 14]} />
            <meshStandardMaterial color="#f6efe2" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <cylinderGeometry args={[0.82, 0.76, 0.5, 14]} />
            <meshStandardMaterial color={accent} roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.66, 0]}>
            <cylinderGeometry args={[0.86, 0.82, 0.14, 14]} />
            <meshStandardMaterial color="#3b2418" roughness={0.8} />
          </mesh>
          <mesh geometry={GEO.torus} material={mat('#f6efe2')} position={[0.85, 0.85, 0]} scale={[0.4, 0.4, 0.4]} />
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={GEO.sphere} material={mat('#ffffff', { opacity: 0.8 })} position={[Math.sin(i * 2) * 0.18, 2.0 + i * 0.38, 0]} scale={0.34 - i * 0.04} />
          ))}
        </group>
      )
    case 'icecream':
      return (
        <group position={[0, 0.1, 0]}>
          <mesh position={[0, 0.75, 0]} rotation={[Math.PI, 0, 0]} castShadow>
            <coneGeometry args={[0.7, 1.5, 4]} />
            <meshStandardMaterial color="#e2a24a" roughness={0.9} />
          </mesh>
          <mesh geometry={GEO.sphereSmooth} material={mat('#ff9ec4')} position={[0, 1.7, 0]} scale={1.5} castShadow />
          <mesh geometry={GEO.sphereSmooth} material={mat('#8fe0d6')} position={[0.05, 2.35, 0]} scale={1.15} castShadow />
          <mesh geometry={GEO.sphere} material={mat('#d9432f')} position={[0.05, 2.95, 0]} scale={0.3} />
        </group>
      )
    case 'donut':
      return (
        <group position={[0, 1.3, 0]} rotation={[-0.2, 0.2, 0]}>
          <mesh castShadow>
            <torusGeometry args={[0.8, 0.42, 8, 18]} />
            <meshStandardMaterial color="#d9a05a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.18]}>
            <torusGeometry args={[0.8, 0.36, 8, 18]} />
            <meshStandardMaterial color={accent} roughness={0.7} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2
            return <Bx key={i} p={[Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0.54]} s={[0.16, 0.05, 0.05]} m={mat(['#ffffff', '#ffd23f', '#6cc7f0'][i % 3])} r={[0, 0, a * 2]} />
          })}
        </group>
      )
    case 'bag':
      return (
        <group position={[0, 0.1, 0]} rotation={[0, 0.25, 0]}>
          <Bx p={[0, 0.8, 0]} s={[1.5, 1.6, 0.7]} m={mat(accent)} cast />
          <Bx p={[0, 1.6, 0]} s={[1.56, 0.1, 0.76]} m={mat('#ffffff')} />
          <Bx p={[0, 0.85, 0.36]} s={[0.55, 0.55, 0.03]} m={mat('#fffaf0')} />
          <mesh geometry={GEO.torus} material={mat('#2b2420')} position={[0, 1.95, 0]} scale={[0.5, 0.4, 0.5]} />
        </group>
      )
    case 'flower':
      return (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={GEO.cylinderLow} material={mat('#4f9a5e')} position={[0, 0.9, 0]} scale={[0.16, 1.8, 0.16]} />
          <Bx p={[0.5, 0.7, 0]} s={[0.7, 0.14, 0.3]} m={mat('#58b04a')} r={[0, 0, 0.5]} />
          <group position={[0, 2.0, 0]} rotation={[-0.35, 0, 0]}>
            {Array.from({ length: 7 }, (_, i) => {
              const a = (i / 7) * Math.PI * 2
              return <mesh key={i} geometry={GEO.sphere} material={mat(accent)} position={[Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0]} scale={[0.75, 0.75, 0.4]} castShadow />
            })}
            <mesh geometry={GEO.sphere} material={mat('#ffd23f')} position={[0, 0, 0.1]} scale={0.7} />
          </group>
        </group>
      )
    case 'scissors':
      return (
        <group position={[0, 1.2, 0]} rotation={[0, 0.2, 0]} scale={1.3}>
          {[1, -1].map((sg) => (
            <group key={sg} rotation={[0, 0, sg * 0.28]}>
              <mesh position={[0, 0.55, 0]} castShadow>
                <cylinderGeometry args={[0.02, 0.2, 1.8, 4]} />
                <meshStandardMaterial color="#cfd6dc" roughness={0.35} metalness={0.3} />
              </mesh>
              <mesh geometry={GEO.torus} material={mat(accent)} position={[sg * 0.05, -0.75, 0]} scale={[0.34, 0.34, 0.34]} />
            </group>
          ))}
          <mesh geometry={GEO.sphere} material={mat('#8a929a')} position={[0, 0.0, 0.05]} scale={0.18} />
        </group>
      )
    case 'lipstick':
      return (
        <group position={[0, 0.1, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 1.0, 12]} />
            <meshStandardMaterial color="#e6c15a" roughness={0.35} metalness={0.4} />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <cylinderGeometry args={[0.45, 0.5, 0.35, 12]} />
            <meshStandardMaterial color="#2b2020" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.7, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.8, 12]} />
            <meshStandardMaterial color={accent} roughness={0.55} />
          </mesh>
          <Bx p={[0.06, 2.15, 0]} s={[0.76, 0.2, 0.76]} m={mat(accent)} r={[0, 0, -0.5]} />
        </group>
      )
    case 'taco':
      return (
        <group position={[0, 1.1, 0]} rotation={[-0.55, 0.45, 0]} scale={1.25}>
          <mesh rotation={[0, 0, Math.PI]} scale={[1, 1, 1.5]} castShadow>
            <torusGeometry args={[0.95, 0.3, 6, 16, Math.PI]} />
            <meshStandardMaterial color="#f0c15a" roughness={0.9} />
          </mesh>
          {[-0.65, -0.2, 0.25, 0.65].map((x, i) => (
            <mesh key={i} geometry={GEO.sphere} material={mat(['#58b04a', '#d9432f', '#ffd23f', '#58b04a'][i])} position={[x, -0.05 + (i % 2) * 0.1, (i - 1.5) * 0.28]} scale={[0.55, 0.45, 0.5]} />
          ))}
        </group>
      )
    case 'burrito':
      return (
        <group position={[0, 1.0, 0]} rotation={[0, 0.5, -0.25]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 2.3, 12]} />
            <meshStandardMaterial color="#f2dcae" roughness={0.9} />
          </mesh>
          <mesh position={[0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.58, 0.58, 0.7, 12]} />
            <meshStandardMaterial color="#cfd6dc" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[-1.17, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.45, 0.45, 0.05, 12]} />
            <meshStandardMaterial color="#8a4b2a" roughness={0.9} />
          </mesh>
          {[-0.5, 0.1].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.57, 0.57, 0.1, 12]} />
              <meshStandardMaterial color={accent} roughness={0.8} />
            </mesh>
          ))}
        </group>
      )
    case 'chili':
      return (
        <group position={[0, 0.2, 0]} rotation={[0, 0.3, 0]}>
          {Array.from({ length: 7 }, (_, i) => {
            const t = i / 6
            return (
              <mesh key={i} position={[Math.sin(t * 1.6) * 0.75 - 0.1, 0.3 + t * 2.0, 0]} rotation={[0, 0, -t * 0.95 + 0.25]} castShadow>
                <cylinderGeometry args={[0.46 * (1 - t * 0.72), 0.5 * (1 - t * 0.7), 0.5, 8]} />
                <meshStandardMaterial color="#d9322a" roughness={0.5} />
              </mesh>
            )
          })}
          <mesh geometry={GEO.cylinderLow} material={mat('#3f8f3f')} position={[-0.28, 0.2, 0]} rotation={[0, 0, 0.5]} scale={[0.14, 0.5, 0.14]} />
          <mesh geometry={GEO.sphere} material={mat('#3f8f3f')} position={[-0.15, 0.4, 0]} scale={0.34} />
        </group>
      )
    case 'sombrero':
      return (
        <group position={[0, 0.2, 0]} rotation={[-0.12, 0.2, 0]}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[1.6, 1.7, 0.14, 18]} />
            <meshStandardMaterial color="#e2b56a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[1.62, 1.62, 0.05, 18]} />
            <meshStandardMaterial color={accent} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.78, 1.2, 14]} />
            <meshStandardMaterial color="#e2b56a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.8, 0.8, 0.22, 14]} />
            <meshStandardMaterial color={accent} roughness={0.8} />
          </mesh>
          <mesh geometry={GEO.sphere} material={mat('#e2b56a')} position={[0, 1.45, 0]} scale={0.8} />
        </group>
      )
    case 'palm':
      return (
        <group position={[0, 0.1, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[i * 0.1 + 0.05, 0.45 + i * 0.7, 0]} rotation={[0, 0, -0.09]} castShadow>
              <cylinderGeometry args={[0.2 - i * 0.02, 0.26 - i * 0.02, 0.75, 7]} />
              <meshStandardMaterial color={i % 2 ? '#a9794c' : '#946339'} roughness={0.9} />
            </mesh>
          ))}
          <group position={[0.4, 3.0, 0]}>
            {Array.from({ length: 7 }, (_, i) => {
              const a = (i / 7) * Math.PI * 2
              return <Bx key={i} p={[Math.cos(a) * 0.7, -0.15 - (i % 2) * 0.12, Math.sin(a) * 0.7]} s={[1.5, 0.07, 0.42]} m={mat(i % 2 ? '#3f9a4e' : '#58b04a')} r={[0, -a, -0.45]} cast />
            })}
            {[0, 1, 2].map((i) => (
              <mesh key={i} geometry={GEO.sphere} material={mat('#6b4423')} position={[Math.sin(i * 2.1) * 0.22, -0.3, Math.cos(i * 2.1) * 0.22]} scale={0.3} />
            ))}
          </group>
        </group>
      )
    case 'shoe':
      return (
        <group position={[0, 0.1, 0]} rotation={[0, 0.2, 0]}>
          <Bx p={[0, 0.2, 0]} s={[2.4, 0.4, 0.95]} m={mat('#fbf6ea')} cast />
          <Bx p={[-0.55, 0.85, 0]} s={[1.2, 0.95, 0.85]} m={mat(accent)} cast />
          <Bx p={[0.45, 0.58, 0]} s={[1.1, 0.55, 0.85]} m={mat(accent)} r={[0, 0, -0.18]} />
          <mesh geometry={GEO.sphereSmooth} material={mat(accent)} position={[1.0, 0.5, 0]} scale={[0.95, 0.7, 0.85]} />
          <mesh geometry={GEO.sphereSmooth} material={mat('#fbf6ea')} position={[1.12, 0.38, 0]} scale={[0.75, 0.5, 0.9]} />
          {[0, 1, 2].map((i) => (
            <Bx key={i} p={[0.0 + i * 0.28, 1.0 - i * 0.1, 0.44]} s={[0.2, 0.06, 0.04]} m={mat('#fbf6ea')} r={[0, 0, -0.3]} />
          ))}
        </group>
      )
    case 'phone':
      return (
        <group position={[0, 1.1, 0]} rotation={[0, 0.3, 0]}>
          <Bx p={[0, 0, 0]} s={[1.15, 2.1, 0.16]} m={mat('#1d2630')} cast />
          <mesh position={[0, 0, 0.09]}>
            <planeGeometry args={[1.0, 1.9]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.2, 0.1]}>
            <circleGeometry args={[0.3, 16]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          <Bx p={[0, 0.75, 0.1]} s={[0.7, 0.14, 0.01]} m={mat('#ffffff')} />
        </group>
      )
    case 'dumbbell':
      return (
        <group position={[0, 0.85, 0]} rotation={[0, 0.5, 0.15]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 2.6, 8]} />
            <meshStandardMaterial color="#9aa3ab" roughness={0.35} metalness={0.4} />
          </mesh>
          {[-1, 1].map((sg) => (
            <group key={sg}>
              <mesh position={[sg * 0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.62, 0.62, 0.3, 12]} />
                <meshStandardMaterial color="#26313c" roughness={0.6} />
              </mesh>
              <mesh position={[sg * 1.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.46, 0.46, 0.22, 12]} />
                <meshStandardMaterial color={accent} roughness={0.6} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'tshirt':
      return (
        <group position={[0, 0.15, 0]} rotation={[0, 0.25, 0]}>
          <Bx p={[0, 0.85, 0]} s={[1.45, 1.7, 0.3]} m={mat(accent)} cast />
          {[-1, 1].map((sg) => (
            <Bx key={sg} p={[sg * 0.95, 1.55, 0]} s={[0.85, 0.55, 0.3]} m={mat(accent)} r={[0, 0, sg * -0.6]} cast />
          ))}
          <mesh position={[0, 1.68, 0.02]} scale={[1, 1, 1]}>
            <cylinderGeometry args={[0.34, 0.3, 0.32, 10]} />
            <meshStandardMaterial color="#fbf6ea" roughness={0.9} />
          </mesh>
          <mesh geometry={GEO.cylinder} material={mat('#1d1713')} position={[0, 1.7, 0.1]} rotation={[Math.PI / 2, 0, 0]} scale={[0.5, 0.06, 0.4]} />
          <Bx p={[0, 0.9, 0.17]} s={[0.55, 0.5, 0.03]} m={mat('#fffaf0')} />
        </group>
      )
    case 'baby': {
      const soft = '#cfeaf7'
      return (
        <group position={[0, 0.15, 0]} rotation={[0, 0.25, 0]}>
          <Bx p={[0, 0.95, 0]} s={[1.1, 1.0, 0.28]} m={mat(soft)} cast />
          {[-1, 1].map((sg) => (
            <Bx key={sg} p={[sg * 0.68, 1.3, 0]} s={[0.5, 0.36, 0.26]} m={mat(soft)} r={[0, 0, sg * -0.5]} />
          ))}
          {[-1, 1].map((sg) => (
            <Bx key={sg} p={[sg * 0.3, 0.3, 0]} s={[0.48, 0.55, 0.26]} m={mat(soft)} cast />
          ))}
          <Bx p={[0, 0.0, 0.0]} s={[1.1, 0.12, 0.28]} m={mat(accent)} />
          <mesh geometry={GEO.cylinder} material={mat(accent)} position={[0, 1.42, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[0.55, 0.08, 0.35]} />
          {[-0.3, 0, 0.3].map((x) => (
            <mesh key={x} geometry={GEO.sphere} material={mat('#fffaf0')} position={[x, 0.62, 0.15]} scale={0.1} />
          ))}
          <mesh geometry={GEO.sphere} material={mat('#ffd23f')} position={[0, 1.0, 0.16]} scale={0.34} />
        </group>
      )
    }
    case 'pants':
      return (
        <group position={[0, 0.15, 0]} rotation={[0, 0.25, 0]}>
          {[-1, 1].map((sg) => (
            <Bx key={sg} p={[sg * 0.36, 0.85, 0]} s={[0.66, 1.8, 0.32]} m={mat('#2f5f9e')} r={[0, 0, sg * -0.04]} cast />
          ))}
          <Bx p={[0, 1.82, 0]} s={[1.5, 0.34, 0.34]} m={mat('#2f5f9e')} cast />
          <Bx p={[0, 1.82, 0.01]} s={[1.52, 0.1, 0.36]} m={mat('#4a2f1d')} />
          <Bx p={[0, 1.82, 0.18]} s={[0.16, 0.14, 0.03]} m={mat('#e6c15a')} />
          {[-1, 1].map((sg) => (
            <Bx key={sg} p={[sg * 0.55, 1.45, 0.17]} s={[0.4, 0.36, 0.02]} m={mat('#3d74bd')} r={[0, 0, sg * 0.12]} />
          ))}
          <Bx p={[0, 0.9, 0.17]} s={[0.04, 1.2, 0.02]} m={mat('#e6c15a')} />
        </group>
      )
    case 'dress':
      return (
        <group position={[0, 0.15, 0]} rotation={[0, 0.25, 0]}>
          <mesh position={[0, 0.65, 0]} castShadow>
            <cylinderGeometry args={[0.42, 1.0, 1.3, 12]} />
            <meshStandardMaterial color={accent} roughness={0.85} />
          </mesh>
          <Bx p={[0, 1.6, 0]} s={[0.8, 0.7, 0.28]} m={mat(accent)} cast />
          {[-1, 1].map((sg) => (
            <Bx key={sg} p={[sg * 0.22, 2.1, 0]} s={[0.1, 0.4, 0.1]} m={mat(accent)} />
          ))}
          <mesh geometry={GEO.cylinder} material={mat('#fffaf0')} position={[0, 1.2, 0]} scale={[0.86, 0.1, 0.86]} />
          <mesh geometry={GEO.sphere} material={mat('#fffaf0')} position={[0.1, 1.2, 0.46]} scale={0.22} />
        </group>
      )
    case 'hanger':
      return (
        <group position={[0, 1.2, 0]} rotation={[0, 0.3, 0]}>
          <mesh geometry={GEO.torus} material={mat('#cfd6dc')} position={[0, 1.05, 0]} rotation={[0, 0, 0]} scale={[0.22, 0.22, 0.22]} />
          <Bx p={[0, 0.7, 0]} s={[0.07, 0.4, 0.07]} m={mat('#cfd6dc')} />
          {[-1, 1].map((sg) => (
            <Bx key={sg} p={[sg * 0.62, 0.3, 0]} s={[1.4, 0.09, 0.09]} m={mat('#cfd6dc')} r={[0, 0, -sg * 0.36]} />
          ))}
          <Bx p={[0, -0.12, 0]} s={[2.1, 0.1, 0.1]} m={mat('#cfd6dc')} />
        </group>
      )
    case 'dressshoe':
      return (
        <group position={[0, 0.1, 0]} rotation={[0, 0.2, 0]}>
          <Bx p={[0, 0.1, 0]} s={[2.5, 0.2, 0.9]} m={mat('#2a1a10')} cast />
          <Bx p={[-0.95, 0.04, 0]} s={[0.55, 0.12, 0.85]} m={mat('#1a100a')} />
          <Bx p={[-0.45, 0.75, 0]} s={[1.3, 1.0, 0.8]} m={mat('#7a3f1d')} cast />
          <Bx p={[0.55, 0.45, 0]} s={[1.1, 0.5, 0.82]} m={mat('#7a3f1d')} r={[0, 0, -0.12]} />
          <mesh geometry={GEO.sphereSmooth} material={mat('#7a3f1d')} position={[1.05, 0.38, 0]} scale={[0.9, 0.62, 0.84]} />
          {[0, 1, 2].map((i) => (
            <Bx key={i} p={[0.1 + i * 0.28 - 0.4, 0.98 - i * 0.12, 0.42]} s={[0.2, 0.05, 0.03]} m={mat('#f2e6cd')} r={[0, 0, -0.2]} />
          ))}
        </group>
      )
    case 'heel':
      return (
        <group position={[0, 0.1, 0]} rotation={[0, 0.2, 0]}>
          <Bx p={[0.1, 1.1, 0]} s={[2.0, 0.14, 0.7]} m={mat(accent)} r={[0, 0, -0.38]} cast />
          <Bx p={[-0.75, 0.55, 0]} s={[0.55, 1.15, 0.65]} m={mat(accent)} cast />
          <Bx p={[-0.78, 0.42, 0]} s={[0.1, 0.9, 0.1]} m={mat('#2b2420')} />
          <mesh geometry={GEO.sphereSmooth} material={mat(accent)} position={[0.95, 0.3, 0]} scale={[0.75, 0.38, 0.7]} />
          <Bx p={[0.5, 0.68, 0]} s={[0.8, 0.08, 0.7]} m={mat('#2b2420')} r={[0, 0, -0.5]} />
        </group>
      )
    case 'soccer':
      return (
        <group position={[0, 1.05, 0]}>
          <mesh geometry={GEO.sphereSmooth} material={mat('#fbf6ea')} scale={2.0} castShadow />
          {[
            [0, 1, 0],
            [0.95, 0.35, 0],
            [-0.95, 0.35, 0],
            [0.3, 0.35, 0.9],
            [-0.3, 0.35, 0.9],
            [0, -0.5, 0.88],
            [0.6, -0.4, -0.7],
            [-0.6, -0.4, -0.7],
          ].map(([x, y, z], i) => {
            const v = new THREE.Vector3(x, y, z).normalize().multiplyScalar(1.0)
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize())
            return <mesh key={i} geometry={GEO.sphere} material={mat('#1d1713')} position={v.toArray()} quaternion={q} scale={[0.5, 0.5, 0.18]} />
          })}
        </group>
      )
    case 'basketball':
      return (
        <group position={[0, 1.05, 0]} rotation={[0.3, 0.4, 0]}>
          <mesh geometry={GEO.sphereSmooth} material={mat('#e8651f')} scale={2.0} castShadow />
          {[0, Math.PI / 2].map((r) => (
            <mesh key={r} geometry={GEO.torus} material={mat('#1d1713')} rotation={[0, r, 0]} scale={[1.0, 1.0, 1.0]} />
          ))}
          <mesh geometry={GEO.torus} material={mat('#1d1713')} rotation={[Math.PI / 2, 0, 0]} scale={[1.0, 1.0, 1.0]} />
          <Bx p={[0, 0, 0]} s={[2.02, 0.06, 0.06]} m={mat('#1d1713')} />
        </group>
      )
    default:
      return null
  }
}

/** Bohío abierto: postes de madera, vigas y una barra al fondo. Las mesas van dentro, bajo el techo. */
function OpenPavilion({ W, zB, zF, H, wood, wall }: { W: number; zB: number; zF: number; H: number; wood: string; wall: string; wall2: string }) {
  const post = mat(wood)
  const xs = [-W / 2 + 0.3, 0, W / 2 - 0.3]
  return (
    <>
      {[zF - 0.25, zB + 0.3].flatMap((z) =>
        xs.map((x) => (
          <group key={`${x}${z}`}>
            <mesh geometry={GEO.cylinderLow} material={post} position={[x, H / 2 + 0.12, z]} scale={[0.26, H, 0.26]} castShadow />
            <Bx p={[x, 0.22, z]} s={[0.5, 0.2, 0.5]} m={mat('#a8a8a2')} />
            <mesh geometry={GEO.cylinderLow} material={mat('#efe6d2')} position={[x, 0.5, z]} scale={[0.33, 0.2, 0.33]} />
          </group>
        )),
      )}
      {[zF - 0.25, zB + 0.3].map((z) => (
        <Bx key={z} p={[0, H + 0.0, z]} s={[W, 0.22, 0.26]} m={post} cast />
      ))}
      {[-W / 2 + 0.3, W / 2 - 0.3].map((x) => (
        <Bx key={x} p={[x, H + 0.0, (zF + zB) / 2 + 0.03]} s={[0.26, 0.22, zF - zB - 0.5]} m={post} />
      ))}
      {/* barra al fondo */}
      <Bx p={[0, 0.65, zB + 0.62]} s={[W - 1.4, 1.05, 0.55]} m={mat(wall)} cast />
      <Bx p={[0, 1.2, zB + 0.62]} s={[W - 1.3, 0.1, 0.65]} m={post} />
      <Bx p={[0, 1.55, zB + 0.2]} s={[W - 1.4, 0.9, 0.08]} m={mat('#4a2f1d')} />
    </>
  )
}

export interface CustomStoreProps {
  store: Pick<Store, 'name' | 'logo' | 'logoText' | 'brandColor' | 'accentColor'>
  design: LocalDesign
  /** Huella del local (m): 6 × 5 en los locales normales. */
  width?: number
  depth?: number
  interactive?: boolean
  onOpen?: () => void
  /** Solo en la vista previa: quita el techo para ver lo de adentro. */
  cutaway?: boolean
}

export function CustomStore({ store, design: d, width: W = 6, depth: D = 5, interactive = true, onOpen, cutaway = false }: CustomStoreProps) {
  const x0 = -W / 2
  const x1 = W / 2
  const zB = -D / 2
  const open = d.windows === 'open' // sin paredes: bohío con postes
  const zF = D / 2 - (open ? 0.5 : 1.3) // fachada del edificio; delante queda la terraza
  const zc = (zB + zF) / 2
  const H = 3.6
  const G = 2.35 // alto de las vitrinas
  const dead = (zF - zB) / 2 + 0.25
  const stripes = Math.round(W * 1.6)
  const bushes = Math.max(3, Math.round(W * 0.9))

  const wall = mat(d.wall)
  const trim = mat(d.trim)
  const roofM = mat(d.roofColor)
  const awnM = mat(d.awningColor)
  const white = mat('#fbf6ea')
  const glass = glowMat(d.lights ? '#ffd9a0' : '#a7c7d8', d.lights ? 2.0 : 1.2, { dayGlow: d.lights ? 0.25 : 0.1 })
  const frame = mat('#1d1713')
  const logoTex = useLogoTexture(store, d.trim)
  const nameTex = useMemo(() => nameTexture(store.name, readableOn(d.trim)), [store.name, d.trim])
  const sideTex = useMemo(() => (d.side === 'plain' ? null : sideTexture(d.side, d.wall, d.trim)), [d.side, d.wall, d.trim])
  useEffect(() => () => nameTex.dispose(), [nameTex])
  useEffect(
    () => () => {
      sideTex?.dispose()
    },
    [sideTex],
  )
  useEffect(() => {
    if (sideTex) sideTex.repeat.set((zF - zB) / 1.2, (H - 0.4) / 1.2)
  }, [sideTex, zF, zB])

  // altura de la superficie del techo, para apoyar el objeto que lo corona
  const isThatch = d.roof === 'thatch' || d.roof === 'thatchfin'
  const rise = d.roof === 'gable' ? 1.3 : d.roof === 'shed' ? 1.0 : isThatch ? thatchRise(W) : 0
  const roofTop = d.roof === 'gable' || isThatch ? H + rise : d.roof === 'shed' ? H + rise * 0.5 : H + 0.16
  const pillarX = d.logoSide === 'left' ? x0 + 0.45 : d.logoSide === 'right' ? x1 - 0.45 : 0
  const topper = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (topper.current) topper.current.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.12
  })

  const gableShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-dead, 0)
    s.lineTo(dead, 0)
    s.lineTo(0, 1.3)
    s.closePath()
    const g = new THREE.ShapeGeometry(s)
    g.rotateY(-Math.PI / 2)
    return g
  }, [dead])
  const shedShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-dead, 0)
    s.lineTo(dead, 0)
    s.lineTo(-dead, 1.0)
    s.closePath()
    const g = new THREE.ShapeGeometry(s)
    g.rotateY(-Math.PI / 2)
    return g
  }, [dead])
  useEffect(
    () => () => {
      gableShape.dispose()
      shedShape.dispose()
    },
    [gableShape, shedShape],
  )

  // ventanas
  const winN = d.windows === 'wide' ? 1 : 3
  const usable = W - 1.2 - (d.logoSide === 'none' ? 0 : 0.9)
  const cx = d.logoSide === 'left' ? 0.45 : d.logoSide === 'right' ? -0.45 : 0
  const paneW = d.windows === 'wide' ? usable : (usable - 0.4) / 3
  const panes = Array.from({ length: winN }, (_, i) => (d.windows === 'wide' ? cx : cx - usable / 2 + paneW / 2 + i * (paneW + 0.2)))

  return (
    <group
      userData={{ storeId: 'custom' }}
      onClick={
        interactive && onOpen
          ? (e) => {
              if (e.delta > 8) return
              e.stopPropagation()
              onOpen()
            }
          : undefined
      }
      onPointerOver={interactive ? (e) => (e.stopPropagation(), (document.body.style.cursor = 'pointer')) : undefined}
      onPointerOut={interactive ? () => (document.body.style.cursor = '') : undefined}
    >
      {interactive && (
        <mesh position={[0, 2, 0]} visible={false}>
          <boxGeometry args={[W, 4, D]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* cuerpo y base */}
      <Bx p={[0, 0.06, (zB + D / 2) / 2]} s={[W, 0.12, D / 2 - zB]} m={mat(open ? '#7a3434' : '#d8c9a8')} />
      {!open && <Bx p={[0, H / 2 + 0.12, zc]} s={[W, H, zF - zB]} m={wall} cast />}
      {!open && <Bx p={[0, 0.3, zF + 0.04]} s={[W + 0.08, 0.36, 0.1]} m={trim} />}
      {open && <OpenPavilion W={W} zB={zB} zF={zF} H={H} wood={d.trim} wall={d.wall} wall2={d.wall} />}

      {/* costados: liso, calado o ladrillo */}
      {sideTex && !open &&
        [x0, x1].map((x) => (
          <mesh key={x} position={[x + (x > 0 ? 0.012 : -0.012), H / 2 + 0.12, zc]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[zF - zB, H - 0.4]} />
            <meshStandardMaterial map={sideTex} roughness={0.9} />
          </mesh>
        ))}

      <group visible={!cutaway}>
      {/* techo */}
      {d.roof === 'flat' || d.roof === 'cornice' ? (
        <>
          <Bx p={[0, H + 0.12 + 0.07, zc]} s={[W + 0.1, 0.14, zF - zB + 0.1]} m={roofM} />
          {[
            [0, zF + 0.02, W + 0.3, 0.12],
            [0, zB, W + 0.3, 0.12],
          ].map(([x, z, w, t], i) => (
            <Bx key={i} p={[x, H + 0.4, z]} s={[w, 0.5, t]} m={trim} />
          ))}
          {[x0 - 0.07, x1 + 0.07].map((x) => (
            <Bx key={x} p={[x, H + 0.4, zc]} s={[0.12, 0.5, zF - zB + 0.14]} m={trim} />
          ))}
          {d.roof === 'cornice' && <Bx p={[0, H - 0.05, zF + 0.28]} s={[W + 0.3, 0.3, 0.6]} m={trim} cast />}
          {[
            [-1.0, zB + 0.9],
            [1.0, zB + 0.9],
          ].map(([x, z], i) => (
            <Bx key={i} p={[x, H + 0.5, z]} s={[0.7, 0.4, 0.7]} m={mat('#c9c2b8')} />
          ))}
        </>
      ) : d.roof === 'gable' ? (
        <>
          {[1, -1].map((sgn) => (
            <Bx key={sgn} p={[0, H + 0.12 + 0.65 + 0.07, zc + sgn * (dead / 2)]} s={[W + 0.5, 0.16, Math.hypot(dead, 1.3) + 0.05]} m={roofM} r={[sgn * Math.atan2(1.3, dead), 0, 0]} cast />
          ))}
          {!open && [x0, x1].map((x) => (
            <mesh key={x} geometry={gableShape} material={wall} position={[x, H + 0.12, zc]} />
          ))}
        </>
      ) : d.roof === 'shed' ? (
        <>
          <Bx p={[0, H + 0.12 + 0.5 + 0.07, zc]} s={[W + 0.5, 0.16, Math.hypot(dead, 1.0) + 0.05]} m={roofM} r={[Math.atan2(1.0, dead), 0, 0]} cast />
          {!open && [x0, x1].map((x) => (
            <mesh key={x} geometry={shedShape} material={wall} position={[x, H + 0.12, zc]} />
          ))}
        </>
      ) : (
        <ThatchRoof w={W + 1.1} d={zF - zB + 1.1} y={H + 0.12} rise={rise} zc={zc} color={d.roofColor} wood={d.trim} fin={d.roof === 'thatchfin'} />
      )}
      </group>

      {/* vitrinas con marco */}
      {!open && panes.map((x, i) => (
        <group key={i} position={[x, 0, zF + 0.03]}>
          <Bx p={[0, 0.12 + 0.45 + (G - 0.45) / 2, 0]} s={[paneW + 0.16, G - 0.45 + 0.16, 0.06]} m={frame} />
          <Bx p={[0, 0.12 + 0.45 + (G - 0.45) / 2, 0.035]} s={[paneW, G - 0.45, 0.04]} m={glass} />
          {d.windows === 'arched' && (
            <>
              <mesh geometry={GEO.cylinder} material={frame} position={[0, G + 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[paneW + 0.16, 0.06, paneW + 0.16]} />
              <mesh geometry={GEO.cylinder} material={glass} position={[0, G + 0.12, 0.035]} rotation={[Math.PI / 2, 0, 0]} scale={[paneW, 0.04, paneW]} />
            </>
          )}
          {d.windows === 'wide' && (
            <>
              <Bx p={[-paneW / 6, 1.45, 0.07]} s={[0.07, G - 0.45, 0.03]} m={frame} />
              <Bx p={[paneW / 6, 1.45, 0.07]} s={[0.07, G - 0.45, 0.03]} m={frame} />
            </>
          )}
        </group>
      ))}
      {/* letrero: franja con el nombre sobre las vitrinas, o cartel sobre el techo */}
      {d.sign === 'band' && (
        <group position={[0, 0, zF + 0.05]}>
          <Bx p={[0, G + 0.65, 0.02]} s={[W - 0.4, 0.95, 0.1]} m={trim} />
          <mesh position={[cx * 0.4, G + 0.62, 0.09]}>
            <planeGeometry args={[W - 1.4, 0.85 * 0.9 * 0.75]} />
            <meshBasicMaterial map={nameTex} transparent toneMapped={false} />
          </mesh>
        </group>
      )}
      {d.sign === 'board' && (
        <group position={[0, H + 0.12, zF + 0.1]}>
          <Bx p={[-W * 0.28, 0.35, -0.02]} s={[0.1, 0.7, 0.1]} m={frame} />
          <Bx p={[W * 0.28, 0.35, -0.02]} s={[0.1, 0.7, 0.1]} m={frame} />
          <Bx p={[0, 1.05, 0]} s={[W * 0.7, 0.95, 0.14]} m={trim} cast />
          <mesh position={[0, 1.05, 0.08]}>
            <planeGeometry args={[W * 0.7 - 0.3, 0.7]} />
            <meshBasicMaterial map={nameTex} transparent toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* pilar con el logo en el costado de la fachada */}
      {d.logoSide !== 'none' && (
        <group position={[pillarX, 0, 0]}>
          <Bx p={[0, (H + 0.9) / 2 + 0.12, zF + 0.1]} s={[0.9, H + 0.9, 0.3]} m={wall} cast />
          <Bx p={[0, H + 0.95, zF + 0.1]} s={[1.0, 0.1, 0.4]} m={trim} />
          {d.logoShape === 'hanging' ? (
            <group position={[pillarX > 0 ? 0.55 : -0.55, 0, zF + 0.1]}>
              <Bx p={[0, 2.9, 0.55]} s={[0.08, 0.08, 1.1]} m={frame} />
              <Bx p={[0, 2.35, 1.0]} s={[0.05, 0.5, 0.05]} m={frame} />
              <group position={[0, 2.0, 1.0]} rotation={[0, Math.PI / 2, 0]}>
                <LogoMark shape="square" r={0.45} tex={logoTex} rim={trim} />
                <group rotation={[0, Math.PI, 0]}>
                  <LogoMark shape="square" r={0.45} tex={logoTex} rim={trim} />
                </group>
              </group>
            </group>
          ) : (
            <group position={[0, H + 1.8, zF + 0.1]}>
              <LogoMark shape={d.logoShape} r={0.85} tex={logoTex} rim={trim} />
            </group>
          )}
          {[-0.2, 0, 0.2].map((x) => (
            <Bx key={x} p={[x, 1.3, zF + 0.27]} s={[0.04, 1.6, 0.02]} m={awnM} />
          ))}
        </group>
      )}

      {/* toldo sobre las vitrinas */}
      {d.awning !== 'none' && (
        <group position={[0, G + 0.3, zF]}>
          {d.awning === 'flat' ? (
            <>
              <Bx p={[0, 0.0, 0.4]} s={[W - 0.2, 0.1, 0.8]} m={awnM} cast />
              <Bx p={[0, -0.04, 0.8]} s={[W - 0.2, 0.16, 0.06]} m={trim} />
            </>
          ) : (
            <>
              {Array.from({ length: stripes }, (_, i) => {
                const w = (W - 0.2) / stripes
                return <Bx key={i} p={[x0 + 0.1 + w * (i + 0.5), -0.05, 0.42]} s={[w, 0.07, 0.9]} m={i % 2 ? white : awnM} r={[0.3, 0, 0]} cast />
              })}
              {d.awning === 'scalloped' &&
                Array.from({ length: stripes }, (_, i) => {
                  const w = (W - 0.2) / stripes
                  return <mesh key={i} geometry={GEO.cylinder} material={i % 2 ? white : awnM} position={[x0 + 0.1 + w * (i + 0.5), -0.27, 0.84]} rotation={[Math.PI / 2, 0, 0]} scale={[w, 0.07, w]} />
                })}
            </>
          )}
        </group>
      )}

      {/* objeto sobre el techo */}
      {d.topper !== 'none' && !cutaway && (
        <group position={[d.logoSide === 'none' ? 0 : -pillarX * 0.9, roofTop + (d.sign === 'board' ? 0 : 0), zc - 0.2]} scale={1}>
          <group ref={topper} scale={1.5}>
            <TopperModel kind={d.topper} tex={logoTex} rim={trim} accent={d.awningColor} shape={d.logoShape} />
          </group>
        </group>
      )}

      {/* terraza: tarima, mesas y maceteros */}
      <Bx p={[0, 0.07, (zF + D / 2) / 2]} s={[W, 0.1, D / 2 - zF]} m={mat('#b98a5c')} />
      {open
        ? Array.from({ length: d.tables }, (_, i) => {
            // adentro del bohío: dos filas de mesas bajo el techo
            const perRow = Math.ceil(d.tables / 2)
            const row = i < perRow ? 0 : 1
            const k = row === 0 ? i : i - perRow
            const n = row === 0 ? perRow : d.tables - perRow
            const span = Math.min(W - 2.2, n * 1.9)
            const x = n === 1 ? 0 : -span / 2 + (span / (n - 1)) * k
            return <Table key={i} x={x} z={row === 0 ? zc - 0.5 : zc + 1.0} top={mat('#c79a68')} chair={mat('#7a4a2a')} />
          })
        : Array.from({ length: Math.min(d.tables, 3) }, (_, i) => {
            const t = Math.min(d.tables, 3)
            const span = t === 1 ? 0 : t === 2 ? 2.8 : 3.6
            const x = t === 1 ? 0 : -span / 2 + (span / (t - 1)) * i
            return <Table key={i} x={x} z={zF + 0.95} top={mat('#f2e6cd')} chair={mat(d.awningColor)} />
          })}
      {d.planters && open && (
        <>
          {[x0 + 0.5, x1 - 0.5, 0].map((x, i) => (
            <group key={i} position={[x, 0.12, zF - 0.1]}>
              <mesh position={[0, 0.4, 0]} castShadow>
                <cylinderGeometry args={[0.34, 0.24, 0.8, 6]} />
                <meshStandardMaterial color="#e9e6e0" roughness={0.8} />
              </mesh>
              {Array.from({ length: 6 }, (_, k) => {
                const a = (k / 6) * Math.PI * 2
                return <Bx key={k} p={[Math.cos(a) * 0.3, 1.0, Math.sin(a) * 0.3]} s={[0.1, 0.8, 0.28]} m={mat(k % 2 ? '#3f9a4e' : '#58b04a')} r={[Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5]} />
              })}
            </group>
          ))}
        </>
      )}
      {d.planters && !open && (
        <>
          <Bx p={[0, 0.25, D / 2 - 0.1]} s={[W - 0.3, 0.3, 0.3]} m={trim} />
          {Array.from({ length: bushes }, (_, i) => (
            <mesh key={i} geometry={GEO.sphere} material={mat(i % 2 ? '#4f9a5e' : '#3f8650')} position={[x0 + 0.5 + ((W - 1) / (bushes - 1)) * i, 0.62, D / 2 - 0.1]} scale={[0.66, 0.5, 0.46]} castShadow />
          ))}
        </>
      )}
      {d.lights && open && (
        <>
          {[-W / 3, 0, W / 3].map((x) => (
            <group key={x} position={[x, H - 0.1, zc]}>
              <mesh geometry={GEO.cylinderLow} material={frame} position={[0, -0.25, 0]} scale={[0.02, 0.5, 0.02]} />
              <mesh geometry={GEO.sphere} material={glowMat('#ffd9a0', 2.4, { dayGlow: 0.25 })} position={[0, -0.6, 0]} scale={[0.5, 0.6, 0.5]} />
            </group>
          ))}
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffc97a', 0.9)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, zc]} scale={[W + 1, D, 1]} />
        </>
      )}
      {d.lights && !open && (
        <>
          {[x0 + 0.1, x1 - 0.1].map((px) => (
            <group key={px} position={[px, 0.12, D / 2 - 0.12]}>
              <mesh geometry={GEO.cylinderLow} material={frame} position={[0, 0.95, 0]} scale={[0.05, 1.9, 0.05]} />
              <mesh geometry={GEO.sphere} material={glowMat('#fff0c8', 2.6, { dayGlow: 0.4 })} position={[0, 1.95, 0]} scale={0.22} />
            </group>
          ))}
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffc97a', 1.1)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, D / 2 + 0.2]} scale={[W + 3, 4, 1]} />
        </>
      )}
    </group>
  )
}
