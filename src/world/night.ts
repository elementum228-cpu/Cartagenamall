import * as THREE from 'three'

/**
 * Día/noche sin luces dinámicas extra (caras en móviles): de noche bajan las luces globales y los
 * materiales "luminosos" registrados aquí suben su emisión. `t` va de 0 (día) a 1 (noche) y se
 * anima en `Lighting`.
 */
export const nightState = { t: 0, target: 0, /** tono naranja del atardecer/amanecer (0 a 1) */ warm: 0, warmTarget: 0 }

interface Glow {
  material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  /** Emisión (standard) u opacidad (basic) a plena noche. */
  strength: number
  /** Valor de día (p. ej. opacidad mínima). */
  base: number
}

const glows: Glow[] = []
const cache = new Map<string, THREE.MeshStandardMaterial>()

/** Material que se "enciende" de noche: vitrinas, interiores, faroles, bombillos. */
export function glowMat(color: string, strength = 1, opts: { opacity?: number; dayGlow?: number } = {}) {
  const key = `${color}|${strength}|${opts.opacity ?? 1}|${opts.dayGlow ?? 0}`
  let m = cache.get(key)
  if (!m) {
    const transparent = opts.opacity !== undefined && opts.opacity < 1
    m = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: opts.dayGlow ?? 0,
      roughness: 0.6,
      transparent,
      opacity: opts.opacity ?? 1,
      depthWrite: !transparent,
    })
    glows.push({ material: m, strength, base: opts.dayGlow ?? 0 })
    cache.set(key, m)
  }
  return m
}

/** Halo de luz en el piso (gradiente radial, mezcla aditiva): visible solo de noche. */
let poolTexture: THREE.CanvasTexture | null = null
const poolCache = new Map<string, THREE.MeshBasicMaterial>()
export function lightPoolMat(color = '#ffcf8a', strength = 0.8, dayOpacity = 0) {
  const key = `${color}|${strength}|${dayOpacity}`
  let m = poolCache.get(key)
  if (!m) {
    if (!poolTexture) {
      const c = document.createElement('canvas')
      c.width = c.height = 128
      const g = c.getContext('2d')!
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.45, 'rgba(255,255,255,0.45)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
      poolTexture = new THREE.CanvasTexture(c)
    }
    m = new THREE.MeshBasicMaterial({
      color,
      map: poolTexture,
      transparent: true,
      opacity: dayOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    glows.push({ material: m, strength, base: dayOpacity })
    poolCache.set(key, m)
  }
  return m
}

/**
 * "Volumen" de luz interior (aditivo, sin textura): una caja dentro de un local que aclara y entibia
 * todo lo que hay dentro, como si estuviera encendido. Invisible de día; `strength` = opacidad de noche.
 */
const volumeCache = new Map<string, THREE.MeshBasicMaterial>()
export function nightVolumeMat(color = '#ffcf8f', strength = 0.16) {
  const key = `${color}|${strength}`
  let m = volumeCache.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    glows.push({ material: m, strength, base: 0 })
    volumeCache.set(key, m)
  }
  return m
}

/**
 * Luz ascendente sobre piedra (muralla, garitas, puerta): un degradado aditivo que nace abajo y se
 * desvanece hacia arriba. `plane` además se apaga hacia los lados; `tube` es para cilindros abiertos.
 */
const upTextures: Partial<Record<'plane' | 'tube', THREE.CanvasTexture>> = {}
function upTexture(kind: 'plane' | 'tube') {
  const hit = upTextures[kind]
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const v = g.createLinearGradient(0, 128, 0, 0)
  v.addColorStop(0, 'rgba(255,255,255,1)')
  v.addColorStop(0.35, 'rgba(255,255,255,0.5)')
  v.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = v
  g.fillRect(0, 0, 128, 128)
  if (kind === 'plane') {
    g.globalCompositeOperation = 'destination-in'
    const h = g.createLinearGradient(0, 0, 128, 0)
    h.addColorStop(0, 'rgba(0,0,0,0)')
    h.addColorStop(0.5, 'rgba(0,0,0,1)')
    h.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = h
    g.fillRect(0, 0, 128, 128)
  }
  const t = new THREE.CanvasTexture(c)
  upTextures[kind] = t
  return t
}
const upCache = new Map<string, THREE.MeshBasicMaterial>()
export function uplightMat(kind: 'plane' | 'tube', color = '#ffc27a', strength = 0.55) {
  const key = `${kind}|${color}|${strength}`
  let m = upCache.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      map: upTexture(kind),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
    glows.push({ material: m, strength, base: 0 })
    upCache.set(key, m)
  }
  return m
}

/** Rótulo con luz propia (letrero de la entrada): de noche no se atenúa. */
const litCache = new Map<THREE.Texture, THREE.MeshBasicMaterial>()
export function litLabelMat(texture: THREE.Texture) {
  let m = litCache.get(texture)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false })
    litCache.set(texture, m)
  }
  return m
}

/** Rótulo sin iluminación propia (texto de tótems, arcos): de noche se oscurece. */
const dimmed: THREE.MeshBasicMaterial[] = []
const dimCache = new Map<THREE.Texture, THREE.MeshBasicMaterial>()
export function dimLabelMat(texture: THREE.Texture) {
  let m = dimCache.get(texture)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false })
    dimmed.push(m)
    dimCache.set(texture, m)
  }
  return m
}

export function applyNight(t: number) {
  for (const m of dimmed) m.color.setScalar(1 - 0.12 * t)
  for (const g of glows) {
    const v = g.base + (g.strength - g.base) * t
    if (g.material instanceof THREE.MeshStandardMaterial) g.material.emissiveIntensity = v
    else {
      g.material.opacity = v
      g.material.visible = v > 0.01
    }
  }
}
