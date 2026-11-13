import { Newspaper } from 'lucide-react'
import { useHoy } from './store'

const INK = '#14202e'
const MUSTARD = '#e2a72e'

/** Botón para abrir la edición desde el mapa (liviano: el periódico completo se descarga al tocarlo). */
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
