import { ChevronLeft, Crown, Gamepad2, Gift, Pause, Play as PlayIcon, Ticket, Volume2, VolumeX, X } from 'lucide-react'

const Play2 = PlayIcon
import { useCallback, useEffect, useRef, useState } from 'react'
import { createFrameGate } from '../world/frameGate'
import { usePrefs } from '../state/ui'
import { useOnline } from '../lib/online'
import { setArcadeSound, sfx, startMusic, stopMusic, suspendArcadeAudio, unlockArcadeAudio } from './audio'
import { defaultNick, finishRun as finishRunRemote, startRun, type RunTicket } from './board'
import { createGame, createRecorder, DIFFICULTIES, H, makeRand, STEP, update, W, type Difficulty, type Game, type Input } from './engine'
import { draw } from './render'
import { useArcade, useArcadeUi } from './store'
import { MiniGame } from './games/MiniGame'
import { CoinSlot } from './CoinSlot'
import { GameEnd } from './TicketReceipt'
import { Prizes, Ranking } from './ArcadeTabs'
import { ArcadeHub } from './ArcadeHub'
import '@fontsource/press-start-2p/latin-400.css'
import './arcade.css'

// Pantalla de arcade de la isla de Entretenimiento: el juego «Nave Caribe» (canvas 2D), su música (que se puede apagar), el ranking de la
// semana y los premios. Mientras se juega, la partida ocupa TODA la pantalla. El bucle de dibujo solo corre mientras se juega: en el menú,
// en pausa y con la pestaña oculta no gasta nada.

const DPR_BY_QUALITY = { low: 1.5, medium: 2, high: 2 } as const

type Phase = 'menu' | 'play' | 'pause' | 'over'

export function ArcadePanel() {
  const open = useArcadeUi((s) => s.open)
  const game = useArcadeUi((s) => s.game)
  const playing = useArcadeUi((s) => s.playing)
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
    <div className={`fixed inset-0 z-[70] flex items-center justify-center arcade-soft-bg py-2 ${playing ? 'px-2' : 'px-4'}`} role="dialog" aria-modal="true" aria-label={`Arcade: ${GAME_NAME[game]}`}>
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

const GAME_NAME = { nave: 'Nave Caribe', cangrejos: 'Cangrejos Locos', bolos: 'Bolos de coco' } as const

/** Marco de las listas (ranking y premios): misma caja que el juego, para que al cambiar de pestaña no se mueva nada. */
function ListFrame({ children }: { children: React.ReactNode }) {
  return <div className="arcade-frame flex min-h-0 flex-1 flex-col overflow-y-auto p-3">{children}</div>
}

function Cabinet({ onClose }: { onClose: () => void }) {
  const game = useArcadeUi((s) => s.game)
  const soundOn = useArcade((s) => s.sound)
  useEffect(() => setArcadeSound(soundOn), [soundOn])
  const tab = useArcadeUi((s) => s.tab)
  const setTab = useArcadeUi((s) => s.setTab)
  const points = useArcade((s) => s.points)
  const playing = useArcadeUi((s) => s.playing)
  // Cangrejos Locos usa el estilo suave (lavanda, vidrio y letra de la app) y ocupa casi toda la pantalla
  // el estilo suave (lavanda, vidrio, letra de la app) es el de todo el Arcade: encabezado, pestañas, premios y juegos
  return (
    <div className={`flex h-full w-full flex-col gap-2.5 max-w-[480px] pt-[max(4px,env(safe-area-inset-top))] pb-[max(4px,env(safe-area-inset-bottom))]`}>
      {/* mientras se juega, la partida cubre la pantalla: el encabezado y las pestañas quedan ocultos para lectores de pantalla */}
      <div className="flex flex-col gap-2.5" aria-hidden={playing}>
            <div className="flex items-center gap-2 px-1">
              {tab === 'games' ? (
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ff7ad1] to-[#ff5aa5] text-white shadow-[0_10px_20px_-10px_rgba(255,90,165,0.9)]">
                  <Gamepad2 className="size-6" />
                </div>
              ) : (
                <button onClick={() => setTab('games')} aria-label="Volver a los juegos" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/70 text-[#1c1747] shadow-[0_6px_16px_-8px_rgba(60,40,120,0.5)] ring-1 ring-white/80 backdrop-blur active:bg-white">
                  <ChevronLeft className="size-6" />
                </button>
              )}
              <div className="min-w-0 flex-1 leading-tight">
                <h2 className="truncate text-[20px] font-extrabold tracking-tight text-[#1c1747]">Arcade</h2>
                <p className="truncate text-[13px] font-semibold text-[#4b4a7a]">{tab === 'prizes' ? 'Recompensas' : tab === 'games' ? 'Elige tu juego' : GAME_NAME[game]}</p>
              </div>
              <span className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-[16px] font-extrabold text-[#1c1747] shadow-[0_6px_16px_-8px_rgba(60,40,120,0.5)] ring-1 ring-white/80 backdrop-blur" aria-label={`${points} tiquetes`}>
                <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-[#ffe36b] to-[#f5a912] text-[#7a4b00]" aria-hidden>
                  <Ticket className="size-3.5" />
                </span>
                {points}
              </span>
              <SoundButton className="bg-white/70 !text-[#1c1747] shadow-[0_6px_16px_-8px_rgba(60,40,120,0.5)] ring-1 ring-white/80 backdrop-blur active:bg-white" />
              <button onClick={onClose} aria-label="Cerrar el arcade" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/70 text-[#1c1747] shadow-[0_6px_16px_-8px_rgba(60,40,120,0.5)] ring-1 ring-white/80 backdrop-blur active:bg-white">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex rounded-[20px] bg-white/45 p-1.5 shadow-[inset_0_1px_3px_rgba(60,40,120,0.12)] ring-1 ring-white/70 backdrop-blur" role="tablist">
              {(
                [
                  ...(tab === 'games' ? ([['games', 'Juegos', Gamepad2]] as const) : ([['play', 'Jugar', Play2]] as const)),
                  ['rank', 'Ranking', Crown],
                  ['prizes', 'Premios', Gift],
                ] as const
              )
                .filter(([id]) => (game === 'nave' && tab !== 'games') || id !== 'rank')
                .map(([id, label, Icon]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-extrabold transition active:scale-[0.98] ${tab === id ? 'bg-white text-[#1c1747] shadow-[0_6px_16px_-8px_rgba(60,40,120,0.55)]' : 'text-[#4b4a7a]'}`}
                >
                  <Icon className="size-[18px]" fill={(id === 'play' || id === 'games') && tab === id ? 'currentColor' : 'none'} />
                  {label}
                </button>
              ))}
            </div>
      </div>
      {/* el juego corto sigue montado (en pausa) al mirar los premios, para no perder la partida ni la moneda */}
      {game !== 'nave' && (
        <div className={tab === 'play' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          <MiniGame key={game} id={game} active={tab === 'play'} onPrizes={() => setTab('prizes')} />
        </div>
      )}
      {tab === 'games' ? <ArcadeHub /> : tab === 'play' ? game === 'nave' ? <Play onRanking={() => setTab('rank')} onPrizes={() => setTab('prizes')} onExit={onClose} /> : null : tab === 'rank' ? <ListFrame><Ranking /></ListFrame> : <Prizes />}
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
  total: number
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
      <p className="font-arcade mb-2.5 text-[9px] text-[#ff2bd6]">ELIGE NIVEL</p>
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
              style={on ? { color: c, background: '#1d0b52' } : undefined}
              className="arcade-chip font-arcade flex min-h-[62px] flex-col items-center justify-center px-0.5 py-1.5 transition active:translate-y-px"
            >
              <span className="text-[7px] leading-tight uppercase">{d.name}</span>
              <span className="mt-1.5 text-[9px]">{multLabel(d.mult)}</span>
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

function Play({ onRanking, onPrizes, onExit }: { onRanking: () => void; onPrizes: () => void; onExit: () => void }) {
  const quality = usePrefs((s) => s.quality)
  const sound = useArcade((s) => s.sound)
  const best = useArcade((s) => s.best)
  const bestRef = useRef(best)
  bestRef.current = best
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
      draw(g, ctx, true, { hi: best, crt: quality !== 'low' })
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
        draw(g, ctx, reduce, { hi: bestRef.current, crt: quality !== 'low' })
      }
      if (g.over) {
        stop()
        stopMusic()
        const st = useArcade.getState()
        const rn = run.current
        const ranked = !!rn?.ticket
        const r = st.finishRun(g.score, ranked, g.diff.id)
        sfx(r.record ? 'record' : 'over')
        setResult({ score: g.score, ...r, picked: g.picked, ranked, pending: ranked, difficulty: g.diff.id, total: useArcade.getState().points })
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
              <h3 className="font-arcade arcade-title text-[24px]">PAUSA</h3>
              <button
                autoFocus
                onClick={resume}
                className="arcade-btn font-arcade mt-1 flex min-h-12 items-center gap-2 px-7 text-[12px]"
              >
                <PlayIcon className="size-4 fill-current" /> SEGUIR
              </button>
              <div className="mt-1 flex items-center gap-2">
                <SoundButton className="bg-white/10 active:bg-white/20" />
                <button onClick={quit} className="min-h-11 px-3 text-[13px] font-bold text-[#9fb3ff] underline">
                  Salir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )

  // ── Fin de partida: «Juego finalizado» → ver mis tiquetes (sale el recibo) ─────────────────────────────────────────────────
  if (phase === 'over' && result)
    return (
      <div className="arcade-frame flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-6 text-center text-white">
        <GameEnd game="Nave Caribe" score={result.score} awarded={result.awarded} total={result.total} capped={result.capped} record={result.record} onPrizes={onPrizes} onAgain={() => setPhase('menu')}>
          <p className="font-arcade mt-1 text-[9px] uppercase" style={{ color: DIFF_STYLE[result.difficulty].color }}>
            {DIFFICULTIES[result.difficulty].name} · {multLabel(DIFFICULTIES[result.difficulty].mult)}
          </p>
          {result.pending && <p className="mt-1 text-[12px] text-[#9fb3ff]">Verificando tu partida…</p>}
          {!result.pending && result.rankWeek ? (
            <button onClick={onRanking} className="mx-auto min-h-11 text-[13px] font-bold text-[#4de1ff] underline">
              Puesto #{result.rankWeek} esta semana · ver ranking
            </button>
          ) : null}
        </GameEnd>
        <button onClick={onExit} className="font-arcade mx-auto mt-3 min-h-11 px-4 text-[9px] text-[#9fb3ff] underline underline-offset-4">
          SALIR DEL ARCADE
        </button>
      </div>
    )

  // ── Menú: igual de sencillo que los otros juegos (título, una frase, nivel y moneda) ──────────────────────────────────────────
  return (
    <div className="arcade-frame flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-6 text-center text-white">
      <h3 className="font-arcade arcade-title text-[24px] leading-[1.3]">
        NAVE
        <br />
        CARIBE
      </h3>
      <p className="mx-auto mt-3 max-w-[28ch] text-[13.5px] leading-snug text-[#e8ffff]">Arrastra la nave: dispara sola. Destruye los círculos, esquiva los tiros y recoge los premios verdes.</p>
      <DifficultyPicker />
      <div className="mt-5">
        <CoinSlot onStart={start} />
      </div>
      {!online && <p className="mx-auto mt-3 max-w-[280px] text-[11.5px] leading-snug text-[#9fb3ff]">Sin conexión: juegas igual y tus tiquetes se guardan en este celular.</p>}
      <button onClick={onExit} className="font-arcade mx-auto mt-3 min-h-11 px-4 text-[9px] text-[#9fb3ff] underline underline-offset-4">
        SALIR DEL ARCADE
      </button>
    </div>
  )
}
