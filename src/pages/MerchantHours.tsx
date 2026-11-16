import { DAY_NAMES, DEFAULT_DAY, WEEK_ORDER, cleanHours, fmtTime, fromInput, toInput, type DayHours, type WeekHours } from '../lib/hours'
import { input } from '../ui/bits'

/** Resumen de una línea del horario para el título de la sección. */
export function hoursSummary(hours: WeekHours | undefined): string {
  const w = cleanHours(hours)
  if (!w) return 'Sin horario: solo manda el interruptor Abierto / Cerrado'
  const days = WEEK_ORDER.filter((d) => w[d])
  const first = w[days[0]] as DayHours
  const same = days.every((d) => w[d]!.open === first.open && w[d]!.close === first.close)
  return `${days.length} días a la semana${same ? ` · ${fmtTime(first.open)} a ${fmtTime(first.close)}` : ' · horas distintas'}`
}

/** Editor del horario semanal: se enciende con un interruptor, cada día se abre o se cierra y tiene su franja. */
export function HoursEditor({ value, onChange }: { value: WeekHours | undefined; onChange: (v: WeekHours | undefined) => void }) {
  const on = !!cleanHours(value)
  const week: WeekHours = cleanHours(value) ?? Array.from({ length: 7 }, (_, d) => (d === 0 ? null : { ...DEFAULT_DAY }))
  const setDay = (d: number, v: DayHours | null) => onChange(week.map((x, i) => (i === d ? v : x)) as WeekHours)
  return (
    <div className="space-y-3 sm:col-span-2">
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-3">
        <input
          type="checkbox"
          className="mt-0.5 size-5 accent-brand"
          checked={on}
          onChange={(e) => onChange(e.target.checked ? week : undefined)}
        />
        <span>
          <span className="block text-sm font-bold">Usar horario de atención</span>
          <span className="block text-xs text-ink-soft">Tu local abre y cierra solo: fuera de horario se ve «Cerrado» y no recibe pedidos. El interruptor Abierto / Cerrado sigue mandando si necesitas cerrar antes.</span>
        </span>
      </label>
      {on && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {WEEK_ORDER.map((d) => {
            const h = week[d]
            return (
              <li key={d} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <label className="flex min-h-10 w-[7.5rem] items-center gap-2 text-sm font-bold">
                  <input type="checkbox" className="size-5 accent-brand" checked={!!h} onChange={(e) => setDay(d, e.target.checked ? { ...DEFAULT_DAY } : null)} aria-label={`${DAY_NAMES[d]}: abre`} />
                  {DAY_NAMES[d]}
                </label>
                {h ? (
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      className={`${input} !h-10 !w-[7.2rem] !px-2`}
                      value={toInput(h.open)}
                      onChange={(e) => {
                        const m = fromInput(e.target.value)
                        if (m !== null) setDay(d, { ...h, open: m })
                      }}
                      aria-label={`${DAY_NAMES[d]}: hora de apertura`}
                    />
                    <span className="text-ink-soft">a</span>
                    <input
                      type="time"
                      className={`${input} !h-10 !w-[7.2rem] !px-2`}
                      value={toInput(h.close)}
                      onChange={(e) => {
                        const m = fromInput(e.target.value)
                        if (m !== null) setDay(d, { ...h, close: m })
                      }}
                      aria-label={`${DAY_NAMES[d]}: hora de cierre`}
                    />
                  </span>
                ) : (
                  <span className="text-sm text-ink-soft">Cerrado</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {on && (
        <button type="button" className="text-xs font-bold text-teal underline underline-offset-2" onClick={() => {
          const base = week[1] ?? week.find(Boolean) ?? DEFAULT_DAY
          onChange(week.map((x, d) => (x || d === 1 ? { ...base } : x)) as WeekHours)
        }}>
          Copiar el horario del lunes a los días que abren
        </button>
      )}
      {on && <p className="text-xs text-ink-soft">Si cierras después de medianoche (por ejemplo de 6:00 p. m. a 2:00 a. m.) pon la hora de cierre menor que la de apertura. Las horas son de Colombia.</p>}
    </div>
  )
}
