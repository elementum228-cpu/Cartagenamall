import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ENT_BRIDGE_Z, ENT_CENTER, ENT_HX } from '../entertainment/config'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, STONE, STONE_DARK, WallLantern } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { Person } from './Person'
import { Wanderers } from './Wanderers'

// Zona Arcade (propuesta de diseño, solo vista previa con «?arcade=1»): una isla cuadrada al oeste de la Isla de Entretenimiento, unida
// por un puente de piedra a una puerta en su muralla oeste. Es un salón de juegos al aire libre: piso de tablero con confeti, tres bancos
// de máquinas (uno por juego), el cuarto de recompensas con su mostrador de premios y una plaza con el monumento del tiquete.
// Todavía no hay juegos nuevos ni canje: es solo la escena.

const Y = 0.12
const SEA = -0.5
const S = 10 // medio lado de la isla
const WALL_X = ENT_CENTER[0] - ENT_HX * 0.99 - 0.45 // cara exterior de la muralla oeste de entretenimiento
const BRIDGE_LEN = 7
const BRIDGE_W = 3.2
/** Centro de la isla arcade (mundo). */
const AC = { x: WALL_X - BRIDGE_LEN - S + 0.6, z: ENT_CENTER[1] }
const IRON = '#2f3438'

// colores de los tres juegos: vivos pero sin neón
const BLUE = '#3f8fd8'
const RED = '#e0525f'
const YELLOW = '#f0b530'
const TEAL = '#0d6b73'
const TERRA = '#d9733e'
const INK = '#1d2250'

const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

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
    </group>
  )
}

/** Banco de máquinas contra un lado de la isla: n máquinas, un cartel arriba y una alfombrilla del color del juego. */
function Bank({ at, rot, n, color, dark, screen, label, sub }: { at: [number, number]; rot: number; n: number; color: string; dark: string; screen: string; label: string; sub: string }) {
  const night = useIsNight()
  const pill = useMemo(() => getGlassPill(label, { dot: color, sub, dark: night }), [label, sub, color, night])
  const pitch = 1.45
  const W = n * pitch + 0.4
  return (
    <group position={[at[0], Y, at[1]]} rotation={[0, rot, 0]}>
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 0.03, 1.5]} scale={[W + 0.6, 0.05, 3.2]} receiveShadow />
      <mesh geometry={GEO.box} material={mat('#f4eadb')} position={[0, 0.06, 1.5]} scale={[W + 0.2, 0.03, 2.8]} receiveShadow />
      {Array.from({ length: n }, (_, i) => (
        <Cabinet key={i} x={(i - (n - 1) / 2) * pitch} color={color} dark={dark} screen={screen} />
      ))}
      {/* taburetes redondos frente a las máquinas */}
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[(i - (n - 1) / 2) * pitch, 0, 1.55]}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 0.25, 0]} scale={[0.08, 0.5, 0.08]} />
          <mesh geometry={GEO.cylinder} material={mat(i % 2 ? '#f4eadb' : color)} position={[0, 0.55, 0]} scale={[0.5, 0.14, 0.5]} />
        </group>
      ))}
      <ScreenLabel label={pill} position={[0, 3.7, 0]} pixelHeight={30} maxZoomRatio={2.2} priority={LABEL_PRIORITY.store} />
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
      <mesh geometry={GEO.rounded} material={mat('#f4eadb')} position={[0, 0.06, 0.5]} scale={[8, 0.1, 5.8]} receiveShadow />
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

/** Piso de alfombra de salón de juegos: losetas índigo oscuras de tonos casi iguales y confeti de colores esparcido, como las alfombras de los arcades. */
function Floor() {
  const T = 1.25
  const n = Math.round((S * 2) / T)
  const tones = ['#272b52', '#2d3260', '#232748']
  const confetti = useMemo(() => {
    const cols = ['#e0525f', '#f0b530', '#3f8fd8', '#5fc9b8', '#d9669a', '#f4eadb']
    return Array.from({ length: 150 }, (_, i) => ({
      x: (rnd(i * 3 + 1) - 0.5) * (S * 2 - 1.2),
      z: (rnd(i * 5 + 2) - 0.5) * (S * 2 - 1.2),
      r: rnd(i + 9) * Math.PI,
      c: cols[i % cols.length],
      w: 0.16 + rnd(i + 4) * 0.2,
      tri: i % 3 === 0,
    }))
  }, [])
  return (
    <group>
      {Array.from({ length: n * n }, (_, k) => {
        const i = k % n
        const j = Math.floor(k / n)
        return <mesh key={k} geometry={GEO.box} material={mat(tones[Math.floor(rnd(k * 1.7 + 3) * 3)])} position={[-S + T / 2 + i * T, Y + 0.01, -S + T / 2 + j * T]} scale={[T - 0.03, 0.05, T - 0.03]} receiveShadow />
      })}
      {confetti.map((c, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(c.c)} position={[c.x, Y + 0.045, c.z]} rotation={[0, c.r, 0]} scale={c.tri ? [c.w * 0.5, 0.01, c.w] : [c.w, 0.01, c.w * 0.4]} />
      ))}
      {/* paseo crema del arco a la plaza y anillo claro alrededor del monumento */}
      <mesh geometry={GEO.box} material={mat('#e9dcc0')} position={[S / 2 + 1, Y + 0.06, 0]} scale={[S - 2, 0.03, 2.4]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#e9dcc0')} position={[0, Y + 0.06, 0]} scale={[6.4, 0.03, 6.4]} receiveShadow />
    </group>
  )
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
          return (
            <group key={`${si}${i}`} position={[px, Y, pz]} rotation={[0, sd.rot, 0]}>
              <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, 0.45, 0]} scale={[step + 0.02, 0.9, 0.7]} castShadow receiveShadow />
              <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, 0.93, 0]} scale={[step + 0.02, 0.09, 0.84]} />
              {i % 2 === 0 && <mesh geometry={GEO.box} material={mat(STONE[1])} position={[0, 1.2, 0]} scale={[0.8, 0.5, 0.5]} castShadow />}
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
          <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[0, 0.9, 0]} scale={[2.6, 2.1, 2.6]} castShadow receiveShadow />
          <mesh geometry={GEO.cylinder} material={mat(CORDON)} position={[0, 1.95, 0]} scale={[2.8, 0.14, 2.8]} />
          <mesh geometry={GEO.cylinder} material={mat(TERRA)} position={[0, 2.35, 0]} scale={[1.9, 0.7, 1.9]} />
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
          {/* tres bancos de máquinas, uno por juego */}
          <Bank at={[-1.2, -S + 1.2]} rot={0} n={4} color={BLUE} dark="#1b2c55" screen="#7cc4ff" label="Nave Caribe" sub="Zona Arcade" />
          <Bank at={[-1.2, S - 1.2]} rot={Math.PI} n={4} color={RED} dark="#4a1a24" screen="#ff9aa6" label="Cangrejos Locos" sub="Zona Arcade" />
          <Bank at={[S - 1.2, -6.2]} rot={-Math.PI / 2} n={3} color={YELLOW} dark="#4a3a10" screen="#ffe08a" label="Torre de Cocos" sub="Zona Arcade" />
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
