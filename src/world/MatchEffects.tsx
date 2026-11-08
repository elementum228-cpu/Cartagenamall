import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStadiumMatch } from '../state/stadiumEvents'
import { GOAL_SHOW_MS } from '../stadium/match'

// Fuegos artificiales sobre el estadio cuando el equipo local mete gol (el marcador va en la pantalla de la fachada).

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COLORS = ['#22d36a', '#f6c619', '#ffffff', '#ff5a4a', '#5ad7ff', '#ff7ad9']
const GRAVITY = 5.5
const RISE = 0.8
const LIFE = 2.4

/**
 * Fuegos artificiales sobre el estadio: salen cuando el marcador registra un gol del equipo local. Cohetes que
 * suben y estallan en chispas de colores. Un solo `Points` con todo, actualizado en el CPU (pocas partículas).
 */
export function Fireworks({ baseY, quality, reduceMotion }: { baseY: number; quality: 'low' | 'medium' | 'high'; reduceMotion: boolean }) {
  const bursts = quality === 'low' ? 6 : quality === 'medium' ? 10 : 14
  const per = quality === 'low' ? 34 : 64
  const total = bursts * per
  const data = useMemo(() => {
    const r = rng(2026)
    const dirs = new Float32Array(total * 3)
    const speed = new Float32Array(total)
    const origin = new Float32Array(bursts * 3)
    const delay = new Float32Array(bursts)
    const color = new Float32Array(bursts * 3)
    const c = new THREE.Color()
    for (let b = 0; b < bursts; b++) {
      origin.set([(r() * 2 - 1) * 12, baseY + 13 + r() * 7, (r() * 2 - 1) * 9], b * 3)
      delay[b] = b * 0.42 + r() * 0.2
      c.set(COLORS[b % COLORS.length])
      color.set([c.r, c.g, c.b], b * 3)
      for (let i = 0; i < per; i++) {
        const u = r() * 2 - 1
        const a = r() * Math.PI * 2
        const s = Math.sqrt(1 - u * u)
        dirs.set([s * Math.cos(a), u, s * Math.sin(a)], (b * per + i) * 3)
        speed[b * per + i] = 3.2 + r() * 3.4
      }
    }
    return { dirs, speed, origin, delay, color }
  }, [bursts, per, total, baseY])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(total * 3), 3).setUsage(THREE.DynamicDrawUsage))
    return g
  }, [total])
  const material = useMemo(
    () => new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  )
  const group = useRef<THREE.Points>(null)
  const seen = useRef<number | null>(null)
  const start = useRef(false)
  const t0 = useRef<number | null>(null)
  const goal = useStadiumMatch((s) => s.match.goal)

  useEffect(() => {
    if (!goal) return
    if (seen.current === null) {
      // al abrir la página no se repite un gol viejo; uno de hace segundos sí se ve
      seen.current = goal.n
      if (goal.side === 'home' && Date.now() - goal.at < GOAL_SHOW_MS) start.current = true
      return
    }
    if (goal.n !== seen.current) {
      seen.current = goal.n
      if (goal.side === 'home') start.current = true
    }
  }, [goal])

  const showLen = bursts * 0.42 + RISE + LIFE + 0.4
  useFrame(({ clock }) => {
    const pts = group.current
    if (!pts) return
    if (start.current) {
      start.current = false
      t0.current = clock.elapsedTime
    }
    if (t0.current === null || reduceMotion) {
      pts.visible = false
      return
    }
    const t = clock.elapsedTime - t0.current
    if (t > showLen) {
      t0.current = null
      pts.visible = false
      return
    }
    pts.visible = true
    const pos = geo.attributes.position as THREE.BufferAttribute
    const col = geo.attributes.color as THREE.BufferAttribute
    for (let b = 0; b < bursts; b++) {
      const tb = t - data.delay[b]
      const ox = data.origin[b * 3]
      const oy = data.origin[b * 3 + 1]
      const oz = data.origin[b * 3 + 2]
      for (let i = 0; i < per; i++) {
        const k = b * per + i
        let x = ox
        let y = oy
        let z = oz
        let f = 0
        if (tb >= 0 && tb < RISE && i === 0) {
          // el cohete sube desde el estadio hasta el punto de la explosión
          const u = tb / RISE
          y = baseY + 6 + (oy - baseY - 6) * u
          f = 1
        } else if (tb >= RISE && tb < RISE + LIFE) {
          const tau = tb - RISE
          const drag = 1 - Math.exp(-tau * 1.8)
          const sp = (data.speed[k] / 1.8) * 1.7
          x = ox + data.dirs[k * 3] * sp * drag
          y = oy + data.dirs[k * 3 + 1] * sp * drag - 0.5 * GRAVITY * tau * tau * 0.35
          z = oz + data.dirs[k * 3 + 2] * sp * drag
          f = Math.max(0, 1 - tau / LIFE) ** 1.4
          // destellos
          f *= 0.75 + 0.25 * Math.sin(tau * 30 + i)
        }
        pos.setXYZ(k, x, y, z)
        col.setXYZ(k, data.color[b * 3] * f, data.color[b * 3 + 1] * f, data.color[b * 3 + 2] * f)
      }
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  })
  return <points ref={group} geometry={geo} material={material} frustumCulled={false} visible={false} raycast={() => null} />
}
