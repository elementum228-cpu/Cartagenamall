import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx, startMusic, stopMusic, unlockArcadeAudio } from '../audio'
import { CoinSlot } from '../CoinSlot'
import { TICKET_SCALE, useArcade } from '../store'
import { GameEnd } from '../TicketReceipt'
import type { GameDef, MiniGameId } from './defs'
import { BOWLS, CRABS } from './defs'

// Marco de los juegos cortos de la Zona Arcade: el lienzo, el bucle, los toques y las pantallas de inicio y de fin. La lógica de cada juego
// vive en `defs.ts`. El bucle solo corre mientras se juega.

const DEFS: Record<MiniGameId, GameDef<never>> = { cangrejos: CRABS as unknown as GameDef<never>, bolos: BOWLS as unknown as GameDef<never> }

interface Result {
  score: number
  awarded: number
  capped: boolean
  record: boolean
  total: number
}

export function MiniGame({ id, onPrizes, active = true }: { id: MiniGameId; onPrizes: () => void; active?: boolean }) {
  const activeRef = useRef(active)
  activeRef.current = active
  const def = DEFS[id]
  /** Todos los juegos cortos usan el marco suave del Arcade. */
  const soft = true
  const holder = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef<never | null>(null)
  const raf = useRef(0)
  const [phase, setPhase] = useState<'menu' | 'play' | 'over'>('menu')
  const [result, setResult] = useState<Result | null>(null)
  const best = useArcade((s) => s.best)

  const fit = useCallback(() => {
    const cv = canvas.current
    const h = holder.current
    if (!cv || !h) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = Math.max(1, Math.round(h.clientWidth * dpr))
    cv.height = Math.max(1, Math.round((cv.width * def.H) / def.W))
  }, [def])

  const paint = useCallback(
    (t: number) => {
      const cv = canvas.current
      const ctx = cv?.getContext('2d', { alpha: false })
      if (!cv || !ctx || !state.current) return
      ctx.setTransform(cv.width / def.W, 0, 0, cv.width / def.W, 0, 0)
      def.draw(state.current, ctx, t)
    },
    [def],
  )

  useEffect(() => {
    if (phase !== 'play') return
    fit()
    const ro = new ResizeObserver(fit)
    if (holder.current) ro.observe(holder.current)
    let last = 0
    const tick = (now: number) => {
      raf.current = requestAnimationFrame(tick)
      if (document.hidden || !state.current || !activeRef.current) {
        last = 0
        return
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
      last = now
      def.update(state.current, dt)
      def.takeSounds?.(state.current).forEach((k) => sfx(k))
      paint(now / 1000)
      if (def.done(state.current)) {
        cancelAnimationFrame(raf.current)
        stopMusic()
        const score = def.score(state.current)
        const r = useArcade.getState().finishRun(score, false, undefined, TICKET_SCALE[id])
        sfx(r.record ? 'record' : 'over')
        setResult({ score, awarded: r.awarded, capped: r.capped, record: r.record, total: useArcade.getState().points })
        setPhase('over')
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf.current)
      ro.disconnect()
    }
  }, [phase, def, fit, paint])

  // al mirar los premios la partida queda en pausa y la música se calla
  useEffect(() => {
    if (phase !== 'play') return
    if (!active) stopMusic()
    else if (useArcade.getState().sound) startMusic()
  }, [active, phase])

  // la música se corta al salir del juego (cerrar, cambiar de pestaña o de juego)
  useEffect(() => () => stopMusic(), [])

  /** Empieza la partida (la moneda ya se insertó). */
  const start = () => {
    unlockArcadeAudio()
    state.current = def.create() as never
    setResult(null)
    setPhase('play')
    if (useArcade.getState().sound) startMusic()
  }

  /** Posición del toque en coordenadas del campo. */
  const at = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * def.W, y: ((e.clientY - r.top) / r.height) * def.H }
  }
  const send = (kind: 'down' | 'move' | 'up') => (e: React.PointerEvent) => {
    if (phase !== 'play' || !state.current) return
    if (kind === 'down') (e.target as Element).setPointerCapture?.(e.pointerId)
    const p = at(e)
    const res = def.pointer(state.current, kind, p.x, p.y, performance.now())
    if (res && res.sfx) sfx(res.sfx)
  }

  return (
    <div className={`${soft ? 'px-0 py-0' : 'arcade-frame px-3 py-3'} flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden text-center text-white`}>
      <div ref={holder} className={`relative w-full overflow-hidden ${soft ? `rounded-[24px] border-2 border-white/70 shadow-[0_14px_30px_-16px_rgba(60,30,100,0.7)] ${id === 'cangrejos' ? 'bg-[#e9b983]' : 'bg-[#120a40]'}` : 'border-[3px] border-[#07031a] bg-[#0a0d1f]'}`} style={{ aspectRatio: `${def.W} / ${def.H}`, maxWidth: `calc((100dvh - ${soft ? 146 : 230}px) * ${def.W / def.H})` }}>
        <canvas ref={canvas} className="block size-full touch-none select-none" onPointerDown={send('down')} onPointerMove={send('move')} onPointerUp={send('up')} onPointerCancel={send('up')} aria-label={`Juego: ${def.name}`} />
        {phase === 'menu' && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 ${soft ? 'bg-[#2a1a5e]/55 backdrop-blur-[3px]' : 'bg-[#07031a]/92'}`}>
            {soft ? <h3 className="text-[26px] leading-tight font-extrabold tracking-tight text-white drop-shadow">{def.name}</h3> : <h3 className="font-arcade arcade-cyan text-[14px] leading-snug">{def.name.toUpperCase()}</h3>}
            <p className={`max-w-[28ch] text-[13.5px] leading-snug ${soft ? 'font-semibold text-white/90' : 'text-[#e8ffff]'}`}>{def.how}</p>
            {best > 0 && (soft ? <p className="text-[12px] font-bold text-[#ffe36b]">Tu récord en el Arcade: {best}</p> : <p className="font-arcade text-[8px] text-[#ffd400]">TU RÉCORD EN EL ARCADE: {best}</p>)}
            <CoinSlot onStart={start} />
          </div>
        )}
        {phase === 'over' && result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-y-auto bg-[#07031a]/95 px-4 py-4">
            <GameEnd game={def.name} score={result.score} awarded={result.awarded} total={result.total} capped={result.capped} record={result.record} onPrizes={onPrizes} onAgain={() => setPhase('menu')} />
          </div>
        )}
      </div>
    </div>
  )
}
