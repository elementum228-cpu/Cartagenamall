import { Check, ChevronRight, Circle } from 'lucide-react'
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

/** Logo de WhatsApp (el globo con el teléfono), en blanco: se dibuja aquí porque la librería de iconos no lo trae. */
export function WhatsAppLogo({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden>
      <path d="M16.03 3C8.84 3 3 8.83 3 16c0 2.3.6 4.54 1.74 6.52L3 29l6.65-1.7A13 13 0 0 0 16.03 29C23.2 29 29 23.17 29 16S23.2 3 16.03 3Zm0 23.7c-1.95 0-3.86-.53-5.53-1.52l-.4-.24-3.95 1.01 1.05-3.84-.26-.4A10.64 10.64 0 0 1 5.3 16c0-5.9 4.82-10.7 10.73-10.7S26.7 10.1 26.7 16s-4.8 10.7-10.67 10.7Zm5.9-8c-.32-.16-1.9-.94-2.2-1.05-.3-.1-.5-.16-.72.16-.22.32-.84 1.05-1.03 1.26-.19.22-.38.24-.7.08-.32-.16-1.36-.5-2.6-1.6a9.8 9.8 0 0 1-1.8-2.24c-.19-.32-.02-.5.14-.66.15-.14.32-.38.48-.57.16-.19.22-.32.32-.54.1-.22.05-.4-.03-.57-.08-.16-.72-1.74-.99-2.38-.26-.62-.52-.54-.72-.55h-.62c-.22 0-.57.08-.87.4-.3.32-1.14 1.1-1.14 2.7s1.17 3.13 1.33 3.35c.16.22 2.3 3.5 5.56 4.92.78.34 1.38.54 1.85.69.78.25 1.49.21 2.05.13.63-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.3-.22-.62-.38Z" />
    </svg>
  )
}

/** «¿Necesitas ayuda?»: botón verde de WhatsApp que abre el chat con el equipo de MallPlay con el nombre del local ya escrito. Sin número configurado no se muestra. */
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
      className="mt-6 flex min-h-[68px] items-center gap-3.5 rounded-[22px] bg-[#25D366] p-3.5 text-white shadow-[0_14px_26px_-14px_rgba(18,140,70,0.8)] transition active:scale-[0.98]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30">
        <WhatsAppLogo className="size-7" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[16px] font-extrabold tracking-[-0.01em]">Servicio al cliente</span>
        <span className="block text-[13px] font-medium text-white/90">Escríbenos por WhatsApp: te ayudamos con tu local</span>
      </span>
      <span className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-extrabold text-[#128c4a]">Chatear</span>
    </a>
  )
}
