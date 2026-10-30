import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { applyNight, nightState } from './night'
import { DAY_LIGHTING, LOCAL_LIGHTS, NIGHT_LIGHTING, type LightingPreset } from './lightingConfig'
import { FLOOR_BY_ID } from '../config/mall'
import { floorOrigin } from './floors'
import { useUI, type Quality } from '../state/ui'

const colors = (p: LightingPreset) => ({ sky: new THREE.Color(p.hemiSky), ground: new THREE.Color(p.hemiGround), sun: new THREE.Color(p.sun), amb: new THREE.Color(p.ambient) })
const DAY = { ...DAY_LIGHTING, c: colors(DAY_LIGHTING) }
const NIGHT = { ...NIGHT_LIGHTING, c: colors(NIGHT_LIGHTING) }

/** Luces globales con transición suave día ↔ noche. */
export function Lighting({ night, shadows, quality }: { night: boolean; shadows: boolean; quality: Quality }) {
  // Luces locales reales (sin sombras): ninguna en calidad baja, pocas en media, algunas más en alta.
  // Existen siempre (intensidad 0 de día) para no recompilar sombreadores al cambiar de hora.
  const local = useMemo(() => LOCAL_LIGHTS.filter((l) => quality === 'high' || (quality === 'medium' && l.minQuality === 'medium')), [quality])
  const localRefs = useRef<(THREE.PointLight | null)[]>([])
  const overview = useUI((s) => s.overview)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const amb = useRef<THREE.AmbientLight>(null)
  const last = useRef(-1)
  const dirty = useRef(true)
  useEffect(() => {
    dirty.current = true
  }, [local])
  const first = useRef(true)

  useEffect(() => {
    nightState.target = night ? 1 : 0
    // Al abrir de noche no se anima desde el día.
    if (first.current) nightState.t = nightState.target
    first.current = false
  }, [night])

  useFrame((_, dt) => {
    const s = nightState
    s.t += (s.target - s.t) * Math.min(1, dt * 2.5)
    if (Math.abs(s.target - s.t) < 0.002) s.t = s.target
    if (s.t === last.current && !dirty.current) return
    dirty.current = false
    last.current = s.t
    const t = s.t
    if (hemi.current) {
      hemi.current.color.lerpColors(DAY.c.sky, NIGHT.c.sky, t)
      hemi.current.groundColor.lerpColors(DAY.c.ground, NIGHT.c.ground, t)
      hemi.current.intensity = THREE.MathUtils.lerp(DAY.hemi, NIGHT.hemi, t)
    }
    if (sun.current) {
      sun.current.color.lerpColors(DAY.c.sun, NIGHT.c.sun, t)
      sun.current.intensity = THREE.MathUtils.lerp(DAY.sunI, NIGHT.sunI, t)
      // De noche la "luna" entra por el otro lado: sombras más largas y suaves.
      sun.current.position.set(...(DAY.sunPos.map((v, i) => THREE.MathUtils.lerp(v, NIGHT.sunPos[i], t)) as [number, number, number]))
    }
    if (amb.current) {
      amb.current.color.lerpColors(DAY.c.amb, NIGHT.c.amb, t)
      amb.current.intensity = THREE.MathUtils.lerp(DAY.amb, NIGHT.amb, t)
    }
    for (const [i, l] of local.entries()) {
      const light = localRefs.current[i]
      if (light) light.intensity = l.intensity * t
    }
    applyNight(t)
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#fff6e6', '#d9c7a4', 1.25]} />
      <directionalLight
        ref={sun}
        position={[28, 46, 18]}
        intensity={2.1}
        color="#ffe7c4"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <ambientLight ref={amb} intensity={0.25} />
      {local.map((l, i) => {
        const o = l.floorId ? floorOrigin(FLOOR_BY_ID[l.floorId], overview) : null
        return (
          <pointLight
            key={l.id}
            ref={(el) => void (localRefs.current[i] = el)}
            position={o ? [o.x + l.position[0], o.y + l.position[1], o.z + l.position[2]] : l.position}
            color={l.color}
            intensity={0}
            distance={l.distance}
            decay={1.3}
          />
        )
      })}
    </>
  )
}
