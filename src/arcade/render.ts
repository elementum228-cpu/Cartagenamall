import { H, KIND_R, LIVES, MAX_WEAPON, RAPID_SECONDS, ROUND_SECONDS, SHIP_R, SHIP_Y, W, type EnemyKind, type Game } from './engine'

// Dibujo de «Nave Caribe». Los elementos con degradados y brillos (nave, enemigos, disparos, premios y el fondo) se pintan UNA vez en
// lienzos pequeños y después solo se pegan con drawImage: se ven mucho mejor y cuestan casi lo mismo que un rectángulo. Lo que cambia
// cada cuadro (estrellas, llama del motor, partículas, marcador) usa formas simples, sin degradados ni sombras.

const S = 2 // resolución de los sprites: nítidos aunque la pantalla sea de 2×
type Sprite = HTMLCanvasElement

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

interface Sprites {
  bg: Sprite
  ship: Sprite
  enemy: Record<EnemyKind, Sprite>
  bullet: Sprite
  weaponOrb: Sprite
  rapidOrb: Sprite
}
let cache: Sprites | null = null

function sprites(): Sprites {
  if (cache) return cache

  // fondo: degradado nocturno con dos nebulosas suaves
  const bg = (() => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')!
    g.fillStyle = linear(g, 0, 0, 0, H, [
      [0, '#070a2a'],
      [0.55, '#0a1647'],
      [1, '#0d2a5e'],
    ])
    g.fillRect(0, 0, W, H)
    g.fillStyle = radial(g, W * 0.2, H * 0.28, 0, 190, [
      [0, 'rgba(139,92,255,0.28)'],
      [1, 'rgba(139,92,255,0)'],
    ])
    g.fillRect(0, 0, W, H)
    g.fillStyle = radial(g, W * 0.85, H * 0.72, 0, 230, [
      [0, 'rgba(19,185,173,0.22)'],
      [1, 'rgba(19,185,173,0)'],
    ])
    g.fillRect(0, 0, W, H)
    return c
  })()

  // nave: caza esbelto con alas, cabina y luces; la punta mira hacia arriba
  const ship = make(64, 74, (g) => {
    g.fillStyle = radial(g, 0, 4, 0, 34, [
      [0, 'rgba(77,225,255,0.38)'],
      [1, 'rgba(77,225,255,0)'],
    ])
    g.fillRect(-32, -37, 64, 74)
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
      g.strokeStyle = '#ff5c8a'
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
      [0.45, '#6fe6ff'],
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
    // toberas
    g.fillStyle = '#0b1b3d'
    g.fillRect(-5.5, 16, 4, 4)
    g.fillRect(1.5, 16, 4, 4)
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

  const bullet = make(10, 26, (g) => {
    g.fillStyle = linear(g, 0, -12, 0, 12, [
      [0, 'rgba(255,255,255,0)'],
      [0.25, '#e8fcff'],
      [0.7, '#4de1ff'],
      [1, 'rgba(77,225,255,0)'],
    ])
    g.beginPath()
    g.roundRect(-2.2, -12, 4.4, 24, 2.2)
    g.fill()
    g.fillStyle = 'rgba(77,225,255,0.25)'
    g.beginPath()
    g.roundRect(-4.6, -10, 9.2, 20, 4.6)
    g.fill()
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

  cache = { bg, ship, enemy: { 0: pink, 1: diamond, 2: gold }, bullet, weaponOrb, rapidOrb }
  return cache
}

const put = (ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, scale = 1) => {
  const w = (sp.width / S) * scale
  const h = (sp.height / S) * scale
  ctx.drawImage(sp, x - w / 2, y - h / 2, w, h)
}

/** Dibuja el cuadro. `ctx` ya viene escalado para que 1 unidad = 1 unidad lógica. */
export function draw(g: Game, ctx: CanvasRenderingContext2D, reduceMotion = false) {
  const sp = sprites()
  ctx.drawImage(sp.bg, 0, 0, W, H)

  // estrellas (un solo trazo por tamaño)
  ctx.fillStyle = '#9fb3ff'
  for (const s of g.stars) if (s.s === 1) ctx.fillRect(s.x, s.y, 1, 1)
  ctx.fillStyle = '#e6ecff'
  for (const s of g.stars) if (s.s === 2) ctx.fillRect(s.x, s.y, 2, 2)

  // premios que caen (laten un poco)
  for (const k of g.pickups) {
    if (!k.on) continue
    put(ctx, k.kind === 0 ? sp.weaponOrb : sp.rapidOrb, k.x, k.y, reduceMotion ? 1 : 1 + 0.08 * Math.sin(k.phase))
  }

  // disparos (los del abanico van un poco inclinados)
  for (const b of g.bullets) {
    if (!b.on) continue
    if (b.vx === 0) put(ctx, sp.bullet, b.x, b.y)
    else {
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.vx / 560)
      put(ctx, sp.bullet, 0, 0)
      ctx.restore()
    }
  }

  // enemigos (blancos un instante al recibir un disparo)
  for (const e of g.enemies) {
    if (!e.on) continue
    if (e.flash > 0) {
      const r = KIND_R[e.kind]
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      if (e.kind === 1) {
        ctx.moveTo(e.x, e.y - r)
        ctx.lineTo(e.x + r, e.y)
        ctx.lineTo(e.x, e.y + r)
        ctx.lineTo(e.x - r, e.y)
        ctx.closePath()
      } else ctx.arc(e.x, e.y, r, 0, 6.2832)
      ctx.fill()
    } else put(ctx, sp.enemy[e.kind], e.x, e.y)
  }

  // partículas
  for (const p of g.parts) {
    if (!p.on) continue
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
  }

  // nave: llama del motor, anillo al recibir un golpe y destello al recoger un premio
  if (!g.over) {
    const x = g.shipX
    const y = SHIP_Y
    if (!reduceMotion) {
      const f = Math.floor(g.time * 30) % 3
      ctx.fillStyle = '#ff9a2e'
      ctx.fillRect(x - 5.5, y + 12, 4, 7 + f)
      ctx.fillRect(x + 1.5, y + 12, 4, 7 + f)
      ctx.fillStyle = '#fff1a8'
      ctx.fillRect(x - 4.5, y + 12, 2, 4 + f)
      ctx.fillRect(x + 2.5, y + 12, 2, 4 + f)
    }
    ctx.globalAlpha = g.invuln > 0 && Math.floor(g.time * 16) % 2 === 0 ? 0.55 : 1
    put(ctx, sp.ship, x, y + 2)
    ctx.globalAlpha = 1
    if (g.invuln > 0) {
      ctx.strokeStyle = 'rgba(77,225,255,0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, SHIP_R + 12, 0, 6.2832)
      ctx.stroke()
    }
    if (g.glow > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, g.glow * 2)})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, SHIP_R + 10 + (0.5 - g.glow) * 40, 0, 6.2832)
      ctx.stroke()
    }
  }

  // tiempo restante: una barra fina arriba
  ctx.fillStyle = '#4de1ff'
  ctx.fillRect(0, 0, W * Math.max(0, 1 - g.time / ROUND_SECONDS), 3)

  // marcador (a la izquierda: los botones de sonido, pausa y cerrar van a la derecha, fuera del canvas)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.font = '800 26px Manrope, system-ui, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(g.score), 14, 12)
  for (let i = 0; i < LIVES; i++) {
    ctx.globalAlpha = i < g.lives ? 1 : 0.25
    put(ctx, sp.ship, 22 + i * 24, 58, 0.34)
  }
  ctx.globalAlpha = 1
  // nivel del arma y cadencia rápida
  for (let i = 0; i < MAX_WEAPON; i++) {
    ctx.fillStyle = i < g.weapon ? '#5dff9b' : 'rgba(255,255,255,0.18)'
    ctx.fillRect(14 + i * 14, 78, 11, 5)
  }
  if (g.rapid > 0) {
    ctx.fillStyle = '#ffb347'
    ctx.fillRect(14, 87, 53 * Math.min(1, g.rapid / RAPID_SECONDS), 4)
  }
}
