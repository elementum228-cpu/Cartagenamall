import { Gift, MapPin, Store as StoreIcon } from 'lucide-react'
import { useState, type PointerEvent } from 'react'
import { FLOORS, FOOD_LAYOUT, SPACES } from '../config/mall'
import type { HideSpot } from '../domain/types'
import { FloorPlanBase, PLAN_EXTENT } from '../features/Map2D'
import { canHideAt, describeHideSpot, hideSpot } from '../promotions/hideSpot'
import { useCatalog, useCatalogMaps } from '../state/catalog'

// El comerciante elige dónde esconder su promoción: junto a su local (como siempre) o en cualquier
// punto de la plaza, los pasillos o la terraza de comidas, tocando el plano del piso.

export function HideSpotPicker({ storeId, value, onChange }: { storeId: string; value: HideSpot | null; onChange: (spot: HideSpot | null) => void }) {
  const { spaceByStore } = useCatalogMaps()
  const assignments = useCatalog((s) => s.assignments)
  const mySpace = spaceByStore[storeId]
  const [mode, setMode] = useState<'store' | 'map'>(value ? 'map' : 'store')
  const [miss, setMiss] = useState(false)

  const pick = (floorId: string, e: PointerEvent<SVGSVGElement>) => {
    const el = e.currentTarget
    const m = el.getScreenCTM()
    if (!m) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    if (!canHideAt(floorId, p.x, p.y)) {
      setMiss(true)
      return
    }
    setMiss(false)
    onChange(hideSpot(floorId, p.x, p.y))
  }

  const tab = (on: boolean) => `flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${on ? 'bg-white text-ink shadow-soft' : 'text-ink-soft'}`

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-bold text-ink-soft">Dónde esconder el regalo</legend>
      <div className="flex gap-1 rounded-full bg-sand-2 p-1" role="radiogroup">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'store'}
          className={tab(mode === 'store')}
          onClick={() => {
            setMode('store')
            setMiss(false)
            onChange(null)
          }}
        >
          <StoreIcon className="size-3.5" /> Junto a mi local
        </button>
        <button type="button" role="radio" aria-checked={mode === 'map'} className={tab(mode === 'map')} onClick={() => setMode('map')}>
          <MapPin className="size-3.5" /> En cualquier lugar
        </button>
      </div>

      {mode === 'store' ? (
        <p className="text-[11px] text-ink-soft">{mySpace ? 'El regalo aparece al lado de tu vitrina cuando alguien se acerca.' : 'Tu tienda aún no tiene local: elige un lugar del mapa para que se pueda encontrar.'}</p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[11px] text-ink-soft">Este es el plano del centro comercial visto desde arriba. Toca la plaza, un pasillo o la terraza para esconder el regalo.</p>
          {FLOORS.map((f) => {
            const E = f.layout === 'cross' ? PLAN_EXTENT : FOOD_LAYOUT.half + 1
            const here = value?.floorId === f.id
            return (
              <div key={f.id} className={`overflow-hidden rounded-2xl border bg-[#e4d3b4] ${here ? 'border-amber' : 'border-line'}`}>
                <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 text-[11px] font-bold text-ink">
                  <span>{f.name}</span>
                  {here && <span className="flex items-center gap-1 text-amber-700"><Gift className="size-3" /> Aquí está tu regalo</span>}
                </div>
                <svg viewBox={`${-E} ${-E} ${E * 2} ${E * 2}`} className="block aspect-square w-full cursor-crosshair touch-manipulation" onPointerUp={(e) => pick(f.id, e)} role="img" aria-label={`Plano del ${f.name} para elegir el escondite`}>
                  <FloorPlanBase floor={f} />
                  {SPACES.filter((sp) => sp.floorId === f.id).map((sp) => {
                    const mine = sp.id === mySpace
                    const taken = !!assignments[sp.id]
                    return (
                      <rect
                        key={sp.id}
                        transform={`translate(${sp.position[0]} ${sp.position[1]}) rotate(${(-sp.rotation * 180) / Math.PI})`}
                        x={-sp.size[0] / 2}
                        y={-sp.size[1] / 2}
                        width={sp.size[0]}
                        height={sp.size[1]}
                        rx={0.4}
                        fill={mine ? '#008d87' : taken ? '#c9bba3' : '#ffffff'}
                        opacity={mine ? 1 : 0.85}
                        stroke={mine ? '#062c42' : 'none'}
                        strokeWidth={0.3}
                      />
                    )
                  })}
                  {value && here && (
                    <g transform={`translate(${value.x} ${value.z})`} pointerEvents="none">
                      <circle r={4} fill="#ff5a8a" opacity={0.22} className="motion-safe:animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                      <circle r={2.6} fill="#fff" opacity={0.9} stroke="#7a4d06" strokeWidth={0.2} />
                      {/* regalito: caja, cinta y moño */}
                      <rect x={-1.2} y={-0.5} width={2.4} height={1.7} rx={0.2} fill="#ff5a8a" stroke="#8a1f4a" strokeWidth={0.15} />
                      <rect x={-1.3} y={-0.9} width={2.6} height={0.6} rx={0.15} fill="#ff7aa5" stroke="#8a1f4a" strokeWidth={0.15} />
                      <rect x={-0.18} y={-0.9} width={0.36} height={2.1} fill="#ffd45c" />
                      <path d="M0 -0.9C-1.3 -2 -1.8 -0.7 0 -0.9ZM0 -0.9C1.3 -2 1.8 -0.7 0 -0.9Z" fill="#ffd45c" stroke="#8a5a06" strokeWidth={0.12} />
                    </g>
                  )}
                </svg>
              </div>
            )
          })}
          <p className={`flex items-center gap-1.5 text-xs font-semibold ${miss ? 'text-red-600' : 'text-ink'}`} aria-live="polite">
            <Gift className="size-3.5 shrink-0 text-amber" />
            {miss
              ? 'Ahí no se puede: elige la plaza, un pasillo o la terraza (fuera de los locales).'
              : value
                ? `Escondido en: ${describeHideSpot(value)}`
                : 'Aún no has elegido el escondite.'}
          </p>
        </div>
      )}
    </fieldset>
  )
}
