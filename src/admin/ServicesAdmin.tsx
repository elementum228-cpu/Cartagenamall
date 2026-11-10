import { Building2 } from 'lucide-react'
import { SPACES } from '../config/mall'
import { isServicesSpace, useServicesFeature } from '../state/servicesFeature'
import { useUI } from '../state/ui'
import { useCatalog } from '../state/catalog'

/** Zonas de servicio: la administración enciende o apaga para todos la terraza sobre la joyería con sus locales. */
export function ServicesAdmin() {
  const on = useServicesFeature((s) => s.enabled)
  const setOn = useServicesFeature((s) => s.setEnabled)
  const assignments = useCatalog((s) => s.assignments)
  const spaces = SPACES.filter(isServicesSpace)
  const taken = spaces.filter((s) => assignments[s.id]).length
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-bold">
              <Building2 className="size-4" /> Zona de servicios
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Terraza nueva sobre la joyería: se sube por la escalera del fondo de la joyería y tiene un paseo con locales alrededor de un patio hundido, con una gran escalinata al centro.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={on}
            aria-label="Habilitar la zona de servicios"
            onClick={() => {
              const next = !on
              if (!next) {
                const ui = useUI.getState()
                const sel = ui.selectedSpaceId
                if (sel?.startsWith('P1-S')) ui.selectSpace(null)
              }
              setOn(next)
            }}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-ink/20'}`}
          >
            <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <p className="mt-3 rounded-2xl bg-sand p-3 text-[12px] text-ink-soft">
          {on
            ? `Habilitada para todos. Tiene ${spaces.length} espacios (${taken} ocupados). Al apagarla, el mall vuelve a como estaba: la joyería con su muro cerrado y sin estos espacios.`
            : 'Deshabilitada: nadie ve la terraza ni sus espacios; la joyería queda cerrada al fondo como antes. Los negocios ya asignados se conservan y vuelven al encenderla.'}
        </p>
      </div>
      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="font-bold">Espacios de la zona</p>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          {spaces.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-ink/5">
              <span className="font-bold">{s.label}</span>
              <span className="text-xs text-ink-soft">{assignments[s.id] ? 'Ocupado' : 'Libre'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
