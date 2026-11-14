import { Crown, Gamepad2, Gift, Pause, Play as PlayIcon, Rocket, Trophy, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createFrameGate } from '../world/frameGate'
import { usePrefs } from '../state/ui'
import { useOnline } from '../lib/online'
import { setArcadeSound, sfx, startMusic, stopMusic, suspendArcadeAudio, unlockArcadeAudio } from './audio'
import { defaultNick, finishRun as finishRunRemote, startRun, type RunTicket } from './board'
import { createGame, createRecorder, DIFFICULTIES, H, makeRand, MAX_WEAPON, STEP, update, W, type Difficulty, type Game, type Input } from './engine'
import { draw } from './render'
import { DAILY_POINTS_CAP, useArcade, useArcadeUi } from './store'
import { Prizes, Ranking } from './ArcadeTabs'

// Pantalla de arcade de la isla de Entretenimiento: el juego «Nave Caribe» (canvas 2D), su música (que se puede apagar), el ranking de la
// semana y los premios. Mientras se juega, la partida ocupa TODA la pantalla. El bucle de dibujo solo corre mientras se juega: en el menú,
// en pausa y con la pestaña oculta no gasta nada.

const DPR_BY_QUALITY = { low: 1.5, medium: 2, high: 2 } as const

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

/** Interruptor de música y efectos (se recuerda). */
function SoundButton({ className = '' }: { className?: string }) {
  const sound = useArcade((s) => s.sound)
  const toggle = () => {
    const next = !useArcade.getState().sound
    useArcade.getState().setSound(next)
    setArcadeSound(next)
    if (next) {
      unlockArcadeAudio()
      if (useArcadeUi.getState().playing) startMusic()
    }
  }
  return (
    <button
      onClick={toggle}
      aria-pressed={sound}
      aria-label={sound ? 'Silenciar música y efectos' : 'Activar música y efectos'}
      className={`grid size-11 shrink-0 place-items-center rounded-full text-white transition active:scale-95 ${className}`}
    >
      {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5 opacity-70" />}
    </button>
  )
}

function Cabinet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'play' | 'rank' | 'prizes'>('play')
  const points = useArcade((s) => s.points)
  const playing = useArcadeUi((s) => s.playing)
  return (
    <div className="flex max-h-full w-full max-w-[440px] flex-col gap-2.5">
      {/* mientras se juega, la partida cubre la pantalla: el encabezado y las pestañas quedan ocultos para lectores de pantalla */}
      <div className="flex flex-col gap-2.5" aria-hidden={playing}>
        <div className="flex items-center gap-2">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e0558a] text-white">
            <Gamepad2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] leading-tight font-extrabold tracking-tight text-white">ARCADE</h2>
            <p className="truncate text-[12px] font-semibold text-[#9fb3ff]">Nave Caribe · Entretenimiento</p>
          </div>
          <span className="rounded-full bg-[#ffc83d] px-3 py-1.5 text-[13px] font-extrabold text-[#2a1a00]" aria-label={`${points} puntos`}>
            {points} pts
          </span>
          <SoundButton className="bg-white/10 active:bg-white/20" />
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
      </div>
      {tab === 'play' ? <Play onRanking={() => setTab('rank')} onExit={onClose} /> : tab === 'rank' ? <Ranking /> : <Prizes />}
    </div>
  )
}

interface Result {
  score: number
  awarded: number
  capped: boolean
  record: boolean
  picked: number
  rankWeek?: number
  ranked: boolean
  pending: boolean
  difficulty: Difficulty
}

/** Elige la dificultad: a más difícil, todo baja más rápido y cada punto vale más. */
const DIFF_STYLE = [
  { color: '#5dff9b', note: 'Tranquilo: sin cañoneros, para entrar en calor.' },
  { color: '#4de1ff', note: 'El reto de siempre: cañoneros y oleadas.' },
  { color: '#ffb347', note: 'Todo cae más rápido y los cañoneros llegan antes.' },
  { color: '#ff5c8a', note: 'Lluvia total: velocidad máxima y puntos por montones.' },
] as const
const multLabel = (m: number) => `×${(m / 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}`

function DifficultyPicker() {
  const difficulty = useArcade((s) => s.difficulty)
  const setDifficulty = useArcade((s) => s.setDifficulty)
  return (
    <div className="mx-auto mt-4 w-full max-w-[330px]">
      <p className="mb-2 text-[12px] font-bold tracking-wide text-[#9fb3ff] uppercase">Dificultad</p>
      <div role="radiogroup" aria-label="Dificultad" className="grid grid-cols-4 gap-1.5">
        {DIFFICULTIES.map((d) => {
          const on = difficulty === d.id
          const c = DIFF_STYLE[d.id].color
          return (
            <button
              key={d.id}
              role="radio"
              aria-checked={on}
              onClick={() => setDifficulty(d.id)}
              style={on ? { borderColor: c, boxShadow: `0 0 16px -4px ${c}`, color: c } : undefined}
              className={`flex min-h-[58px] flex-col items-center justify-center rounded-2xl border-2 px-1 py-1.5 transition active:scale-95 ${on ? 'bg-white/10' : 'border-white/10 bg-white/[0.05] text-white/80'}`}
            >
              <span className="text-[13px] leading-tight font-extrabold">{d.name}</span>
              <span className="mt-0.5 text-[12px] font-bold tabular-nums">{multLabel(d.mult)}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 min-h-8 text-[12.5px] leading-snug text-[#c8d3ff]">
        {DIFF_STYLE[difficulty].note} Cada punto vale {multLabel(DIFFICULTIES[difficulty].mult)}.
      </p>
    </div>
  )
}

function Play({ onRanking, onExit }: { onRanking: () => void; onExit: () => void }) {
  const quality = usePrefs((s) => s.quality)
  const sound = useArcade((s) => s.sound)
  const best = useArcade((s) => s.best)
  const earnedToday = useArcade((s) => s.earnedToday)
  const playerId = useArcade((s) => s.playerId)
  const online = useOnline()
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const game = useRef<Game | null>(null)
  const input = useRef<Input>({ targetX: null, dir: 0 })
  const scale = useRef(1)
  const raf = useRef(0)
  const [phase, setPhaseState] = useState<Phase>('menu')
  const phaseRef = useRef<Phase>('menu')
  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
    useArcadeUi.getState().setPlaying(p === 'play' || p === 'pause')
  }
  // Partida verificada: el servidor entrega la semilla y repite la partida con los movimientos anotados.
  const ticket = useRef<RunTicket | null>(null)
  const run = useRef<{ ticket: RunTicket | null; rec: ReturnType<typeof createRecorder>; step: number } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const prefetch = useCallback(() => {
    ticket.current = null
    void startRun(playerId).then((t) => {
      ticket.current = t
    })
  }, [playerId])
  // al abrir y cada vez que vuelve la conexión se pide una partida al servidor (sin conexión se juega igual, solo sin ranking)
  useEffect(() => {
    prefetch()
  }, [prefetch, online])
  useEffect(() => {
    setArcadeSound(sound)
  }, [sound])

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])

  /** Ajusta el lienzo al espacio: la partida llena la pantalla manteniendo la proporción del campo. */
  const fit = useCallback(() => {
    const cv = canvas.current
    const holder = box.current?.parentElement
    if (!cv || !box.current || !holder) return
    const cs = getComputedStyle(holder)
    const availW = holder.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const availH = holder.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    const h = Math.min(availH, (availW * H) / W)
    const w = (h * W) / H
    box.current.style.width = `${Math.floor(w)}px`
    box.current.style.height = `${Math.floor(h)}px`
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_BY_QUALITY[usePrefs.getState().quality])
    cv.width = Math.max(1, Math.round(w * dpr))
    cv.height = Math.round((cv.width * H) / W)
    scale.current = cv.width / W
    const ctx = cv.getContext('2d', { alpha: false })
    const g = game.current
    if (ctx && g && phaseRef.current !== 'play') {
      ctx.setTransform(scale.current, 0, 0, scale.current, 0, 0)
      draw(g, ctx, true)
    }
  }, [])

  // el lienzo solo existe jugando o en pausa: ajustar al aparecer y cuando cambie el tamaño de la pantalla
  const immersive = phase === 'play' || phase === 'pause'
  useEffect(() => {
    if (!immersive) return
    fit()
    const holder = box.current?.parentElement
    if (!holder) return
    const ro = new ResizeObserver(fit)
    ro.observe(holder)
    return () => ro.disconnect()
  }, [immersive, fit, quality])

  // bucle de juego: corre solo en la fase «play»
  useEffect(() => {
    if (phase !== 'play') return
    const cv = canvas.current
    const ctx = cv?.getContext('2d', { alpha: false })
    if (!cv || !ctx) return
    const q = usePrefs.getState().quality
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const gate = createFrameGate(q === 'low' ? 30 : 60, 0.1)
    let last = 0
    let acc = 0
    let lastPop = 0
    const g0 = game.current
    let prev = g0 ? { kills: g0.kills, lives: g0.lives, picked: g0.picked } : { kills: 0, lives: 3, picked: 0 }
    const tick = (now: number) => {
      raf.current = requestAnimationFrame(tick)
      const g = game.current
      if (!g) return
      if (document.hidden) {
        last = 0
        return
      }
      if (last) acc += Math.min((now - last) / 1000, 0.1)
      last = now
      let n = 0
      const cur = run.current
      while (acc >= STEP && n < 4) {
        if (cur) cur.rec.push(cur.step++, input.current)
        update(g, STEP, input.current)
        acc -= STEP
        n++
      }
      if (n === 4) acc = 0
      // efectos de sonido según lo que pasó (un solo «pop» cada 90 ms para no saturar)
      if (g.picked > prev.picked) sfx('power')
      else if (g.lives < prev.lives) sfx('hurt')
      else if (g.kills > prev.kills && now - lastPop > 90) {
        lastPop = now
        sfx('pop')
      }
      prev = { kills: g.kills, lives: g.lives, picked: g.picked }
      if (gate.shouldRender(now)) {
        gate.step(now)
        ctx.setTransform(scale.current, 0, 0, scale.current, 0, 0)
        draw(g, ctx, reduce)
      }
      if (g.over) {
        stop()
        stopMusic()
        const st = useArcade.getState()
        const rn = run.current
        const ranked = !!rn?.ticket
        const r = st.finishRun(g.score, ranked, g.diff.id)
        sfx(r.record ? 'record' : 'over')
        setResult({ score: g.score, ...r, picked: g.picked, ranked, pending: ranked, difficulty: g.diff.id })
        // al servidor: repite la partida y guarda SU puntaje; el puesto llega unos instantes después
        if (rn?.ticket) {
          const nick = st.nickname || defaultNick(st.playerId)
          void finishRunRemote(st.playerId, rn.ticket, nick, rn.rec.log, g.diff.id).then((res) => {
            setResult((c) => (c && c.score === g.score ? { ...c, pending: false, ranked: !!res, rankWeek: res?.rankWeek ?? undefined } : c))
            prefetch()
          })
        } else prefetch()
        setPhase('over')
      }
    }
    raf.current = requestAnimationFrame(tick)
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stop, prefetch])

  const start = () => {
    unlockArcadeAudio()
    // con partida del servidor (cuenta para el ranking) o, sin conexión, con semilla local (solo para jugar)
    const t = ticket.current
    ticket.current = null
    const diff = useArcade.getState().difficulty
    game.current = createGame(makeRand(t ? t.seed : Math.floor(Math.random() * 2147483646) + 1), diff)
    run.current = { ticket: t, rec: createRecorder(), step: 0 }
    input.current = { targetX: null, dir: 0 }
    setResult(null)
    setPhase('play')
    if (useArcade.getState().sound) startMusic()
  }
  const pause = useCallback(() => {
    if (phaseRef.current !== 'play') return
    setPhase('pause')
    suspendArcadeAudio()
  }, [])
  const resume = () => {
    unlockArcadeAudio()
    setPhase('play')
    if (useArcade.getState().sound) startMusic()
  }
  const quit = () => {
    stop()
    stopMusic()
    suspendArcadeAudio()
    game.current = null
    setPhase('menu')
  }

  // pausa sola si la pestaña se oculta; al cerrar el panel se corta todo
  useEffect(() => {
    const onHide = () => document.hidden && pause()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      stop()
      stopMusic()
      suspendArcadeAudio()
      useArcadeUi.getState().setPlaying(false)
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
    // entero: el servidor repite la partida con exactamente estos valores
    input.current.targetX = Math.max(0, Math.min(W, Math.round(((e.clientX - r.left) / r.width) * W)))
  }

  const daily = Math.max(0, DAILY_POINTS_CAP - earnedToday)

  // ── Partida (pantalla completa) ──────────────────────────────────────────────────────────────────────────────────────────────
  if (immersive)
    return (
      <div className="fixed inset-0 z-[71] flex items-center justify-center bg-[#04061a] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div ref={box} className="relative overflow-hidden bg-[#070b24]">
          <canvas
            ref={canvas}
            className="block h-full w-full"
            style={{ touchAction: 'none' }}
            aria-label="Pantalla del juego Nave Caribe: arrastra la nave a izquierda y derecha para esquivar y destruir puntitos; los círculos sueltan armas"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              point(e)
            }}
            onPointerMove={point}
          />
          {phase === 'play' && (
            <div className="absolute top-2 right-2 flex gap-1.5">
              <SoundButton className="bg-black/35 backdrop-blur-sm active:bg-black/55" />
              <button onClick={pause} aria-label="Pausar" className="grid size-11 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm active:bg-black/55">
                <Pause className="size-5" />
              </button>
            </div>
          )}
          {phase === 'pause' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b24]/85 px-6 text-center text-white">
              <h3 className="text-3xl font-extrabold">En pausa</h3>
              <button
                autoFocus
                onClick={resume}
                className="mt-1 flex min-h-12 items-center gap-2 rounded-full bg-[#4de1ff] px-8 text-[16px] font-extrabold text-[#04202b] active:scale-95"
              >
                <PlayIcon className="size-5" /> Seguir
              </button>
              <div className="mt-1 flex items-center gap-2">
                <SoundButton className="bg-white/10 active:bg-white/20" />
                <button onClick={start} className="min-h-11 px-3 text-[13px] font-bold text-[#9fb3ff] underline">
                  Empezar de nuevo
                </button>
                <button onClick={quit} className="min-h-11 px-3 text-[13px] font-bold text-[#9fb3ff] underline">
                  Salir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )

  // ── Menú y fin de partida ────────────────────────────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-0 flex-col overflow-y-auto rounded-3xl border-2 border-[#4de1ff]/50 bg-gradient-to-b from-[#0b1448] to-[#070b24] px-5 py-6 text-center text-white shadow-[0_0_28px_-6px_#4de1ff]">
      {phase === 'over' && result ? (
        <>
          <Trophy className="mx-auto size-10 text-[#ffc83d]" />
          <h3 className="mt-1 text-2xl font-extrabold">{result.record ? '¡Nuevo récord!' : 'Fin de la partida'}</h3>
          <p className="mt-1 text-6xl leading-none font-extrabold tabular-nums">{result.score}</p>
          <p className="mt-1 text-[13px] font-extrabold" style={{ color: DIFF_STYLE[result.difficulty].color }}>
            {DIFFICULTIES[result.difficulty].name} · {multLabel(DIFFICULTIES[result.difficulty].mult)}
          </p>
          <p className="mt-2 text-[15px] font-bold text-[#ffc83d]">+{result.awarded} puntos de premio</p>
          {result.picked > 0 && (
            <p className="text-[12.5px] text-[#9fb3ff]">
              Recogiste {result.picked} {result.picked === 1 ? 'premio' : 'premios'} del camino
            </p>
          )}
          {result.capped && <p className="mt-1 text-[12px] text-[#c8d3ff]">Llegaste al tope de {result.awarded === 0 ? 'hoy' : 'puntos'}: vuelve mañana por más.</p>}
          {result.pending && <p className="mt-2 text-[12px] text-[#9fb3ff]">Verificando tu partida…</p>}
          {!result.pending && result.rankWeek ? (
            <button onClick={onRanking} className="mx-auto mt-1 min-h-11 text-[13px] font-bold text-[#4de1ff] underline">
              Puesto #{result.rankWeek} esta semana · ver ranking
            </button>
          ) : null}
          {!result.pending && !result.ranked && (
            <p className="mx-auto mt-1 max-w-[280px] text-[11.5px] leading-snug text-[#9fb3ff]">
              Esta partida no entra al ranking (sin conexión). Tus puntos de premio sí se guardaron.
            </p>
          )}
        </>
      ) : (
        <>
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-[#4de1ff] to-[#2f86ff] text-[#04202b] shadow-[0_10px_30px_-10px_#4de1ff]">
            <Rocket className="size-9" />
          </span>
          <h3 className="mt-3 text-3xl font-extrabold tracking-tight">Nave Caribe</h3>
          <p className="mx-auto mt-1 max-w-[300px] text-[13.5px] leading-snug text-[#c8d3ff]">
            Arrastra la nave: dispara sola. Destruye los círculos y esquívalos: la partida no se acaba hasta que te quedes sin vidas.
          </p>
          <ul className="mx-auto mt-4 flex w-full max-w-[320px] flex-col gap-2 text-left text-[13px]">
            <li className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#c9ffdc] to-[#0a7d3e] text-[18px] font-extrabold text-white">+</span>
              <span>
                <b className="text-[#5dff9b]">Arma:</b> los premios verdes mejoran tu nave: más cañones y más disparos (hasta {MAX_WEAPON} niveles).
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffe6b8] to-[#b34d00] text-[16px] text-white">⚡</span>
              <span>
                <b className="text-[#ffb347]">Rápido:</b> los naranjas aceleran tu disparo por unos segundos.
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffd0b0] to-[#7d1f0a] text-[16px] text-white">!</span>
              <span>
                <b className="text-[#ff9a6b]">Cañoneros:</b> los naranjas te disparan. Esquiva sus tiros y destrúyelos: valen mucho. Cada oleada llega más fuerte.
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#c5adff] to-[#2a1170] text-[17px] text-white">★</span>
              <span>
                <b className="text-[#c5adff]">Jefe:</b> al terminar la oleada 5 llega un jefe enorme. Si lo derrotas, ganas una vida y sigues con la oleada 6… y cada jefe es más duro.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-[12px] leading-snug text-[#9fb3ff]">Un golpe te quita una vida y un nivel de arma.</p>
          <p className="mt-2 text-[12.5px] font-semibold text-[#9fb3ff]">
            Récord: {best} · Hoy puedes ganar {daily} pts más
          </p>
        </>
      )}
      {!online && (
        <p className="mx-auto mt-3 max-w-[310px] rounded-2xl bg-white/[0.07] px-3 py-2 text-[12.5px] leading-snug text-[#c8d3ff]">
          <b className="text-white">Sin conexión:</b> puedes jugar igual. Tus puntos de premio se guardan en este celular; la partida no entra al ranking.
        </p>
      )}
      <DifficultyPicker />
      <button
        autoFocus
        onClick={start}
        className="mx-auto mt-5 flex min-h-14 items-center gap-2 rounded-full bg-[#4de1ff] px-10 text-[17px] font-extrabold text-[#04202b] shadow-[0_12px_28px_-12px_#4de1ff] active:scale-95"
      >
        <PlayIcon className="size-5" />
        {phase === 'over' ? 'Jugar otra vez' : 'Jugar'}
      </button>
      <button onClick={onExit} className="mx-auto mt-1 min-h-11 px-4 text-[13px] font-semibold text-[#9fb3ff] underline underline-offset-2">
        Salir del arcade
      </button>
    </div>
  )
}
