import { BOSS_EVERY, BOSS_R, H, KIND_HP, KIND_R, LIVES, MAX_WEAPON, RAPID_SECONDS, SHIP_Y, W, WAVE_SECONDS, type EnemyKind, type Game } from './engine'

// Dibujo de «Nave Caribe». Los elementos con degradados y brillos (nave, enemigos, disparos, premios y el fondo) se pintan UNA vez en
// lienzos pequeños y después solo se pegan con drawImage: se ven mucho mejor y cuestan casi lo mismo que un rectángulo. Lo que cambia
// cada cuadro (estrellas, llama del motor, partículas, marcador) usa formas simples, sin degradados ni sombras.

const S = 2 // resolución de los sprites: nítidos aunque la pantalla sea de 2×
/** `lw`/`lh`: tamaño lógico con el que se pega un sprite pixelado (sin ellos, el del lienzo entre S). */
type Sprite = HTMLCanvasElement & { lw?: number; lh?: number }

function make(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Sprite {
  const c = document.createElement('canvas')
  c.width = Math.ceil(w * S)
  c.height = Math.ceil(h * S)
  const g = c.getContext('2d')!
  g.scale(S, S)
  g.translate(w / 2, h / 2) // el origen queda en el centro
  paint(g)
  return c
}

const radial = (g: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, stops: [number, string][]) => {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1)
  for (const [o, c] of stops) gr.addColorStop(o, c)
  return gr
}
const linear = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => {
  const gr = g.createLinearGradient(x0, y0, x1, y1)
  for (const [o, c] of stops) gr.addColorStop(o, c)
  return gr
}

/** Tamaño de un «píxel» del arte, en unidades lógicas del campo (360 × 720). */
const PX = 3

/**
 * Convierte un sprite vectorial en pixel art: lo reduce a una rejilla gruesa, deja el alfa en todo o nada, reparte los colores en pocos
 * tonos y le pone un contorno oscuro de un píxel. Devuelve un lienzo pequeño con su tamaño lógico (`lw`/`lh`) para ampliarlo sin suavizado.
 */
function pixelize(src: Sprite, unit: number, outline = '#07031a'): Sprite {
  const wl = src.width / S
  const hl = src.height / S
  const w = Math.max(2, Math.round(wl / unit))
  const h = Math.max(2, Math.round(hl / unit))
  const c = document.createElement('canvas') as Sprite
  c.width = w + 2
  c.height = h + 2
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.imageSmoothingEnabled = true
  g.drawImage(src, 1, 1, w, h)
  const img = g.getImageData(0, 0, w + 2, h + 2)
  const d = img.data
  const q = (v: number) => Math.round(v / 51) * 51 // 6 tonos por canal
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 120) {
      d[i + 3] = 0
      continue
    }
    d[i] = q(d[i])
    d[i + 1] = q(d[i + 1])
    d[i + 2] = q(d[i + 2])
    d[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  // contorno: el mismo dibujo corrido a los cuatro lados, pintado de oscuro, debajo
  const o = document.createElement('canvas')
  o.width = c.width
  o.height = c.height
  const og = o.getContext('2d')!
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) og.drawImage(c, dx, dy)
  og.globalCompositeOperation = 'source-in'
  og.fillStyle = outline
  og.fillRect(0, 0, o.width, o.height)
  og.globalCompositeOperation = 'source-over'
  og.drawImage(c, 0, 0)
  const out = o as Sprite
  out.lw = (w + 2) * unit
  out.lh = (h + 2) * unit
  return out
}

/** Fondo arcade: noche morada con una rejilla de neón (las líneas horizontales corren en cada cuadro, ver `draw`). */
function retroBg(): Sprite {
  const c = document.createElement('canvas') as Sprite
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = linear(g, 0, 0, 0, H, [
    [0, '#06021a'],
    [0.6, '#12063a'],
    [1, '#2a0a52'],
  ])
  g.fillRect(0, 0, W, H)
  // sol retro abajo, con franjas
  g.fillStyle = radial(g, W / 2, H * 0.98, 10, 260, [
    [0, 'rgba(255,43,214,0.40)'],
    [1, 'rgba(255,43,214,0)'],
  ])
  g.fillRect(0, H * 0.45, W, H * 0.55)
  g.strokeStyle = 'rgba(0,240,255,0.13)'
  g.lineWidth = 1
  g.beginPath()
  for (let x = 0; x <= W; x += 45) {
    g.moveTo(x + 0.5, 0)
    g.lineTo(x + 0.5, H)
  }
  g.stroke()
  return c
}

/** Pantalla de tubo: franjas finas y esquinas oscuras, encima de todo (un solo drawImage por cuadro). */
function crtOverlay(): Sprite {
  const k = 2
  const c = document.createElement('canvas') as Sprite
  c.width = W * k
  c.height = H * k
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(0,0,0,0.20)'
  for (let y = 0; y < c.height; y += 6) g.fillRect(0, y, c.width, 2)
  g.fillStyle = radial(g, c.width / 2, c.height / 2, c.height * 0.38, c.height * 0.78, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.45)'],
  ])
  g.fillRect(0, 0, c.width, c.height)
  return c
}

/** Nave pequeña para las vidas (siete por siete «píxeles»). */
function lifeIcon(): Sprite {
  const rows = ['...#...', '..###..', '..###..', '.#####.', '#######', '#.###.#', '#..#..#']
  const u = 3
  const c = document.createElement('canvas') as Sprite
  c.width = 7 * u
  c.height = 7 * u
  const g = c.getContext('2d')!
  rows.forEach((row, y) => {
    for (let x = 0; x < 7; x++) {
      if (row[x] !== '#') continue
      g.fillStyle = y < 3 ? '#e8ffff' : y < 6 ? '#00f0ff' : '#ff2bd6'
      g.fillRect(x * u, y * u, u, u)
    }
  })
  c.lw = c.width
  c.lh = c.height
  return c
}

/** La tipografía de pixeles se pide en cuanto se descarga el juego (queda guardada para jugar sin conexión). */
if (typeof document !== 'undefined' && document.fonts) void document.fonts.load("10px 'Press Start 2P'").catch(() => {})
const FONT = "'Press Start 2P', ui-monospace, monospace"

interface Sprites {
  bg: Sprite
  crt: Sprite
  life: Sprite
  /** La nave, una por nivel de arma (índice 1..MAX_WEAPON): cada arma nueva la hace más robusta. */
  ship: Sprite[]
  boss: Sprite
  enemy: Record<EnemyKind, Sprite>
  weaponOrb: Sprite
  rapidOrb: Sprite
}
let cache: Sprites | null = null

function sprites(): Sprites {
  if (cache) return cache

  // nave: caza esbelto con alas, cabina y luces; la punta mira hacia arriba. Cada nivel de arma añade piezas: cañones gemelos, cañones
  // en las alas, vainas blindadas con doble cañón y, al máximo, alas ampliadas con ocho cañones y motores dobles.
  const barrel = (g: CanvasRenderingContext2D, x: number, y0: number, y1: number, w = 2.6) => {
    g.fillStyle = '#1a2b55'
    g.fillRect(x - w / 2 - 0.7, y0, w + 1.4, y1 - y0)
    g.fillStyle = linear(g, x - w / 2, 0, x + w / 2, 0, [
      [0, '#cfe4ff'],
      [1, '#5b7bb8'],
    ])
    g.fillRect(x - w / 2, y0, w, y1 - y0)
    g.fillStyle = '#4de1ff'
    g.fillRect(x - w / 2, y0 - 1.6, w, 2)
  }
  const paintShip = (g: CanvasRenderingContext2D, level: number) => {
    g.fillStyle = radial(g, 0, 4, 0, 40, [
      [0, level >= 4 ? 'rgba(93,255,155,0.34)' : 'rgba(77,225,255,0.38)'],
      [1, 'rgba(77,225,255,0)'],
    ])
    g.fillRect(-42, -46, 84, 92)
    // nivel 5: alas ampliadas con borde dorado (detrás de todo)
    if (level >= 5) {
      for (const sx of [-1, 1]) {
        g.save()
        g.scale(sx, 1)
        g.beginPath()
        g.moveTo(14, 2)
        g.lineTo(37, 24)
        g.lineTo(35, 31)
        g.lineTo(14, 26)
        g.closePath()
        g.fillStyle = linear(g, 14, 2, 37, 31, [
          [0, '#1f4fb8'],
          [1, '#081c4f'],
        ])
        g.fill()
        g.strokeStyle = '#ffc83d'
        g.lineWidth = 1.6
        g.stroke()
        g.restore()
      }
    }
    // nivel 4+: vainas blindadas a los costados del fuselaje
    if (level >= 4) {
      for (const sx of [-1, 1]) {
        g.save()
        g.scale(sx, 1)
        g.beginPath()
        g.roundRect(9, -10, 9, 30, 4)
        g.fillStyle = linear(g, 9, -10, 18, 20, [
          [0, '#35508f'],
          [1, '#0f2252'],
        ])
        g.fill()
        g.strokeStyle = 'rgba(255,255,255,0.6)'
        g.lineWidth = 0.9
        g.stroke()
        g.fillStyle = '#ffc83d'
        g.fillRect(10.5, -2, 6, 2)
        g.restore()
      }
    }
    // alas
    for (const sx of [-1, 1]) {
      g.save()
      g.scale(sx, 1)
      g.beginPath()
      g.moveTo(5, -6)
      g.lineTo(24, 14)
      g.lineTo(22, 21)
      g.lineTo(13, 17)
      g.lineTo(5, 20)
      g.closePath()
      g.fillStyle = linear(g, 5, -6, 24, 21, [
        [0, '#2f86ff'],
        [1, '#0b2f7a'],
      ])
      g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.55)'
      g.lineWidth = 0.9
      g.stroke()
      g.beginPath()
      g.moveTo(11, 4)
      g.lineTo(21, 15)
      g.strokeStyle = level >= 3 ? '#ffc83d' : '#ff5c8a'
      g.lineWidth = 2
      g.stroke()
      g.beginPath()
      g.arc(22.5, 17.5, 1.7, 0, 6.3)
      g.fillStyle = '#ff9fbb'
      g.fill()
      g.restore()
    }
    // fuselaje
    g.beginPath()
    g.moveTo(0, -28)
    g.bezierCurveTo(7, -14, 9, 2, 7, 18)
    g.lineTo(0, 14)
    g.lineTo(-7, 18)
    g.bezierCurveTo(-9, 2, -7, -14, 0, -28)
    g.closePath()
    g.fillStyle = linear(g, -9, -28, 9, 18, [
      [0, '#f2fdff'],
      [0.45, level >= 4 ? '#8dffc0' : '#6fe6ff'],
      [1, '#1b6dd6'],
    ])
    g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.8)'
    g.lineWidth = 1
    g.stroke()
    // cabina
    g.beginPath()
    g.ellipse(0, -7, 3.6, 8, 0, 0, 6.3)
    g.fillStyle = linear(g, 0, -15, 0, 1, [
      [0, '#9bf0ff'],
      [1, '#0a2457'],
    ])
    g.fill()
    g.beginPath()
    g.ellipse(-1.1, -10, 1.1, 3.2, 0, 0, 6.3)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.fill()
    // toberas (dobles a partir del nivel 5)
    g.fillStyle = '#0b1b3d'
    g.fillRect(-5.5, 16, 4, 4)
    g.fillRect(1.5, 16, 4, 4)
    if (level >= 5) {
      g.fillRect(-16.5, 20, 4, 4)
      g.fillRect(12.5, 20, 4, 4)
    }
    // cañones, de adentro hacia afuera según el nivel
    if (level >= 2) {
      barrel(g, -4.4, -18, -6)
      barrel(g, 4.4, -18, -6)
    }
    if (level >= 3) {
      barrel(g, -19, 2, 14, 2.8)
      barrel(g, 19, 2, 14, 2.8)
      g.fillStyle = '#ffc83d' // punta dorada en la proa
      g.beginPath()
      g.moveTo(0, -33)
      g.lineTo(2.6, -26)
      g.lineTo(-2.6, -26)
      g.closePath()
      g.fill()
    }
    if (level >= 4) {
      barrel(g, -11.5, -14, -4, 2.4)
      barrel(g, 11.5, -14, -4, 2.4)
    }
    if (level >= 5) {
      barrel(g, -27, 10, 22, 3)
      barrel(g, 27, 10, 22, 3)
      g.fillStyle = '#ffc83d'
      g.beginPath()
      g.arc(0, 3, 2.4, 0, 6.3)
      g.fill()
    }
  }
  const ship: Sprite[] = [make(84, 92, (g) => paintShip(g, 1))]
  for (let lv = 1; lv <= MAX_WEAPON; lv++) ship[lv] = make(84, 92, (g) => paintShip(g, lv))

  // cañonero: casco blindado naranja con cañón y ojo central
  const gunner = make(56, 56, (g) => {
    g.fillStyle = radial(g, 0, 0, 8, 28, [
      [0, 'rgba(255,122,69,0.5)'],
      [1, 'rgba(255,122,69,0)'],
    ])
    g.fillRect(-28, -28, 56, 56)
    g.beginPath()
    g.arc(0, 0, 18, 0, 6.3)
    g.fillStyle = radial(g, -5, -6, 2, 20, [
      [0, '#ffd0b0'],
      [0.5, '#e8582b'],
      [1, '#7d1f0a'],
    ])
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = 'rgba(255,255,255,0.8)'
    g.stroke()
    g.fillStyle = '#3a0f05'
    g.fillRect(-3.5, 10, 7, 12)
    g.fillStyle = '#ffd34d'
    g.fillRect(-3.5, 20, 7, 3)
    g.beginPath()
    g.arc(0, -1, 6, 0, 6.3)
    g.fillStyle = '#1a0805'
    g.fill()
    g.beginPath()
    g.arc(-1.5, -2.5, 2.2, 0, 6.3)
    g.fillStyle = '#ff6a4a'
    g.fill()
  })
  // jefe: un kraken de casco morado con corona dorada, ojos furiosos, boca con dientes y cañones laterales
  const boss = make(170, 150, (g) => {
    g.fillStyle = radial(g, 0, 0, 20, 82, [
      [0, 'rgba(255,80,110,0.42)'],
      [1, 'rgba(255,80,110,0)'],
    ])
    g.fillRect(-85, -75, 170, 150)
    // tentáculos
    g.lineCap = 'round'
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        g.beginPath()
        g.moveTo(sx * (14 + i * 15), 24)
        g.bezierCurveTo(sx * (22 + i * 20), 48 + i * 3, sx * (46 + i * 12), 52 + i * 6, sx * (52 + i * 11), 36 + i * 8)
        g.strokeStyle = i % 2 ? '#4b2fb8' : '#5d3bd1'
        g.lineWidth = 10 - i * 2
        g.stroke()
      }
    }
    // corona de púas doradas
    for (let i = -3; i <= 3; i++) {
      g.beginPath()
      g.moveTo(i * 12 - 6, -26 + Math.abs(i) * 4)
      g.lineTo(i * 12, -52 + Math.abs(i) * 7)
      g.lineTo(i * 12 + 6, -26 + Math.abs(i) * 4)
      g.closePath()
      g.fillStyle = '#ffc83d'
      g.fill()
      g.strokeStyle = '#b87900'
      g.lineWidth = 1
      g.stroke()
    }
    // casco
    g.beginPath()
    g.ellipse(0, -2, 54, 42, 0, 0, 6.3)
    g.fillStyle = radial(g, -14, -20, 4, 62, [
      [0, '#c5adff'],
      [0.45, '#7a52e8'],
      [1, '#2a1170'],
    ])
    g.fill()
    g.lineWidth = 2.4
    g.strokeStyle = 'rgba(255,255,255,0.7)'
    g.stroke()
    // cañones laterales
    for (const sx of [-1, 1]) {
      g.fillStyle = '#1a0f44'
      g.fillRect(sx * 50 - 7, 6, 14, 16)
      g.fillStyle = '#ff7a45'
      g.fillRect(sx * 50 - 4, 18, 8, 6)
    }
    // ojos
    for (const sx of [-1, 1]) {
      g.beginPath()
      g.ellipse(sx * 19, -8, 13, 11, 0, 0, 6.3)
      g.fillStyle = '#fff6f0'
      g.fill()
      g.beginPath()
      g.ellipse(sx * 19 - sx * 1.5, -6, 5, 8, 0, 0, 6.3)
      g.fillStyle = '#e1123b'
      g.fill()
      g.beginPath()
      g.ellipse(sx * 19 - sx * 1.5, -6, 1.7, 6, 0, 0, 6.3)
      g.fillStyle = '#1a0510'
      g.fill()
      // ceja furiosa
      g.beginPath()
      g.moveTo(sx * 34, -24)
      g.lineTo(sx * 6, -13)
      g.lineWidth = 4.5
      g.strokeStyle = '#1a0f44'
      g.stroke()
    }
    // boca con dientes
    g.beginPath()
    g.ellipse(0, 20, 24, 10, 0, 0, 3.1416)
    g.fillStyle = '#12051f'
    g.fill()
    g.fillStyle = '#ffffff'
    for (let i = -3; i <= 3; i++) {
      g.beginPath()
      g.moveTo(i * 6.4 - 3, 20)
      g.lineTo(i * 6.4, 27 - Math.abs(i) * 0.5)
      g.lineTo(i * 6.4 + 3, 20)
      g.closePath()
      g.fill()
    }
  })

  const orb = (hi: string, mid: string, lo: string, glow: string) =>
    make(30, 30, (g) => {
      g.fillStyle = radial(g, 0, 0, 6, 15, [
        [0, glow],
        [1, 'rgba(0,0,0,0)'],
      ])
      g.fillRect(-15, -15, 30, 30)
      g.beginPath()
      g.arc(0, 0, 11, 0, 6.3)
      g.fillStyle = radial(g, -3.5, -4, 1, 12, [
        [0, hi],
        [0.55, mid],
        [1, lo],
      ])
      g.fill()
      g.beginPath()
      g.arc(-3.6, -4.2, 3, 0, 6.3)
      g.fillStyle = 'rgba(255,255,255,0.7)'
      g.fill()
    })
  const pink = orb('#ffe1ea', '#ff5c8a', '#a91d57', 'rgba(255,92,138,0.4)')
  const gold = make(30, 30, (g) => {
    g.fillStyle = radial(g, 0, 0, 5, 15, [
      [0, 'rgba(255,200,61,0.55)'],
      [1, 'rgba(255,200,61,0)'],
    ])
    g.fillRect(-15, -15, 30, 30)
    g.strokeStyle = 'rgba(255,243,191,0.85)'
    g.lineWidth = 1.4
    for (let i = 0; i < 4; i++) {
      g.save()
      g.rotate((i * Math.PI) / 4)
      g.beginPath()
      g.moveTo(-13.5, 0)
      g.lineTo(13.5, 0)
      g.stroke()
      g.restore()
    }
    g.beginPath()
    g.arc(0, 0, 9.5, 0, 6.3)
    g.fillStyle = radial(g, -3, -3.5, 1, 10, [
      [0, '#fffbe0'],
      [0.5, '#ffc83d'],
      [1, '#b87900'],
    ])
    g.fill()
  })
  const diamond = make(46, 46, (g) => {
    g.fillStyle = radial(g, 0, 0, 8, 23, [
      [0, 'rgba(139,92,255,0.45)'],
      [1, 'rgba(139,92,255,0)'],
    ])
    g.fillRect(-23, -23, 46, 46)
    const R = 17
    const facets: [number, number, number, number, string][] = [
      [0, -R, R, 0, '#c5adff'],
      [R, 0, 0, R, '#7a52e8'],
      [0, R, -R, 0, '#4b2fb8'],
      [-R, 0, 0, -R, '#9a78ff'],
    ]
    for (const [x1, y1, x2, y2, c] of facets) {
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(x1, y1)
      g.lineTo(x2, y2)
      g.closePath()
      g.fillStyle = c
      g.fill()
    }
    g.strokeStyle = 'rgba(255,255,255,0.75)'
    g.lineWidth = 1.1
    g.beginPath()
    g.moveTo(0, -R)
    g.lineTo(R, 0)
    g.lineTo(0, R)
    g.lineTo(-R, 0)
    g.closePath()
    g.stroke()
    g.fillStyle = '#26105e'
    g.fillRect(-4.5, -4.5, 9, 9)
    g.fillStyle = 'rgba(255,255,255,0.8)'
    g.fillRect(-2, -2, 2.4, 2.4)
  })


  const pickup = (hi: string, mid: string, lo: string, glow: string, glyph: (g: CanvasRenderingContext2D) => void) =>
    make(44, 44, (g) => {
      g.fillStyle = radial(g, 0, 0, 7, 22, [
        [0, glow],
        [1, 'rgba(0,0,0,0)'],
      ])
      g.fillRect(-22, -22, 44, 44)
      g.beginPath()
      g.arc(0, 0, 14, 0, 6.3)
      g.fillStyle = radial(g, -4, -5, 1, 15, [
        [0, hi],
        [0.6, mid],
        [1, lo],
      ])
      g.fill()
      g.lineWidth = 2
      g.strokeStyle = 'rgba(255,255,255,0.9)'
      g.stroke()
      glyph(g)
    })
  const weaponOrb = pickup('#c9ffdc', '#2ee07f', '#0a7d3e', 'rgba(70,255,150,0.55)', (g) => {
    g.fillStyle = '#ffffff'
    g.fillRect(-2.2, -7.5, 4.4, 15)
    g.fillRect(-7.5, -2.2, 15, 4.4)
  })
  const rapidOrb = pickup('#ffe6b8', '#ff9f2e', '#b34d00', 'rgba(255,170,60,0.55)', (g) => {
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.moveTo(1.5, -9)
    g.lineTo(-5.5, 1.5)
    g.lineTo(-0.5, 1.5)
    g.lineTo(-2.5, 9)
    g.lineTo(5.5, -2)
    g.lineTo(0.5, -2)
    g.closePath()
    g.fill()
  })

  // Estilo arcade: cada sprite vectorial se reduce a «píxeles» grandes (alfa duro, pocos colores y contorno oscuro) una sola vez; al dibujarse se
  // amplían sin suavizado. Cuesta lo mismo que antes: son los mismos drawImage.
  cache = {
    bg: retroBg(),
    crt: crtOverlay(),
    life: lifeIcon(),
    ship: ship.map((x) => pixelize(x, PX)),
    boss: pixelize(boss, PX),
    enemy: { 0: pixelize(pink, PX), 1: pixelize(diamond, PX), 2: pixelize(gold, PX), 3: pixelize(gunner, PX) },
    weaponOrb: pixelize(weaponOrb, 2),
    rapidOrb: pixelize(rapidOrb, 2),
  }
  return cache
}

/** Pega un sprite alineado a la rejilla de píxeles del arte (así se mueve «a saltos», como en una máquina de verdad). */
const put = (ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, scale = 1) => {
  const w = (sp.lw ?? sp.width / S) * scale
  const h = (sp.lh ?? sp.height / S) * scale
  ctx.drawImage(sp, Math.round((x - w / 2) / PX) * PX, Math.round((y - h / 2) / PX) * PX, w, h)
}

export interface DrawOptions {
  /** Mejor puntaje de este dispositivo (se ve como «HI»). */
  hi?: number
  /** Efecto de pantalla de tubo (se apaga en calidad baja). */
  crt?: boolean
}

const NEON = ['#39ff88', '#00f0ff', '#ffb000', '#ff2bd6'] as const
const pad = (n: number, len = 6) => String(Math.max(0, Math.floor(n))).padStart(len, '0')

/** Dibuja el cuadro. `ctx` ya viene escalado para que 1 unidad = 1 unidad lógica. */
export function draw(g: Game, ctx: CanvasRenderingContext2D, reduceMotion = false, opts: DrawOptions = {}) {
  const sp = sprites()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(sp.bg, 0, 0, W, H)

  // rejilla de neón que baja (la sensación de avanzar)
  ctx.strokeStyle = 'rgba(255,43,214,0.24)'
  ctx.lineWidth = 1
  ctx.beginPath()
  const off = reduceMotion ? 0 : (g.time * 48) % 60
  for (let y = -60 + off; y < H; y += 60) {
    ctx.moveTo(0, Math.round(y) + 0.5)
    ctx.lineTo(W, Math.round(y) + 0.5)
  }
  ctx.stroke()

  // estrellas (un solo trazo por tamaño)
  ctx.fillStyle = '#9fb3ff'
  for (const s of g.stars) if (s.s === 1) ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2)
  ctx.fillStyle = '#ffffff'
  for (const s of g.stars) if (s.s === 2) ctx.fillRect(Math.round(s.x), Math.round(s.y), 3, 3)

  // premios que caen (parpadean, como en las máquinas)
  for (const k of g.pickups) {
    if (!k.on) continue
    if (!reduceMotion && Math.floor(k.phase * 1.4) % 4 === 3) continue
    put(ctx, k.kind === 0 ? sp.weaponOrb : sp.rapidOrb, k.x, k.y)
  }

  // disparos de la nave: barritas de neón
  for (const b of g.bullets) {
    if (!b.on) continue
    const x = Math.round(b.x)
    const y = Math.round(b.y)
    ctx.fillStyle = '#00f0ff'
    ctx.fillRect(x - 3, y - 8, 6, 14)
    ctx.fillStyle = '#e8ffff'
    ctx.fillRect(x - 1.5, y - 10, 3, 14)
  }

  // disparos enemigos: cuadros magenta con centro blanco
  for (const b of g.ebullets) {
    if (!b.on) continue
    const x = Math.round(b.x)
    const y = Math.round(b.y)
    ctx.fillStyle = '#ff2bd6'
    ctx.fillRect(x - 4, y - 4, 8, 8)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
  }

  // enemigos (se aclaran un instante al recibir un disparo)
  for (const e of g.enemies) {
    if (!e.on) continue
    put(ctx, sp.enemy[e.kind], e.x, e.y)
    if (e.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'
      put(ctx, sp.enemy[e.kind], e.x, e.y)
      ctx.globalCompositeOperation = 'source-over'
    }
    // el cañonero muestra cuánta vida le queda
    if (e.kind === 3) {
      const r = KIND_R[3]
      const max = KIND_HP[3] + Math.floor(Math.max(0, g.prog - 150) / 60) * 2
      ctx.fillStyle = '#07031a'
      ctx.fillRect(Math.round(e.x - r), Math.round(e.y - r - 10), r * 2, 5)
      ctx.fillStyle = '#ffb000'
      ctx.fillRect(Math.round(e.x - r), Math.round(e.y - r - 10), Math.round(r * 2 * Math.max(0, Math.min(1, e.hp / max))), 5)
    }
  }

  // jefe
  if (g.boss.on) {
    const bs = g.boss
    const bob = reduceMotion ? 0 : Math.round(Math.sin(bs.age * 3) * 2)
    const bw = (BOSS_R * 2) / 100
    put(ctx, sp.boss, bs.x, bs.y + bob, bw * 1.0)
    if (bs.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'
      put(ctx, sp.boss, bs.x, bs.y + bob, bw * 1.0)
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  // partículas: cuadritos de píxel
  for (const p of g.parts) {
    if (!p.on) continue
    ctx.fillStyle = p.color
    ctx.fillRect(Math.round(p.x / 3) * 3 - 3, Math.round(p.y / 3) * 3 - 3, 6, 6)
  }

  // nave: llama del motor y escudo al recibir un golpe
  if (!g.over) {
    const x = g.shipX
    const y = SHIP_Y
    if (!reduceMotion) {
      const f = Math.floor(g.time * 24) % 3
      ctx.fillStyle = '#ff7a00'
      ctx.fillRect(Math.round(x / 3) * 3 - 6, y + 12, 6, 6 + f * 3)
      ctx.fillRect(Math.round(x / 3) * 3 + 0, y + 12, 6, 6 + f * 3)
      ctx.fillStyle = '#fff34d'
      ctx.fillRect(Math.round(x / 3) * 3 - 3, y + 12, 3, 3 + f * 3)
      ctx.fillRect(Math.round(x / 3) * 3 + 3, y + 12, 3, 3 + f * 3)
      if (g.weapon >= MAX_WEAPON) {
        ctx.fillStyle = '#ff7a00'
        ctx.fillRect(Math.round(x / 3) * 3 - 18, y + 16, 6, 6 + f * 3)
        ctx.fillRect(Math.round(x / 3) * 3 + 12, y + 16, 6, 6 + f * 3)
      }
    }
    ctx.globalAlpha = g.invuln > 0 && Math.floor(g.time * 16) % 2 === 0 ? 0.5 : 1
    put(ctx, sp.ship[Math.min(MAX_WEAPON, Math.max(1, g.weapon))], x, y + 2)
    ctx.globalAlpha = 1
    if (g.invuln > 0) {
      ctx.strokeStyle = '#00f0ff'
      ctx.lineWidth = 3
      ctx.strokeRect(Math.round(x / 3) * 3 - 24, y - 24, 48, 48)
    }
    if (g.glow > 0) {
      ctx.strokeStyle = `rgba(57,255,136,${Math.min(1, g.glow * 2)})`
      ctx.lineWidth = 3
      const r = 24 + Math.round((0.5 - g.glow) * 60 / 3) * 3
      ctx.strokeRect(Math.round(x / 3) * 3 - r, y - r, r * 2, r * 2)
    }
  }

  // ── HUD arcade (tipografía de píxeles) ─────────────────────────────────────────────────────────────────────────────────────
  ctx.textBaseline = 'top'
  const txt = (s: string, x: number, y: number, color: string, size: number, align: CanvasTextAlign = 'left') => {
    ctx.font = `${size}px ${FONT}`
    ctx.textAlign = align
    ctx.fillStyle = '#07031a'
    ctx.fillText(s, x + 2, y + 2)
    ctx.fillStyle = color
    ctx.fillText(s, x, y)
  }
  const boss = g.boss.on
  const wave = g.wave
  const diff = NEON[g.diff.id]
  const mult = (g.diff.mult / 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })

  // barra fina arriba: avance de la oleada o, durante el jefe, su vida
  ctx.fillStyle = boss ? '#ff2bd6' : '#00f0ff'
  ctx.fillRect(0, 0, Math.round(W * (boss ? Math.max(0, g.boss.hp / g.boss.maxHp) : Math.min(1, g.waveT / WAVE_SECONDS)) / 3) * 3, 3)

  txt('1UP', 14, 10, '#00f0ff', 8)
  txt(pad(g.score), 14, 24, '#ffffff', 14)
  if (opts.hi !== undefined) txt(`HI ${pad(Math.max(opts.hi, g.score))}`, 14, 46, '#ffd400', 8)
  for (let i = 0; i < LIVES; i++) {
    ctx.globalAlpha = i < g.lives ? 1 : 0.2
    ctx.drawImage(sp.life, 14 + i * 28, 62, sp.life.lw!, sp.life.lh!)
  }
  ctx.globalAlpha = 1
  // nivel de arma (cinco cuadros) y cadencia rápida
  txt('PWR', 14, 90, '#39ff88', 8)
  for (let i = 0; i < MAX_WEAPON; i++) {
    ctx.fillStyle = i < g.weapon ? '#39ff88' : 'rgba(255,255,255,0.16)'
    ctx.fillRect(14 + i * 14, 104, 11, 8)
  }
  if (g.rapid > 0) {
    ctx.fillStyle = '#ffb000'
    ctx.fillRect(14, 116, Math.round((70 * Math.min(1, g.rapid / RAPID_SECONDS)) / 2) * 2, 5)
  }

  // arriba al centro: dificultad y oleada (o jefe)
  txt(`${g.diff.name.toUpperCase()} X${mult}`, W / 2 + 6, 10, diff, 8, 'center')
  txt(boss ? `JEFE ${g.boss.num}` : `OLEADA ${pad(wave, 2)}`, W / 2 + 6, 24, boss ? '#ff2bd6' : '#e8ffff', 10, 'center')
  if (boss) {
    // barra de vida del jefe, en bloques
    const bx = W / 2 - 74
    ctx.fillStyle = '#07031a'
    ctx.fillRect(bx - 3, 40, 160, 14)
    const blocks = 16
    const full = Math.ceil(blocks * Math.max(0, g.boss.hp / g.boss.maxHp))
    for (let i = 0; i < blocks; i++) {
      ctx.fillStyle = i < full ? (full <= 5 ? '#ff2b2b' : '#ff2bd6') : 'rgba(255,255,255,0.14)'
      ctx.fillRect(bx + i * 9, 43, 7, 8)
    }
  }

  // avisos grandes que parpadean: jefe llegando, jefe vencido u oleada nueva
  if (!g.over) {
    const blink = reduceMotion || Math.floor(g.time * 7) % 2 === 0
    const big = (a: string, b: string, color: string, size: number, alpha: number) => {
      ctx.globalAlpha = alpha
      if (blink) txt(a, W / 2, H * 0.3, color, size, 'center')
      txt(b, W / 2, H * 0.3 + size + 18, '#ffffff', 9, 'center')
      ctx.globalAlpha = 1
    }
    if (g.msg === 1) big('¡CUIDADO!', 'JEFE FINAL', '#ff2b2b', 26, Math.min(1, g.msgT))
    else if (g.msg === 2) big('¡JEFE VENCIDO!', `+1 VIDA · OLEADA ${pad(wave, 2)}`, '#39ff88', 18, Math.min(1, g.msgT))
    else if (!boss && wave > 1 && g.waveT < 1.8) big(`OLEADA ${pad(wave, 2)}`, wave % BOSS_EVERY === 0 ? 'JEFE AL FINAL' : '¡LISTO!', '#ffd400', 24, Math.min(1, (1.8 - g.waveT) * 1.2))
  }

  if (opts.crt !== false) ctx.drawImage(sp.crt, 0, 0, W, H)
}
