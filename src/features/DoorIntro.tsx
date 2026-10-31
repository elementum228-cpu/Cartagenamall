import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { doorSoundOn, playCartagena, playKnockOnce, playOpen, setDoorSound, unlockDoorSound } from '../lib/doorSound'
import { MALL } from '../config/mall'
import { useUI } from '../state/ui'

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
const TIMELINE = { open: 600, cartagena: 1700, enter: 2000, through: 2700, done: 4400 }
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
  const doorNonce = useUI((s) => s.doorNonce)

  // «Ver la entrada»: el portón vuelve a aparecer cerrado
  useEffect(() => {
    if (!doorNonce) return
    timers.current.forEach(clearTimeout)
    timers.current = []
    started.current = false
    setKnocks(0)
    setPhase('idle')
  }, [doorNonce])
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const knock = () => {
    if (phase !== 'idle' || started.current) return
    unlockDoorSound()
    const n = knocks + 1
    // cada golpe un poco más decidido
    void playKnockOnce(0.8 + n * 0.1)
    setKnocks(n)
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
      useUI.getState().enterMall()
      setPhase('through')
      timers.current.push(window.setTimeout(() => setPhase('done'), 400))
      return
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
    at(TIMELINE.open, () => {
      setPhase('open')
      void playOpen()
    })
    at(TIMELINE.enter, () => useUI.getState().enterMall())
    // la música y el mar empiezan cuando entra la luz, antes de cruzar
    at(TIMELINE.cartagena, () => void playCartagena())
    at(TIMELINE.through, () => setPhase('through'))
    at(TIMELINE.done, () => setPhase('done'))
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
      aria-label="Bienvenida a Cartagena Mall"
      style={{ opacity: through ? 0 : 1, transition: through ? `opacity 1.2s ease-in-out ${reduce ? 0 : 0.5}s` : undefined }}
    >
      {/* escena que «avanza» hacia la puerta al atravesarla */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{
          background: 'radial-gradient(120% 90% at 50% 0%, #f0dcb4 0%, #dcc497 45%, #b99a68 100%)',
          transform: through && !reduce ? 'scale(3.4)' : 'scale(1)',
          transformOrigin: '50% 52%',
          transition: `transform 1.7s ${EASE}`,
        }}
      >
        <StoneWall />
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
            <p className="mt-1 text-[clamp(11px,2.6vw,14px)] font-semibold opacity-80">{MALL.tagline}</p>
          </div>

          {/* portón con arco */}
          <button
            type="button"
            onClick={knock}
            aria-label={`Tocar la puerta para entrar al centro comercial (${knocks} de ${KNOCKS} toques)`}
            className="group relative cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            style={{
              width: 'min(78vw, 46vh, 440px)',
              aspectRatio: '3 / 4',
              borderRadius: ARCH,
              // entrada suave; luego, un temblor por golpe (alterna dos nombres para reiniciarlo)
              animation: phase !== 'idle' ? 'none' : knocks ? `door-knock-${knocks % 2} 0.45s ease-out` : 'door-rise 1s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) both',
            }}
          >
            {/* marco de piedra clara */}
            <div
              className="absolute -inset-[5%] shadow-[0_18px_40px_rgba(60,40,20,0.35)]"
              style={{ background: '#f5ead2', borderRadius: '50% 50% 12px 12px / 34% 34% 12px 12px', border: '3px solid #e2cfa7' }}
            />
            {/* vano: el interior iluminado */}
            <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: ARCH, perspective: 1100 }}>
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
              <Leaf side="left" opened={opened} reduce={reduce} knocks={knocks} />
              <Leaf side="right" opened={opened} reduce={reduce} knocks={knocks} />
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
          </button>

          {/* escalinata */}
          <div className="mt-[5%] flex flex-col items-center" style={{ animation: 'door-rise 1s 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) both' }}>
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
function Leaf({ side, opened, reduce, knocks }: { side: 'left' | 'right'; opened: boolean; reduce: boolean; knocks: number }) {
  const s = side === 'left' ? -1 : 1
  const studs: [number, number][] = []
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) studs.push([18 + c * 32, 9 + r * 16.4])
  const style: CSSProperties = {
    [side]: 0,
    transformOrigin: `${side} center`,
    transform: opened ? `rotateY(${s * (reduce ? 0 : 104)}deg)` : 'rotateY(0deg)',
    opacity: opened && reduce ? 0 : 1,
    transition: `transform 2.4s cubic-bezier(0.45, 0, 0.2, 1), opacity 0.3s`,
    background: `linear-gradient(${side === 'left' ? 90 : 270}deg, ${WOOD_DARK}, ${WOOD} 30%, ${WOOD} 85%, ${WOOD_DARK})`,
    boxShadow: opened ? `${-s * 18}px 0 30px rgba(40,25,10,0.45)` : 'none',
  }
  return (
    <div className="absolute bottom-0 h-[72%] w-1/2" style={style}>
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

/** Lo que se alcanza a ver al abrir: la plaza con la fuente y los locales de colores. */
function MallGlimpse({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 size-full"
      style={{ opacity: lit ? 0.9 : 0.5, transform: lit ? 'scale(1)' : 'scale(0.92)', transformOrigin: '50% 80%', transition: `opacity 1.6s, transform 2.6s ${EASE}` }}
    >
      <rect x="0" y="62" width="100" height="38" fill="#f3e3c3" />
      {[
        [4, 40, 22, '#e0735f'],
        [28, 46, 18, '#2bb3b1'],
        [54, 44, 18, '#c2607f'],
        [74, 40, 22, '#5f9a6e'],
      ].map(([x, y, w, c], i) => (
        <g key={i}>
          <rect x={x as number} y={y as number} width={w as number} height={62 - (y as number)} fill="#fbf4e6" />
          <rect x={x as number} y={y as number} width={w as number} height="5" fill={c as string} />
        </g>
      ))}
      <ellipse cx="50" cy="80" rx="16" ry="5" fill="#7cc7c0" />
      <rect x="48" y="68" width="4" height="12" fill="#e9dcc2" />
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
