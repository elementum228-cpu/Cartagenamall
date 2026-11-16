import type { Store } from '../domain/types'

// Horario semanal de un negocio. `status` sigue siendo el interruptor manual («Abierto» / «Cerrado»); con horario puesto, el local además
// solo recibe pedidos dentro de sus horas. Se evalúa en hora de Colombia (UTC-5, sin horario de verano), sin importar dónde esté el aparato.

/** Una franja del día en minutos desde medianoche. Si `close` ≤ `open`, el local cierra pasada la medianoche (ej. 6 p. m. a 2 a. m.). */
export interface DayHours {
  open: number
  close: number
}
/** 7 días, índice 0 = domingo (como `Date.getDay()`); `null` = ese día no abre. */
export type WeekHours = (DayHours | null)[]

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
/** Orden de la semana para mostrar: lunes primero. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const DEFAULT_DAY: DayHours = { open: 9 * 60, close: 20 * 60 }

const MIN = 24 * 60
const clampMin = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(MIN - 1, Math.max(0, Math.round(n))) : null)

/** Limpia lo que viene de la base de datos o del formulario. `undefined` si no hay un horario usable. */
export function cleanHours(raw: unknown): WeekHours | undefined {
  if (!Array.isArray(raw) || raw.length !== 7) return undefined
  const week: WeekHours = raw.map((d) => {
    if (!d || typeof d !== 'object') return null
    const o = clampMin((d as DayHours).open)
    const c = clampMin((d as DayHours).close)
    return o === null || c === null || o === c ? null : { open: o, close: c }
  })
  return week.some(Boolean) ? week : undefined
}

/** Día de la semana (0-6) y minutos desde medianoche, en hora de Colombia. */
export function bogotaClock(now: Date): { day: number; minutes: number } {
  const t = new Date(now.getTime() - 5 * 3_600_000)
  return { day: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() }
}

/** ¿Está dentro del horario? Sin horario se considera abierto. */
export function withinHours(hours: WeekHours | undefined, now = new Date()): boolean {
  const w = cleanHours(hours)
  if (!w) return true
  const { day, minutes } = bogotaClock(now)
  const today = w[day]
  if (today) {
    if (today.close > today.open ? minutes >= today.open && minutes < today.close : minutes >= today.open) return true
  }
  // franja de ayer que pasó de la medianoche
  const prev = w[(day + 6) % 7]
  return !!prev && prev.close <= prev.open && minutes < prev.close
}

/** ¿Recibe pedidos ahora? Interruptor manual encendido y dentro de su horario. */
export const isOpenNow = (store: Pick<Store, 'status' | 'hours'>, now = new Date()) => store.status === 'open' && withinHours(store.hours, now)

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}
export const toInput = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export const fromInput = (v: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v)
  return m ? Math.min(MIN - 1, Number(m[1]) * 60 + Number(m[2])) : null
}

/** Texto corto para la ficha: «Abierto · cierra 8:00 p. m.», «Cerrado · abre hoy 9:00 a. m.», «Cerrado · abre el lunes 9:00 a. m.». */
export function openLabel(store: Pick<Store, 'status' | 'hours'>, now = new Date()): string {
  if (store.status !== 'open') return 'Cerrado por ahora'
  const w = cleanHours(store.hours)
  if (!w) return 'Abierto'
  const { day, minutes } = bogotaClock(now)
  if (withinHours(w, now)) {
    const today = w[day]
    const prev = w[(day + 6) % 7]
    const closes = today && (today.close > today.open ? (minutes < today.close ? today.close : null) : null)
    const end = closes ?? (prev && prev.close <= prev.open && minutes < prev.close ? prev.close : today ? today.close : null)
    return end !== null && end !== undefined ? `Abierto · cierra ${fmtTime(end)}` : 'Abierto'
  }
  for (let i = 0; i < 7; i++) {
    const d = (day + i) % 7
    const h = w[d]
    if (!h) continue
    if (i === 0 && minutes >= h.open) continue
    const when = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${DAY_NAMES[d].toLowerCase()}`
    return `Cerrado · abre ${when} ${fmtTime(h.open)}`
  }
  return 'Cerrado'
}
