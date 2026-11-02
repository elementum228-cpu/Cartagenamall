import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { airportAnchor } from '../airport/anchor'
import { LANDING_MS, TAKEOFF_MS, TAXI_FRAC, TOUCHDOWN, useFlight } from '../airport/flight'
import { AIRPORT, AIRPORT_GATE_Z, PLANE, RUNWAY, TERMINAL, TOWER } from '../airport/config'
import { CORDON, Garita, STONE, STONE_DARK, WallLantern } from './Fortress'
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
import { RunwayLights } from './RunwayLights'

// Aeropuerto MallPlay (propuesta de diseño): plataforma de piedra por fuera de la muralla este,
// terminal con fachada de vidrio que se enciende de noche y letrero en el techo, torre de control con
// baliza, un avión blanco con franja turquesa junto a la escalerilla, pista con luces de borde y gente
// con maletas. Al tocarlo aparece la invitación a volar a Isla Tecnología.

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
  g.fillText('MallPlay', 254, 215)
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
  const edgeLight = mat('#cfd4da')
  const endLight = mat('#cfd4da')
  return (
    <group>
      {/* baluarte de piedra hasta el mar: zócalo en talud, muro y cordón (como la muralla) */}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[cx, (Y - 1.5) / 2, cz]} scale={[W, Y + 1.5, D]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[cx + 0.3, -0.9, cz]} scale={[W + 0.6, 1.2, D + 1.2]} />
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[cx + 0.15, -0.15, cz]} scale={[W + 0.3, 0.3, D + 0.6]} />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[cx + 0.06, Y - 0.25, cz]} scale={[W + 0.12, 0.16, D + 0.12]} />
      {/* troneras en los muros que dan al mar */}
      {[-14, -6, 2].map((z) => (
        <mesh key={z} geometry={GEO.box} material={mat('#4a3a2c')} position={[A.x1 + 0.01, Y / 2 - 0.2, z]} scale={[0.04, 0.6, 0.3]} />
      ))}
      {[36, 42].map((x) => (
        <mesh key={x} geometry={GEO.box} material={mat('#4a3a2c')} position={[x, Y / 2 - 0.2, A.z1 + 0.01]} scale={[0.3, 0.6, 0.04]} />
      ))}
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
      <mesh geometry={GEO.plane} material={lightPoolMat('#7fb4ff', 0.35)} rotation={[-Math.PI / 2, 0, 0]} position={[RUNWAY.x, Y + 0.05, runZ]} scale={[RUNWAY.width + 3, runLen, 1]} />
      {/* línea amarilla de rodaje: del avión a la pista */}
      <mesh geometry={GEO.box} material={mat('#f5c542')} position={[PLANE.x, Y + 0.03, (PLANE.z + RUNWAY.z1 - 2) / 2 + 1]} scale={[0.12, 0.01, RUNWAY.z1 - 2 - PLANE.z]} />
      <mesh geometry={GEO.box} material={mat('#f5c542')} position={[(PLANE.x + RUNWAY.x) / 2, Y + 0.03, RUNWAY.z1 - 1.4]} scale={[RUNWAY.x - PLANE.x, 0.01, 0.12]} />
      {/* parapeto con almenas en los bordes del mar (como las murallas) */}
      {(
        [
          [A.x1 - 0.25, cz, 0.5, D, 'z'],
          [cx, A.z0 + 0.25, W, 0.5, 'x'],
          [cx, A.z1 - 0.25, W, 0.5, 'x'],
        ] as [number, number, number, number, 'x' | 'z'][]
      ).map(([x, z, w, d, along]) => {
        const len = along === 'z' ? d : w
        const n = Math.floor(len / 1.6)
        return (
          <group key={`${x}${z}`}>
            <mesh geometry={GEO.box} material={mat(STONE[1])} position={[x, Y + 0.2, z]} scale={[w, 0.4, d]} castShadow />
            {Array.from({ length: n }, (_, k) => {
              const off = (k - (n - 1) / 2) * 1.6
              return <mesh key={k} geometry={GEO.box} material={mat(STONE[1])} position={[x + (along === 'x' ? off : 0), Y + 0.62, z + (along === 'z' ? off : 0)]} scale={along === 'z' ? [0.5, 0.45, 0.85] : [0.85, 0.45, 0.5]} castShadow />
            })}
          </group>
        )
      })}
      {/* garitas en las esquinas del mar */}
      <Garita x={A.x1 - 0.6} z={A.z0 + 0.6} y={Y + 0.35} />
      <Garita x={A.x1 - 0.6} z={A.z1 - 0.6} y={Y + 0.35} />
      {/* puerta en la muralla: del mall al aeropuerto */}
      <AirGate />
    </group>
  )
}

/** Puerta en arco en la muralla (cara exterior, mira al mar), con faroles y el pasaje encendido. */
function AirGate() {
  const stone = mat(STONE[0])
  const trim = mat(CORDON)
  const dark = glowMat('#3a2f28', 0.25)
  const passage = glowMat('#ffb86b', 1.4)
  const W = 2
  const Hh = 2.3
  return (
    <group position={[A.x0 + 0.25, Y, AIRPORT_GATE_Z]} rotation={[0, Math.PI / 2, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={stone} position={[s * (W / 2 + 0.4), (Hh + 0.3) / 2, 0]} scale={[0.8, Hh + 0.3, 0.6]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={stone} position={[0, Hh + 0.75, 0]} scale={[W + 1.6, 0.9, 0.6]} castShadow />
      <mesh geometry={GEO.box} material={trim} position={[0, Hh + 1.25, 0]} scale={[W + 1.8, 0.14, 0.7]} />
      <mesh geometry={GEO.halfDisc} material={trim} position={[0, Hh, 0.31]} rotation={[Math.PI / 2, 0, 0]} scale={[W / 2 + 0.22, 0.02, W / 2 + 0.22]} />
      <mesh geometry={GEO.box} material={dark} position={[0, Hh / 2, 0.32]} scale={[W, Hh, 0.02]} />
      <mesh geometry={GEO.halfDisc} material={dark} position={[0, Hh, 0.33]} rotation={[Math.PI / 2, 0, 0]} scale={[W / 2, 0.02, W / 2]} />
      <mesh geometry={GEO.box} material={passage} position={[0, 0.55, 0.35]} scale={[W - 0.5, 1, 0.01]} />
      {[-1, 1].map((s) => (
        <WallLantern key={s} x={s * (W / 2 + 0.95)} y={2.3} z={0.55} />
      ))}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.75)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 1.8]} scale={[4, 3.4, 1]} />
      {/* camino de piedra hasta la entrada de la terminal */}
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[0, 0.03, 2.4]} scale={[W + 0.4, 0.04, 4]} receiveShadow />
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

/** Letrero del fuselaje (texto rojo sobre transparente), dibujado una vez. */
let liveryMaterial: THREE.MeshBasicMaterial | null = null
function liveryMat() {
  if (!liveryMaterial) {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 192
    const g = c.getContext('2d')!
    g.fillStyle = '#e3263c'
    g.font = '800 132px system-ui, sans-serif'
    g.textBaseline = 'middle'
    // ala estilizada antes del nombre
    g.beginPath()
    g.moveTo(40, 160)
    g.quadraticCurveTo(120, 120, 150, 20)
    g.quadraticCurveTo(140, 110, 70, 165)
    g.closePath()
    g.fill()
    g.fillText('mallplay', 175, 104)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    liveryMaterial = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })
  }
  return liveryMaterial
}

/**
 * Avión de línea de fuselaje ancho (estilo 787): blanco, motores rojos, cola roja con franja que
 * baja por la panza, alas largas en flecha con las puntas curvadas hacia arriba y el nombre en rojo.
 * Local: nariz hacia +z, ruedas en y = 0.
 */
export function AirplaneModel({ stairs = true }: { stairs?: boolean }) {
  const white = mat('#fbfbfa', { rough: 0.4 })
  const pale = mat('#e9eaec', { rough: 0.45 })
  const red = mat('#e3263c', { rough: 0.45 })
  const dark = mat('#2c333b')
  const windows = glowMat('#cfe8ff', 1.6, { dayGlow: 0.12 })
  const cockpit = mat('#1e2a33', { rough: 0.3 })
  const FY = 1.35
  return (
    <group>
      {/* fuselaje: cuerpo, nariz redondeada y cono de cola que sube */}
      <mesh geometry={GEO.cylinder} material={white} position={[0, FY, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.2, 7.6, 1.25]} castShadow />
      <mesh geometry={GEO.sphereSmooth} material={white} position={[0, FY - 0.05, 3.8]} scale={[1.2, 1.18, 2.4]} castShadow />
      <mesh geometry={GEO.cone} material={white} position={[0, FY + 0.15, -4.6]} rotation={[-Math.PI / 2 + 0.12, 0, 0]} scale={[1.2, 1.9, 1.05]} castShadow />
      {/* cabina */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={cockpit} position={[s * 0.3, FY + 0.32, 4.55]} rotation={[0.55, s * 0.35, 0]} scale={[0.42, 0.16, 0.3]} />
      ))}
      {/* fila de ventanillas y puertas a ambos lados */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={windows} position={[s * 0.6, FY + 0.22, 0]} scale={[0.02, 0.1, 6.4]} />
          {[3.1, -3.3].map((z) => (
            <mesh key={z} geometry={GEO.box} material={pale} position={[s * 0.61, FY + 0.05, z]} scale={[0.02, 0.6, 0.32]} />
          ))}
          {/* nombre en rojo */}
          <mesh geometry={GEO.plane} material={liveryMat()} position={[s * 0.615, FY + 0.18, 1.5]} rotation={[0, s * (Math.PI / 2), 0]} scale={[s > 0 ? 2.6 : -2.6, 0.49, 1]} />
        </group>
      ))}
      {/* franja roja que baja de la cola por la panza trasera */}
      <mesh geometry={GEO.box} material={red} position={[0, FY - 0.5, -3.4]} rotation={[0.18, 0, 0]} scale={[1.22, 0.32, 2.6]} />
      <mesh geometry={GEO.box} material={red} position={[0, FY - 0.05, -4.55]} rotation={[0.35, 0, 0]} scale={[0.95, 0.5, 1.4]} />
      {/* deriva roja con borde de ataque blanco */}
      <mesh geometry={GEO.box} material={red} position={[0, FY + 1.65, -4.55]} rotation={[-0.55, 0, 0]} scale={[0.12, 2.4, 1.35]} castShadow />
      <mesh geometry={GEO.box} material={white} position={[0, FY + 1.55, -3.95]} rotation={[-0.55, 0, 0]} scale={[0.13, 2.3, 0.18]} />
      {/* estabilizadores horizontales */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={white} position={[s * 1.15, FY + 0.35, -4.7]} rotation={[0, s * 0.45, 0]} scale={[2, 0.07, 0.75]} castShadow />
      ))}
      {/* alas largas en flecha, con raíz gruesa y puntas que se curvan hacia arriba */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.5, FY - 0.45, 0.4]} rotation={[0, s * 0.5, 0]}>
          <mesh geometry={GEO.box} material={white} position={[s * 2.4, 0, 0]} rotation={[0, 0, s * 0.06]} scale={[4.8, 0.12, 1.25]} castShadow />
          <mesh geometry={GEO.box} material={pale} position={[s * 2.4, -0.02, -0.55]} rotation={[0, 0, s * 0.06]} scale={[4.4, 0.06, 0.3]} />
          <mesh geometry={GEO.box} material={white} position={[s * 5.1, 0.35, -0.1]} rotation={[0, 0, s * 0.55]} scale={[1.1, 0.08, 0.7]} />
          {/* motor rojo con entrada oscura y pilón */}
          <group position={[s * 1.9, -0.5, 0.75]} rotation={[0, -s * 0.5, 0]}>
            <mesh geometry={GEO.box} material={pale} position={[0, 0.3, -0.3]} scale={[0.14, 0.4, 1.2]} />
            <mesh geometry={GEO.cylinder} material={red} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.85, 1.7, 0.85]} castShadow />
            <mesh geometry={GEO.cylinder} material={mat('#c9ced4')} position={[0, 0, 0.87]} rotation={[Math.PI / 2, 0, 0]} scale={[0.87, 0.1, 0.87]} />
            <mesh geometry={GEO.cylinder} material={dark} position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]} scale={[0.68, 0.05, 0.68]} />
            <mesh geometry={GEO.cone} material={dark} position={[0, 0, -1.05]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.5, 0.5, 0.5]} />
          </group>
        </group>
      ))}
      {/* tren de aterrizaje: patas y ruedas dobles */}
      {(
        [
          [0, 3.6],
          [-0.75, -0.3],
          [0.75, -0.3],
        ] as [number, number][]
      ).map(([x, z]) => (
        <group key={`${x}${z}`}>
          <mesh geometry={GEO.box} material={pale} position={[x, 0.55, z]} scale={[0.1, 0.7, 0.1]} />
          {[-0.13, 0.13].map((dz) => (
            <mesh key={dz} geometry={GEO.cylinderLow} material={dark} position={[x, 0.2, z + dz]} rotation={[0, 0, Math.PI / 2]} scale={[0.38, 0.22, 0.38]} />
          ))}
        </group>
      ))}
      {/* escalerilla en la puerta delantera */}
      {stairs && <mesh geometry={GEO.box} material={mat('#e9e4d8')} position={[1.35, 0.65, 3.1]} rotation={[0, 0, 0.62]} scale={[1.8, 0.12, 0.7]} />}
      {/* luces: rojo/verde en las puntas de ala, faro blanco en la nariz */}
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#ff4d4d', 2.4, { dayGlow: 0.4 })} position={[-5.3, FY + 0.2, -2.6]} scale={0.14} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#3ddc84', 2.4, { dayGlow: 0.4 })} position={[5.3, FY + 0.2, -2.6]} scale={0.14} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#ffffff', 2, { dayGlow: 0.3 })} position={[0, 0.85, 4.1]} scale={0.12} />
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

/** Recorrido de rodaje (x, z): de la manga a la pista y hasta la cabecera del fondo. */
const TAXI: [number, number][] = [
  [PLANE.x, PLANE.z],
  [PLANE.x, PLANE.z - 3],
  [RUNWAY.x - 1.5, PLANE.z - 6],
  [RUNWAY.x, PLANE.z - 8],
  [RUNWAY.x, RUNWAY.z0 + 3],
]
/** Rodaje de llegada: del punto de frenado en la pista a la manga. */
const TAXI_IN: [number, number][] = [
  [RUNWAY.x, -6],
  [RUNWAY.x, PLANE.z - 6],
  [PLANE.x + 1.5, PLANE.z - 4],
  [PLANE.x, PLANE.z],
]
const tmp = new THREE.Vector3()
/** Punto a una fracción u de una polilínea (velocidad constante) y su rumbo. */
function along(pts: [number, number][], u: number, out: THREE.Vector3) {
  let total = 0
  for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])
  let d = Math.min(1, Math.max(0, u)) * total
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1]
    const [bx, bz] = pts[k]
    const len = Math.hypot(bx - ax, bz - az)
    if (d <= len || k === pts.length - 1) {
      const f = Math.min(1, d / (len || 1))
      out.set(ax + (bx - ax) * f, 0, az + (bz - az) * f)
      return Math.atan2(bx - ax, bz - az)
    }
    d -= len
  }
  return 0
}

/**
 * El avión de la plataforma: quieto junto a la manga y, al despegar, rueda hasta la pista, acelera
 * y se eleva sobre el mar. Mientras se está en la isla no se ve (está allá).
 */
function MallPlane() {
  const g = useRef<THREE.Group>(null)
  const head = useRef(0)
  const rolling = useFlight((s) => s.step === 'takeoff' || s.step === 'landMall')
  const shadow = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    const p = g.current
    if (!p) return
    const { step, world, takeoffAt, landingAt } = useFlight.getState()
    const away = world === 'island' || step === 'flying' || step === 'arrived' || step === 'departIsland'
    p.visible = !away
    if (shadow.current) shadow.current.visible = !away
    if (step === 'landMall') {
      // aterrizaje: aproximación desde el mar por la cabecera del fondo, toque, frenado y rodaje a la manga
      const t = Math.min(1, (performance.now() - landingAt) / LANDING_MS)
      const TD = RUNWAY.z0 + 4
      const STOP = -6
      let x: number = RUNWAY.x
      let z: number
      let y = Y
      let pitch = 0
      let heading = 0
      if (t < TOUCHDOWN) {
        const u = t / TOUCHDOWN
        z = TD - 55 * (1 - u)
        y = Y + 13 * Math.pow(1 - u, 1.15)
        pitch = -0.04 - (u > 0.8 ? (u - 0.8) * 0.6 : 0)
      } else if (t < 0.78) {
        const u = (t - TOUCHDOWN) / (0.78 - TOUCHDOWN)
        z = TD + (STOP - TD) * (1 - (1 - u) * (1 - u))
        pitch = -Math.max(0, 0.12 - u * 0.6)
      } else {
        const u = (t - 0.78) / 0.22
        const target = along(TAXI_IN, u * u * (3 - 2 * u), tmp)
        x = tmp.x
        z = tmp.z
        const want = u > 0.85 ? 0 : target
        let dh = want - head.current
        dh = Math.atan2(Math.sin(dh), Math.cos(dh))
        head.current += dh * Math.min(1, dt * 5)
        heading = head.current
      }
      if (t < 0.78) head.current = 0
      p.position.set(x, y, z)
      p.rotation.set(pitch, heading, 0)
      if (shadow.current) shadow.current.position.set(x + (y - Y) * 0.15, Y + 0.02, z)
      return
    }
    if (step !== 'takeoff') {
      head.current = 0
      p.position.set(PLANE.x, Y, PLANE.z)
      p.rotation.set(0, 0, 0)
      if (shadow.current) shadow.current.position.set(PLANE.x, Y + 0.02, PLANE.z)
      return
    }
    const t = Math.min(1, (performance.now() - takeoffAt) / TAKEOFF_MS)
    let x: number, z: number, heading: number, lift = 0, pitch = 0
    if (t < TAXI_FRAC * 0.82) {
      // rodaje: de la manga a la calle de rodaje y por la pista hasta la cabecera del fondo
      const u = t / (TAXI_FRAC * 0.82)
      const target = along(TAXI, u * u * (3 - 2 * u), tmp)
      x = tmp.x
      z = tmp.z
      // primero retrocede empujado (sin girar); luego gira suave hacia donde rueda
      const want = z > PLANE.z - 2.95 ? 0 : target
      let dh = want - head.current
      dh = Math.atan2(Math.sin(dh), Math.cos(dh))
      head.current += dh * Math.min(1, dt * 4)
      heading = head.current
    } else if (t < TAXI_FRAC) {
      // giro de 180° en la cabecera para quedar mirando la pista
      const u = (t - TAXI_FRAC * 0.82) / (TAXI_FRAC * 0.18)
      x = TAXI[TAXI.length - 1][0]
      z = TAXI[TAXI.length - 1][1]
      heading = Math.PI - Math.PI * (u * u * (3 - 2 * u))
      head.current = heading
    } else {
      // carrera de despegue: acelera, rota y se eleva sobre el mar
      const b = (t - TAXI_FRAC) / (1 - TAXI_FRAC)
      x = RUNWAY.x
      z = TAXI[TAXI.length - 1][1] + (RUNWAY.z1 + 60 - TAXI[TAXI.length - 1][1]) * b * b
      heading = 0
      lift = Math.max(0, z - (RUNWAY.z1 - 7))
      pitch = -Math.min(0.3, lift * 0.035)
    }
    const y = Y + Math.pow(lift, 1.2) * 0.3
    p.position.set(x, y, z)
    p.rotation.set(pitch, heading, 0)
    if (shadow.current) shadow.current.position.set(x + lift * 0.15, Y + 0.02, z)
  })
  return (
    <>
      <mesh ref={shadow} geometry={GEO.sphere} material={mat('#0b2a33', { opacity: 0.22 })} position={[PLANE.x, Y + 0.02, PLANE.z]} scale={[7, 0.02, 9]} />
      <group ref={g} position={[PLANE.x, Y, PLANE.z]}>
        <AirplaneModel stairs={!rolling} />
      </group>
    </>
  )
}

export function Airport({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const open = useUI((s) => s.airportOpen)
  const beacon = useRef<THREE.Mesh>(null)
  const label = useMemo(() => getGlassPill('Aeropuerto', { dot: '#f5c542', sub: 'Vuelos a Isla Tecnología', dark: night }), [night])
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
        <Extras />
      </Batch>
      <Tower beacon={beacon} />
      <RunwayLights cx={RUNWAY.x} z0={RUNWAY.z0} z1={RUNWAY.z1} w={RUNWAY.width} y={Y} dir={1} />
      <MallPlane />
      <Travelers reduceMotion={reduceMotion} />
      {/* área táctil: terminal, torre y avión */}
      <mesh
        geometry={GEO.box}
        position={[(A.x0 + RUNWAY.x) / 2, Y + 2.5, (A.z0 + A.z1) / 2]}
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
