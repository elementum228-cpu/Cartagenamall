import { ArrowUpRight, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ChainId } from '../state/cine'
import { C } from './ui'
import type { Venue } from './venues'

// Tarjeta de una cadena de cine: cada una con el color de su marca, como una entrada. Arriba, el sello de la cadena; una línea de
// perforación con muescas; abajo, funciones (si hay) y el botón al cine oficial. Si se agrega un logo oficial en /public/brands, se
// pasa en `logo` y reemplaza al sello de letras.

const MARK: Record<ChainId, { letters: string; tracking: string }> = {
  'cine-colombia': { letters: 'CC', tracking: '0.02em' },
  'royal-films': { letters: 'RF', tracking: '0.02em' },
  procinal: { letters: 'P', tracking: '0' },
}

export function ChainCard({ id, name, color, tagline, logo, children, href, hint, venues, live }: { id: ChainId; name: string; color: string; tagline: string; logo?: string; children: ReactNode; href: string; hint?: string; venues: Venue[]; live?: boolean }) {
  const dark = `color-mix(in srgb, ${color} 55%, #050d17)`
  const notch = 'absolute top-0 size-5 -translate-y-1/2 rounded-full'
  return (
    <article className="overflow-hidden rounded-[22px] ring-1 ring-white/12" style={{ background: `linear-gradient(135deg, ${dark} 0%, color-mix(in srgb, ${color} 18%, ${C.night}) 55%, ${C.night} 100%)` }} aria-label={name}>
      <header className="flex items-center gap-3.5 p-4 pb-3.5">
        <span className="grid size-[52px] shrink-0 place-items-center overflow-hidden rounded-2xl text-[19px] font-black text-white shadow-[0_6px_16px_-4px_rgba(0,0,0,.6)] ring-1 ring-white/30" style={{ background: logo ? '#fff' : `linear-gradient(145deg, ${color}, ${dark})`, letterSpacing: MARK[id].tracking }} aria-hidden>
          {logo ? <img src={logo} alt="" width={52} height={52} loading="lazy" decoding="async" className="size-full object-contain p-1" /> : MARK[id].letters}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[18px] leading-tight font-black tracking-tight">{name}</h4>
          <p className="mt-0.5 truncate text-[12.5px] text-white/65">{tagline}</p>
        </div>
        {live && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/30 px-2 py-1 text-[10px] font-bold text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" /> En vivo
          </span>
        )}
      </header>

      {/* perforación de la entrada */}
      <div className="relative h-px" aria-hidden>
        <span className="absolute inset-x-5 top-0 border-t border-dashed border-white/25" />
        <span className={`${notch} -left-2.5`} style={{ background: C.night }} />
        <span className={`${notch} -right-2.5`} style={{ background: C.night }} />
      </div>

      <div className="p-4 pt-4">
        {children}
        <a href={href} target="_blank" rel="noopener noreferrer" className="mt-3.5 flex min-h-12 items-center justify-between gap-2 rounded-full bg-white py-2 pr-2 pl-5 text-[14px] font-extrabold text-[#0b1a2b] shadow-[0_8px_20px_-8px_rgba(0,0,0,.6)] transition active:scale-[0.98]">
          Ver en {name}
          <span className="grid size-8 place-items-center rounded-full text-white" style={{ background: color }}>
            <ArrowUpRight className="size-4" aria-hidden />
          </span>
        </a>
        {hint && <p className="mt-2 text-center text-[11.5px] text-white/50">{hint}</p>}
        {venues.length > 0 && (
          <ul className="mt-3.5 divide-y divide-white/10 border-t border-white/10" aria-label={`Sedes de ${name}`}>
            {venues.map((v) => (
              <li key={v.name}>
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5">
                  <MapPin className="size-4 shrink-0" style={{ color: `color-mix(in srgb, ${color} 55%, white)` }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] leading-tight font-bold">{v.name}</span>
                    <span className="block text-[11.5px] text-white/55">{v.address}</span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-white/40" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}
