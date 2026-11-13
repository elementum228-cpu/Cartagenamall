// Perfil de dispositivo para la calidad AUTOMÁTICA de MallPlay: decide, antes de cargar nada pesado, si conviene el mundo 3D y con
// qué nivel (low / medium / high). Es una función pura (`classify`) sobre señales del navegador, así se prueba con casos
// de celulares reales. Además del arranque, durante el uso el monitor de FPS puede bajar la calidad (ver WorldCanvas).

export type Tier = 'low' | 'medium' | 'high'

/** Lo que se sabe del dispositivo. Los campos opcionales no existen en todos los navegadores (Safari/iOS no los da). */
export interface DeviceSignals {
  /** navigator.deviceMemory (GB, redondeado). */
  memory?: number
  /** navigator.hardwareConcurrency. */
  cores?: number
  /** navigator.connection.saveData. */
  saveData?: boolean
  /** navigator.connection.effectiveType. */
  effectiveType?: string
  webgl: boolean
  webgl2: boolean
  reducedMotion: boolean
  /** Lado menor y mayor de la pantalla en px CSS. */
  shortSide: number
  longSide: number
  dpr: number
  touch: boolean
  ios: boolean
}

export interface DeviceProfile {
  tier: Tier
  /** ¿Conviene abrir directamente el mundo 3D? Con `low`, el plano 2D (la persona puede pasar a 3D cuando quiera). */
  start3D: boolean
  /** Por qué se eligió este nivel (para depurar y para mostrar al administrador). */
  reasons: string[]
}

const SLOW_NETWORK = new Set(['slow-2g', '2g', '3g'])

/** Clasifica un dispositivo. Reglas, de lo más restrictivo a lo más permisivo. */
export function classify(s: DeviceSignals): DeviceProfile {
  const low: string[] = []
  if (!s.webgl) low.push('sin WebGL')
  if (s.saveData) low.push('ahorro de datos activado')
  if (s.effectiveType && SLOW_NETWORK.has(s.effectiveType)) low.push(`red lenta (${s.effectiveType})`)
  if (s.memory !== undefined && s.memory <= 2) low.push(`poca memoria (${s.memory} GB)`)
  if (s.cores !== undefined && s.cores <= 2) low.push(`pocos núcleos (${s.cores})`)
  if (low.length) return { tier: 'low', start3D: false, reasons: low }

  const mid: string[] = []
  const phone = s.touch && s.shortSide < 768
  if (phone && !s.ios) mid.push('celular')
  if (phone && s.ios) mid.push('iPhone (memoria gráfica compartida)')
  if (s.memory !== undefined && s.memory <= 4) mid.push(`memoria moderada (${s.memory} GB)`)
  if (s.cores !== undefined && s.cores <= 4) mid.push(`pocos núcleos (${s.cores})`)
  if (!s.webgl2) mid.push('solo WebGL 1')
  // un celular potente (muchos núcleos y memoria de sobra) sí aguanta calidad alta
  const strongPhone = phone && !s.ios && (s.memory ?? 0) >= 8 && (s.cores ?? 0) >= 8
  if (mid.length && !strongPhone) return { tier: 'medium', start3D: true, reasons: mid }

  return { tier: 'high', start3D: true, reasons: [phone ? 'celular potente' : 'equipo de escritorio o potente'] }
}

/** Lee las señales del navegador actual (con valores seguros si algo falta o falla). */
export function readSignals(): DeviceSignals {
  const w = typeof window !== 'undefined'
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } }
  let webgl = false
  let webgl2 = false
  if (w) {
    try {
      const c = document.createElement('canvas')
      const g2 = c.getContext('webgl2')
      webgl2 = !!g2
      const g = g2 ?? c.getContext('webgl')
      webgl = !!g
      ;(g2 ?? (g as WebGLRenderingContext | null))?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      webgl = false
    }
  }
  const sw = w ? window.screen?.width || window.innerWidth : 1280
  const sh = w ? window.screen?.height || window.innerHeight : 800
  return {
    memory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    saveData: nav.connection?.saveData === true,
    effectiveType: nav.connection?.effectiveType,
    webgl,
    webgl2,
    reducedMotion: w && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    shortSide: Math.min(sw, sh),
    longSide: Math.max(sw, sh),
    dpr: w ? window.devicePixelRatio || 1 : 1,
    touch: w && ((navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window),
    ios: typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)),
  }
}

let cached: DeviceProfile | null = null
/** Perfil del dispositivo actual (se calcula una vez). Fuera del navegador (pruebas, servidor) devuelve `high`. */
export function detectProfile(): DeviceProfile {
  if (cached) return cached
  if (typeof window === 'undefined') return (cached = { tier: 'high', start3D: true, reasons: ['sin navegador'] })
  return (cached = classify(readSignals()))
}

/** Solo para pruebas: olvida el perfil calculado. */
export const resetProfileCache = () => {
  cached = null
}

/** Resolución interna máxima (devicePixelRatio) según el nivel: lo que más cuesta en pantallas densas. */
export const DPR_CAP: Record<Tier, number> = { low: 1.25, medium: 1.5, high: 2 }

/** Preferencias guardadas que cambian el arranque (leídas sin cargar el resto de la app). */
export function readStoredViewPrefs(): { force2D: boolean; prefer3D: boolean } {
  try {
    const raw = localStorage.getItem('cm:prefs:v1')
    const st = (raw ? JSON.parse(raw) : {})?.state ?? {}
    return { force2D: st.force2D === true, prefer3D: st.prefer3D === true }
  } catch {
    return { force2D: false, prefer3D: false }
  }
}

/**
 * ¿Hay que empezar a bajar el motor 3D de inmediato? Sí, si la persona va a ver el 3D al abrir (dispositivo apto o 3D elegido
 * a mano) y no eligió el plano 2D. En dispositivos básicos el motor (~240 KB) solo se descarga cuando se pide la vista 3D.
 */
export function shouldPreload3D(profile: DeviceProfile, stored = readStoredViewPrefs()): boolean {
  if (stored.force2D) return false
  return profile.start3D || stored.prefer3D
}
