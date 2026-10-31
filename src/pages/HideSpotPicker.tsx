import { Gem, MapPin, Store as StoreIcon } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import { FLOORS, FLOOR_BY_ID, FOOD_LAYOUT, SPACES } from '../config/mall'
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
  const [floorId, setFloorId] = useState(value?.floorId ?? (mySpace ? SPACES.find((sp) => sp.id === mySpace)?.floorId : null) ?? FLOORS[0].id)
  const [miss, setMiss] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const floor = FLOOR_BY_ID[floorId]
  const E = floor.layout === 'cross' ? PLAN_EXTENT : FOOD_LAYOUT.half + 1

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const el = svg.current
    const m = el?.getScreenCTM()
    if (!el || !m) return
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
      <legend className="mb-1 text-xs font-bold text-ink-soft">Dónde esconderla</legend>
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
        <p className="text-[11px] text-ink-soft">{mySpace ? 'La gema aparece al lado de tu vitrina cuando alguien se acerca.' : 'Tu tienda aún no tiene local: elige un lugar del mapa para que se pueda encontrar.'}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-ink-soft">Toca la plaza, un pasillo o la terraza para esconder la gema.</p>
            <div className="flex gap-1">
              {FLOORS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFloorId(f.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${floorId === f.id ? 'bg-ink text-white' : 'bg-sand-2 text-ink-soft'}`}
                  aria-pressed={floorId === f.id}
                >
                  {f.id}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-[#e4d3b4]">
            <svg ref={svg} viewBox={`${-E} ${-E} ${E * 2} ${E * 2}`} className="block aspect-square w-full cursor-crosshair touch-manipulation" onPointerUp={pick} role="img" aria-label={`Plano del ${floor.name} para elegir el escondite`}>
              <FloorPlanBase floor={floor} />
              {SPACES.filter((sp) => sp.floorId === floorId).map((sp) => {
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
              {value?.floorId === floorId && (
                <g transform={`translate(${value.x} ${value.z})`} pointerEvents="none">
                  <circle r={2.2} fill="#f7b34b" opacity={0.25} className="motion-safe:animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                  <circle r={1.3} fill="#f7b34b" opacity={0.35} />
                  <path d="M0 -1.1 L0.8 0 L0 1.1 L-0.8 0 Z" fill="#f7b34b" stroke="#7a4d06" strokeWidth={0.18} />
                </g>
              )}
            </svg>
          </div>
          <p className={`flex items-center gap-1.5 text-xs font-semibold ${miss ? 'text-red-600' : 'text-ink'}`} aria-live="polite">
            <Gem className="size-3.5 shrink-0 text-amber" />
            {miss
              ? 'Ahí no se puede: elige la plaza, un pasillo o la terraza (fuera de los locales).'
              : value
                ? `Escondida en: ${describeHideSpot(value)}`
                : 'Aún no has elegido el escondite.'}
          </p>
        </div>
      )}
    </fieldset>
  )
}
