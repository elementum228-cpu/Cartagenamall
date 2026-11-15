import { Play as PlayIcon, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx, unlockArcadeAudio } from '../audio'
import { useArcade } from '../store'
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
}

export function MiniGame({ id }: { id: MiniGameId }) {
  const def = DEFS[id]
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
      if (document.hidden || !state.current) {
        last = 0
        return
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
      last = now
      def.update(state.current, dt)
      paint(now / 1000)
      if (def.done(state.current)) {
        cancelAnimationFrame(raf.current)
        const score = def.score(state.current)
        const r = useArcade.getState().finishRun(score, false)
        sfx(r.record ? 'record' : 'over')
        setResult({ score, awarded: r.awarded, capped: r.capped, record: r.record })
        setPhase('over')
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf.current)
      ro.disconnect()
    }
  }, [phase, def, fit, paint])

  const start = () => {
    unlockArcadeAudio()
    sfx('coin')
    state.current = def.create() as never
    setResult(null)
    setPhase('play')
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
    <div className="arcade-frame flex min-h-0 flex-col items-center gap-3 overflow-hidden px-3 py-3 text-center text-white">
      <div ref={holder} className="relative w-full overflow-hidden border-[3px] border-[#07031a] bg-[#0a0d1f]" style={{ aspectRatio: `${def.W} / ${def.H}`, maxWidth: `calc((100dvh - 230px) * ${def.W / def.H})` }}>
        <canvas ref={canvas} className="block size-full touch-none select-none" onPointerDown={send('down')} onPointerMove={send('move')} onPointerUp={send('up')} onPointerCancel={send('up')} aria-label={`Juego: ${def.name}`} />
        {phase === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#07031a]/92 px-6">
            <h3 className="font-arcade arcade-cyan text-[14px] leading-snug">{def.name.toUpperCase()}</h3>
            <p className="max-w-[28ch] text-[13.5px] leading-snug text-[#e8ffff]">{def.how}</p>
            {best > 0 && <p className="font-arcade text-[8px] text-[#ffd400]">TU RÉCORD EN EL ARCADE: {best}</p>}
            <button autoFocus onClick={start} className="arcade-btn font-arcade mt-1 flex min-h-12 items-center gap-2 px-7 text-[12px]">
              <PlayIcon className="size-4" /> JUGAR
            </button>
          </div>
        )}
        {phase === 'over' && result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#07031a]/92 px-6">
            <p className="font-arcade text-[11px] text-[#ff2bd6]">{result.record ? '¡NUEVO RÉCORD!' : 'FIN DEL JUEGO'}</p>
            <p className="font-arcade text-[26px] text-[#ffd400]">{result.score}</p>
            <p className="font-arcade text-[10px] text-[#00f0ff]">+{result.awarded} PUNTOS</p>
            {result.capped && <p className="max-w-[26ch] text-[12px] leading-snug text-[#c8d3ff]">Llegaste al tope de puntos de hoy. ¡Vuelve mañana!</p>}
            <div className="mt-2 flex gap-2">
              <button autoFocus onClick={start} className="arcade-btn font-arcade flex min-h-12 items-center gap-2 px-5 text-[11px]">
                <RotateCcw className="size-4" /> OTRA VEZ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
