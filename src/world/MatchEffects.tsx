import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStadiumBoard, useStadiumConfig, useStadiumEvents, useStadiumMatch } from '../state/stadiumEvents'
import { resolveBoard } from '../stadium/board'
import { playGoalSound } from '../state/goalSound'
import { FIREWORKS_DELAY_S } from '../stadium/match'
import { SCORE_H, SCORE_W, paintScoreboard, scoreKey } from '../stadium/scoreboardPaint'
import { GEO, mat } from './materials'
import { glowMat, nightState } from './night'

// Marcador en vivo dentro del estadio y fuegos artificiales cuando el equipo local mete gol.

/**
 * Pantalla del marcador dentro del estadio, sobre la tribuna norte. Mira al sur, igual que la pantalla de la
 * fachada, así las dos se ven con el mismo ángulo diagonal desde la cámara. El reloj corre en vivo.
 */
export function IndoorScoreboard({ position }: { position: [number, number, number] }) {
  const activeId = useStadiumConfig((s) => s.activeEventId)
  const events = useStadiumEvents((s) => s.events)
  const general = useStadiumBoard((s) => s.board)
  const board = useMemo(() => resolveBoard(events.find((e) => e.id === activeId) ?? null, general), [events, activeId, general])
  const { canvas, tex } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = SCORE_W
    c.height = SCORE_H
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return { canvas: c, tex: t }
  }, [])
  const screen = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [tex])
  const key = useRef('')
  const acc = useRef(1)
  const busy = useRef(false)
  useFrame((_, dt) => {
    screen.color.setScalar(0.42 + 0.58 * nightState.t)
    acc.current += dt
    if (acc.current < 0.2 || busy.current) return
    acc.current = 0
    const match = useStadiumMatch.getState().match
    const now = Date.now()
    const k = scoreKey(match, board, now)
    if (k === key.current) return
    key.current = k
    busy.current = true
    void paintScoreboard(canvas, { match, board, now }).then(() => {
      tex.needsUpdate = true
      busy.current = false
    })
  })
  // cuando cambian los escudos hay que redibujar aunque el marcador sea el mismo
  useEffect(() => {
    key.current = ''
  }, [board])
  const W = 8.2
  const H = (W * SCORE_H) / SCORE_W
  return (
    <group position={position}>
      <mesh geometry={GEO.box} material={mat('#1d2a33')} position={[0, 0, -0.1]} scale={[W + 0.5, H + 0.5, 0.2]} castShadow />
      <mesh geometry={GEO.box} material={glowMat('#7fe7b0', 1.5, { dayGlow: 0.05 })} position={[0, 0, -0.02]} scale={[W + 0.3, H + 0.3, 0.06]} />
      <mesh geometry={GEO.plane} material={screen} position={[0, 0, 0.06]} scale={[W, H, 1]} />
      {[-3.2, 3.2].map((x) => (
        <mesh key={x} geometry={GEO.box} material={mat('#6c747c')} position={[x, H / 2 + 1.4, -0.1]} scale={[0.06, 2.8, 0.06]} />
      ))}
    </group>
  )
}

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
const LIFE = 2.8

/**
 * Fuegos artificiales sobre el estadio: salen cuando el marcador registra un gol del equipo local. Cohetes que
 * suben y estallan en chispas de colores. Un solo `Points` con todo, actualizado en el CPU (pocas partículas).
 */
export function Fireworks({ baseY, quality, reduceMotion }: { baseY: number; quality: 'low' | 'medium' | 'high'; reduceMotion: boolean }) {
  // primero el grito de gol y, a los 6 segundos, los fuegos artificiales (unos 10 s, hasta que se apaga el audio)
  const bursts = 12
  const per = quality === 'low' ? 30 : quality === 'medium' ? 48 : 64
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
      delay[b] = b * 0.5 + r() * 0.25
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
  // al abrir la página no se repite un gol viejo: solo cuentan los goles que llegan mientras se mira
  const seen = useRef(useStadiumMatch.getState().match.goal?.n ?? 0)
  const start = useRef(false)
  const t0 = useRef<number | null>(null)
  const goal = useStadiumMatch((s) => s.match.goal)

  useEffect(() => {
    if (!goal) {
      seen.current = 0 // marcador reiniciado
      return
    }
    if (goal.n !== seen.current) {
      seen.current = goal.n
      if (goal.side === 'home') start.current = true
      // suena el gol a quien está viendo el estadio en el momento (fuegos y grito sincronizados en el mismo archivo)
      playGoalSound(goal.side)
    }
  }, [goal])

  const showLen = bursts * 0.5 + 0.25 + RISE + LIFE + 0.4
  useFrame(({ clock }) => {
    const pts = group.current
    if (!pts) return
    if (start.current) {
      start.current = false
      t0.current = clock.elapsedTime + FIREWORKS_DELAY_S
    }
    if (t0.current === null || reduceMotion) {
      pts.visible = false
      return
    }
    const t = clock.elapsedTime - t0.current
    if (t < 0) {
      // todavía suena el grito de gol: los fuegos esperan
      pts.visible = false
      return
    }
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
