import { Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { copyText } from '../lib/clipboard'
import {
  defaultNick,
  fetchBoard,
  fetchHistory,
  fetchMyPrize,
  fetchPrizes,
  fetchWeekSummary,
  fetchWinners,
  type Board,
  type BoardKind,
  type HistoryRun,
  type MyPrize,
  type WeekSummary,
  type Winner,
} from './board'
import { ARCADE_REWARDS, useArcade, type ArcadeRedemption } from './store'

// Las pestañas «Ranking» y «Premios» del Arcade (se cargan junto con el juego, pero viven aparte para no mezclar el juego con las listas).

export function Prizes() {
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
const KIND_INFO: Record<BoardKind, { label: string; unit: string; note: string }> = {
  week: { label: 'Esta semana', unit: '', note: 'Mejor puntaje de la semana. Se reinicia cada lunes y el top 3 gana premios.' },
  best: { label: 'Récord', unit: '', note: 'Mejor puntaje en una sola partida, de todos los tiempos.' },
  total: { label: 'Puntos', unit: ' pts', note: 'Puntos acumulados desde el primer día (tienen tope diario).' },
}

/** Premios de la semana: lo que se gana, el podio de la semana pasada y, si ganaste, tu código. */
function Prizes3() {
  const playerId = useArcade((s) => s.playerId)
  const [prizes, setPrizes] = useState<string[] | null>(null)
  const [winners, setWinners] = useState<Winner[] | null>(null)
  const [mine, setMine] = useState<MyPrize | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let live = true
    void Promise.all([fetchPrizes(), fetchWinners(), fetchMyPrize(playerId)]).then(([p, w, m]) => {
      if (!live) return
      setPrizes(p)
      setWinners(w)
      setMine(m)
    })
    return () => {
      live = false
    }
  }, [playerId])
  if (!prizes && !winners && !mine) return null
  return (
    <div className="flex flex-col gap-2">
      {mine && (
        <div className="rounded-2xl border-2 border-[#ffc83d] bg-[#ffc83d]/10 p-4 text-center" role="status">
          <p className="text-[13px] font-semibold text-[#ffe08a]">
            ¡Ganaste el puesto #{mine.place} de la semana pasada con {mine.score} puntos!
          </p>
          <p className="my-1 text-[15px] font-extrabold">{mine.prize}</p>
          <p className="text-3xl font-extrabold tracking-widest text-[#ffc83d]">{mine.code}</p>
          <p className="mt-1 text-[11.5px] leading-snug text-[#c8d3ff]">
            Muestra este código en caja del local aliado. Los premios se confirman tras revisar las partidas del podio.
          </p>
          <button
            onClick={async () => {
              setCopied(await copyText(mine.code))
              setTimeout(() => setCopied(false), 1500)
            }}
            className="mt-2 min-h-11 rounded-full bg-white/15 px-5 text-[13px] font-bold"
          >
            {copied ? 'Copiado' : 'Copiar código'}
          </button>
        </div>
      )}
      {prizes && (
        <div className="rounded-2xl bg-white/[0.07] p-3.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-extrabold tracking-wide text-[#ffc83d] uppercase">
            <Trophy className="size-4" /> Premios cada lunes
          </p>
          <ol className="flex flex-col gap-1">
            {prizes.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold" style={{ background: MEDAL[i], color: '#1a1200' }}>
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
          {winners && winners.length > 0 && (
            <p className="mt-2 border-t border-white/10 pt-2 text-[12px] text-[#c8d3ff]">
              Semana pasada: {winners.map((w) => `${w.place}.º ${w.nickname} (${w.score})`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Lunes (en Cartagena) de la semana de una fecha: la clave con la que el servidor agrupa las partidas por semana. */
function weekKey(d: Date): string {
  const b = new Date(d.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  b.setDate(b.getDate() - ((b.getDay() + 6) % 7))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${b.getFullYear()}-${p(b.getMonth() + 1)}-${p(b.getDate())}`
}
const when = (iso: string) => new Date(iso).toLocaleString('es-CO', { weekday: 'short', hour: 'numeric', minute: '2-digit' })

/** «Tu semana»: tus partidas guardadas y cómo vas frente al líder (puesto, cuánto te falta). */
function WeekCard() {
  const playerId = useArcade((s) => s.playerId)
  const local = useArcade((s) => s.runs)
  const [sum, setSum] = useState<WeekSummary | null | undefined>(undefined)
  const [hist, setHist] = useState<HistoryRun[] | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    void Promise.all([fetchWeekSummary(playerId), fetchHistory(playerId)]).then(([s, h]) => {
      if (!live) return
      setSum(s)
      setHist(h)
    })
    return () => {
      live = false
    }
  }, [playerId])

  const wk = weekKey(new Date())
  // si el servidor responde se usan sus partidas verificadas (valen en cualquier dispositivo); si no, las de este dispositivo
  const runs: { score: number; at: string; verified: boolean }[] = hist
    ? hist.filter((r) => r.weekStart === wk).map((r) => ({ score: r.score, at: r.at, verified: true }))
    : local.filter((r) => weekKey(new Date(r.at)) === wk).map((r) => ({ score: r.score, at: r.at, verified: r.ranked }))
  const best = runs.reduce((m, r) => Math.max(m, r.score), 0)
  const leader = Math.max(sum?.leader ?? 0, best)
  const gap = Math.max(0, leader - best)
  const first = !!sum?.rank && sum.rank === 1 && best > 0

  if (sum === undefined && hist === undefined) return <p className="py-2 text-center text-[13px] text-[#9fb3ff]">Cargando tu semana…</p>
  return (
    <div className="rounded-2xl bg-white/[0.07] p-3.5" aria-label="Tu semana">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-extrabold tracking-wide text-[#4de1ff] uppercase">Tu semana</p>
        {sum?.rank ? (
          <span className="rounded-full bg-[#4de1ff] px-2.5 py-1 text-[12px] font-extrabold text-[#04202b]">
            Puesto #{sum.rank} de {sum.players}
          </span>
        ) : sum && sum.players > 0 ? (
          <span className="text-[12px] font-semibold text-[#9fb3ff]">{sum.players} jugando</span>
        ) : null}
      </div>
      {best > 0 ? (
        <>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#9fb3ff]">Tu mejor</p>
              <p className="text-3xl leading-none font-extrabold tabular-nums">{best}</p>
            </div>
            {leader > 0 && (
              <div className="text-right">
                <p className="text-[11px] font-semibold text-[#9fb3ff]">Líder</p>
                <p className="text-xl leading-none font-extrabold text-[#ffc83d] tabular-nums">{leader}</p>
              </div>
            )}
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4de1ff] to-[#5dff9b]"
              style={{ width: `${Math.max(4, Math.min(100, (best / Math.max(leader, 1)) * 100))}%` }}
            />
          </div>
          <p className="mt-1.5 text-[12.5px] font-semibold text-[#c8d3ff]">
            {first
              ? '¡Vas de líder esta semana! Defiende tu puesto.'
              : gap > 0 && sum?.players
                ? `Te faltan ${gap} puntos para alcanzar al #1.`
                : 'Sigue jugando para subir de puesto.'}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[13px] leading-snug text-[#c8d3ff]">
          Aún no has jugado esta semana.{sum && sum.leader > 0 ? ` El líder va en ${sum.leader}: ¿lo alcanzas?` : ' ¡Una partida y entras al ranking!'}
        </p>
      )}
      {runs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5" aria-label="Tus partidas de esta semana">
          {runs.slice(0, 8).map((r, i) => (
            <li key={`${r.at}-${i}`} className="flex items-center gap-2.5 text-[12.5px]">
              <span className="w-[104px] shrink-0 truncate text-[#9fb3ff] capitalize">{when(r.at)}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <span
                  className={`block h-full rounded-full ${r.score === best ? 'bg-[#ffc83d]' : 'bg-[#4de1ff]/70'}`}
                  style={{ width: `${Math.max(3, (r.score / Math.max(best, 1)) * 100)}%` }}
                />
              </span>
              <span className={`w-12 shrink-0 text-right font-extrabold tabular-nums ${r.score === best ? 'text-[#ffc83d]' : ''}`}>{r.score}</span>
            </li>
          ))}
        </ul>
      )}
      {hist === null && <p className="mt-2 text-[11.5px] text-[#9fb3ff]">Mostrando las partidas de este dispositivo (sin conexión al ranking).</p>}
    </div>
  )
}

/** Tabla de líderes: semana en curso, récord o puntos; si el servidor no responde, mis mejores partidas del dispositivo. */
export function Ranking() {
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

  const info = KIND_INFO[kind]
  const inList = board?.rows.some((r) => r.me)
  return (
    <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto pb-2 text-white">
      <Prizes3 />
      <WeekCard />
      <div className="flex gap-1.5" role="tablist" aria-label="Tipo de ranking">
        {(Object.keys(KIND_INFO) as BoardKind[]).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={kind === id}
            onClick={() => setKind(id)}
            className={`min-h-11 flex-1 rounded-xl text-[13px] font-bold ${kind === id ? 'bg-white text-[#04061a]' : 'bg-white/10'}`}
          >
            {KIND_INFO[id].label}
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

      {board && board.rows.length === 0 && (
        <p className="py-6 text-center text-[13px] text-[#9fb3ff]">Todavía no hay puntajes {kind === 'week' ? 'esta semana' : ''}. ¡Sé el primero!</p>
      )}

      {board && board.rows.length > 0 && (
        <ol className="flex flex-col gap-1.5" aria-label="Tabla de líderes">
          {board.rows.map((r) => (
            <Row key={`${r.rank}-${r.nickname}`} rank={r.rank} name={r.nickname} points={r.points} me={r.me} unit={info.unit} />
          ))}
          {board.me && !inList && board.me.points > 0 && (
            <>
              <li className="text-center text-[11px] text-[#9fb3ff]" aria-hidden>
                · · ·
              </li>
              <Row rank={board.me.rank} name={board.me.nickname} points={board.me.points} me unit={info.unit} />
            </>
          )}
        </ol>
      )}
      <p className="text-center text-[11px] text-[#9fb3ff]">{info.note} Cada partida la verifica el servidor.</p>
    </div>
  )
}

function Row({ rank, name, points, me, unit }: { rank: number; name: string; points: number; me: boolean; unit: string }) {
  return (
    <li className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${me ? 'bg-[#4de1ff]/20 ring-2 ring-[#4de1ff]' : 'bg-white/[0.06]'}`}>
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
        style={rank <= 3 ? { background: MEDAL[rank - 1], color: '#1a1200' } : { background: '#ffffff1a' }}
      >
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
        {name}
        {me && <span className="ml-1.5 text-[11px] font-extrabold text-[#4de1ff]">TÚ</span>}
      </span>
      <span className="text-[14px] font-extrabold text-[#ffc83d] tabular-nums">
        {points}
        {unit}
      </span>
    </li>
  )
}
