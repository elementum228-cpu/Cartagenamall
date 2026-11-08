import { Flag, Minus, Pause, Play, Plus, RotateCcw, Square, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStadiumEvent } from '../state/stadium'
import { useStadiumBoard, useStadiumConfig, useStadiumEvents, useStadiumMatch } from '../state/stadiumEvents'
import { resolveBoard } from '../stadium/board'
import { emptyMatch, finishMatch, matchClock, matchLabel, nudgeMinute, pauseHalf, resumeMatch, scoreGoal, startMatch, undoGoal, type Side } from '../stadium/match'
import { btn } from '../ui/bits'

/**
 * Marcador en vivo del partido: se maneja desde aquí y todos lo ven en la pantalla del estadio, con el reloj
 * corriendo. Cada gol del equipo local dispara los fuegos artificiales.
 */
export function MatchControl() {
  const match = useStadiumMatch((s) => s.match)
  const setMatch = useStadiumMatch((s) => s.setMatch)
  const kind = useStadiumEvent((s) => s.kind)
  const activeId = useStadiumConfig((s) => s.activeEventId)
  const events = useStadiumEvents((s) => s.events)
  const general = useStadiumBoard((s) => s.board)
  const board = resolveBoard(events.find((e) => e.id === activeId) ?? null, general)
  // el reloj se ve correr aquí también
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])
  const live = match.status === 'live'
  const names: Record<Side, string> = { home: board.home.name || 'Local', away: board.away.name || 'Visitante' }

  const Team = ({ side }: { side: Side }) => (
    <div className="rounded-2xl bg-sand p-3 text-center">
      <p className="truncate text-xs font-bold text-ink-soft uppercase">{names[side]}</p>
      <p className="text-5xl leading-none font-extrabold tracking-tight">{match[side]}</p>
      <div className="mt-2 flex justify-center gap-2">
        <button className={btn.primary} onClick={() => setMatch(scoreGoal(match, side, Date.now()))} aria-label={`Gol de ${names[side]}`}>
          <Plus className="size-4" /> Gol
        </button>
        <button className={`${btn.icon} !size-10`} onClick={() => setMatch(undoGoal(match, side))} disabled={match[side] === 0} aria-label={`Quitar un gol a ${names[side]}`}>
          <Minus className="size-4" />
        </button>
      </div>
      {side === 'home' && <p className="mt-1.5 text-[11px] text-ink-soft">Con fuegos artificiales</p>}
    </div>
  )

  return (
    <div className="rounded-3xl border border-line bg-card p-4">
      <p className="flex items-center gap-2 font-bold">
        <Timer className="size-4" /> Marcador en vivo
      </p>
      <p className="text-xs text-ink-soft">
        {kind === 'match' ? 'Se ve en la pantalla de la fachada del estadio, con el reloj corriendo.' : 'Cambia el evento de hoy a «Partido de fútbol» para que se vea en la pantalla.'}
      </p>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white">
        <span className="text-sm font-bold">{matchLabel(match, now)}</span>
        <span className="font-mono text-2xl font-extrabold tabular-nums">{matchClock(match, now)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Team side="home" />
        <Team side="away" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {match.status === 'pre' && (
          <button className={btn.primary} onClick={() => setMatch(startMatch(match, Date.now()))}>
            <Play className="size-4" /> Empezar partido
          </button>
        )}
        {live && (
          <>
            <button className={btn.secondary} onClick={() => setMatch(pauseHalf(match, Date.now()))}>
              <Pause className="size-4" /> Medio tiempo
            </button>
            <button className={btn.secondary} onClick={() => setMatch(finishMatch(match, Date.now()))}>
              <Square className="size-4" /> Final
            </button>
          </>
        )}
        {match.status === 'half' && (
          <button className={btn.primary} onClick={() => setMatch(resumeMatch(match, Date.now()))}>
            <Flag className="size-4" /> Segundo tiempo
          </button>
        )}
        {match.status !== 'pre' && match.status !== 'final' && (
          <>
            <button className={btn.ghost} onClick={() => setMatch(nudgeMinute(match, Date.now(), -1))}>
              −1 min
            </button>
            <button className={btn.ghost} onClick={() => setMatch(nudgeMinute(match, Date.now(), +1))}>
              +1 min
            </button>
          </>
        )}
        <button
          className={`${btn.ghost} text-coral`}
          onClick={() => {
            if (match.status !== 'pre' && !window.confirm('¿Reiniciar el marcador a 0-0 y dejar el partido por empezar?')) return
            setMatch(emptyMatch())
          }}
        >
          <RotateCcw className="size-4" /> Reiniciar
        </button>
      </div>
    </div>
  )
}
