import { useMemo } from 'react'
import * as THREE from 'three'
import { GEO, mat } from './materials'
import { glowMat } from './night'

// Local outlet de la Isla de los Descuentos (vacío, disponible): pabellón de color con techo, toldo
// a rayas, vitrina encendida y un cartel del %. Coordenadas del local: fachada hacia +z.

const PALETTES = [
  { wall: '#8b5cf6', roof: '#3b2a6b', awning: '#f2b134' },
  { wall: '#e85a8a', roof: '#4a2440', awning: '#ffffff' },
  { wall: '#f59e0b', roof: '#5a3410', awning: '#e04b4b' },
  { wall: '#13b9ad', roof: '#0d3a40', awning: '#ffffff' },
  { wall: '#4f6bd8', roof: '#1e2a5a', awning: '#f2b134' },
  { wall: '#c04ad6', roof: '#3e1a48', awning: '#ffffff' },
  { wall: '#e04b4b', roof: '#4a1616', awning: '#f2b134' },
]

let pctMaterial: THREE.MeshBasicMaterial | null = null
function pctMat() {
  if (!pctMaterial) {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#e8285a'
    g.beginPath()
    g.roundRect(0, 0, 256, 256, 36)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = '900 190px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('%', 128, 140)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    pctMaterial = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  }
  return pctMaterial
}

export function OutletModule({ w, d, seed }: { w: number; d: number; seed: number }) {
  const p = PALETTES[seed % PALETTES.length]
  const H = 2.8
  const wall = mat(p.wall, { rough: 0.6 })
  const shop = useMemo(() => glowMat('#ffd9a0', 1.7, { dayGlow: 0.25 }), [])
  const stripes = 7
  // el cuerpo ocupa el fondo; el frente queda libre para el cartel «Tu negocio aquí»
  const bodyD = d * 0.6
  const bz = -d / 2 + bodyD / 2
  return (
    <group>
      {/* cuerpo de color y techo plano con cornisa */}
      <mesh geometry={GEO.box} material={wall} position={[0, H / 2, bz]} scale={[w - 0.2, H, bodyD]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(p.roof)} position={[0, H + 0.1, bz]} scale={[w + 0.1, 0.2, bodyD + 0.2]} castShadow />
      {/* vitrina encendida al frente del cuerpo */}
      <mesh geometry={GEO.box} material={shop} position={[0, 1.15, bz + bodyD / 2 + 0.02]} scale={[w - 1.4, 1.5, 0.04]} />
      <mesh geometry={GEO.box} material={mat('#2f3437')} position={[0, 1.15, bz + bodyD / 2 + 0.05]} scale={[0.08, 1.5, 0.04]} />
      {/* toldo a rayas inclinado */}
      <group position={[0, 2.25, bz + bodyD / 2 + 0.45]} rotation={[0.45, 0, 0]}>
        {Array.from({ length: stripes }, (_, i) => (
          <mesh key={i} geometry={GEO.box} material={mat(i % 2 ? p.awning : p.wall)} position={[-(w - 0.6) / 2 + ((i + 0.5) * (w - 0.6)) / stripes, 0, 0]} scale={[(w - 0.6) / stripes + 0.01, 0.06, 1]} castShadow />
        ))}
      </group>
      {/* cartel del % en el techo, mirando al frente */}
      <mesh geometry={GEO.box} material={mat('#2f3437')} position={[w / 2 - 1.2, H + 0.6, bz]} scale={[0.08, 0.8, 0.08]} />
      <mesh geometry={GEO.plane} material={pctMat()} position={[w / 2 - 1.2, H + 1.1, bz + 0.06]} scale={[1.1, 1.1, 1]} />
      <mesh geometry={GEO.plane} material={pctMat()} position={[w / 2 - 1.2, H + 1.1, bz - 0.06]} rotation={[0, Math.PI, 0]} scale={[1.1, 1.1, 1]} />
      {/* banda luminosa bajo la cornisa (de noche) */}
      <mesh geometry={GEO.box} material={glowMat(p.wall, 1.6, { dayGlow: 0.15 })} position={[0, H - 0.15, bz + bodyD / 2 + 0.03]} scale={[w - 0.3, 0.12, 0.03]} />
    </group>
  )
}
