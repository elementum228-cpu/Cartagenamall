import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { COURT, FENCE_X, FENCE_Z, HALF_L, HALF_W } from '../../football/config'
import { COURT_COLOR } from '../../football/open'
import { COURT_SPACE } from '../../config/mall'
import { useSpacePrice } from '../../state/spacePricing'
import { formatCOP } from '../../lib/format'
import { Batch } from '../Batch'
import { ScreenLabel } from '../Billboard'
import { cameraState } from '../cameraState'
import { LABEL_PRIORITY } from '../labels'
import { getGlassPill, getLabel } from '../labelTexture'
import { GEO, PALETTE, mat } from '../materials'
import { dimLabelMat, glowMat, lightPoolMat } from '../night'
import { useIsNight } from '../../lib/useIsNight'

// Cancha sintética de fútbol 5 (estática, fusionada con Batch): césped a franjas, líneas,
// círculo central, áreas, dos arcos con red, cerramiento de malla con acceso lateral, bancas,
// cuatro torres de iluminación y el cartel CANCHA SINTÉTICA. Coordenadas locales: centro del campo.

const TURF = ['#3f9a4a', '#46a552']
const LINE = '#f4f6f2'
const NET = new THREE.MeshStandardMaterial({ color: '#1f2a2e', transparent: true, opacity: 0.42, roughness: 0.9, depthWrite: false, side: THREE.DoubleSide })
const GOAL_NET = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.38, roughness: 0.9, depthWrite: false, side: THREE.DoubleSide })
const RING = new THREE.RingGeometry(1.42, 1.52, 40)
const SPOT = new THREE.CircleGeometry(0.1, 12)
/** Puerta del cerramiento (lado que mira al pasillo B y a la cámara). */
const GATE_W = 1.6

export const COURT_TOWERS: [number, number][] = [
  [-FENCE_X - 0.25, -FENCE_Z - 0.25],
  [FENCE_X + 0.25, -FENCE_Z - 0.25],
  [-FENCE_X - 0.25, FENCE_Z + 0.25],
  [FENCE_X + 0.25, FENCE_Z + 0.25],
]

function Lines() {
  const lineMat = mat(LINE)
  const t = 0.07
  const y = 0.075
  const bar = (x: number, z: number, sx: number, sz: number, key: string) => <mesh key={key} geometry={GEO.box} material={lineMat} position={[x, y, z]} scale={[sx, 0.012, sz]} />
  return (
    <group>
      {bar(0, -HALF_W, COURT.length + t, t, 'l1')}
      {bar(0, HALF_W, COURT.length + t, t, 'l2')}
      {bar(-HALF_L, 0, t, COURT.width, 'l3')}
      {bar(HALF_L, 0, t, COURT.width, 'l4')}
      {bar(0, 0, t, COURT.width, 'mid')}
      <mesh geometry={RING} material={lineMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.007, 0]} />
      <mesh geometry={SPOT} material={lineMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.007, 0]} />
      {/* áreas: rectángulo frente a cada arco y punto penal */}
      {[-1, 1].map((s) => (
        <group key={s}>
          {bar(s * (HALF_L - 1.4), 0, t, 4.2, `a${s}`)}
          {bar(s * (HALF_L - 0.7), -2.1, 1.4, t, `b${s}`)}
          {bar(s * (HALF_L - 0.7), 2.1, 1.4, t, `c${s}`)}
          <mesh geometry={SPOT} material={lineMat} rotation={[-Math.PI / 2, 0, 0]} position={[s * (HALF_L - 2.3), y + 0.007, 0]} />
        </group>
      ))}
    </group>
  )
}

/** Arco de fútbol 5: postes, travesaño, soportes traseros y red. Mira hacia el centro. */
function Goal({ side }: { side: 1 | -1 }) {
  const { width: w, height: h, depth: d } = COURT.goal
  const post = mat('#f7f7f7', { rough: 0.4 })
  const x0 = side * HALF_L
  const back = side * (HALF_L + d)
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.cylinder} material={post} position={[x0, h / 2 + 0.06, (s * w) / 2]} scale={[0.07, h, 0.07]} castShadow />
          <mesh geometry={GEO.box} material={post} position={[(x0 + back) / 2, 0.08, (s * w) / 2]} scale={[d, 0.04, 0.04]} />
          <mesh geometry={GEO.box} material={post} position={[(x0 + back) / 2, h * 0.55, (s * w) / 2]} rotation={[0, 0, side * -0.9]} scale={[0.04, Math.hypot(d, h) * 0.95, 0.04]} />
          {/* red lateral */}
          <mesh geometry={GEO.plane} material={GOAL_NET} position={[(x0 + back) / 2, h / 2 + 0.05, (s * w) / 2]} scale={[d, h, 1]} />
        </group>
      ))}
      <mesh geometry={GEO.cylinder} material={post} position={[x0, h + 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.07, w + 0.07, 0.07]} castShadow />
      <mesh geometry={GEO.box} material={post} position={[back, 0.08, 0]} scale={[0.04, 0.04, w]} />
      {/* red trasera y superior */}
      <mesh geometry={GEO.plane} material={GOAL_NET} position={[back, h / 2 + 0.05, 0]} rotation={[0, Math.PI / 2, 0]} scale={[w, h, 1]} />
      <mesh geometry={GEO.plane} material={GOAL_NET} position={[(x0 + back) / 2, h + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[d, w, 1]} />
    </group>
  )
}

/** Cerramiento: postes, malla oscura semitransparente, baranda superior y puerta lateral. */
function Fence() {
  const H = COURT.fenceHeight
  const postMat = mat('#3a4450')
  const out: React.ReactNode[] = []
  const side = (axis: 'x' | 'z', fixed: number, from: number, to: number, key: string, gap?: [number, number]) => {
    const len = to - from
    const n = Math.max(1, Math.round(len / 1.6))
    for (let i = 0; i <= n; i++) {
      const u = from + (len * i) / n
      const [x, z] = axis === 'x' ? [u, fixed] : [fixed, u]
      out.push(<mesh key={`${key}p${i}`} geometry={GEO.cylinderLow} material={postMat} position={[x, H / 2, z]} scale={[0.07, H, 0.07]} />)
    }
    const segs: [number, number][] = gap ? [[from, gap[0]], [gap[1], to]] : [[from, to]]
    segs.forEach(([a, b], j) => {
      const mid = (a + b) / 2
      const L = b - a
      const pos: [number, number, number] = axis === 'x' ? [mid, H / 2, fixed] : [fixed, H / 2, mid]
      out.push(<mesh key={`${key}n${j}`} geometry={GEO.plane} material={NET} position={pos} rotation={[0, axis === 'x' ? 0 : Math.PI / 2, 0]} scale={[L, H - 0.1, 1]} />)
      out.push(<mesh key={`${key}r${j}`} geometry={GEO.box} material={postMat} position={[pos[0], H, pos[2]]} scale={axis === 'x' ? [L, 0.06, 0.06] : [0.06, 0.06, L]} />)
    })
  }
  side('x', -FENCE_Z, -FENCE_X, FENCE_X, 'n')
  side('x', FENCE_Z, -FENCE_X, FENCE_X, 's', [COURT.gateX - GATE_W / 2, COURT.gateX + GATE_W / 2])
  side('z', -FENCE_X, -FENCE_Z, FENCE_Z, 'w')
  side('z', FENCE_X, -FENCE_Z, FENCE_Z, 'e')
  return <group>{out}</group>
}

/** Torres de iluminación deportiva y la luz simulada sobre el césped (solo de noche). */
export function FootballCourtLighting() {
  const lamp = glowMat('#fff6e2', 2.6, { dayGlow: 0.15 })
  return (
    <group>
      {COURT_TOWERS.map(([x, z]) => {
        const ang = Math.atan2(-x, -z) // la luminaria mira al centro
        return (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh geometry={GEO.cylinderLow} material={mat('#5d6670')} position={[0, 0.25, 0]} scale={[0.4, 0.5, 0.4]} />
            <mesh geometry={GEO.cylinderLow} material={mat('#5d6670')} position={[0, 2.9, 0]} scale={[0.14, 5.8, 0.14]} castShadow />
            <group position={[0, 5.85, 0]} rotation={[0, ang, 0]}>
              <mesh geometry={GEO.box} material={mat('#2f3740')} scale={[0.95, 0.5, 0.18]} />
              <mesh geometry={GEO.box} material={lamp} position={[0, -0.02, 0.1]} rotation={[-0.5, 0, 0]} scale={[0.8, 0.38, 0.02]} />
            </group>
          </group>
        )
      })}
      {/* luz blanca cálida sobre el césped: cuatro halos que se superponen (el verde se conserva) */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={GEO.plane} material={lightPoolMat('#fff1d6', 0.3)} rotation={[-Math.PI / 2, 0, 0]} position={[sx * HALF_L * 0.45, 0.1, sz * HALF_W * 0.4]} scale={[COURT.length * 0.85, COURT.width * 1.05, 1]} />
        )),
      )}
    </group>
  )
}

/** Bancas fuera del cerramiento, del lado de la puerta (donde se sientan los acompañantes). */
export const COURT_BENCHES: [number, number][] = [
  [-3.4, FENCE_Z + 1.25],
  [3.4, FENCE_Z + 1.25],
]

/** Cartel de la cancha según su estado: operada por un negocio, libre o con solicitud en revisión. */
function courtSign(operator: string | null, pending: boolean, price: number) {
  if (operator) return getLabel('CANCHA SINTÉTICA', { bg: COURT_COLOR, fg: '#fff', sub: `${operator} · toca para reservar` })
  if (pending) return getLabel('EN REVISIÓN', { bg: '#f5b544', fg: '#3b2a05', sub: 'Cancha · solicitud enviada' })
  return getLabel('TU NEGOCIO AQUÍ', { bg: COURT_COLOR, fg: '#fff', sub: `Cancha sintética · ${formatCOP(price)}/mes` })
}

/**
 * Cancha completa. `selected` resalta el perímetro; `onOpen` abre su panel (al tocar la cancha o
 * su cartel). Sin negocio que la opere (`operator` null) queda vacía, con un tótem grande para
 * reclamarla. La geometría estática va en Batch: pocas llamadas de dibujo.
 */
export function FootballCourt({ selected, onOpen, interactive, operator, pending }: { selected: boolean; onOpen: () => void; interactive: boolean; operator: string | null; pending: boolean }) {
  const price = useSpacePrice(COURT_SPACE.id)
  const sign = courtSign(operator, pending, price)
  // rótulo flotante discreto (el cartel grande va sobre la malla y en el tótem)
  const night = useIsNight()
  const pill = getGlassPill('Cancha sintética', { dot: COURT_COLOR, dark: night, sub: operator ? `${operator} · reserva tu hora` : pending ? 'Solicitud en revisión' : `Disponible · ${formatCOP(price)}/mes` })
  const wood = mat(PALETTE.wood)
  return (
    <group position={[COURT.center[0], COURT.y, COURT.center[1]]} rotation={[0, COURT.rotation, 0]}>
      <group
        onClick={(e) => {
          if (!interactive || cameraState.handMode || e.delta > 8) return
          e.stopPropagation()
          onOpen()
        }}
        onPointerOver={() => interactive && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <Batch version={`cancha:${operator ?? ''}:${pending}:${price}`}>
          {/* base de concreto y césped a franjas */}
          <mesh geometry={GEO.box} material={mat('#cfc6b6')} position={[0, -0.04, 0]} scale={[2 * FENCE_X + 0.7, 0.14, 2 * FENCE_Z + 0.7]} receiveShadow />
          {Array.from({ length: 8 }, (_, i) => {
            const w = (2 * FENCE_X) / 8
            return <mesh key={i} geometry={GEO.box} material={mat(TURF[i % 2])} position={[-FENCE_X + w * (i + 0.5), 0.04, 0]} scale={[w + 0.002, 0.06, 2 * FENCE_Z]} receiveShadow />
          })}
          <Lines />
          <Goal side={-1} />
          <Goal side={1} />
          <Fence />
          {/* cartel físico sobre la malla, del lado de la puerta */}
          <mesh geometry={GEO.box} material={mat(pending && !operator ? '#f5b544' : COURT_COLOR)} position={[-4.4, 1.55, FENCE_Z + 0.05]} scale={[2.3 * sign.aspect * 0.42 + 0.12, 1.08, 0.05]} />
          <mesh geometry={GEO.plane} material={dimLabelMat(sign.texture)} position={[-4.4, 1.55, FENCE_Z + 0.085]} scale={[2.3 * sign.aspect * 0.42, 0.97, 1]} />
          {/* bancas para acompañantes */}
          {COURT_BENCHES.map(([x, z]) => (
            <group key={x} position={[x, 0, z]}>
              <mesh geometry={GEO.box} material={mat(PALETTE.trim)} position={[0, 0.2, 0]} scale={[1.5, 0.4, 0.4]} />
              <mesh geometry={GEO.rounded} material={wood} position={[0, 0.45, 0]} scale={[1.8, 0.1, 0.55]} />
              <mesh geometry={GEO.rounded} material={wood} position={[0, 0.75, 0.26]} scale={[1.8, 0.45, 0.1]} />
            </group>
          ))}
          <FootballCourtLighting />
        </Batch>
        {!operator && <ClaimTotem label={sign} pending={pending} />}
      </group>
      {/* resalte del perímetro al seleccionar la cancha */}
      {selected && (
        <group>
          {[
            [0, -FENCE_Z, 2 * FENCE_X, 0.08],
            [0, FENCE_Z, 2 * FENCE_X, 0.08],
            [-FENCE_X, 0, 0.08, 2 * FENCE_Z],
            [FENCE_X, 0, 0.08, 2 * FENCE_Z],
          ].map(([x, z, sx, sz], i) => (
            <mesh key={i} geometry={GEO.box} material={glowMat('#7fe7d0', 1.6, { dayGlow: 1 })} position={[x, COURT.fenceHeight + 0.06, z]} scale={[sx + 0.1, 0.08, sz + 0.1]} />
          ))}
        </group>
      )}
      <ScreenLabel label={pill} position={[0, COURT.fenceHeight + 2.6, FENCE_Z]} pixelHeight={36} maxZoomRatio={1.6} lit priority={LABEL_PRIORITY.corridor + 5} onClick={interactive ? onOpen : undefined} />
    </group>
  )
}

/** Tótem grande «TU NEGOCIO AQUÍ» frente a la puerta de la cancha libre, con anillo pulsante. */
function ClaimTotem({ label, pending }: { label: ReturnType<typeof getLabel>; pending: boolean }) {
  const ring = useRef<THREE.Mesh>(null)
  const totem = useRef<THREE.Group>(null)
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: pending ? '#f5b544' : COURT_COLOR, transparent: true, depthWrite: false, toneMapped: false }), [pending])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ring.current) {
      const p = (t * 0.6) % 1
      ring.current.scale.setScalar(1 + p * 1.6)
      ringMat.opacity = 0.55 * (1 - p)
    }
    if (totem.current) totem.current.rotation.y = Math.sin(t * 0.8) * 0.06
  })
  const S = 2.2
  const y = 3.4
  return (
    <group position={[0, 0, FENCE_Z + 1.5]}>
      <mesh ref={ring} geometry={GEO.ring} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} />
      <group ref={totem}>
        <mesh geometry={GEO.cylinder} material={mat(PALETTE.metal)} position={[0, y / 2, 0]} scale={[0.15, y, 0.15]} />
        <mesh geometry={GEO.cylinder} material={mat(PALETTE.trim)} position={[0, 0.06, 0]} scale={[1.2, 0.12, 1.2]} />
        <mesh geometry={GEO.rounded} material={glowMat(pending ? '#f5b544' : COURT_COLOR, 0.18, { dayGlow: 0.1 })} position={[0, y, 0]} scale={[(0.2 + 0.62 * label.aspect) * S, 0.82 * S, 0.12]} />
        {[1, -1].map((k) => (
          <mesh key={k} geometry={GEO.plane} material={dimLabelMat(label.texture)} position={[0, y, k * 0.066]} rotation={[0, k > 0 ? 0 : Math.PI, 0]} scale={[0.62 * label.aspect * S, 0.62 * S, 1]} />
        ))}
      </group>
    </group>
  )
}
