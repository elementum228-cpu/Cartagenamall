import { Ban, Check, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { fetchPrizes } from '../arcade/board'
import { remoteEnabled, supabase } from '../remote/client'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'

// Administración del Arcade: premios de los primeros puestos y revisión del podio. El puntaje de cada partida lo calcula el servidor
// repitiéndola (ver supabase/functions/arcade-run), pero un programa que «juegue» de verdad sigue siendo posible: por eso los premios se
// entregan después de que alguien de la administración revise el podio de la semana y descalifique lo sospechoso.

interface Row {
  place: number
  player_id: string
  nickname: string
  score: number
  run_id: string
  finished_at: string
  steps: number
  banned: boolean
  code: string
  has_replay: boolean
}

const mondayOf = (d: Date) => {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}

export function ArcadeAdmin() {
  const toast = useUI((s) => s.toast)
  const [week, setWeek] = useState<'last' | 'now'>('last')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [prizes, setPrizes] = useState<string[]>(['', '', ''])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const now = new Date()
    const last = new Date(now)
    last.setDate(last.getDate() - 7)
    const { data, error } = await supabase.rpc('arcade_admin_week', { p_week: mondayOf(week === 'last' ? last : now) })
    if (error) {
      setRows(null)
      toast(`No se pudo leer el podio: ${error.message}`)
      return
    }
    setRows((data as Row[]) ?? [])
  }, [week, toast])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    void fetchPrizes().then((p) => p && setPrizes(p))
  }, [])

  if (!remoteEnabled()) return <p className="text-sm text-ink-soft">El Arcade con ranking necesita la base de datos conectada.</p>

  const savePrizes = async () => {
    if (!supabase) return
    setSaving(true)
    const doc = { 1: prizes[0].trim(), 2: prizes[1].trim(), 3: prizes[2].trim() }
    const { error } = await supabase.from('mall_settings').upsert({ key: 'arcade_prizes', doc })
    setSaving(false)
    toast(error ? `No se guardó: ${error.message}` : 'Premios guardados')
  }

  const ban = async (r: Row, banned: boolean) => {
    if (!supabase) return
    if (banned && !confirm(`¿Descalificar a «${r.nickname}»? Saldrá de todos los rankings y no podrá ganar premios.`)) return
    const { error } = await supabase.rpc('arcade_admin_ban', { p_player: r.player_id, p_banned: banned })
    toast(error ? `No se pudo: ${error.message}` : banned ? 'Jugador descalificado' : 'Jugador restablecido')
    void load()
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-extrabold">
          <Trophy className="size-5" /> Premios del Arcade
        </h2>
        <p className="mb-3 text-sm text-ink-soft">Lo que ganan los tres primeros de la semana (mejor puntaje). Se muestra a todos los jugadores y al ganador junto a su código.</p>
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <label key={i} className="block">
              <span className="mb-1 block text-xs font-bold text-ink-soft">Puesto {i + 1}</span>
              <input className={input} value={prizes[i]} onChange={(e) => setPrizes((p) => p.map((v, j) => (j === i ? e.target.value : v)))} placeholder="Ej.: 30 % de descuento en restaurantes aliados" />
            </label>
          ))}
        </div>
        <button onClick={savePrizes} disabled={saving} className={`${btn.primary} mt-3`}>
          {saving ? 'Guardando…' : 'Guardar premios'}
        </button>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-extrabold">Podio para revisar</h2>
          {(
            [
              ['last', 'Semana pasada'],
              ['now', 'Esta semana'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setWeek(id)} aria-pressed={week === id} className={`rounded-full px-3 py-1.5 text-sm font-bold ${week === id ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-line'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="mb-3 text-sm text-ink-soft">
          Cada puntaje ya fue repetido por el servidor. Revisa que los primeros sean creíbles (puntajes muy por encima del resto, partidas siempre perfectas, muchas
          partidas seguidas) y descalifica lo sospechoso <b>antes de entregar premios</b>. El código es el que ve el ganador: pídele que lo muestre en caja.
        </p>
        {rows === null && <p className="text-sm text-ink-soft">Cargando…</p>}
        {rows && rows.length === 0 && <p className="text-sm text-ink-soft">No hay partidas verificadas en esa semana.</p>}
        {rows && rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.player_id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${r.banned ? 'border-red-200 bg-red-50' : 'border-line bg-white'}`}>
                <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-extrabold text-white">{r.place}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {r.nickname} <span className="font-mono text-xs text-ink-soft">{r.code}</span>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {r.score} puntos · {Math.round(r.steps / 60)} s de juego · {new Date(r.finished_at).toLocaleString('es-CO')}
                    {r.has_replay ? ' · con registro de movimientos' : ''}
                  </p>
                </div>
                {r.banned ? (
                  <button onClick={() => ban(r, false)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-bold">
                    <Check className="size-4" /> Restablecer
                  </button>
                ) : (
                  <button onClick={() => ban(r, true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-bold text-white">
                    <Ban className="size-4" /> Descalificar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
