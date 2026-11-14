import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Sheet } from '../ui/Sheet'

// Las dos hojas que reemplazan filas enteras de botones en el celular: «Categorías» (a dónde ir) y «Descubre» (juego y novedades).
// Mostrar poco al llegar y revelar el resto cuando la persona lo pide baja la carga de la primera pantalla.

export interface CategoryItem {
  id: string
  label: string
  Icon: LucideIcon
  color: string
  active?: boolean
  onPick: () => void
}

export function CategoriesSheet({ open, onClose, items }: { open: boolean; onClose: () => void; items: CategoryItem[] }) {
  return (
    <Sheet open={open} onClose={onClose} title="Categorías" mobileHeight="h-auto max-h-[78dvh]" header={<h2 className="px-5 pt-1 pb-3 text-xl font-extrabold tracking-tight">¿Qué buscas hoy?</h2>}>
      <ul className="grid grid-cols-3 gap-2.5 px-4 pb-5">
        {items.map(({ id, label, Icon, color, active, onPick }) => (
          <li key={id}>
            <button
              onClick={() => {
                onPick()
                onClose()
              }}
              aria-pressed={active}
              className={`flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-2xl px-1 py-3 text-[12.5px] leading-tight font-bold transition active:scale-[0.97] ${active ? 'bg-teal/15 ring-2 ring-teal' : 'bg-ink/[0.05]'}`}
            >
              <span className="grid size-11 place-items-center rounded-[14px] text-white" style={{ background: color }}>
                <Icon className="size-6" strokeWidth={1.8} />
              </span>
              {label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

export interface DiscoverRow {
  id: string
  title: string
  detail: string
  Icon: LucideIcon
  color: string
  /** 0..1: barra de avance (opcional). */
  progress?: number
  /** Globito (p. ej. algo nuevo). */
  badge?: number
  onPick: () => void
}

export function DiscoverSheet({ open, onClose, rows, footer }: { open: boolean; onClose: () => void; rows: DiscoverRow[]; footer?: ReactNode }) {
  return (
    <Sheet open={open} onClose={onClose} title="Descubre" mobileHeight="h-auto max-h-[78dvh]" header={<h2 className="px-5 pt-1 pb-3 text-xl font-extrabold tracking-tight">Descubre</h2>}>
      <ul className="flex flex-col gap-2 px-4 pb-5">
        {rows.map(({ id, title, detail, Icon, color, progress, badge, onPick }) => (
          <li key={id}>
            <button
              onClick={() => {
                onPick()
                onClose()
              }}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-ink/[0.05] p-3 text-left transition active:scale-[0.99]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-[14px] text-white" style={{ background: color }}>
                <Icon className="size-[22px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold">{title}</span>
                <span className="block text-[12.5px] text-ink-soft">{detail}</span>
                {progress !== undefined && (
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                    <span className="block h-full rounded-full bg-teal" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
                  </span>
                )}
              </span>
              {badge ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber px-1.5 text-[11px] font-extrabold text-deep">{badge}</span> : <ChevronRight className="size-5 shrink-0 text-ink-soft" />}
            </button>
          </li>
        ))}
        {footer}
      </ul>
    </Sheet>
  )
}
