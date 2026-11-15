import { Gift, Play as PlayIcon, Ticket } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ticketInterval, ticketPrint, unlockArcadeAudio } from './audio'
import './arcade.css'

// «Recibir tiquetes»: al terminar una partida salen de la máquina tantos tiquetes de colores como ganaste, uno tras otro (cada uno con
// su «tz» de impresora), y se van apilando juntitos. Al final dice cuántos ganaste y cuántos tienes en total, con las dos opciones:
// ver las recompensas o seguir jugando.

const COLORS = ['#f0791a', '#f0608a', '#27a0d8', '#f4be2c', '#45c186']
/** Cuántos tiquetes se ven a la vez en la pila (los demás se siguen contando). */
const PILE = 14
const T_W = 210
const T_H = 62

/** Un tiquete: borde dentado a los lados, marco rojo, «TICKET» al centro y el número de serie a cada lado. */
function TicketArt({ color, serial }: { color: string; serial: number }) {
  const teeth = 9
  const step = T_H / teeth
  const f = (n: number) => n.toFixed(1)
  // borde dentado: baja por la derecha y sube por la izquierda, con una muesca por diente
  let d = `M0 0 L${T_W} 0`
  for (let i = 0; i < teeth; i++) d += ` L${f(T_W - 4)} ${f(i * step + step / 2)} L${T_W} ${f((i + 1) * step)}`
  d += ` L0 ${T_H}`
  for (let i = 0; i < teeth; i++) d += ` L4 ${f(T_H - i * step - step / 2)} L0 ${f(T_H - (i + 1) * step)}`
  d += ' Z'
  return (
    <svg viewBox={`0 0 ${T_W} ${T_H}`} width={T_W} height={T_H} aria-hidden>
      <path d={d} fill={color} />
      <rect x="9" y="5" width={T_W - 18} height={T_H - 10} rx="5" fill="none" stroke="#d6283a" strokeWidth="1.6" />
      <line x1="34" y1="5" x2="34" y2={T_H - 5} stroke="#d6283a" strokeWidth="1.4" />
      <line x1={T_W - 34} y1="5" x2={T_W - 34} y2={T_H - 5} stroke="#d6283a" strokeWidth="1.4" />
      <text x={T_W / 2} y={T_H / 2 + 8} textAnchor="middle" fontSize="22" fontWeight="900" fill="#14101e" fontFamily="ui-sans-serif, system-ui, -apple-system, Arial, sans-serif" letterSpacing="1">
        TICKET
      </text>
      {[22, T_W - 22].map((x, i) => (
        <text key={x} x={x} y={T_H / 2} textAnchor="middle" fontSize="9" fontWeight="700" fill="#14101e" fontFamily="ui-monospace, Menlo, monospace" transform={`rotate(${i ? 90 : -90} ${x} ${T_H / 2})`}>
          {serial}
        </text>
      ))}
    </svg>
  )
}

/** Posición de reposo de cada tiquete de la pila: apilados hacia arriba, ladeados y corridos un poco (como cayeron). */
const spot = (i: number) => {
  const j = i % PILE
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return { y: 12 + (PILE - 1 - j) * 12, x: (r(1) - 0.5) * 44, rot: (r(2) - 0.5) * 12 }
}

export function TicketReceipt({ game, score, awarded, total, capped, onPrizes, onAgain }: { game: string; score: number; awarded: number; total: number; capped?: boolean; onPrizes: () => void; onAgain?: () => void }) {
  const reduce = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [shown, setShown] = useState(reduce ? awarded : 0)
  const [done, setDone] = useState(reduce || awarded < 1)

  useEffect(() => {
    ticketPrint(awarded)
    if (reduce || awarded < 1) return
    const every = ticketInterval(awarded) * 1000
    const t0 = performance.now() + 140
    let raf = 0
    let end = 0
    const tick = (now: number) => {
      const k = now < t0 ? 0 : Math.min(awarded, Math.floor((now - t0) / every) + 1)
      setShown(k)
      if (k < awarded) raf = requestAnimationFrame(tick)
      else end = window.setTimeout(() => setDone(true), 500)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(end)
    }
  }, [awarded, reduce])

  const first = Math.max(0, shown - PILE)
  const ids = Array.from({ length: shown - first }, (_, k) => first + k)
  return (
    <div className="mx-auto flex w-full max-w-[300px] flex-col items-center" aria-live="polite">
      <p className="font-arcade text-[9px] text-[#00f0ff]">{game.toUpperCase()} · {score} PTS</p>
      {/* máquina: la ranura de donde salen los tiquetes y, debajo, la pila */}
      <div className="receipt-slot mt-2 w-[250px]" aria-hidden />
      <div className="relative -mt-1 h-[236px] w-[250px] overflow-hidden" aria-hidden>
        {ids.map((i) => {
          const p = spot(i)
          return (
            <div
              key={i}
              className={`absolute left-1/2 ${reduce ? '' : 'ticket-drop'}`}
              style={{ top: p.y, marginLeft: -T_W / 2 + p.x, zIndex: i % 1000, ['--rot' as string]: `${p.rot}deg`, ['--rot0' as string]: `${-p.rot * 2}deg`, transform: `rotate(${p.rot}deg)`, filter: 'drop-shadow(0 3px 0 rgba(0,0,0,.28))' }}
            >
              <TicketArt color={COLORS[i % COLORS.length]} serial={371416 + i} />
            </div>
          )
        })}
        {awarded < 1 && <p className="absolute inset-x-0 top-16 text-center text-[13px] text-[#c8d3ff]">Esta vez no hubo tiquetes. ¡Inténtalo otra vez!</p>}
      </div>
      <div className="mt-1 text-center">
        <p className="font-arcade text-[9px] text-[#ffd400]">{done ? '¡GANASTE!' : 'TIQUETES'}</p>
        <p className={`font-arcade text-[34px] leading-none text-white tabular-nums ${done && awarded > 0 ? 'ticket-pop' : ''}`} style={{ textShadow: '3px 3px 0 #ff2bd6' }}>
          +{shown}
        </p>
        {done && (
          <p className="receipt-actions mt-2 text-[13px] font-bold text-[#e8ffff]" style={{ ['--receipt-dur' as string]: '0s' }}>
            Ahora tienes <span className="text-[#ffd400]">{total}</span> {total === 1 ? 'tiquete' : 'tiquetes'}
            {capped ? ' · tope por partida alcanzado' : ''}
          </p>
        )}
      </div>
      <div className={`mt-4 flex min-h-[110px] flex-col items-center gap-2 ${done ? 'receipt-actions' : 'invisible'}`} style={{ ['--receipt-dur' as string]: '0s' }}>
        <button onClick={onPrizes} className="arcade-btn font-arcade flex min-h-12 items-center gap-2 px-6 text-[11px]">
          <Gift className="size-4" /> VER RECOMPENSAS
        </button>
        {onAgain && (
          <button onClick={onAgain} className="font-arcade flex min-h-11 items-center gap-2 px-4 text-[10px] text-[#9fb3ff] underline underline-offset-4">
            <PlayIcon className="size-3.5 fill-current" /> SEGUIR JUGANDO
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Pantalla de fin de partida: «Juego finalizado» con el puntaje y un solo botón, «Ver mis tiquetes». Al tocarlo sale el recibo
 * (con el sonido de la impresora) y muestra cuántos tiquetes ganaste y cuántos tienes en total.
 */
export function GameEnd({ game, score, awarded, total, capped, record, children, onPrizes, onAgain }: { game: string; score: number; awarded: number; total: number; capped?: boolean; record?: boolean; children?: ReactNode; onPrizes: () => void; onAgain: () => void }) {
  const [shown, setShown] = useState(false)
  if (shown) return <TicketReceipt game={game} score={score} awarded={awarded} total={total} capped={capped} onPrizes={onPrizes} onAgain={onAgain} />
  return (
    <div className="flex flex-col items-center gap-2.5">
      <h3 className="font-arcade text-[20px] leading-snug text-[#ff2b2b]" style={{ textShadow: '3px 3px 0 #07031a, 5px 5px 0 #7a0a3a' }}>
        JUEGO
        <br />
        FINALIZADO
      </h3>
      {record && <p className="font-arcade arcade-blink text-[10px] text-[#ffd400]">¡NUEVO RÉCORD!</p>}
      <p className="font-arcade mt-2 text-[9px] text-[#00f0ff]">PUNTAJE</p>
      <p className="font-arcade text-[28px] leading-none text-white" style={{ textShadow: '3px 3px 0 #ff2bd6' }}>
        {score}
      </p>
      {children}
      <button
        autoFocus
        onClick={() => {
          unlockArcadeAudio()
          setShown(true)
        }}
        className="arcade-btn font-arcade mt-3 flex min-h-14 items-center gap-3 px-6 text-[12px]"
      >
        <Ticket className="size-5" /> VER MIS TIQUETES
      </button>
    </div>
  )
}
