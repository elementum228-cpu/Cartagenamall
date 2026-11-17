import { Check, Star, Ticket, X } from 'lucide-react'
import { useEffect } from 'react'
import { useCatalog } from '../state/catalog'
import { StoreLogo } from '../ui/bits'
import type { StoreReward } from './rewards'
import { useArcade } from './store'

// Cómo se ven los premios en el Arcade: la tarjeta de la lista (con la foto que subió el negocio), el detalle al tocarla y la tarjeta
// de «Tu meta», el premio que la persona se pone como objetivo para ver cuánto le falta.

/** Logo del negocio (el que cargó en su perfil; si no tiene, su sigla con su color). */
export function StoreBadge({ storeId, storeName, size }: { storeId?: string; storeName?: string; size: number }) {
  const store = useCatalog((s) => s.stores.find((x) => (storeId ? x.id === storeId : !!storeName && x.name === storeName)))
  if (!store) return <span className="grid shrink-0 place-items-center rounded-full bg-white/15 text-[15px] font-black text-[#ffd45c]" style={{ width: size, height: size }}>{(storeName || 'M').charAt(0)}</span>
  return (
    <span className="shrink-0 rounded-full ring-2 ring-white shadow-sm">
      <StoreLogo store={store} size={size} round />
    </span>
  )
}

const untilEs = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })

/** Avance hacia un premio: porcentaje y cuántos tiquetes faltan. */
export const progressTo = (points: number, cost: number) => ({ pct: Math.min(100, Math.round((points / cost) * 100)), missing: Math.max(0, cost - points) })

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#1c1747]/[0.08]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#ff7ad1] transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Detalle del premio a pantalla completa: foto grande, condiciones, avance, canjear y fijarlo como meta. */
export function PrizeDetail({ r, points, onClose, onRedeem }: { r: StoreReward; points: number; onClose: () => void; onRedeem: () => void }) {
  const goal = useArcade((s) => s.goal === r.id)
  const setGoal = useArcade((s) => s.setGoal)
  const ok = points >= r.cost
  const { pct, missing } = progressTo(points, r.cost)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#07031a] text-white" role="dialog" aria-modal="true" aria-label={r.title}>
      <div className="relative">
        {r.image ? <img src={r.image} alt={r.title} className="aspect-[4/3] max-h-[46dvh] w-full object-cover" /> : <div className="grid aspect-[4/3] max-h-[34dvh] w-full place-items-center bg-white/5"><StoreBadge storeId={r.storeId} storeName={r.storeName} size={96} /></div>}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#07031a] to-transparent" />
        <button onClick={onClose} aria-label="Cerrar" className="absolute top-[max(12px,env(safe-area-inset-top))] right-3 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur active:bg-black/70">
          <X className="size-5" />
        </button>
        <span className="absolute right-3 bottom-3 rounded-full bg-[#ffc83d] px-3 py-1.5 text-[13px] font-extrabold text-[#2a1a00] shadow">{r.cost} tiquetes</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2.5">
          <StoreBadge storeId={r.storeId} storeName={r.storeName} size={34} />
          {r.storeName && <p className="text-[12.5px] font-bold tracking-wide text-[#4de1ff] uppercase">{r.storeName}</p>}
        </div>
        <h2 className="mt-2 text-[24px] leading-tight font-extrabold tracking-tight">{r.title}</h2>
        {r.detail && <p className="mt-2 text-[14.5px] leading-snug text-[#c8d3ff]">{r.detail}</p>}
        {r.until && <p className="mt-2 text-[12.5px] font-semibold text-[#9fb3ff]">Se puede canjear hasta el {untilEs(r.until)}</p>}
        <div className="mt-4 rounded-2xl bg-white/[0.07] p-3.5">
          <div className="mb-2 flex items-baseline justify-between text-[13px] font-bold">
            <span className="text-[#c8d3ff]">Tus tiquetes</span>
            <span>
              <span className="text-[#ffd45c]">{Math.min(points, r.cost)}</span> / {r.cost}
            </span>
          </div>
          <Bar pct={pct} />
          <p className="mt-2 text-[12.5px] font-semibold text-[#ffe9a8]">{ok ? '¡Ya te alcanza! Cámbialo por tu bono.' : `Te faltan ${missing} tiquetes. ¡Sigue jugando!`}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          <button
            disabled={!ok}
            onClick={onRedeem}
            className={`min-h-[52px] w-full rounded-2xl text-[16px] font-extrabold ${ok ? 'bg-[#4de1ff] text-[#04202b] active:scale-[0.98]' : 'bg-white/10 text-white/50'}`}
          >
            {ok ? 'Canjear este premio' : 'Aún no te alcanza'}
          </button>
          <button
            onClick={() => setGoal(goal ? null : r.id)}
            aria-pressed={goal}
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14.5px] font-extrabold ${goal ? 'bg-[#ffd45c] text-[#2a1a00]' : 'bg-white/12 text-white'}`}
          >
            {goal ? <Check className="size-5" /> : <Star className="size-5" />} {goal ? 'Es tu meta · quitar' : 'Ponerlo como mi meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pantalla de premios: saldo arriba y mosaico de dos columnas, con acabado claro tipo Apple ─────────────────────────────────────

/** Saldo de tiquetes: un número grande y limpio, y debajo cuánto falta para el siguiente premio. */
export function BalanceBar({ points, next }: { points: number; next?: StoreReward }) {
  const m = next ? progressTo(points, next.cost) : null
  return (
    <div className="shrink-0 rounded-[26px] bg-white/70 p-4 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_14px_34px_-22px_rgba(60,40,120,0.55)] ring-1 ring-black/[0.04] backdrop-blur-xl">
      <div className="flex items-end justify-between gap-3">
        <div className="leading-none">
          <p className="text-[13px] font-semibold text-[#6b6a8a]">Tus tiquetes</p>
          <p className="mt-1 flex items-baseline gap-1.5 text-[40px] font-extrabold tracking-[-0.03em] text-[#1c1747] tabular-nums">
            {points}
            <Star className="size-5 -translate-y-[3px] text-[#f5a912]" fill="currentColor" aria-hidden />
          </p>
        </div>
        {next && m && (
          <p className="max-w-[52%] pb-1 text-right text-[13px] leading-snug font-semibold text-[#6b6a8a]">
            {m.missing > 0 ? (
              <>
                Te faltan <b className="text-[#1c1747]">{m.missing}</b> para {next.title}
              </>
            ) : (
              <>Ya alcanza {next.title}</>
            )}
          </p>
        )}
      </div>
      {next && m && (
        <div className="mt-3.5">
          <Bar pct={m.pct} />
        </div>
      )}
    </div>
  )
}

/** Mosaico de dos columnas, al estilo de una tienda de aplicaciones: foto grande y limpia, nombre, negocio y un botón en píldora. */
export function PrizeTile({ r, points, onOpen }: { r: StoreReward; points: number; onOpen: () => void }) {
  const goal = useArcade((s) => s.goal === r.id)
  const ok = points >= r.cost
  const { pct, missing } = progressTo(points, r.cost)
  return (
    <button onClick={onOpen} className="group flex min-w-0 flex-col text-left active:scale-[0.98]" aria-label={`Ver el premio: ${r.title}`}>
      <span className="relative block aspect-square w-full overflow-hidden rounded-[22px] bg-white/70 shadow-[0_14px_30px_-18px_rgba(60,40,120,0.6)] ring-1 ring-black/[0.05]">
        {r.image ? (
          <img src={r.image} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center">
            <StoreBadge storeId={r.storeId} storeName={r.storeName} size={64} />
          </span>
        )}
        {goal && (
          <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-white/85 text-[#f5a912] shadow backdrop-blur" aria-label="Es tu meta">
            <Star className="size-4" fill="currentColor" />
          </span>
        )}
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/85 py-1 pr-2.5 pl-2 text-[12.5px] font-extrabold text-[#1c1747] shadow-sm backdrop-blur-md">
          <Ticket className="size-3.5 text-[#f5a912]" aria-hidden /> {r.cost}
        </span>
      </span>
      <span className="mt-2 block px-1">
        <span className="line-clamp-2 block text-[15px] leading-tight font-bold tracking-[-0.01em] text-[#1c1747]">{r.title}</span>
        <span className="mt-0.5 block truncate text-[12.5px] font-medium text-[#6b6a8a]">{r.storeName}</span>
        <span className="mt-2 flex items-center gap-2">
          {ok ? (
            <span className="rounded-full bg-[#5b5bf0] px-4 py-1.5 text-[13px] font-extrabold text-white shadow-[0_8px_16px_-10px_rgba(91,91,240,0.9)]">Canjear</span>
          ) : (
            <>
              <span className="min-w-0 flex-1">
                <Bar pct={pct} />
              </span>
              <span className="shrink-0 text-[11.5px] font-semibold text-[#6b6a8a]">Faltan {missing}</span>
            </>
          )}
        </span>
      </span>
    </button>
  )
}
