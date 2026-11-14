import { useMemo } from 'react'
import { usePrefs } from '../state/ui'
import { detectProfile } from './deviceProfile'
import { hasWebGL } from './webgl'

/** ¿Se está viendo el mundo 3D (y no el plano 2D)? Misma regla que usa el mapa: WebGL, sin forzar 2D y dispositivo apto o 3D elegido. */
export function useUse3D(): boolean {
  const force2D = usePrefs((s) => s.force2D)
  const prefer3D = usePrefs((s) => s.prefer3D)
  const webgl = useMemo(hasWebGL, [])
  const profile = useMemo(detectProfile, [])
  return webgl && !force2D && (profile.start3D || prefer3D)
}
