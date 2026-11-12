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
import { BUILD_H, BX, BZ, CART, CX, CZ, DECK, DX, FZ, HALF, STAIR } from './cinemaLayout'

// Cine: isla de piedra al norte del piso de comida, con el edificio (fachada art déco, marquesina y carteleras),
// una plazoleta y un cine al aire libre con pantalla. Las imágenes de la pantalla y las carteleras las cambia la administración.
const SAND = '#e6c08a'
const SAND_LIGHT = '#f1d5a6'
const TERRA = '#c8693c'
const NAVY = '#1b2247'

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
const POSTER_C = paintPoster('#1f9d8f')

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
    if (i < 1 || i > 10) merlons.push(merlon(CX + t, CZ + HALF - 0.4, `s${i}`))
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
      <mesh geometry={GEO.cylinder} material={mat('#dcbf8f')} position={[BX, DECK + 0.07, -60.5]} scale={[10, 0.04, 10]} receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat('#f1dcb6')} position={[BX, DECK + 0.1, -60.5]} scale={[7.4, 0.04, 7.4]} />
      <mesh geometry={GEO.cylinder} material={mat(TERRA)} position={[BX, DECK + 0.13, -60.5]} scale={[2.4, 0.04, 2.4]} />
    </>
  )
}

/** Edificio del cine: sala alta al fondo, cuerpo con alas y torreones redondos, torre escalonada con aguja y gran marquesina. */
function Building() {
  const y = 0
  const warm = glowMat('#ffd9a0', 1.8, { dayGlow: 0.45 })
  const neon = glowMat('#ff5fa8', 2.2, { dayGlow: 0.5 })
  const cyan = glowMat('#5fe0ff', 2.0, { dayGlow: 0.45 })
  const bulb = glowMat('#ffe9a8', 2.4, { dayGlow: 0.6 })
  const sand = mat(SAND)
  const light = mat(SAND_LIGHT)
  const terra = mat(TERRA)
  const navy = mat(NAVY)
  return (
    <>
      <group position={[0, DECK, 0]} scale={[1, BUILD_H, 1]}>
      {/* sala grande al fondo (el volumen de las salas), con cornisa y franjas */}
      <mesh geometry={GEO.box} material={sand} position={[BX, y + 4.6, BZ - 2.2]} scale={[19, 9.2, 6.4]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={light} position={[BX, y + 9.35, BZ - 2.2]} scale={[19.5, 0.35, 6.9]} />
      <mesh geometry={GEO.box} material={terra} position={[BX, y + 8.4, BZ - 2.2]} scale={[19.1, 0.3, 6.5]} />
      <mesh geometry={GEO.box} material={terra} position={[BX, y + 7.7, BZ - 2.2]} scale={[19.1, 0.12, 6.5]} />
      {/* cuerpo delantero más bajo */}
      <mesh geometry={GEO.box} material={light} position={[BX, y + 3, BZ + 2.5]} scale={[15, 6, 4]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={terra} position={[BX, y + 6.1, BZ + 2.5]} scale={[15.4, 0.3, 4.4]} />
      {/* torreones redondos en las esquinas, con cúpula */}
      {[-1, 1].map((sd) => (
        <group key={`t${sd}`} position={[BX + sd * 7.6, y, BZ + 3.2]}>
          <mesh geometry={GEO.cylinder} material={sand} position={[0, 3.8, 0]} scale={[3.6, 7.6, 3.6]} castShadow />
          <mesh geometry={GEO.cylinder} material={terra} position={[0, 7.7, 0]} scale={[4, 0.3, 4]} />
          <mesh geometry={GEO.sphereSmooth} material={terra} position={[0, 7.8, 0]} scale={[3.4, 2.6, 3.4]} castShadow />
          <mesh geometry={GEO.cylinder} material={bulb} position={[0, 9.4, 0]} scale={[0.14, 1, 0.14]} />
          {[2.2, 4.4].map((h) => (
            <mesh key={h} geometry={GEO.cylinder} material={warm} position={[0, h, 0]} scale={[3.66, 1.1, 3.66]} />
          ))}
          <mesh geometry={GEO.cylinder} material={sand} position={[0, 3.3, 0]} scale={[3.7, 0.9, 3.7]} />
          <mesh geometry={GEO.cylinder} material={sand} position={[0, 1, 0]} scale={[3.7, 1.4, 3.7]} />
        </group>
      ))}
      {/* torre central escalonada con aguja */}
      <mesh geometry={GEO.box} material={sand} position={[BX, y + 5.6, FZ - 0.5]} scale={[7, 11.2, 2]} castShadow />
      <mesh geometry={GEO.box} material={light} position={[BX, y + 11.8, FZ - 0.5]} scale={[5.2, 1.3, 1.7]} castShadow />
      <mesh geometry={GEO.box} material={terra} position={[BX, y + 12.9, FZ - 0.5]} scale={[3.4, 1, 1.4]} castShadow />
      <mesh geometry={GEO.box} material={light} position={[BX, y + 13.8, FZ - 0.5]} scale={[1.8, 0.9, 1.1]} />
      <mesh geometry={GEO.cylinder} material={bulb} position={[BX, y + 15.4, FZ - 0.5]} scale={[0.16, 2.4, 0.16]} />
      <mesh geometry={GEO.sphereSmooth} material={neon} position={[BX, y + 16.7, FZ - 0.5]} scale={0.5} />
      {/* pilastras con filetes de neón */}
      {[-3.1, -1.9, 1.9, 3.1].map((dx, i) => (
        <group key={dx}>
          <mesh geometry={GEO.box} material={light} position={[BX + dx, y + 5.8, FZ + 0.55]} scale={[0.5, 10.8, 0.3]} />
          <mesh geometry={GEO.box} material={i % 2 ? cyan : neon} position={[BX + dx, y + 5.8, FZ + 0.72]} scale={[0.09, 10.4, 0.05]} />
        </group>
      ))}
      {/* ventanas iluminadas del cuerpo delantero */}
      {[-6, -4.6, 4.6, 6].map((dx) => (
        <mesh key={`w${dx}`} geometry={GEO.box} material={warm} position={[BX + dx, y + 4.3, BZ + 4.52]} scale={[0.8, 1.6, 0.05]} />
      ))}
      {/* gran marquesina curva con doble fila de bombillos */}
      <mesh geometry={GEO.cylinder} material={navy} position={[BX, y + 3.6, FZ + 0.6]} scale={[9.6, 0.6, 5.2]} castShadow />
      <mesh geometry={GEO.cylinder} material={terra} position={[BX, y + 3.95, FZ + 0.6]} scale={[9.9, 0.14, 5.5]} />
      {Array.from({ length: 15 }, (_, i) => {
        const a = (-70 + i * 10) * (Math.PI / 180)
        return <mesh key={`b${i}`} geometry={GEO.sphereSmooth} material={bulb} position={[BX + Math.sin(a) * 4.75, y + 3.3, FZ + 0.6 + Math.cos(a) * 2.55]} scale={0.22} />
      })}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.95)} rotation={[-Math.PI / 2, 0, 0]} position={[BX, y + 0.16, FZ + 3]} scale={[12, 7, 1]} />
      {/* tres puertas dobles con luz cálida */}
      {[-2.3, 0, 2.3].map((dx) => (
        <group key={`d${dx}`}>
          <mesh geometry={GEO.box} material={mat('#5a2f1c')} position={[BX + dx, y + 1.45, FZ + 0.52]} scale={[1.9, 2.9, 0.2]} />
          <mesh geometry={GEO.box} material={warm} position={[BX + dx - 0.45, y + 1.5, FZ + 0.64]} scale={[0.7, 2.3, 0.04]} />
          <mesh geometry={GEO.box} material={warm} position={[BX + dx + 0.45, y + 1.5, FZ + 0.64]} scale={[0.7, 2.3, 0.04]} />
        </group>
      ))}
      {/* marcos de las carteleras de la fachada (las imágenes van aparte) */}
      {[-5.3, 5.3].map((dx) => (
        <group key={`p${dx}`}>
          <mesh geometry={GEO.box} material={navy} position={[BX + dx, y + 2.2, BZ + 4.6]} scale={[2.3, 3.3, 0.2]} />
          <mesh geometry={GEO.box} material={bulb} position={[BX + dx, y + 3.95, BZ + 4.7]} scale={[2.3, 0.1, 0.08]} />
        </group>
      ))}
      {/* escalinata ancha de entrada con alfombra */}
      {[0, 1, 2].map((i) => (
        <mesh key={`s${i}`} geometry={GEO.box} material={light} position={[BX, y + 0.08 + i * 0.12, FZ + 2.2 - i * 0.35]} scale={[12 - i * 0.8, 0.14, 4 - i * 0.7]} receiveShadow />
      ))}
      <mesh geometry={GEO.box} material={mat('#b9242b')} position={[BX, y + 0.42, FZ + 2.4]} scale={[3, 0.04, 4.6]} />
      </group>
      <group position={[0, DECK, 0]}>
      {/* palmeras y faroles */}
      {[
        [-37.5, -62],
        [-19.5, -66.5],
        [-37.5, -56],
      ].map(([x, z]) => (
        <group key={`pm${x}${z}`} position={[x, y, z]}>
          <mesh geometry={GEO.cylinder} material={mat('#8a6a4a')} position={[0, 1.8, 0]} scale={[0.3, 3.6, 0.3]} castShadow />
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} geometry={GEO.box} material={mat('#3f9e57')} position={[Math.cos((k / 5) * Math.PI * 2) * 0.9, 3.6, Math.sin((k / 5) * Math.PI * 2) * 0.9]} rotation={[0, -(k / 5) * Math.PI * 2, 0.35]} scale={[2, 0.09, 0.6]} castShadow />
          ))}
        </group>
      ))}
      {[
        [-33.5, -64],
        [-23.5, -64],
        [-33.5, -57.5],
        [-25, -56],
      ].map(([x, z]) => (
        <group key={`l${x}${z}`}>
          <mesh geometry={GEO.cylinder} material={mat('#2a3038')} position={[x, y + 1.3, z]} scale={[0.1, 2.6, 0.1]} />
          <mesh geometry={GEO.sphereSmooth} material={bulb} position={[x, y + 2.7, z]} scale={0.4} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffcf8a', 0.6)} rotation={[-Math.PI / 2, 0, 0]} position={[x, y + 0.17, z]} scale={[4, 4, 1]} />
        </group>
      ))}
      </group>
    </>
  )
}

/** Escalera ancha de piedra, del piso de comida bajando directo a la plaza del cine, con balaustradas y faroles. */
function GrandStair() {
  const { x, w, zTop, zBot, yTop } = STAIR
  const y0 = DECK + 0.07
  const n = 26
  const rise = (yTop - y0) / n
  const run = (zTop - zBot) / n
  const stone = mat('#efe3cc')
  const light = glowMat('#ffe2a8', 1.8, { dayGlow: 0.3 })
  const bulb = glowMat('#ffe9a8', 2.4, { dayGlow: 0.6 })
  const len = Math.hypot(zTop - zBot, yTop - y0)
  const slope = Math.atan2(yTop - y0, zTop - zBot)
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const h = y0 + rise * (i + 1)
        const z = zBot + run * (i + 0.5)
        return (
          <group key={i}>
            <mesh geometry={GEO.box} material={stone} position={[x, h / 2, z]} scale={[w, h, run + 0.01]} castShadow receiveShadow />
            <mesh geometry={GEO.box} material={light} position={[x, h - 0.06, z - run / 2 - 0.005]} scale={[w - 0.5, 0.05, 0.02]} />
          </group>
        )
      })}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh geometry={GEO.box} material={mat(STONE[0])} position={[x + sd * (w / 2 + 0.25), (y0 + yTop) / 2 + 0.45, (zTop + zBot) / 2]} rotation={[-slope, 0, 0]} scale={[0.5, 0.9, len]} castShadow />
          {[0.15, 0.5, 0.85].map((t) => (
            <group key={t}>
              <mesh geometry={GEO.sphereSmooth} material={bulb} position={[x + sd * (w / 2 + 0.25), y0 + (yTop - y0) * t + 1.25, zBot + (zTop - zBot) * t]} scale={0.4} />
            </group>
          ))}
        </group>
      ))}
      {/* arco de entrada abajo, frente a la plaza */}
      {[-1, 1].map((sd) => (
        <mesh key={`a${sd}`} geometry={GEO.box} material={mat(TERRA)} position={[x + sd * (w / 2 + 0.3), y0 + 1.7, zBot - 0.5]} scale={[0.5, 3.4, 0.5]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={mat(TERRA)} position={[x, y0 + 3.6, zBot - 0.5]} scale={[w + 1.4, 0.45, 0.6]} castShadow />
    </>
  )
}

/** Cartelera del frente: base de piedra, rótulo y tres marcos en abanico (las imágenes van aparte). */
function Cartelera() {
  const bulb = glowMat('#ffe9a8', 2.4, { dayGlow: 0.6 })
  const neon = glowMat('#ff5fa8', 2.2, { dayGlow: 0.5 })
  const navy = mat(NAVY)
  return (
    <group position={[CART.x, DECK, CART.z]} rotation={[0, CART.rot, 0]}>
      <mesh geometry={GEO.box} material={mat(TERRA)} position={[0, 0.3, 0]} scale={[8.4, 0.6, 1.2]} castShadow />
      {[-2.7, 0, 2.7].map((dx, i) => (
        <group key={dx} position={[dx, 0, dx === 0 ? 0 : 0.25]} rotation={[0, -Math.sign(dx) * 0.28, 0]}>
          <mesh geometry={GEO.box} material={navy} position={[0, 2.45, -0.08]} scale={[2.5, 3.7, 0.25]} castShadow />
          <mesh geometry={GEO.box} material={i === 1 ? neon : bulb} position={[0, 4.36, -0.02]} scale={[2.5, 0.1, 0.1]} />
        </group>
      ))}
      <mesh geometry={GEO.box} material={navy} position={[0, 5.05, -0.1]} scale={[5, 0.9, 0.25]} />
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} geometry={GEO.sphereSmooth} material={bulb} position={[-2.3 + i * 0.46, 5.6, -0.02]} scale={0.16} />
      ))}
      <mesh geometry={GEO.plane} material={lightPoolMat('#ffb6d9', 0.7)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.17, 2]} scale={[9, 5, 1]} />
    </group>
  )
}

/** Escalinata del lado este que baja a un puente hacia la isla del estadio. */
function Access() {
  const steps = 10
  const z = -58.5
  const x0 = CX + HALF
  const stone = mat('#efe3cc')
  const endX = x0 + steps * 0.45
  const toX = STADIUM.center[0] - 13.5 - DX
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

/** Rótulo «CARTELERA» de la cartelera del frente. */
function useCartelSign() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 96
    const g = c.getContext('2d')!
    g.fillStyle = '#141a3a'
    g.fillRect(0, 0, 512, 96)
    g.font = '900 58px "Plus Jakarta Sans", system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = '#ffd27a'
    g.shadowBlur = 18
    g.fillStyle = '#fff3c4'
    g.fillText('CARTELERA', 256, 52)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
  }, [])
}

/** Cartelera y afiches: imágenes que la administración cambia (fuera del Batch: se actualizan solas). */
function Screens() {
  const screens = useCine((s) => s.screens)
  const posters = useCine((s) => s.posters)
  const marquee = useMarquee()
  const sign = useCartelSign()
  const t0 = useImageTexture(screens[0], 320, 480, POSTER_A)
  const t1 = useImageTexture(screens[1], 320, 480, POSTER_C)
  const t2 = useImageTexture(screens[2], 320, 480, POSTER_B)
  const texA = useImageTexture(posters[0], 320, 480, POSTER_B)
  const texB = useImageTexture(posters[1], 320, 480, POSTER_A)
  const mats = useMemo(() => [t0, t1, t2, texA, texB].map((map) => new THREE.MeshBasicMaterial({ map, toneMapped: false })), [t0, t1, t2, texA, texB])
  return (
    <group userData={{ dynamic: true }}>
      <group position={[CART.x, DECK, CART.z]} rotation={[0, CART.rot, 0]}>
        {[-2.7, 0, 2.7].map((dx, i) => (
          <group key={dx} position={[dx, 0, dx === 0 ? 0 : 0.25]} rotation={[0, -Math.sign(dx) * 0.28, 0]}>
            <mesh geometry={GEO.plane} material={mats[i]} position={[0, 2.45, 0.06]} scale={[2.2, 3.3, 1]} />
          </group>
        ))}
        <mesh geometry={GEO.plane} material={sign} position={[0, 5.05, 0.04]} scale={[4.8, 0.8, 1]} />
      </group>
      <mesh geometry={GEO.plane} material={mats[3]} position={[BX - 5.3, DECK + 2.2 * BUILD_H, BZ + 4.72]} scale={[2, 3 * BUILD_H, 1]} />
      <mesh geometry={GEO.plane} material={mats[4]} position={[BX + 5.3, DECK + 2.2 * BUILD_H, BZ + 4.72]} scale={[2, 3 * BUILD_H, 1]} />
      <mesh geometry={GEO.plane} material={marquee} position={[BX, DECK + 7.6 * BUILD_H, FZ + 0.85]} scale={[6.4, 3.2 * BUILD_H, 1]} />
    </group>
  )
}

export function Cinema() {
  const night = useIsNight()
  const label = useMemo(() => getGlassPill('Cine', { dot: '#ff5fa8', sub: 'Próximamente', dark: night }), [night])
  return (
    <group position={[DX, 0, 0]}>
      <Batch version="cine-6">
        <Island />
        <Building />
        <Cartelera />
        <GrandStair />
        <Access />
      </Batch>
      <Screens />
      <ScreenLabel label={label} position={[BX, DECK + 19 * BUILD_H + 0.8, BZ + 3]} pixelHeight={30} maxZoomRatio={3.2} priority={LABEL_PRIORITY.floorSign} />
      <pointLight position={[BX, DECK + 3, FZ + 3.5]} color="#ffd9a0" intensity={night ? 34 : 0} distance={16} decay={2} />
      <pointLight position={[CART.x - 1.5, DECK + 3, CART.z + 1.5]} color="#ffb6d9" intensity={night ? 18 : 0} distance={10} decay={2} />
    </group>
  )
}
