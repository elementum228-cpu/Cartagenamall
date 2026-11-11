import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Casco de obra: cúpula con ala, de la medida de una cabeza unitaria (diámetro 1). */
function helmetGeometry() {
  const dome = new THREE.SphereGeometry(0.46, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  dome.translate(0, 0.1, 0)
  const brim = new THREE.CylinderGeometry(0.58, 0.58, 0.05, 14)
  brim.translate(0, 0.1, 0)
  const ridge = new THREE.BoxGeometry(0.12, 0.1, 0.74)
  ridge.translate(0, 0.55, 0)
  return mergeGeometries([dome.toNonIndexed(), brim.toNonIndexed(), ridge.toNonIndexed()])!
}

// Geometrías y materiales compartidos por todo el mundo: cada malla escala una geometría unitaria
// en lugar de crear la suya, y los materiales se reutilizan por color. Esto mantiene la memoria
// baja en móviles y permite que three agrupe estados de render.

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rounded: new RoundedBoxGeometry(1, 1, 1, 2, 0.12),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  cylinderLow: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 7),
  sphere: new THREE.IcosahedronGeometry(0.5, 1),
  sphereSmooth: new THREE.SphereGeometry(0.5, 16, 12),
  plane: new THREE.PlaneGeometry(1, 1),
  halfDisc: new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, -Math.PI / 2, Math.PI),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  ring: new THREE.RingGeometry(0.8, 1, 32),
  capsule: new THREE.CapsuleGeometry(0.22, 0.42, 3, 8),
  torus: new THREE.TorusGeometry(1, 0.08, 6, 32),
  helmet: helmetGeometry(),
}

const cache = new Map<string, THREE.Material>()

export function mat(color: string, opts: { opacity?: number; emissive?: number; rough?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.opacity ?? 1}|${opts.emissive ?? 0}|${opts.rough ?? 0.85}`
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.85,
      metalness: 0,
      transparent: opts.opacity !== undefined && opts.opacity < 1,
      opacity: opts.opacity ?? 1,
      emissive: opts.emissive ? new THREE.Color(color) : new THREE.Color('#000'),
      emissiveIntensity: opts.emissive ?? 0,
      depthWrite: !(opts.opacity !== undefined && opts.opacity < 1),
    })
    // opaco y sin brillo propio: <Batch> puede hornear su color en los vértices y compartir un solo material
    if (!m.transparent && !opts.emissive) m.userData.bake = true
    cache.set(key, m)
  }
  return m
}

export const GLASS = new THREE.MeshStandardMaterial({
  color: '#cfe8ee',
  roughness: 0.1,
  metalness: 0.1,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
})

export const WATER = new THREE.MeshStandardMaterial({ color: '#5fb8c4', roughness: 0.25, metalness: 0.05 })

/** Paleta de la arquitectura del mall. */
export const PALETTE = {
  sand: '#ead9bb',
  sandDark: '#cdb48d',
  sea: '#7cc4c9',
  seaDeep: '#4e9fab',
  grass: '#a7c58b',
  grassDark: '#86ab6c',
  floor: '#f7f2e8',
  floorAlt: '#efe5d3',
  plaza: '#eadcc4',
  wall: '#fbf7f0',
  trim: '#dcc8a6',
  wood: '#b98a5c',
  woodDark: '#8a6340',
  pot: '#d9a88a',
  leaf: '#6fa56b',
  leafDark: '#4f8a55',
  trunk: '#a07a55',
  metal: '#6c7480',
  lamp: '#fff1c9',
}

/** Aclara u oscurece un color hex (t de -1 a 1). */
export function shade(hex: string, t: number) {
  const c = new THREE.Color(hex)
  return t >= 0 ? c.lerp(new THREE.Color('#ffffff'), t).getStyle() : c.lerp(new THREE.Color('#000000'), -t).getStyle()
}
