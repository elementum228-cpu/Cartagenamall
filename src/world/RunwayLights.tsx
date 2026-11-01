import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GEO } from './materials'
import { nightState } from './night'

// Luces de pista de noche, como en un aeropuerto: bordes azules que titilan suave, línea central
// con un pulso que corre en el sentido del despegue, umbral azul y fin de pista en rojo, y las luces
// de aproximación sobre el mar con el «conejo» (destellos en secuencia hacia el umbral). Todo en una
// sola InstancedMesh de bombillos y otra de halos; de día no se ven.

interface Light {
  x: number
  z: number
  kind: 'edge' | 'center' | 'start' | 'end' | 'approach'
  /** Orden en su secuencia (0 = primero). */
  i: number
  n: number
}

const BLUE = new THREE.Color('#3d8bff')
const RED = new THREE.Color('#ff3b4a')
const WHITE = new THREE.Color('#dff0ff')
const CYAN = new THREE.Color('#6fd3ff')

/**
 * Marco local: la pista corre a lo largo de z, de z0 a z1, centrada en x = cx. Los aviones despegan
 * y aterrizan hacia `dir` (+1: hacia +z): el umbral (y la aproximación) quedan del lado opuesto.
 */
export function RunwayLights({ cx, z0, z1, w, y, dir }: { cx: number; z0: number; z1: number; w: number; y: number; dir: 1 | -1 }) {
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const halos = useRef<THREE.InstancedMesh>(null)
  const lights = useMemo(() => {
    const out: Light[] = []
    const len = z1 - z0
    const start = dir > 0 ? z0 : z1
    const end = dir > 0 ? z1 : z0
    const along = (u: number) => start + dir * u * len
    const nEdge = 14
    for (let k = 0; k < nEdge; k++) for (const s of [-1, 1]) out.push({ x: cx + s * (w / 2 + 0.25), z: along(k / (nEdge - 1)), kind: 'edge', i: k, n: nEdge })
    const nC = 12
    for (let k = 0; k < nC; k++) out.push({ x: cx, z: along((k + 0.5) / nC), kind: 'center', i: k, n: nC })
    for (let k = 0; k < 6; k++) out.push({ x: cx - w / 2 + 0.3 + (k * (w - 0.6)) / 5, z: start - dir * 0.3, kind: 'start', i: k, n: 6 })
    for (let k = 0; k < 6; k++) out.push({ x: cx - w / 2 + 0.3 + (k * (w - 0.6)) / 5, z: end + dir * 0.3, kind: 'end', i: k, n: 6 })
    const nA = 8
    for (let k = 0; k < nA; k++) out.push({ x: cx, z: start - dir * (2 + (nA - 1 - k) * 1.7), kind: 'approach', i: k, n: nA })
    return out
  }, [cx, z0, z1, w, dir])

  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    lights.forEach((l, k) => {
      const big = l.kind === 'approach' ? 0.32 : l.kind === 'center' ? 0.16 : 0.22
      o.position.set(l.x, y + 0.1, l.z)
      o.rotation.set(0, 0, 0)
      o.scale.setScalar(big)
      o.updateMatrix()
      bulbs.current?.setMatrixAt(k, o.matrix)
      o.position.set(l.x, y + 0.06, l.z)
      o.rotation.set(-Math.PI / 2, 0, 0)
      o.scale.setScalar(l.kind === 'approach' ? 2.2 : l.kind === 'center' ? 1.1 : 1.5)
      o.updateMatrix()
      halos.current?.setMatrixAt(k, o.matrix)
    })
    for (const m of [bulbs.current, halos.current]) {
      if (!m) continue
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
  }, [lights, y])

  const haloMat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.4)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  }, [])
  const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), [])
  const col = useMemo(() => new THREE.Color(), [])

  useFrame(({ clock }) => {
    const night = nightState.t
    const b = bulbs.current
    const h = halos.current
    if (!b || !h) return
    b.visible = h.visible = night > 0.02
    if (night <= 0.02) return
    const t = clock.elapsedTime
    lights.forEach((l, k) => {
      let base = BLUE
      let v = 0.6
      if (l.kind === 'edge') {
        // azul con un brillo suave que recorre la pista
        const wave = (t * 0.9 - l.i / l.n) % 1
        v = 0.55 + 0.45 * Math.max(0, Math.cos(wave * Math.PI * 2)) ** 6
      } else if (l.kind === 'center') {
        // pulso que corre en el sentido del despegue; las últimas, en rojo
        base = l.i >= l.n - 3 ? RED : CYAN
        const head = (t * 0.8) % 1.3
        const d = l.i / l.n - head
        v = 0.25 + 0.95 * Math.exp(-(d * d) / 0.004)
      } else if (l.kind === 'start') {
        base = BLUE
        v = 0.9
      } else if (l.kind === 'end') {
        base = RED
        v = 0.65 + 0.35 * (Math.sin(t * 2.4) * 0.5 + 0.5)
      } else {
        // «conejo»: un destello blanco-azul que corre hacia el umbral, dos veces por segundo
        const phase = (t * 2) % 1
        const at = Math.floor(phase * (l.n + 2))
        base = at === l.i ? WHITE : BLUE
        v = at === l.i ? 1.6 : 0.18
      }
      col.copy(base).multiplyScalar(v * night * 1.35)
      b.setColorAt(k, col)
      col.multiplyScalar(0.7)
      h.setColorAt(k, col)
    })
    if (b.instanceColor) b.instanceColor.needsUpdate = true
    if (h.instanceColor) h.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={halos} args={[GEO.plane, haloMat, lights.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={bulbs} args={[GEO.sphere, bulbMat, lights.length]} frustumCulled={false} raycast={() => null} />
    </group>
  )
}
