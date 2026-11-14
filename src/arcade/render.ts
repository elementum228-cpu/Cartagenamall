import { H, KIND_COLOR, KIND_R, LIVES, ROUND_SECONDS, SHIP_R, SHIP_Y, W, type Game } from './engine'

/** Dibuja el cuadro. `ctx` ya viene escalado para que 1 unidad = 1 unidad lógica. */
export function draw(g: Game, ctx: CanvasRenderingContext2D, reduceMotion = false) {
  ctx.fillStyle = '#070b24'
  ctx.fillRect(0, 0, W, H)

  // estrellas (un solo trazo por tamaño)
  ctx.fillStyle = '#9fb3ff'
  for (const s of g.stars) if (s.s === 1) ctx.fillRect(s.x, s.y, 1, 1)
  ctx.fillStyle = '#e6ecff'
  for (const s of g.stars) if (s.s === 2) ctx.fillRect(s.x, s.y, 2, 2)

  // balas
  ctx.fillStyle = '#4de1ff'
  for (const b of g.bullets) if (b.on) ctx.fillRect(b.x - 1.5, b.y - 8, 3, 12)

  // enemigos
  for (const e of g.enemies) {
    if (!e.on) continue
    const r = KIND_R[e.kind]
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : KIND_COLOR[e.kind]
    if (e.kind === 1) {
      ctx.beginPath()
      ctx.moveTo(e.x, e.y - r)
      ctx.lineTo(e.x + r, e.y)
      ctx.lineTo(e.x, e.y + r)
      ctx.lineTo(e.x - r, e.y)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#2a1466'
      ctx.fillRect(e.x - 4, e.y - 4, 8, 8)
    } else {
      ctx.beginPath()
      ctx.arc(e.x, e.y, r, 0, 6.2832)
      ctx.fill()
      ctx.fillStyle = e.kind === 2 ? '#fff3bf' : '#ffd0de'
      ctx.beginPath()
      ctx.arc(e.x - r * 0.3, e.y - r * 0.3, r * 0.3, 0, 6.2832)
      ctx.fill()
    }
  }

  // partículas
  for (const p of g.parts) {
    if (!p.on) continue
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
  }

  // nave (parpadea mientras es invulnerable)
  if (!g.over && (g.invuln <= 0 || Math.floor(g.time * 14) % 2 === 0)) {
    const x = g.shipX
    const y = SHIP_Y
    ctx.fillStyle = '#4de1ff'
    ctx.beginPath()
    ctx.moveTo(x, y - SHIP_R - 4)
    ctx.lineTo(x + SHIP_R, y + SHIP_R)
    ctx.lineTo(x, y + SHIP_R - 5)
    ctx.lineTo(x - SHIP_R, y + SHIP_R)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 2, y - 6, 4, 8)
    // llama del motor
    if (!reduceMotion) {
      ctx.fillStyle = Math.floor(g.time * 30) % 2 ? '#ffb347' : '#ff7a3d'
      ctx.fillRect(x - 3, y + SHIP_R - 4, 6, 6 + (Math.floor(g.time * 30) % 3))
    }
  }

  // tiempo restante: una barra fina arriba
  ctx.fillStyle = '#4de1ff'
  ctx.fillRect(0, 0, W * Math.max(0, 1 - g.time / ROUND_SECONDS), 3)

  // marcador
  ctx.font = '700 18px Manrope, system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(g.score), 14, 12)
  ctx.textAlign = 'right'
  for (let i = 0; i < LIVES; i++) {
    ctx.fillStyle = i < g.lives ? (g.hurt > 0 && i === g.lives ? '#ffffff' : '#ff5c8a') : '#33385f'
    ctx.beginPath()
    ctx.arc(W - 18 - i * 22, 22, 7, 0, 6.2832)
    ctx.fill()
  }
}
