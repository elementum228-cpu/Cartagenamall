let cached: boolean | null = null

/** Detecta WebGL usable. Si falla, el modo Explorar cae al mapa 2D. */
export function hasWebGL(): boolean {
  if (cached !== null) return cached
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    cached = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}

export function isLowPowerDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return (nav.deviceMemory !== undefined && nav.deviceMemory <= 3) || (navigator.hardwareConcurrency ?? 8) <= 4
}
