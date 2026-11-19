import { ChevronRight, Ticket } from 'lucide-react'
import cangrejoUrl from '../assets/cangrejos/cangrejo.webp'
import doradoUrl from '../assets/cangrejos/dorado.webp'
import agujeroUrl from '../assets/cangrejos/agujero.webp'
import { useArcadeUi, type ArcadeGameId } from './store'

// Pantalla de inicio del Arcade: los tres juegos como tarjetas grandes, claras y táctiles (estilo suave, tipo Apple).
// Al tocar una tarjeta se entra directo a ese juego; desde adentro, la flecha de arriba vuelve aquí.

interface Card {
  id: ArcadeGameId
  name: string
  tagline: string
  how: string
  from: string
  to: string
  art: React.ReactNode
}

const ART_BOX = 'relative grid h-[104px] w-[104px] shrink-0 place-items-center overflow-hidden rounded-[24px] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_12px_24px_-14px_rgba(30,20,90,0.8)]'

function ShipArt() {
  return (
    <svg viewBox="0 0 64 64" className="size-[72px]" aria-hidden>
      <circle cx="12" cy="14" r="1.6" fill="#fff" opacity=".9" />
      <circle cx="52" cy="10" r="1.2" fill="#fff" opacity=".8" />
      <circle cx="56" cy="40" r="1.4" fill="#fff" opacity=".7" />
      <circle cx="9" cy="46" r="1.1" fill="#fff" opacity=".7" />
      <path d="M32 6c7 8 10 18 10 30l-5 6H27l-5-6C22 24 25 14 32 6Z" fill="#f4f6ff" />
      <path d="M32 6c7 8 10 18 10 30h-10V6Z" fill="#c9d3ff" />
      <circle cx="32" cy="24" r="5" fill="#4de1ff" stroke="#3b46a8" strokeWidth="2" />
      <path d="M22 34 10 46l2 6 11-6V34Zm20 0 12 12-2 6-11-6V34Z" fill="#ff5aa5" />
      <path d="M28 44h8l-4 12-4-12Z" fill="#ffb347" />
      <path d="M30 44h4l-2 7-2-7Z" fill="#fff3b0" />
    </svg>
  )
}

function BowlsArt() {
  return (
    <svg viewBox="0 0 64 64" className="size-[72px]" aria-hidden>
      <ellipse cx="32" cy="55" rx="26" ry="5" fill="#000" opacity=".15" />
      {[[22, 20], [32, 20], [42, 20], [27, 31], [37, 31], [32, 42]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y + 8} rx="5" ry="2" fill="#000" opacity=".12" />
          <path d={`M${x - 3.2} ${y + 7}c-1-5 0-9 1-12a3.2 3.2 0 0 1 4.4 0c1 3 2 7 1 12Z`} fill="#fff8e8" />
          <path d={`M${x - 2.2} ${y - 1}h4.4`} stroke="#ff5aa5" strokeWidth="1.6" />
        </g>
      ))}
      <circle cx="32" cy="55" r="6.5" fill="#7a4a24" />
      <circle cx="30" cy="53" r="1" fill="#2a1608" />
      <circle cx="33.5" cy="52.5" r="1" fill="#2a1608" />
      <circle cx="32" cy="56" r="1" fill="#2a1608" />
      <path d="M28 51c2-2 6-2.6 8-.6" stroke="#b27944" strokeWidth="1.4" fill="none" />
    </svg>
  )
}

function CrabsArt() {
  return (
    <>
      <img src={agujeroUrl} alt="" className="absolute bottom-[-10px] left-1/2 w-[92px] -translate-x-1/2 opacity-90" draggable={false} />
      <img src={cangrejoUrl} alt="" className="relative -mt-1 w-[78px] drop-shadow-[0_6px_6px_rgba(0,0,0,0.25)]" draggable={false} />
      <img src={doradoUrl} alt="" className="absolute -top-1 right-[-6px] w-[40px] rotate-12 opacity-95" draggable={false} />
    </>
  )
}

const CARDS: Card[] = [
  { id: 'nave', name: 'Nave Caribe', tagline: 'Dispara a las olas', how: 'Mueve la nave, esquiva y suma puntos. Entra al ranking semanal.', from: '#6c7bff', to: '#a77bff', art: <ShipArt /> },
  { id: 'cangrejos', name: 'Cangrejos Locos', tagline: 'Atrápalos rápido', how: 'Atrapa los cangrejos que salen de sus huecos. Los dorados valen más.', from: '#ff8a5b', to: '#ff5aa5', art: <CrabsArt /> },
  { id: 'bolos', name: 'Bolos de coco', tagline: 'Lanza y tumba todo', how: 'Apunta, lanza el coco y tumba los bolos de la playa.', from: '#2fc7a0', to: '#4de1ff', art: <BowlsArt /> },
]

export function ArcadeHub() {
  const openGame = useArcadeUi((s) => s.openGame)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-1">
      <p className="px-1 text-[14px] font-semibold text-[#4b4a7a]">Elige a qué quieres jugar. Cada partida te da tiquetes para canjear por premios.</p>
      {CARDS.map((c) => (
        <button
          key={c.id}
          onClick={() => openGame(c.id)}
          className="group flex w-full items-center gap-4 rounded-[28px] bg-white/75 p-3.5 text-left shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_36px_-24px_rgba(60,40,120,0.6)] ring-1 ring-black/[0.04] backdrop-blur-xl transition active:scale-[0.985]"
        >
          <div className={ART_BOX} style={{ background: `linear-gradient(145deg, ${c.from}, ${c.to})` }}>
            {c.art}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[19px] leading-tight font-extrabold tracking-tight text-[#1c1747]">{c.name}</h3>
            <p className="mt-0.5 text-[13.5px] font-bold text-[#6b4fd1]">{c.tagline}</p>
            <p className="mt-1.5 text-[12.5px] leading-snug text-[#6b6a8a]">{c.how}</p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fff3c4] px-2.5 py-1 text-[11.5px] font-extrabold text-[#7a4b00]">
              <Ticket className="size-3.5" aria-hidden /> Hasta 100 tiquetes
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1c1747]/[0.06] text-[#1c1747]" aria-hidden>
            <ChevronRight className="size-5" />
          </span>
        </button>
      ))}
    </div>
  )
}
