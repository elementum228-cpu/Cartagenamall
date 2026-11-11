import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { applyNight, nightState } from './night'
import { DAY_LIGHTING, LOCAL_LIGHTS, NIGHT_LIGHTING, SUNSET_LIGHTING, type LightingPreset } from './lightingConfig'
import { SKY_DAY, SKY_DUSK, SKY_NIGHT, skyAt } from '../lib/daylight'
import { useMinute } from '../lib/useMinute'
import { FLOOR_BY_ID } from '../config/mall'
import { floorOrigin } from './floors'
import { usePrefs, useUI, type Quality } from '../state/ui'

const colors = (p: LightingPreset) => ({ sky: new THREE.Color(p.hemiSky), ground: new THREE.Color(p.hemiGround), sun: new THREE.Color(p.sun), amb: new THREE.Color(p.ambient) })
const DAY = { ...DAY_LIGHTING, c: colors(DAY_LIGHTING) }
const NIGHT = { ...NIGHT_LIGHTING, c: colors(NIGHT_LIGHTING) }
const SUNSET = { ...SUNSET_LIGHTING, c: colors(SUNSET_LIGHTING) }
const tmp = new THREE.Color()
const mix = (a: THREE.Color, b: THREE.Color, c: THREE.Color, warm: number, night: number, out: THREE.Color) => out.lerpColors(a, b, warm).lerp(c, night)
const mixN = (a: number, b: number, c: number, warm: number, night: number) => THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, warm), c, night)

/** Luces globales con transición suave día ↔ noche. */
/** Luces globales: el cielo sigue la hora real (atardecer naranja, noche, amanecer) o el modo que se elija. */
export function Lighting({ shadows, quality }: { night?: boolean; shadows: boolean; quality: Quality }) {
  const mode = usePrefs((s) => s.timeMode)
  const minute = useMinute()
  const sky = mode === 'day' ? SKY_DAY : mode === 'night' ? SKY_NIGHT : mode === 'dusk' ? SKY_DUSK : skyAt(new Date(minute))
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
    nightState.target = sky.night
    nightState.warmTarget = sky.warm
    // Al abrir no se anima desde el día: arranca ya en la hora que es.
    if (first.current) {
      nightState.t = sky.night
      nightState.warm = sky.warm
    }
    first.current = false
  }, [sky.night, sky.warm])

  // La sombra casi no cambia entre cuadros (el sol no se mueve; solo caminan figuras pequeñas): se redibuja a ~12 Hz en
  // vez de en cada cuadro, lo que ahorra cientos de llamadas de dibujo por cuadro sin que se note.
  const gl = useThree((st) => st.gl)
  const shadowAcc = useRef(1)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl, shadows])

  useFrame((_, dt) => {
    shadowAcc.current += dt
    if (shadowAcc.current > 0.08) {
      shadowAcc.current = 0
      gl.shadowMap.needsUpdate = true
    }
    const s = nightState
    s.t += (s.target - s.t) * Math.min(1, dt * 2.5)
    s.warm += (s.warmTarget - s.warm) * Math.min(1, dt * 2.5)
    if (Math.abs(s.target - s.t) < 0.002) s.t = s.target
    if (Math.abs(s.warmTarget - s.warm) < 0.002) s.warm = s.warmTarget
    const key = s.t * 10 + s.warm * 0.001
    if (key === last.current && !dirty.current) return
    dirty.current = false
    last.current = key
    gl.shadowMap.needsUpdate = true
    const t = s.t
    const w = s.warm
    if (hemi.current) {
      hemi.current.color.copy(mix(DAY.c.sky, SUNSET.c.sky, NIGHT.c.sky, w, t, tmp))
      hemi.current.groundColor.copy(mix(DAY.c.ground, SUNSET.c.ground, NIGHT.c.ground, w, t, tmp))
      hemi.current.intensity = mixN(DAY.hemi, SUNSET.hemi, NIGHT.hemi, w, t)
    }
    if (sun.current) {
      sun.current.color.copy(mix(DAY.c.sun, SUNSET.c.sun, NIGHT.c.sun, w, t, tmp))
      sun.current.intensity = mixN(DAY.sunI, SUNSET.sunI, NIGHT.sunI, w, t)
      // De noche la "luna" entra por el otro lado: sombras más largas y suaves.
      sun.current.position.set(...(DAY.sunPos.map((v, i) => mixN(v, SUNSET.sunPos[i], NIGHT.sunPos[i], w, t)) as [number, number, number]))
    }
    if (amb.current) {
      amb.current.color.copy(mix(DAY.c.amb, SUNSET.c.amb, NIGHT.c.amb, w, t, tmp))
      amb.current.intensity = mixN(DAY.amb, SUNSET.amb, NIGHT.amb, w, t)
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
