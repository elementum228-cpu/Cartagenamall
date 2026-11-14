import { CHAINS, type ChainId } from '../state/cine'
import { longDate } from './dates'
import type { GroupPlan } from './types'

const cinemaName = (id: ChainId | null) => (id ? CHAINS.find((c) => c.id === id)?.name ?? '' : '')

/** Mensaje para invitar a un plan: solo película, cine, fecha y hora; nunca teléfonos, ubicación ni datos personales. */
export function inviteText(p: GroupPlan) {
  const when = p.day ? `${longDate(p.day)}${p.time ? ` · ${p.time}` : ''}` : 'fecha por definir'
  const where = p.chain ? `${cinemaName(p.chain)}${p.venue ? ` · ${p.venue}` : ''}` : 'cine por definir'
  return `🍿 ¿Te apuntas al cine? ${p.movieTitle} — ${where} — ${when}. Somos hasta ${p.maxParticipants}. Cada quien compra su entrada en el cine oficial.`
}
