import { Volume2, VolumeX } from 'lucide-react'
import { animate, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { doorSoundOn, playCartagena, playKnockOnce, playOpen, setDoorSound, stopCartagena, unlockDoorSound } from '../lib/doorSound'
import { MALL } from '../config/mall'
import { useUI } from '../state/ui'
import { useSeason } from '../state/season'
import { startTour, tourDone } from './GuidedTour'

// Portón de bienvenida: antes de ver el mall aparece la puerta colonial de la fortaleza. Hay que
// tocarla tres veces (cada toque suena, la puerta tiembla y se cuela más luz); al tercero las hojas
// se abren en 3D, la luz del interior inunda el vano y la
// vista atraviesa la puerta hasta el centro comercial (el mundo 3D carga detrás mientras tanto y
// la cámara empieza a entrar a mitad de la animación). Sola, una vez por sesión del navegador;
// después se puede volver a ver con «Ver la entrada» (useUI.showDoor).
// Todo con transiciones CSS por fases: suaves y baratas también en celulares.

const SEEN_KEY = 'cm:door-seen'
const WOOD = '#3f6b4f'
const WOOD_DARK = '#2c4d39'
const IRON = '#23201d'
const BRASS = '#d9a441'
const ARCH = '50% 50% 6px 6px / 34% 34% 6px 6px'

type Phase = 'idle' | 'open' | 'through' | 'done'
/** Toques necesarios para abrir. */
const KNOCKS = 3
/** Momento (ms desde el último toque) en que empieza cada fase. */
const TIMELINE = { open: 600, cartagena: 1700, enter: 2000, through: 2700, done: 4400, tour: 4900, overview: 6600 }
const HINTS = [`Toca la puerta ${KNOCKS} veces para entrar`, '¡Otra vez!', '¡Una más!']
const EASE = 'cubic-bezier(0.65, 0, 0.25, 1)'

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function DoorIntro({ auto }: { auto: boolean }) {
  const [phase, setPhase] = useState<Phase>(() => (auto && !alreadySeen() ? 'idle' : 'done'))
  const [sound, setSound] = useState(doorSoundOn)
  const [knocks, setKnocks] = useState(0)
  const timers = useRef<number[]>([])
  const started = useRef(false)
  // golpe natural: cada hoja cede hacia adentro y rebota (más la del lado que se toca); la puerta
  // entera se sacude apenas
  const kickL = useMotionValue(0)
  const kickR = useMotionValue(0)
  const doorX = useMotionValue(0)
  const doorTilt = useMotionValue(0)
  const doorNonce = useUI((s) => s.doorNonce)
  const halloween = useSeason() === 'halloween'

  // «Ver la entrada»: el portón vuelve a aparecer cerrado
  useEffect(() => {
    if (!doorNonce) return
    timers.current.forEach(clearTimeout)
    stopCartagena(0.2)
    timers.current = []
    started.current = false
    kickL.set(0)
    kickR.set(0)
    setKnocks(0)
    setPhase('idle')
  }, [doorNonce])
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const knock = (e?: MouseEvent<HTMLElement>) => {
    if (phase !== 'idle' || started.current) return
    unlockDoorSound()
    const n = knocks + 1
    // cada golpe un poco más decidido
    void playKnockOnce(0.8 + n * 0.1)
    setKnocks(n)
    if (!reduce) {
      // ¿de qué lado tocó? (con teclado, al centro: las dos hojas por igual)
      let side = 0
      if (e && e.clientX) {
        const r = e.currentTarget.getBoundingClientRect()
        side = e.clientX < r.left + r.width / 2 ? -1 : 1
      }
      // cada golpe empuja más fuerte y la deja un poco más entreabierta: como si estuviera cediendo
      const deg = 6 + n * 4
      const rest = n * 2.5
      const swing = (mv: MotionValue<number>, k: number) => {
        const from = mv.get()
        const r = rest * (0.6 + 0.4 * k)
        animate(mv, [from, r + deg * k, r - deg * k * 0.35, r + deg * k * 0.12, r], { duration: 0.75, times: [0, 0.14, 0.42, 0.72, 1], ease: 'easeOut' })
      }
      swing(kickL, side > 0 ? 0.45 : 1)
      swing(kickR, side < 0 ? 0.45 : 1)
      const dir = side || 1
      animate(doorX, [0, dir * (3 + n * 2), -dir * (1 + n * 0.6), 0], { duration: 0.45, ease: 'easeOut' })
      animate(doorTilt, [0, dir * (0.4 + n * 0.25), -dir * 0.15, 0], { duration: 0.5, ease: 'easeOut' })
      navigator.vibrate?.(12)
    }
    if (n >= KNOCKS) open()
  }

  const open = () => {
    started.current = true
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* sin almacenamiento: se vuelve a mostrar la próxima vez */
    }
    if (reduce) {
      void playCartagena()
      useUI.getState().arriveMall()
      setPhase('through')
      timers.current.push(window.setTimeout(() => setPhase('done'), 400))
      return
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
    at(TIMELINE.open, () => {
      setPhase('open')
      void playOpen()
    })
    at(TIMELINE.enter, () => useUI.getState().arriveMall())
    // la música y el mar empiezan cuando entra la luz, antes de cruzar
    at(TIMELINE.cartagena, () => void playCartagena())
    at(TIMELINE.through, () => setPhase('through'))
    // al aparecer el mall la música se va enseguida
    at(TIMELINE.done, () => {
      stopCartagena()
      setPhase('done')
    })
    // La primera vez: recorrido guiado (termina en la vista «Fortaleza»). Las siguientes: tras
    // mostrar de cerca el primer piso, la cámara se aleja a «Fortaleza». En ambos casos, solo si la
    // persona no tocó nada mientras tanto (otro piso, una tienda, la cancha…).
    const untouched = () => {
      const ui = useUI.getState()
      return ui.focus?.kind === 'enter' && ui.overview && !ui.selectedSpaceId && !ui.openStoreId && !ui.courtOpen
    }
    // la primera vez, el recorrido guiado; las siguientes ya se queda en la vista general
    if (!tourDone()) at(TIMELINE.tour, () => untouched() && startTour())
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (phase !== 'idle') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest?.('[aria-pressed]')) {
        e.preventDefault()
        knock()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (phase === 'done') return null
  const opened = phase === 'open' || phase === 'through'
  const through = phase === 'through'

  return (
    <div
      className="door-intro fixed inset-0 z-[60] overflow-hidden"
      role="dialog"
      aria-label="Bienvenida a MallPlay"
      style={{ opacity: through ? 0 : 1, transition: through ? `opacity 1.2s ease-in-out ${reduce ? 0 : 0.5}s` : undefined }}
    >
      {/* escena que «avanza» hacia la puerta al atravesarla */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{
          background: halloween
            ? 'radial-gradient(120% 90% at 50% 0%, #f7b267 0%, #b5655e 38%, #4b2a52 75%, #2a1838 100%)'
            : 'radial-gradient(120% 90% at 50% 0%, #f0dcb4 0%, #dcc497 45%, #b99a68 100%)',
          transform: through && !reduce ? 'scale(3.4)' : 'scale(1)',
          transformOrigin: '50% 52%',
          transition: `transform 1.7s ${EASE}`,
        }}
      >
        <StoneWall />
        {halloween && <HalloweenSky />}
        <div className="relative z-10 flex flex-col items-center px-4">
          {/* letrero sobre el portón */}
          <div
            className="mb-4 rounded-2xl border-2 px-6 py-2.5 text-center shadow-[0_6px_0_rgba(91,74,53,0.25)] sm:mb-5"
            style={{
              background: '#f5ead2',
              borderColor: '#c9b089',
              color: '#5b4a35',
              animation: 'door-rise 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both',
            }}
          >
            <p className="text-[clamp(20px,5.5vw,34px)] leading-none font-extrabold tracking-[0.06em]">{MALL.name.toUpperCase()}</p>
            <p className="mt-1 text-[clamp(11px,2.6vw,14px)] font-semibold opacity-80">{halloween ? 'Temporada de Halloween' : MALL.tagline}</p>
          </div>

          {/* portón con arco */}
          <motion.button
            type="button"
            onClick={(e) => knock(e)}
            aria-label={`Tocar la puerta para entrar al centro comercial (${knocks} de ${KNOCKS} toques)`}
            className="group relative cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            style={{
              width: 'min(78vw, 46vh, 440px)',
              aspectRatio: '3 / 4',
              borderRadius: ARCH,
              // entrada suave; luego cada golpe mueve la puerta (motion: hojas y sacudida)
              animation: phase !== 'idle' || knocks ? 'none' : 'door-rise 1s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) both',
              x: doorX,
              rotate: doorTilt,
            }}
          >
            {/* marco de piedra clara */}
            <div
              className="absolute -inset-[5%] shadow-[0_18px_40px_rgba(60,40,20,0.35)]"
              style={{ background: '#f5ead2', borderRadius: '50% 50% 12px 12px / 34% 34% 12px 12px', border: '3px solid #e2cfa7' }}
            />
            {/* vano: el interior iluminado */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ borderRadius: ARCH, perspective: 1100, clipPath: `inset(0 round ${ARCH})`, WebkitClipPath: `inset(0 round ${ARCH})` }}
            >
              <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 60% at 50% 62%, #fff6dc 0%, #ffd08a 45%, #e59a4c 100%)' }} />
              <MallGlimpse lit={opened} />
              {/* rayos de luz que giran despacio */}
              <div
                className="absolute -inset-1/2"
                style={{
                  background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,247,220,0.55) 0deg 6deg, transparent 6deg 22deg)',
                  opacity: opened ? 0.9 : 0,
                  transition: 'opacity 1.6s ease-in-out 0.3s',
                  animation: 'door-rays 14s linear infinite',
                  mixBlendMode: 'screen',
                }}
              />
              <Fanlight lit={opened} />
              <Leaf side="left" opened={opened} reduce={reduce} knocks={knocks} kick={kickL} />
              <Leaf side="right" opened={opened} reduce={reduce} knocks={knocks} kick={kickR} />
              {/* polvo que cae del marco con cada golpe */}
              {knocks > 0 && !opened && (
                <div key={knocks} className="pointer-events-none absolute inset-x-0 top-[28%]" aria-hidden>
                  {[18, 34, 52, 66, 81].map((x, i) => (
                    <span
                      key={x}
                      className="absolute size-[3px] rounded-full bg-[#e9d6ad]"
                      style={{ left: `${x}%`, animation: `door-dust ${0.9 + (i % 3) * 0.25}s ${i * 0.04}s ease-in forwards` }}
                    />
                  ))}
                </div>
              )}
              {/* rendija de luz entre las hojas (respira; con cada golpe se cuela más luz) */}
              <div
                className="absolute bottom-0 left-1/2 h-[72%] -translate-x-1/2"
                style={{
                  width: `${3 + knocks * 2.2}%`,
                  boxShadow: knocks ? `0 0 ${12 + knocks * 14}px ${knocks * 4}px rgba(255,214,140,${0.25 + knocks * 0.15})` : 'none',
                  background: 'linear-gradient(90deg, transparent, #ffe2a6 40%, #fff6dc 50%, #ffe2a6 60%, transparent)',
                  filter: 'blur(2px)',
                  opacity: opened ? 0 : 1,
                  transition: 'opacity 0.3s, width 0.4s ease-out, box-shadow 0.4s ease-out',
                  animation: 'door-breathe 2.6s ease-in-out infinite',
                }}
              />
            </div>
            {/* faroles */}
            {[-1, 1].map((s) => (
              <span key={s} className="absolute top-[38%] hidden sm:block" style={{ [s < 0 ? 'left' : 'right']: '-17%' }}>
                <Lantern delay={s < 0 ? 0 : 0.7} />
              </span>
            ))}
          </motion.button>

          {/* escalinata */}
          <div className="relative mt-[5%] flex flex-col items-center" style={{ animation: 'door-rise 1s 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) both' }}>
            {halloween &&
              [-1, 1].map((s) => (
                <span key={s} className="absolute bottom-full mb-[-6px]" style={{ [s < 0 ? 'left' : 'right']: '2%' }}>
                  <PumpkinIcon size={s < 0 ? 46 : 38} delay={s < 0 ? 0 : 0.6} />
                </span>
              ))}
            <div className="h-3 rounded-sm" style={{ width: 'min(86vw, 52vh, 500px)', background: '#c4a87a' }} />
            <div className="h-3 rounded-sm" style={{ width: 'min(94vw, 58vh, 560px)', background: '#b3966a' }} />
          </div>

          <div
            className="mt-5 flex flex-col items-center gap-2"
            style={{ opacity: phase === 'idle' ? 1 : 0, transform: phase === 'idle' ? 'none' : 'translateY(8px)', transition: 'opacity 0.3s, transform 0.3s' }}
            aria-live="polite"
          >
            <p
              key={knocks}
              className="rounded-full bg-[#2c4d39] px-5 py-2.5 text-sm font-bold text-white shadow-soft"
              style={{ animation: knocks ? 'door-pop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1)' : 'door-hint 2.2s 1.2s ease-in-out infinite' }}
            >
              {HINTS[Math.min(knocks, HINTS.length - 1)]}
            </p>
            {/* un punto por golpe */}
            <div className="flex gap-2" aria-hidden>
              {Array.from({ length: KNOCKS }, (_, i) => (
                <span
                  key={i}
                  className="size-3 rounded-full border-2 transition-all duration-300"
                  style={{ borderColor: BRASS, background: i < knocks ? BRASS : 'transparent', transform: i < knocks ? 'scale(1.15)' : 'scale(1)', boxShadow: i < knocks ? `0 0 10px ${BRASS}` : 'none' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* sonido sí / no (se recuerda en este navegador) */}
      <button
        type="button"
        onClick={() => {
          setDoorSound(!sound)
          setSound(!sound)
          if (!sound) {
            unlockDoorSound()
            void playKnockOnce()
          }
        }}
        aria-pressed={sound}
        aria-label={sound ? 'Silenciar sonidos de la puerta' : 'Activar sonidos de la puerta'}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-2 text-xs font-bold text-[#5b4a35] shadow-soft backdrop-blur transition hover:bg-white"
        style={{ opacity: phase === 'idle' ? 1 : 0, transition: 'opacity 0.3s' }}
      >
        {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} {sound ? 'Sonido' : 'Sin sonido'}
      </button>
      {/* destello cálido al cruzar el umbral */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(60% 60% at 50% 52%, #fff8e6 0%, #ffe0a3 55%, rgba(255,214,140,0) 100%)',
          opacity: through ? 1 : 0,
          transition: `opacity 0.9s ease-in-out ${reduce ? 0 : 0.35}s`,
        }}
      />
    </div>
  )
}

/** Una hoja de madera con tableros, clavos de hierro y aldaba de bronce; gira sobre su bisagra. */
function Leaf({ side, opened, reduce, knocks, kick }: { side: 'left' | 'right'; opened: boolean; reduce: boolean; knocks: number; kick: MotionValue<number> }) {
  const s = side === 'left' ? -1 : 1
  const studs: [number, number][] = []
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) studs.push([18 + c * 32, 9 + r * 16.4])
  const style: CSSProperties = {
    [side]: 0,
    transformOrigin: `${side} center`,
    transform: opened ? `rotateY(${s * (reduce ? 0 : 104)}deg)` : 'rotateY(0deg)',
    opacity: opened && reduce ? 0 : 1,
    transition: `transform 2.4s cubic-bezier(0.45, 0, 0.2, 1), opacity 0.3s`,
    transformStyle: 'preserve-3d',
  }
  // el golpe gira la hoja sobre la misma bisagra, hacia adentro (como al abrir)
  const rotateY = useTransform(kick, (v) => s * v)
  return (
    <div className="absolute bottom-0 h-[72%] w-1/2" style={style}>
      <motion.div
        className="absolute inset-0"
        style={{
          rotateY,
          transformOrigin: `${side} center`,
          background: `linear-gradient(${side === 'left' ? 90 : 270}deg, ${WOOD_DARK}, ${WOOD} 30%, ${WOOD} 85%, ${WOOD_DARK})`,
          boxShadow: opened ? `${-s * 18}px 0 30px rgba(40,25,10,0.45)` : 'none',
        }}
      >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        {[
          [10, 6, 80, 40],
          [10, 52, 80, 42],
        ].map(([x, y, w, h], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill="none" stroke={WOOD_DARK} strokeWidth="2.2" />
            <rect x={x + 3} y={y + 2.5} width={w - 6} height={h - 5} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
          </g>
        ))}
        {[14, 82].map((y) => (
          <rect key={y} x={side === 'left' ? 0 : 60} y={y} width="40" height="3" fill={IRON} />
        ))}
        <rect x={side === 'left' ? 98 : 0} y="0" width="2" height="100" fill={WOOD_DARK} />
      </svg>
      {studs.map(([x, y], i) => (
        <span key={i} className="absolute w-[5%] rounded-full" style={{ left: `${x}%`, top: `${y}%`, aspectRatio: '1', background: `radial-gradient(circle at 35% 30%, #6d655c, ${IRON})` }} />
      ))}
      {/* aldaba: argolla de bronce que se mece */}
      <span className="absolute top-[44%] w-[8%] rounded-full" style={{ [side === 'left' ? 'right' : 'left']: '19%', aspectRatio: '1', background: BRASS }} />
      <span
        className="absolute top-[46%] w-[26%] rounded-full border-[3px]"
        style={{
          [side === 'left' ? 'right' : 'left']: '10%',
          aspectRatio: '1',
          borderColor: BRASS,
          boxShadow: '0 2px 0 rgba(0,0,0,0.35)',
          transformOrigin: '50% 0%',
          // con cada golpe la argolla da un salto y luego vuelve a mecerse
          animation: knocks
            ? `door-hit-${knocks % 2} 0.7s ease-out, door-sway 3.2s 0.7s ease-in-out infinite`
            : `door-sway 3.2s ${side === 'left' ? 0 : 0.4}s ease-in-out infinite`,
        }}
      />
      </motion.div>
    </div>
  )
}

function Fanlight({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[28%] w-full">
      <path d="M0 40 V30 A50 34 0 0 1 100 30 V40 Z" fill={WOOD_DARK} />
      <path d="M8 40 V31 A42 28 0 0 1 92 31 V40 Z" fill={lit ? 'rgba(255,236,190,0.95)' : 'rgba(255,214,140,0.55)'} style={{ transition: 'fill 0.8s' }} />
      {[-60, -30, 0, 30, 60].map((a) => (
        <line key={a} x1="50" y1="40" x2={50 + Math.sin((a * Math.PI) / 180) * 46} y2={40 - Math.cos((a * Math.PI) / 180) * 34} stroke={WOOD_DARK} strokeWidth="2.2" />
      ))}
      <rect x="0" y="37" width="100" height="3" fill={IRON} />
    </svg>
  )
}

/**
 * Lo que se alcanza a ver al abrir: un pasillo del mall en perspectiva, con locales a lado y lado
 * (letrero de color, toldo a rayas y vitrina encendida), gente paseando, luces colgantes y la plaza
 * con su fuente y palmera al fondo.
 */
function MallGlimpse({ lit }: { lit: boolean }) {
  // paredes: la línea de arriba y la de abajo van del borde (f = 0) al fondo (f = 1)
  const wallX = (f: number) => 38 * f
  const top = (f: number) => 12 + 32 * f
  const bottom = (f: number) => 97 - 39 * f
  const pt = (side: number, f: number, v: number) => {
    const x = wallX(f)
    const y = top(f) + (bottom(f) - top(f)) * v
    return `${side < 0 ? x : 100 - x},${y}`
  }
  const quad = (side: number, f0: number, f1: number, v0: number, v1: number) => [pt(side, f0, v0), pt(side, f1, v0), pt(side, f1, v1), pt(side, f0, v1)].join(' ')
  const cuts = [0, 0.4, 0.64, 0.79, 0.89, 0.96]
  const colors = ['#e0735f', '#3b82a6', '#c2607f', '#5f9a6e', '#7a6ff0', '#e09a1f', '#2bb3b1', '#d0784f']
  const shops = [-1, 1].flatMap((side, si) =>
    cuts.slice(0, -1).map((f0, i) => ({ side, f0: f0 + 0.008, f1: cuts[i + 1] - 0.008, color: colors[(i * 2 + si) % colors.length], i })),
  )
  const people: [number, number, number, string][] = [
    [30, 86, 1, '#3d7ea6'],
    [66, 80, 0.85, '#e07a5f'],
    [43, 71, 0.6, '#81b29a'],
    [58, 66, 0.45, '#6c5b7b'],
    [52, 75, 0.7, '#f2cc8f'],
  ]
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      style={{ opacity: lit ? 1 : 0.55, transform: lit ? 'scale(1)' : 'scale(0.94)', transformOrigin: '50% 52%', transition: `opacity 1.6s, transform 2.6s ${EASE}` }}
      aria-hidden
    >
      <defs>
        <linearGradient id="dg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7e3" />
          <stop offset="1" stopColor="#ffe2ad" />
        </linearGradient>
        <linearGradient id="dg-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3e3c3" />
          <stop offset="1" stopColor="#e8d2a8" />
        </linearGradient>
        <linearGradient id="dg-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="1" stopColor="#ffd796" />
        </linearGradient>
      </defs>
      {/* techo con claraboya y vigas */}
      <polygon points="0,0 100,0 62,44 38,44" fill="url(#dg-sky)" />
      {[0, 25, 50, 75, 100].map((x) => (
        <line key={x} x1={x} y1="0" x2={38 + (x / 100) * 24} y2="44" stroke="#e7cf9f" strokeWidth="0.6" />
      ))}
      {/* piso con juntas que fugan al fondo */}
      <polygon points="0,100 100,100 62,58 38,58" fill="url(#dg-floor)" />
      {[0, 20, 40, 60, 80, 100].map((x) => (
        <line key={x} x1={x} y1="100" x2={38 + (x / 100) * 24} y2="58" stroke="#dcc39a" strokeWidth="0.4" />
      ))}
      {[66, 74, 85].map((y) => (
        <line key={y} x1={((y - 58) / 42) * -38 + 38} y1={y} x2={100 - (((y - 58) / 42) * -38 + 38)} y2={y} stroke="#dcc39a" strokeWidth="0.4" />
      ))}
      {/* fondo: plaza con fuente y palmera */}
      <rect x="38" y="44" width="24" height="14" fill="#fbf1dc" />
      <ellipse cx="50" cy="57" rx="7" ry="1.6" fill="#7cc7c0" />
      <rect x="49.3" y="52" width="1.4" height="5" fill="#e9dcc2" />
      <rect x="56.5" y="47" width="0.7" height="10" fill="#a07a55" />
      {[0, 1, 2, 3, 4].map((k) => (
        <ellipse key={k} cx={56.85 + Math.cos(k * 1.25) * 2.2} cy={46.6 + Math.sin(k * 1.25) * 0.7} rx="2.3" ry="0.6" transform={`rotate(${k * 72 - 20} ${56.85 + Math.cos(k * 1.25) * 2.2} ${46.6 + Math.sin(k * 1.25) * 0.7})`} fill="#5f9a6e" />
      ))}
      {/* paredes del pasillo y los locales */}
      {[-1, 1].map((side) => (
        <polygon key={side} points={quad(side, 0, 1, 0, 1)} fill="#efe2c8" />
      ))}
      {shops.map(({ side, f0, f1, color, i }) => (
        <g key={`${side}${i}`}>
          <polygon points={quad(side, f0, f1, 0.08, 1)} fill="#fbf4e6" />
          <polygon points={quad(side, f0, f1, 0.08, 0.2)} fill={color} />
          {/* toldo a rayas */}
          {[0, 1, 2, 3].map((k) => (
            <polygon key={k} points={quad(side, f0 + ((f1 - f0) * k) / 4, f0 + ((f1 - f0) * (k + 1)) / 4, 0.2, 0.29)} fill={k % 2 ? '#ffffff' : color} opacity={0.92} />
          ))}
          {/* vitrina encendida y puerta */}
          <polygon points={quad(side, f0 + (f1 - f0) * 0.08, f0 + (f1 - f0) * 0.62, 0.36, 0.9)} fill="url(#dg-glass)" />
          <polygon points={quad(side, f0 + (f1 - f0) * 0.7, f0 + (f1 - f0) * 0.92, 0.42, 1)} fill="#d9b98a" />
          {/* letras del letrero */}
          <polygon points={quad(side, f0 + (f1 - f0) * 0.18, f0 + (f1 - f0) * 0.7, 0.125, 0.155)} fill="#ffffff" opacity={0.85} />
        </g>
      ))}
      {/* luces colgantes a lo largo del pasillo */}
      {[0.15, 0.4, 0.6, 0.75, 0.86].map((f, i) => {
        const y = top(f) + 3 - f * 1.5
        return (
          <g key={i}>
            <line x1="50" y1={y - 4 + f * 2} x2="50" y2={y} stroke="#b08c5a" strokeWidth="0.25" />
            <circle cx="50" cy={y} r={1.6 - f * 1.1} fill="#fff1c4" style={{ filter: 'drop-shadow(0 0 1.2px #ffd27a)' }} />
          </g>
        )
      })}
      {/* gente paseando */}
      {people.map(([x, y, s, c], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <ellipse cx="0" cy="0.4" rx="2" ry="0.5" fill="rgba(80,58,30,0.18)" />
          <rect x="-1.1" y="-6.2" width="2.2" height="6.2" rx="1.1" fill={c} />
          <circle cx="0" cy="-7.4" r="1.05" fill="#c58c64" />
        </g>
      ))}
    </svg>
  )
}

function Lantern({ delay }: { delay: number }) {
  return (
    <svg width="34" height="64" viewBox="0 0 34 64" aria-hidden>
      <rect x="15" y="0" width="4" height="10" fill={IRON} />
      <path d="M5 14 L17 8 L29 14 Z" fill={IRON} />
      <rect x="7" y="14" width="20" height="26" rx="2" fill="#ffd58a" stroke={IRON} strokeWidth="3" />
      <rect x="5" y="40" width="24" height="5" fill={IRON} />
      <circle cx="17" cy="27" r="16" fill="#ffd58a" style={{ animation: `door-flicker 1.8s ${delay}s ease-in-out infinite` }} />
    </svg>
  )
}

/** Muro de piedra de la fortaleza de fondo, con almenas arriba. */
function StoneWall() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage: 'linear-gradient(#a98c5f 2px, transparent 2px), linear-gradient(90deg, #a98c5f 2px, transparent 2px)',
          backgroundSize: '96px 48px',
        }}
      />
      <div className="absolute inset-x-0 top-0 flex h-10 justify-center gap-6 sm:h-14">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="h-full w-10 shrink-0 rounded-b-sm sm:w-14" style={{ background: '#b4986a' }} />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/4" style={{ background: 'linear-gradient(transparent, rgba(80,58,30,0.35))' }} />
    </div>
  )
}

/** Calabaza tallada con la cara encendida (temporada de Halloween). */
function PumpkinIcon({ size, delay }: { size: number; delay: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M20 6 q1 -4 4 -4" stroke="#5b6b2a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="20" cy="23" rx="17" ry="13" fill="#e8761c" />
      <ellipse cx="13" cy="23" rx="7" ry="12.5" fill="#d2661a" />
      <ellipse cx="27" cy="23" rx="7" ry="12.5" fill="#d2661a" />
      <ellipse cx="20" cy="23" rx="6" ry="13" fill="#ef8a2c" />
      <g fill="#ffd36b" style={{ animation: `door-flicker 1.6s ${delay}s ease-in-out infinite` }}>
        <path d="M10 20 L16 20 L13 15 Z" />
        <path d="M24 20 L30 20 L27 15 Z" />
        <path d="M11 26 L14 29 L17 26 L20 29 L23 26 L26 29 L29 26 Q20 35 11 26 Z" />
      </g>
    </svg>
  )
}

/** Cielo de Halloween sobre la fortaleza: luna y murciélagos que cruzan. */
function HalloweenSky() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute top-[9%] right-[12%] size-16 rounded-full sm:size-24" style={{ background: 'radial-gradient(circle at 40% 40%, #fff6dc, #ffd98a 60%, #f0a95a)', boxShadow: '0 0 60px 18px rgba(255,200,120,0.35)' }} />
      {[
        [18, 0, 1],
        [26, 2.5, 0.8],
        [12, 5, 0.65],
      ].map(([top, delay, s], i) => (
        <svg key={i} className="absolute" width={46 * s} height={22 * s} viewBox="0 0 46 22" style={{ top: `${top}%`, left: '-10%', animation: `door-bat 9s ${delay}s linear infinite` }}>
          <path d="M23 9 C19 2 11 1 2 6 C8 6 10 9 11 13 C14 10 18 11 20 15 L23 12 L26 15 C28 11 32 10 35 13 C36 9 38 6 44 6 C35 1 27 2 23 9 Z" fill="#241a2e" />
        </svg>
      ))}
    </div>
  )
}
