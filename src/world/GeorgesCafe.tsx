import '@fontsource/pacifico/latin-400.css'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Batch } from './Batch'
import { GEO, GLASS, mat } from './materials'
import { glowMat, lightPoolMat, nightVolumeMat } from './night'
import { Person } from './Person'

// George's: cafetería de especialidad que toma UN local de la zona de comida (6 × 5 m). Es un componente aislado, como Veneplast: el padre
// decide posición y giro; la fachada mira a +z. Inspirada en el render de referencia: cuerpo amarillo con letrero en cursiva, panel calado
// dorado en el costado, pilar con el oso de gafas, ventanales con marcos oscuros que dejan ver el interior cálido y una terraza al frente.
// Todo lo estático se funde con <Batch>; solo los letreros son planos con textura (tres lienzos pequeños, creados una vez).

export const GEORGES = {
  gold: '#f4b820',
  gold2: '#ffd34f',
  deep: '#c98a0c',
  brown: '#2b1a10',
  wood: '#b98a5c',
  cream: '#f7f1e3',
  orange: '#e8651f',
  green: '#4f9a5e',
} as const

/** Huella del local en el plano (la del espacio E-02). */
export const GEORGES_SIZE = { width: 6, depth: 5 }

/** Rectángulo redondeado (sin `roundRect`, que no existe en iPhones con iOS < 16). */
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// ── texturas ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat = false) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** «George's» en cursiva, marrón oscuro con un brillo dorado debajo que lo despega del muro. */
function scriptTexture() {
  return canvasTexture(1400, 300, (g) => {
    g.font = '400 210px Pacifico, "Brush Script MT", "Segoe Script", cursive'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.fillStyle = 'rgba(255,238,170,.85)'
    g.fillText("George's", 706, 160)
    g.fillStyle = GEORGES.brown
    g.fillText("George's", 700, 150)
    // subrayado en forma de ola, como el rasgo de la referencia
    g.strokeStyle = GEORGES.brown
    g.lineWidth = 9
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(330, 262)
    g.bezierCurveTo(520, 240, 620, 286, 820, 262)
    g.bezierCurveTo(930, 250, 1000, 262, 1080, 256)
    g.stroke()
  })
}

/** El oso con gafas de sol sobre fondo amarillo: la mascota de la casa. */
function bearTexture() {
  return canvasTexture(512, 512, (g) => {
    const rr = (x: number, y: number, w: number, h: number, r: number) => rrect(g, x, y, w, h, r)
    g.fillStyle = GEORGES.gold2
    rr(0, 0, 512, 512, 60)
    g.fill()
    g.strokeStyle = GEORGES.brown
    g.lineWidth = 12
    g.lineJoin = 'round'
    // orejas
    for (const sx of [-1, 1]) {
      g.fillStyle = '#d98f2b'
      g.beginPath()
      g.arc(256 + sx * 140, 118, 62, 0, 7)
      g.fill()
      g.stroke()
      g.fillStyle = '#f2c27a'
      g.beginPath()
      g.arc(256 + sx * 140, 122, 30, 0, 7)
      g.fill()
    }
    // cara
    g.fillStyle = '#e8a64a'
    g.beginPath()
    g.ellipse(256, 270, 190, 170, 0, 0, 7)
    g.fill()
    g.stroke()
    // hocico
    g.fillStyle = '#fbe0b0'
    g.beginPath()
    g.ellipse(256, 340, 104, 78, 0, 0, 7)
    g.fill()
    g.stroke()
    g.fillStyle = GEORGES.brown
    g.beginPath()
    g.ellipse(256, 312, 34, 24, 0, 0, 7)
    g.fill()
    g.lineWidth = 9
    g.beginPath()
    g.moveTo(256, 336)
    g.lineTo(256, 360)
    g.moveTo(214, 368)
    g.quadraticCurveTo(256, 404, 298, 368)
    g.stroke()
    // gafas de sol: dos lentes negros con brillo y puente dorado
    g.fillStyle = '#16100c'
    g.lineWidth = 10
    for (const sx of [-1, 1]) {
      rr(256 + sx * 82 - 62, 196, 124, 92, 30)
      g.fill()
      g.stroke()
      g.fillStyle = 'rgba(255,255,255,.35)'
      g.beginPath()
      g.moveTo(256 + sx * 82 - 40, 214)
      g.lineTo(256 + sx * 82 - 8, 214)
      g.lineTo(256 + sx * 82 - 34, 250)
      g.closePath()
      g.fill()
      g.fillStyle = '#16100c'
    }
    g.fillStyle = GEORGES.brown
    g.fillRect(226, 224, 60, 12)
  })
}

/** Panel calado: fondo dorado con perforaciones cuadradas redondeadas, en rejilla (se repite). */
function latticeTexture() {
  const t = canvasTexture(
    256,
    256,
    (g) => {
      g.fillStyle = GEORGES.gold
      g.fillRect(0, 0, 256, 256)
      const n = 8
      const cell = 256 / n
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const x = i * cell + cell * 0.2
          const y = j * cell + cell * 0.2
          const s = cell * 0.6
          g.fillStyle = '#a56f0a'
          rrect(g, x, y, s, s, 6)
          g.fill()
          g.fillStyle = '#6e4607'
          rrect(g, x + 3, y + 3, s - 6, s - 6, 4)
          g.fill()
          g.fillStyle = 'rgba(255,255,255,.28)'
          g.fillRect(x, y + s, s, 3)
        }
    },
    true,
  )
  t.repeat.set(4, 3.2)
  return t
}

// ── materiales que se encienden de noche ───────────────────────────────────────────────────────────────────────────────────────────

const WARM_PANE = () => glowMat('#ffd48a', 1.5, { opacity: 0.4 })
const WARM_LIGHT = () => glowMat('#fff0c8', 2.2, { dayGlow: 0.4 })
const SIGN_GLOW = () => glowMat('#ffe9a0', 0.9, { dayGlow: 0.12 })
const POOL = () => lightPoolMat('#ffc97a', 0.75)
const INTERIOR = () => nightVolumeMat('#ffcf8f', 0.17)

const CHAIRS = ['#e8651f', '#e8651f', '#d9501a']

export interface GeorgesCafeProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  interactive?: boolean
  /** Se llama al tocar el local. */
  onOpen?: () => void
  /** Taza giratoria con vapor en la azotea (se apaga con «reducir movimiento»). */
  animated?: boolean
}

export function GeorgesCafe({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, interactive = true, onOpen, animated = true }: GeorgesCafeProps) {
  // los letreros se dibujan cuando la cursiva ya está cargada (si no, saldría con la letra de respaldo)
  const [fontVer, setFontVer] = useState(0)
  useEffect(() => {
    let on = true
    void document.fonts?.load('400 120px Pacifico').then(() => on && setFontVer(1)).catch(() => {})
    return () => {
      on = false
    }
  }, [])
  const tex = useMemo(() => ({ script: scriptTexture(), bear: bearTexture(), lattice: latticeTexture() }), [fontVer])
  useEffect(() => () => void Object.values(tex).forEach((t) => t.dispose()), [tex])

  const W = GEORGES_SIZE.width
  const D = GEORGES_SIZE.depth
  const x0 = -W / 2
  const x1 = W / 2
  const z0 = -D / 2 // fondo del local
  const zF = 1.2 // fachada del edificio (por delante queda la terraza)
  const T = 0.2
  const G = 2.35 // alto de la planta de vidrio
  const H = 3.3 // alto del muro (sin parapeto)
  const wall = mat(GEORGES.gold)
  const wall2 = mat(GEORGES.gold2)
  const brown = mat(GEORGES.brown)
  const stone = mat('#3b322d')
  const cream = mat(GEORGES.cream)
  const wood = mat(GEORGES.wood)
  const dark = mat('#15100c')
  const gray = mat('#cfd3d6')
  const version = 'georges-v1'

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{ storeId: 'georges' }}
      onClick={
        interactive && onOpen
          ? (e) => {
              if (e.delta > 8) return
              e.stopPropagation()
              onOpen()
            }
          : undefined
      }
      onPointerOver={interactive ? (e) => (e.stopPropagation(), (document.body.style.cursor = 'pointer')) : undefined}
      onPointerOut={interactive ? () => (document.body.style.cursor = '') : undefined}
    >
      {/* zona tocable limpia */}
      {interactive && (
        <mesh position={[0, 2, 0]} visible={false}>
          <boxGeometry args={[W, 4, D]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      <Batch version={version}>
        <group>
          {/* ── cascarón: fondo, costados, losa del techo y suelo de madera ── */}
          <Box x0={x0} x1={x1} y0={0} y1={H} z0={z0} z1={z0 + T} m={wall} />
          <Box x0={x0} x1={x0 + T} y0={0} y1={H} z0={z0} z1={zF} m={wall} />
          <Box x0={x1 - T} x1={x1} y0={0} y1={H} z0={z0} z1={zF} m={wall} />
          <Box x0={x0} x1={x1} y0={H} y1={H + 0.12} z0={z0 - 0.1} z1={zF + 0.1} m={mat('#a8780f')} />
          <Box x0={x0 + T} x1={x1 - T} y0={0} y1={0.1} z0={z0 + T} z1={zF - T} m={mat('#a97a4d')} />
          <Box x0={x0 + T} x1={x1 - T} y0={0.1} y1={G} z0={z0 + T} z1={z0 + T + 0.04} m={mat('#f1e3c2')} />

          {/* parapeto oscuro (reborde de la cubierta) y el techo con sus equipos */}
          <Box x0={x0 - 0.1} x1={x1 + 0.1} y0={H + 0.12} y1={H + 0.42} z0={zF - 0.06} z1={zF + 0.12} m={brown} />
          <Box x0={x0 - 0.1} x1={x1 + 0.1} y0={H + 0.12} y1={H + 0.4} z0={z0 - 0.12} z1={z0 + 0.04} m={brown} />
          <Box x0={x0 - 0.1} x1={x0 + 0.06} y0={H + 0.12} y1={H + 0.4} z0={z0 - 0.12} z1={zF + 0.12} m={brown} />
          <Box x0={x1 - 0.06} x1={x1 + 0.1} y0={H + 0.12} y1={H + 0.4} z0={z0 - 0.12} z1={zF + 0.12} m={brown} />
          {[
            [-0.9, -1.4],
            [0.9, -1.0],
          ].map(([ax, az]) => (
            <group key={ax} position={[ax, H + 0.12, az]}>
              <mesh geometry={GEO.box} material={gray} position={[0, 0.27, 0]} scale={[0.95, 0.54, 0.7]} castShadow />
              <mesh geometry={GEO.cylinder} material={dark} position={[0, 0.56, 0]} scale={[0.5, 0.05, 0.5]} />
              <mesh geometry={GEO.box} material={mat('#9aa0a5')} position={[0.3, 0.27, 0.36]} scale={[0.3, 0.4, 0.03]} />
            </group>
          ))}
          <mesh geometry={GEO.cylinderLow} material={mat('#b8bdc1')} position={[1.9, H + 0.5, -1.7]} scale={[0.22, 0.75, 0.22]} />
          <mesh geometry={GEO.cylinderLow} material={mat('#b8bdc1')} position={[-1.9, H + 0.4, -0.4]} scale={[0.16, 0.55, 0.16]} />

          {/* ── fachada, planta baja: zócalo de piedra, pilares oscuros y vigas; entre ellos, vidrio ── */}
          <Box x0={x0 + 0.6} x1={x1} y0={0} y1={0.45} z0={zF - T} z1={zF} m={stone} />
          {[-1.15, 0.75, 2.4].map((px) => (
            <Box key={px} x0={px - 0.09} x1={px + 0.09} y0={0} y1={G} z0={zF - T} z1={zF + 0.02} m={brown} />
          ))}
          <Box x0={x0 + 0.6} x1={x1} y0={G - 0.12} y1={G} z0={zF - T} z1={zF + 0.04} m={brown} />
          <Box x0={x1 - 0.5} x1={x1} y0={0} y1={G} z0={zF - T} z1={zF} m={wall} />
          {/* labio de bronce entre el vidrio y el letrero */}
          <Box x0={x0 + 0.6} x1={x1 + 0.08} y0={G} y1={G + 0.14} z0={zF - 0.1} z1={zF + 0.42} m={brown} />
          <Box x0={x0 + 0.6} x1={x1 + 0.08} y0={G + 0.14} y1={G + 0.2} z0={zF - 0.1} z1={zF + 0.36} m={mat('#d9a21a', { emissive: 0.15 })} />
          {/* planta alta: franja amarilla del letrero */}
          <Box x0={x0 + 0.6} x1={x1} y0={G + 0.2} y1={H} z0={zF - T} z1={zF} m={wall2} />

          {/* ── vidrio de los ventanales y puerta ── */}
          {[
            [-1.7, 1.0],
            [-0.2, 1.4],
          ].map(([cx, gw]) => (
            <group key={cx}>
              <mesh geometry={GEO.box} material={GLASS} position={[cx, 1.28, zF - 0.05]} scale={[gw, 1.8, 0.04]} />
              <mesh geometry={GEO.box} material={WARM_PANE()} position={[cx, 1.28, zF - 0.14]} scale={[gw - 0.04, 1.76, 0.02]} />
              {/* cuadrícula fina de los ventanales */}
              <mesh geometry={GEO.box} material={brown} position={[cx, 1.28, zF - 0.02]} scale={[0.05, 1.8, 0.06]} />
              <mesh geometry={GEO.box} material={brown} position={[cx, 1.6, zF - 0.02]} scale={[gw, 0.05, 0.06]} />
            </group>
          ))}
          {/* ventana de esquina con el fondo, a la derecha de la puerta no hay: es el muro calado */}
          <mesh geometry={GEO.box} material={GLASS} position={[1.58, 1.28, zF - 0.05]} scale={[1.28, 1.8, 0.04]} />
          <mesh geometry={GEO.box} material={WARM_PANE()} position={[1.58, 1.28, zF - 0.14]} scale={[1.24, 1.76, 0.02]} />
          <mesh geometry={GEO.box} material={brown} position={[1.58, 1.28, zF - 0.02]} scale={[0.05, 1.8, 0.06]} />
          {/* puerta de vidrio, abierta: la hoja gira hacia afuera */}
          <group position={[1.98, 0, zF - 0.1]} rotation={[0, 1.2, 0]}>
            <mesh geometry={GEO.box} material={GLASS} position={[0.28, 1.1, 0]} scale={[0.56, 2.05, 0.05]} />
            <mesh geometry={GEO.box} material={brown} position={[0.28, 2.1, 0]} scale={[0.6, 0.06, 0.07]} />
            <mesh geometry={GEO.box} material={brown} position={[0.56, 1.1, 0]} scale={[0.05, 2.05, 0.07]} />
            <mesh geometry={GEO.box} material={cream} position={[0.5, 1.05, 0.05]} scale={[0.03, 0.45, 0.03]} />
          </group>

          {/* ── pilar del oso: losa amarilla alta, saliente, con franjas verticales de bronce ── */}
          <Box x0={x0 - 0.02} x1={x0 + 0.78} y0={0} y1={H + 0.95} z0={z0 + 0.6} z1={zF + 0.3} m={wall} />
          <Box x0={x0 - 0.02} x1={x0 + 0.78} y0={H + 0.95} y1={H + 1.07} z0={z0 + 0.6} z1={zF + 0.34} m={brown} />
          {[0.1, 0.22, 0.34].map((o) => (
            <mesh key={o} geometry={GEO.box} material={mat('#d9a21a', { emissive: 0.1 })} position={[x0 + 0.12 + o * 1.3, 0.85, zF + 0.31]} scale={[0.04, 1.3, 0.02]} />
          ))}

          {/* ── terraza: tarima de madera con maceteros y luces de guirnalda ── */}
          <Box x0={x0 + 0.62} x1={x1} y0={0} y1={0.1} z0={zF} z1={D / 2} m={wood} />
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} geometry={GEO.box} material={mat('#9c7248')} position={[x0 + 1.25 + i * 0.9, 0.105, (zF + D / 2) / 2]} scale={[0.02, 0.012, D / 2 - zF]} />
          ))}
          {/* maceteros del borde, con arbustos redondos */}
          <Box x0={x0 + 0.7} x1={x1} y0={0.1} y1={0.38} z0={D / 2 - 0.2} z1={D / 2} m={stone} />
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} geometry={GEO.sphere} material={mat(i % 2 ? '#4f9a5e' : '#3f8650')} position={[x0 + 1.15 + i * 1.0, 0.62, D / 2 - 0.1]} scale={[0.62, 0.5, 0.42]} castShadow />
          ))}
          {/* postes con bombillos */}
          {[x0 + 0.9, x1 - 0.12].map((px) => (
            <group key={px} position={[px, 0.1, D / 2 - 0.1]}>
              <mesh geometry={GEO.cylinderLow} material={dark} position={[0, 0.95, 0]} scale={[0.05, 1.9, 0.05]} />
              <mesh geometry={GEO.sphere} material={WARM_LIGHT()} position={[0, 1.95, 0]} scale={0.2} />
            </group>
          ))}
          {/* mesas y sillas de la terraza (naranja, como en la referencia) */}
          {[
            [-0.9, 1.0],
            [1.3, 1.0],
          ].map(([tx, tz]) => (
            <Table key={tx} x={tx} z={zF + tz} chair={wood} />
          ))}

          {/* ── interior visible por los ventanales: barra, lámparas, mesas y estantes ── */}
          <Interior zF={zF} z0={z0} />

          <mesh geometry={GEO.box} material={INTERIOR()} position={[0.1, 1.5, (z0 + zF) / 2]} scale={[W - 0.9, 2.5, zF - z0 - 0.4]} />
        </group>
      </Batch>

      {/* costado derecho: panel calado dorado (textura repetida, solo un plano) */}
      <mesh position={[x1 + 0.03, 1.75, (z0 + zF) / 2 + 0.05]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[zF - z0 - 0.5, 3.0]} />
        <meshStandardMaterial map={tex.lattice} roughness={0.7} />
      </mesh>
      <Box x0={x1 + 0.01} x1={x1 + 0.07} y0={0.2} y1={0.32} z0={z0 + 0.15} z1={zF - 0.1} m={brown} />
      <Box x0={x1 + 0.01} x1={x1 + 0.07} y0={3.22} y1={3.34} z0={z0 + 0.15} z1={zF - 0.1} m={brown} />

      {/* letrero «George's» sobre la franja amarilla, con un fondo cálido detrás */}
      <mesh geometry={GEO.plane} position={[0.3, G + 0.2 + (H - G - 0.2) / 2, zF + 0.015]} scale={[3.8, 0.78, 1]}>
        <meshBasicMaterial map={tex.script} transparent toneMapped={false} />
      </mesh>
      <mesh geometry={GEO.box} material={SIGN_GLOW()} position={[0.3, G + 0.2 + (H - G - 0.2) / 2, zF - 0.02]} scale={[4.0, 0.84, 0.02]} />
      {/* el oso en el pilar */}
      <mesh geometry={GEO.plane} position={[x0 + 0.38, 3.0, zF + 0.32]} scale={[0.7, 0.7, 1]}>
        <meshBasicMaterial map={tex.bear} transparent toneMapped={false} />
      </mesh>

      {/* hito de la azotea: una taza gigante que gira despacio, con vapor */}
      <CoffeeCup position={[0.35, H + 0.42, 0.25]} animated={animated} />

      {/* clientes sentados en la terraza */}
      <group position={[-0.9 - 0.42, 0.34, zF + 1.0]} rotation={[0, 0.6, 0]} scale={0.8}>
        <Person color="#2f86d6" skin="#c58c64" />
      </group>
      <group position={[1.3 + 0.4, 0.34, zF + 1.0]} rotation={[0, -0.6, 0]} scale={0.8}>
        <Person color="#e8573f" skin="#e5b48f" />
      </group>

      {/* halo cálido frente al local (solo de noche) */}
      <mesh geometry={GEO.plane} material={POOL()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, D / 2 + 0.5]} scale={[W + 1.2, 2.6, 1]} />
    </group>
  )
}

/** Taza gigante de la azotea (hito visible desde lejos): gira despacio y suelta vapor que sube y se desvanece. */
function CoffeeCup({ position, animated }: { position: [number, number, number]; animated: boolean }) {
  const spin = useRef<THREE.Group>(null)
  const steam = useRef<(THREE.Mesh | null)[]>([])
  const t = useRef(0)
  const place = (time: number) => {
    if (spin.current) spin.current.rotation.y = 0.9 + time * 0.35
    steam.current.forEach((m, i) => {
      if (!m) return
      const p = (((time * 0.28 + i / 3) % 1) + 1) % 1
      m.position.set(Math.sin(time * 1.2 + i * 2.1) * 0.08, 0.95 + p * 1.1, Math.cos(time + i) * 0.05)
      m.scale.setScalar(0.22 + p * 0.3)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.sin(p * Math.PI)
    })
  }
  useEffect(() => place(animated ? 0 : 2.2), [animated]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    if (!animated) return
    t.current += Math.min(dt, 0.1)
    place(t.current)
  })
  const cream = mat('#f7f1e3')
  return (
    <group position={position}>
      {/* plato */}
      <mesh geometry={GEO.cylinder} material={mat('#e9dcc2')} position={[0, 0.04, 0]} scale={[1.55, 0.08, 1.55]} castShadow />
      <group ref={spin}>
        {/* taza con franja dorada y el café arriba */}
        <mesh geometry={GEO.cylinder} material={cream} position={[0, 0.45, 0]} scale={[1.0, 0.8, 1.0]} castShadow />
        <mesh geometry={GEO.cylinder} material={mat('#f4b820', { emissive: 0.2 })} position={[0, 0.42, 0]} scale={[1.02, 0.16, 1.02]} />
        <mesh geometry={GEO.cylinder} material={mat('#4a2a14')} position={[0, 0.84, 0]} scale={[0.86, 0.04, 0.86]} />
        <mesh geometry={GEO.torus} material={cream} position={[0.5, 0.48, 0]} rotation={[0, 0, 0]} scale={[0.26, 0.26, 0.9]} />
      </group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => (steam.current[i] = m)} geometry={GEO.sphere}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Mesa redonda con dos sillas naranja. */
function Table({ x, z, chair }: { x: number; z: number; chair: THREE.Material }) {
  const top = mat('#f2e6cd')
  return (
    <group position={[x, 0.1, z]}>
      <mesh geometry={GEO.cylinder} material={top} position={[0, 0.62, 0]} scale={[0.62, 0.06, 0.62]} castShadow />
      <mesh geometry={GEO.cylinderLow} material={mat('#2b1a10')} position={[0, 0.3, 0]} scale={[0.07, 0.6, 0.07]} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.55, 0, 0.05]} rotation={[0, s * -0.3, 0]}>
          <mesh geometry={GEO.box} material={mat(CHAIRS[0])} position={[0, 0.3, 0]} scale={[0.34, 0.06, 0.34]} castShadow />
          <mesh geometry={GEO.box} material={mat(CHAIRS[1])} position={[0, 0.52, s * 0.15]} scale={[0.34, 0.4, 0.05]} />
          {[
            [-0.13, -0.13],
            [0.13, -0.13],
            [-0.13, 0.13],
            [0.13, 0.13],
          ].map(([lx, lz]) => (
            <mesh key={`${lx}${lz}`} geometry={GEO.box} material={chair} position={[lx, 0.15, lz]} scale={[0.04, 0.3, 0.04]} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Lo que se ve por las vitrinas: mostrador con máquina de café, lámparas colgantes, tres mesas con sillas y repisas con tazas. */
function Interior({ zF, z0 }: { zF: number; z0: number }) {
  const woodDark = mat('#6a4528')
  const counterZ = z0 + 0.7
  return (
    <group>
      {/* mostrador de fondo */}
      <mesh geometry={GEO.box} material={woodDark} position={[-0.5, 0.55, counterZ]} scale={[3.2, 1.0, 0.6]} castShadow />
      <mesh geometry={GEO.box} material={mat('#f3ead6')} position={[-0.5, 1.07, counterZ]} scale={[3.3, 0.06, 0.68]} />
      <mesh geometry={GEO.box} material={mat('#8f979c')} position={[-1.3, 1.3, counterZ]} scale={[0.7, 0.42, 0.4]} castShadow />
      <mesh geometry={GEO.box} material={dark2()} position={[-1.3, 1.55, counterZ]} scale={[0.72, 0.06, 0.42]} />
      <mesh geometry={GEO.box} material={mat('#c9522b')} position={[-0.2, 1.22, counterZ]} scale={[0.34, 0.26, 0.3]} />
      {/* repisas con tazas y bolsas de café */}
      {[1.55, 2.0].map((y) => (
        <group key={y}>
          <mesh geometry={GEO.box} material={woodDark} position={[-0.5, y, z0 + 0.32]} scale={[3.1, 0.05, 0.22]} />
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} geometry={GEO.cylinderLow} material={mat(i % 3 === 0 ? '#e8651f' : i % 3 === 1 ? '#f7f1e3' : '#f4b820')} position={[-1.8 + i * 0.32, y + 0.12, z0 + 0.32]} scale={[0.14, 0.2, 0.14]} />
          ))}
        </group>
      ))}
      {/* lámparas colgantes */}
      {[-1.6, -0.4, 0.8].map((lx) => (
        <group key={lx}>
          <mesh geometry={GEO.cylinderLow} material={dark2()} position={[lx, 2.05, zF - 1.05]} scale={[0.015, 0.5, 0.015]} />
          <mesh geometry={GEO.sphere} material={WARM_LIGHT()} position={[lx, 1.75, zF - 1.05]} scale={0.26} />
        </group>
      ))}
      {/* mesas de adentro, junto a los ventanales */}
      {[-1.6, -0.1, 1.3].map((tx, i) => (
        <group key={tx} position={[tx, 0.1, zF - 0.85]}>
          <mesh geometry={GEO.cylinder} material={mat('#f2e6cd')} position={[0, 0.5, 0]} scale={[0.5, 0.05, 0.5]} />
          <mesh geometry={GEO.cylinderLow} material={woodDark} position={[0, 0.25, 0]} scale={[0.06, 0.5, 0.06]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={GEO.box} material={mat(CHAIRS[(i + (s > 0 ? 1 : 0)) % 3])} position={[s * 0.5, 0.3, 0]} scale={[0.3, 0.3, 0.3]} />
          ))}
        </group>
      ))}
    </group>
  )
}

const dark2 = () => mat('#1b1612')

function Box({ x0, x1, y0, y1, z0, z1, m }: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; m: THREE.Material }) {
  return <mesh geometry={GEO.box} material={m} position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} scale={[x1 - x0, y1 - y0, z1 - z0]} castShadow receiveShadow />
}
