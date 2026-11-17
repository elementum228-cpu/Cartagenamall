import { CheckCircle2, Search, Ticket, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Store } from '../domain/types'
import { normalizeCode, lookupVoucher, recentVouchers, useVoucher, type VoucherRow } from '../arcade/vouchers'
import { remoteEnabled } from '../remote/client'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'

const when = (iso: string) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const dayEs = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

/** «Validar bono»: el cajero escribe el código que le muestra el cliente, ve el premio y lo marca como usado (una sola vez). */
export function VoucherValidator({ store }: { store: Store }) {
  const toast = useUI((s) => s.toast)
  const [raw, setRaw] = useState('')
  const [found, setFound] = useState<VoucherRow | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<VoucherRow[]>([])

  const loadRecent = useCallback(() => {
    if (remoteEnabled()) void recentVouchers(store.id).then(setRecent).catch(() => setRecent([]))
  }, [store.id])
  useEffect(loadRecent, [loadRecent])

  if (!remoteEnabled()) {
    return (
      <section className="rounded-3xl border border-line bg-card p-4 text-sm text-ink-soft">
        <p className="font-bold text-ink">Validar bonos del Arcade</p>
        <p className="mt-1">La validación necesita la base de datos conectada; en la versión de demostración no está disponible.</p>
      </section>
    )
  }

  const search = async (code = raw) => {
    const c = normalizeCode(code)
    if (c.length < 7) return toast('Escribe el código completo del bono.', 'error')
    setBusy(true)
    try {
      setFound(await lookupVoucher(store.id, c))
      setRaw(c)
    } catch {
      toast('No se pudo consultar. Revisa tu conexión.', 'error')
    }
    setBusy(false)
  }
  const use = async () => {
    if (!found) return
    setBusy(true)
    try {
      const res = await useVoucher(store.id, found.code)
      if (res === 'ok') {
        toast('Bono validado. Entrega el premio.', 'success')
        setFound({ ...found, used_at: new Date().toISOString() })
        loadRecent()
      } else {
        toast(res === 'used' ? 'Ese bono ya se había usado.' : res === 'expired' ? 'Ese bono está vencido.' : 'No se encontró el bono.', 'error')
        await search(found.code)
      }
    } catch {
      toast('No se pudo validar. Inténtalo de nuevo.', 'error')
    }
    setBusy(false)
  }

  const state = found ? (found.used_at ? 'used' : found.expired ? 'expired' : 'ok') : null
  return (
    <section className="space-y-3 rounded-3xl border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand" aria-hidden>
          <Ticket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Validar bono del Arcade</p>
          <p className="text-xs text-ink-soft">Cuando alguien te muestre su bono, escribe el código (CM-XXXXXX), mira qué premio es y márcalo como usado. Solo funciona una vez.</p>
        </div>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <input className={`${input} font-mono tracking-widest uppercase`} value={raw} onChange={(e) => { setRaw(e.target.value.slice(0, 14)); setFound(undefined) }} placeholder="CM-XXXXXX" aria-label="Código del bono" autoCapitalize="characters" autoComplete="off" />
        <button className={btn.primary} disabled={busy || !raw.trim()} type="submit">
          <Search className="size-4" /> Buscar
        </button>
      </form>
      {found === null && (
        <p className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-800">
          <XCircle className="size-5 shrink-0" /> No hay un bono con ese código en tu tienda. Revisa que esté bien escrito. Si el cliente lo canjeó hace rato, pídele que abra su bono en la app una vez para registrarlo y vuelve a buscar.
        </p>
      )}
      {found && state && (
        <div className={`space-y-2 rounded-2xl border p-3 ${state === 'ok' ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
          <p className={`flex items-center gap-2 text-sm font-extrabold ${state === 'ok' ? 'text-emerald-800' : 'text-red-800'}`}>
            {state === 'ok' ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
            {state === 'ok' ? 'Bono válido' : state === 'used' ? `Ya se usó el ${when(found.used_at as string)}` : 'Bono vencido'}
          </p>
          <p className="text-lg leading-tight font-extrabold">{found.title}</p>
          {found.detail && <p className="text-sm text-ink-soft">{found.detail}</p>}
          <p className="text-xs text-ink-soft">
            Código {found.code} · canjeado {when(found.issued_at)}
            {found.until ? ` · vence el ${dayEs(found.until)}` : ''}
          </p>
          {state === 'ok' && (
            <button className={`${btn.primary} w-full`} disabled={busy} onClick={() => void use()}>
              Marcar como usado y entregar premio
            </button>
          )}
        </div>
      )}
      {/* solo los bonos por validar: los que ya se usaron salen de la lista para que la pantalla quede limpia (se siguen contando arriba, en el Resumen) */}
      {recent.filter((v) => !v.used_at).length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold text-ink-soft">Bonos por validar</p>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {recent.filter((v) => !v.used_at).slice(0, 8).map((v) => (
              <li key={v.code}>
                <button className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left" onClick={() => void search(v.code)}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{v.title}</span>
                    <span className="block font-mono text-[11px] text-ink-soft">{v.code} · {when(v.issued_at)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${v.used_at ? 'bg-ink/10 text-ink-soft' : 'bg-emerald-100 text-emerald-800'}`}>{v.used_at ? 'Usado' : 'Pendiente'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

const WEEK = 7 * 86_400_000

/** Resumen de la semana para el negocio: cuántos bonos del Arcade se canjearon y cuántos ya llegaron a la caja (lo que el Arcade le trae al local). */
export function VoucherStats({ store, goTab }: { store: Store; goTab: (t: 'promociones') => void }) {
  const [rows, setRows] = useState<VoucherRow[] | null>(null)
  useEffect(() => {
    if (!remoteEnabled()) return
    void recentVouchers(store.id).then(setRows).catch(() => setRows([]))
  }, [store.id])
  if (!remoteEnabled()) return null
  const hasRewards = (store.arcadeRewards?.length ?? 0) > 0
  const week = (rows ?? []).filter((v) => Date.now() - Date.parse(v.issued_at) < WEEK)
  const used = week.filter((v) => v.used_at).length
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand" aria-hidden>
          <Ticket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Lo que el Arcade te trae</p>
          {!hasRewards ? (
            <p className="mt-0.5 text-xs text-ink-soft">Aún no regalas un premio en el Arcade. Quien juega en el mall junta tiquetes y los cambia por tus premios: es gente que llega a tu local.</p>
          ) : rows === null ? (
            <p className="mt-0.5 text-xs text-ink-soft">Cargando…</p>
          ) : (
            <p className="mt-0.5 text-xs text-ink-soft">Esta semana, de tus últimos bonos.</p>
          )}
        </div>
      </div>
      {hasRewards && rows !== null && (
        <div className="mt-3 grid grid-cols-2 gap-2.5 text-center">
          <div className="rounded-2xl bg-sand p-3">
            <p className="text-[26px] leading-none font-extrabold">{week.length}</p>
            <p className="mt-1 text-xs font-semibold text-ink-soft">canjeados</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-3">
            <p className="text-[26px] leading-none font-extrabold text-emerald-800">{used}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-800">usados en tu caja</p>
          </div>
        </div>
      )}
      <button className={`${btn.secondary} mt-3 w-full`} onClick={() => goTab('promociones')}>
        {hasRewards ? 'Validar un bono' : 'Crear un premio del Arcade'}
      </button>
    </section>
  )
}
