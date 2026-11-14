import { Award, Check, Lock } from 'lucide-react'
import { CHALLENGES, progressOf, useCineSocial } from '../state/cineSocial'
import { SectionHead } from './ui'

/** Pasaporte de cine: retos con avance real (se cuentan acciones hechas en este dispositivo). Las insignias no dan descuentos. */
export function Challenges() {
  const s = useCineSocial()
  const doneCount = CHALLENGES.filter((c) => s.done[c.id]).length
  return (
    <section aria-label="Pasaporte de cine" className="space-y-3">
      <SectionHead title="Pasaporte de cine" sub={`${doneCount} de ${CHALLENGES.filter((c) => c.available).length} retos completados.`} />
      <ul className="space-y-2">
        {CHALLENGES.map((c) => {
          const p = Math.min(c.goal, progressOf(c.id, s))
          const done = !!s.done[c.id]
          return (
            <li key={c.id} className={`flex items-center gap-3 rounded-2xl p-3.5 ring-1 ${done ? 'bg-[#F4CD79]/12 ring-[#F4CD79]/40' : 'bg-white/[0.06] ring-white/10'} ${c.available ? '' : 'opacity-60'}`}>
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${done ? 'bg-[#F4CD79] text-[#2a1405]' : 'bg-white/10'}`}>{done ? <Check className="size-5" aria-hidden /> : c.available ? <Award className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-extrabold">{c.title}</span>
                <span className="block text-[12.5px] leading-snug text-white/60">{c.detail}</span>
                {c.available && c.goal > 1 && !done && (
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/12" role="progressbar" aria-valuemin={0} aria-valuemax={c.goal} aria-valuenow={p} aria-label={`${c.title}: ${p} de ${c.goal}`}>
                    <span className="block h-full rounded-full bg-[#F4CD79]" style={{ width: `${(p / c.goal) * 100}%` }} />
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[12px] font-extrabold text-white/70">{!c.available ? 'Pronto' : done ? '¡Listo!' : `${p}/${c.goal}`}</span>
            </li>
          )
        })}
      </ul>
      <p className="text-[11.5px] leading-snug text-white/45">Cada reto cuenta una sola vez. Por ahora dan insignias; los beneficios con negocios llegarán cuando haya aliados confirmados.</p>
    </section>
  )
}
