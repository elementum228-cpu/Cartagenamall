import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { STADIUM } from '../config/stadium'
import { useIsNight } from '../lib/useIsNight'
import { drawCover, loadImage } from '../stadium/boardPaint'
import { useCine } from '../state/cine'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, Garita, STONE, STONE_DARK } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, mat } from './materials'
import { glowMat, lightPoolMat } from './night'

// Cine: isla de piedra al norte del piso de comida, con el edificio (fachada art déco, marquesina y carteleras),
// una plazoleta y un cine al aire libre con pantalla. Las imágenes de la pantalla y las carteleras las cambia la administración.
const CX = -27
const CZ = -66
const HALF = 13
const DECK = 2.2 // altura de la plataforma sobre el mar
const SAND = '#e6c08a'
const SAND_LIGHT = '#f1d5a6'
const TERRA = '#c8693c'
const NAVY = '#1b2247'
const BX = -33.5 // centro del edificio
const BZ = -73
const SCREEN = { x: -19.5, z: -77.2, w: 8, h: 4.5, y: DECK + 4.2 }

/** Textura de lienzo que muestra una imagen recortada a su caja; sin imagen, pinta el arte por defecto. */
function useImageTexture(url: string | null, w: number, h: number, fallback: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return { canvas, tex }
  }, [w, h])
  useEffect(() => {
    let alive = true
    const g = canvas.getContext('2d')!
    fallback(g, w, h)
    tex.needsUpdate = true
    void loadImage(url).then((img) => {
      if (!alive || !img) return
      drawCover(g, img, w, h)
      tex.needsUpdate = true
    })
    return () => {
      alive = false
    }
  }, [url, canvas, tex, w, h, fallback])
  return tex
}

/** Arte por defecto de la pantalla: atardecer con montañas y «Hoy en cartelera». */
const paintScreen = (g: CanvasRenderingContext2D, w: number, h: number) => {
  const sky = g.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#2a1e5c')
  sky.addColorStop(0.55, '#c2477a')
  sky.addColorStop(1, '#f6a25a')
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#ffe9a8'
  g.beginPath()
  g.arc(w * 0.68, h * 0.5, h * 0.13, 0, Math.PI * 2)
  g.fill()
  const hill = (c: string, y0: number, amp: number, ph: number) => {
    g.fillStyle = c
    g.beginPath()
    g.moveTo(0, h)
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * y0 - Math.abs(Math.sin(x * 0.012 + ph)) * h * amp)
    g.lineTo(w, h)
    g.fill()
  }
  hill('#5b2a6e', 0.78, 0.3, 0.4)
  hill('#2a1746', 0.92, 0.22, 2.1)
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.font = `800 ${Math.round(h * 0.12)}px "Plus Jakarta Sans", system-ui, sans-serif`
  g.fillText('HOY EN CARTELERA', w / 2, h * 0.2)
}
/** Arte por defecto de una cartelera vertical. */
const paintPoster = (hue: string) => (g: CanvasRenderingContext2D, w: number, h: number) => {
  const bg = g.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, hue)
  bg.addColorStop(1, '#1b2247')
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.beginPath()
  g.arc(w / 2, h * 0.4, w * 0.2, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.font = `800 ${Math.round(w * 0.13)}px "Plus Jakarta Sans", system-ui, sans-serif`
  g.fillText('PRÓXIMO', w / 2, h * 0.76)
  g.fillText('ESTRENO', w / 2, h * 0.88)
}
const POSTER_A = paintPoster('#7a4bd6')
const POSTER_B = paintPoster('#d6533f')

/** Letrero de neón «CINE» con marco de bombillos. */
function useMarquee() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#141a3a'
    g.beginPath()
    g.ellipse(256, 128, 246, 118, 0, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 10
    g.strokeStyle = '#ff5fa8'
    g.shadowColor = '#ff5fa8'
    g.shadowBlur = 24
    g.beginPath()
    g.ellipse(256, 128, 222, 96, 0, 0, Math.PI * 2)
    g.stroke()
    g.shadowBlur = 0
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      g.fillStyle = '#ffe9a8'
      g.beginPath()
      g.arc(256 + Math.cos(a) * 236, 128 + Math.sin(a) * 108, 6, 0, Math.PI * 2)
      g.fill()
    }
    g.font = '900 120px "Plus Jakarta Sans", system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = '#ffd27a'
    g.shadowBlur = 30
    g.fillStyle = '#fff3c4'
    g.fillText('CINE', 256, 134)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })
  }, [])
}

/** Isla: plataforma de piedra con talud, cordón, parapeto almenado y garitas. */
function Island() {
  const w = HALF * 2
  const merlon = (x: number, z: number, k: string) => <mesh key={k} geometry={GEO.box} material={mat(STONE[1])} position={[x, DECK + 0.75, z]} scale={[0.8, 0.5, 0.8]} castShadow />
  const merlons = []
  for (let i = 0; i <= 15; i++) {
    const t = -HALF + 0.9 + (i * (w - 1.8)) / 15
    merlons.push(merlon(CX + t, CZ - HALF + 0.4, `n${i}`), merlon(CX - HALF + 0.4, CZ + t, `w${i}`))
    if (i < 6 || i > 10) merlons.push(merlon(CX + t, CZ + HALF - 0.4, `s${i}`))
    if (i < 9 || i > 12) merlons.push(merlon(CX + HALF - 0.4, CZ + t, `e${i}`))
  }
  return (
    <>
      <mesh geometry={GEO.box} material={mat(STONE_DARK)} position={[CX, -0.6, CZ]} scale={[w + 1.2, 1.6, w + 1.2]} />
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[CX, (DECK - 0.4) / 2, CZ]} scale={[w, DECK + 0.4, w]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[CX, DECK - 0.35, CZ]} scale={[w + 0.2, 0.18, w + 0.2]} />
      <mesh geometry={GEO.box} material={mat('#efd9b4')} position={[CX, DECK + 0.02, CZ]} scale={[w - 1.4, 0.06, w - 1.4]} receiveShadow />
      {/* parapeto */}
      {(
        [
          [CX, CZ - HALF + 0.4, w, 0.8],
          [CX - HALF + 0.4, CZ, 0.8, w],
        ] as [number, number, number, number][]
      ).map(([x, z, sx, sz], i) => (
        <mesh key={i} geometry={GEO.box} material={mat(STONE[1])} position={[x, DECK + 0.25, z]} scale={[sx, 0.5, sz]} castShadow />
      ))}
      {merlons}
      <Garita x={CX - HALF + 0.3} z={CZ - HALF + 0.3} y={DECK + 0.5} />
      <Garita x={CX - HALF + 0.3} z={CZ + HALF - 0.3} y={DECK + 0.5} />
      {/* plazoleta: círculos de piedra frente a la entrada */}
      <mesh geometry={GEO.cylinder} material={mat('#dcbf8f')} position={[-28, DECK + 0.07, -61.5]} scale={[10, 0.04, 10]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#f1dcb6')} position={[-28, DECK + 0.1, -61.5]} scale={[7.4, 0.04, 7.4]} />
      <mesh geometry={GEO.cylinder} material={mat(TERRA)} position={[-28, DECK + 0.13, -61.5]} scale={[2.4, 0.04, 2.4]} />
    </>
  )
}

/** Edificio del cine: fachada escalonada, pilastras, puertas con luz y marco de carteleras. */
function Building() {
  const y = DECK
  const warm = glowMat('#ffd9a0', 1.8, { dayGlow: 0.45 })
  const neon = glowMat('#ff5fa8', 2.2, { dayGlow: 0.5 })
  const bulb = glowMat('#ffe9a8', 2.4, { dayGlow: 0.6 })
  const sand = mat(SAND)
  const light = mat(SAND_LIGHT)
  const fz = BZ + 4 // cara de la fachada (mira al sur)
  return (
    <>
      {/* cuerpo y alas */}
      <mesh geometry={GEO.box} material={sand} position={[BX, y + 3, BZ]} scale={[12, 6, 8]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={light} position={[BX, y + 6.1, BZ]} scale={[12.4, 0.3, 8.4]} />
      {/* torre central escalonada */}
      <mesh geometry={GEO.box} material={sand} position={[BX, y + 4.4, fz - 0.4]} scale={[6, 8.8, 1.6]} castShadow />
      <mesh geometry={GEO.box} material={light} position={[BX, y + 9.1, fz - 0.4]} scale={[4.4, 1.2, 1.4]} castShadow />
      <mesh geometry={GEO.box} material={mat(TERRA)} position={[BX, y + 10, fz - 0.4]} scale={[2.6, 0.9, 1.2]} castShadow />
      <mesh geometry={GEO.box} material={light} position={[BX, y + 10.8, fz - 0.4]} scale={[1.1, 0.9, 0.9]} />
      {/* pilastras con filete de neón */}
      {[-2.6, -1.3, 1.3, 2.6].map((dx) => (
        <group key={dx}>
          <mesh geometry={GEO.box} material={light} position={[BX + dx, y + 4.6, fz + 0.45]} scale={[0.45, 8.6, 0.3]} />
          <mesh geometry={GEO.box} material={neon} position={[BX + dx, y + 4.6, fz + 0.62]} scale={[0.08, 8.2, 0.05]} />
        </group>
      ))}
      {/* marquesina sobre la entrada, con bombillos */}
      <mesh geometry={GEO.box} material={mat(NAVY)} position={[BX, y + 3.5, fz + 1.2]} scale={[6.6, 0.5, 2.2]} castShadow />
      <mesh geometry={GEO.box} material={mat(TERRA)} position={[BX, y + 3.82, fz + 1.2]} scale={[6.8, 0.14, 2.4]} />
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={`b${i}`} geometry={GEO.sphereSmooth} material={bulb} position={[BX - 3 + i * 0.545, y + 3.22, fz + 2.2]} scale={0.2} />
      ))}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.9)} rotation={[-Math.PI / 2, 0, 0]} position={[BX, y + 0.16, fz + 2.6]} scale={[9, 6, 1]} />
      {/* dos puertas dobles con arco y luz cálida */}
      {[-1.3, 1.3].map((dx) => (
        <group key={`d${dx}`}>
          <mesh geometry={GEO.box} material={mat('#5a2f1c')} position={[BX + dx, y + 1.45, fz + 0.42]} scale={[1.9, 2.9, 0.2]} />
          <mesh geometry={GEO.box} material={warm} position={[BX + dx - 0.45, y + 1.5, fz + 0.54]} scale={[0.7, 2.2, 0.04]} />
          <mesh geometry={GEO.box} material={warm} position={[BX + dx + 0.45, y + 1.5, fz + 0.54]} scale={[0.7, 2.2, 0.04]} />
          <mesh geometry={GEO.cylinder} material={mat('#5a2f1c')} position={[BX + dx, y + 2.9, fz + 0.42]} rotation={[Math.PI / 2, 0, 0]} scale={[1.9, 0.2, 1.1]} />
        </group>
      ))}
      {/* marcos de las carteleras (las imágenes van aparte) */}
      {[-4.5, 4.5].map((dx) => (
        <group key={`p${dx}`}>
          <mesh geometry={GEO.box} material={mat(NAVY)} position={[BX + dx, y + 2.3, fz + 0.1]} scale={[2.3, 3.3, 0.2]} />
          <mesh geometry={GEO.box} material={bulb} position={[BX + dx, y + 4.05, fz + 0.2]} scale={[2.3, 0.1, 0.08]} />
        </group>
      ))}
      {/* escalinata de entrada */}
      {[0, 1].map((i) => (
        <mesh key={`s${i}`} geometry={GEO.box} material={light} position={[BX, y + 0.1 + i * 0.12, fz + 1.4 - i * 0.3]} scale={[7.4 - i * 0.6, 0.14, 2.4 - i * 0.6]} receiveShadow />
      ))}
      {/* jardineras y faroles a los lados */}
      {[-6.6, 6.6].map((dx) => (
        <group key={`j${dx}`}>
          <mesh geometry={GEO.box} material={mat(TERRA)} position={[BX + dx, y + 0.35, fz + 1.4]} scale={[1.3, 0.7, 1.3]} castShadow />
          <mesh geometry={GEO.sphere} material={mat('#4da862')} position={[BX + dx, y + 1.05, fz + 1.4]} scale={1.2} castShadow />
        </group>
      ))}
      {[
        [-31, -64.5],
        [-25, -64.5],
        [-31, -58.5],
        [-25, -58.5],
      ].map(([x, z]) => (
        <group key={`l${x}${z}`}>
          <mesh geometry={GEO.cylinder} material={mat('#2a3038')} position={[x, y + 1.3, z]} scale={[0.1, 2.6, 0.1]} />
          <mesh geometry={GEO.sphereSmooth} material={bulb} position={[x, y + 2.7, z]} scale={0.4} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.6)} rotation={[-Math.PI / 2, 0, 0]} position={[x, y + 0.17, z]} scale={[4, 4, 1]} />
        </group>
      ))}
    </>
  )
}

/** Cine al aire libre: marco de la pantalla, sillas en gradas bajas y guirnaldas de luces. */
function OpenAir() {
  const y = DECK
  const bulb = glowMat('#ffe9a8', 2.4, { dayGlow: 0.6 })
  const dark = mat('#2a3038')
  const seats = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++) {
      const x = SCREEN.x - 3.2 + c * 1.6
      const z = SCREEN.z + 4.2 + r * 1.7
      seats.push(
        <group key={`${r}${c}`} position={[x, y + 0.1, z]}>
          <mesh geometry={GEO.box} material={mat('#b8483c')} position={[0, 0.3, 0]} scale={[1.1, 0.25, 0.8]} castShadow />
          <mesh geometry={GEO.box} material={mat('#9c3a30')} position={[0, 0.7, 0.36]} scale={[1.1, 0.7, 0.14]} castShadow />
        </group>,
      )
    }
  const posts: [number, number][] = [
    [SCREEN.x - 5, SCREEN.z + 0.4],
    [SCREEN.x + 5, SCREEN.z + 0.4],
    [SCREEN.x - 5, SCREEN.z + 9.4],
    [SCREEN.x + 5, SCREEN.z + 9.4],
  ]
  const lights = []
  for (const [a, b] of [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
  ])
    for (let i = 1; i < 9; i++) {
      const t = i / 9
      const sag = Math.sin(t * Math.PI) * 0.7
      lights.push(<mesh key={`${a}${b}${i}`} geometry={GEO.sphereSmooth} material={bulb} position={[posts[a][0] + (posts[b][0] - posts[a][0]) * t, y + 4.6 - sag, posts[a][1] + (posts[b][1] - posts[a][1]) * t]} scale={0.2} />)
    }
  return (
    <>
      {/* marco y patas de la pantalla */}
      <mesh geometry={GEO.box} material={dark} position={[SCREEN.x, SCREEN.y, SCREEN.z - 0.12]} scale={[SCREEN.w + 0.6, SCREEN.h + 0.6, 0.3]} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={dark} position={[SCREEN.x + s * (SCREEN.w / 2 - 0.4), y + (SCREEN.y - SCREEN.h / 2 - y) / 2, SCREEN.z - 0.12]} scale={[0.3, SCREEN.y - SCREEN.h / 2 - y, 0.3]} />
      ))}
      {posts.map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={GEO.cylinder} material={dark} position={[x, y + 2.3, z]} scale={[0.1, 4.6, 0.1]} />
      ))}
      {lights}
      {seats}
      <mesh geometry={GEO.box} material={mat('#e3c697')} position={[SCREEN.x, y + 0.08, SCREEN.z + 5.6]} scale={[9.6, 0.06, 6.4]} receiveShadow />
    </>
  )
}

/** Escalinata del lado este que baja a un puente hacia la isla del estadio. */
function Access() {
  const steps = 10
  const z = -58.5
  const x0 = CX + HALF
  const stone = mat('#efe3cc')
  const endX = x0 + steps * 0.45
  const toX = STADIUM.center[0] - 13.5
  return (
    <>
      {Array.from({ length: steps }, (_, i) => {
        const h = DECK - (i + 1) * ((DECK - 0.3) / steps)
        return <mesh key={i} geometry={GEO.box} material={stone} position={[x0 + (i + 0.5) * 0.45, h / 2, z]} scale={[0.46, h, 3]} castShadow receiveShadow />
      })}
      {/* arco de entrada en lo alto */}
      {[-1.7, 1.7].map((dz) => (
        <mesh key={dz} geometry={GEO.box} material={mat(TERRA)} position={[x0 - 0.3, DECK + 1.6, z + dz]} scale={[0.5, 3.2, 0.5]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={mat(TERRA)} position={[x0 - 0.3, DECK + 3.35, z]} scale={[0.6, 0.45, 4.2]} castShadow />
      {/* puente de piedra hasta la isla del estadio */}
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[(endX + toX) / 2, 0.1, z]} scale={[toX - endX + 0.4, 0.4, 3]} receiveShadow />
      {[-1.5, 1.5].map((dz) => (
        <mesh key={`r${dz}`} geometry={GEO.box} material={mat(STONE[1])} position={[(endX + toX) / 2, 0.55, z + dz]} scale={[toX - endX, 0.5, 0.25]} />
      ))}
    </>
  )
}

/** Pantalla exterior y carteleras: imágenes que la administración cambia (fuera del Batch: se actualizan solas). */
function Screens() {
  const screen = useCine((s) => s.screen)
  const posters = useCine((s) => s.posters)
  const marquee = useMarquee()
  const texS = useImageTexture(screen, 1024, 576, paintScreen)
  const texA = useImageTexture(posters[0], 320, 480, POSTER_A)
  const texB = useImageTexture(posters[1], 320, 480, POSTER_B)
  const mS = useMemo(() => new THREE.MeshBasicMaterial({ map: texS, toneMapped: false }), [texS])
  const mA = useMemo(() => new THREE.MeshBasicMaterial({ map: texA, toneMapped: false }), [texA])
  const mB = useMemo(() => new THREE.MeshBasicMaterial({ map: texB, toneMapped: false }), [texB])
  const fz = BZ + 4
  return (
    <group userData={{ dynamic: true }}>
      <mesh geometry={GEO.plane} material={mS} position={[SCREEN.x, SCREEN.y, SCREEN.z + 0.05]} scale={[SCREEN.w, SCREEN.h, 1]} />
      <mesh geometry={GEO.plane} material={mA} position={[BX - 4.5, DECK + 2.3, fz + 0.22]} scale={[2, 3, 1]} />
      <mesh geometry={GEO.plane} material={mB} position={[BX + 4.5, DECK + 2.3, fz + 0.22]} scale={[2, 3, 1]} />
      <mesh geometry={GEO.plane} material={marquee} position={[BX, DECK + 6.3, fz + 0.75]} scale={[5.4, 2.7, 1]} />
    </group>
  )
}

export function Cinema() {
  const night = useIsNight()
  const label = useMemo(() => getGlassPill('Cine', { dot: '#ff5fa8', sub: 'Próximamente', dark: night }), [night])
  return (
    <group>
      <Batch version="cine-2">
        <Island />
        <Building />
        <OpenAir />
        <Access />
      </Batch>
      <Screens />
      <ScreenLabel label={label} position={[BX, DECK + 13, BZ + 3]} pixelHeight={30} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
      <pointLight position={[BX, DECK + 3, BZ + 7.5]} color="#ffd9a0" intensity={night ? 30 : 0} distance={14} decay={2} />
      <pointLight position={[SCREEN.x, DECK + 3, SCREEN.z + 4]} color="#ffb6d9" intensity={night ? 18 : 0} distance={12} decay={2} />
    </group>
  )
}
