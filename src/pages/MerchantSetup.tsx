import { Check, ChevronRight, Circle, LifeBuoy } from 'lucide-react'
import type { Store } from '../domain/types'
import { SUPPORT_WHATSAPP } from '../config/support'
import { cleanHours } from '../lib/hours'
import { whatsappDigits } from '../lib/restaurant'
import { useUI } from '../state/ui'

export type SetupTab = 'perfil' | 'articulos' | 'promociones'

export interface SetupStep {
  id: string
  label: string
  hint: string
  done: boolean
  tab: SetupTab
}

/** Texto de relleno que deja la aprobación del local: no cuenta como descripción hecha. */
const PLACEHOLDER_DESC = /^Nueva tienda de .*Completa la descripción/

/** Qué le falta a un local para estar listo para recibir clientes. Pura: se prueba sin pantalla. */
export function setupSteps(store: Store, activeProducts: number): SetupStep[] {
  const wa = whatsappDigits(store.whatsapp || '')
  return [
    { id: 'logo', label: 'Sube tu logo', hint: 'Es lo primero que ven tus clientes', done: !!store.logo, tab: 'perfil' },
    { id: 'desc', label: 'Cuenta de qué trata tu local', hint: 'Una frase y una descripción corta', done: store.description.trim().length >= 20 && !PLACEHOLDER_DESC.test(store.description), tab: 'perfil' },
    { id: 'wa', label: 'Confirma tu WhatsApp para pedidos', hint: 'Aquí te llegan los pedidos', done: /^57?3\d{9}$/.test(wa) || /^3\d{9}$/.test(wa), tab: 'perfil' },
    { id: 'items', label: 'Publica al menos 3 productos', hint: 'Con foto y precio se venden más', done: activeProducts >= 3, tab: 'articulos' },
    { id: 'hours', label: 'Pon tu horario de atención', hint: 'Tu local abre y cierra solo', done: !!cleanHours(store.hours), tab: 'perfil' },
    { id: 'open', label: 'Abre tu local', hint: 'Enciende «Abierto» para recibir pedidos', done: store.status === 'open', tab: 'perfil' },
    { id: 'arcade', label: 'Regala un premio en el Arcade', hint: 'Atrae visitas de quienes juegan', done: (store.arcadeRewards?.length ?? 0) > 0, tab: 'promociones' },
  ]
}

/** Tarjeta «Tu local está al X %»: se ve mientras falte algo y desaparece cuando todo está listo. */
export function SetupChecklist({ store, activeProducts, goTab }: { store: Store; activeProducts: number; goTab: (t: SetupTab) => void }) {
  const steps = setupSteps(store, activeProducts)
  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null
  const pct = Math.round((done / steps.length) * 100)
  const next = steps.find((s) => !s.done)!
  return (
    <section className="rounded-3xl border border-teal/25 bg-gradient-to-br from-teal/10 to-white p-4" aria-label="Progreso de tu local">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold">Tu local está al {pct} %</p>
          <p className="text-xs text-ink-soft">Siguiente: {next.label.toLowerCase()}</p>
        </div>
        <span className="font-mono text-sm font-bold text-teal">
          {done}/{steps.length}
        </span>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-white">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => goTab(s.tab)}
              disabled={s.done}
              className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
            >
              <span className={`grid size-6 shrink-0 place-items-center rounded-full ${s.done ? 'bg-teal text-white' : 'border-2 border-ink/20 text-transparent'}`}>
                {s.done ? <Check className="size-3.5" strokeWidth={3} /> : <Circle className="size-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] font-bold ${s.done ? 'text-ink-soft line-through decoration-ink/30' : ''}`}>{s.label}</span>
                {!s.done && <span className="block text-xs text-ink-soft">{s.hint}</span>}
              </span>
              {!s.done && <ChevronRight className="size-4 shrink-0 text-ink-soft" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** «¿Necesitas ayuda?»: abre WhatsApp con el equipo de MallPlay y el nombre del local ya escrito. Sin número configurado no se muestra. */
export function HelpLink({ store }: { store: Store }) {
  const toast = useUI((s) => s.toast)
  if (!SUPPORT_WHATSAPP) return null
  const href = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hola, soy de ${store.name} en MallPlay y necesito ayuda con mi local.`)}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => toast('Abriendo WhatsApp con el equipo de MallPlay…')}
      className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 text-sm font-bold text-teal active:scale-[0.99]"
    >
      <LifeBuoy className="size-5" /> ¿Necesitas ayuda con tu local? Escríbenos
    </a>
  )
}
