import { Crown, Gamepad2, Gift, Pause, Play as PlayIcon, Rocket, Trophy, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createFrameGate } from '../world/frameGate'
import { copyText } from '../lib/clipboard'
import { usePrefs } from '../state/ui'
import { defaultNick, fetchBoard, invalidateBoard, submitRun, type Board, type BoardKind } from './board'
import { createGame, draw, H, update, W, type Game, type Input } from './engine'
import { ARCADE_REWARDS, DAILY_POINTS_CAP, MAX_POINTS_PER_RUN, SCORE_PER_POINT, useArcade, useArcadeUi, type ArcadeRedemption } from './store'

// Pantalla de arcade de la isla de Entretenimiento: el juego «Nave Caribe» (canvas 2D) y los premios que se canjean con los puntos.
// El bucle de dibujo solo corre mientras se juega: en el menú, en pausa y con la pestaña oculta no gasta nada.

const DPR_BY_QUALITY = { low: 1, medium: 1.5, high: 2 } as const
const STEP = 1 / 60

type Phase = 'menu' | 'play' | 'pause' | 'over'

export function ArcadePanel() {
  const open = useArcadeUi((s) => s.open)
  const close = useCallback(() => useArcadeUi.getState().setOpen(false), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, close])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#04061a]/95 p-3" role="dialog" aria-modal="true" aria-label="Arcade: Nave Caribe">
      <Cabinet onClose={close} />
    </div>
  )
}

function Cabinet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'play' | 'rank' | 'prizes'>('play')
  const points = useArcade((s) => s.points)
  return (
    <div className="flex max-h-full w-full max-w-[440px] flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e0558a] text-white">
          <Gamepad2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] leading-tight font-extrabold tracking-tight text-white">ARCADE · Nave Caribe</h2>
          <p className="text-[12px] font-semibold text-[#9fb3ff]">Isla de Entretenimiento</p>
        </div>
        <span className="rounded-full bg-[#ffc83d] px-3 py-1.5 text-[13px] font-extrabold text-[#2a1a00]" aria-label={`${points} puntos`}>
          {points} pts
        </span>
        <button onClick={onClose} aria-label="Cerrar el arcade" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white active:bg-white/20">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex gap-1.5" role="tablist">
        {(
          [
            ['play', 'Jugar', Rocket],
            ['rank', 'Ranking', Crown],
            ['prizes', 'Premios', Gift],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition ${tab === id ? 'bg-[#4de1ff] text-[#04202b]' : 'bg-white/10 text-white'}`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {tab === "play" ? <Play onRanking={() => setTab("rank")} /> : tab === "rank" ? <Ranking /> : <Prizes />}
    </div>
  )
}

function Play({ onRanking }: { onRanking: () => void }) {
  const quality = usePrefs((s) => s.quality)
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<Game | null>(null)
  const input = useRef<Input>({ targetX: null, dir: 0 })
  const raf = useRef(0)
  const [phase, setPhaseState] = useState<Phase>('menu')
  const phaseRef = useRef<Phase>('menu')
  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }
  const [result, setResult] = useState<{ score: number; awarded: number; capped: boolean; record: boolean; rankWeek?: number } | null>(null)
  const best = useArcade((s) => s.best)
  const earnedToday = useArcade((s) => s.earnedToday)

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])

  const loop = useCallback(() => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d', { alpha: false })
    if (!cv || !ctx) return
    const q = usePrefs.getState().quality
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_BY_QUALITY[q])
    const rect = cv.getBoundingClientRect()
    const pw = Math.max(1, Math.round(rect.width * dpr))
    if (cv.width !== pw) {
      cv.width = pw
      cv.height = Math.round((pw * H) / W)
    }
    const scale = cv.width / W
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const gate = createFrameGate(q === 'low' ? 30 : 60, 0.1)
    let last = 0
    let acc = 0
    const tick = (now: number) => {
      raf.current = requestAnimationFrame(tick)
      const g = game.current
      if (!g || phaseRef.current !== 'play') return
      if (document.hidden) {
        last = 0
        return
      }
      if (last) acc += Math.min((now - last) / 1000, 0.1)
      last = now
      let n = 0
      while (acc >= STEP && n < 4) {
        update(g, STEP, input.current)
        acc -= STEP
        n++
      }
      if (n === 4) acc = 0
      if (gate.shouldRender(now)) {
        gate.step(now)
        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        draw(g, ctx, reduce)
      }
      if (g.over) {
        stop()
        const st = useArcade.getState()
        const r = st.finishRun(g.score)
        setResult({ score: g.score, ...r })
        // al ranking en línea (si hay conexión): el puesto llega unos instantes después
        const nick = st.nickname || defaultNick(st.playerId)
        void submitRun(st.playerId, nick, g.score).then((res) => {
          if (!res) return
          invalidateBoard()
          setResult((cur) => (cur && cur.score === g.score ? { ...cur, rankWeek: res.rankWeek } : cur))
        })
        setPhase('over')
      }
    }
    raf.current = requestAnimationFrame(tick)
  }, [stop])

  const start = () => {
    game.current = createGame()
    input.current = { targetX: null, dir: 0 }
    setResult(null)
    setPhase('play')
    stop()
    loop()
  }
  const pause = useCallback(() => {
    if (phaseRef.current !== 'play') return
    setPhase('pause')
    stop()
  }, [stop])
  const resume = () => {
    setPhase('play')
    loop()
  }

  // pausa sola si la pestaña se oculta; el bucle se corta al cerrar el panel
  useEffect(() => {
    const onHide = () => document.hidden && pause()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      stop()
    }
  }, [pause, stop])

  // teclado: flechas o A/D
  useEffect(() => {
    const keys = { l: false, r: false }
    const set = () => (input.current.dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0))
    const on = (down: boolean) => (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.l = down
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.r = down
      else return
      if (phaseRef.current === 'play') e.preventDefault()
      set()
    }
    const kd = on(true)
    const ku = on(false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    input.current.targetX = ((e.clientX - r.left) / r.width) * W
  }

  // primer cuadro del menú: fondo estático (no corre ningún bucle)
  useEffect(() => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d', { alpha: false })
    if (!cv || !ctx || phase !== 'menu') return
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_BY_QUALITY[quality])
    const pw = Math.max(1, Math.round(cv.getBoundingClientRect().width * dpr))
    cv.width = pw
    cv.height = Math.round((pw * H) / W)
    ctx.setTransform(pw / W, 0, 0, pw / W, 0, 0)
    draw(createGame(() => 0.5), ctx, true)
  }, [phase, quality])

  const daily = Math.max(0, DAILY_POINTS_CAP - earnedToday)

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <div className="relative mx-auto w-[min(100%,calc((100dvh-250px)*9/16))] overflow-hidden rounded-2xl border-2 border-[#4de1ff]/60 bg-[#070b24] shadow-[0_0_28px_-6px_#4de1ff]" style={{ aspectRatio: `${W} / ${H}` }}>
        <canvas
          ref={canvas}
          className="block h-full w-full"
          style={{ touchAction: 'none' }}
          aria-label="Pantalla del juego Nave Caribe: arrastra la nave a izquierda y derecha para esquivar y destruir puntitos"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            point(e)
          }}
          onPointerMove={point}
        />
        {phase === 'play' && (
          <button onClick={pause} aria-label="Pausar" className="absolute right-1 bottom-1 grid size-11 place-items-center rounded-full bg-white/10 text-white active:bg-white/25">
            <Pause className="size-5" />
          </button>
        )}
        {phase !== 'play' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b24]/80 px-6 text-center text-white">
            {phase === 'menu' && (
              <>
                <Rocket className="size-10 text-[#4de1ff]" />
                <h3 className="text-2xl font-extrabold tracking-tight">Nave Caribe</h3>
                <p className="text-[13px] leading-snug text-[#c8d3ff]">Arrastra la nave: dispara sola. Destruye los puntitos y esquívalos durante 90 segundos para sumar puntos y canjearlos por premios.</p>
                <p className="text-[12px] font-semibold text-[#9fb3ff]">
                  Récord: {best} · Hoy puedes ganar {daily} pts más
                </p>
              </>
            )}
            {phase === 'pause' && <h3 className="text-2xl font-extrabold">En pausa</h3>}
            {phase === 'over' && result && (
              <>
                <Trophy className="size-9 text-[#ffc83d]" />
                <h3 className="text-xl font-extrabold">{result.record ? '¡Nuevo récord!' : 'Fin de la partida'}</h3>
                <p className="text-4xl font-extrabold tabular-nums">{result.score}</p>
                <p className="text-[14px] font-bold text-[#ffc83d]">+{result.awarded} puntos de premio</p>
                {result.rankWeek ? (
                  <button onClick={onRanking} className="min-h-11 text-[13px] font-bold text-[#4de1ff] underline">
                    Puesto #{result.rankWeek} esta semana · ver ranking
                  </button>
                ) : null}
                {result.capped && <p className="text-[12px] text-[#c8d3ff]">Llegaste al tope de {result.awarded === 0 ? 'hoy' : 'puntos'}: vuelve mañana por más.</p>}
              </>
            )}
            <button
              autoFocus
              onClick={phase === 'pause' ? resume : start}
              className="mt-1 flex min-h-12 items-center gap-2 rounded-full bg-[#4de1ff] px-7 text-[16px] font-extrabold text-[#04202b] active:scale-95"
            >
              <PlayIcon className="size-5" />
              {phase === 'pause' ? 'Seguir' : phase === 'over' ? 'Jugar otra vez' : 'Jugar'}
            </button>
            {phase === 'pause' && (
              <button onClick={start} className="min-h-11 text-[13px] font-bold text-[#9fb3ff] underline">
                Empezar de nuevo
              </button>
            )}
          </div>
        )}
      </div>
      <p className="text-center text-[11px] text-[#9fb3ff]">
        1 punto por cada {SCORE_PER_POINT} del puntaje · máx. {MAX_POINTS_PER_RUN} por partida · {DAILY_POINTS_CAP} por día
      </p>
    </div>
  )
}

function Prizes() {
  const points = useArcade((s) => s.points)
  const redemptions = useArcade((s) => s.redemptions)
  const [shown, setShown] = useState<ArcadeRedemption | null>(null)
  const [copied, setCopied] = useState(false)
  const redeem = (id: string) => {
    const r = useArcade.getState().redeem(id)
    if (r) setShown(r)
  }
  const code = shown ?? null
  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pb-2">
      {code && (
        <div className="rounded-2xl border-2 border-[#ffc83d] bg-[#ffc83d]/10 p-4 text-center text-white" role="status">
          <p className="text-[13px] font-semibold text-[#ffe08a]">¡Canjeado! Muestra este código en caja:</p>
          <p className="my-1 text-3xl font-extrabold tracking-widest text-[#ffc83d]">{code.code}</p>
          <p className="text-[13px] font-bold">{code.name}</p>
          <button
            onClick={async () => {
              setCopied(await copyText(code.code))
              setTimeout(() => setCopied(false), 1500)
            }}
            className="mt-2 min-h-11 rounded-full bg-white/15 px-5 text-[13px] font-bold"
          >
            {copied ? 'Copiado' : 'Copiar código'}
          </button>
        </div>
      )}
      {ARCADE_REWARDS.map((r) => {
        const ok = points >= r.cost
        return (
          <div key={r.id} className="rounded-2xl bg-white/[0.07] p-3.5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold">{r.name}</p>
                <p className="text-[12.5px] leading-snug text-[#c8d3ff]">{r.detail}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#ffc83d] px-2.5 py-1 text-[12px] font-extrabold text-[#2a1a00]">{r.cost} pts</span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div className="h-full rounded-full bg-[#4de1ff]" style={{ width: `${Math.min(100, (points / r.cost) * 100)}%` }} />
            </div>
            <button
              disabled={!ok}
              onClick={() => redeem(r.id)}
              className={`mt-2.5 min-h-11 w-full rounded-xl text-[14px] font-extrabold ${ok ? 'bg-[#4de1ff] text-[#04202b] active:scale-[0.98]' : 'bg-white/10 text-white/50'}`}
            >
              {ok ? 'Canjear' : `Te faltan ${r.cost - points} pts`}
            </button>
          </div>
        )
      })}
      {redemptions.length > 0 && (
        <div className="mt-1 text-white">
          <p className="mb-1 text-[12px] font-bold tracking-wide text-[#9fb3ff] uppercase">Mis códigos</p>
          <ul className="flex flex-col gap-1.5">
            {redemptions.slice(0, 6).map((r) => (
              <li key={r.code} className="flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2 text-[13px]">
                <span className="font-extrabold tracking-wider text-[#ffc83d]">{r.code}</span>
                <span className="truncate pl-3 text-[#c8d3ff]">{r.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const MEDAL = ['#ffc83d', '#c9d2e6', '#d98a4e']

/** Tabla de líderes: semana en curso o total; si el servidor no responde, mis mejores partidas del dispositivo. */
function Ranking() {
  const playerId = useArcade((s) => s.playerId)
  const nickname = useArcade((s) => s.nickname)
  const localBest = useArcade((s) => s.localBest)
  const [kind, setKind] = useState<BoardKind>('week')
  const [board, setBoard] = useState<Board | null | undefined>(undefined)
  const [draft, setDraft] = useState(nickname || defaultNick(playerId))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let live = true
    setBoard(undefined)
    void fetchBoard(kind, playerId).then((b) => live && setBoard(b))
    return () => {
      live = false
    }
  }, [kind, playerId])

  const inList = board?.rows.some((r) => r.me)
  return (
    <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto pb-2 text-white">
      <div className="flex gap-1.5" role="tablist" aria-label="Tipo de ranking">
        {(
          [
            ['week', 'Esta semana'],
            ['total', 'Total'],
            ['best', 'Récord'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={kind === id}
            onClick={() => setKind(id)}
            className={`min-h-11 flex-1 rounded-xl text-[13px] font-bold ${kind === id ? 'bg-white text-[#04061a]' : 'bg-white/10'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-2 rounded-2xl bg-white/[0.07] p-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          setDraft(useArcade.getState().setNickname(draft))
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        }}
      >
        <label className="min-w-0 flex-1 text-[11px] font-bold tracking-wide text-[#9fb3ff] uppercase">
          Tu apodo en el ranking
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={16}
            autoComplete="off"
            className="mt-1 block min-h-11 w-full rounded-xl bg-[#0c1236] px-3 text-[15px] font-bold text-white normal-case outline-none focus:ring-2 focus:ring-[#4de1ff]"
          />
        </label>
        <button className="mt-5 min-h-11 shrink-0 rounded-xl bg-[#4de1ff] px-4 text-[13px] font-extrabold text-[#04202b]">{saved ? 'Listo' : 'Guardar'}</button>
      </form>

      {board === undefined && <p className="py-6 text-center text-[13px] text-[#9fb3ff]">Cargando ranking…</p>}

      {board === null && (
        <div className="rounded-2xl bg-white/[0.07] p-4">
          <p className="text-[13px] font-bold">El ranking en línea no está disponible ahora.</p>
          <p className="mb-2 text-[12px] text-[#c8d3ff]">Tus mejores partidas en este dispositivo:</p>
          {localBest.length === 0 ? (
            <p className="text-[12px] text-[#9fb3ff]">Aún no has jugado. ¡Juega una partida!</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {localBest.map((b, i) => (
                <li key={b.at} className="flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2 text-[14px]">
                  <span className="font-extrabold text-[#ffc83d]">#{i + 1}</span>
                  <span className="font-extrabold tabular-nums">{b.score}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {board && board.rows.length === 0 && <p className="py-6 text-center text-[13px] text-[#9fb3ff]">Todavía nadie ha sumado puntos {kind === 'week' ? 'esta semana' : ''}. ¡Sé el primero!</p>}

      {board && board.rows.length > 0 && (
        <ol className="flex flex-col gap-1.5" aria-label="Tabla de líderes">
          {board.rows.map((r) => (
            <Row key={`${r.rank}-${r.nickname}`} rank={r.rank} name={r.nickname} points={r.points} me={r.me} unit={kind === 'best' ? '' : ' pts'} />
          ))}
          {board.me && !inList && board.me.points > 0 && (
            <>
              <li className="text-center text-[11px] text-[#9fb3ff]" aria-hidden>
                · · ·
              </li>
              <Row rank={board.me.rank} name={board.me.nickname} points={board.me.points} me unit={kind === 'best' ? '' : ' pts'} />
            </>
          )}
        </ol>
      )}
      <p className="text-center text-[11px] text-[#9fb3ff]">{kind === 'week' ? 'Puntos de la semana; se reinicia cada lunes.' : kind === 'total' ? 'Puntos acumulados desde el primer día.' : 'Mejor puntaje en una sola partida.'} Lo calcula el servidor.</p>
    </div>
  )
}

function Row({ rank, name, points, me, unit }: { rank: number; name: string; points: number; me: boolean; unit: string }) {
  return (
    <li className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${me ? 'bg-[#4de1ff]/20 ring-2 ring-[#4de1ff]' : 'bg-white/[0.06]'}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold" style={rank <= 3 ? { background: MEDAL[rank - 1], color: '#1a1200' } : { background: '#ffffff1a' }}>
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
        {name}
        {me && <span className="ml-1.5 text-[11px] font-extrabold text-[#4de1ff]">TÚ</span>}
      </span>
      <span className="text-[14px] font-extrabold text-[#ffc83d] tabular-nums">{points}{unit}</span>
    </li>
  )
}
