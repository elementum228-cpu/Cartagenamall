import { Gift, Play as PlayIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ticketDuration, ticketPrint } from './audio'
import './arcade.css'

// «Recibir tiquetes»: al terminar una partida sale de la máquina una tirita de papel (a pasos, con el sonido de la impresora de las
// ferias), con el puntaje, los tiquetes ganados contando hasta su valor y el total acumulado. Al terminar de salir aparecen las dos
// opciones: ver las recompensas o seguir jugando.

const BARS = Array.from({ length: 34 }, (_, i) => 1 + ((i * 7 + (i % 3) * 5) % 4))

export function TicketReceipt({ game, score, awarded, total, capped, onPrizes, onAgain }: { game: string; score: number; awarded: number; total: number; capped?: boolean; onPrizes: () => void; onAgain?: () => void }) {
  const reduce = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const dur = useRef(ticketDuration(awarded))
  const [shown, setShown] = useState(reduce ? awarded : 0)
  const [done, setDone] = useState(reduce)

  useEffect(() => {
    ticketPrint(awarded)
    if (reduce) return
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / (dur.current * 1000))
      setShown(Math.round(awarded * u))
      if (u < 1) raf = requestAnimationFrame(tick)
      else setDone(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [awarded, reduce])

  const style = { ['--receipt-dur' as string]: `${dur.current}s` }
  const date = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  return (
    <div className="mx-auto flex w-full max-w-[290px] flex-col items-stretch" style={style} aria-live="polite">
      <div className="receipt-slot" aria-hidden />
      <div className="receipt-window mx-3">
        <div className="receipt-paper px-4 pt-4 pb-5 text-center text-[12.5px] leading-tight">
          <p className="text-[13px] font-extrabold tracking-wider">★ ARCADE MALLPLAY ★</p>
          <p className="mt-0.5 text-[11px] opacity-70">{game} · {date}</p>
          <div className="my-2.5 border-t-2 border-dashed border-[#1a1530]/40" />
          <div className="flex justify-between font-bold">
            <span>PUNTAJE</span>
            <span>{score}</span>
          </div>
          <div className="my-2.5 border-t-2 border-dashed border-[#1a1530]/40" />
          <p className="text-[11px] font-bold tracking-widest">TIQUETES GANADOS</p>
          <p className="my-1 text-[38px] leading-none font-black tabular-nums">+{shown}</p>
          {capped && <p className="text-[10.5px] opacity-70">Tope de hoy alcanzado</p>}
          <div className="my-2.5 border-t-2 border-dashed border-[#1a1530]/40" />
          <div className="flex justify-between text-[13px] font-extrabold">
            <span>TIENES</span>
            <span className="tabular-nums">{done || reduce ? total : Math.max(0, total - awarded + shown)} TIQUETES</span>
          </div>
          <div className="mt-3 flex h-8 items-stretch justify-center gap-[2px]" aria-hidden>
            {BARS.map((w, i) => (
              <span key={i} className="bg-[#1a1530]" style={{ width: w }} />
            ))}
          </div>
          <p className="mt-2 text-[10.5px] opacity-70">¡Gracias por jugar!</p>
        </div>
      </div>
      <div className="receipt-actions mt-5 flex flex-col items-center gap-2">
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
