import { AnimatePresence, motion } from 'motion/react'
import { Anchor, ChevronLeft, ChevronRight, Clock, Info, MapPin, MessageCircle, Palmtree, PartyPopper, Ship, Sailboat, Star, Sunset, Users, Wine, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatCOP } from '../lib/format'
import { useUI } from '../state/ui'
import { BOATS, CATEGORY_LABEL } from '../tourism/config'
import { experiencesFor, trackHarbor, useTourism } from '../tourism/store'
import type { BoatId, Experience, ExperienceCategory } from '../tourism/types'
import { Chip } from '../ui/bits'
import { Sheet } from '../ui/Sheet'

// Ficha del muelle turístico: al tocar una lancha, primero su tarjeta (qué planes ofrece) y con
// «Ver experiencias» la lista de operadores y planes, filtrable por categoría. En celular ocupa como
// máximo el 70 % de la pantalla; en escritorio es un panel lateral que deja el mapa a la vista.

const BOAT_ICON: Record<BoatId, LucideIcon> = { mar: Palmtree, bahia: Sunset, pirata: Ship }
const CATEGORY_ICON: Record<ExperienceCategory, LucideIcon> = { islas: Palmtree, transporte: Anchor, bahia: Sailboat, atardecer: Sunset, romantico: Wine, yates: Sailboat, eventos: PartyPopper }
const STATUS: Record<Experience['status'], { label: string; cls: string }> = {
  available: { label: 'Disponible', cls: 'bg-emerald-100 text-emerald-800' },
  soon: { label: 'Próximamente', cls: 'bg-amber/25 text-[#8a5a12]' },
  soldout: { label: 'Agotado', cls: 'bg-ink/10 text-ink-soft' },
}
const EASE = [0.2, 0.8, 0.2, 1] as const

export function HarborSheet() {
  const harbor = useUI((s) => s.harbor)
  const close = () => {
    if (harbor) trackHarbor({ type: 'close', boat: harbor.boat })
    useUI.getState().openHarbor(null)
  }
  const boat = harbor ? BOATS[harbor.boat] : null
  return (
    <Sheet open={!!harbor} onClose={close} title={boat ? `Muelle turístico: ${boat.title}` : 'Muelle turístico'} mobileHeight={harbor?.view === 'list' ? 'h-[70dvh]' : 'max-h-[70dvh]'} scrim={false} header={boat && <Header boat={harbor!.boat} />}>
      {harbor && (
        <AnimatePresence mode="popLayout" initial={false}>
          {harbor.view === 'card' ? <BoatCard key={`c-${harbor.boat}`} boat={harbor.boat} /> : <ExperienceList key={`l-${harbor.boat}`} boat={harbor.boat} />}
        </AnimatePresence>
      )}
    </Sheet>
  )
}

function Header({ boat }: { boat: BoatId }) {
  const b = BOATS[boat]
  const Icon = BOAT_ICON[boat]
  const view = useUI((s) => s.harbor?.view)
  return (
    <div className="px-5 pt-2 pb-3" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${b.color} 12%, transparent), transparent)` }}>
      <div className="flex items-center gap-3.5 pr-12">
        {view === 'list' ? (
          <button onClick={() => useUI.getState().setHarborView('card')} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink/[0.06] text-ink transition active:scale-95" aria-label="Volver a la lancha">
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-[16px] text-white shadow-soft" style={{ background: `linear-gradient(145deg, ${b.color}, color-mix(in srgb, ${b.color} 70%, #062c42))` }}>
            <Icon className="size-6" strokeWidth={1.8} />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-ink-soft">Muelle turístico</p>
          <h2 className="truncate text-[20px] leading-tight font-bold tracking-[-0.02em]">{b.title}</h2>
          <p className="truncate text-[13px] text-ink-soft">{b.subtitle}</p>
        </div>
      </div>
    </div>
  )
}

const slide = (dir: 1 | -1) => ({
  initial: { opacity: 0, x: dir * 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: dir * -24 },
  transition: { duration: 0.24, ease: EASE },
})

function BoatCard({ boat }: { boat: BoatId }) {
  const b = BOATS[boat]
  const all = useTourism((s) => s.experiences)
  const count = useMemo(() => experiencesFor(all, boat, null).length, [all, boat])
  return (
    <motion.div {...slide(-1)} className="space-y-4 px-5 pt-2 pb-8">
      <p className="text-[15px] leading-relaxed text-ink-soft">{b.description}</p>
      <ul className="flex flex-wrap gap-1.5">
        {b.categories.map((c) => {
          const Icon = CATEGORY_ICON[c]
          return (
            <li key={c} className="flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1.5 text-[13px] font-semibold">
              <Icon className="size-4" style={{ color: b.color }} strokeWidth={1.9} /> {CATEGORY_LABEL[c]}
            </li>
          )
        })}
      </ul>
      <button
        onClick={() => {
          useUI.getState().setHarborView('list')
          trackHarbor({ type: 'experiences_view', boat, category: null })
        }}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold text-white shadow-soft transition duration-200 active:scale-[0.98]"
        style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${b.color} 88%, white), ${b.color})`, boxShadow: `0 10px 26px -10px ${b.color}` }}
      >
        Ver experiencias <ChevronRight className="size-5" />
      </button>
      <p className="text-center text-[12px] text-ink-soft">{count} planes de operadores de Cartagena</p>
    </motion.div>
  )
}

function ExperienceList({ boat }: { boat: BoatId }) {
  const b = BOATS[boat]
  const all = useTourism((s) => s.experiences)
  const [category, setCategory] = useState<ExperienceCategory | null>(null)
  const list = useMemo(() => experiencesFor(all, boat, category), [all, boat, category])
  const placeholder = list.some((e) => e.placeholder)
  useEffect(() => {
    if (category) trackHarbor({ type: 'experiences_view', boat, category })
  }, [boat, category])
  return (
    <motion.div {...slide(1)} className="space-y-3 pt-1 pb-8">
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-5 pb-1" role="tablist" aria-label="Tipo de experiencia">
        <Chip active={!category} onClick={() => setCategory(null)}>
          Todas
        </Chip>
        {b.categories.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>
      {placeholder && (
        <p className="mx-5 flex items-start gap-2 rounded-2xl bg-amber/15 px-3 py-2.5 text-[12.5px] text-[#7a5210]">
          <Info className="mt-0.5 size-4 shrink-0" /> Datos de ejemplo: aún no hay operadores cargados. Precios y reservas por confirmar.
        </p>
      )}
      <ul className="space-y-3 px-5">
        {list.map((e, i) => (
          <motion.li key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE, delay: Math.min(i, 6) * 0.03 }}>
            <ExperienceCard exp={e} boat={boat} color={b.color} />
          </motion.li>
        ))}
        {!list.length && <li className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-ink-soft">Pronto habrá planes en esta categoría.</li>}
      </ul>
    </motion.div>
  )
}

function ExperienceCard({ exp, boat, color }: { exp: Experience; boat: BoatId; color: string }) {
  const Icon = CATEGORY_ICON[exp.category]
  const status = STATUS[exp.status]
  const wa = exp.contact.whatsapp?.replace(/\D/g, '')
  const action = exp.status === 'soldout' ? null : exp.contact.bookingUrl ? ('booking' as const) : wa ? ('whatsapp' as const) : null
  const href = action === 'booking' ? exp.contact.bookingUrl : action === 'whatsapp' ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hola, vi «${exp.title}» en Cartagena Mall y quiero más información.`)}` : undefined
  return (
    <article className="overflow-hidden rounded-[22px] border border-line bg-card">
      <div className="flex gap-3 p-3">
        {exp.image ? (
          <img src={exp.image} alt="" className="size-20 shrink-0 rounded-2xl object-cover" loading="lazy" />
        ) : (
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl text-white" style={{ background: `linear-gradient(145deg, color-mix(in srgb, ${color} 85%, white), color-mix(in srgb, ${color} 70%, #062c42))` }} aria-hidden>
            <Icon className="size-8" strokeWidth={1.6} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11.5px] font-semibold text-ink-soft">
              {CATEGORY_LABEL[exp.category]}
              {exp.placeholder && <span className="ml-1.5 rounded bg-sand-2 px-1.5 py-0.5 text-[10px] font-bold">EJEMPLO</span>}
            </p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${status.cls}`}>{status.label}</span>
          </div>
          <h3 className="mt-0.5 text-[15px] leading-snug font-bold">{exp.title}</h3>
          <p className="truncate text-[12.5px] text-ink-soft">{exp.businessName}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-ink-soft">
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {exp.destination}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> {exp.duration}
            </span>
            {exp.capacity !== null && (
              <span className="flex items-center gap-1">
                <Users className="size-3.5" /> Hasta {exp.capacity}
              </span>
            )}
            {exp.rating !== null && (
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-amber text-amber" /> {exp.rating.toFixed(1)}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line/70 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[12px] text-ink-soft">{exp.schedules.join(' · ')}</p>
          <p className="text-[14px] font-bold">{exp.priceFrom !== null ? `Desde ${formatCOP(exp.priceFrom)}` : 'Precio por confirmar'}</p>
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackHarbor({ type: 'experience_cta', boat, experienceId: exp.id, action: action! })}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-white transition active:scale-[0.97]"
            style={{ background: color }}
          >
            {action === 'whatsapp' ? <MessageCircle className="size-4" /> : null}
            {action === 'whatsapp' ? 'Escribir' : 'Reservar'}
          </a>
        ) : (
          <span className="flex h-11 shrink-0 items-center rounded-full bg-ink/[0.06] px-4 text-[13px] font-semibold text-ink-soft">{exp.status === 'soldout' ? 'Agotado' : 'Reserva pronto'}</span>
        )}
      </div>
    </article>
  )
}
