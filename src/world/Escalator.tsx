import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ESCALATOR, ESCALATOR_FRAME, ESCALATOR_STEP_RATE, ESCALATOR_STEPS, FLOOR_BY_ID, escToWorld } from '../config/mall'
import { useUI } from '../state/ui'
import { cameraState } from './cameraState'
import { ScreenLabel } from './Billboard'
import { LABEL_PRIORITY } from './labels'
import { getLabel } from './labelTexture'
import { GEO, GLASS, PALETTE, mat } from './materials'
import { glowMat } from './night'

const FLOOR_TOP = 0.2 // altura de la superficie de cada piso respecto a su origen
const STEPS = ESCALATOR_STEPS
/** Velocidad de los escalones (escalones por segundo). El carril izquierdo sube y el derecho baja. */
const STEP_RATE = ESCALATOR_STEP_RATE
/** Marcas en los pasamanos (se mueven con los escalones: se nota que la escalera anda). */
const RAIL_MARKS = 7
/** Personas que usan las escaleras: suben, cruzan el rellano, bajan y vuelven a cruzar, en bucle. */
const RIDERS = 3
const RIDER_COLORS = ['#e0735f', '#3b82a6', '#f5b544', '#5f9a6e', '#c2607f', '#6b5b95']
const SKIN = ['#8d5a3b', '#c58c64', '#e5b48f']

/**
 * Escaleras eléctricas simplificadas: dos carriles que suben desde la plaza del piso 1 hacia el
 * fondo, hasta el borde de la terraza del piso 2. Tocarlas sube o baja de piso.
 */
export function Escalators({ showUpSign }: { showUpSign: boolean }) {
  const rise = FLOOR_BY_ID.P2.elevation
  const run = ESCALATOR.bottomZ - ESCALATOR.topZ
  const length = Math.hypot(run, rise)
  const angle = Math.atan2(rise, run)
  const midZ = (ESCALATOR.bottomZ + ESCALATOR.topZ) / 2
  const midY = FLOOR_TOP + rise / 2
  const w = ESCALATOR.width
  const steps = useRef<THREE.InstancedMesh>(null)
  const centerX = (ESCALATOR.lanesX[0] + ESCALATOR.lanesX[1]) / 2

  const marks = useRef<THREE.InstancedMesh>(null)
  const riderBodies = useRef<THREE.InstancedMesh>(null)
  const riderHeads = useRef<THREE.InstancedMesh>(null)
  const reduceMotion = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const o = useMemo(() => new THREE.Object3D(), [])
  const [upX, downX] = ESCALATOR.lanesX
  const stepSpeed = (STEP_RATE * length) / STEPS // unidades por segundo a lo largo de la rampa
  /** Recorrido en bucle de una persona: rampa de subida, rellano de arriba, rampa de bajada, rellano de abajo. */
  const loop = useMemo(() => {
    const landing = Math.abs(downX - upX)
    return { landing, total: 2 * length + 2 * landing }
  }, [downX, upX, length])

  useLayoutEffect(() => {
    const c = new THREE.Color()
    for (let i = 0; i < RIDERS; i++) {
      riderBodies.current?.setColorAt(i, c.set(RIDER_COLORS[i % RIDER_COLORS.length]))
      riderHeads.current?.setColorAt(i, c.set(SKIN[i % SKIN.length]))
    }
    for (const m of [riderBodies.current, riderHeads.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [])

  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    const phase = (t * STEP_RATE) % 1
    const stepAt = (lx: number, u: number) => o.position.set(lx, FLOOR_TOP + rise * u + 0.2, ESCALATOR.bottomZ - run * u)
    // escalones: suben en un carril y bajan en el otro (sin reciclar a la vista: el primero entra mientras el último sale)
    const m = steps.current
    if (m) {
      o.rotation.set(0, 0, 0)
      o.scale.set(w - 0.2, 0.06, run / STEPS + 0.02)
      ESCALATOR.lanesX.forEach((lx, lane) => {
        for (let i = 0; i < STEPS; i++) {
          const k = lane === 0 ? i + phase : i + 1 - phase
          stepAt(lx, k / STEPS)
          o.updateMatrix()
          m.setMatrixAt(lane * STEPS + i, o.matrix)
        }
      })
      m.instanceMatrix.needsUpdate = true
    }
    // marcas de los pasamanos, a la misma velocidad
    const mk = marks.current
    if (mk) {
      let n = 0
      o.scale.set(0.12, 0.09, 0.18)
      ESCALATOR.lanesX.forEach((lx, lane) =>
        [-1, 1].forEach((side) => {
          for (let i = 0; i < RAIL_MARKS; i++) {
            const shift = (t * STEP_RATE) / STEPS
            const k = (((i / RAIL_MARKS + (lane === 0 ? shift : -shift)) % 1) + 1) % 1
            o.position.set(lx + (side * w) / 2, FLOOR_TOP + rise * k + 0.2 + 0.95, ESCALATOR.bottomZ - run * k)
            o.rotation.set(angle, 0, 0)
            o.updateMatrix()
            mk.setMatrixAt(n++, o.matrix)
          }
        }),
      )
      mk.instanceMatrix.needsUpdate = true
    }
    // personas: quietas sobre el escalón en las rampas, caminando en los rellanos
    const rb = riderBodies.current
    const rh = riderHeads.current
    if (rb && rh) {
      for (let i = 0; i < RIDERS; i++) {
        let s = (t * stepSpeed + (i / RIDERS) * loop.total) % loop.total
        let x: number, y: number, z: number, heading: number, bob = 0
        if (s < length) {
          const u = s / length
          x = upX
          y = FLOOR_TOP + rise * u + 0.23
          z = ESCALATOR.bottomZ - run * u
          heading = Math.PI
        } else if ((s -= length) < loop.landing) {
          x = upX + (downX - upX) * (s / loop.landing)
          y = FLOOR_TOP + rise + 0.1
          z = ESCALATOR.topZ - 0.6
          heading = Math.sign(downX - upX) * (Math.PI / 2)
          bob = Math.abs(Math.sin(t * 7 + i)) * 0.05
        } else if ((s -= loop.landing) < length) {
          const u = 1 - s / length
          x = downX
          y = FLOOR_TOP + rise * u + 0.23
          z = ESCALATOR.bottomZ - run * u
          heading = 0
        } else {
          s -= length
          x = downX + (upX - downX) * (s / loop.landing)
          y = FLOOR_TOP + 0.1
          z = ESCALATOR.bottomZ + 0.8
          heading = Math.sign(upX - downX) * (Math.PI / 2)
          bob = Math.abs(Math.sin(t * 7 + i)) * 0.05
        }
        o.rotation.set(0, heading, 0)
        o.position.set(x, y + 0.43 + bob, z)
        o.scale.setScalar(1)
        o.updateMatrix()
        rb.setMatrixAt(i, o.matrix)
        o.position.y += 0.52
        o.scale.setScalar(0.36)
        o.updateMatrix()
        rh.setMatrixAt(i, o.matrix)
      }
      rb.instanceMatrix.needsUpdate = true
      rh.instanceMatrix.needsUpdate = true
    }
  })

  const up = getLabel('PISO 2 ↑', { bg: '#d4842e', fg: '#fff', sub: 'Zona de comida' })
  const down = getLabel('PISO 1 ↓', { bg: '#0f766e', fg: '#fff', sub: 'Plaza y tiendas' })
  const rail = mat('#3a4450')
  const upSign = escToWorld(centerX + 2.6, ESCALATOR.bottomZ + 1.4)
  const downSign = escToWorld(centerX, ESCALATOR.topZ - 1.2)

  /** Subir o bajar según el piso en el que se esté. */
  const toggleFloor = () => {
    const ui = useUI.getState()
    ui.setFloor(ui.activeFloor === 'P2' && !ui.overview ? 'P1' : 'P2')
  }

  return (
    <group
      onClick={(e) => {
        if (cameraState.handMode || e.delta > 8) return
        e.stopPropagation()
        toggleFloor()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {/* todo en el marco de las escaleras (suben en diagonal hacia la esquina de la terraza) */}
      <group position={[ESCALATOR_FRAME.x, 0, ESCALATOR_FRAME.z]} rotation={[0, ESCALATOR_FRAME.angle, 0]}>
      {ESCALATOR.lanesX.map((lx) => (
        // El cuerpo corre a lo largo de z y sube hacia −z.
        <group key={lx} position={[lx, midY, midZ]} rotation={[angle, 0, 0]}>
          <mesh geometry={GEO.box} material={mat('#c9ccd1')} position={[0, -0.25, 0]} scale={[w, 0.5, length]} castShadow />
          {[-1, 1].map((s) => (
            <group key={s} position={[(s * w) / 2, 0.45, 0]}>
              <mesh geometry={GEO.box} material={GLASS} scale={[0.05, 0.85, length]} />
              <mesh geometry={GEO.box} material={rail} position={[0, 0.45, 0]} scale={[0.1, 0.07, length + 0.3]} />
              <mesh geometry={GEO.box} material={glowMat('#9fd8ff', 1.6, { dayGlow: 0.15 })} position={[0, -0.4, 0]} scale={[0.06, 0.04, length]} />
            </group>
          ))}
        </group>
      ))}
      <instancedMesh ref={steps} args={[GEO.box, mat('#8f959d'), STEPS * 2]} frustumCulled={false} />
      <instancedMesh ref={marks} args={[GEO.box, mat('#f5b544'), RAIL_MARKS * 4]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={riderBodies} args={[GEO.capsule, mat('#ffffff'), RIDERS]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={riderHeads} args={[GEO.sphereSmooth, mat('#ffffff'), RIDERS]} frustumCulled={false} raycast={() => null} />
      {/* rellanos: abajo en la plaza y arriba sobre la terraza */}
      <mesh geometry={GEO.rounded} material={mat(PALETTE.metal)} position={[centerX, FLOOR_TOP + 0.05, ESCALATOR.bottomZ + 0.8]} scale={[4.2, 0.1, 1.6]} receiveShadow />
      <mesh geometry={GEO.rounded} material={mat(PALETTE.metal)} position={[centerX, FLOOR_TOP + rise + 0.05, ESCALATOR.topZ - 0.6]} scale={[4.2, 0.1, 1.2]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat(PALETTE.metal)} position={[centerX + 2.6, 1.1, ESCALATOR.bottomZ + 1.4]} scale={[0.08, 2.2, 0.08]} />
      </group>
      {showUpSign && (
        <ScreenLabel label={up} position={[upSign[0], 2.8, upSign[1]]} pixelHeight={28} minZoomRatio={1.1} priority={LABEL_PRIORITY.section} onClick={() => useUI.getState().setFloor('P2')} />
      )}
      <DownSign label={down} position={[downSign[0], FLOOR_TOP + rise + 2.4, downSign[1]]} />
    </group>
  )
}

/** La señal de bajada solo se muestra cuando el piso activo es el 2. */
function DownSign({ label, position }: { label: ReturnType<typeof getLabel>; position: [number, number, number] }) {
  const floor = useUI((s) => s.activeFloor)
  const overview = useUI((s) => s.overview)
  if (floor !== 'P2' || overview) return null
  return <ScreenLabel label={label} position={position} pixelHeight={28} priority={LABEL_PRIORITY.section} onClick={() => useUI.getState().setFloor('P1')} />
}
