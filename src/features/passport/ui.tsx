import { Gem, Map as MapIcon, Plane, Scissors, Search, Ship, Shirt, Smartphone, Sparkles, Trophy, Utensils, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { PASSPORT_STAMPS } from '../../state/passport'

/** Ícono de cada sello del pasaporte. */
export const STAMP_ICON: Record<string, LucideIcon> = { A: Shirt, B: Smartphone, C: Sparkles, D: Gem, E: Utensils, F: Scissors, ISLA: Plane, CANCHA: Trophy, BARCO: Ship, GEMA: Search, TESORO: MapIcon }

export const stampInfo = (id: string) => PASSPORT_STAMPS.find((s) => s.id === id)

/** Sello circular: entintado (ganado) o punteado (por ganar). Al ganarse cae con un golpe. */
export function StampSeal({ id, earned, size = 76, fresh = false }: { id: string; earned: boolean; size?: number; fresh?: boolean }) {
  const info = stampInfo(id)
  const Icon = STAMP_ICON[id] ?? Sparkles
  const color = info?.color ?? '#008d87'
  // rotación fija por sello: se ven estampados a mano, no alineados
  const tilt = ((id.charCodeAt(0) * 37) % 17) - 8
  if (!earned)
    return (
      <span className="grid place-items-center rounded-full border-2 border-dashed border-ink/15 text-ink/20" style={{ width: size, height: size }} aria-hidden>
        <Icon style={{ width: size * 0.36, height: size * 0.36 }} strokeWidth={1.6} />
      </span>
    )
  return (
    <motion.span
      className="relative grid place-items-center rounded-full"
      style={{ width: size, height: size, color, boxShadow: `inset 0 0 0 ${size * 0.04}px ${color}, inset 0 0 0 ${size * 0.075}px #fff0, inset 0 0 0 ${size * 0.09}px ${color}55` }}
      initial={fresh ? { scale: 1.8, opacity: 0, rotate: tilt - 20 } : false}
      animate={{ scale: 1, opacity: 1, rotate: tilt }}
      transition={{ type: 'spring', stiffness: 520, damping: 18 }}
      aria-hidden
    >
      <span className="absolute inset-[14%] rounded-full opacity-[0.12]" style={{ background: color }} />
      <Icon className="relative" style={{ width: size * 0.4, height: size * 0.4 }} strokeWidth={2} />
    </motion.span>
  )
}

/** Fila de casillas de una tarjeta de sellos de tienda. */
export function StampDots({ have, need, color }: { have: number; need: number; color: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`${Math.min(have, need)} de ${need} sellos`}>
      {Array.from({ length: need }, (_, i) => (
        <motion.span
          key={i}
          className="grid size-7 place-items-center rounded-full border-2"
          style={i < have ? { background: color, borderColor: color } : { borderColor: `${color}40`, borderStyle: 'dashed' }}
          initial={false}
          animate={{ scale: i < have ? [1.25, 1] : 1 }}
          transition={{ duration: 0.3 }}
        >
          {i < have && <span className="size-2 rounded-full bg-white/90" />}
        </motion.span>
      ))}
    </div>
  )
}
