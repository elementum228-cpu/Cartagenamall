import { AnimatePresence, motion } from 'motion/react'
import { Copy, Gem, X } from 'lucide-react'
import { useEffect } from 'react'
import { copyText } from '../lib/clipboard'
import { formatCOP } from '../lib/format'
import { discounted } from '../lib/pricing'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { usePersonal } from '../state/personal'
import { useUI } from '../state/ui'
import { Countdown, btn } from '../ui/bits'
import { ProductImage } from '../ui/ProductImage'

/** Aparece solo cuando la persona toca la gema escondida en el mundo. */
export function SecretPromoModal() {
  const id = useUI((s) => s.secretPromoId)
  const promo = useCatalog((s) => s.promotions.find((p) => p.id === id))
  const { productById, storeById } = useCatalogMaps()
  const discover = usePersonal((s) => s.discover)
  const saveSecret = usePersonal((s) => s.saveSecret)
  const saved = usePersonal((s) => (id ? s.savedSecrets.includes(id) : false))
  const total = useCatalog((s) => s.promotions.filter((p) => p.type === 'secret').length)
  const found = usePersonal((s) => s.discovered.length)
  const toast = useUI((s) => s.toast)
  const close = () => useUI.getState().openSecret(null)

  useEffect(() => {
    if (id) discover(id)
  }, [id, discover])

  const product = promo ? productById[promo.productId] : undefined
  const store = promo ? storeById[promo.storeId] : undefined

  return (
    <AnimatePresence>
      {promo && product && store && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center bg-ink/45 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Oferta secreta descubierta"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-[28px] bg-ink text-white shadow-float"
            initial={{ scale: 0.7, rotate: -4, y: 30 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 16, stiffness: 240 }}
          >
            <button onClick={close} className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-white/10" aria-label="Cerrar">
              <X className="size-5" />
            </button>
            <div className="relative px-6 pt-7 pb-5 text-center">
              {Array.from({ length: 10 }, (_, i) => (
                <motion.span
                  key={i}
                  className="absolute size-1.5 rounded-full bg-sun"
                  style={{ left: `${10 + i * 8.5}%`, top: '40%' }}
                  initial={{ y: 0, opacity: 1 }}
                  animate={{ y: [-10, -60 - (i % 3) * 20], opacity: [1, 0] }}
                  transition={{ duration: 1.2, delay: i * 0.05 }}
                />
              ))}
              <motion.div className="mx-auto grid size-16 place-items-center rounded-2xl bg-sun text-ink" animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 0.8 }}>
                <Gem className="size-8" />
              </motion.div>
              <p className="mt-4 text-[11px] font-bold tracking-[0.2em] text-sun uppercase">
                Descubrimiento {Math.min(found, total)}/{total}
              </p>
              <h2 className="mt-1 text-2xl leading-tight font-extrabold">¡DESCUBRISTE UNA OFERTA SECRETA!</h2>
            </div>
            <div className="mx-4 mb-4 rounded-3xl bg-white p-4 text-ink">
              <div className="flex gap-3">
                <ProductImage product={product} brandColor={store.brandColor} className="size-20 shrink-0 rounded-2xl" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase" style={{ color: store.brandColor }}>
                    {store.name}
                  </p>
                  <p className="text-sm leading-snug font-bold">{product.name}</p>
                  <p className="mt-1 text-lg font-extrabold">
                    {formatCOP(discounted(product.price, promo.discountPercent))}{' '}
                    <span className="text-xs font-medium text-ink-soft line-through">{formatCOP(product.price)}</span>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl border-2 border-dashed border-sun bg-sun/10 px-3 py-2">
                <div>
                  <p className="text-[10px] font-bold text-ink-soft uppercase">Código · −{promo.discountPercent}%</p>
                  <p className="font-mono text-lg font-extrabold tracking-widest">{promo.code}</p>
                </div>
                <button
                  className={btn.icon}
                  onClick={async () => toast((await copyText(promo.code ?? '')) ? 'Código copiado' : `Código: ${promo.code}`)}
                  aria-label="Copiar código"
                >
                  <Copy className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-ink-soft">
                Vence en <Countdown endsAt={promo.endsAt} />
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  className={`${btn.secondary} flex-1`}
                  onClick={() => {
                    close()
                    useUI.getState().openProduct(product.id)
                  }}
                >
                  Ver producto
                </button>
                <button
                  className={`${btn.primary} flex-1`}
                  disabled={saved}
                  onClick={() => {
                    saveSecret(promo.id)
                    toast('Oferta guardada: el descuento se aplicará en tu carrito.', 'success')
                    close()
                  }}
                >
                  {saved ? 'Guardada' : 'Guardar oferta'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
