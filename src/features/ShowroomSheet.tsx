import { motion } from 'motion/react'
import { BarChart3, Bot, ChevronRight, Code2, Hotel, Map as MapIcon, Palmtree, Sailboat, ShoppingCart, Users, type LucideIcon } from 'lucide-react'
import { SHOWROOMS, type ShowroomService } from '../district/showrooms'
import { useUI } from '../state/ui'
import { useCatalog } from '../state/catalog'
import { openWhatsApp, whatsappLink, whatsappDigits } from '../lib/restaurant'
import { Sheet } from '../ui/Sheet'

// Ficha de una vitrina de la zona de servicios (Planly, GrowDesk): qué hace la marca, sus servicios
// y cómo contactarla. Planly además lleva a los planes del muelle turístico.

const ICON: Record<ShowroomService['icon'], LucideIcon> = { map: MapIcon, palm: Palmtree, hotel: Hotel, users: Users, code: Code2, cart: ShoppingCart, bot: Bot, chart: BarChart3 }

export function ShowroomSheet() {
  const id = useUI((s) => s.showroom)
  const room = id ? SHOWROOMS[id] : null
  const store = useCatalog((c) => c.stores.find((x) => x.id === (id === 'planly' ? 'STORE-PLANLY' : 'STORE-GROWDESK')))
  const hasWa = !!store && !!whatsappDigits(store.whatsapp ?? '')
  const close = () => useUI.getState().openShowroom(null)
  return (
    <Sheet
      open={!!room}
      onClose={close}
      title={room ? `${room.name}: ${room.kind}` : 'Vitrina'}
      header={
        room && (
          <div className="px-5 pt-2 pb-3" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${room.color} 12%, transparent), transparent)` }}>
            <div className="flex items-center gap-3.5 pr-12">
              <span className="grid size-14 shrink-0 place-items-center rounded-[18px] text-[22px] font-black text-white shadow-soft" style={{ background: `linear-gradient(145deg, ${room.color}, color-mix(in srgb, ${room.color} 65%, #062c42))` }}>
                {room.name[0]}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-ink-soft">
                  {room.kind} · Zona Soporte
                </p>
                <h2 className="truncate text-[22px] leading-tight font-bold tracking-[-0.02em]">{room.name}</h2>
                <p className="truncate text-[13px] text-ink-soft">{room.tagline}</p>
              </div>
            </div>
          </div>
        )
      }
    >
      {room && (
        <div className="space-y-5 px-5 pt-2 pb-8">
          <p className="text-[15px] leading-relaxed text-ink-soft">{room.description}</p>
          <section>
            <h3 className="mb-2 text-[13px] font-bold tracking-wide text-ink-soft uppercase">Servicios</h3>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {room.services.map((s, i) => {
                const Icon = ICON[s.icon]
                return (
                  <motion.li
                    key={s.title}
                    className="flex gap-3 rounded-[20px] border border-line bg-card p-3"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1], delay: i * 0.04 }}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${room.color} 14%, transparent)`, color: room.color }}>
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-semibold">{s.title}</span>
                      <span className="block text-[13px] leading-snug text-ink-soft">{s.body}</span>
                    </span>
                  </motion.li>
                )
              })}
            </ul>
          </section>
          <div className="space-y-2">
            {room.ctaHref ? (
              <a
                href={room.ctaHref}
                target="_blank"
                rel="noreferrer"
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold text-white shadow-soft transition active:scale-[0.98]"
                style={{ background: room.color }}
              >
                {room.ctaLabel} <ChevronRight className="size-5" />
              </a>
            ) : hasWa ? (
              <button
                onClick={() => openWhatsApp(whatsappLink(store!.whatsapp, `Hola ${store!.name}, vengo de Cartagena Mall 👋 ${room.ctaLabel}.`))}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold text-white shadow-soft transition active:scale-[0.98]"
                style={{ background: room.color }}
              >
                {room.ctaLabel} <ChevronRight className="size-5" />
              </button>
            ) : (
              <p className="flex h-[52px] w-full items-center justify-center rounded-full bg-ink/[0.06] text-[15px] font-semibold text-ink-soft">{room.ctaLabel}: contacto próximamente</p>
            )}
            {store && (
              <button
                onClick={() => useUI.getState().openStore(store.id)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-card text-[15px] font-semibold transition active:scale-[0.98]"
              >
                Ver servicios y precios
              </button>
            )}
            {room.id === 'planly' && (
              <button
                onClick={() => useUI.getState().openHarbor('mar')}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-card text-[15px] font-semibold transition active:scale-[0.98]"
              >
                <Sailboat className="size-5 text-teal" /> Ver planes en el muelle turístico
              </button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
