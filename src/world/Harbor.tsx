import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { useUI } from '../state/ui'
import { trackHarbor } from '../tourism/store'
import { BOATS, BOAT_IDS, HARBOR } from '../tourism/config'
import type { BoatConfig } from '../tourism/types'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { cameraState } from './cameraState'
import { CORDON, STONE, STONE_DARK, WallLantern } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, PALETTE, mat } from './materials'
import { glowMat, lightPoolMat } from './night'

// Muelle turístico: una puerta en arco abierta en la muralla del frente izquierdo, un muelle de
// madera hacia el mar y dos lanchas que se pueden tocar (planes de mar e islas / bahía al
// atardecer). Lo estático va en Batch; las lanchas, la gente y los indicadores se animan.

const H = HARBOR
const WT = 2.2
const WATER_Y = -0.5
const WOOD = '#9a6b45'
const WOOD_DARK = '#6e4a30'
const WOOD_LIGHT = '#b98a5e'
const ARCH_W = 2
const ARCH_H = 2.1
/** Fin del muelle (z) y su plataforma en T, donde se amarran las lanchas. */
const END_Z = H.outerZ + H.length

/** Pilotes del muelle (x, z), a los lados, cada ~2 unidades. */
const POSTS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let z = H.outerZ + 1.2; z <= END_Z - 0.3; z += 2.1) for (const s of [-1, 1]) out.push([H.x + s * (H.width / 2 + 0.05), z])
  for (const s of [-1, 1]) out.push([H.x + s * 2.35, END_Z + 0.6])
  return out
})()

/** Gente esperando en el muelle (x, z, color de ropa, giro). */
const WAITING: [number, number, string, number][] = [
  [H.x - 0.6, END_Z - 0.2, '#e07a5f', 0.6],
  [H.x + 0.7, END_Z + 0.4, '#3d7ea6', -2.4],
  [H.x + 1.6, END_Z + 0.9, '#f2cc8f', 2.8],
]

/** Puerta en arco sobre la muralla (local: la cara exterior mira a +z). */
function SeaGate() {
  const stone = mat(STONE[0])
  const trim = mat(CORDON)
  const dark = glowMat('#3a2f28', 0.25)
  const passage = glowMat('#ffb86b', 0.9)
  const D = WT + 0.5
  return (
    <group position={[H.x, 0, H.wallZ]}>
      {/* pilastras y dintel que sobresalen un poco de la muralla */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={stone} position={[s * (ARCH_W / 2 + 0.4), (ARCH_H + 0.3) / 2, 0]} scale={[0.8, ARCH_H + 0.3, D]} castShadow receiveShadow />
      ))}
      <mesh geometry={GEO.box} material={stone} position={[0, ARCH_H + 0.85, 0]} scale={[ARCH_W + 1.6, 1.1, D]} castShadow />
      <mesh geometry={GEO.box} material={trim} position={[0, ARCH_H + 1.45, 0]} scale={[ARCH_W + 1.8, 0.14, D + 0.1]} />
      {/* marco claro y vano en sombra, en las dos caras (capas separadas: sin parpadeo de cerca) */}
      {[1, -1].map((f) => (
        <group key={f} position={[0, 0, f * (D / 2)]} rotation={[0, f === 1 ? 0 : Math.PI, 0]}>
          <mesh geometry={GEO.halfDisc} material={trim} position={[0, ARCH_H, 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[ARCH_W / 2 + 0.22, 0.02, ARCH_W / 2 + 0.22]} />
          <mesh geometry={GEO.box} material={dark} position={[0, ARCH_H / 2, 0.05]} scale={[ARCH_W, ARCH_H, 0.02]} />
          <mesh geometry={GEO.halfDisc} material={dark} position={[0, ARCH_H, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[ARCH_W / 2, 0.02, ARCH_W / 2]} />
          <mesh geometry={GEO.box} material={passage} position={[0, 0.5, 0.08]} scale={[ARCH_W - 0.5, 0.9, 0.01]} />
        </group>
      ))}
      {/* faroles a los lados del arco y luz en el piso */}
      {[-1, 1].map((s) => (
        <WallLantern key={s} x={s * (ARCH_W / 2 + 0.95)} y={2.3} z={D / 2 + 0.25} />
      ))}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.75)} rotation={[-Math.PI / 2, 0, 0]} position={[0, H.deckY + 0.06, D / 2 + 1.6]} scale={[4.5, 3.5, 1]} />
    </group>
  )
}

/** Muelle: rellano de piedra, cubierta de tablones, pilotes, barandas de cuerda y paso interior. */
function Dock() {
  const len = H.length
  const planks = Math.round(len / 0.55)
  return (
    <group>
      {/* paso interior: de la plaza a la puerta */}
      <mesh geometry={GEO.box} material={mat(PALETTE.floorAlt)} position={[H.x, 0.03, H.wallZ - WT / 2 - 2.6]} scale={[ARCH_W + 0.6, 0.06, 5.2]} receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat(STONE_DARK)} position={[H.x + s * (ARCH_W / 2 + 0.45), 0.1, H.wallZ - WT / 2 - 2.6]} scale={[0.22, 0.2, 5.2]} />
      ))}
      {/* rellano de piedra al salir */}
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[H.x, H.deckY - 0.12, H.outerZ + 0.55]} scale={[ARCH_W + 1.8, 0.5, 1.2]} receiveShadow />
      {/* cubierta y tablones */}
      <mesh geometry={GEO.box} material={mat(WOOD)} position={[H.x, H.deckY - 0.08, H.outerZ + 1.1 + len / 2]} scale={[H.width, 0.16, len]} castShadow receiveShadow />
      {Array.from({ length: planks }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(i % 2 ? WOOD_LIGHT : WOOD)} position={[H.x, H.deckY + 0.01, H.outerZ + 1.35 + i * 0.55]} scale={[H.width - 0.06, 0.03, 0.42]} receiveShadow />
      ))}
      {/* plataforma en T del final */}
      <mesh geometry={GEO.box} material={mat(WOOD)} position={[H.x, H.deckY - 0.08, END_Z + 0.75]} scale={[5, 0.16, 1.7]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(WOOD_LIGHT)} position={[H.x, H.deckY + 0.01, END_Z + 0.75]} scale={[4.9, 0.03, 1.55]} receiveShadow />
      {/* pilotes con remate y barandas de cuerda entre ellos */}
      {POSTS.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <mesh geometry={GEO.cylinderLow} material={mat(WOOD_DARK)} position={[x, (WATER_Y - 0.8 + H.deckY + 0.75) / 2, z]} scale={[0.2, H.deckY + 0.75 - WATER_Y + 0.8, 0.2]} castShadow />
          <mesh geometry={GEO.cylinderLow} material={mat(CORDON)} position={[x, H.deckY + 0.78, z]} scale={[0.24, 0.06, 0.24]} />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat('#d9c39b')} position={[H.x + s * (H.width / 2 + 0.05), H.deckY + 0.52, H.outerZ + 1.2 + (END_Z - 0.3 - H.outerZ - 1.2) / 2]} scale={[0.04, 0.04, END_Z - H.outerZ - 1.5]} />
      ))}
      {/* farol al final del muelle */}
      <mesh geometry={GEO.cylinderLow} material={mat(WOOD_DARK)} position={[H.x - 2.35, H.deckY + 1.05, END_Z + 0.6]} scale={[0.14, 0.7, 0.14]} />
      <WallLantern x={H.x - 2.35} y={H.deckY + 1.55} z={END_Z + 0.6} />
      {/* bolardos y una caja de cuerda: detalles cálidos */}
      <mesh geometry={GEO.cylinderLow} material={mat('#3a3d42')} position={[H.x + 1.9, H.deckY + 0.14, END_Z + 0.3]} scale={[0.28, 0.28, 0.28]} />
      <mesh geometry={GEO.cylinder} material={mat('#d8c39c')} position={[H.x - 0.8, H.deckY + 0.1, H.outerZ + 2.2]} scale={[0.42, 0.18, 0.42]} />
    </group>
  )
}

/** Una persona en miniatura (mismo estilo que los visitantes del mall). */
function Person({ color, skin }: { color: string; skin: string }) {
  return (
    <group>
      <mesh geometry={GEO.capsule} material={mat(color)} position={[0, 0.43, 0]} castShadow />
      <mesh geometry={GEO.sphereSmooth} material={mat(skin)} position={[0, 0.95, 0]} scale={0.36} castShadow />
    </group>
  )
}

/** Gente en el muelle: tres esperan su lancha y una va y viene por la cubierta. */
function DockPeople({ reduceMotion }: { reduceMotion: boolean }) {
  const walker = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = walker.current
    if (!g || reduceMotion) return
    const span = END_Z - H.outerZ - 2.2
    const t = (clock.elapsedTime * 0.09) % 2
    const u = t < 1 ? t : 2 - t
    g.position.z = H.outerZ + 1.4 + u * span
    g.position.y = H.deckY + Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.03
    g.rotation.y = t < 1 ? 0 : Math.PI
  })
  return (
    <group>
      {WAITING.map(([x, z, c, r], i) => (
        <group key={i} position={[x, H.deckY, z]} rotation={[0, r, 0]}>
          <Person color={c} skin={i % 2 ? '#c58c64' : '#8d5a3b'} />
        </group>
      ))}
      <group ref={walker} position={[H.x + 0.45, H.deckY, H.outerZ + 2]}>
        <Person color="#81b29a" skin="#e5b48f" />
      </group>
    </group>
  )
}

/** Lancha turística: casco blanco con franja y toldo de color, amarrada al muelle; se puede tocar. */
function Boat({ boat, selected, reduceMotion }: { boat: BoatConfig; selected: boolean; reduceMotion: boolean }) {
  const body = useRef<THREE.Group>(null)
  const hit = useRef<THREE.Mesh>(null)
  const spot = useRef<THREE.Group>(null)
  const pulse = useRef<THREE.Mesh>(null)
  const rings = useRef<THREE.Mesh[]>([])
  const glow = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const color = boat.color
  const mats = useMemo(
    () => ({
      white: mat('#f7f5f1'),
      accent: mat(color),
      deck: mat(WOOD_LIGHT),
      seat: mat(color, { rough: 0.6 }),
      shadow: new THREE.MeshBasicMaterial({ color: '#0b3a40', transparent: true, opacity: 0.28, depthWrite: false }),
      ripple: [0, 1].map(() => new THREE.MeshBasicMaterial({ color: '#e9fffb', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })),
      spot: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
      spotFill: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }),
      pulse: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      glow: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    }),
    [color],
  )
  const [bx, bz] = boat.position
  const seed = bx * 1.7

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime
    const g = body.current
    if (g && !reduceMotion) {
      // flota: sube y baja y se mece apenas
      g.position.y = Math.sin(t * 1.3 + seed) * 0.06
      g.rotation.z = Math.sin(t * 1.1 + seed) * 0.025
      g.rotation.x = Math.sin(t * 0.9 + seed * 2) * 0.015
    }
    // ondas suaves que se abren alrededor del casco
    rings.current.forEach((r, i) => {
      const u = reduceMotion ? 0.5 : ((t * 0.35 + i * 0.5) % 1)
      r.scale.set(1.6 + u * 1.6, 2.6 + u * 1.8, 1)
      ;(r.material as THREE.MeshBasicMaterial).opacity = reduceMotion ? 0.12 : 0.28 * (1 - u)
    })
    // indicador y área táctil con un tamaño mínimo en pantalla (zoom = píxeles por unidad)
    const ppu = (camera as THREE.OrthographicCamera).zoom || 1
    const s = Math.max(0.55, 13 / ppu) * (hover || selected ? 1.15 : 1)
    spot.current?.scale.setScalar(s)
    // radio ≥ 24 px (toque de 48 px) sin invadir la otra lancha
    hit.current?.scale.setScalar(2 * THREE.MathUtils.clamp(24 / ppu, 1.6, 3))
    if (pulse.current) {
      const u = reduceMotion ? 0 : (t * 0.6) % 1
      pulse.current.scale.setScalar(1 + u * 1.4)
      mats.pulse.opacity = reduceMotion ? 0 : 0.55 * (1 - u)
    }
    mats.spotFill.color.set(selected ? color : '#ffffff')
    mats.glow.opacity = THREE.MathUtils.lerp(mats.glow.opacity, selected ? 0.35 : hover ? 0.18 : 0, 0.15)
    if (glow.current) glow.current.visible = mats.glow.opacity > 0.01
  })

  const open = () => {
    useUI.getState().openHarbor(boat.id)
    trackHarbor({ type: 'boat_open', boat: boat.id })
  }

  return (
    <group position={[bx, WATER_Y, bz]} rotation={[0, boat.rotation, 0]}>
      {/* sombra, brillo de selección y ondas sobre el agua */}
      <mesh geometry={GEO.sphere} material={mats.shadow} position={[0, 0.02, 0]} scale={[1.7, 0.02, 3.6]} />
      <mesh ref={glow} geometry={GEO.sphere} material={mats.glow} position={[0, 0.04, 0]} scale={[2.6, 0.02, 4.8]} visible={false} />
      {[0, 1].map((i) => (
        <mesh key={i} ref={(m) => void (m && (rings.current[i] = m))} geometry={GEO.ring} material={mats.ripple[i]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} />
      ))}
      <group ref={body}>
        {/* casco: cuerpo, proa en punta y franja de color */}
        <mesh geometry={GEO.box} material={mats.white} position={[0, 0.2, -0.15]} scale={[1.3, 0.55, 2.5]} castShadow />
        <mesh geometry={GEO.box} material={mats.white} position={[0, 0.2, 1.1]} rotation={[0, Math.PI / 4, 0]} scale={[0.92, 0.55, 0.92]} castShadow />
        <mesh geometry={GEO.box} material={mats.accent} position={[0, 0.06, -0.15]} scale={[1.34, 0.14, 2.52]} />
        <mesh geometry={GEO.box} material={mats.accent} position={[0, 0.06, 1.1]} rotation={[0, Math.PI / 4, 0]} scale={[0.95, 0.14, 0.95]} />
        <mesh geometry={GEO.box} material={mats.deck} position={[0, 0.49, -0.15]} scale={[1.08, 0.04, 2.3]} />
        {/* asientos, consola y toldo */}
        {[-0.75, 0.05].map((z) => (
          <mesh key={z} geometry={GEO.box} material={mats.seat} position={[0, 0.62, z]} scale={[0.95, 0.2, 0.3]} />
        ))}
        <mesh geometry={GEO.box} material={mats.white} position={[0, 0.75, 0.7]} scale={[0.6, 0.45, 0.35]} />
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={GEO.box} material={mats.white} position={[sx * 0.55, 0.95, -0.35 + sz * 0.65]} scale={[0.05, 0.9, 0.05]} />),
        )}
        <mesh geometry={GEO.box} material={mats.accent} position={[0, 1.42, -0.35]} scale={[1.3, 0.08, 1.6]} castShadow />
        <mesh geometry={GEO.box} material={mats.white} position={[0, 1.36, -0.35]} scale={[1.32, 0.04, 1.62]} />
      </group>
      {/* indicador táctil: anillo de color con centro y pulso lento, sobre el agua junto a la popa */}
      <group ref={spot} position={[0, 0.08, -2.05]}>
        <mesh ref={pulse} geometry={GEO.ring} material={mats.pulse} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={GEO.ring} material={mats.spot} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={GEO.sphere} material={mats.spotFill} scale={[0.95, 0.04, 0.95]} />
      </group>
      {/* área táctil generosa (invisible): lancha + indicador */}
      <mesh
        ref={hit}
        geometry={GEO.sphere}
        position={[0, 0.5, -0.4]}
        onClick={(e) => {
          if (cameraState.handMode || e.delta > 8) return
          e.stopPropagation()
          open()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Cuerdas de amarre: de un pilote de la T a la proa de cada lancha. */
function MooringLines() {
  const lines = useMemo(
    () =>
      BOAT_IDS.map((id, i) => {
        const b = BOATS[id]
        const from = new THREE.Vector3(H.x + (i === 0 ? -2.35 : 2.35), H.deckY + 0.7, END_Z + 0.6)
        const bow = new THREE.Vector3(b.position[0] + Math.sin(b.rotation) * 1.3, WATER_Y + 0.55, b.position[1] + Math.cos(b.rotation) * 1.3)
        const mid = from.clone().add(bow).multiplyScalar(0.5)
        const len = from.distanceTo(bow)
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), bow.clone().sub(from).normalize())
        return { mid, len, q }
      }),
    [],
  )
  return (
    <>
      {lines.map((l, i) => (
        <mesh key={i} geometry={GEO.cylinderLow} material={mat('#e3cfa6')} position={l.mid} quaternion={l.q} scale={[0.04, l.len, 0.04]} />
      ))}
    </>
  )
}

/** Muelle turístico completo, con su rótulo en el mapa. */
export function Harbor({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const selected = useUI((s) => s.harbor?.boat ?? null)
  const label = useMemo(() => getGlassPill('Muelle turístico', { dot: '#13b9ad', sub: 'Tours y experiencias', dark: night }), [night])
  return (
    <group>
      <Batch version="muelle">
        <SeaGate />
        <Dock />
        <MooringLines />
      </Batch>
      <DockPeople reduceMotion={reduceMotion} />
      {BOAT_IDS.map((id) => (
        <Boat key={id} boat={BOATS[id]} selected={selected === id} reduceMotion={reduceMotion} />
      ))}
      {!selected && <ScreenLabel
        label={label}
        position={[H.x, 7.4, H.wallZ + 0.5]}
        pixelHeight={30}
        maxZoomRatio={1.6}
        priority={LABEL_PRIORITY.corridor + 5}
      />}
    </group>
  )
}
