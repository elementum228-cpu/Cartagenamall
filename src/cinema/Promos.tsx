import { Coffee, Compass, UtensilsCrossed } from 'lucide-react'
import { useMemo } from 'react'
import { useCatalog } from '../state/catalog'
import { useCineUi } from '../state/cineUi'
import { useUI } from '../state/ui'
import { StoreLogo } from '../ui/bits'
import { Notice, SectionHead } from './ui'

/** Zonas y categorías donde comer o tomar algo antes o después de la función. */
const FOOD_CATEGORIES = new Set(['gastronomia', 'comida-local', 'mariscos', 'asados', 'internacional', 'cafe', 'postres', 'comida-diversion'])
const PLANLY = 'STORE-PLANLY'

/** Abre la ficha de un negocio (cierra el cine primero; al volver, el lobby recuerda dónde estabas). */
function openStore(id: string) {
  useCineUi.getState().close()
  useUI.getState().openStore(id)
}

/**
 * «Antes o después de la película»: los negocios reales de MallPlay donde comer o tomar algo, y Planly para armar un plan completo.
 * No se muestran descuentos ni combos que los negocios no hayan activado.
 */
export function AfterBefore({ limit }: { limit?: number }) {
  const stores = useCatalog((s) => s.stores)
  const list = useMemo(() => {
    const food = stores.filter((s) => s.status === 'open' && (s.zoneId === 'E' || FOOD_CATEGORIES.has(s.categoryId)))
    return limit ? food.slice(0, limit) : food
  }, [stores, limit])
  const planly = stores.find((s) => s.id === PLANLY && s.status === 'open')
  return (
    <section aria-label="Antes o después de la película" className="space-y-4">
      <SectionHead title="Tu plan no termina cuando aparecen los créditos" sub="Antes o después de la película: restaurantes, cafés y postres de MallPlay." />
      {list.length === 0 ? (
        <Notice icon={<UtensilsCrossed className="size-4" />} title="Pronto, negocios aliados" text="Aquí aparecerán los restaurantes, cafeterías y postres de MallPlay cuando estén disponibles." />
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2" aria-label="Dónde comer en MallPlay">
          {list.map((s) => (
            <li key={s.id}>
              <button onClick={() => openStore(s.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.07] p-3 text-left ring-1 ring-white/12 transition active:scale-[0.99]">
                <StoreLogo store={s} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-extrabold">{s.name}</span>
                  <span className="block truncate text-[12.5px] text-white/60">{s.tagline}</span>
                </span>
                <Coffee className="size-4 shrink-0 opacity-50" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {planly && (
        <button onClick={() => openStore(planly.id)} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left ring-1 ring-white/15 transition active:scale-[0.99]" style={{ background: 'linear-gradient(135deg, rgba(244,205,121,.18), rgba(124,20,41,.35))' }}>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/12">
            <Compass className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold">¿Quieres una salida completa? Habla con Planly</span>
            <span className="block text-[12.5px] leading-snug text-white/70">Planes a medida en Cartagena. Las reservas se acuerdan con el negocio.</span>
          </span>
        </button>
      )}
      <p className="text-[11.5px] leading-snug text-white/45">Las promociones aparecerán aquí cuando los negocios las activen; MallPlay no inventa descuentos.</p>
    </section>
  )
}
