import { AnimatePresence, animate, motion, useMotionValue, usePresence, useReducedMotion, useTransform } from 'motion/react'
import { Bell, ChevronLeft, ChevronRight, Clock, Heart, Lock, Newspaper, Pointer, Share2, Star, Ticket, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useUI } from '../state/ui'
import { useEditionData, type EdPromo } from './edition'
import { useHoy } from './store'

const INK = '#14202e'
const PAPER = '#f4edde'
const TEAL = '#0f9e94'
const CORAL = '#e8613c'
const MUSTARD = '#e2a72e'
const DEEP = '#123a5e'
const SERIF: CSSProperties = { fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif" }
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .28  0 0 0 0 .18  0 0 0 .09 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>\")"
const paper: CSSProperties = { backgroundColor: PAPER, backgroundImage: `${GRAIN}, linear-gradient(180deg, rgba(255,255,255,.35), rgba(120,90,40,.06))`, color: INK }

const HUE: Record<string, string> = { Gastronomía: CORAL, Belleza: '#c2607f', Tecnología: DEEP, Moda: MUSTARD, Lifestyle: '#5f9a6e', Deportes: TEAL, Servicios: '#7a6ff0' }

const dateLabel = () => {
  const d = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return d.charAt(0).toUpperCase() + d.slice(1)
}

function useWide() {
  const [w, setW] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)')
    const f = () => setW(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return w
}

/** Cuenta regresiva HH:MM:SS desde que se abre la edición. */
function useCountdown(endsAt: string | number) {
  const end = typeof endsAt === 'number' ? Date.now() + endsAt : Date.parse(endsAt)
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()))
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, end - Date.now())), 1000)
    return () => clearInterval(t)
  }, [end])
  const s = Math.floor(left / 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

/** Sello de tinta rotado (Última hora, Oferta relámpago, Finalizada…). */
function Stamp({ children, color = CORAL, rot = -6, className = '' }: { children: ReactNode; color?: string; rot?: number; className?: string }) {
  return (
    <span className={`inline-block rounded-md border-2 px-2 py-0.5 text-[10.5px] font-extrabold tracking-[0.14em] uppercase ${className}`} style={{ color, borderColor: color, transform: `rotate(${rot}deg)`, background: 'rgba(255,255,255,.35)' }}>
      {children}
    </span>
  )
}

function Rule({ thick = false }: { thick?: boolean }) {
  return <div style={{ borderTop: `${thick ? 3 : 1}px solid ${INK}`, borderBottom: thick ? `1px solid ${INK}` : undefined, height: thick ? 6 : 0 }} />
}

/** Espacio publicitario integrado al periódico. */
function AdSlot({ label, hint, tone = TEAL, className = '', slot }: { label: string; hint: string; tone?: string; className?: string; slot?: { name: string; text: string; image: string | null } }) {
  if (slot && (slot.name || slot.image))
    return (
      <article className={`relative overflow-hidden rounded-sm border-2 ${className}`} style={{ borderColor: tone, background: '#fffaf0' }}>
        {slot.image && <img src={slot.image} alt={slot.name} className="h-24 w-full object-cover" />}
        <div className="p-2.5">
          <span className="text-[9.5px] font-extrabold tracking-[0.18em] uppercase" style={{ color: tone }}>
            {label}
          </span>
          <h4 className="text-[15px] leading-tight font-extrabold" style={SERIF}>
            {slot.name}
          </h4>
          {slot.text && <p className="text-[12px] leading-snug opacity-75">{slot.text}</p>}
        </div>
      </article>
    )
  return (
    <div className={`relative flex flex-col justify-center rounded-sm border-2 border-dashed px-3 py-2.5 ${className}`} style={{ borderColor: tone, background: `${tone}12` }}>
      <span className="text-[9.5px] font-extrabold tracking-[0.18em] uppercase" style={{ color: tone }}>
        {label}
      </span>
      <span className="mt-0.5 text-[13px] leading-snug font-bold" style={SERIF}>
        {hint}
      </span>
      <span className="mt-1 text-[10.5px] font-semibold opacity-60">Aparece en MallPlay Hoy · escríbenos</span>
    </div>
  )
}

function PageFoot({ n, name }: { n: number; name: string }) {
  return (
    <div className="mt-auto flex items-center justify-between pt-3 text-[10.5px] font-bold tracking-[0.14em] uppercase opacity-70">
      <span>MallPlay Hoy · {name}</span>
      <span style={SERIF} className="text-[15px] tracking-normal">
        {n}
      </span>
    </div>
  )
}

/** Ilustración del evento: cancha nocturna con focos y estrellas, hecha con formas. */
function EventArt() {
  return (
    <svg viewBox="0 0 400 220" className="block h-full w-full" role="img" aria-label="Cancha iluminada de noche">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1d33" />
          <stop offset="1" stopColor="#1b4d6b" />
        </linearGradient>
        <radialGradient id="beam" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#fff3b0" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff3b0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="220" fill="url(#sky)" />
      {[[40, 30], [90, 60], [150, 22], [250, 40], [330, 24], [370, 70], [200, 70]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 5} l1.6 3.4 3.6.4 -2.7 2.5.8 3.6 -3.3-1.9 -3.3 1.9.8-3.6 -2.7-2.5 3.6-.4z`} fill="#ffe9a8" />
      ))}
      <polygon points="70,0 40,150 140,150" fill="url(#beam)" />
      <polygon points="330,0 300,150 400,150" fill="url(#beam)" />
      <rect x="62" y="0" width="8" height="40" fill="#2b3a4a" />
      <rect x="330" y="0" width="8" height="40" fill="#2b3a4a" />
      <polygon points="0,220 400,220 400,150 0,150" fill="#13824a" />
      <polygon points="40,215 360,215 330,160 70,160" fill="#18a05c" />
      <line x1="200" y1="160" x2="200" y2="215" stroke="#e9fff1" strokeWidth="2" />
      <ellipse cx="200" cy="188" rx="26" ry="9" fill="none" stroke="#e9fff1" strokeWidth="2" />
      <circle cx="248" cy="176" r="6" fill="#fff" />
      <path d="M0 150 L60 128 L120 150 L180 122 L240 150 L300 126 L400 150 L400 156 L0 156z" fill="#0b2b3e" opacity=".8" />
    </svg>
  )
}

function Cover({ onOpenEvent }: { onOpenEvent: () => void }) {
  const ed = useEditionData()
  const top = ed.promos.filter((p) => !p.ended).sort((a, b) => a.left - b.left)[0] ?? ed.promos[0]
  const left = useCountdown(top?.endsAt ?? 0)
  return (
    <div className="flex min-h-full flex-col gap-3 p-4 sm:p-6" style={paper}>
      <div className="flex items-center justify-between gap-2 pr-11 text-[10px] font-bold tracking-[0.12em] uppercase sm:pr-0">
        <span className="hidden sm:inline">Edición diaria · N.º 001</span>
        <span className="hidden sm:inline">Cartagena · Tu mall, tu mundo</span>
        <span className="normal-case tracking-normal sm:mr-10">{dateLabel()}</span>
      </div>
      <Rule thick />
      <div className="text-center">
        <h1 className="leading-[0.9] font-black tracking-tight" style={{ ...SERIF, fontSize: 'clamp(40px, 9vw, 72px)', fontVariationSettings: '"opsz" 144' }}>
          MALLPLAY <span style={{ color: TEAL }}>HOY</span>
        </h1>
        <div className="mt-1 flex items-center justify-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase">
          <Star className="size-3" fill={MUSTARD} stroke="none" /> Cartagena · Tu mall, tu mundo <Star className="size-3" fill={MUSTARD} stroke="none" />
        </div>
      </div>
      <Rule thick />

      <h2 className="text-balance leading-[1.02] font-black" style={{ ...SERIF, fontSize: 'clamp(26px, 5.6vw, 40px)' }}>
        {ed.headline}
      </h2>

      <div className="grid gap-3 sm:grid-cols-5">
        {/* evento del día */}
        <article className="relative overflow-hidden rounded-sm border-2 sm:col-span-3" style={{ borderColor: INK }}>
          <div className="aspect-[16/8.5]">{ed.event.image ? <img src={ed.event.image} alt={ed.event.title} className="size-full object-cover" /> : <EventArt />}</div>
          <div className="absolute top-2 left-2">
            <Stamp color="#fff" rot={-4} className="!bg-[#e8613c] !border-[#e8613c]">
              {ed.event.kicker}
            </Stamp>
          </div>
          <div className="space-y-1.5 p-3" style={{ background: PAPER }}>
            <h3 className="text-[19px] leading-tight font-extrabold" style={SERIF}>
              {ed.event.title}
            </h3>
            <p className="text-[13px] leading-snug opacity-80">{ed.event.text}</p>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11.5px] font-bold opacity-75">
                {ed.event.when} · {ed.event.where}
              </span>
              <button onClick={onOpenEvent} className="shrink-0 rounded-full px-4 py-2 text-[13px] font-extrabold text-white active:scale-95" style={{ background: DEEP }}>
                Ver evento
              </button>
            </div>
          </div>
        </article>

        <div className="flex flex-col gap-3 sm:col-span-2">
          {/* última hora */}
          <article className="relative overflow-hidden rounded-sm p-3 text-white" style={{ background: INK }}>
            {ed.lastHour.image && <img src={ed.lastHour.image} alt="" className="absolute inset-0 size-full object-cover opacity-35" />}
            <div className="relative">
              <Stamp color={MUSTARD} rot={-3}>
                Última hora
              </Stamp>
              <h3 className="mt-2 text-[18px] leading-tight font-extrabold" style={SERIF}>
                {ed.lastHour.title}
              </h3>
              <p className="mt-1 text-[12.5px] leading-snug opacity-80">{ed.lastHour.text}</p>
            </div>
          </article>
          {/* promoción más buscada */}
          <article className="relative rounded-sm border-2 p-3" style={{ borderColor: CORAL, background: '#fff6ef' }}>
            <span className="text-[10px] font-extrabold tracking-[0.16em] uppercase" style={{ color: CORAL }}>
              La promoción más buscada de hoy
            </span>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-[44px] leading-none font-black" style={{ ...SERIF, color: CORAL }}>
                {top?.big}
              </span>
              <span className="pb-1 text-[13px] leading-tight font-bold">
                {top?.title} · {top?.store}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] font-bold">
              <Clock className="size-3.5" /> Termina en {left}
            </div>
          </article>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <AdSlot label="Patrocinador principal" hint="Tu marca en la portada de hoy" tone={TEAL} className="sm:col-span-1" slot={ed.sponsor} />
        <AdSlot label="Recomendado por MallPlay" hint="Destaca tu local entre los favoritos" tone={MUSTARD} className="sm:col-span-1" slot={ed.recommended} />
        <article className="rounded-sm p-3" style={{ background: '#e7efe9' }}>
          <span className="text-[10px] font-extrabold tracking-[0.16em] uppercase" style={{ color: TEAL }}>
            Próximamente en MallPlay
          </span>
          <h3 className="mt-0.5 text-[16px] leading-tight font-extrabold" style={SERIF}>
            {ed.soon.title}
          </h3>
          <p className="mt-0.5 text-[12px] leading-snug opacity-75">{ed.soon.text}</p>
        </article>
      </div>

      <AdSlot label="Negocio aliado" hint="Banner inferior de marca · espacio disponible" tone={DEEP} className="text-center" slot={ed.banner} />
      <PageFoot n={1} name="Primera plana" />
    </div>
  )
}

function PromoCard({ p, saved, onSave }: { p: EdPromo; saved: boolean; onSave: () => void }) {
  const left = useCountdown(p.endsAt)
  const out = p.ended || Date.parse(p.endsAt) <= Date.now()
  const hue = HUE[p.cat]
  const toast = useUI((s) => s.toast)
  const share = () => {
    const text = `${p.big} en ${p.store}: ${p.title}. Mira MallPlay Hoy.`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  return (
    <article className={`relative overflow-hidden rounded-sm border-2 ${out ? 'opacity-70 grayscale' : ''}`} style={{ borderColor: INK, background: '#fffaf0' }}>
      {p.image && <img src={p.image} alt={p.store} className="h-32 w-full object-cover" />}
      <div className="relative flex items-center gap-3 p-3" style={{ background: `${hue}22` }}>
        <div className="grid size-[72px] shrink-0 place-items-center rounded-sm text-center leading-none font-black text-white" style={{ ...SERIF, background: hue, fontSize: p.big.length > 6 ? 15 : p.big.length > 4 ? 17 : 24 }}>
          {p.big}
        </div>
        <div className="min-w-0">
          <span className="text-[9.5px] font-extrabold tracking-[0.16em] uppercase" style={{ color: hue === MUSTARD ? '#8a6200' : hue }}>
            {p.cat}
          </span>
          <h3 className="truncate text-[16px] leading-tight font-extrabold" style={SERIF}>
            {p.store}
          </h3>
          <p className="text-[12.5px] leading-tight font-bold">{p.title}</p>
        </div>
        {p.flash && !out && (
          <span className="absolute top-1 right-1.5 hidden">
            <Stamp rot={-4}>Oferta relámpago</Stamp>
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        {p.flash && !out && <Stamp rot={-2}>Oferta relámpago</Stamp>}
        <p className="text-[12.5px] leading-snug opacity-80">{p.text}</p>
        <div className="flex items-center justify-between text-[11.5px] font-bold">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" /> {out ? 'Terminó' : `Termina en ${left}`}
          </span>
          <span style={{ color: out ? INK : CORAL }}>{out ? 'Agotada' : `Quedan ${p.left} cupos`}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            disabled={out}
            onClick={() => toast(`Cupón de ${p.store} reclamado. Preséntalo en el local.`, 'success')}
            className="h-10 flex-1 rounded-full text-[13px] font-extrabold text-white disabled:opacity-40"
            style={{ background: INK }}
          >
            {p.cat === 'Gastronomía' ? 'Comprar ahora' : 'Reclamar cupón'}
          </button>
          <button onClick={onSave} aria-pressed={saved} aria-label="Guardar promoción" className="grid size-10 place-items-center rounded-full border-2" style={{ borderColor: INK }}>
            <Heart className="size-4" fill={saved ? CORAL : 'none'} stroke={saved ? CORAL : INK} />
          </button>
          <button onClick={share} aria-label="Compartir por WhatsApp" className="grid size-10 place-items-center rounded-full border-2" style={{ borderColor: INK }}>
            <Share2 className="size-4" />
          </button>
        </div>
      </div>
      {out && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Stamp rot={-14} color={INK} className="!text-[22px] !px-4 !py-1">
            Finalizada
          </Stamp>
        </div>
      )}
    </article>
  )
}

function Promos() {
  const ed = useEditionData()
  const [saved, setSaved] = useState<string[]>([])
  const toggle = (id: string) => setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  return (
    <div className="flex min-h-full flex-col gap-3 p-4 sm:p-6" style={paper}>
      <div className="flex items-center justify-between pr-11 text-[10px] font-bold tracking-[0.16em] uppercase sm:pr-0">
        <span>Sección · Promociones</span>
        <Stamp color={TEAL} rot={0}>
          {ed.promos.filter((p) => !p.ended).length} activas
        </Stamp>
      </div>
      <Rule thick />
      <h2 className="text-balance leading-[1.02] font-black" style={{ ...SERIF, fontSize: 'clamp(26px, 5.2vw, 38px)' }}>
        Las promociones que no puedes dejar pasar
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {ed.promos.map((p) => (
          <PromoCard key={p.id} p={p} saved={saved.includes(p.id)} onSave={() => toggle(p.id)} />
        ))}
      </div>
      {/* oferta secreta del día */}
      <article className="relative overflow-hidden rounded-sm p-4 text-white" style={{ background: DEEP }}>
        <div className="flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-full" style={{ background: MUSTARD, color: INK }}>
            <Lock className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold tracking-[0.18em] uppercase" style={{ color: MUSTARD }}>
              Premium · para lectores
            </span>
            <h3 className="text-[20px] leading-tight font-extrabold" style={SERIF}>
              La oferta secreta del día
            </h3>
            <p className="text-[12.5px] opacity-80">
              <span className="blur-[3.5px] select-none">{ed.secret.title}</span> · explora {ed.secret.need} locales para desbloquearla.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5" aria-label={`1 de ${ed.secret.need} locales explorados`}>
          {Array.from({ length: ed.secret.need }, (_, i) => (
            <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i < 1 ? MUSTARD : 'rgba(255,255,255,.2)' }} />
          ))}
        </div>
      </article>
      <PageFoot n={2} name="Promociones" />
    </div>
  )
}

function NextPage({ onActivate }: { onActivate: () => void }) {
  const items = [
    ['Sabores', '¿Dónde comer hoy? El plato más pedido, menú ejecutivo y happy hour.', CORAL],
    ['Planes', 'Hoy pasa algo en MallPlay: agenda de eventos y calendario semanal.', TEAL],
    ['Nuevos en el mall', 'Aperturas, historias de emprendedores y el local destacado.', MUSTARD],
    ['Tu ruta para hoy', 'Entrada → promoción → restaurante → evento → oferta secreta.', DEEP],
  ] as const
  return (
    <div className="flex min-h-full flex-col gap-3 p-4 sm:p-6" style={paper}>
      <div className="text-[10px] font-bold tracking-[0.16em] uppercase">Sección · En las próximas páginas</div>
      <Rule thick />
      <h2 className="text-balance leading-[1.02] font-black" style={{ ...SERIF, fontSize: 'clamp(26px, 5.2vw, 38px)' }}>
        Y hay más: lo que viene en esta edición
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(([t, d, c], i) => (
          <article key={t} className="rounded-sm border-2 p-3" style={{ borderColor: c, background: `${c}14` }}>
            <span className="text-[10px] font-extrabold tracking-[0.16em] uppercase" style={{ color: c === MUSTARD ? '#8a6200' : c }}>
              Pág. {i + 3} · próximamente
            </span>
            <h3 className="text-[19px] leading-tight font-extrabold" style={SERIF}>
              {t}
            </h3>
            <p className="mt-0.5 text-[12.5px] leading-snug opacity-80">{d}</p>
          </article>
        ))}
      </div>
      <AdSlot label="Cupón exclusivo para lectores" hint="Tu cupón aquí: lo reclaman quienes leen la edición" tone={CORAL} />
      <article className="mt-1 rounded-sm p-4 text-center text-white" style={{ background: INK }}>
        <Newspaper className="mx-auto size-7" style={{ color: MUSTARD }} />
        <h3 className="mt-1 text-[20px] leading-tight font-extrabold" style={SERIF}>
          Recibe la edición cada mañana
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] opacity-80">Y no te pierdas ninguna promoción de Cartagena.</p>
        <button onClick={onActivate} className="mt-3 inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-extrabold" style={{ background: MUSTARD, color: INK }}>
          <Bell className="size-4" /> Activar mi periódico diario
        </button>
      </article>
      <PageFoot n={3} name="Índice" />
    </div>
  )
}

/** Forma del pliegue: 0 = doblado (solo se ve la mitad de arriba), 1 = abierto. */
const UNFOLD_EASE = [0.25, 0.85, 0.3, 1] as const

/**
 * Cómo se abre un diario de verdad: llega doblado por la mitad, con el cabezote a la vista, y la mitad de abajo
 * baja girando sobre el pliegue. Mientras gira se ve en escorzo (más oscura cuanto más inclinada) y su borde
 * avanza hasta quedar plana; el pliegue deja una sombra que se desvanece.
 */
function useFold() {
  const fold = useMotionValue(0)
  // ángulo de la mitad de abajo: 90° (de canto, invisible) → 0° (plana)
  const reveal = useTransform(fold, (v) => Math.cos(((1 - v) * Math.PI) / 2))
  const clipPath = useTransform(reveal, (r) => `inset(0% 0% ${(50 * (1 - r)).toFixed(3)}% 0%)`)
  const edgeTop = useTransform(reveal, (r) => `${50 + 50 * r}%`)
  const shade = useTransform(reveal, (r) => 0.55 * (1 - r))
  const edgeOpacity = useTransform(fold, [0, 0.05, 0.9, 1], [0, 1, 1, 0])
  const crease = useTransform(fold, [0, 0.7, 1], [1, 0.6, 0])
  return { fold, clipPath, edgeTop, shade, edgeOpacity, crease }
}

const SWIPED_KEY = 'cm:hoy-swiped'
const hasSwiped = () => {
  try {
    return localStorage.getItem(SWIPED_KEY) === '1'
  } catch {
    return false
  }
}

/** Invitación a pasar de hoja: un dedo que arrastra hacia la izquierda, con la flecha de "hay más". */
function SwipeHint({ wide }: { wide: boolean }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute right-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 rounded-full py-2 pr-3 pl-2 text-[12.5px] font-extrabold text-white shadow-xl"
      style={{ background: INK }}
      initial={{ opacity: 0, y: 14, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.92, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
    >
      <span className="relative grid size-8 place-items-center overflow-hidden rounded-full" style={{ background: MUSTARD, color: INK }}>
        <motion.span animate={{ x: [7, -7, -7, 7], opacity: [0, 1, 1, 0], rotate: [-8, -14, -14, -8] }} transition={{ duration: 1.4, repeat: Infinity, times: [0, 0.35, 0.8, 1], ease: 'easeInOut' }}>
          <Pointer className="size-4" strokeWidth={2.6} />
        </motion.span>
      </span>
      {wide ? 'Pasa la hoja' : 'Desliza para ver más'}
      <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}>
        <ChevronRight className="size-4" strokeWidth={3} />
      </motion.span>
    </motion.div>
  )
}

function Reader() {
  const close = useHoy((s) => s.close)
  const reduce = useReducedMotion()
  const [isPresent, safeToRemove] = usePresence()
  const { fold, clipPath, edgeTop, shade, edgeOpacity, crease } = useFold()
  // el diario doblado: entra desde abajo, ligeramente inclinado, y se asienta
  const backdrop = useMotionValue(0)
  const y = useMotionValue(reduce ? 0 : 160)
  const tilt = useMotionValue(reduce ? 0 : -4)
  const lean = useMotionValue(reduce ? 0 : 22)
  const size = useMotionValue(reduce ? 1 : 0.86)
  const sheetOpacity = useMotionValue(0)
  const [unfolded, setUnfolded] = useState(false)
  const [hint, setHint] = useState(false)
  const nudging = useRef(false)
  useEffect(() => {
    if (!isPresent) return
    if (reduce) {
      fold.set(1)
      animate(backdrop, 1, { duration: 0.2 })
      animate(sheetOpacity, 1, { duration: 0.2 }).then(() => setUnfolded(true))
      return
    }
    const land = { type: 'spring', stiffness: 260, damping: 26 } as const
    animate(backdrop, 1, { duration: 0.25 })
    animate(sheetOpacity, 1, { duration: 0.15 })
    animate(y, 0, land)
    animate(tilt, 0, land)
    animate(size, 1, land)
    animate(lean, 0, { duration: 0.45, ease: 'easeOut' })
    // se despliega mientras termina de llegar: nada de pausas con media hoja quieta
    animate(fold, 1, { delay: 0.22, duration: 0.75, ease: UNFOLD_EASE }).then(() => setUnfolded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])
  useEffect(() => {
    if (isPresent) return
    let alive = true
    const run = async () => {
      setUnfolded(false)
      if (!reduce) {
        // se vuelve a doblar y luego cae fuera de la pantalla
        await animate(fold, 0, { duration: 0.38, ease: [0.55, 0, 0.75, 0.3] })
        animate(backdrop, 0, { duration: 0.28 })
        animate(tilt, 5, { duration: 0.28, ease: 'easeIn' })
        animate(size, 0.86, { duration: 0.28, ease: 'easeIn' })
        animate(sheetOpacity, 0, { delay: 0.12, duration: 0.16 })
        await animate(y, 220, { duration: 0.28, ease: [0.5, 0, 0.9, 0.4] })
      } else {
        animate(backdrop, 0, { duration: 0.2 })
        await animate(sheetOpacity, 0, { duration: 0.2 })
      }
      if (alive) safeToRemove?.()
    }
    run()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])
  const toast = useUI((s) => s.toast)
  const wide = useWide()
  const [spread, setSpread] = useState(0)
  const [mobilePage, setMobilePage] = useState(0)
  const [dir, setDir] = useState(1)
  const scroller = useRef<HTMLDivElement>(null)
  const openEvent = () => {
    close()
    useUI.getState().setFloor('P1')
  }
  const pages = useMemo(
    () => [<Cover key="c" onOpenEvent={openEvent} />, <Promos key="p" />, <NextPage key="n" onActivate={() => toast('Listo: te avisaremos cada mañana cuando llegue la edición.', 'success')} />],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const spreads = Math.ceil(pages.length / 2)
  const dismissHint = () => {
    setHint(false)
    try {
      localStorage.setItem(SWIPED_KEY, '1')
    } catch {
      /* nada */
    }
  }
  // al terminar de desplegarse, la hoja se asoma hacia la siguiente para enseñar que se puede deslizar
  useEffect(() => {
    if (!unfolded || hasSwiped()) return
    setHint(true)
    const el = scroller.current
    if (wide || reduce || !el) return
    let cancelled = false
    const peek = Math.min(110, el.clientWidth * 0.28)
    const nudge = async () => {
      await new Promise((r) => setTimeout(r, 450))
      for (let i = 0; i < 2 && !cancelled; i++) {
        nudging.current = true
        el.style.scrollSnapType = 'none'
        await animate(0, peek, { duration: 0.55, ease: [0.3, 0, 0.2, 1], onUpdate: (v) => !cancelled && (el.scrollLeft = v) })
        if (cancelled) break
        await animate(peek, 0, { type: 'spring', stiffness: 220, damping: 18, onUpdate: (v) => !cancelled && (el.scrollLeft = Math.max(0, v)) })
        el.style.scrollSnapType = ''
        nudging.current = false
        await new Promise((r) => setTimeout(r, 900))
      }
      el.style.scrollSnapType = ''
      nudging.current = false
    }
    const stop = () => {
      cancelled = true
      el.style.scrollSnapType = ''
      nudging.current = false
    }
    el.addEventListener('touchstart', stop, { passive: true })
    el.addEventListener('wheel', stop, { passive: true })
    nudge()
    const t = setTimeout(() => setHint(false), 7000)
    return () => {
      stop()
      clearTimeout(t)
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('wheel', stop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unfolded, wide])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (wide && e.key === 'ArrowRight') turn(1)
      if (wide && e.key === 'ArrowLeft') turn(-1)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, wide, spread])
  const total = wide ? spreads : pages.length
  const cur = wide ? spread : mobilePage
  const turn = (d: number) => {
    if (hint) dismissHint()
    if (wide) {
      setDir(d)
      setSpread((s) => Math.max(0, Math.min(spreads - 1, s + d)))
    } else scroller.current?.scrollTo({ left: (mobilePage + d) * (scroller.current?.clientWidth ?? 0), behavior: 'smooth' })
  }
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center sm:p-6" style={{ perspective: 1600, height: '100dvh' }}>
      <motion.div aria-hidden className="absolute inset-0 bg-[#0b1620]/80 backdrop-blur-sm" style={{ opacity: backdrop }} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="MallPlay Hoy"
        className="relative flex h-full w-full flex-col sm:h-[min(94vh,860px)] sm:max-w-[1240px]"
        style={{ y, rotate: tilt, rotateX: lean, scale: size, opacity: sheetOpacity, transformOrigin: '50% 50%' }}
      >
        {/* la hoja: llega doblada y la mitad de abajo se despliega sobre el pliegue */}
        <motion.div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden shadow-[0_40px_120px_-20px_rgba(0,0,0,0.75)] sm:rounded-md"
          style={{ ...paper, clipPath: unfolded ? 'none' : clipPath }}
        >
          <button onClick={close} aria-label="Cerrar el periódico" className="absolute top-[max(10px,env(safe-area-inset-top))] right-3 z-30 grid size-11 place-items-center rounded-full text-white shadow-lg" style={{ background: INK }}>
            <X className="size-5" />
          </button>

          {wide ? (
            <div className="relative grid min-h-0 flex-1 grid-cols-2">
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-12 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/15 to-transparent" />
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <motion.div key={spread} className="col-span-2 grid min-h-0 grid-cols-2" style={{ transformPerspective: 2200, transformOrigin: dir > 0 ? '0% 50%' : '100% 50%' }} initial={{ rotateY: dir > 0 ? 70 : -70, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: dir > 0 ? -70 : 70, opacity: 0 }} transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}>
                  <div className="min-h-0 overflow-y-auto border-r border-black/10">{pages[spread * 2]}</div>
                  <div className="min-h-0 overflow-y-auto">{pages[spread * 2 + 1] ?? <BackPage />}</div>
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <div ref={scroller} className="scrollbar-none flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto" onScroll={(e) => {
                const pg = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth)
                setMobilePage(pg)
                if (pg > 0 && !nudging.current && hint) dismissHint()
              }}>
              {pages.map((pg, i) => (
                <div key={i} className="min-h-0 w-full shrink-0 snap-center overflow-y-auto pt-[env(safe-area-inset-top)]">
                  {pg}
                </div>
              ))}
            </div>
          )}

          {/* controles de página: siempre visibles, por encima de la barra de inicio del teléfono */}
          <div className="relative z-30 flex items-center justify-between gap-3 border-t-2 px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]" style={{ background: '#efe6d2', borderColor: INK }}>
            <button onClick={() => turn(-1)} disabled={cur === 0} aria-label="Hoja anterior" className="flex h-12 items-center gap-1 rounded-full border-2 pr-4 pl-2.5 text-[13px] font-extrabold disabled:opacity-30" style={{ borderColor: INK }}>
              <ChevronLeft className="size-5" /> Anterior
            </button>
            <div className="flex items-center gap-1.5" aria-label={`Hoja ${cur + 1} de ${total}`}>
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className="h-2 rounded-full transition-all" style={{ width: i === cur ? 26 : 8, background: i === cur ? INK : 'rgba(20,32,46,.28)' }} />
              ))}
            </div>
            <button onClick={() => turn(1)} disabled={cur >= total - 1} aria-label="Hoja siguiente" className="flex h-12 items-center gap-1 rounded-full pr-2.5 pl-4 text-[13px] font-extrabold text-white disabled:opacity-30" style={{ background: INK }}>
              Siguiente <ChevronRight className="size-5" />
            </button>
          </div>
          <AnimatePresence>{hint && cur === 0 && <SwipeHint wide={wide} />}</AnimatePresence>

          {/* la mitad que baja: escorzo (sombra) y el borde del papel que avanza */}
          {!unfolded && (
            <>
              <motion.div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 bottom-0 z-40 bg-gradient-to-b from-[#3b2a12] via-[#3b2a12]/70 to-[#3b2a12]/30" style={{ opacity: shade }} />
              <motion.div aria-hidden className="pointer-events-none absolute inset-x-0 z-40 h-[3px] -translate-y-full bg-gradient-to-b from-transparent to-white/70" style={{ top: edgeTop, opacity: edgeOpacity }} />
              <motion.div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 z-40 h-10 -translate-y-1/2" style={{ opacity: crease, background: 'linear-gradient(180deg, transparent, rgba(60,40,15,.28) 46%, rgba(255,255,255,.55) 52%, transparent)' }} />
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}

function BackPage() {
  return (
    <div className="grid h-full place-items-center p-8 text-center" style={paper}>
      <div>
        <Ticket className="mx-auto size-10" style={{ color: CORAL }} />
        <p className="mt-2 text-[22px] font-black" style={SERIF}>
          Fin de la edición
        </p>
        <p className="text-[13px] opacity-70">Vuelve mañana: la edición cambia cada día.</p>
      </div>
    </div>
  )
}

/** Aviso animado de que llegó la edición del día. */
function Notice() {
  const { notice, later, read } = useHoy()
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          role="alert"
          className="fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[125] rounded-2xl border p-4 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.55)] sm:inset-x-auto sm:right-5 sm:w-[410px]"
          style={{ ...paper, borderColor: 'rgba(20,32,46,.2)' }}
          initial={{ y: -140, rotate: -2, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        >
          <div className="flex gap-3">
            <motion.div className="relative grid size-14 shrink-0 place-items-center" animate={{ rotate: [0, -5, 4, 0] }} transition={{ repeat: Infinity, duration: 3.2 }}>
              <svg viewBox="0 0 64 64" className="size-14" aria-hidden>
                <path d="M8 18 L32 10 L56 18 L56 52 L32 58 L8 52 Z" fill="#fffaf0" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M32 10 L32 58" stroke={INK} strokeWidth="2" opacity=".5" />
                <path d="M14 26 h12 M14 32 h12 M38 26 h12 M38 32 h12 M38 38 h12" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".55" />
                <circle cx="20" cy="43" r="6.5" fill={TEAL} />
                <path d="M16.5 46 V40.5 L20 44 L23.5 40.5 V46" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
            <div className="min-w-0">
              <p className="text-[19px] leading-tight font-black" style={SERIF}>
                ¡La edición de MallPlay Hoy ya llegó!
              </p>
              <p className="mt-1 text-[13px] leading-snug opacity-80">Descubre eventos, promociones y secretos que están pasando hoy en Cartagena.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={read} className="h-11 flex-1 rounded-full text-[14px] font-extrabold text-white" style={{ background: INK }}>
              Leer periódico
            </button>
            <button onClick={later} className="h-11 rounded-full px-4 text-[13px] font-bold" style={{ color: INK }}>
              Más tarde
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Botón para abrir la edición desde el mapa. */
export function HoyPill() {
  const read = useHoy((s) => s.read)
  return (
    <button onClick={read} className="flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-[12px] font-bold shadow-sm" style={{ background: INK, color: '#fff' }} aria-label="Abrir MallPlay Hoy, el periódico del día">
      <span className="grid size-5 place-items-center rounded-full" style={{ background: MUSTARD, color: INK }}>
        <Newspaper className="size-3" strokeWidth={2.4} />
      </span>
      Hoy
    </button>
  )
}

/** Monta el aviso y el lector; el aviso llega solo una vez al día. */
export function HoyHost() {
  const reader = useHoy((s) => s.reader)
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('hoy')
    if (q === 'leer') useHoy.setState({ reader: true })
    const t = setTimeout(() => useHoy.getState().showNotice(), q === 'aviso' ? 800 : 4500)
    if (q === 'aviso') try { localStorage.removeItem('cm:hoy-seen') } catch { /* nada */ }
    return () => clearTimeout(t)
  }, [])
  return (
    <>
      <Notice />
      <AnimatePresence>{reader && <Reader />}</AnimatePresence>
    </>
  )
}
