import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { ChevronRight, ChevronUp, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Store } from '../domain/types'
import { storeCategoryName } from '../lib/storeCategories'
import { Sheet } from '../ui/Sheet'
import { StoreLogo } from '../ui/bits'

// Las dos hojas que reemplazan filas enteras de botones en el celular: «Categorías» (a dónde ir) y «Descubre» (juego y novedades).
// Mostrar poco al llegar y revelar el resto cuando la persona lo pide baja la carga de la primera pantalla.

export interface CategoryStore {
  store: Store
  spaceId: string
}
export interface CategoryItem {
  id: string
  label: string
  Icon: LucideIcon
  color: string
  active?: boolean
  /** Línea bajo el nombre cuando no hay locales que contar (p. ej. «Fútbol 5 y pádel»). */
  hint?: string
  /** Locales de la categoría (para mostrar algunos al expandir la hoja). */
  stores?: CategoryStore[]
  onPick: () => void
}

const COLLAPSED = '64dvh'
const EXPANDED = '92dvh'

/**
 * Hoja de categorías que crece hacia arriba: cerrada a ~2/3 de la pantalla muestra las categorías y cuántos locales tiene cada una;
 * al deslizar hacia arriba (o tocar la manija) se expande y enseña los locales de cada categoría para entrar a uno directo.
 */
export function CategoriesSheet({ open, onClose, items, onStore }: { open: boolean; onClose: () => void; items: CategoryItem[]; onStore: (c: CategoryStore) => void }) {
  const [expanded, setExpanded] = useState(false)
  const drag = useDragControls()
  useEffect(() => {
    if (open) setExpanded(false)
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  const withStores = items.filter((i) => i.stores && i.stores.length > 0)
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[48] bg-deep/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Categorías"
            className="fixed inset-x-0 bottom-0 z-[49] flex flex-col overflow-hidden rounded-t-[32px] bg-[#fffefc]"
            style={{ boxShadow: '0 -12px 40px -16px rgb(6 44 66 / 0.35)' }}
            initial={{ y: '100%', height: COLLAPSED }}
            animate={{ y: 0, height: expanded ? EXPANDED : COLLAPSED }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.15, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -50 || info.velocity.y < -450) setExpanded(true)
              else if (info.offset.y > 90 || info.velocity.y > 600) (expanded ? setExpanded(false) : onClose())
            }}
          >
            <div className="shrink-0 touch-none" onPointerDown={(e) => drag.start(e)}>
              <button onClick={() => setExpanded((v) => !v)} aria-label={expanded ? 'Reducir' : 'Ver más locales'} aria-expanded={expanded} className="mx-auto flex h-7 w-24 items-center justify-center">
                <span className="h-1.5 w-11 rounded-full bg-ink/15" />
              </button>
              <div className="flex items-center justify-between px-5 pb-3">
                <h2 className="text-xl font-extrabold tracking-tight">¿Qué buscas hoy?</h2>
                <button onClick={onClose} aria-label="Cerrar" className="grid size-11 place-items-center rounded-full bg-ink/[0.06] text-ink transition active:scale-95" onPointerDown={(e) => e.stopPropagation()}>
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe">
              <ul className="grid grid-cols-3 gap-2.5 px-4 pb-4">
                {items.map(({ id, label, Icon, color, active, hint, stores, onPick }) => (
                  <li key={id}>
                    <button
                      onClick={() => {
                        onPick()
                        onClose()
                      }}
                      aria-pressed={active}
                      className={`flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-3 text-center transition active:scale-[0.97] ${active ? 'bg-teal/15 ring-2 ring-teal' : 'bg-ink/[0.05]'}`}
                    >
                      <span className="grid size-11 place-items-center rounded-[14px] text-white" style={{ background: color }}>
                        <Icon className="size-6" strokeWidth={1.8} />
                      </span>
                      <span className="text-[12.5px] leading-tight font-bold">{label}</span>
                      <span className="text-[11px] leading-none text-ink-soft">{stores && stores.length ? `${stores.length} ${stores.length === 1 ? 'local' : 'locales'}` : (hint ?? 'Espacios libres')}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {withStores.length > 0 && (
                <div className="border-t border-line/70 pt-3 pb-6">
                  <button onClick={() => setExpanded(true)} className={`mx-5 mb-2 flex items-center gap-1.5 text-[12px] font-extrabold tracking-wide text-ink-soft uppercase ${expanded ? 'pointer-events-none' : ''}`}>
                    Locales destacados {!expanded && <ChevronUp className="size-4" />}
                  </button>
                  {withStores.map((it) => (
                    <section key={it.id} className="mb-3">
                      <h3 className="flex items-center gap-2 px-5 pb-1.5 text-[14px] font-extrabold">
                        <span className="size-2.5 rounded-full" style={{ background: it.color }} />
                        {it.label}
                      </h3>
                      <ul className="scrollbar-none flex gap-2.5 overflow-x-auto px-4 pb-1">
                        {it.stores!.map((c) => (
                          <li key={c.store.id} className="shrink-0">
                            <button
                              onClick={() => {
                                onStore(c)
                                onClose()
                              }}
                              className="flex w-[148px] items-center gap-2.5 rounded-2xl bg-ink/[0.05] p-2.5 text-left transition active:scale-[0.97]"
                            >
                              <StoreLogo store={c.store} size={40} />
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] leading-tight font-bold">{c.store.name}</span>
                                <span className="block truncate text-[11px] text-ink-soft">{c.store.tagline || storeCategoryName(c.store)}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
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
