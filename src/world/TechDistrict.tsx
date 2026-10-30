import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { LAYOUT, SPACES, spaceFrontPoint, toWorld } from '../config/mall'
import { Batch } from './Batch'
import { GEO, GLASS, PALETTE, mat } from './materials'
import { glowMat } from './night'

// Pasillo B · Tecnología: piezas low-poly reutilizables para que la zona se lea como distrito
// tecnológico (azul y turquesa, vitrinas con productos reconocibles, pantallas con mensajes cortos y
// guías en el piso). Geometrías y materiales compartidos; todo lo estático va dentro de Batch.

export const TECH = { blue: '#2f6f8f', turquoise: '#2bb3b1', dark: '#1f2933', silver: '#c9ccd1', white: '#f4f6f8' }

const TORUS_HALF = new THREE.TorusGeometry(0.14, 0.026, 6, 14, Math.PI)
const SCREEN_GLOW = () => glowMat('#8fe3f0', 1.3, { dayGlow: 0.55 })

/** Celular de pie sobre un soporte. */
function Phone({ x, color }: { x: number; color: string }) {
  return (
    <group position={[x, 0, 0]} rotation={[-0.25, 0, 0]}>
      <mesh geometry={GEO.rounded} material={mat(color)} position={[0, 0.17, 0]} scale={[0.16, 0.3, 0.03]} />
      <mesh geometry={GEO.plane} material={SCREEN_GLOW()} position={[0, 0.17, 0.017]} scale={[0.13, 0.25, 1]} />
    </group>
  )
}

/** Portátil abierto. */
function Laptop({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={GEO.box} material={mat(TECH.silver)} position={[0, 0.015, 0]} scale={[0.44, 0.03, 0.3]} />
      <group position={[0, 0.03, -0.15]} rotation={[-0.35, 0, 0]}>
        <mesh geometry={GEO.box} material={mat(TECH.silver)} position={[0, 0.14, 0]} scale={[0.44, 0.28, 0.02]} />
        <mesh geometry={GEO.plane} material={SCREEN_GLOW()} position={[0, 0.14, 0.012]} scale={[0.38, 0.22, 1]} />
      </group>
    </group>
  )
}

/** Audífonos de diadema sobre un soporte. */
function Headphones({ x, color }: { x: number; color: string }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={GEO.cylinder} material={mat(TECH.dark)} position={[0, 0.12, 0]} scale={[0.04, 0.24, 0.04]} />
      <mesh geometry={TORUS_HALF} material={mat(color)} position={[0, 0.2, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.cylinder} material={mat(color)} position={[s * 0.14, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.12, 0.05, 0.12]} />
      ))}
    </group>
  )
}

/** Reloj inteligente en un cilindro exhibidor. */
function Watch({ x, color }: { x: number; color: string }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={GEO.cylinder} material={mat(TECH.white)} position={[0, 0.05, 0]} scale={[0.16, 0.1, 0.16]} />
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 0.16, 0]} scale={[0.06, 0.2, 0.05]} />
      <mesh geometry={GEO.rounded} material={mat(TECH.dark)} position={[0, 0.19, 0.03]} scale={[0.12, 0.14, 0.04]} />
      <mesh geometry={GEO.plane} material={SCREEN_GLOW()} position={[0, 0.19, 0.052]} scale={[0.09, 0.1, 1]} />
    </group>
  )
}

/**
 * Mostrador de vitrina con productos tecnológicos (celular, portátil, audífonos, reloj). `width` es
 * el ancho disponible; el mostrador mira hacia +z.
 */
export function TechCounter({ width, accent, bare = false }: { width: number; accent: string; bare?: boolean }) {
  const w = Math.max(1.1, width)
  const step = w / 4
  const x = (i: number) => -w / 2 + step * (i + 0.5)
  return (
    <group>
      {!bare && (
        <>
          <mesh geometry={GEO.box} material={mat(TECH.white)} position={[0, 0.36, 0]} scale={[w, 0.72, 0.5]} />
          <mesh geometry={GEO.box} material={glowMat(TECH.turquoise, 1.2, { dayGlow: 0.35 })} position={[0, 0.66, 0.255]} scale={[w - 0.04, 0.04, 0.01]} />
        </>
      )}
      <group position={[0, bare ? 0 : 0.72, 0]}>
        <Phone x={x(0)} color={TECH.dark} />
        <Laptop x={x(1)} />
        <Headphones x={x(2)} color={accent} />
        <Watch x={x(3)} color={accent} />
      </group>
    </group>
  )
}

// ── Pantallas con mensajes cortos ───────────────────────────────────────────

const screenCache = new Map<string, THREE.CanvasTexture>()
function screenTexture(title: string, sub: string, accent: string) {
  const key = `${title}|${sub}|${accent}`
  const hit = screenCache.get(key)
  if (hit) return hit
  const W = 512
  const H = 288
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#12324a')
  grad.addColorStop(1, '#0d4f5a')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  g.fillStyle = accent
  g.fillRect(0, H - 14, W, 14)
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const font = '"Plus Jakarta Sans", system-ui, sans-serif'
  g.font = `800 ${title.length > 14 ? 58 : 72}px ${font}`
  g.fillText(title, W / 2, H / 2 - 30, W - 40)
  g.font = `600 36px ${font}`
  g.fillStyle = '#9ff0ee'
  g.fillText(sub, W / 2, H / 2 + 46, W - 40)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  screenCache.set(key, t)
  return t
}

export interface ScreenMessage {
  title: string
  sub: string
}

/**
 * Pantalla digital simulada: plano con textura de canvas que rota entre mensajes cada pocos
 * segundos (sin video). De día se ve suave; de noche, brillante pero sin deslumbrar.
 */
export function TechScreen({ messages, width = 1, accent = TECH.turquoise, interval = 4500 }: { messages: ScreenMessage[]; width?: number; accent?: string; interval?: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (messages.length < 2) return
    const id = setInterval(() => setI((v) => (v + 1) % messages.length), interval)
    return () => clearInterval(id)
  }, [messages.length, interval])
  const m = messages[i % Math.max(1, messages.length)] ?? { title: '', sub: '' }
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  material.map = screenTexture(m.title, m.sub, accent)
  material.needsUpdate = true
  const h = width * (288 / 512)
  return (
    <group>
      <mesh geometry={GEO.box} material={mat(TECH.dark)} position={[0, 0, -0.03]} scale={[width + 0.08, h + 0.08, 0.05]} />
      <mesh geometry={GEO.plane} material={material} scale={[width, h, 1]} />
    </group>
  )
}

// ── Piso del pasillo y módulos vacíos ───────────────────────────────────────

/**
 * Guías turquesa en el piso del pasillo de tecnología y un marcador pequeño frente a cada local.
 * Coordenadas del piso 1; `angle` es la orientación del pasillo.
 */
export function TechFloorGuides({ zoneId, angle }: { zoneId: string; angle: number }) {
  const lineMat = glowMat(TECH.turquoise, 0.9, { dayGlow: 0.25 })
  const markMat = glowMat(TECH.turquoise, 1.1, { dayGlow: 0.3 })
  const z0 = LAYOUT.plazaHalf + 0.4
  const z1 = 21.4
  const spaces = SPACES.filter((s) => s.floorId === 'P1' && s.zoneId === zoneId)
  return (
    <Batch version={`guias-${zoneId}`}>
      {[-1, 1].map((s) => {
        const [x, z] = toWorld([s * 4.05, (z0 + z1) / 2], angle)
        return <mesh key={s} geometry={GEO.box} material={lineMat} position={[x, 0.215, z]} rotation={[0, angle, 0]} scale={[0.07, 0.012, z1 - z0]} />
      })}
      {spaces.map((sp) => {
        const [x, z] = spaceFrontPoint(sp, sp.type === 'island' ? 0.45 : 0.55)
        return <mesh key={sp.id} geometry={GEO.box} material={markMat} position={[x, 0.218, z]} rotation={[0, sp.rotation + Math.PI / 4, 0]} scale={[0.32, 0.012, 0.32]} />
      })}
    </Batch>
  )
}

/**
 * Local vacío del pasillo de tecnología, preparado para recibir un comercio: frente de vidrio con
 * puerta, dos exhibidores vacíos y una pantalla «Disponible». La interacción de reclamar no cambia.
 */
export function TechEmptyModule({ w, d, H }: { w: number; d: number; H: number }) {
  const front = d / 2 - 0.2
  const glassW = w * 0.3
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={GLASS} position={[s * (w / 2 - 0.22 - glassW / 2), H / 2, front]} scale={[glassW, H - 0.1, 0.05]} />
          <mesh geometry={GEO.box} material={mat(TECH.white)} position={[s * (w / 2 - 0.22 - glassW / 2), 0.3, front - 0.55]} scale={[glassW * 0.7, 0.6, 0.45]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={mat(PALETTE.trim)} position={[0, H + 0.04, front]} scale={[w - 0.2, 0.12, 0.12]} />
      <mesh geometry={GEO.box} material={glowMat(TECH.turquoise, 0.8, { dayGlow: 0.2 })} position={[0, H - 0.04, front + 0.07]} scale={[w - 0.4, 0.04, 0.02]} />
    </group>
  )
}

/** Kioscos con pantalla a la entrada del pasillo (coordenadas locales del pasillo: x, z). */
export const TECH_KIOSKS: [number, number][] = [
  [-4.25, 8.4],
  [4.25, 8.4],
]
/** Huellas de los kioscos para la navegación (coordenadas del piso 1). */
export function techKioskFootprints(angle: number) {
  return TECH_KIOSKS.map(([x, z]) => {
    const [wx, wz] = toWorld([x, z], angle)
    return { x: wx, z: wz, r: 0.4 }
  })
}

/** Kiosco de pie con una pantalla que mira a la plaza: «Pasillo B · Tecnología», ofertas del día. */
export function TechKiosk({ x, z, angle, messages }: { x: number; z: number; angle: number; messages: ScreenMessage[] }) {
  const [wx, wz] = toWorld([x, z], angle)
  return (
    <group position={[wx, 0.2, wz]} rotation={[0, angle + Math.PI, 0]}>
      <mesh geometry={GEO.box} material={mat(TECH.white)} position={[0, 0.06, 0]} scale={[0.7, 0.12, 0.45]} />
      <mesh geometry={GEO.box} material={mat(TECH.blue)} position={[0, 0.85, -0.05]} scale={[0.16, 1.5, 0.16]} />
      {/* doble cara: se lee desde la plaza y desde el pasillo */}
      <group position={[0, 1.55, 0.05]}>
        <TechScreen messages={messages} width={1.05} />
      </group>
      <group position={[0, 1.55, -0.15]} rotation={[0, Math.PI, 0]}>
        <TechScreen messages={messages} width={1.05} />
      </group>
    </group>
  )
}

/** Todo lo propio del pasillo de tecnología que no pertenece a un local: guías en el piso y kioscos. */
export function TechDistrictDecor({ zoneId, angle, offers }: { zoneId: string; angle: number; offers: ScreenMessage[] }) {
  const messages = useMemo<ScreenMessage[]>(() => [{ title: 'PASILLO B', sub: 'Tecnología · gadgets · accesorios' }, ...offers, { title: 'Tu tienda tech aquí', sub: 'Locales disponibles' }], [offers])
  return (
    <group>
      <TechFloorGuides zoneId={zoneId} angle={angle} />
      {TECH_KIOSKS.map(([x, z]) => (
        <TechKiosk key={x} x={x} z={z} angle={angle} messages={messages} />
      ))}
    </group>
  )
}
