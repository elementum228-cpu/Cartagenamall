import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { ChevronLeft, ChevronRight, Compass, Gem, Lock, Map as MapIcon, Pause, Play, ShoppingBag, Sparkles, Store as StoreIcon, Users } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MallMark } from '../ui/MallMark'
import puerta from './shots/01-puerta.webp'
import fortaleza from './shots/02-fortaleza.webp'
import plaza from './shots/03-plaza.webp'
import tienda from './shots/04-tienda.webp'
import recorrido from './shots/05-recorrido.webp'
import gema from './shots/06-gema.webp'
import tesoro from './shots/07-tesoro.webp'
import pasaporte from './shots/08-pasaporte.webp'
import comprar from './shots/09-comprar.webp'
import comerciante from './shots/10-comerciante.webp'

// Presentación privada del proyecto: qué es MallPlay y un recorrido guiado con capturas reales
// de la app, paso a paso. No da acceso a la app: solo se ve lo que aquí se muestra.

const SPRING = { type: 'spring', stiffness: 340, damping: 32 } as const
const STEP_MS = 6500

interface Step {
  img: string
  kicker: string
  title: string
  body: string
}

const STEPS: Step[] = [
  { img: puerta, kicker: 'La llegada', title: 'Se entra tocando la puerta', body: 'Tres toques a un portón colonial, el sonido de la madera al abrirse y una brisa caribeña. La experiencia empieza antes de ver la primera tienda.' },
  { img: fortaleza, kicker: 'El mall', title: 'Un centro comercial dentro de una fortaleza', body: 'Murallas, baluartes, garitas y el mar alrededor: dos pisos de tiendas inspirados en el Centro Histórico, de día o de noche según la hora real.' },
  { img: plaza, kicker: 'Explorar', title: 'Se recorre como un lugar de verdad', body: 'Pasillos por categoría, una plaza con fuente, escaleras eléctricas, cancha sintética y zona de comidas. Se desliza, se acerca con los dedos y se toca lo que llama la atención.' },
  { img: tienda, kicker: 'Las tiendas', title: 'Cada negocio tiene su vitrina', body: 'Logo, fachada, catálogo, ofertas y contacto. Las vitrinas se ven en el mapa y la ficha se abre sin salir del recorrido.' },
  { img: recorrido, kicker: 'Primera visita', title: 'Un recorrido guiado de bienvenida', body: 'La primera vez, la cámara vuela por el mall y presenta cada zona con sus tiendas reales: en menos de un minuto se entiende todo.' },
  { img: gema, kicker: 'Descubrir', title: 'Ofertas escondidas por el mall', body: 'Cada negocio puede esconder una oferta donde quiera. Aparece como un destello que solo se revela al acercarse: explorar tiene premio.' },
  { img: tesoro, kicker: 'Jugar', title: 'Búsqueda del tesoro semanal', body: 'Tres pistas encadenadas que cambian cada lunes. Una razón para volver cada semana.' },
  { img: pasaporte, kicker: 'Fidelizar', title: 'El pasaporte del mall', body: 'Sellos por recorrer cada pasillo y tarjetas de sellos por tienda: comprar varias veces en tu local favorito tiene recompensa.' },
  { img: comprar, kicker: 'Comprar', title: 'Un solo carrito para todo el mall', body: 'Productos de distintas tiendas en un mismo pedido, con búsqueda y filtros.' },
  { img: comerciante, kicker: 'Para los negocios', title: 'Cada emprendedor maneja su local', body: 'Desde su panel sube logo y productos, lanza ofertas relámpago y elige en el plano dónde esconder sus ofertas.' },
]

export function Landing({ guest }: { guest: string }) {
  const tourRef = useRef<HTMLElement>(null)
  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 overflow-y-auto bg-warm text-ink">
        <header className="sticky top-0 z-30 flex items-center gap-2.5 bg-deep/80 px-4 py-3 text-white backdrop-blur-xl md:px-8">
          <MallMark size={34} />
          <span className="text-[16px] font-bold tracking-[-0.01em]">MallPlay</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11.5px] font-semibold">
            <Lock className="size-3.5" /> Vista privada{guest ? ` · ${guest}` : ''}
          </span>
        </header>

        <Hero onTour={() => tourRef.current?.scrollIntoView({ behavior: 'smooth' })} />
        <What />
        <section ref={tourRef} className="scroll-mt-16 px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-[12px] font-bold tracking-[0.16em] text-teal uppercase">Recorrido guiado</p>
            <h2 className="mt-2 text-center text-[30px] leading-tight font-bold tracking-[-0.02em] md:text-[40px]">Así se vive MallPlay</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-[15px] text-ink-soft">Capturas reales de la app, en el orden en que alguien la conoce.</p>
            <Tour />
          </div>
        </section>
        <Closing />
      </div>
    </MotionConfig>
  )
}

function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto aspect-[390/844] w-full max-w-[250px] rounded-[42px] md:max-w-[300px] md:rounded-[46px] bg-[#0b1820] p-[9px] shadow-[0_40px_80px_-30px_rgb(6_44_66/0.6),0_0_0_1px_rgb(255_255_255/0.08)_inset]">
      <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-deep">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={src}
            src={src}
            alt={alt}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute inset-0 h-full w-full object-cover select-none"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </AnimatePresence>
      </div>
    </div>
  )
}

function Hero({ onTour }: { onTour: () => void }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-deep via-[#0a3b57] to-[#0b5f63] px-4 pt-12 pb-20 text-white md:px-8 md:pt-20 md:pb-28">
      <div className="pointer-events-none absolute -top-40 -right-40 size-[480px] rounded-full bg-teal-bright/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 size-[420px] rounded-full bg-amber/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1.1fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
          <p className="text-[12px] font-bold tracking-[0.18em] text-teal-bright uppercase">Tu ciudad. Tu mall. Tu mundo.</p>
          <h1 className="mt-3 text-[38px] leading-[1.05] font-bold tracking-[-0.03em] md:text-[56px]">Un centro comercial virtual dentro de una fortaleza</h1>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-white/80">
            MallPlay reúne a los emprendedores de la ciudad en un mall 3D que se recorre desde el celular: se explora, se descubren ofertas y se compra en un solo lugar.
          </p>
          <button onClick={onTour} className="glass-teal mt-7 flex h-[52px] items-center gap-2 rounded-full pr-5 pl-6 text-[16px] font-semibold">
            <Play className="size-5" fill="currentColor" /> Ver el recorrido guiado
          </button>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 40, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ ...SPRING, delay: 0.12 }}>
          <Phone src={fortaleza} alt="Vista general de MallPlay: la fortaleza con sus pasillos" />
        </motion.div>
      </div>
    </section>
  )
}

function What() {
  const cards: { icon: ReactNode; title: string; body: string }[] = [
    { icon: <Compass className="size-6" />, title: 'Para quien visita', body: 'Un paseo, no una lista de productos: pasillos, vitrinas, ofertas escondidas, juegos y un solo carrito.' },
    { icon: <StoreIcon className="size-6" />, title: 'Para quien emprende', body: 'Un local propio en el mall, con su marca y catálogo, y herramientas para atraer y fidelizar clientes.' },
    { icon: <Users className="size-6" />, title: 'Para la ciudad', body: 'La identidad de Cartagena llevada a lo digital: un punto de encuentro para el comercio local.' },
  ]
  return (
    <section className="px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-[30px] leading-tight font-bold tracking-[-0.02em] md:text-[40px]">¿Qué es MallPlay?</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {cards.map((c, i) => (
            <motion.article
              key={c.title}
              className="rounded-[28px] border border-line bg-card p-6 shadow-soft"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ ...SPRING, delay: i * 0.08 }}
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-teal/10 text-teal">{c.icon}</span>
              <h3 className="mt-4 text-[19px] font-bold tracking-[-0.01em]">{c.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{c.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Tour() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [dir, setDir] = useState(1)
  const step = STEPS[i]
  const go = (n: number) => {
    setDir(n > i ? 1 : -1)
    setI((n + STEPS.length) % STEPS.length)
  }

  // avanza solo; se detiene cuando la persona toma el control
  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(() => go(i + 1), STEP_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, playing])

  const manual = (n: number) => {
    setPlaying(false)
    go(n)
  }

  return (
    <div className="mt-10 grid items-center gap-10 md:grid-cols-[minmax(0,320px)_1fr] md:gap-16">
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50) manual(i + 1)
          else if (info.offset.x > 50) manual(i - 1)
        }}
        className="touch-pan-y"
      >
        <Phone src={step.img} alt={step.title} />
      </motion.div>
      <div>
        <div className="min-h-[200px] md:min-h-[230px]">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={i}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 40, filter: 'blur(6px)' }),
                center: { opacity: 1, x: 0, filter: 'blur(0px)' },
                exit: (d: number) => ({ opacity: 0, x: d * -40, filter: 'blur(6px)' }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={SPRING}
            >
              <p className="text-[13px] font-bold tracking-wide text-teal">
                {String(i + 1).padStart(2, '0')} · {step.kicker}
              </p>
              <h3 className="mt-1 text-[28px] leading-tight font-bold tracking-[-0.02em] md:text-[34px]">{step.title}</h3>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-ink-soft">{step.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        {/* indicador: la cápsula actual se llena mientras corre el recorrido */}
        <div className="mt-6 flex flex-wrap items-center gap-1.5" aria-hidden>
          {STEPS.map((s, n) => (
            <motion.button
              key={s.title}
              onClick={() => manual(n)}
              className="relative h-2 overflow-hidden rounded-full bg-ink/12"
              animate={{ width: n === i ? 36 : 8 }}
              transition={SPRING}
              aria-label={`Paso ${n + 1}: ${s.title}`}
            >
              {n === i && (
                <span
                  key={`f-${i}-${playing}`}
                  className="absolute inset-y-0 left-0 rounded-full bg-teal"
                  style={playing ? { animation: `tour-fill ${STEP_MS}ms linear forwards` } : { width: '100%' }}
                />
              )}
              {n < i && <span className="absolute inset-0 rounded-full bg-ink/30" />}
            </motion.button>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-2">
          <button onClick={() => manual(i - 1)} className="grid size-12 place-items-center rounded-full bg-ink/[0.06] transition active:scale-95" aria-label="Paso anterior">
            <ChevronLeft className="size-5" />
          </button>
          <button onClick={() => manual(i + 1)} className="glass-teal flex h-12 items-center gap-2 rounded-full pr-4 pl-5 text-[15px] font-semibold" aria-label="Paso siguiente">
            Siguiente <ChevronRight className="size-5" />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="ml-1 flex h-12 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-ink-soft transition hover:bg-ink/[0.05]"
            aria-label={playing ? 'Pausar el recorrido' : 'Reproducir el recorrido'}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />} {playing ? 'Pausar' : 'Reproducir'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Closing() {
  const contact = import.meta.env.VITE_CONTACT_URL as string | undefined
  const points: { icon: ReactNode; text: string }[] = [
    { icon: <MapIcon className="size-5" />, text: 'Mall 3D con dos pisos, cancha y zona de comidas' },
    { icon: <Gem className="size-5" />, text: 'Ofertas relámpago y escondidas, pasaporte y búsqueda del tesoro' },
    { icon: <ShoppingBag className="size-5" />, text: 'Carrito único y panel propio para cada negocio' },
    { icon: <Sparkles className="size-5" />, text: 'Se instala en el celular como una app' },
  ]
  return (
    <section className="bg-deep px-4 py-16 text-white md:px-8 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[30px] leading-tight font-bold tracking-[-0.02em] md:text-[40px]">Un proyecto en construcción</h2>
        <p className="mx-auto mt-3 max-w-xl text-[16px] text-white/75">Lo que viste ya funciona. Esta es una vista privada y confidencial: gracias por no compartir el enlace ni las imágenes.</p>
        <ul className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
          {points.map((p) => (
            <li key={p.text} className="flex items-center gap-3 rounded-[20px] bg-white/[0.06] p-3.5 text-[14.5px]">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-teal/25 text-teal-bright">{p.icon}</span>
              {p.text}
            </li>
          ))}
        </ul>
        {contact && (
          <a href={contact} target="_blank" rel="noreferrer" className="glass-teal mt-8 inline-flex h-[52px] items-center gap-2 rounded-full px-6 text-[16px] font-semibold">
            Quiero saber más <ChevronRight className="size-5" />
          </a>
        )}
        <p className="mt-10 flex items-center justify-center gap-2 text-[12px] text-white/50">
          <MallMark size={20} /> MallPlay · Vista privada
        </p>
      </div>
    </section>
  )
}
