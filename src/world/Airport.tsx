import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { airportAnchor } from '../airport/anchor'
import { AIRPORT, PLANE, RUNWAY, TERMINAL, TOWER } from '../airport/config'
import { useIsNight } from '../lib/useIsNight'
import { useUI } from '../state/ui'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { cameraState } from './cameraState'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { Person } from './Person'

// Aeropuerto Cartagena Mall (propuesta de diseño): plataforma de piedra por fuera de la muralla este,
// terminal con fachada de vidrio que se enciende de noche y letrero en el techo, torre de control con
// baliza, un avión blanco con franja turquesa junto a la escalerilla, pista con luces de borde y gente
// con maletas. Al tocarlo aparece la invitación a volar a Isla Descuento.

const A = AIRPORT
const Y = A.deckY
const IRON = '#2f3437'
const WHITE = '#f4f1ea'
const TEAL = '#13b9ad'
const NAVY = '#16325c'

/** Letrero pintado en lienzo (fondo azul, avión y dos líneas de texto). */
function signMaterial() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 300
  const g = c.getContext('2d')!
  g.fillStyle = NAVY
  g.beginPath()
  g.roundRect(0, 0, 1024, 300, 48)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = '700 150px system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.fillText('✈', 50, 150)
  g.font = '800 104px system-ui, sans-serif'
  g.fillText('AEROPUERTO', 250, 110)
  g.fillStyle = '#9fe3dc'
  g.font = '600 64px system-ui, sans-serif'
  g.fillText('Cartagena Mall', 254, 215)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
}

/** Plataforma de piedra, plataforma de concreto, pista con marcas y luces. */
function Ground() {
  const W = A.x1 - A.x0
  const D = A.z1 - A.z0
  const cx = (A.x0 + A.x1) / 2
  const cz = (A.z0 + A.z1) / 2
  const runLen = RUNWAY.z1 - RUNWAY.z0
  const runZ = (RUNWAY.z0 + RUNWAY.z1) / 2
  const edgeLight = glowMat('#ffd58a', 2.6, { dayGlow: 0.35 })
  const endLight = glowMat('#7dff9c', 2.6, { dayGlow: 0.35 })
  return (
    <group>
      {/* bloque de piedra hasta el mar y borde claro */}
      <mesh geometry={GEO.box} material={mat('#bfb39b')} position={[cx, (Y - 1.4) / 2, cz]} scale={[W, Y + 1.4, D]} receiveShadow />
      <mesh geometry={GEO.box} material={mat('#9c8c70')} position={[cx, -0.75, cz]} scale={[W + 0.4, 0.5, D + 0.4]} />
      {/* plataforma de concreto claro */}
      <mesh geometry={GEO.box} material={mat('#d6d8d6')} position={[(A.x0 + RUNWAY.x - RUNWAY.width / 2) / 2, Y + 0.01, cz]} scale={[RUNWAY.x - RUNWAY.width / 2 - A.x0 - 0.2, 0.02, D - 0.6]} receiveShadow />
      {/* pista: asfalto, línea central discontinua, umbrales y luces de borde */}
      <mesh geometry={GEO.box} material={mat('#4a525b')} position={[RUNWAY.x, Y + 0.015, runZ]} scale={[RUNWAY.width, 0.03, runLen]} receiveShadow />
      {Array.from({ length: Math.floor((runLen - 6) / 2.6) }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={mat('#f4f1ea')} position={[RUNWAY.x, Y + 0.035, RUNWAY.z0 + 3 + i * 2.6 + 0.6]} scale={[0.14, 0.01, 1.2]} />
      ))}
      {[RUNWAY.z0 + 0.9, RUNWAY.z1 - 0.9].flatMap((z) =>
        [-1.4, -0.85, -0.3, 0.3, 0.85, 1.4].map((dx) => <mesh key={`${z}${dx}`} geometry={GEO.box} material={mat('#f4f1ea')} position={[RUNWAY.x + dx, Y + 0.035, z]} scale={[0.3, 0.01, 1.3]} />),
      )}
      {[-1, 1].flatMap((s) =>
        Array.from({ length: 13 }, (_, i) => (
          <mesh key={`${s}${i}`} geometry={GEO.sphere} material={edgeLight} position={[RUNWAY.x + s * (RUNWAY.width / 2 + 0.25), Y + 0.12, RUNWAY.z0 + (i * runLen) / 12]} scale={0.2} />
        )),
      )}
      {[-1.6, -0.8, 0, 0.8, 1.6].map((dx) => (
        <mesh key={dx} geometry={GEO.sphere} material={endLight} position={[RUNWAY.x + dx, Y + 0.12, RUNWAY.z1 + 0.4]} scale={0.18} />
      ))}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffd58a', 0.5)} rotation={[-Math.PI / 2, 0, 0]} position={[RUNWAY.x, Y + 0.05, runZ]} scale={[RUNWAY.width + 3, runLen, 1]} />
      {/* línea amarilla de rodaje: del avión a la pista */}
      <mesh geometry={GEO.box} material={mat('#f5c542')} position={[PLANE.x, Y + 0.03, (PLANE.z + RUNWAY.z1 - 2) / 2 + 1]} scale={[0.12, 0.01, RUNWAY.z1 - 2 - PLANE.z]} />
      <mesh geometry={GEO.box} material={mat('#f5c542')} position={[(PLANE.x + RUNWAY.x) / 2, Y + 0.03, RUNWAY.z1 - 1.4]} scale={[RUNWAY.x - PLANE.x, 0.01, 0.12]} />
      {/* borde claro sobre el agua */}
      {[
        [cx, A.z0 + 0.12, W, 0.25],
        [cx, A.z1 - 0.12, W, 0.25],
        [A.x1 - 0.12, cz, 0.25, D],
      ].map(([x, z, w, d]) => (
        <mesh key={`${x}${z}`} geometry={GEO.box} material={mat('#efe4cc')} position={[x, Y + 0.04, z]} scale={[w, 0.1, d]} />
      ))}
    </group>
  )
}

/** Terminal: volumen claro, fachada de vidrio cálida hacia el mar, alero oscuro y letrero en el techo. */
function Terminal() {
  const T = TERMINAL
  const sign = useMemo(() => signMaterial(), [])
  const glass = glowMat('#ffd9a0', 1.9, { dayGlow: 0.22 })
  const fx = T.x + T.w / 2
  return (
    <group>
      <mesh geometry={GEO.box} material={mat(WHITE)} position={[T.x, Y + T.h / 2, T.z]} scale={[T.w, T.h, T.d]} castShadow receiveShadow />
      {/* fachada de vidrio con parteluces */}
      <mesh geometry={GEO.box} material={glass} position={[fx + 0.02, Y + T.h / 2 - 0.15, T.z]} scale={[0.04, T.h - 0.9, T.d - 0.8]} />
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={mat('#3c4651')} position={[fx + 0.06, Y + T.h / 2 - 0.15, T.z - (T.d - 0.8) / 2 + (i * (T.d - 0.8)) / 8]} scale={[0.06, T.h - 0.9, 0.08]} />
      ))}
      {/* fachada lateral (frente) con ventanas */}
      <mesh geometry={GEO.box} material={glass} position={[T.x + 0.5, Y + T.h / 2 + 0.2, T.z + T.d / 2 + 0.02]} scale={[T.w - 2.2, 1.1, 0.04]} />
      {/* alero oscuro y marquesina sobre la entrada */}
      <mesh geometry={GEO.box} material={mat('#3c4651')} position={[T.x + 0.4, Y + T.h + 0.12, T.z]} scale={[T.w + 1.4, 0.24, T.d + 0.8]} castShadow />
      <mesh geometry={GEO.box} material={mat('#3c4651')} position={[fx + 1.1, Y + 2.3, T.z]} scale={[2.2, 0.12, 4.2]} />
      <mesh geometry={GEO.box} material={glowMat('#fff1c9', 1.4)} position={[fx + 1.1, Y + 2.22, T.z]} scale={[1.9, 0.02, 3.8]} />
      {/* letrero sobre el techo, mirando al mar */}
      <mesh geometry={GEO.box} material={mat(IRON)} position={[fx - 0.6, Y + T.h + 0.7, T.z]} scale={[0.12, 0.9, 4]} />
      <mesh geometry={GEO.plane} material={sign} position={[fx - 0.52, Y + T.h + 1.3, T.z]} rotation={[0, Math.PI / 2, 0]} scale={[5.4, 1.58, 1]} />
      {/* manga de abordaje hacia el avión */}
      <mesh geometry={GEO.box} material={mat('#d9dde2')} position={[(fx + PLANE.x - 0.7) / 2, Y + 1.7, PLANE.z + 1.6]} scale={[PLANE.x - 0.7 - fx, 0.9, 1]} castShadow />
      <mesh geometry={GEO.box} material={glass} position={[(fx + PLANE.x - 0.7) / 2, Y + 1.75, PLANE.z + 2.11]} scale={[PLANE.x - 1 - fx, 0.3, 0.02]} />
      <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[PLANE.x - 2.2, Y + 0.6, PLANE.z + 1.6]} scale={[0.18, 1.2, 0.18]} />
    </group>
  )
}

/** Torre de control con cabina de vidrio y baliza roja que parpadea. */
function Tower({ beacon }: { beacon: { current: THREE.Mesh | null } }) {
  const cab = glowMat('#bfe6ff', 1.8, { dayGlow: 0.3 })
  return (
    <group position={[TOWER.x, Y, TOWER.z]}>
      <mesh geometry={GEO.cylinder} material={mat('#3c4651')} position={[0, 0.3, 0]} scale={[2.6, 0.6, 2.6]} />
      <mesh geometry={GEO.cylinder} material={mat(WHITE)} position={[0, 3.6, 0]} scale={[1.4, 6.6, 1.4]} castShadow />
      <mesh geometry={GEO.cylinder} material={mat(TEAL)} position={[0, 5.2, 0]} scale={[1.48, 0.2, 1.48]} />
      <mesh geometry={GEO.cylinder} material={mat('#3c4651')} position={[0, 7.0, 0]} scale={[2.5, 0.25, 2.5]} />
      <mesh geometry={GEO.cylinder} material={cab} position={[0, 7.75, 0]} scale={[2.3, 1.2, 2.3]} />
      <mesh geometry={GEO.cylinder} material={mat('#3c4651')} position={[0, 8.45, 0]} scale={[2.7, 0.22, 2.7]} castShadow />
      <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 9.2, 0]} scale={[0.06, 1.3, 0.06]} />
      <mesh ref={beacon} geometry={GEO.sphereSmooth} position={[0, 9.9, 0]} scale={0.26}>
        <meshBasicMaterial color="#ff4d4d" toneMapped={false} transparent />
      </mesh>
    </group>
  )
}

/** Avión blanco de línea con franja turquesa (local: nariz hacia +z). */
function Airplane() {
  const white = mat('#fbfbfa', { rough: 0.45 })
  const teal = mat(TEAL, { rough: 0.5 })
  const dark = mat('#2c333b')
  const windows = glowMat('#cfe8ff', 1.6, { dayGlow: 0.15 })
  return (
    <group position={[PLANE.x, Y, PLANE.z]}>
      <mesh geometry={GEO.sphere} material={mat('#0b2a33', { opacity: 0.22 })} position={[0, 0.02, 0]} scale={[7, 0.02, 9]} />
      {/* fuselaje, nariz y cola */}
      <mesh geometry={GEO.cylinder} material={white} position={[0, 1.25, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 7, 1.15]} castShadow />
      <mesh geometry={GEO.sphereSmooth} material={white} position={[0, 1.25, 3.5]} scale={[1.15, 1.15, 1.9]} castShadow />
      <mesh geometry={GEO.cone} material={white} position={[0, 1.4, -4.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.15, 1.5, 1.0]} castShadow />
      <mesh geometry={GEO.box} material={mat('#1e2a33')} position={[0, 1.55, 4.05]} rotation={[0.5, 0, 0]} scale={[0.75, 0.22, 0.5]} />
      {/* franja turquesa y ventanillas */}
      <mesh geometry={GEO.box} material={teal} position={[0, 1.02, -0.2]} scale={[1.17, 0.13, 6.6]} />
      <mesh geometry={GEO.box} material={windows} position={[0, 1.42, 0]} scale={[1.17, 0.13, 5.4]} />
      {/* alas en flecha, motores y estabilizadores */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={white} position={[s * 1.95, 0.95, 0.1]} rotation={[0, s * 0.38, 0]} scale={[3.4, 0.1, 1.35]} castShadow />
          <mesh geometry={GEO.box} material={teal} position={[s * 3.55, 1.02, -0.55]} rotation={[0, s * 0.38, 0]} scale={[0.3, 0.12, 0.7]} />
          <mesh geometry={GEO.cylinder} material={white} position={[s * 1.75, 0.62, 0.75]} rotation={[Math.PI / 2, 0, 0]} scale={[0.55, 1.25, 0.55]} castShadow />
          <mesh geometry={GEO.cylinder} material={teal} position={[s * 1.75, 0.62, 1.38]} rotation={[Math.PI / 2, 0, 0]} scale={[0.58, 0.08, 0.58]} />
          <mesh geometry={GEO.box} material={white} position={[s * 0.95, 1.45, -3.85]} rotation={[0, s * 0.3, 0]} scale={[1.5, 0.08, 0.7]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={teal} position={[0, 2.35, -3.75]} rotation={[-0.45, 0, 0]} scale={[0.1, 1.6, 1.15]} castShadow />
      {/* tren de aterrizaje */}
      {[
        [0, 0.3, 2.8],
        [-0.9, 0.3, -0.2],
        [0.9, 0.3, -0.2],
      ].map(([x, y, z]) => (
        <mesh key={`${x}${z}`} geometry={GEO.cylinderLow} material={dark} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} scale={[0.36, 0.25, 0.36]} />
      ))}
      {/* escalerilla en la puerta del lado del mar */}
      <mesh geometry={GEO.box} material={mat('#e9e4d8')} position={[1.25, 0.55, 2.0]} rotation={[0, 0, 0.62]} scale={[1.7, 0.12, 0.7]} />
      {/* luces de punta de ala */}
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#ff4d4d', 2.4, { dayGlow: 0.4 })} position={[-3.45, 1.0, -0.9]} scale={0.14} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#3ddc84', 2.4, { dayGlow: 0.4 })} position={[3.45, 1.0, -0.9]} scale={0.14} />
    </group>
  )
}

/** Faroles de la plataforma, carro de maletas y bancas. */
function Extras() {
  return (
    <group>
      {[
        [A.x0 + 1.2, A.z1 - 1.2],
        [A.x0 + 8.4, A.z1 - 1.2],
        [A.x0 + 8.4, A.z0 + 1.2],
        [RUNWAY.x - RUNWAY.width / 2 - 0.7, -8],
        [RUNWAY.x - RUNWAY.width / 2 - 0.7, 4],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, Y, z]}>
          <mesh geometry={GEO.cylinderLow} material={mat(IRON)} position={[0, 1.6, 0]} scale={[0.1, 3.2, 0.1]} />
          <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffd58a', 2.6, { dayGlow: 0.5 })} position={[0, 3.3, 0]} scale={0.42} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={[4.2, 4.2, 1]} />
        </group>
      ))}
      {/* carrito de equipaje con maletas de colores */}
      <group position={[PLANE.x - 2.8, Y, PLANE.z - 3.6]} rotation={[0, 0.3, 0]}>
        <mesh geometry={GEO.box} material={mat('#3c4651')} position={[0, 0.35, 0]} scale={[1.2, 0.12, 2]} />
        {[
          [-0.3, 0.6, -0.5, '#e07a5f'],
          [0.3, 0.6, -0.4, TEAL],
          [-0.2, 0.62, 0.4, '#f2cc8f'],
          [0.3, 0.6, 0.5, NAVY],
        ].map(([x, y, z, c]) => (
          <mesh key={`${x}${z}`} geometry={GEO.box} material={mat(c as string)} position={[x as number, y as number, z as number]} scale={[0.45, 0.4, 0.6]} />
        ))}
      </group>
      {/* bancas frente a la terminal */}
      {[-3.5, 3.5].map((dz) => (
        <group key={dz} position={[TERMINAL.x + TERMINAL.w / 2 + 2.6, Y, TERMINAL.z + dz]}>
          <mesh geometry={GEO.box} material={mat('#8a5a3a')} position={[0, 0.3, 0]} scale={[0.5, 0.1, 1.8]} />
          <mesh geometry={GEO.box} material={mat(IRON)} position={[0, 0.13, 0]} scale={[0.3, 0.26, 1.5]} />
        </group>
      ))}
    </group>
  )
}

/** Viajeros con maleta: unos esperan frente a la terminal y otros caminan hacia la manga. */
function Travelers({ reduceMotion }: { reduceMotion: boolean }) {
  const walkers = useRef<(THREE.Group | null)[]>([])
  const fx = TERMINAL.x + TERMINAL.w / 2
  const routes = useMemo(
    () => [
      { from: [fx + 1.4, TERMINAL.z - 4] as const, to: [fx + 1.4, TERMINAL.z + 4] as const, speed: 0.06, phase: 0, c: '#e07a5f', bag: TEAL },
      { from: [fx + 2.2, TERMINAL.z + 4.5] as const, to: [fx + 2.2, TERMINAL.z - 4.5] as const, speed: 0.05, phase: 0.7, c: '#3d7ea6', bag: '#f2cc8f' },
    ],
    [fx],
  )
  useFrame(({ clock }) => {
    if (reduceMotion) return
    routes.forEach((r, i) => {
      const g = walkers.current[i]
      if (!g) return
      const t = (clock.elapsedTime * r.speed + r.phase) % 2
      const u = t < 1 ? t : 2 - t
      g.position.set(r.from[0] + (r.to[0] - r.from[0]) * u, Y + Math.abs(Math.sin(clock.elapsedTime * 6 + i)) * 0.03, r.from[1] + (r.to[1] - r.from[1]) * u)
      g.rotation.y = Math.atan2(r.to[0] - r.from[0], r.to[1] - r.from[1]) + (t < 1 ? 0 : Math.PI)
    })
  })
  const waiting: [number, number, string, string, number][] = [
    [fx + 2.6, TERMINAL.z - 2.2, '#f2cc8f', '#e07a5f', 1.6],
    [fx + 2.9, TERMINAL.z + 2.1, '#6c5b7b', TEAL, 1.4],
    [fx + 3.4, TERMINAL.z + 0.2, '#2a9d8f', NAVY, -2],
  ]
  return (
    <group>
      {waiting.map(([x, z, c, bag, r], i) => (
        <group key={i} position={[x, Y, z]} rotation={[0, r, 0]}>
          <Person color={c} skin={['#e5b48f', '#8d5a3b', '#c58c64'][i % 3]} />
          <mesh geometry={GEO.box} material={mat(bag)} position={[0.35, 0.28, 0]} scale={[0.3, 0.45, 0.42]} />
        </group>
      ))}
      {routes.map((r, i) => (
        <group key={i} ref={(g) => void (walkers.current[i] = g)} position={[r.from[0], Y, r.from[1]]}>
          <Person color={r.c} skin={i ? '#c58c64' : '#e5b48f'} />
          <mesh geometry={GEO.box} material={mat(r.bag)} position={[0.35, 0.28, -0.2]} scale={[0.3, 0.45, 0.42]} />
        </group>
      ))}
    </group>
  )
}

export function Airport({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const open = useUI((s) => s.airportOpen)
  const beacon = useRef<THREE.Mesh>(null)
  const label = useMemo(() => getGlassPill('Aeropuerto', { dot: '#f5c542', sub: 'Vuelos a Isla Descuento', dark: night }), [night])
  const anchor = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock, camera, gl }) => {
    // ancla de la invitación (en pantalla) sobre la terminal
    anchor.set(TERMINAL.x + 2.5, 10, TERMINAL.z - 1).project(camera)
    const r = gl.domElement.getBoundingClientRect()
    airportAnchor.x = r.left + ((anchor.x + 1) / 2) * r.width
    airportAnchor.y = r.top + ((1 - anchor.y) / 2) * r.height
    airportAnchor.visible = anchor.z < 1
    const m = beacon.current?.material as THREE.MeshBasicMaterial | undefined
    if (m) m.opacity = reduceMotion ? 1 : 0.25 + 0.75 * (Math.sin(clock.elapsedTime * 3) > 0.3 ? 1 : 0)
  })
  const toggle = () => useUI.getState().openAirport(!useUI.getState().airportOpen)
  return (
    <group>
      <Batch version="aeropuerto">
        <Ground />
        <Terminal />
        <Airplane />
        <Extras />
      </Batch>
      <Tower beacon={beacon} />
      <Travelers reduceMotion={reduceMotion} />
      {/* área táctil: terminal, torre y avión */}
      <mesh
        geometry={GEO.box}
        position={[(A.x0 + RUNWAY.x) / 2, 2.5, (A.z0 + A.z1) / 2]}
        scale={[RUNWAY.x - A.x0, 5, A.z1 - A.z0]}
        onClick={(e) => {
          if (cameraState.handMode || e.delta > 8) return
          e.stopPropagation()
          toggle()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {!open && <ScreenLabel label={label} position={[TERMINAL.x + 1, 9.5, TERMINAL.z]} pixelHeight={30} maxZoomRatio={2.2} priority={LABEL_PRIORITY.corridor + 6} onClick={toggle} />}
    </group>
  )
}
