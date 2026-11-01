import { Ship } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Store } from '../domain/types'
import { formatCOP } from '../lib/format'
import { discounted } from '../lib/pricing'
import { useNow } from '../lib/useNow'
import { useCatalog } from '../state/catalog'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'
import { SHIP_MAX_DISCOUNT, SHIP_MIN_DISCOUNT, SHIP_SCHEDULE_LABEL, arrivalLabel, isDocked, nextScheduledArrival, useDiscountShip } from './offers'

/** Panel del comerciante: sube (o baja) el descuento especial de su local al barco de los descuentos. */
export function MerchantShipEditor({ store }: { store: Store }) {
  const products = useCatalog((s) => s.products)
  const mine = useMemo(() => products.filter((p) => p.storeId === store.id && p.active), [products, store.id])
  const offer = useDiscountShip((s) => s.offers.find((o) => o.storeId === store.id && !o.demo))
  const arrival = useDiscountShip((s) => s.arrival)
  const setOffer = useDiscountShip((s) => s.setOffer)
  const removeOffer = useDiscountShip((s) => s.removeOffer)
  const toast = useUI((s) => s.toast)
  const now = useNow()
  const [productId, setProductId] = useState(offer?.productId ?? mine[0]?.id ?? '')
  const [pct, setPct] = useState(offer?.discountPercent ?? 30)
  const [units, setUnits] = useState<string>(offer?.units ? String(offer.units) : '')
  const product = mine.find((p) => p.id === productId)
  const docked = isDocked(arrival, now)
  const valid = !!product && pct >= SHIP_MIN_DISCOUNT && pct <= SHIP_MAX_DISCOUNT

  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#16325c]/10 text-[#16325c]" aria-hidden>
          <Ship className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Barco de los descuentos</p>
          <p className="text-xs text-ink-soft">
            Un barco blanco llega al muelle {SHIP_SCHEDULE_LABEL.toLowerCase()} y se queda 30 minutos. Todos reciben el aviso y ven los descuentos que los locales subieron. Uno por local.
          </p>
          <p className="mt-1 text-xs font-semibold text-ink">
            {docked ? 'El barco está en el muelle ahora.' : `Próxima llegada: ${arrivalLabel(nextScheduledArrival(now), now)}.`}{' '}
            {offer ? <span className="text-teal">Tu oferta va a bordo.</span> : 'Aún no subes una oferta.'}
          </p>
        </div>
      </div>
      {mine.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_120px]">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Artículo</span>
            <select className={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
              {mine.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Descuento %</span>
            <input className={input} type="number" min={SHIP_MIN_DISCOUNT} max={SHIP_MAX_DISCOUNT} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-ink-soft">Cupos (opcional)</span>
            <input className={input} type="number" min={1} placeholder="Sin límite" value={units} onChange={(e) => setUnits(e.target.value)} />
          </label>
          {product && (
            <p className="text-xs text-ink-soft sm:col-span-3">
              En el barco: <b className="text-ink">{formatCOP(discounted(product.price, pct))}</b> <span className="line-through">{formatCOP(product.price)}</span> · entre {SHIP_MIN_DISCOUNT} % y {SHIP_MAX_DISCOUNT} %
            </p>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <button
              className={btn.primary}
              disabled={!valid}
              onClick={() => {
                setOffer({ storeId: store.id, productId, discountPercent: Math.round(pct), units: Number(units) > 0 ? Math.round(Number(units)) : null })
                toast(docked ? 'Oferta lista: entra en el próximo viaje del barco.' : 'Tu oferta subió al barco.', 'success')
              }}
            >
              <Ship className="size-4" /> {offer ? 'Actualizar oferta' : 'Subir al barco'}
            </button>
            {offer && (
              <button
                className={btn.secondary}
                onClick={() => {
                  removeOffer(store.id)
                  toast('Bajaste tu oferta del barco.')
                }}
              >
                Bajar del barco
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-soft">Agrega artículos a tu tienda para subir una oferta al barco.</p>
      )}
    </section>
  )
}
