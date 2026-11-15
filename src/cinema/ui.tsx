import { Film } from 'lucide-react'
import type { ReactNode } from 'react'

// Piezas compartidas de MallPlay Cinema: paleta, cartel con arte de respaldo, títulos de sección y estados vacíos.

/** Paleta del cine. El turquesa es el de MallPlay (clases `teal`/`brand` del proyecto); el rojo y el dorado son solo del cine. */
export const C = { night: '#081827', night2: '#10283F', velvet: '#7C1429', gold: '#F4CD79', cream: '#F7F4EF' } as const

/** Arte por defecto de un cartel sin imagen. */
export function PosterArt({ title, hue = 0 }: { title?: string; hue?: number }) {
  const bg = [`linear-gradient(160deg,#7a4bd6,${C.night})`, `linear-gradient(160deg,#1f9d8f,${C.night})`, `linear-gradient(160deg,${C.velvet},${C.night})`, `linear-gradient(160deg,#c9a24b,${C.night})`][hue % 4]
  return (
    <div className="grid size-full place-items-center p-2 text-center text-white" style={{ background: bg }}>
      <div>
        <Film className="mx-auto size-8 opacity-80" aria-hidden />
        <p className="mt-2 text-[10.5px] leading-tight font-extrabold [overflow-wrap:anywhere]">{title || 'PRÓXIMO ESTRENO'}</p>
      </div>
    </div>
  )
}

/**
 * Imagen de película dentro de una caja con proporción fija (sin saltos al cargar). Carga diferida, salvo la primera de la pantalla
 * (`priority`), que se pide de inmediato.
 */
export function Picture({ src, title, hue, priority = false, className = '' }: { src: string | null | undefined; title?: string; hue?: number; priority?: boolean; className?: string }) {
  return src ? (
    <img src={src} alt="" className={`size-full object-cover ${className}`} loading={priority ? 'eager' : 'lazy'} decoding="async" {...(priority ? { fetchPriority: 'high' as const } : {})} draggable={false} />
  ) : (
    <PosterArt title={title} hue={hue} />
  )
}

export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[20px] leading-tight font-black tracking-tight text-[#F7F4EF]">{title}</h3>
        {sub && <p className="mt-0.5 text-[13px] leading-snug text-white/60">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

/** Estado vacío o de aviso: siempre dice qué pasa y, si se puede, qué hacer. */
export function Notice({ icon, title, text, children, tone = 'plain' }: { icon?: ReactNode; title: string; text?: string; children?: ReactNode; tone?: 'plain' | 'soon' | 'warn' }) {
  const ring = tone === 'warn' ? 'ring-amber-300/30 bg-amber-300/10' : tone === 'soon' ? 'ring-white/10 bg-white/[0.05]' : 'ring-white/10 bg-white/[0.06]'
  return (
    <div className={`rounded-2xl p-4 ring-1 ${ring}`}>
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-[#F4CD79]">{icon}</span>}
        <div className="min-w-0">
          <p className="text-[15px] leading-snug font-extrabold">{title}</p>
          {text && <p className="mt-1 text-[13px] leading-snug text-white/70">{text}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Píldora de vidrio («glass»): fondo translúcido con desenfoque, borde de luz, reflejo de espejo arriba y una leve sombra interior.
 * `tint` la tiñe con un color (dorado, rojo…) sin perder la transparencia.
 */
export function GlassPill({ children, tint, className = '', size = 'md' }: { children: ReactNode; tint?: string; className?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full font-semibold tracking-[0.01em] whitespace-nowrap text-white backdrop-blur-xl backdrop-saturate-150 ${size === 'sm' ? 'h-7 px-3 text-[11.5px]' : 'h-8 px-3.5 text-[12.5px]'} ${className}`}
      style={{
        background: `linear-gradient(180deg, rgba(255,255,255,.26), rgba(255,255,255,.07) 55%, rgba(255,255,255,.12))${tint ? `, ${tint}` : ''}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.55), inset 0 -1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.22), 0 6px 18px -8px rgba(0,0,0,.55)',
        textShadow: '0 1px 2px rgba(0,0,0,.35)',
      }}
    >
      {/* reflejo de espejo: franja de luz en la mitad de arriba */}
      <span className="pointer-events-none absolute inset-x-2 top-0 h-1/2 rounded-b-full bg-gradient-to-b from-white/35 to-transparent opacity-70" aria-hidden />
      <span className="relative flex items-center gap-1.5">{children}</span>
    </span>
  )
}

/** Etiquetas de estado de una película: píldoras de vidrio, cada una con su tinte. */
export function StatusTag({ kind }: { kind: 'new' | 'now' | 'soon' | 'demo' }) {
  const map = {
    new: { text: 'Estreno', tint: 'rgba(244,205,121,.38)', dot: '#F4CD79' },
    now: { text: 'En cartelera', tint: undefined, dot: '#7CF2C4' },
    soon: { text: 'Próximamente', tint: 'rgba(214,60,90,.34)', dot: '#FF8FA6' },
    demo: { text: 'Ejemplo', tint: 'rgba(252,211,77,.3)', dot: '#FCD34D' },
  }[kind]
  return (
    <GlassPill size="sm" tint={map.tint}>
      <span className="size-1.5 rounded-full" style={{ background: map.dot, boxShadow: `0 0 8px ${map.dot}` }} aria-hidden />
      {map.text}
    </GlassPill>
  )
}

export { longDate, shortDate } from './dates'
