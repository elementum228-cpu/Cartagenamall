import { AnimatePresence, motion } from 'motion/react'
import { Bike, Check, ChevronRight, MapPin, MessageCircle, Scissors, ShoppingBag, Store as StoreIcon, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { remoteEnabled } from '../remote/client'
import { useSession } from '../remote/session'
import { isFoodCategory, isRestaurant } from '../lib/restaurant'
import { FLOOR_BY_ID, FLOOR_OF_ZONE, SPACE_BY_ID, ZONE_BY_ID } from '../config/mall'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { btn } from '../ui/bits'
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
  { id: 'shop', name: 'Tienda', hint: 'Vendes productos. Armas tu catálogo: ropa, tecnología, hogar, belleza…', icon: ShoppingBag },
  { id: 'service', name: 'Servicios', hint: 'Ofreces un servicio. Armas tu catálogo de servicios: barbería, reparaciones, clases…', icon: Scissors },
]

const PLAN: Record<Kind, { title: string; steps: string[]; cta: string }> = {
  restaurant: {
    title: 'Vamos a armar tu restaurante',
    steps: ['Tu local ya está en el mapa', 'Carga tu menú: tus primeros platos con foto y precio', 'Abre tu local para recibir pedidos en tu WhatsApp'],
    cta: 'Cargar mi menú',
  },
  shop: {
    title: 'Vamos a armar tu tienda',
    steps: ['Tu local ya está en el mapa', 'Arma tu catálogo: tus primeros productos con foto, precio e inventario', 'Abre tu local para recibir pedidos en tu WhatsApp'],
    cta: 'Subir mi primer producto',
  },
  service: {
    title: 'Vamos a armar tu negocio de servicios',
    steps: ['Tu local ya está en el mapa', 'Arma tu catálogo de servicios con su precio', 'Abre tu local para recibir solicitudes en tu WhatsApp'],
    cta: 'Agregar mi primer servicio',
  },
}

const CONFETTI = Array.from({ length: 22 }, (_, i) => ({ x: ((i * 37) % 100) - 50, d: 0.05 * i, r: (i * 53) % 360, c: ['#f27b68', '#ffd166', '#06d6a0', '#ffffff', '#4cc9f0'][i % 5], s: 6 + (i % 4) * 2 }))

/** Tipo de negocio que sugerimos según lo que pidió al reclamar el local (rubro y zona). */
const guessKind = (store: Store): Kind => (isRestaurant(store) ? 'restaurant' : store.zoneId === 'F' ? 'service' : 'shop')
/** Tamaño de letra para que el logo de texto quepa entero en el cuadro. */
const logoFont = (t: string) => (t.length <= 4 ? 34 : t.length <= 6 ? 26 : t.length <= 8 ? 20 : 15)
/** Un texto de relleno que dejó la aprobación: no debe verlo el público. */
const PLACEHOLDER_DESC = /^Nueva tienda de .*Completa la descripción/

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
  const [step, setStep] = useState<'hello' | 'type' | 'place' | 'plan'>('hello')
  const [kind, setKind] = useState<Kind>('restaurant')
  // el tipo llega sugerido (lo deducimos de lo que pidió); la persona solo confirma o lo cambia
  const [picked, setPicked] = useState<Kind | null>(null)
  const [closed, setClosed] = useState(false)
  // ¿tiene punto físico? (si no, solo se le pide a domicilio)
  const [physical, setPhysical] = useState<boolean | null>(null)
  const { spaceByStore } = useCatalogMaps()
  const store = useMemo(() => (import.meta.env.DEV && location.search.includes('welcometest') ? stores.find((s) => s.id === 'STORE-004') : remoteEnabled() && session.userId ? stores.find((s) => s.setup === 'pending' && session.storeIds.includes(s.id)) : undefined), [stores, session.userId, session.storeIds])

  useEffect(() => {
    setClosed(false)
    setStep('hello')
    setPhysical(null)
    if (store) {
      const g = guessKind(store)
      setKind(g)
      setPicked(g)
    }
  }, [forced, store?.id])
  // se abre sola al entrar con una solicitud recién aprobada (una vez por sesión); también desde el aviso o «Mi cuenta»
  const dismissed = (() => {
    try {
      return sessionStorage.getItem('cm:welcome-dismissed') === '1'
    } catch {
      return false
    }
  })()
  const show = !!store && !closed && (forced > 0 || !dismissed)

  const finish = (go: boolean) => {
    if (!store) return
    upsertStore({
      ...store,
      businessType: kind,
      setup: 'done',
      deliveryOnly: physical === false,
      description: PLACEHOLDER_DESC.test(store.description) ? `Bienvenido a ${store.name}.` : store.description,
      categoryId: kind === 'restaurant' && !isFoodCategory(store.categoryId) ? 'gastronomia' : store.categoryId,
    })
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
  const space = store ? SPACE_BY_ID[spaceByStore[store.id]] : undefined
  const zone = store ? ZONE_BY_ID[store.zoneId] : undefined
  const placeLine = store && zone ? [space?.label, zone.id === 'E' ? zone.name : `Pasillo ${zone.id}`, FLOOR_BY_ID[FLOOR_OF_ZONE[zone.id]]?.name].filter(Boolean).join(' · ') : ''

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
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={['hello', 'type', 'place', 'plan'].indexOf(step) + 1} aria-label="Paso de la bienvenida">
              {(['hello', 'type', 'place', 'plan'] as const).map((k, i) => (
                <span key={k} className={`h-1.5 rounded-full transition-all ${k === step ? 'w-7 bg-white' : i < ['hello', 'type', 'place', 'plan'].indexOf(step) ? 'w-3 bg-white/80' : 'w-3 bg-white/30'}`} />
              ))}
            </div>
            <button className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur" onClick={later} aria-label="Cerrar y configurar después">
              <X className="size-5" />
            </button>
          </div>

          <div className="-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2">
          <AnimatePresence mode="wait">
            {step === 'hello' && (
              <motion.div key="hello" className="relative my-auto flex flex-col items-center py-4 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}>
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
                <motion.div
                  initial={{ scale: 0.2, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.15 }}
                  className="grid size-32 place-items-center overflow-hidden rounded-[36px] bg-white shadow-[0_20px_60px_rgb(0_0_0/0.35)]"
                >
                  {store.logo ? (
                    <img src={store.logo} alt={`Logo de ${store.name}`} className="size-full object-contain p-3" />
                  ) : (
                    <span className="max-w-full px-2 text-center leading-none font-extrabold tracking-tight whitespace-nowrap" style={{ color: store.brandColor, fontSize: logoFont(store.logoText) }}>
                      {store.logoText}
                    </span>
                  )}
                </motion.div>
                <motion.p className="mt-7 text-sm font-bold tracking-widest uppercase opacity-80" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 0.85 }} transition={{ delay: 0.55 }}>
                  ¡Felicitaciones!
                </motion.p>
                <motion.h1 className="mt-2 text-[32px] leading-tight font-extrabold tracking-tight" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}>
                  ¡Eres dueño de un local!
                </motion.h1>
                <motion.p className="mt-3 text-[22px] font-bold" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.95 }}>
                  {store.name}
                </motion.p>
                <motion.ul className="mt-5 w-full max-w-xs space-y-2 text-left" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
                  {[
                    { icon: MapPin, t: 'Tu espacio en el mall', d: placeLine },
                    { icon: StoreIcon, t: 'Tu ficha pública', d: 'Ya la pueden encontrar y visitar' },
                    { icon: MessageCircle, t: 'Pedidos por WhatsApp', d: store.whatsapp ? `Llegan al ${store.whatsapp}` : 'Llegan a tu WhatsApp' },
                  ].map(({ icon: Icon, t, d }) => (
                    <li key={t} className="flex items-center gap-3 rounded-2xl bg-white/12 px-3.5 py-2.5 backdrop-blur">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-ink">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block text-[14px] font-extrabold">{t}</span>
                        <span className="block truncate text-[12.5px] opacity-80">{d}</span>
                      </span>
                      <Check className="ml-auto size-4 shrink-0 text-teal-bright" strokeWidth={3} />
                    </li>
                  ))}
                </motion.ul>
              </motion.div>
            )}

            {step === 'type' && (
              <motion.div key="type" className="my-auto py-4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <h2 className="text-[26px] leading-tight font-extrabold tracking-tight">¿Qué tipo de negocio es {store.name}?</h2>
                <p className="mt-1 text-sm opacity-80">Creemos que es {KINDS.find((k) => k.id === guessKind(store))?.name.toLowerCase()}. Confírmalo o cámbialo.</p>
                <div className="mt-5 space-y-3" role="radiogroup" aria-label="Tipo de negocio">
                  {KINDS.map((k) => {
                    const Icon = k.icon
                    const on = picked === k.id
                    const dim = picked !== null && !on
                    return (
                      <button
                        key={k.id}
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setPicked(k.id)
                          setKind(k.id)
                        }}
                        className={`flex w-full items-center gap-4 rounded-3xl p-4 text-left transition duration-200 active:scale-[0.98] ${
                          on
                            ? 'scale-[1.02] bg-white text-ink shadow-[0_14px_40px_rgb(0_0_0/0.35)] ring-[3px] ring-teal-bright'
                            : dim
                              ? 'bg-white/10 text-white/70 ring-1 ring-white/15 backdrop-blur'
                              : 'bg-white text-ink shadow-[0_10px_30px_rgb(0_0_0/0.25)]'
                        }`}
                      >
                        <span className={`grid size-14 shrink-0 place-items-center rounded-2xl transition ${dim ? 'bg-white/15 text-white/80' : 'text-white'}`} style={dim ? undefined : { background: store.brandColor }}>
                          <Icon className="size-7" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-lg font-extrabold">{k.name}</span>
                          <span className={`block text-[13px] leading-snug ${dim ? 'text-white/65' : 'text-ink-soft'}`}>{k.hint}</span>
                        </span>
                        <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition ${on ? 'border-teal-bright bg-teal-bright text-white' : dim ? 'border-white/30' : 'border-line'}`} aria-hidden>
                          {on && <Check className="size-4" strokeWidth={3} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {step === 'place' && (
              <motion.div key="place" className="my-auto py-4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <h2 className="text-[26px] leading-tight font-extrabold tracking-tight">¿{store.name} tiene un punto físico?</h2>
                <p className="mt-1 text-sm opacity-80">Así tus clientes solo ven las opciones que sí puedes ofrecer al pedir.</p>
                <div className="mt-5 space-y-3" role="radiogroup" aria-label="Punto físico">
                  {[
                    { v: true, icon: StoreIcon, t: 'Sí, tengo local', d: 'Pueden recoger el pedido allá o pedir a domicilio.' },
                    { v: false, icon: Bike, t: 'No, solo domicilio', d: 'Vendo desde casa o una cocina: todo se entrega a domicilio.' },
                  ].map(({ v, icon: Icon, t, d }) => {
                    const on = physical === v
                    const dim = physical !== null && !on
                    return (
                      <button
                        key={t}
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPhysical(v)}
                        className={`flex w-full items-center gap-4 rounded-3xl p-4 text-left transition duration-200 active:scale-[0.98] ${on ? 'bg-white text-ink shadow-[0_14px_40px_rgb(0_0_0/0.35)] ring-[3px] ring-teal-bright' : dim ? 'bg-white/10 text-white/70 ring-1 ring-white/15 backdrop-blur' : 'bg-white text-ink shadow-[0_10px_30px_rgb(0_0_0/0.25)]'}`}
                      >
                        <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${dim ? 'bg-white/15 text-white/80' : 'text-white'}`} style={dim ? undefined : { background: store.brandColor }}>
                          <Icon className="size-7" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-lg font-extrabold">{t}</span>
                          <span className={`block text-[13px] leading-snug ${dim ? 'text-white/65' : 'text-ink-soft'}`}>{d}</span>
                        </span>
                        <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-teal-bright bg-teal-bright text-white' : dim ? 'border-white/30' : 'border-line'}`} aria-hidden>
                          {on && <Check className="size-4" strokeWidth={3} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {step === 'plan' && (
              <motion.div key="plan" className="my-auto py-4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <h2 className="text-[26px] leading-tight font-extrabold tracking-tight">{PLAN[kind].title}</h2>
                <p className="mt-1 text-sm opacity-80">Casi listo. Esto es lo que sigue:</p>
                <ol className="mt-5 space-y-3">
                  {PLAN[kind].steps.map((t, i) => (
                    <motion.li key={t} className="flex items-start gap-3 rounded-2xl bg-white/12 p-3.5 backdrop-blur" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.12 }}>
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-extrabold ${i === 0 ? 'bg-teal-bright text-white' : 'bg-white text-ink'}`}>{i === 0 ? <Check className="size-4" strokeWidth={3} /> : i + 1}</span>
                      <span className="text-[15px] leading-snug font-semibold">{t}</span>
                    </motion.li>
                  ))}
                </ol>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          <div className="mt-4 space-y-2.5">
            {step === 'hello' && (
              <button className={`${btn.primary} w-full !bg-white !text-ink`} onClick={() => setStep('type')}>
                Empezar <ChevronRight className="size-4" />
              </button>
            )}
            {step === 'type' && (
              <button className={`${btn.primary} w-full !bg-white !text-ink`} disabled={!picked} onClick={() => setStep('place')}>
                Continuar <ChevronRight className="size-4" />
              </button>
            )}
            {step === 'place' && (
              <button className={`${btn.primary} w-full !bg-white !text-ink`} disabled={physical === null} onClick={() => setStep('plan')}>
                Continuar <ChevronRight className="size-4" />
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
              <button className="w-full text-xs font-semibold opacity-70" onClick={() => setStep(step === 'plan' ? 'place' : step === 'place' ? 'type' : 'hello')}>
                ← Atrás
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
