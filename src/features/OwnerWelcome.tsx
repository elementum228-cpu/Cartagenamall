import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronRight, Scissors, ShoppingBag, Sparkles, Store as StoreIcon, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { isFoodCategory } from '../lib/restaurant'
import { useCatalog } from '../state/catalog'
import { StoreLogo, btn } from '../ui/bits'
import type { Store } from '../domain/types'
import { create } from 'zustand'

type Kind = NonNullable<Store['businessType']>

/** Permite volver a abrir la bienvenida desde «Mi cuenta». */
export const useWelcome = create<{ forced: number; reopen: () => void }>()((set) => ({
  forced: 0,
  reopen: () => {
    try {
      sessionStorage.removeItem('cm:welcome-dismissed')
    } catch {
      /* sin almacenamiento */
    }
    set((s) => ({ forced: s.forced + 1 }))
  },
}))

const KINDS: { id: Kind; name: string; hint: string; icon: typeof StoreIcon }[] = [
  { id: 'restaurant', name: 'Restaurante', hint: 'Vendes comida y bebidas. Armas tu menú de platos.', icon: UtensilsCrossed },
  { id: 'shop', name: 'Tienda', hint: 'Vendes productos: ropa, tecnología, hogar, belleza…', icon: ShoppingBag },
  { id: 'service', name: 'Servicios', hint: 'Ofreces un servicio: barbería, reparaciones, clases…', icon: Scissors },
]

const PLAN: Record<Kind, { title: string; steps: string[]; cta: string }> = {
  restaurant: {
    title: 'Vamos a armar tu restaurante',
    steps: ['Sube tu logo y revisa tus datos', 'Carga tu menú: tus primeros platos con foto y precio', 'Abre tu local para recibir pedidos en tu WhatsApp'],
    cta: 'Cargar mi menú',
  },
  shop: {
    title: 'Vamos a armar tu tienda',
    steps: ['Sube tu logo y revisa tus datos', 'Sube tus primeros artículos con foto, precio e inventario', 'Abre tu local para recibir pedidos en tu WhatsApp'],
    cta: 'Subir mi primer artículo',
  },
  service: {
    title: 'Vamos a armar tu negocio de servicios',
    steps: ['Sube tu logo y revisa tus datos', 'Agrega tus servicios con su precio', 'Abre tu local para recibir solicitudes en tu WhatsApp'],
    cta: 'Agregar mi primer servicio',
  },
}

const CONFETTI = Array.from({ length: 22 }, (_, i) => ({ x: ((i * 37) % 100) - 50, d: 0.05 * i, r: (i * 53) % 360, c: ['#f27b68', '#ffd166', '#06d6a0', '#ffffff', '#4cc9f0'][i % 5], s: 6 + (i % 4) * 2 }))

/**
 * Bienvenida del dueño de un local recién aprobado: animación «¡Eres dueño de un local!», pregunta qué tipo de negocio es
 * y lo lleva directo a cargar su menú (o artículos / servicios). Pensada para el celular.
 */
export function OwnerWelcome() {
  const session = useSession()
  const stores = useCatalog((s) => s.stores)
  const upsertStore = useCatalog((s) => s.upsertStore)
  const forced = useWelcome((s) => s.forced)
  const navigate = useNavigate()
  const [step, setStep] = useState<'hello' | 'type' | 'plan'>('hello')
  const [kind, setKind] = useState<Kind>('restaurant')
  const [closed, setClosed] = useState(false)
  const store = useMemo(() => (import.meta.env.DEV && location.search.includes('welcometest') ? stores.find((s) => s.id === 'STORE-004') : remoteEnabled() && session.userId ? stores.find((s) => s.setup === 'pending' && session.storeIds.includes(s.id)) : undefined), [stores, session.userId, session.storeIds])

  const dismissed = (() => {
    try {
      return sessionStorage.getItem('cm:welcome-dismissed') === '1'
    } catch {
      return false
    }
  })()
  useEffect(() => {
    setClosed(false)
    setStep('hello')
  }, [forced, store?.id])
  const show = !!store && !closed && (!dismissed || forced > 0)

  const finish = (go: boolean) => {
    if (!store) return
    upsertStore({ ...store, businessType: kind, setup: 'done', categoryId: kind === 'restaurant' && !isFoodCategory(store.categoryId) ? 'gastronomia' : store.categoryId })
    setClosed(true)
    navigate(go ? `/mi-negocio?tienda=${store.id}&tab=articulos&nuevo=1` : `/mi-negocio?tienda=${store.id}`)
  }
  const later = () => {
    try {
      sessionStorage.setItem('cm:welcome-dismissed', '1')
    } catch {
      /* sin almacenamiento */
    }
    setClosed(true)
  }

  return (
    <AnimatePresence>
      {show && store && (
        <motion.div
          key="welcome"
          className="fixed inset-0 z-[120] flex flex-col overflow-hidden px-5 pt-[max(20px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] text-white"
          style={{ background: `linear-gradient(165deg, ${store.brandColor}, #0b2a3d 85%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-label="Bienvenida a tu local"
        >
          <button className="ml-auto grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur" onClick={later} aria-label="Cerrar y configurar después">
            <X className="size-5" />
          </button>

          <AnimatePresence mode="wait">
            {step === 'hello' && (
              <motion.div key="hello" className="relative flex flex-1 flex-col items-center justify-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}>
                {CONFETTI.map((c, i) => (
                  <motion.span
                    key={i}
                    className="pointer-events-none absolute top-1/3 left-1/2 rounded-[2px]"
                    style={{ width: c.s, height: c.s * 1.6, background: c.c }}
                    initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
                    animate={{ x: c.x * 5, y: [0, -120 - (i % 5) * 20, 260], opacity: [0, 1, 0], rotate: c.r * 3 }}
                    transition={{ duration: 2.4, delay: 0.5 + c.d, ease: 'easeOut' }}
                  />
                ))}
                <motion.div initial={{ scale: 0.2, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.15 }} className="rounded-[34px] bg-white p-2 shadow-[0_20px_60px_rgb(0_0_0/0.35)]">
                  <StoreLogo store={store} size={112} />
                </motion.div>
                <motion.p className="mt-7 text-sm font-bold tracking-widest uppercase opacity-80" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 0.85 }} transition={{ delay: 0.55 }}>
                  <Sparkles className="mr-1 inline size-4" /> ¡Felicitaciones!
                </motion.p>
                <motion.h1 className="mt-2 text-[32px] leading-tight font-extrabold tracking-tight" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
                  ¡Eres dueño de un local!
                </motion.h1>
                <motion.p className="mt-3 text-[22px] font-bold" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.95 }}>
                  {store.name}
                </motion.p>
                <motion.p className="mt-2 max-w-xs text-[15px] opacity-85" initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ delay: 1.2 }}>
                  Ya es tuyo en Cartagena Mall. Vamos a dejarlo listo en un minuto.
                </motion.p>
              </motion.div>
            )}

            {step === 'type' && (
              <motion.div key="type" className="flex flex-1 flex-col justify-center" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <h2 className="text-[26px] leading-tight font-extrabold tracking-tight">¿Qué tipo de negocio es {store.name}?</h2>
                <p className="mt-1 text-sm opacity-80">Así te mostramos las herramientas que necesitas.</p>
                <div className="mt-5 space-y-3">
                  {KINDS.map((k) => {
                    const Icon = k.icon
                    return (
                      <button
                        key={k.id}
                        onClick={() => {
                          setKind(k.id)
                          setStep('plan')
                        }}
                        className="flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left text-ink shadow-[0_10px_30px_rgb(0_0_0/0.25)] transition active:scale-[0.98]"
                      >
                        <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white" style={{ background: store.brandColor }}>
                          <Icon className="size-7" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-lg font-extrabold">{k.name}</span>
                          <span className="block text-[13px] leading-snug text-ink-soft">{k.hint}</span>
                        </span>
                        <ChevronRight className="size-5 shrink-0 text-ink-soft" />
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {step === 'plan' && (
              <motion.div key="plan" className="flex flex-1 flex-col justify-center" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <h2 className="text-[26px] leading-tight font-extrabold tracking-tight">{PLAN[kind].title}</h2>
                <p className="mt-1 text-sm opacity-80">Son tres pasos y ya vendes:</p>
                <ol className="mt-5 space-y-3">
                  {PLAN[kind].steps.map((t, i) => (
                    <motion.li key={t} className="flex items-start gap-3 rounded-2xl bg-white/12 p-3.5 backdrop-blur" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.12 }}>
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-sm font-extrabold text-ink">{i + 1}</span>
                      <span className="text-[15px] leading-snug font-semibold">{t}</span>
                    </motion.li>
                  ))}
                </ol>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 space-y-2.5">
            {step === 'hello' && (
              <button className={`${btn.primary} w-full !bg-white !text-ink`} onClick={() => setStep('type')}>
                Empezar <ChevronRight className="size-4" />
              </button>
            )}
            {step === 'plan' && (
              <>
                <button className={`${btn.primary} w-full !bg-white !text-ink`} onClick={() => finish(true)}>
                  <Check className="size-4" /> {PLAN[kind].cta}
                </button>
                <button className="w-full py-2 text-sm font-semibold opacity-85" onClick={() => finish(false)}>
                  Ir a mi negocio
                </button>
              </>
            )}
            {step !== 'hello' && (
              <button className="w-full text-xs font-semibold opacity-70" onClick={() => setStep(step === 'plan' ? 'type' : 'hello')}>
                ← Atrás
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
