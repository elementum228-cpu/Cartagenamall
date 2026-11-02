import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useIsNight } from '../lib/useIsNight'
import { appClock } from '../lib/clock'
import { isShipPromotion, useVisibleArrival } from '../ship/offers'
import { useUI } from '../state/ui'
import { useCatalog } from '../state/catalog'
import { HARBOR, SEA_Y, SHIP_BERTH } from '../tourism/config'
import { ScreenLabel } from './Billboard'
import { cameraState } from './cameraState'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { Person } from './Person'
import { Instances, Line, type P3 } from './PirateShip'

// Barco de los descuentos: un barco blanco de dos cubiertas, con ventanales que brillan, chimenea
// coral con el signo %, guirnaldas de luces y un letrero a lo largo del casco. Solo aparece cuando
// llega (entra desde el mar hasta el malecón este) y se va cuando zarpa. Se toca para ver las ofertas.

const [BX, BZ] = SHIP_BERTH
/** Segundos que tarda en entrar o salir, y desde qué distancia llega. */
const SAIL_S = 14
const FAR = 60
const WHITE = '#f8f7f3'
const NAVY = '#16325c'
const CORAL = '#f27b68'

/** Texto pintado en un lienzo (letrero del casco y signo de la chimenea). */
function textMaterial(text: string, w: number, h: number, font: string, color: string, bg?: string) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  if (bg) {
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
  }
  g.fillStyle = color
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, h / 2 + 4)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return new THREE.MeshBasicMaterial({ map: tex, transparent: !bg, toneMapped: false })
}

const STRINGS: [P3, P3][] = [
  [[0, 1.9, 6.6], [0, 6.4, 1.0]],
  [[0, 6.4, 1.0], [0, 5.6, -3.4]],
  [[0, 5.6, -3.4], [0, 2.6, -5.9]],
]
const BULBS = STRINGS.flatMap(([a, b]) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const n = Math.max(3, Math.round(len / 0.55))
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n
    const sag = Math.sin(t * Math.PI) * len * 0.05
    return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t] as P3, s: [0.15, 0.15, 0.15] as P3 }
  })
})

function ShipModel() {
  const white = mat(WHITE, { rough: 0.5 })
  const navy = mat(NAVY, { rough: 0.6 })
  const coral = mat(CORAL, { rough: 0.55 })
  const windows = glowMat('#bfe6ff', 1.8, { dayGlow: 0.25 })
  const warm = glowMat('#ffe3a6', 2, { dayGlow: 0.3 })
  const sign = useMemo(() => textMaterial('BARCO DE LOS DESCUENTOS', 1024, 112, '800 64px system-ui, sans-serif', '#ffffff', NAVY), [])
  const pct = useMemo(() => textMaterial('%', 128, 128, '900 104px system-ui, sans-serif', '#ffffff'), [])
  return (
    <group>
      {/* casco blanco con franja azul, proa en punta y línea coral */}
      <mesh geometry={GEO.box} material={white} position={[0, 0.5, -0.6]} scale={[3.8, 1.7, 11]} castShadow />
      <mesh geometry={GEO.box} material={white} position={[0, 0.5, 4.9]} rotation={[0, Math.PI / 4, 0]} scale={[2.69, 1.7, 2.69]} castShadow />
      <mesh geometry={GEO.box} material={navy} position={[0, -0.12, -0.6]} scale={[3.84, 0.45, 11.02]} />
      <mesh geometry={GEO.box} material={navy} position={[0, -0.12, 4.9]} rotation={[0, Math.PI / 4, 0]} scale={[2.72, 0.45, 2.72]} />
      <mesh geometry={GEO.box} material={coral} position={[0, 0.25, -0.6]} scale={[3.85, 0.07, 11.03]} />
      {/* letrero a lo largo del casco (a los dos lados) */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.plane} material={sign} position={[s * 1.915, 0.88, -0.6]} rotation={[0, s * (Math.PI / 2), 0]} scale={[s * -8.4, 0.92, 1]} />
      ))}
      {/* cubierta principal y primera planta con ventanales */}
      <mesh geometry={GEO.box} material={mat('#d9d4c8')} position={[0, 1.37, -0.4]} scale={[3.6, 0.05, 10.6]} />
      <mesh geometry={GEO.box} material={white} position={[0, 1.95, -1.4]} scale={[3.2, 1.1, 8]} castShadow />
      <mesh geometry={GEO.box} material={windows} position={[0, 2.0, -1.4]} scale={[3.24, 0.34, 7.6]} />
      {/* segunda planta y puente de mando */}
      <mesh geometry={GEO.box} material={white} position={[0, 2.95, -2.0]} scale={[2.8, 0.9, 5.6]} castShadow />
      <mesh geometry={GEO.box} material={windows} position={[0, 3.0, -2.0]} scale={[2.84, 0.28, 5.2]} />
      <mesh geometry={GEO.box} material={white} position={[0, 3.75, 0.4]} scale={[2.6, 0.8, 1.7]} castShadow />
      <mesh geometry={GEO.box} material={mat('#1b2b44')} position={[0, 3.85, 1.26]} scale={[2.3, 0.32, 0.04]} />
      <mesh geometry={GEO.box} material={navy} position={[0, 4.2, 0.4]} scale={[2.75, 0.08, 1.85]} />
      {/* mástil con luz y chimenea coral con el % */}
      <mesh geometry={GEO.cylinderLow} material={white} position={[0, 5.3, 1.0]} scale={[0.12, 2.2, 0.12]} />
      <mesh geometry={GEO.sphereSmooth} material={warm} position={[0, 6.45, 1.0]} scale={0.24} />
      <mesh geometry={GEO.cylinder} material={coral} position={[0, 4.35, -3.4]} scale={[1.25, 1.9, 1.25]} castShadow />
      <mesh geometry={GEO.cylinder} material={navy} position={[0, 5.35, -3.4]} scale={[1.3, 0.2, 1.3]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.plane} material={pct} position={[s * 0.64, 4.35, -3.4]} rotation={[0, s * (Math.PI / 2), 0]} scale={[1, 1, 1]} />
      ))}
      {/* barandas blancas en las cubiertas */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={white} position={[s * 1.82, 1.75, -0.4]} scale={[0.05, 0.05, 10.2]} />
          <mesh geometry={GEO.box} material={white} position={[s * 1.55, 2.75, -1.4]} scale={[0.05, 0.05, 7.8]} />
          <mesh geometry={GEO.box} material={white} position={[s * 1.35, 3.65, -2.0]} scale={[0.05, 0.05, 5.4]} />
        </group>
      ))}
      {/* guirnaldas de proa a popa */}
      {STRINGS.map(([a, b], i) => (
        <Line key={i} a={a} b={b} r={0.012} material={mat('#c9ccd2')} />
      ))}
      <Instances geometry={GEO.sphere} material={glowMat('#ffd58a', 3, { dayGlow: 0.5 })} items={BULBS} />
      {/* luces de navegación y focos sobre el agua */}
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#ff4d4d', 2.4, { dayGlow: 0.3 })} position={[-1.85, 1.9, 3.8]} scale={0.18} />
      <mesh geometry={GEO.sphereSmooth} material={glowMat('#3ddc84', 2.4, { dayGlow: 0.3 })} position={[1.85, 1.9, 3.8]} scale={0.18} />
      <mesh geometry={GEO.plane} material={lightPoolMat('#bfe6ff', 0.9)} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, -0.4]} scale={[9, 16, 1]} />
      {/* pasajeros mirando el muelle desde la cubierta superior */}
      {(
        [
          [-1.1, -0.6, '#e76f51'],
          [1.0, -1.6, '#2a9d8f'],
          [-0.9, -3.3, '#f4a261'],
          [0.7, 2.4, '#3d7ea6'],
          [-0.6, 3.0, '#f15bb5'],
        ] as [number, number, string][]
      ).map(([x, z, c], i) => (
        <group key={i} position={[x, z > 1.5 ? 1.4 : 3.42, z]}>
          <Person color={c} skin={['#e5b48f', '#8d5a3b', '#c58c64'][i % 3]} />
        </group>
      ))}
    </group>
  )
}

export function DiscountShip({ reduceMotion }: { reduceMotion: boolean }) {
  const arrival = useVisibleArrival()
  const night = useIsNight()
  const ship = useRef<THREE.Group>(null)
  const hull = useRef<THREE.Group>(null)
  const wake = useRef<THREE.Mesh>(null)
  // al zarpar se queda visible mientras se aleja
  const [leaving, setLeaving] = useState<number | null>(null)
  const [docked, setDocked] = useState(false)
  const prev = useRef(arrival)
  useEffect(() => {
    if (prev.current && !arrival) setLeaving(performance.now())
    if (arrival) setLeaving(null)
    prev.current = arrival
  }, [arrival])
  const count = useCatalog((s) => s.promotions.filter(isShipPromotion).length)
  const label = useMemo(() => getGlassPill('Barco de los descuentos', { dot: CORAL, sub: `${count} locales con descuento`, dark: night }), [count, night])
  const wakeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f2fffd', transparent: true, opacity: 0, depthWrite: false }), [])

  useFrame(({ clock }) => {
    const g = ship.current
    if (!g) return
    // avance: 0 = lejos en el mar, 1 = atracado
    let k = 0
    let speed = 0
    if (arrival) {
      const t = reduceMotion ? 1 : Math.min(1, (appClock.now() - arrival.at) / (SAIL_S * 1000))
      k = 1 - (1 - t) ** 3
      speed = t < 1 ? 1 - t : 0
    } else if (leaving !== null) {
      const t = Math.min(1, (performance.now() - leaving) / (SAIL_S * 1000))
      k = 1 - t * t * t
      speed = t < 1 ? t : 0
      if (t >= 1) setLeaving(null)
    }
    g.visible = !!arrival || leaving !== null
    g.position.set(BX, SEA_Y, BZ + (1 - k) * FAR)
    const atBerth = k > 0.999 && !!arrival
    if (atBerth !== docked) setDocked(atBerth)
    if (hull.current) {
      const time = clock.elapsedTime
      hull.current.position.y = reduceMotion ? 0 : Math.sin(time * 0.8) * 0.05
      hull.current.rotation.z = reduceMotion ? 0 : Math.sin(time * 0.6) * 0.012
    }
    if (wake.current) {
      wakeMat.opacity = speed * 0.5
      wake.current.visible = speed > 0.02
    }
  })

  const open = () => useUI.getState().openShip(true)

  return (
    <group>
      {/* atraca con la proa hacia la muralla (gira 180°) */}
      <group ref={ship} rotation={[0, Math.PI, 0]} visible={false}>
        <mesh geometry={GEO.sphere} material={mat('#0b3a40', { opacity: 0.28 })} position={[0, 0.02, -0.4]} scale={[4.6, 0.02, 13]} />
        <mesh ref={wake} geometry={GEO.sphere} material={wakeMat} position={[0, 0.04, 4]} scale={[4.5, 0.02, 12]} visible={false} />
        <group ref={hull}>
          <ShipModel />
        </group>
        <mesh
          geometry={GEO.box}
          position={[0, 2.2, 0]}
          scale={[4.2, 5, 13]}
          onClick={(e) => {
            if (cameraState.handMode || e.delta > 8) return
            e.stopPropagation()
            open()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {/* pasarela del malecón al barco, solo atracado */}
      {docked && (
        <mesh geometry={GEO.box} material={mat('#c9c3b5')} position={[(HARBOR.east + BX - 1.9) / 2, HARBOR.deckY + 0.1, BZ + 1]} scale={[BX - 1.9 - HARBOR.east + 0.4, 0.08, 1.1]} />
      )}
      {docked && <ScreenLabel label={label} position={[BX, 8.6, BZ]} pixelHeight={34} lit priority={LABEL_PRIORITY.floorSign + 12} onClick={open} />}
    </group>
  )
}

