import { CHAINS, type CineChain } from '../state/cine'
import { ChainCard } from './ChainCard'
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
            <li key={d.id}>
              <ChainCard id={d.id} name={d.name} color={d.color} tagline={CHAINS.find((c) => c.id === d.id)?.tagline ?? ''} logo={d.logo} href={d.url} hint="Se abre el sitio oficial del cine." venues={d.venues}>
                <p className="text-[13.5px] text-white/70">Mira los horarios de hoy y compra tu entrada en el sitio oficial.</p>
              </ChainCard>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-center text-[11px] text-white/45">Se abre el sitio oficial del cine en una pestaña nueva. Horarios sujetos a cambios: verifica la compra allá.</p>
    </section>
  )
}
