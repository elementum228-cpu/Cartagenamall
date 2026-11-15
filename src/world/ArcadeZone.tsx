import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARCADE_BRIDGE_LEN, ARCADE_CENTER, ARCADE_S, ARCADE_WALL_X, ENT_BRIDGE_Z, ENT_CENTER, ENT_HX } from '../entertainment/config'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, STONE, STONE_DARK, WallLantern } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { useArcadeUi, type ArcadeGameId } from '../arcade/store'
import { useUI } from '../state/ui'
import { Person } from './Person'
import { NeonRun, type NeonSeg } from './Neon'
import { Wanderers } from './Wanderers'

// Zona Arcade (aprobada; se ve con la Isla de Entretenimiento activada): una isla cuadrada al oeste de la Isla de Entretenimiento, unida
// por un puente de piedra a una puerta en su muralla oeste. Es un salón de juegos al aire libre: piso de tablero con confeti, tres bancos
// de máquinas (uno por juego), el cuarto de recompensas con su mostrador de premios y una plaza con el monumento del tiquete.
// Todavía no hay juegos nuevos ni canje: es solo la escena.

const Y = 0.12
const SEA = -0.5
const S = ARCADE_S // medio lado de la isla
const WALL_X = ARCADE_WALL_X // cara exterior de la muralla oeste de entretenimiento
const BRIDGE_LEN = ARCADE_BRIDGE_LEN
const BRIDGE_W = 3.2
/** Centro de la isla arcade (mundo). */
const AC = { x: ARCADE_CENTER[0], z: ARCADE_CENTER[1] }
const IRON = '#2f3438'

// colores de los tres juegos: vivos pero sin neón
const BLUE = '#3f8fd8'
const RED = '#e0525f'
const YELLOW = '#f0b530'
const TEAL = '#0d6b73'
const TERRA = '#d9733e'
const INK = '#1d2250'

/** Puntos de paseo de los visitantes (coordenadas de la isla): la plaza y el frente de cada banco de máquinas. */
const STROLL: [number, number][] = [
  [4, 0],
  [2, 3.4],
  [2, -3.4],
  [-1.5, 0],
  [-1, -5.6],
  [-1, 5.6],
  [-4.5, -2.2],
  [6.5, -3],
  [6.5, 3],
  [1, -7],
  [1, 7],
  [-4, 4.2],
  [-6, 3.6],
  [3.4, 4],
  [-2.2, 6.6],
]

/** Una máquina de arcade: cuerpo de color, paneles laterales, pantalla, tablero con palanca y botones, y marquesina. Su frente mira a +z. */
function Cabinet({ x, z = 0, color, dark, screen }: { x: number; z?: number; color: string; dark: string; screen: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.box} material={mat(dark)} position={[0, 0.7, -0.1]} scale={[1.05, 1.4, 0.95]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 1.9, -0.28]} scale={[1.05, 1.25, 0.6]} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat(color)} position={[s * 0.56, 1.1, -0.2]} scale={[0.1, 2.2, 1.05]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={glowMat(screen, 1.0, { dayGlow: 0.55 })} position={[0, 1.75, 0.03]} scale={[0.82, 0.62, 0.04]} />
      <mesh geometry={GEO.box} material={mat('#0a0d1f')} position={[0, 1.75, 0.0]} scale={[0.92, 0.72, 0.04]} />
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 1.2, 0.36]} rotation={[0.3, 0, 0]} scale={[1.0, 0.1, 0.5]} />
      <mesh geometry={GEO.cylinderLow} material={mat('#1b1b1b')} position={[-0.22, 1.32, 0.38]} scale={[0.05, 0.2, 0.05]} />
      <mesh geometry={GEO.sphere} material={mat('#d93d3d')} position={[-0.22, 1.46, 0.38]} scale={0.1} />
      {[0.08, 0.26, 0.4].map((b, i) => (
        <mesh key={b} geometry={GEO.sphere} material={mat(['#ffd34e', '#4de1ff', '#ff6fa6'][i])} position={[b + 0.06, 1.28, 0.42]} scale={0.07} />
      ))}
      <mesh geometry={GEO.box} material={glowMat(color, 1.0, { dayGlow: 0.5 })} position={[0, 2.62, -0.28]} scale={[1.05, 0.26, 0.62]} />
      {/* nave sobre la marquesina: la firma de este juego */}
      <mesh geometry={GEO.cylinder} material={mat('#f4eadb')} position={[0, 3.0, -0.28]} scale={[0.22, 0.6, 0.22]} castShadow />
      <mesh geometry={GEO.cylinder} material={mat('#d93d3d')} position={[0, 3.38, -0.28]} scale={[0.12, 0.2, 0.12]} />
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 2.85, -0.28]} scale={[0.7, 0.08, 0.3]} castShadow />
    </group>
  )
}

/** Mesa de «Cangrejos Locos»: una mesa baja y ancha con agujeros, cangrejos que asoman, un mazo y una cartelera atrás. Frente a +z. */
function MoleTable({ x, color, dark, screen }: { x: number; color: string; dark: string; screen: string }) {
  const holes: [number, number][] = [[-0.8, -0.3], [0, -0.3], [0.8, -0.3], [-0.8, 0.35], [0, 0.35], [0.8, 0.35]]
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={GEO.box} material={mat(dark)} position={[0, 0.45, 0]} scale={[2.6, 0.9, 1.7]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 0.94, 0.02]} scale={[2.75, 0.1, 1.85]} castShadow />
      <mesh geometry={GEO.box} material={mat('#2f6b3d')} position={[0, 1.0, 0.02]} scale={[2.4, 0.03, 1.5]} />
      {holes.map(([hx, hz], i) => (
        <group key={i} position={[hx, 1.02, hz]}>
          <mesh geometry={GEO.cylinder} material={mat('#10150f')} scale={[0.42, 0.03, 0.42]} />
          {i % 2 === 0 && (
            <group position={[0, 0.2, 0]}>
              <mesh geometry={GEO.sphere} material={mat(color)} scale={[0.34, 0.26, 0.3]} castShadow />
              {[-1, 1].map((sx) => (
                <mesh key={sx} geometry={GEO.sphere} material={mat('#f6a3a8')} position={[sx * 0.24, 0.1, 0.06]} scale={0.13} />
              ))}
              {[-1, 1].map((sx) => (
                <mesh key={`e${sx}`} geometry={GEO.sphere} material={mat('#ffffff')} position={[sx * 0.09, 0.18, 0.12]} scale={0.07} />
              ))}
            </group>
          )}
        </group>
      ))}
      {/* mazo apoyado al borde */}
      <group position={[1.55, 0.95, 0.9]} rotation={[0, 0.5, 0.15]}>
        <mesh geometry={GEO.cylinderLow} material={mat('#8a6a4a')} position={[0, 0.5, 0]} scale={[0.07, 1.0, 0.07]} />
        <mesh geometry={GEO.rounded} material={mat('#ffd34e')} position={[0, 1.05, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.34, 0.32, 0.34]} castShadow />
      </group>
      {/* cartelera atrás con el cangrejo */}
      <mesh geometry={GEO.box} material={mat(dark)} position={[0, 1.55, -0.78]} scale={[2.6, 1.2, 0.12]} castShadow />
      <mesh geometry={GEO.box} material={glowMat(screen, 1.0, { dayGlow: 0.55 })} position={[0, 1.55, -0.71]} scale={[2.3, 0.9, 0.04]} />
      <mesh geometry={GEO.sphere} material={mat(color)} position={[0, 1.55, -0.68]} scale={[0.7, 0.5, 0.1]} />
      <mesh geometry={GEO.box} material={glowMat(color, 1.0, { dayGlow: 0.5 })} position={[0, 2.22, -0.78]} scale={[2.6, 0.16, 0.14]} />
    </group>
  )
}

/** Máquina de «Bolos de coco» (tipo Skee-Ball): un carril inclinado que sube hacia un tablero de aros, con cocos en la bandeja. Frente a +z. */
function SkeeLane({ x, color, dark }: { x: number; color: string; dark: string }) {
  return (
    <group position={[x, 0, 0.4]}>
      <mesh geometry={GEO.box} material={mat(dark)} position={[0, 0.3, 0]} scale={[1.3, 0.6, 3.2]} castShadow receiveShadow />
      {/* carril: sube hacia el fondo */}
      <mesh geometry={GEO.box} material={mat('#b57a3a')} position={[0, 0.68, 0.1]} rotation={[0.12, 0, 0]} scale={[0.95, 0.1, 3.1]} castShadow />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={GEO.box} material={mat(color)} position={[sx * 0.55, 0.78, 0.1]} rotation={[0.12, 0, 0]} scale={[0.1, 0.22, 3.1]} castShadow />
      ))}
      {/* tablero de aros al fondo */}
      <mesh geometry={GEO.box} material={mat(dark)} position={[0, 1.55, -1.5]} scale={[1.4, 1.8, 0.22]} castShadow />
      {[['#e0525f', 0.62], ['#f4eadb', 0.46], ['#3f8fd8', 0.3], ['#f0b530', 0.16]].map(([c, r]) => (
        <mesh key={String(c)} geometry={GEO.cylinder} material={mat(String(c))} position={[0, 1.4, -1.38]} rotation={[Math.PI / 2, 0, 0]} scale={[Number(r) * 2, 0.05, Number(r) * 2]} />
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={GEO.cylinder} material={mat('#10150f')} position={[sx * 0.5, 2.05, -1.38]} rotation={[Math.PI / 2, 0, 0]} scale={[0.22, 0.05, 0.22]} />
      ))}
      <mesh geometry={GEO.box} material={glowMat(color, 1.0, { dayGlow: 0.5 })} position={[0, 2.55, -1.5]} scale={[1.4, 0.22, 0.26]} />
      {/* bandeja de cocos al frente */}
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 0.66, 1.9]} scale={[1.0, 0.1, 0.5]} />
      {[-0.25, 0.25].map((cx) => (
        <mesh key={cx} geometry={GEO.sphere} material={mat('#6b4423')} position={[cx, 0.84, 1.9]} scale={0.28} castShadow />
      ))}
    </group>
  )
}

/** Banco de máquinas contra un lado de la isla: n máquinas, un cartel arriba y una alfombrilla del color del juego. */
const BULB_ON = new THREE.MeshBasicMaterial({ color: '#fff3a0', toneMapped: false })
const BULB_OFF = new THREE.MeshBasicMaterial({ color: '#4a3d1a', toneMapped: false })

function Bank({ at, rot, n, color, dark, screen, label, sub, kind = 'upright', onOpen, reduceMotion }: { at: [number, number]; rot: number; n: number; color: string; dark: string; screen: string; label: string; sub: string; kind?: 'upright' | 'mole' | 'lane'; onOpen?: () => void; reduceMotion: boolean }) {
  const night = useIsNight()
  const group = useRef<THREE.Group>(null)
  const pool = useRef<THREE.Mesh>(null)
  const bulbs = useRef<(THREE.Mesh | null)[]>([])
  const phase = at[0] * 1.7
  const pill = useMemo(() => getGlassPill(label, { dot: color, sub, dark: night }), [label, sub, color, night])
  const pitch = kind === 'mole' ? 3.1 : kind === 'lane' ? 1.9 : 1.45
  const W = n * pitch + 0.4
  const nb = Math.max(6, Math.round(W / 0.55))
  // las máquinas vibran un poquito, las luces del frente corren y el charco de luz del piso late: el banco se ve «prendido»
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (group.current && !reduceMotion) {
      group.current.position.y = Y + Math.abs(Math.sin(t * 31 + phase)) * 0.016
      group.current.rotation.z = Math.sin(t * 27 + phase) * 0.005
    }
    if (pool.current) {
      const k = 1 + (reduceMotion ? 0 : 0.1 * Math.sin(t * 3 + phase))
      pool.current.scale.set((W + 2.4) * k, 5.4 * k, 1)
    }
    const step = reduceMotion ? 0 : Math.floor(t * 7)
    bulbs.current.forEach((m, i) => {
      if (m) m.material = (i + step) % 3 === 0 ? BULB_ON : BULB_OFF
    })
  })
  return (
    <group ref={group} position={[at[0], Y, at[1]]} rotation={[0, rot, 0]}>
      {Array.from({ length: n }, (_, i) => (
        kind === 'mole' ? <MoleTable key={i} x={(i - (n - 1) / 2) * pitch} color={color} dark={dark} screen={screen} /> : kind === 'lane' ? <SkeeLane key={i} x={(i - (n - 1) / 2) * pitch} color={color} dark={dark} /> : <Cabinet key={i} x={(i - (n - 1) / 2) * pitch} color={color} dark={dark} screen={screen} />
      ))}
      {/* taburetes redondos frente a las máquinas */}
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[(i - (n - 1) / 2) * pitch, 0, kind === 'mole' ? 1.5 : 1.55]}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 0.25, 0]} scale={[0.08, 0.5, 0.08]} />
          <mesh geometry={GEO.cylinder} material={mat(i % 2 ? '#f4eadb' : color)} position={[0, 0.55, 0]} scale={[0.5, 0.14, 0.5]} />
        </group>
      ))}
      {/* las máquinas iluminan el piso con el color de su juego */}
      <mesh ref={pool} geometry={GEO.plane} material={lightPoolMat(color, 2.1)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 1.6]} scale={[W + 2.4, 5.4, 1]} />
      {/* luces corredoras al frente del banco, como las de un escenario */}
      {Array.from({ length: nb }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            bulbs.current[i] = el
          }}
          geometry={GEO.sphere}
          material={BULB_OFF}
          position={[(i - (nb - 1) / 2) * (W / nb), 0.16, kind === 'lane' ? 2.35 : 2.2]}
          scale={0.13}
          raycast={() => null}
        />
      ))}
      <ScreenLabel label={pill} position={[0, 3.7, 0]} pixelHeight={30} maxZoomRatio={2.2} priority={LABEL_PRIORITY.store} onClick={onOpen} />
    </group>
  )
}

/** Cuarto de recompensas: edificio verde azulado con techo terracota a rayas, ventanilla dorada, estantes de premios y filas de cuerdas. */
function RewardsRoom({ at, rot }: { at: [number, number]; rot: number }) {
  const night = useIsNight()
  const pill = useMemo(() => getGlassPill('Recompensas', { dot: '#f4cd79', sub: 'Canjea tus tiquetes', dark: night }), [night])
  const prizes: [number, string][] = [[-1.9, '#ef7d57'], [-1.1, '#f4cd79'], [-0.3, '#7fd0c4'], [0.5, '#e0558a'], [1.3, '#9d8cf0'], [2.1, '#6fb6ee']]
  return (
    <group position={[at[0], Y, at[1]]} rotation={[0, rot, 0]}>
      <mesh geometry={GEO.box} material={mat(TEAL)} position={[0, 1.7, -1.0]} scale={[6.4, 3.4, 3.4]} castShadow receiveShadow />
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(i % 2 ? TERRA : '#f0b189')} position={[(i - 5) * 0.62, 3.55, -0.9]} scale={[0.62, 0.34, 4.0]} castShadow />
      ))}
      {/* estantes con premios de colores, visibles por la ventanilla */}
      <mesh geometry={GEO.box} material={mat('#06353a')} position={[0, 1.55, 0.72]} scale={[5.2, 1.7, 0.12]} />
      {[0.95, 1.55, 2.15].map((h) => (
        <mesh key={h} geometry={GEO.box} material={mat('#c9a46a')} position={[0, h, 0.82]} scale={[5, 0.07, 0.34]} />
      ))}
      {[0.95, 1.55, 2.15].flatMap((h, r) =>
        prizes.map(([px], i) => <mesh key={`${r}${i}`} geometry={GEO.rounded} material={mat(prizes[(i + r * 2) % prizes.length][1])} position={[px * 1.05 + (r % 2 ? 0.2 : 0), h + 0.2, 0.82]} scale={[0.42, 0.34, 0.3]} />),
      )}
      {/* mostrador dorado */}
      <mesh geometry={GEO.box} material={mat('#f4cd79')} position={[0, 0.5, 1.4]} scale={[5.6, 1.0, 0.7]} castShadow />
      <mesh geometry={GEO.box} material={mat('#8a6a1c')} position={[0, 1.04, 1.4]} scale={[5.8, 0.08, 0.84]} />
      {/* cartel del tiquete */}
      <group position={[0, 3.9, 0.9]}>
        <mesh geometry={GEO.rounded} material={glowMat('#f4cd79', 1.1, { dayGlow: 0.55 })} scale={[2.2, 0.8, 0.14]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.sphere} material={mat(TEAL)} position={[s * 1.1, 0, 0.02]} scale={0.24} />
        ))}
      </group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[s * 2.9, 0.5, 2.7]} scale={[0.07, 1, 0.07]} />
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[s * 1.5, 0.5, 2.7]} scale={[0.07, 1, 0.07]} />
          <mesh geometry={GEO.box} material={mat('#d9453d')} position={[s * 2.2, 0.9, 2.7]} scale={[1.4, 0.05, 0.05]} />
        </group>
      ))}
      <ScreenLabel label={pill} position={[0, 5.2, 0]} pixelHeight={30} maxZoomRatio={2.2} priority={LABEL_PRIORITY.store} />
    </group>
  )
}

/** Monumento de la plaza: un tiquete dorado gigante que gira despacio sobre un pedestal; alrededor, pufs de colores. */
function TicketMonument({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = reduceMotion ? 0.6 : clock.elapsedTime * 0.5
    ref.current.position.y = Y + 2.3 + (reduceMotion ? 0 : Math.sin(clock.elapsedTime * 1.2) * 0.12)
  })
  const pouf = ['#e0525f', '#f0b530', '#3f8fd8', '#7fd0c4']
  return (
    <group>
      <mesh geometry={GEO.cylinder} material={mat(INK)} position={[0, Y + 0.14, 0]} scale={[5.2, 0.16, 5.2]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#f0b530')} position={[0, Y + 0.24, 0]} scale={[4.4, 0.05, 4.4]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat(INK)} position={[0, Y + 0.27, 0]} scale={[4.1, 0.05, 4.1]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat(INK)} position={[0, Y + 0.7, 0]} scale={[1.4, 1.0, 1.4]} castShadow />
      <mesh geometry={GEO.cylinder} material={mat('#f0b530')} position={[0, Y + 1.25, 0]} scale={[1.6, 0.1, 1.6]} />
      <group ref={ref} userData={{ dynamic: true }}>
        <mesh geometry={GEO.rounded} material={glowMat('#ffd05a', 1.0, { dayGlow: 0.6 })} scale={[2.2, 1.3, 0.28]} castShadow />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.sphere} material={mat(INK)} position={[s * 1.1, 0, 0.01]} scale={0.38} />
        ))}
        <mesh geometry={GEO.box} material={mat('#8a6a1c')} position={[0, 0, 0.15]} scale={[1.3, 0.06, 0.02]} />
      </group>
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <mesh key={k} geometry={GEO.cylinder} material={mat(pouf[k])} position={[Math.cos(a) * 3.3, Y + 0.3, Math.sin(a) * 3.3]} scale={[0.95, 0.5, 0.95]} castShadow />
        )
      })}
    </group>
  )
}

function Palm({ x, z, h = 3.2, seed = 0 }: { x: number; z: number; h?: number; seed?: number }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(PALETTE.trunk)} position={[0, h / 2, 0]} rotation={[0.1, seed, 0]} scale={[0.3, h, 0.3]} castShadow />
      {Array.from({ length: 7 }, (_, k) => {
        const a = (k / 7) * Math.PI * 2 + seed
        return <mesh key={k} geometry={GEO.box} material={mat(k % 2 ? PALETTE.leafDark : '#5f9a58')} position={[Math.sin(a) * 0.8, h + 0.05, Math.cos(a) * 0.8]} rotation={[0.38, a, 0]} scale={[0.5, 0.08, 1.8]} castShadow />
      })}
    </group>
  )
}

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.3, 0]} scale={[0.09, 2.6, 0.09]} />
      <mesh geometry={GEO.sphere} material={glowMat(PALETTE.lamp, 2.0, { dayGlow: 0.5 })} position={[0, 2.65, 0]} scale={0.34} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.5)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[3.2, 3.2, 1]} />
    </group>
  )
}

/** Mármol claro: el mismo piso de la zona de joyería (losas blancas con vetas), liso y sin zonas aparte. */
function useMarble() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 ? '#fbf9f4' : '#eeeae0'
        g.fillRect(i * 64, j * 64, 64, 64)
        g.strokeStyle = 'rgba(150,150,160,0.28)'
        for (let k = 0; k < 3; k++) {
          g.beginPath()
          g.moveTo(i * 64 + ((k * 23 + i * 7) % 64), j * 64)
          g.bezierCurveTo(i * 64 + 20, j * 64 + 20, i * 64 + 44, j * 64 + 40, i * 64 + ((k * 31 + j * 11) % 64), j * 64 + 64)
          g.stroke()
        }
      }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set((S * 2) / 4, (S * 2) / 4)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.28, metalness: 0.08 })
  }, [])
}

function Floor() {
  const marble = useMarble()
  return <mesh geometry={GEO.box} material={marble} position={[0, Y + 0.02, 0]} scale={[S * 2, 0.06, S * 2]} receiveShadow />
}

/** Isla cuadrada: base de piedra, piso de tablero y muralla baja con almenas; el lado este (hacia el puente) queda abierto. */
function IslandBody() {
  const step = 1.25
  const per = Math.floor((S * 2) / step)
  const sides: { a: [number, number]; rot: number }[] = [
    { a: [-S + step / 2, -S + 0.35], rot: 0 }, // norte
    { a: [-S + step / 2, S - 0.35], rot: 0 }, // sur
    { a: [-S + 0.35, -S + step / 2], rot: Math.PI / 2 }, // oeste
    { a: [S - 0.35, -S + step / 2], rot: Math.PI / 2 }, // este (con puerta)
  ]
  return (
    <group>
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[0, (SEA - 0.3 + Y - 0.12) / 2, 0]} scale={[(S + 1.1) * 2, Y - 0.12 - SEA + 0.3, (S + 1.1) * 2]} receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, (Y - 0.04 + SEA) / 2, 0]} scale={[S * 2.1, Y - SEA - 0.04, S * 2.1]} castShadow receiveShadow />
      <Floor />
      {sides.map((sd, si) =>
        Array.from({ length: per }, (_, i) => {
          const along = i * step
          const px = sd.rot === 0 ? sd.a[0] + along : sd.a[0]
          const pz = sd.rot === 0 ? sd.a[1] : sd.a[1] + along
          if (si === 3 && Math.abs(pz) < 2.3) return null // puerta al puente
          const tall = si === 0 || si === 2
          return (
            <group key={`${si}${i}`} position={[px, Y, pz]} rotation={[0, sd.rot, 0]}>
              {/* los lados lejanos (norte y oeste) son altos como una muralla; los cercanos (sur y este) quedan bajos para ver el interior */}
              <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, tall ? 1.5 : 0.55, 0]} scale={[step + 0.02, tall ? 3.0 : 1.1, 0.9]} castShadow receiveShadow />
              <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, tall ? 3.04 : 1.14, 0]} scale={[step + 0.02, 0.12, 1.05]} />
              {tall && <mesh geometry={GEO.box} material={mat(STONE[1])} position={[0, 3.32, 0]} scale={[step + 0.02, 0.5, 0.6]} castShadow />}
              {i % 2 === 0 && <mesh geometry={GEO.box} material={mat(STONE[2])} position={[0, tall ? 3.8 : 1.5, 0]} scale={[0.85, 0.5, 0.6]} castShadow />}
            </group>
          )
        }),
      )}
      {/* torreones de esquina */}
      {[
        [-S, -S],
        [-S, S],
        [S, -S],
        [S, S],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[0, 2.5, 0]} scale={[2.9, 5.2, 2.9]} castShadow receiveShadow />
          <mesh geometry={GEO.cylinder} material={mat(CORDON)} position={[0, 5.15, 0]} scale={[3.15, 0.16, 3.15]} />
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2
            return <mesh key={k} geometry={GEO.box} material={mat(STONE[1])} position={[Math.cos(a) * 1.3, 5.5, Math.sin(a) * 1.3]} rotation={[0, -a, 0]} scale={[0.35, 0.5, 0.7]} castShadow />
          })}
          <mesh geometry={GEO.cylinder} material={mat(TERRA)} position={[0, 5.9, 0]} scale={[1.8, 0.7, 1.8]} castShadow />
        </group>
      ))}
      {/* rocas en la orilla */}
      {[[-S - 1.6, -3], [-S - 1.5, 5], [-4, S + 1.6], [4, -S - 1.6], [S + 1.5, 6.2], [6, S + 1.5]].map(([x, z], n) => (
        <mesh key={n} geometry={GEO.sphere} material={mat(STONE_DARK)} position={[x, SEA + 0.1, z]} scale={[1.6 + (n % 2), 0.9, 1.3]} />
      ))}
    </group>
  )
}

/** Letrero de píxeles «ARCADE» sobre el arco de entrada: letras de 5×5 puntos en colores distintos. */
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '11111', '10001', '10001'],
  R: ['11110', '10001', '11110', '10100', '10011'],
  C: ['01111', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '11111'],
}
function PixelSign({ text, y, z }: { text: string; y: number; z: number }) {
  const cols = [YELLOW, '#4de1ff', RED, YELLOW, '#7fd0c4', RED]
  const px = 0.2
  const gap = 0.3
  const total = text.length * (5 * px + gap) - gap
  return (
    <group position={[0, y, z]}>
      <mesh geometry={GEO.box} material={mat(INK)} position={[0, 0.5 * px * 5 - px * 2.5 + 0.0, -0.1]} scale={[total + 0.6, 5 * px + 0.5, 0.18]} castShadow />
      {text.split('').map((ch, li) =>
        FONT[ch].flatMap((row, r) =>
          row.split('').map((v, c) =>
            v === '1' ? (
              <mesh key={`${li}${r}${c}`} geometry={GEO.box} material={glowMat(cols[li % cols.length], 1.0, { dayGlow: 0.6 })} position={[-total / 2 + li * (5 * px + gap) + c * px + px / 2, (4 - r) * px, 0]} scale={[px * 0.92, px * 0.92, 0.1]} />
            ) : null,
          ),
        ),
      )}
    </group>
  )
}

/** Arco de entrada de la isla: dos pilares de piedra y el letrero de píxeles encima de la puerta al puente. */
function EntryArch() {
  return (
    <group position={[S - 0.35, Y, 0]} rotation={[0, Math.PI / 2, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat(STONE[0])} position={[s * 2.2, 1.6, 0]} scale={[0.9, 3.2, 0.9]} castShadow receiveShadow />
      ))}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, 3.45, 0]} scale={[5.3, 0.55, 0.9]} castShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 3.78, 0]} scale={[5.5, 0.12, 1.05]} />
      <PixelSign text="ARCADE" y={3.95} z={0.1} />
    </group>
  )
}

/** Puente de piedra entre la muralla de entretenimiento y la isla arcade (misma piedra y farolas que el puente principal). */
function ArcadeBridge() {
  const len = BRIDGE_LEN
  const x0 = WALL_X - len / 2 + 0.1
  const pw = BRIDGE_W
  const N = 14
  const sl = len / N
  const HUMP = 0.9
  const h = (u: number) => HUMP * Math.sin(Math.PI * u)
  return (
    <group position={[x0, 0, AC.z]}>
      {Array.from({ length: N }, (_, i) => {
        const u = (i + 0.5) / N
        const top = Y + h(u)
        const arch = Math.abs(u - 0.5) < 0.22
        const bottom = arch ? Y - 0.6 : SEA - 0.3
        const slope = Math.atan2(h((i + 1) / N) - h(i / N), sl)
        return (
          <group key={i} position={[(u - 0.5) * len, 0, 0]}>
            <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, (bottom + top) / 2, 0]} scale={[sl + 0.02, top - bottom, pw]} castShadow receiveShadow />
            <group position={[0, top, 0]} rotation={[0, 0, slope]}>
              <mesh geometry={GEO.box} material={mat('#e2cfa6')} scale={[sl + 0.06, 0.12, pw - 0.3]} receiveShadow />
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={GEO.box} material={mat(STONE[2])} position={[0, 0.35, s * (pw / 2 - 0.15)]} scale={[sl + 0.03, 0.7, 0.3]} castShadow />
              ))}
            </group>
          </group>
        )
      })}
      {[-1, 1].map((k) =>
        [-1, 1].map((s) => (
          <group key={`${k}${s}`} position={[k * (len / 2 - 0.4), Y + 0.1, s * (pw / 2 - 0.15)]}>
            <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, 0.6, 0]} scale={[0.5, 1.2, 0.5]} castShadow />
            <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.6, 0]} scale={[0.07, 0.8, 0.07]} />
            <mesh geometry={GEO.sphere} material={glowMat(PALETTE.lamp, 2.0, { dayGlow: 0.5 })} position={[0, 2.1, 0]} scale={0.3} />
          </group>
        )),
      )}
    </group>
  )
}

/** Puerta en la muralla oeste de entretenimiento: un hueco con arco (como el de la muralla del mall) que lleva al puente arcade. */
function WestGate() {
  const stone = mat(STONE[0])
  const D = 1.6
  return (
    <group position={[ENT_CENTER[0] - ENT_HX * 0.99, 0, AC.z]} rotation={[0, -Math.PI / 2, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={stone} position={[s * 1.4, 1.5, 0]} scale={[0.8, 3, D]} castShadow receiveShadow />
      ))}
      <mesh geometry={GEO.box} material={stone} position={[0, 3.35, 0]} scale={[3.6, 1.1, D]} castShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 3.95, 0]} scale={[3.8, 0.14, D + 0.1]} />
      <mesh geometry={GEO.box} material={mat('#3a2f28')} position={[0, 1.4, 0]} scale={[2, 2.8, D - 0.1]} />
      <mesh geometry={GEO.box} material={glowMat('#ffb86b', 1.2)} position={[0, 0.18, 0]} scale={[1.9, 0.04, D - 0.1]} />
      {[1, -1].map((f) => (
        <group key={f} rotation={[0, f === 1 ? 0 : Math.PI, 0]}>
          {[-1, 1].map((s) => (
            <WallLantern key={s} x={s * 1.9} y={2.5} z={D / 2 + 0.25} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Visitantes quietos jugando y en la fila del cuarto de recompensas. */
const PLAYERS: [number, number, string, number][] = [
  [-1.5, -5.4, '#e07a5f', 0], [0.6, -5.4, '#3d7ea6', 0.2],
  [-1.5, 5.4, '#f2cc8f', Math.PI], [0.6, 5.5, '#6c5b7b', Math.PI - 0.2],
  [6.8, -6.2, '#2a9d8f', -Math.PI / 2], [-5.6, 3.2, '#e9c46a', Math.PI / 2],
  [-5.6, 5.0, '#d9453d', Math.PI / 2], [3.4, 2.4, '#3d7ea6', -1.2],
]

/** Pista de baile con losetas que cambian de color al ritmo (cada una con su desfase), en el piso del salón. */
function DanceFloor({ at, cols = 4, rows = 3, reduceMotion }: { at: [number, number]; cols?: number; rows?: number; reduceMotion: boolean }) {
  const T = 1.15
  const mats = useMemo(() => Array.from({ length: cols * rows }, () => new THREE.MeshBasicMaterial({ color: '#ff2bd6', toneMapped: false })), [cols, rows])
  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    mats.forEach((m, i) => {
      const x = i % cols
      const z = Math.floor(i / cols)
      m.color.copy(tmp.setHSL((t * 0.12 + (x + z) * 0.11 + ((x * 7 + z * 3) % 5) * 0.04) % 1, 0.95, 0.5 + 0.1 * Math.sin(t * 3 + x * 1.3 + z)))
    })
  })
  return (
    <group position={[at[0], Y + 0.075, at[1]]}>
      <mesh geometry={GEO.box} material={mat('#10153a')} position={[0, -0.02, 0]} scale={[cols * T + 0.35, 0.04, rows * T + 0.35]} receiveShadow />
      {mats.map((m, i) => (
        <mesh key={i} geometry={GEO.box} material={m} position={[((i % cols) - (cols - 1) / 2) * T, 0.02, (Math.floor(i / cols) - (rows - 1) / 2) * T]} scale={[T - 0.08, 0.04, T - 0.08]} raycast={() => null} userData={{ dynamic: true }} />
      ))}
    </group>
  )
}

/** Máquina de peluches (grúa): vitrina de vidrio con premios de colores y un brazo que sube y baja. Frente a +z. */
function ClawMachine({ at, rot, color, reduceMotion }: { at: [number, number]; rot: number; color: string; reduceMotion: boolean }) {
  const claw = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!claw.current || reduceMotion) return
    const t = clock.elapsedTime
    claw.current.position.x = Math.sin(t * 0.9 + at[0]) * 0.28
    claw.current.position.y = 2.25 - (0.5 + 0.5 * Math.sin(t * 1.6 + at[0] * 2)) * 0.7
  })
  const prizes = ['#e0525f', '#f0b530', '#5fc9b8', '#d9669a', '#9d8cf0', '#6fb6ee']
  return (
    <group position={[at[0], Y, at[1]]} rotation={[0, rot, 0]}>
      <mesh geometry={GEO.box} material={mat('#232857')} position={[0, 0.45, 0]} scale={[1.3, 0.9, 1.3]} castShadow />
      <mesh geometry={GEO.box} material={mat('#cfe8f0', { opacity: 0.22, rough: 0.2 })} position={[0, 1.7, 0]} scale={[1.2, 1.6, 1.2]} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={GEO.box} material={mat(color)} position={[sx * 0.6, 1.7, sz * 0.6]} scale={[0.08, 1.7, 0.08]} />))}
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 2.62, 0]} scale={[1.34, 0.18, 1.34]} castShadow />
      <mesh geometry={GEO.box} material={glowMat(color, 1.2, { dayGlow: 0.55 })} position={[0, 2.84, 0]} scale={[1.34, 0.22, 1.34]} />
      {prizes.map((c, i) => (
        <mesh key={i} geometry={GEO.sphere} material={mat(c)} position={[((i % 3) - 1) * 0.34, 0.98 + Math.floor(i / 3) * 0.3, ((i * 5) % 3 - 1) * 0.2]} scale={0.26} />
      ))}
      <group ref={claw} position={[0, 2.25, 0]} userData={{ dynamic: true }}>
        <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 0.4, 0]} scale={[0.04, 0.8, 0.04]} />
        <mesh geometry={GEO.box} material={mat('#d9d9e0')} position={[0, 0, 0]} scale={[0.22, 0.12, 0.22]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={GEO.box} material={mat('#d9d9e0')} position={[s * 0.12, -0.12, 0]} rotation={[0, 0, s * 0.35]} scale={[0.05, 0.28, 0.05]} />
        ))}
      </group>
      <mesh geometry={GEO.box} material={mat('#10153a')} position={[0, 0.98, 0.68]} scale={[1.0, 0.1, 0.4]} />
      <mesh geometry={GEO.sphere} material={mat('#d93d3d')} position={[-0.25, 1.08, 0.7]} scale={0.1} />
      <mesh geometry={GEO.plane} material={lightPoolMat(color, 1.5)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 1.2]} scale={[3.6, 3.6, 1]} />
    </group>
  )
}

/** Mesa de hockey de aire: tablero azul con aros de neón, palas y el disco. */
function AirHockey({ at, rot }: { at: [number, number]; rot: number }) {
  return (
    <group position={[at[0], Y, at[1]]} rotation={[0, rot, 0]}>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={GEO.box} material={mat(IRON)} position={[sx * 1.05, 0.35, sz * 0.5]} scale={[0.1, 0.7, 0.1]} />))}
      <mesh geometry={GEO.box} material={mat('#e0525f')} position={[0, 0.78, 0]} scale={[2.5, 0.18, 1.4]} castShadow />
      <mesh geometry={GEO.box} material={mat('#3f8fd8')} position={[0, 0.9, 0]} scale={[2.2, 0.06, 1.1]} />
      <mesh geometry={GEO.box} material={mat('#f4eadb')} position={[0, 0.94, 0]} scale={[0.05, 0.02, 1.0]} />
      <mesh geometry={GEO.cylinder} material={mat('#f4eadb')} position={[0, 0.95, 0]} scale={[0.5, 0.02, 0.5]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.cylinder} material={mat('#f0b530')} position={[s * 0.8, 1.0, s * 0.1]} scale={[0.26, 0.1, 0.26]} />
          <mesh geometry={GEO.cylinder} material={mat('#10150f')} position={[s * 1.1, 0.95, 0]} scale={[0.3, 0.02, 0.5]} />
        </group>
      ))}
      <mesh geometry={GEO.cylinder} material={mat('#d93d3d')} position={[0.2, 0.97, 0.15]} scale={[0.16, 0.04, 0.16]} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#4de1ff', 1.4)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} scale={[4.2, 3.2, 1]} />
    </group>
  )
}

/** Globos de colores atados a un peso, que se mecen: ponen fiesta en las esquinas vacías. */
function Balloons({ at, reduceMotion }: { at: [number, number]; reduceMotion: boolean }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!g.current || reduceMotion) return
    g.current.rotation.z = Math.sin(clock.elapsedTime * 1.1 + at[0]) * 0.05
    g.current.rotation.x = Math.cos(clock.elapsedTime * 0.9 + at[1]) * 0.05
  })
  const cols = ['#e0525f', '#f0b530', '#3f8fd8', '#5fc9b8', '#d9669a']
  return (
    <group position={[at[0], Y, at[1]]}>
      <mesh geometry={GEO.cylinder} material={mat(IRON)} position={[0, 0.12, 0]} scale={[0.5, 0.24, 0.5]} />
      <group ref={g} position={[0, 0.2, 0]} userData={{ dynamic: true }}>
        {cols.map((c, i) => {
          const a = (i / cols.length) * Math.PI * 2
          const h = 2.4 + (i % 3) * 0.45
          return (
            <group key={i}>
              <mesh geometry={GEO.cylinderLow} material={mat('#c9c9d2')} position={[Math.cos(a) * 0.22, h / 2, Math.sin(a) * 0.22]} scale={[0.015, h, 0.015]} />
              <mesh geometry={GEO.sphereSmooth} material={mat(c)} position={[Math.cos(a) * 0.3, h + 0.28, Math.sin(a) * 0.3]} scale={[0.58, 0.7, 0.58]} castShadow />
            </group>
          )
        })}
      </group>
    </group>
  )
}

/** Los tres bancos de juego: dónde están, de qué tipo son y qué juego abren al tocarlos. */
const BANKS: { at: [number, number]; rot: number; n: number; kind: 'upright' | 'mole' | 'lane'; game: ArcadeGameId; color: string; dark: string; screen: string; label: string }[] = [
  { at: [-6.9, -S + 1.3], rot: 0, n: 3, kind: 'upright', game: 'nave', color: BLUE, dark: '#1b2c55', screen: '#7cc4ff', label: 'Nave Caribe' },
  { at: [-0.5, -S + 1.6], rot: 0, n: 2, kind: 'mole', game: 'cangrejos', color: RED, dark: '#4a1a24', screen: '#ff9aa6', label: 'Cangrejos Locos' },
  { at: [5.9, -S + 2.5], rot: 0, n: 2, kind: 'lane', game: 'bolos', color: YELLOW, dark: '#4a3a10', screen: '#ffe08a', label: 'Bolos de coco' },
]
const PITCH = { upright: 1.45, mole: 3.1, lane: 1.9 } as const

/** Neón del salón: tiras a ras de las paredes y el arco de entrada, con colores que recorren el arcoíris. */
const NEON: NeonSeg[] = [
  { at: [0, 0.6, -S + 0.85], len: S * 2 - 2.4, axis: 'x', hue: 0 },
  { at: [-S + 0.85, 0.6, 0], len: S * 2 - 2.4, axis: 'z', hue: 0.28 },
  { at: [0, 0.4, S - 0.85], len: S * 2 - 2.4, axis: 'x', hue: 0.58 },
  { at: [S - 0.85, 0.4, -5.9], len: 7.2, axis: 'z', hue: 0.8 },
  { at: [S - 0.85, 0.4, 5.9], len: 7.2, axis: 'z', hue: 0.12 },
  { at: [S - 0.9, 1.75, -2.1], len: 3.4, axis: 'y', hue: 0.45 },
  { at: [S - 0.9, 1.75, 2.1], len: 3.4, axis: 'y', hue: 0.45 },
  { at: [S - 0.9, 3.5, 0], len: 4.6, axis: 'z', hue: 0.7 },
  // anillo de neón alrededor del monumento (un octágono)
  ...Array.from({ length: 8 }, (_, k): NeonSeg => {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8
    return { at: [Math.cos(a) * 2.7, 0.3, Math.sin(a) * 2.7], len: 2.15, axis: 'x', hue: k / 8, rot: -(a + Math.PI / 2) }
  }),
]

function openGame(game: ArcadeGameId) {
  const ui = useUI.getState()
  if (ui.overview || ui.activeFloor !== 'P1') ui.setFloor('P1')
  useArcadeUi.getState().openGame(game)
}

/** Zona táctil de un banco (fuera del lote de piedra, para que reciba el toque): abre su juego. */
function BankHit({ b }: { b: (typeof BANKS)[number] }) {
  const W = b.n * PITCH[b.kind] + 0.6
  return (
    <group position={[b.at[0], Y, b.at[1]]} rotation={[0, b.rot, 0]}>
      <mesh
        position={[0, 1.4, 1.2]}
        onClick={(e) => {
          if (e.delta > 8) return
          e.stopPropagation()
          openGame(b.game)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <boxGeometry args={[W, 2.8, 3.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function ArcadeZone({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const label = useMemo(() => getGlassPill('Zona Arcade', { dot: YELLOW, sub: 'Juega y gana tiquetes', dark: night }), [night])
  return (
    <group>
      <Batch version="zona-arcade-2">
        <ArcadeBridge />
        <WestGate />
        <group position={[AC.x, 0, AC.z]}>
          <IslandBody />
          <EntryArch />
          <RewardsRoom at={[-S + 2.3, 0]} rot={Math.PI / 2} />
          <Palm x={S - 1.4} z={5.6} seed={0.4} />
          <Palm x={S - 1.4} z={7.4} h={2.8} seed={1.1} />
          <Lamp x={5.4} z={-3.2} />
          <Lamp x={5.4} z={3.2} />
          <Lamp x={-4.6} z={-4.4} />
          <Lamp x={-4.6} z={4.4} />
        </group>
      </Batch>
      <group position={[AC.x, 0, AC.z]}>
        <TicketMonument reduceMotion={reduceMotion} />
        {/* tres bancos de máquinas, uno por juego: fuera del lote de piedra porque vibran y tienen luces que corren */}
        {BANKS.map((b) => (
          <Bank key={b.game} at={b.at} rot={b.rot} n={b.n} kind={b.kind} color={b.color} dark={b.dark} screen={b.screen} label={b.label} sub="Toca para jugar" onOpen={() => openGame(b.game)} reduceMotion={reduceMotion} />
        ))}
        {BANKS.map((b) => (
          <BankHit key={b.game} b={b} />
        ))}
        <NeonRun reduceMotion={reduceMotion} segs={NEON} thick={0.17} />
        {/* la mitad sur del salón, antes vacía: pista de baile, grúas de peluches, hockey de aire y globos */}
        <DanceFloor at={[3.4, 5.4]} reduceMotion={reduceMotion} />
        <ClawMachine at={[-6.8, S - 2.0]} rot={Math.PI} color="#d9669a" reduceMotion={reduceMotion} />
        <ClawMachine at={[-4.9, S - 2.0]} rot={Math.PI} color="#5fc9b8" reduceMotion={reduceMotion} />
        <ClawMachine at={[-3.0, S - 2.0]} rot={Math.PI} color="#f0b530" reduceMotion={reduceMotion} />
        <AirHockey at={[-5.3, 5.2]} rot={0.35} />
        <Balloons at={[-S + 1.5, S - 1.5]} reduceMotion={reduceMotion} />
        <Balloons at={[S - 1.6, S - 1.5]} reduceMotion={reduceMotion} />
        <Balloons at={[S - 1.6, -S + 1.5]} reduceMotion={reduceMotion} />
        {PLAYERS.map(([x, z, color, rot], i) => (
          <group key={i} position={[x, Y, z]} rotation={[0, rot, 0]}>
            <Person color={color} skin={i % 2 ? '#c58c64' : '#e5b48f'} />
          </group>
        ))}
        {!reduceMotion && <Wanderers points={STROLL} count={9} y={Y} reach={9} speed={0.9} seed={7} />}
        <ScreenLabel label={label} position={[0, 7.8, 0]} pixelHeight={30} maxZoomRatio={1.6} priority={LABEL_PRIORITY.corridor + 5} />
      </group>
    </group>
  )
}

export const ARCADE_ZONE_AT = { x: AC.x, z: AC.z, bridgeZ: ENT_BRIDGE_Z }
