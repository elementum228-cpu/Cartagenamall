import { ExternalLink, MapPin } from 'lucide-react'
import type { CineChain } from '../state/cine'
import { CINEMA_DIRECTORY } from './venues'

/**
 * «Dónde ver cine en Cartagena»: por cadena, el botón a su cartelera y, donde se pudo verificar, cada sala con su dirección y
 * su enlace. Todo abre el sitio oficial en una pestaña nueva: ahí están los horarios y la compra.
 */
export function Directory({ chains }: { chains: CineChain[] }) {
  const visible = CINEMA_DIRECTORY.filter((d) => chains.some((c) => c.id === d.id && c.enabled))
  return (
    <section aria-label="Dónde ver cine en Cartagena" className="mt-1">
      <h3 className="text-[20px] font-black tracking-tight">Cine en Cartagena</h3>
      <p className="mt-0.5 text-[12px] text-white/55">Elige tu cine y mira los horarios de hoy en su sitio oficial.</p>
      {visible.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white/[0.06] p-4 text-center text-sm text-white/70">Por ahora no hay cines disponibles.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((d) => (
            <li key={d.id} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
              <p className="flex items-center gap-2 text-[16px] font-extrabold">
                <span className="size-3 rounded-full" style={{ background: d.color }} /> {d.name}
              </p>
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[14px] font-extrabold text-white transition active:scale-95" style={{ background: `color-mix(in srgb, ${d.color} 75%, #000)` }}>
                Ver horarios en {d.name} <ExternalLink className="size-4 opacity-80" aria-hidden />
              </a>
              {d.venues.length > 0 && (
                <ul className="mt-3 space-y-1.5" aria-label={`Salas de ${d.name} en Cartagena`}>
                  {d.venues.map((v) => (
                    <li key={v.name}>
                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl bg-white/[0.05] px-3 py-2.5 transition active:scale-[0.98]">
                        <MapPin className="size-4 shrink-0 opacity-70" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-bold">{v.name}</span>
                          <span className="block text-[12px] text-white/55">{v.address}</span>
                        </span>
                        <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-center text-[11px] text-white/45">Se abre el sitio oficial del cine en una pestaña nueva. Horarios sujetos a cambios: verifica la compra allá.</p>
    </section>
  )
}
