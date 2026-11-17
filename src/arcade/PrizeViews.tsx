import { Check, ImageOff, Star, X } from 'lucide-react'
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
    <span className="shrink-0 rounded-full ring-2 ring-white/25">
      <StoreLogo store={store} size={size} round />
    </span>
  )
}

const untilEs = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })

/** Avance hacia un premio: porcentaje y cuántos tiquetes faltan. */
export const progressTo = (points: number, cost: number) => ({ pct: Math.min(100, Math.round((points / cost) * 100)), missing: Math.max(0, cost - points) })

/** La foto del premio (o, sin foto, un recuadro con el logo del negocio). */
function Photo({ r, className }: { r: StoreReward; className: string }) {
  return r.image ? (
    <img src={r.image} alt={r.title} className={`${className} object-cover`} />
  ) : (
    <span className={`${className} grid place-items-center bg-white/10 text-white/50`} aria-hidden>
      <ImageOff className="size-6" />
    </span>
  )
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-[#4de1ff] transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Tarjeta de un premio en la lista. Tocar la foto o el título abre el detalle; el botón canjea. */
export function PrizeCard({ r, points, onOpen, onRedeem }: { r: StoreReward; points: number; onOpen: () => void; onRedeem: () => void }) {
  const goal = useArcade((s) => s.goal === r.id)
  const ok = points >= r.cost
  const { pct, missing } = progressTo(points, r.cost)
  return (
    <div className={`shrink-0 rounded-2xl bg-white/[0.07] p-3 text-white ${goal ? 'ring-2 ring-[#ffd45c]/70' : ''}`}>
      <button onClick={onOpen} className="block w-full text-left" aria-label={`Ver el premio: ${r.title}`}>
        {r.image && (
          <span className="relative mb-2.5 block overflow-hidden rounded-xl">
            <Photo r={r} className="aspect-[16/9] w-full" />
            <span className="absolute top-2 right-2 rounded-full bg-[#ffc83d] px-2.5 py-1 text-[12px] font-extrabold text-[#2a1a00] shadow">{r.cost} tiquetes</span>
            {goal && (
              <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-[#07031a]/80 px-2 py-1 text-[10.5px] font-extrabold text-[#ffd45c]">
                <Star className="size-3" fill="currentColor" /> TU META
              </span>
            )}
          </span>
        )}
        <span className="flex items-start gap-3">
          <StoreBadge storeId={r.storeId} storeName={r.storeName} size={r.image ? 38 : 46} />
          <span className="min-w-0 flex-1">
            {r.storeName && <span className="block text-[11px] font-bold tracking-wide text-[#4de1ff] uppercase">{r.storeName}</span>}
            <span className="block text-[15px] leading-snug font-extrabold">{r.title}</span>
          </span>
          {!r.image && <span className="shrink-0 rounded-full bg-[#ffc83d] px-2.5 py-1 text-[12px] font-extrabold text-[#2a1a00]">{r.cost} tiquetes</span>}
        </span>
        {r.detail && <span className="mt-2 block text-[13px] leading-snug text-[#c8d3ff]">{r.detail}</span>}
      </button>
      <div className="mt-2.5">
        <Bar pct={pct} />
      </div>
      <button
        disabled={!ok}
        onClick={onRedeem}
        className={`mt-2.5 min-h-11 w-full rounded-xl text-[14px] font-extrabold ${ok ? 'bg-[#4de1ff] text-[#04202b] active:scale-[0.98]' : 'bg-white/10 text-white/50'}`}
      >
        {ok ? 'Canjear' : `Te faltan ${missing} tiquetes`}
      </button>
    </div>
  )
}

/** «Tu meta»: el premio elegido, grande, con cuánto falta. Tocarlo abre el detalle. */
export function GoalCard({ r, points, onOpen }: { r: StoreReward; points: number; onOpen: () => void }) {
  const { pct, missing } = progressTo(points, r.cost)
  return (
    <button onClick={onOpen} className="relative block w-full shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#3b1d8f] to-[#1a0f55] p-3 text-left text-white ring-2 ring-[#ffd45c]/60 active:scale-[0.99]" aria-label={`Tu meta: ${r.title}`}>
      <span className="mb-2 flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.16em] text-[#ffd45c]">
        <Star className="size-3.5" fill="currentColor" /> TU META
      </span>
      <span className="flex items-center gap-3">
        <Photo r={r} className="size-[84px] shrink-0 rounded-xl" />
        <span className="min-w-0 flex-1">
          {r.storeName && <span className="block truncate text-[11px] font-bold tracking-wide text-[#4de1ff] uppercase">{r.storeName}</span>}
          <span className="block text-[15px] leading-snug font-extrabold">{r.title}</span>
          <span className="mt-1.5 block">
            <Bar pct={pct} />
          </span>
          <span className="mt-1 block text-[12px] font-bold text-[#ffe9a8]">{missing > 0 ? `Te faltan ${missing} de ${r.cost} tiquetes` : '¡Ya lo puedes canjear!'}</span>
        </span>
      </span>
    </button>
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

// ── Propuestas de la pantalla de premios ───────────────────────────────────────────────────────────────────────────────────────────

/** Saldo de tiquetes y, si hay, lo que falta para el premio más cercano: lo primero que se ve arriba de los premios. */
export function BalanceBar({ points, next }: { points: number; next?: StoreReward }) {
  const m = next ? progressTo(points, next.cost) : null
  return (
    <div className="shrink-0 rounded-2xl bg-gradient-to-r from-[#3b1d8f]/80 to-[#1a0f55]/80 p-3 text-white ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffe36b] to-[#f5a912] text-[#7a4b00]" aria-hidden>
          <Star className="size-5" fill="currentColor" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] font-bold tracking-wide text-[#c8d3ff] uppercase">Tus tiquetes</p>
          <p className="text-[24px] font-black tabular-nums">{points}</p>
        </div>
        {next && m && (
          <p className="max-w-[48%] text-right text-[12px] leading-snug font-bold text-[#ffe9a8]">{m.missing > 0 ? `${m.missing} para «${next.title}»` : `¡Ya alcanza «${next.title}»!`}</p>
        )}
      </div>
      {next && m && (
        <div className="mt-2.5">
          <Bar pct={m.pct} />
        </div>
      )}
    </div>
  )
}

/** Propuesta A: mosaico de dos columnas. Foto cuadrada, etiqueta de tiquetes, nombre y una barra fina; el toque abre el detalle. */
export function PrizeTile({ r, points, onOpen }: { r: StoreReward; points: number; onOpen: () => void }) {
  const goal = useArcade((s) => s.goal === r.id)
  const ok = points >= r.cost
  const { pct, missing } = progressTo(points, r.cost)
  return (
    <button onClick={onOpen} className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white/[0.07] text-left text-white ring-1 active:scale-[0.98] ${goal ? 'ring-[#ffd45c]/80' : ok ? 'ring-[#4de1ff]/60' : 'ring-white/10'}`} aria-label={`Ver el premio: ${r.title}`}>
      <span className="relative block aspect-square w-full overflow-hidden bg-white/5">
        {r.image ? <img src={r.image} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center"><StoreBadge storeId={r.storeId} storeName={r.storeName} size={64} /></span>}
        <span className="absolute top-2 left-2 rounded-full bg-[#ffc83d] px-2 py-0.5 text-[11.5px] font-extrabold text-[#2a1a00] shadow">{r.cost}</span>
        {goal && (
          <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-[#07031a]/80 text-[#ffd45c]" aria-label="Es tu meta">
            <Star className="size-3.5" fill="currentColor" />
          </span>
        )}
        {ok && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#4de1ff] to-[#4de1ff]/0 px-2 pt-5 pb-1.5 text-center text-[11px] font-black text-[#04202b]">¡Te alcanza!</span>}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="flex items-center gap-1.5">
          <span className="shrink-0 scale-[0.58] origin-left" style={{ width: 22, height: 22 }}>
            <StoreBadge storeId={r.storeId} storeName={r.storeName} size={38} />
          </span>
          <span className="min-w-0 truncate text-[10.5px] font-bold tracking-wide text-[#4de1ff] uppercase">{r.storeName}</span>
        </span>
        <span className="line-clamp-2 text-[13.5px] leading-snug font-extrabold">{r.title}</span>
        <span className="mt-auto pt-1">
          <Bar pct={pct} />
          <span className="mt-1 block text-[11px] font-bold text-white/70">{ok ? 'Toca para canjear' : `Faltan ${missing}`}</span>
        </span>
      </span>
    </button>
  )
}

/** Propuesta B: tarjeta ancha y compacta para los carriles por precio. */
export function PrizeLane({ r, points, onOpen }: { r: StoreReward; points: number; onOpen: () => void }) {
  const goal = useArcade((s) => s.goal === r.id)
  const ok = points >= r.cost
  const { pct } = progressTo(points, r.cost)
  return (
    <button onClick={onOpen} className={`relative flex w-[150px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white/[0.07] text-left text-white ring-1 active:scale-[0.97] ${goal ? 'ring-[#ffd45c]/80' : ok ? 'ring-[#4de1ff]/60' : 'ring-white/10'}`} aria-label={`Ver el premio: ${r.title}`}>
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-white/5">
        {r.image ? <img src={r.image} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center"><StoreBadge storeId={r.storeId} storeName={r.storeName} size={52} /></span>}
        <span className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold shadow ${ok ? 'bg-[#4de1ff] text-[#04202b]' : 'bg-[#ffc83d] text-[#2a1a00]'}`}>{ok ? '¡Canjéalo!' : `${r.cost}`}</span>
      </span>
      <span className="flex flex-col gap-1 p-2.5">
        <span className="truncate text-[10px] font-bold tracking-wide text-[#4de1ff] uppercase">{r.storeName}</span>
        <span className="line-clamp-2 min-h-[2.4em] text-[12.5px] leading-snug font-extrabold">{r.title}</span>
        <Bar pct={pct} />
      </span>
    </button>
  )
}

/** Propuesta B: «Tu próximo premio», grande, con foto de fondo y barra. Es la meta elegida o, si no hay, el más cercano. */
export function NextPrizeHero({ r, points, isGoal, onOpen }: { r: StoreReward; points: number; isGoal: boolean; onOpen: () => void }) {
  const { pct, missing } = progressTo(points, r.cost)
  return (
    <button onClick={onOpen} className="relative block w-full shrink-0 overflow-hidden rounded-3xl bg-[#1a0f55] text-left text-white ring-1 ring-[#ffd45c]/50 active:scale-[0.99]" aria-label={`${isGoal ? 'Tu meta' : 'Tu próximo premio'}: ${r.title}`}>
      <span className="relative block aspect-[16/10] w-full">
        {r.image ? <img src={r.image} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center bg-white/5"><StoreBadge storeId={r.storeId} storeName={r.storeName} size={84} /></span>}
        <span className="absolute inset-0 bg-gradient-to-t from-[#120a40] via-[#120a40]/30 to-transparent" />
        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-[#07031a]/80 px-2.5 py-1 text-[10.5px] font-extrabold tracking-[0.14em] text-[#ffd45c]">
          <Star className="size-3" fill="currentColor" /> {isGoal ? 'TU META' : 'TU PRÓXIMO PREMIO'}
        </span>
        <span className="absolute top-3 right-3 rounded-full bg-[#ffc83d] px-2.5 py-1 text-[12px] font-extrabold text-[#2a1a00]">{r.cost}</span>
      </span>
      <span className="block px-4 pt-0 pb-4">
        <span className="block text-[11px] font-bold tracking-wide text-[#4de1ff] uppercase">{r.storeName}</span>
        <span className="block text-[19px] leading-tight font-black">{r.title}</span>
        <span className="mt-2.5 block">
          <Bar pct={pct} />
        </span>
        <span className="mt-1.5 block text-[12.5px] font-bold text-[#ffe9a8]">{missing > 0 ? `Te faltan ${missing} tiquetes` : '¡Ya lo puedes canjear!'}</span>
      </span>
    </button>
  )
}
