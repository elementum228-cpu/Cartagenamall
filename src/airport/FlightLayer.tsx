import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Plane, PlaneLanding, PlaneTakeoff, Ticket, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { islandPlaneAnchor } from './anchor'
import { playCabinChime } from './sounds'
import { FLYING_MS, LANDING_MS, TAKEOFF_MS, TAXI_FRAC, TOUCHDOWN, useFlight } from './flight'

// Pantallas del viaje a Isla Descuento: terminal con tablero de salidas y tiquete gratis, pase de
// abordar, aviso de despegue, pantalla de vuelo (cargando, pero volando) y bienvenida a la isla.
// Mientras se está en la isla, un botón para volver al mall en avión.

const SPRING = { type: 'spring', stiffness: 360, damping: 32 } as const
const NAVY = '#0d2a3f'
const GOLD = '#f5c542'

function Shell({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-y-auto px-4 py-10 text-white"
      style={{ background: `radial-gradient(120% 80% at 50% 0%, #1c5b78 0%, ${NAVY} 60%, #071a28 100%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {onClose && (
        <button className="absolute top-[max(16px,env(safe-area-inset-top))] right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white" aria-label="Salir de la terminal" onClick={onClose}>
          <X className="size-5" />
        </button>
      )}
      {children}
    </motion.div>
  )
}

/** Terminal: tablero de salidas y tiquete gratis a Isla Descuento. */
function Terminal() {
  const [name, setName] = useState('')
  const { getTicket, cancel } = useFlight.getState()
  const rows = [
    { f: 'CM 001', to: 'Isla Descuento', gate: 'A1', st: 'Abordando', on: true },
    { f: 'CM 002', to: 'Islas del Rosario', gate: 'A2', st: 'Próximamente', on: false },
    { f: 'CM 003', to: 'Barú', gate: 'B1', st: 'Próximamente', on: false },
  ]
  return (
    <Shell onClose={cancel}>
      <motion.p className="text-[13px] font-semibold tracking-[0.2em] text-white/60 uppercase" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
        Aeropuerto Cartagena Mall
      </motion.p>
      <motion.h1 className="mt-1 text-center text-[28px] leading-tight font-extrabold" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        Prepara tu viaje
      </motion.h1>
      {/* tablero de salidas */}
      <motion.div className="mt-5 w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/10 bg-black/35 font-mono text-[13px]" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...SPRING, delay: 0.2 }}>
        <div className="flex items-center gap-2 bg-white/5 px-4 py-2 text-[11px] font-bold tracking-widest text-[#ffd27a] uppercase">
          <PlaneTakeoff className="size-4" /> Salidas
        </div>
        {rows.map((r) => (
          <div key={r.f} className={`grid grid-cols-[64px_1fr_36px_96px] items-center gap-2 border-t border-white/5 px-4 py-2 ${r.on ? 'text-white' : 'text-white/45'}`}>
            <span className="text-[#ffd27a]">{r.f}</span>
            <span className="truncate">{r.to}</span>
            <span>{r.gate}</span>
            <span className={`text-right font-bold ${r.on ? 'text-[#3ddc84] motion-safe:animate-pulse' : ''}`}>{r.st}</span>
          </div>
        ))}
      </motion.div>
      {/* tiquete */}
      <motion.div className="mt-5 w-full max-w-[400px] rounded-[26px] bg-white p-5 text-[#0d2a3f] shadow-[0_24px_60px_rgb(0_0_0/0.4)]" initial={{ y: 30, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ ...SPRING, delay: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[30px] leading-none font-black">CTG</p>
            <p className="text-[12px] text-[#5b6670]">Cartagena Mall</p>
          </div>
          <div className="flex flex-1 items-center gap-1 px-3 text-[#13b9ad]">
            <span className="h-px flex-1 border-t-2 border-dashed border-[#13b9ad]/50" />
            <Plane className="size-5" />
            <span className="h-px flex-1 border-t-2 border-dashed border-[#13b9ad]/50" />
          </div>
          <div className="text-right">
            <p className="text-[30px] leading-none font-black">IDS</p>
            <p className="text-[12px] text-[#5b6670]">Isla Descuento</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f4f1ea] px-4 py-3">
          <span className="text-[14px] font-semibold">Vuelo CM 001 · Clase Descuento</span>
          <span className="text-[18px] font-black text-[#0f8f86]">GRATIS</span>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[12px] font-bold text-[#5b6670]">Nombre del pasajero</span>
          <input
            className="w-full rounded-xl border border-[#e3ded3] px-3.5 py-3 text-[15px] outline-none focus:border-[#13b9ad]"
            placeholder="¿Cómo te llamas?"
            value={name}
            maxLength={28}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#1fc7b6] to-[#0f8f86] text-[16px] font-semibold text-white shadow-[0_8px_24px_rgb(19_185_173/0.45)] transition active:scale-[0.98]"
          onClick={() => getTicket(name)}
        >
          <Ticket className="size-5" /> Obtener mi tiquete gratis
        </button>
      </motion.div>
    </Shell>
  )
}

/** Código de barras decorativo (a partir del código de reserva). */
function Barcode({ code }: { code: string }) {
  const bars = Array.from({ length: 46 }, (_, i) => ((code.charCodeAt(i % code.length) * (i + 7)) % 4) + 1)
  return (
    <div className="flex h-12 items-stretch gap-[2px]" aria-hidden>
      {bars.map((w, i) => (
        <span key={i} className="bg-[#0d2a3f]" style={{ width: w, opacity: i % 5 === 0 ? 0.55 : 1 }} />
      ))}
    </div>
  )
}

/** Pase de abordar: entra girando como un papel que te entregan; «Despegar» arranca el avión. */
function BoardingPassScreen() {
  const pass = useFlight((s) => s.pass)
  const { takeoff, cancel } = useFlight.getState()
  if (!pass) return null
  const field = (k: string, v: string) => (
    <div>
      <p className="text-[10.5px] font-bold tracking-wider text-[#5b6670] uppercase">{k}</p>
      <p className="text-[17px] font-extrabold">{v}</p>
    </div>
  )
  return (
    <Shell onClose={cancel}>
      <motion.p className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-[#9fe3dc]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Ticket className="size-4" /> ¡Listo! Este es tu pase de abordar
      </motion.p>
      <motion.div
        className="w-full max-w-[360px] overflow-hidden rounded-[26px] bg-white text-[#0d2a3f] shadow-[0_30px_80px_rgb(0_0_0/0.45)]"
        initial={{ y: 120, rotate: -8, opacity: 0 }}
        animate={{ y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      >
        <div className="flex items-center justify-between px-5 py-3 text-white" style={{ background: `linear-gradient(90deg, ${NAVY}, #13b9ad)` }}>
          <span className="flex items-center gap-2 text-[13px] font-bold tracking-wider uppercase">
            <Plane className="size-4" /> Pase de abordar
          </span>
          <span className="text-[12px] font-semibold opacity-80">Cartagena Mall Air</span>
        </div>
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[34px] leading-none font-black">CTG</p>
              <p className="text-[12px] text-[#5b6670]">Cartagena Mall</p>
            </div>
            <Plane className="size-6 text-[#13b9ad]" />
            <div className="text-right">
              <p className="text-[34px] leading-none font-black">IDS</p>
              <p className="text-[12px] text-[#5b6670]">Isla Descuento</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="col-span-3">{field('Pasajero', pass.name)}</div>
            {field('Vuelo', pass.flight)}
            {field('Puerta', pass.gate)}
            {field('Asiento', pass.seat)}
            {field('Abordaje', pass.time)}
            {field('Clase', 'Descuento')}
            {field('Tarifa', '$0')}
          </div>
        </div>
        {/* perforación */}
        <div className="relative my-4 border-t-2 border-dashed border-[#e3ded3]">
          <span className="absolute -top-3 -left-3 size-6 rounded-full bg-[#0d2a3f]" />
          <span className="absolute -top-3 -right-3 size-6 rounded-full bg-[#0d2a3f]" />
        </div>
        <div className="flex items-end justify-between gap-3 px-5 pb-5">
          <Barcode code={pass.code} />
          <span className="font-mono text-[13px] font-bold">{pass.code}</span>
        </div>
      </motion.div>
      <motion.button
        className="mt-6 flex h-14 w-full max-w-[360px] items-center justify-center gap-2 rounded-full text-[17px] font-bold text-[#0d2a3f] shadow-[0_10px_30px_rgb(245_197_66/0.45)] transition active:scale-[0.98]"
        style={{ background: GOLD }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING, delay: 0.6 }}
        onClick={takeoff}
      >
        <PlaneTakeoff className="size-5" /> Despegar <ChevronRight className="size-5" />
      </motion.button>
    </Shell>
  )
}

/** Mientras el avión rueda y despega en el mapa: un aviso discreto arriba que cuenta qué pasa. */
function TakeoffNotice({ from = 'Cartagena Mall' }: { from?: string }) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const ids = [window.setTimeout(() => setPhase(1), TAKEOFF_MS * TAXI_FRAC * 0.82), window.setTimeout(() => setPhase(2), TAKEOFF_MS * TAXI_FRAC)]
    return () => ids.forEach(clearTimeout)
  }, [])
  const text = ['Rodando hacia la cabecera de la pista…', 'En posición. Listos para despegar', `Despegando de ${from}…`][phase]
  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 top-[max(14px,env(safe-area-inset-top))] z-[80] flex justify-center"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      transition={SPRING}
    >
      <span className="flex items-center gap-2 rounded-full bg-[#0d2a3f]/85 px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg backdrop-blur-xl">
        <PlaneTakeoff className="size-4 text-[#f5c542]" />
        <motion.span key={phase} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          {text}
        </motion.span>
      </span>
    </motion.div>
  )
}

/** Durante el aterrizaje en la isla: aviso arriba. */
function LandingNotice({ to = 'la Isla de los Descuentos' }: { to?: string }) {
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setTouched(true), LANDING_MS * TOUCHDOWN)
    return () => clearTimeout(id)
  }, [])
  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 top-[max(14px,env(safe-area-inset-top))] z-[80] flex justify-center"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      transition={SPRING}
    >
      <span className="flex items-center gap-2 rounded-full bg-[#0d2a3f]/85 px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg backdrop-blur-xl">
        <PlaneLanding className="size-4 text-[#f5c542]" />
        <motion.span key={String(touched)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          {touched ? '¡Aterrizamos! Frenando en la pista…' : `Aproximación a ${to}…`}
        </motion.span>
      </span>
    </motion.div>
  )
}

/** Pantalla de vuelo: cielo, nubes que pasan, el avión meciéndose y la ruta que avanza (cargando). */
function Flying() {
  const back = useFlight((s) => s.direction) === 'back'
  const duration = back ? 3.2 : FLYING_MS / 1000
  const clouds = Array.from({ length: 9 }, (_, i) => ({ top: 8 + ((i * 37) % 80), size: 90 + ((i * 53) % 120), delay: -(i * 1.3), dur: 4 + (i % 4) * 1.6, o: 0.5 + (i % 3) * 0.17 }))
  return (
    <motion.div
      className="fixed inset-0 z-[85] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #7cc8ee 0%, #bfe6f7 55%, #f6e7c8 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
    >
      {clouds.map((c, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ top: `${c.top}%`, width: c.size, height: c.size * 0.42, opacity: c.o, filter: 'blur(2px)' }}
          initial={{ x: '110vw' }}
          animate={{ x: '-40vw' }}
          transition={{ duration: c.dur, repeat: Infinity, ease: 'linear', delay: c.delay }}
        />
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-[#0d2a3f]">
        <motion.div animate={{ y: [0, -10, 0], rotate: [-2, 2, -2] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
          <Plane className="size-24 rotate-45 fill-white text-[#0d2a3f] drop-shadow-[0_18px_20px_rgb(13_42_63/0.25)]" strokeWidth={1.4} />
        </motion.div>
        <p className="mt-8 text-[22px] font-extrabold">{back ? 'Volviendo a Cartagena Mall' : 'Volando a la Isla de los Descuentos'}</p>
        <p className="mt-1 text-[14px] font-semibold opacity-70">{back ? 'Abróchate el cinturón…' : 'Preparando la isla para ti…'}</p>
        {/* ruta con el avión que avanza: la barra de carga */}
        <div className="mt-7 w-full max-w-[340px]">
          <div className="flex items-center justify-between text-[13px] font-black">
            <span>{back ? 'IDS' : 'CTG'}</span>
            <span>{back ? 'CTG' : 'IDS'}</span>
          </div>
          <div className="relative mt-2 h-6">
            <span className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-[#0d2a3f]/30" />
            <motion.span className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-[#13b9ad]" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration, ease: 'easeInOut' }} />
            <motion.span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" initial={{ left: '0%' }} animate={{ left: '100%' }} transition={{ duration, ease: 'easeInOut' }}>
              <Plane className="size-6 rotate-45 fill-[#13b9ad] text-[#0d2a3f]" strokeWidth={1.5} />
            </motion.span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/** Bienvenida al aterrizar. */
function Arrived() {
  const explore = useFlight.getState().explore
  return (
    <motion.div className="fixed inset-x-0 bottom-[calc(var(--chrome-bottom,96px)+12px)] z-[80] flex justify-center px-4" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={SPRING}>
      <div className="w-full max-w-[380px] rounded-[26px] border border-white/25 bg-[#0d2a3f]/80 p-5 text-center text-white shadow-[0_18px_50px_rgb(0_0_0/0.35)] backdrop-blur-xl">
        <span className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl" style={{ background: GOLD, color: NAVY }}>
          <PlaneLanding className="size-6" />
        </span>
        <p className="text-[14px] font-semibold text-white/75">Aterrizaste en</p>
        <p className="text-[24px] leading-tight font-extrabold text-[#f5c542]">¡Bienvenido a la Isla de los Descuentos!</p>
        <p className="mt-1.5 text-[14px] leading-snug text-white/80">Un castillo-isla de una sola planta: outlet, ofertas, variedad y locales disponibles para tu negocio.</p>
        <button className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#1fc7b6] to-[#0f8f86] text-[16px] font-semibold shadow-[0_8px_24px_rgb(19_185_173/0.45)] transition active:scale-[0.98]" onClick={explore}>
          Explorar la isla <ChevronRight className="size-5" />
        </button>
      </div>
    </motion.div>
  )
}

/** Invitación de regreso: tarjeta de vidrio sobre el avión de la isla (sigue la cámara). */
function ReturnInvite() {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = box.current
      if (el) {
        el.style.transform = `translate(${islandPlaneAnchor.x}px, ${islandPlaneAnchor.y}px) translate(-50%, -100%)`
        el.style.visibility = islandPlaneAnchor.visible ? 'visible' : 'hidden'
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  const { setReturnOpen, flyBack } = useFlight.getState()
  return (
    <div ref={box} className="pointer-events-none fixed top-0 left-0 z-30">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.96 }}
        transition={SPRING}
        className="pointer-events-auto relative mb-3 w-[272px] rounded-[26px] border border-white/25 bg-[#0d2a3f]/72 px-5 pt-7 pb-5 text-center text-white shadow-[0_18px_50px_rgb(0_0_0/0.35)] backdrop-blur-xl"
      >
        <span className="absolute -top-5 left-1/2 grid h-10 w-[74px] -translate-x-1/2 -rotate-6 place-items-center rounded-lg bg-[#f5c542] text-[#0d2a3f] shadow-[0_6px_18px_rgb(245_197_66/0.45)]" aria-hidden>
          <Plane className="size-5" strokeWidth={2.2} />
        </span>
        <button className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full bg-white/10 text-white/80" aria-label="Cerrar" onClick={() => setReturnOpen(false)}>
          <X className="size-4" />
        </button>
        <p className="text-[17px] leading-snug font-semibold">¿Listo para volver a</p>
        <p className="text-[19px] leading-snug font-extrabold text-[#f5c542]">Cartagena Mall?</p>
        <p className="mt-1 text-[13.5px] text-white/80">Vuelo CM 002 · Isla → Cartagena</p>
        <button
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#1fc7b6] to-[#0f8f86] text-[16px] font-semibold shadow-[0_8px_24px_rgb(19_185_173/0.45)] transition active:scale-[0.98]"
          onClick={() => {
            void playCabinChime()
            flyBack()
          }}
        >
          <PlaneTakeoff className="size-5" /> Volar de regreso <ChevronRight className="size-5" />
        </button>
        <span className="absolute -bottom-2.5 left-1/2 size-5 -translate-x-1/2 rotate-45 border-r border-b border-white/25 bg-[#0d2a3f]" aria-hidden />
      </motion.div>
    </div>
  )
}

/** En la isla: título arriba y botón para volver al mall en avión. */
function IslandHud() {
  return (
    <>
      <motion.div className="pointer-events-none fixed inset-x-0 top-[calc(var(--chrome-top,72px)+4px)] z-20 flex justify-center" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
        <span className="flex items-center gap-2 rounded-full bg-[#0d2a3f]/80 px-4 py-2 text-[14px] font-bold text-white shadow-lg backdrop-blur-xl">
          <span className="size-2 rounded-full bg-[#e85a8a]" /> Isla de los Descuentos · toca un local
        </span>
      </motion.div>
      <motion.div className="fixed inset-x-0 bottom-[calc(var(--chrome-bottom,96px)+16px)] z-20 flex justify-center px-4" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
        <button
          className="flex h-[52px] items-center gap-2 rounded-full bg-gradient-to-b from-[#1fc7b6] to-[#0f8f86] px-6 text-[16px] font-semibold text-white shadow-[0_8px_24px_rgb(19_185_173/0.45)] transition active:scale-[0.98]"
          onClick={() => useFlight.getState().flyBack()}
        >
          <PlaneTakeoff className="size-5" /> Volver al mall
        </button>
      </motion.div>
    </>
  )
}

export function FlightLayer() {
  const step = useFlight((s) => s.step)
  const world = useFlight((s) => s.world)
  const returnOpen = useFlight((s) => s.returnOpen)
  // en la isla se esconden los controles propios del mall (categorías, pisos, botón principal)
  useEffect(() => {
    document.documentElement.classList.toggle('island-on', world === 'island')
  }, [world])
  return (
    <AnimatePresence>
      {step === 'terminal' && <Terminal key="terminal" />}
      {step === 'pass' && <BoardingPassScreen key="pass" />}
      {step === 'takeoff' && <TakeoffNotice key="takeoff" />}
      {step === 'flying' && <Flying key="flying" />}
      {step === 'landing' && <LandingNotice key="landing" />}
      {step === 'departIsland' && <TakeoffNotice key="depart" from="la Isla de los Descuentos" />}
      {step === 'landMall' && <LandingNotice key="landMall" to="Cartagena Mall" />}
      {step === 'arrived' && <Arrived key="arrived" />}
      {step === null && world === 'island' && <IslandHud key="hud" />}
      {step === null && world === 'island' && returnOpen && <ReturnInvite key="return" />}
    </AnimatePresence>
  )
}
