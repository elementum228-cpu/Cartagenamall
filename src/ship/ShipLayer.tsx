import { AnimatePresence, motion } from 'motion/react'
import { Clock, Ship, Store as StoreIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { appClock } from '../lib/clock'
import { formatCOP } from '../lib/format'
import { discounted, isPromotionLive } from '../lib/pricing'
import { useNow } from '../lib/useNow'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { usePassport } from '../state/passport'
import { useUI } from '../state/ui'
import { remoteEnabled } from '../remote/client'
import { useNotifications } from '../notifications/store'
import { Countdown } from '../ui/bits'
import { MallMark } from '../ui/MallMark'
import { ProductImage } from '../ui/ProductImage'
import { Sheet } from '../ui/Sheet'
import { playShipHorn } from './sound'
import { useVisibleArrival, SHIP_SCHEDULE_LABEL, SHIP_STAY_MIN, arrivalLabel, isDocked, isShipPromotion, nextScheduledArrival, scheduledWindow, useDiscountShip } from './offers'

// Capa del barco de los descuentos: hace atracar/zarpar el barco según el horario, muestra el aviso
// de llegada (como una notificación del celular) y la ficha con las ofertas a bordo.

const NAVY = '#16325c'
const CORAL = '#f27b68'

/** Lleva la cámara al barco (desde cualquier página). */
function goToShip(navigate: (to: string) => void, path: string, open: boolean) {
  if (path !== '/') navigate('/')
  const ui = useUI.getState()
  if (open) ui.openShip(true)
  else ui.requestFocus({ kind: 'ship' })
}

/** Atraca y zarpa según el horario; la llegada de prueba zarpa sola al vencer. */
function useShipSchedule() {
  useEffect(() => {
    const tick = () => {
      const { arrival, arrive, depart } = useDiscountShip.getState()
      const now = appClock.now()
      if (arrival && now >= arrival.until) depart()
      // con base de datos el barco lo habilita un dueño (llegada compartida); la llegada por horario es solo de la demostración
      else if (!arrival && !remoteEnabled()) {
        const w = scheduledWindow(now)
        if (w) arrive((w.until - now) / 60_000)
      }
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [])
}

/** Aviso de llegada: tarjeta tipo notificación que baja desde arriba; se toca o se desliza hacia arriba. */
function ShipNotice() {
  const arrival = useVisibleArrival()
  const count = useCatalog((s) => s.promotions.filter(isShipPromotion).length)
  const [shown, setShown] = useState<number | null>(null)
  const seen = useRef<number | null>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    // una vez por llegada, y solo si es reciente (al recargar no se repite)
    if (!arrival || seen.current === arrival.at || appClock.now() - arrival.at > 90_000) return
    seen.current = arrival.at
    setShown(arrival.at)
    navigator.vibrate?.([30, 60, 30])
    void playShipHorn()
    useNotifications.getState().push({
      id: `ship:${arrival.at}`,
      orderId: '',
      storeName: 'Barco de los descuentos',
      status: 'confirmed',
      title: '🛳️ ¡Llegó el barco de los descuentos!',
      subtitle: `${useDiscountShip.getState().offers.filter((o) => !o.demo).length || count} locales subieron ofertas · toca para verlo`,
      at: new Date().toISOString(),
      action: 'ship',
    })
    const id = setTimeout(() => setShown(null), 9000)
    return () => clearTimeout(id)
  }, [arrival])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-2 pt-[max(8px,env(safe-area-inset-top))]">
      <AnimatePresence>
        {shown !== null && (
          <motion.button
            key={shown}
            role="status"
            className="pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-[22px] border border-white/60 bg-white/80 p-3 text-left shadow-[0_12px_40px_rgb(6_44_66/0.28)] backdrop-blur-xl"
            initial={{ y: -120, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.6, bottom: 0.1 }}
            onDragEnd={(_, info) => info.offset.y < -30 && setShown(null)}
            onClick={() => {
              setShown(null)
              goToShip(navigate, pathname, false)
            }}
          >
            <span className="shrink-0 overflow-hidden rounded-[10px]">
              <MallMark size={38} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-[11.5px] font-semibold text-ink-soft">
                <span className="tracking-wide uppercase">Cartagena Mall</span>
                <span>ahora</span>
              </span>
              <span className="mt-0.5 block text-[15px] leading-snug font-bold text-ink">🛳️ ¡Llegó el barco de los descuentos!</span>
              <span className="block text-[13.5px] leading-snug text-ink-soft">
                {count} locales subieron descuentos especiales. Acércate al muelle antes de que zarpe.
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Ficha del barco: ofertas a bordo (si está atracado) o cuándo vuelve. */
function ShipSheet() {
  const open = useUI((s) => s.shipOpen)
  const arrival = useVisibleArrival()
  const promotions = useCatalog((s) => s.promotions)
  const { productById, storeById } = useCatalogMaps()
  const now = useNow()
  const docked = isDocked(arrival, now)
  const aboard = useMemo(
    () => promotions.filter((p) => isShipPromotion(p) && isPromotionLive(p, now)).sort((a, b) => b.discountPercent - a.discountPercent),
    [promotions, now],
  )
  const stamp = usePassport((s) => s.stamp)
  useEffect(() => {
    if (open && docked) stamp('BARCO')
  }, [open, docked, stamp])
  const close = () => useUI.getState().openShip(false)
  return (
    <Sheet
      open={open}
      onClose={close}
      title="Barco de los descuentos"
      scrim={false}
      mobileHeight="h-[72dvh]"
      header={
        <div className="px-5 pt-2 pb-3" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${NAVY} 14%, transparent), transparent)` }}>
          <div className="flex items-center gap-3.5 pr-12">
            <span className="grid size-14 shrink-0 place-items-center rounded-[18px] text-white shadow-soft" style={{ background: `linear-gradient(145deg, ${NAVY}, #2f6fd6)` }}>
              <Ship className="size-7" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-ink-soft">Muelle turístico</p>
              <h2 className="text-[20px] leading-tight font-bold tracking-[-0.02em]">Barco de los descuentos</h2>
              {docked && arrival ? (
                <p className="flex items-center gap-1 text-[13px] font-semibold" style={{ color: CORAL }}>
                  <Clock className="size-3.5" /> Zarpa en <Countdown endsAt={new Date(arrival.until).toISOString()} className="!font-sans !font-semibold" />
                </p>
              ) : (
                <p className="text-[13px] text-ink-soft">Próxima llegada: {arrivalLabel(nextScheduledArrival(now), now)}</p>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-3 px-5 pt-2 pb-8">
        {docked ? (
          <>
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Descuentos especiales que los locales subieron solo para este viaje. Se aplican en tu carrito y se van con el barco.
            </p>
            <ul className="space-y-2.5">
              {aboard.map((p, i) => {
                const product = productById[p.productId]
                const store = storeById[p.storeId]
                if (!product || !store) return null
                const demo = p.description.startsWith('Oferta de ejemplo')
                return (
                  <motion.li key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1], delay: i * 0.04 }}>
                    <button
                      className="flex w-full gap-3 rounded-[22px] border border-line bg-card p-2.5 text-left transition active:scale-[0.99]"
                      onClick={() => useUI.getState().openProduct(product.id)}
                    >
                      <ProductImage product={product} brandColor={store.brandColor} className="size-20 shrink-0 rounded-2xl" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase" style={{ color: store.brandColor }}>
                          <StoreIcon className="size-3" /> <span className="truncate">{store.name}</span>
                          {demo && <span className="rounded bg-ink/[0.07] px-1 py-px text-[9.5px] text-ink-soft">EJEMPLO</span>}
                        </span>
                        <span className="line-clamp-2 text-[14px] leading-snug font-semibold">{product.name}</span>
                        <span className="mt-auto flex items-baseline gap-2">
                          <span className="text-[17px] font-extrabold">{formatCOP(discounted(product.price, p.discountPercent))}</span>
                          <span className="text-xs text-ink-soft line-through">{formatCOP(product.price)}</span>
                          <span className="ml-auto rounded-full px-2 py-0.5 text-[12px] font-bold text-white" style={{ background: CORAL }}>
                            −{p.discountPercent}%
                          </span>
                        </span>
                      </span>
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          </>
        ) : (
          <div className="rounded-[22px] border border-line bg-card p-4 text-[14px] leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">El barco no está en el muelle ahora.</p>
            <p className="mt-1">
              Llega {SHIP_SCHEDULE_LABEL.toLowerCase()} y se queda {SHIP_STAY_MIN} minutos con descuentos especiales de los locales. Te avisamos cuando atraque.
            </p>
            <p className="mt-2 text-[13px]">¿Tienes un local? Sube tu descuento desde Mi negocio → Promociones.</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}

export function ShipLayer() {
  useShipSchedule()
  return (
    <>
      <ShipNotice />
      <ShipSheet />
    </>
  )
}

/** Botón de prueba: hace llegar (o zarpar) el barco ahora. */
export function ShipTestButton({ className, onDone }: { className: string; onDone?: () => void }) {
  const arrival = useDiscountShip((s) => s.arrival)
  const now = useNow()
  const docked = !!arrival && now < arrival.until
  return (
    <button
      className={docked ? `${className} !bg-deep/85 !text-white` : className}
      onClick={() => {
        const ship = useDiscountShip.getState()
        if (docked) {
          ship.depart()
          useUI.getState().openShip(false)
        } else ship.arrive()
        onDone?.()
      }}
    >
      <Ship className="size-4" /> {docked ? 'Hacer zarpar el barco' : 'Barco de prueba'}
    </button>
  )
}

/** Pastilla en el mapa mientras el barco está atracado: lleva al muelle. */
export function ShipPill() {
  const arrival = useVisibleArrival()
  const now = useNow()
  if (!arrival || now >= arrival.until) return null
  return (
    <button
      onClick={() => useUI.getState().requestFocus({ kind: 'ship' })}
      className="chrome-text flex h-8 items-center gap-1.5 rounded-full pr-1 text-[13px] leading-none font-semibold transition active:scale-[0.98]"
      aria-label="El barco de los descuentos está en el muelle. Ir al muelle"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full text-white shadow-[0_2px_10px_rgb(22_50_92/0.5)] motion-safe:animate-pulse" style={{ background: NAVY }}>
        <Ship className="size-3.5" strokeWidth={2.2} />
      </span>
      <span className="font-bold">Barco en el muelle</span>
      <Countdown endsAt={new Date(arrival.until).toISOString()} className="!font-sans !text-[12.5px] leading-none !font-semibold opacity-90" />
    </button>
  )
}
