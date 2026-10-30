import { Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Store } from '../domain/types'
import { formatCOP, formatRemaining } from '../lib/format'
import type { PriceInfo } from '../lib/pricing'
import { useNow } from '../lib/useNow'

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-sm font-semibold text-ink transition hover:bg-sand active:scale-[0.98] disabled:opacity-45',
  ghost: 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft transition hover:bg-ink/5 hover:text-ink',
  icon: 'grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card text-ink transition hover:bg-sand active:scale-95',
}

export const input =
  'w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-brand focus:ring-4 focus:ring-brand/15'

export function Price({ info, size = 'md' }: { info: PriceInfo; size?: 'sm' | 'md' | 'lg' }) {
  const main = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-base'
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`${main} font-extrabold tracking-tight text-ink`}>{formatCOP(info.final)}</span>
      {info.promotion && <span className="text-xs text-ink-soft line-through">{formatCOP(info.original)}</span>}
    </div>
  )
}

export function PromoBadge({ info }: { info: PriceInfo }) {
  if (!info.promotion) return null
  const p = info.promotion
  const tone = p.type === 'flash' ? 'bg-sun text-ink' : p.type === 'secret' ? 'bg-ink text-sun' : 'bg-coral text-white'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      −{p.discountPercent}%{p.type === 'flash' ? ' · relámpago' : p.type === 'secret' ? ' · secreta' : ''}
    </span>
  )
}

export function Countdown({ endsAt, className = '' }: { endsAt: string | null; className?: string }) {
  const now = useNow()
  if (!endsAt) return null
  const ms = Date.parse(endsAt) - now
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums ${className}`} aria-label="Tiempo restante">
      <Timer className="size-3.5" />
      {ms > 0 ? formatRemaining(ms) : 'Finalizada'}
    </span>
  )
}

export function StoreLogo({ store, size = 44 }: { store: Pick<Store, 'logoText' | 'brandColor' | 'logo'>; size?: number }) {
  if (store.logo)
    return (
      <img
        src={store.logo}
        alt=""
        aria-hidden
        className="shrink-0 rounded-2xl bg-white object-contain shadow-soft ring-1 ring-line"
        style={{ width: size, height: size }}
      />
    )
  return (
    <div
      className="grid shrink-0 place-items-center rounded-2xl font-extrabold tracking-tight text-white shadow-soft"
      style={{ width: size, height: size, background: store.brandColor, fontSize: Math.max(9, size / 4.6) }}
      aria-hidden
    >
      {store.logoText}
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-sand-2 text-brand">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <p className="mt-1.5 text-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[15px] font-extrabold tracking-tight">{children}</h2>
      {aside}
    </div>
  )
}

export function Chip({ active, onClick, children, color }: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition active:scale-95 ${
        active ? 'border-transparent bg-ink text-white' : 'border-line bg-card text-ink hover:bg-sand'
      }`}
    >
      {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  )
}
