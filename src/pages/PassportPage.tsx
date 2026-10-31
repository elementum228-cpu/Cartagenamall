import { AnimatePresence, motion } from 'motion/react'
import { Check, Gift, Map as MapIcon, Ticket, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StampDots, StampSeal } from '../features/passport/ui'
import { formatDateTime } from '../lib/format'
import { useMinute } from '../lib/useMinute'
import { HUNT_LENGTH, huntEndsAt, huntFor, huntWeek } from '../promotions/hunt'
import { useCatalog } from '../state/catalog'
import { PASSPORT_PRIZE, PASSPORT_STAMPS, huntProgress, loyaltyOf, usePassport, type Redemption } from '../state/passport'
import { usePersonal } from '../state/personal'
import { useUI } from '../state/ui'
import { StoreLogo } from '../ui/bits'

const SPRING = { type: 'spring', stiffness: 360, damping: 32 } as const

/** Pasaporte del mall: sellos por recorrerlo, búsqueda del tesoro y tarjetas de sellos de las tiendas. */
export function PassportPage() {
  const stamps = usePassport((s) => s.stamps)
  const done = PASSPORT_STAMPS.filter((p) => stamps[p.id]).length
  const complete = done === PASSPORT_STAMPS.length
  const prize = usePassport((s) => s.passportPrize)
  const [shown, setShown] = useState<Redemption | null>(null)

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-28 md:pb-10">
      {/* la libreta */}
      <motion.section
        className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-deep via-[#0a3d58] to-teal p-5 text-white shadow-float"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[11px] font-bold tracking-[0.18em] text-white/70 uppercase">Pasaporte · Cartagena Mall</p>
        <h1 className="mt-1 text-[26px] leading-tight font-bold tracking-[-0.02em]">Recorre el mall, gana sellos</h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
            <motion.div className="h-full rounded-full bg-amber" initial={{ width: 0 }} animate={{ width: `${(done / PASSPORT_STAMPS.length) * 100}%` }} transition={{ ...SPRING, delay: 0.15 }} />
          </div>
          <span className="text-[13px] font-semibold tabular-nums">
            {done}/{PASSPORT_STAMPS.length}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12.5px] text-white/80">
          <Gift className="size-4 shrink-0 text-amber" /> Premio al completarlo: {PASSPORT_PRIZE}
        </div>
      </motion.section>

      <section className="glass-strong rounded-[28px] p-4">
        <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
          {PASSPORT_STAMPS.map((p, i) => (
            <motion.li key={p.id} className="flex flex-col items-center text-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.05 + i * 0.03 }}>
              <StampSeal id={p.id} earned={!!stamps[p.id]} size={64} />
              <span className="mt-1.5 text-[11.5px] leading-tight font-semibold">{p.name}</span>
              <span className="text-[10.5px] leading-tight text-ink-soft">{stamps[p.id] ? 'Sellado' : p.hint}</span>
            </motion.li>
          ))}
        </ul>
        {complete && (
          <button
            className="glass-teal mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold"
            onClick={() => setShown(prize ?? usePassport.getState().claimPassportPrize())}
          >
            <Gift className="size-5" /> {prize ? 'Ver el código de tu premio' : '¡Pasaporte completo! Reclama tu premio'}
          </button>
        )}
      </section>

      <TreasureHunt />
      <StoreCards onShow={setShown} />
      <History />

      <CodeSheet redemption={shown} onClose={() => setShown(null)} />
    </div>
  )
}

function TreasureHunt() {
  const now = useMinute()
  const week = huntWeek(now)
  const found = usePassport((s) => huntProgress(s.hunt, week))
  const steps = huntFor(week)
  const navigate = useNavigate()
  const daysLeft = Math.max(1, Math.ceil((huntEndsAt(week) - now) / 86_400_000))
  const current = steps[found]
  const done = found >= HUNT_LENGTH
  return (
    <section className="glass-strong rounded-[28px] p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-gradient-to-br from-teal-bright to-teal text-white shadow-[var(--shadow-glow)]">
          <MapIcon className="size-6" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold tracking-[-0.01em]">Búsqueda del tesoro</h2>
          <p className="text-[12.5px] text-ink-soft">
            3 pistas encadenadas · cambia en {daysLeft} {daysLeft === 1 ? 'día' : 'días'}
          </p>
        </div>
        <div className="flex gap-1.5" aria-label={`${found} de ${HUNT_LENGTH} pistas`}>
          {Array.from({ length: HUNT_LENGTH }, (_, i) => (
            <span key={i} className={`grid size-6 place-items-center rounded-full ${i < found ? 'bg-teal text-white' : 'border-2 border-dashed border-teal/30'}`}>
              {i < found && <Check className="size-3.5" strokeWidth={3} />}
            </span>
          ))}
        </div>
      </div>
      {done ? (
        <p className="mt-3 rounded-[20px] bg-teal/10 p-3 text-[14px] font-semibold text-teal">¡Tesoro encontrado esta semana! El lunes empieza una búsqueda nueva.</p>
      ) : (
        current && (
          <div className="mt-3 rounded-[20px] bg-ink/[0.04] p-3.5">
            <p className="text-[11px] font-bold tracking-wide text-teal uppercase">
              Pista {found + 1}
              {current.floorId === 'P2' ? ' · Piso 2' : ''}
            </p>
            <p className="mt-0.5 text-[15px] leading-snug font-semibold">{current.clue}</p>
            <p className="mt-1.5 text-[12px] text-ink-soft">Acércate con zoom: verás destellos turquesa y una gema turquesa que puedes tocar.</p>
            <button
              className="glass-teal mt-3 h-11 w-full rounded-full text-[14px] font-semibold"
              onClick={() => {
                navigate('/')
                useUI.getState().enterMall()
              }}
            >
              Ir a buscar
            </button>
          </div>
        )
      )}
    </section>
  )
}

function StoreCards({ onShow }: { onShow: (r: Redemption) => void }) {
  const stores = useCatalog((s) => s.stores)
  const cards = usePassport((s) => s.cards)
  const favorites = usePersonal((s) => s.favoriteStores)
  const sorted = useMemo(
    () =>
      stores
        .filter((s) => s.status === 'open' && loyaltyOf(s).active)
        .sort((a, b) => (cards[b.id] ?? 0) - (cards[a.id] ?? 0) || Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) || a.name.localeCompare(b.name)),
    [stores, cards, favorites],
  )
  return (
    <section className="space-y-2.5">
      <div className="px-1">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">Tarjetas de sellos</h2>
        <p className="text-[12.5px] text-ink-soft">Cada compra en una tienda te da un sello en su tarjeta. Llénala y canjea su premio.</p>
      </div>
      <ul className="space-y-2.5">
        {sorted.map((store, i) => {
          const l = loyaltyOf(store)
          const have = cards[store.id] ?? 0
          const full = have >= l.stamps
          return (
            <motion.li
              key={store.id}
              layout
              className={`glass-strong rounded-[24px] p-3.5 ${full ? 'ring-2 ring-amber' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: Math.min(i, 8) * 0.03 }}
            >
              <div className="flex items-center gap-3">
                <StoreLogo store={store} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{store.name}</p>
                  <p className="flex items-center gap-1 truncate text-[12px] text-ink-soft">
                    <Gift className="size-3.5 shrink-0" /> {l.reward}
                  </p>
                </div>
                <span className="text-[13px] font-semibold text-ink-soft tabular-nums">
                  {Math.min(have, l.stamps)}/{l.stamps}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <StampDots have={have} need={l.stamps} color={store.brandColor} />
                {full && (
                  <button
                    className="glass-teal shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold"
                    onClick={() => {
                      const r = usePassport.getState().redeem(store.id, l.stamps, l.reward)
                      if (r) onShow(r)
                    }}
                  >
                    Canjear
                  </button>
                )}
              </div>
            </motion.li>
          )
        })}
      </ul>
    </section>
  )
}

function History() {
  const redemptions = usePassport((s) => s.redemptions)
  const prize = usePassport((s) => s.passportPrize)
  const stores = useCatalog((s) => s.stores)
  const all = [...(prize ? [prize] : []), ...redemptions]
  if (!all.length) return null
  return (
    <section className="glass-strong rounded-[28px] p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-bold">
        <Ticket className="size-4 text-teal" /> Premios canjeados
      </h2>
      <ul className="mt-2 divide-y divide-ink/5">
        {all.map((r) => (
          <li key={r.code} className="flex items-center justify-between gap-3 py-2 text-[13px]">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{r.storeId ? (stores.find((s) => s.id === r.storeId)?.name ?? 'Tienda') : 'Pasaporte completo'}</span>
              <span className="block truncate text-ink-soft">
                {r.reward} · {formatDateTime(r.at)}
              </span>
            </span>
            <span className="shrink-0 font-mono text-[12px] font-bold">{r.code}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Código del premio en grande, para mostrarlo en la tienda. */
function CodeSheet({ redemption, onClose }: { redemption: Redemption | null; onClose: () => void }) {
  const store = useCatalog((s) => s.stores.find((st) => st.id === redemption?.storeId))
  return (
    <AnimatePresence>
      {redemption && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-deep/45 p-4 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Código de tu premio"
            onClick={(e) => e.stopPropagation()}
            className="glass-strong relative w-full max-w-sm rounded-[32px] p-6 text-center"
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          >
            <button onClick={onClose} className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-ink/[0.06] text-ink-soft" aria-label="Cerrar">
              <X className="size-4" />
            </button>
            <Gift className="mx-auto size-10 text-amber" strokeWidth={1.6} />
            <p className="mt-2 text-[12px] font-semibold text-ink-soft">{store ? store.name : 'Premio del pasaporte'}</p>
            <h2 className="text-[20px] leading-tight font-bold tracking-[-0.02em]">{redemption.reward}</h2>
            <p className="mt-4 rounded-[20px] border-2 border-dashed border-teal/40 bg-teal/5 py-4 font-mono text-[28px] font-bold tracking-[0.12em] text-teal">{redemption.code}</p>
            <p className="mt-3 text-[13px] text-ink-soft">{store ? `Muéstrale este código a ${store.name} al pagar.` : 'Muéstralo en la tienda que elijas del mall.'} Queda guardado en tu pasaporte.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
