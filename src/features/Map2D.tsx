import { useMemo } from 'react'
import { FLOOR_BY_ID, FOOD_LAYOUT, LAYOUT, SPACES, ZONE_BY_ID } from '../config/mall'
import type { FloorConfig } from '../domain/types'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { useClaims } from '../state/claims'
import { useUI } from '../state/ui'
import { usePromoEvents } from '../promotions/store'

/**
 * Mapa 2D accesible: alternativa cuando el dispositivo no soporta WebGL (o la persona lo prefiere).
 * Mismos espacios, misma selección y mismas fichas que el mundo 3D.
 */
export function Map2D({ reason }: { reason?: string }) {
  const assignments = useCatalog((s) => s.assignments)
  const { storeById } = useCatalogMaps()
  const selected = useUI((s) => s.selectedSpaceId)
  const selectSpace = useUI((s) => s.selectSpace)
  const floor = FLOOR_BY_ID[useUI((s) => s.activeFloor)]
  const spaces = SPACES.filter((s) => s.floorId === floor.id)
  const claims = useClaims((s) => s.claims)
  const pending = useMemo(() => new Set(claims.filter((c) => c.status === 'pending').map((c) => c.spaceId)), [claims])
  const events = usePromoEvents((s) => s.events)
  /** Ofertas relámpago vigentes por espacio; `playing`: se está presentando ahora (resalte temporal). */
  const flash = useMemo(() => {
    const m: Record<string, { discount: number; playing: boolean }> = {}
    for (const e of events)
      if (e.type === 'flash' && e.status === 'active')
        m[e.spaceId] = { discount: Math.max(m[e.spaceId]?.discount ?? 0, e.discount), playing: (m[e.spaceId]?.playing ?? false) || e.spotlight === 'playing' }
    return m
  }, [events])
  const E = PLAN_EXTENT

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="mx-auto flex min-h-full max-w-[640px] flex-col items-center justify-center px-3 pt-36 pb-36 pl-16 md:pt-16 md:pb-28">
        {reason && <p className="mb-3 rounded-full bg-white/80 px-3 py-1.5 text-center text-xs font-semibold text-ink-soft shadow-soft">{reason}</p>}
        <p className="mb-2 text-sm font-extrabold">
          {floor.name}
          <span className="font-semibold text-ink-soft max-md:hidden"> · {floor.subtitle}</span>
        </p>
        <svg viewBox={`${-E} ${-E} ${E * 2} ${E * 2}`} className="w-full max-w-[600px]" role="group" aria-label={`Plano 2D del ${floor.name}`}>
          <FloorPlanBase floor={floor} />
          {spaces.map((s) => {
            const store = storeById[assignments[s.id]]
            const zone = ZONE_BY_ID[s.zoneId]
            const [w, d] = s.size
            const deg = (-s.rotation * 180) / Math.PI
            const isSel = selected === s.id
            const offer = store ? flash[s.id] : undefined
            return (
              <g
                key={s.id}
                transform={`translate(${s.position[0]} ${s.position[1]}) rotate(${deg})`}
                role="button"
                tabIndex={0}
                aria-label={store ? `Tienda ${store.name}, espacio ${s.label}${offer ? `, oferta relámpago −${offer.discount}%` : ''}` : `Espacio ${s.label} disponible`}
                onClick={() => selectSpace(s.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selectSpace(s.id)}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={-w / 2}
                  y={-d / 2}
                  width={w}
                  height={d}
                  rx={0.4}
                  fill={store ? store.brandColor : pending.has(s.id) ? '#f5b54455' : '#ffffff'}
                  stroke={isSel ? '#1d2a33' : store ? 'none' : zone.color}
                  strokeWidth={isSel ? 0.5 : 0.25}
                  strokeDasharray={store ? undefined : '0.6 0.4'}
                />
                {offer && (
                  <rect
                    x={-w / 2 - 0.5}
                    y={-d / 2 - 0.5}
                    width={w + 1}
                    height={d + 1}
                    rx={0.8}
                    fill="none"
                    stroke="#f5b544"
                    strokeWidth={offer.playing ? 0.55 : 0.3}
                    className={offer.playing ? 'motion-safe:animate-pulse' : undefined}
                  />
                )}
                <text transform={`rotate(${-deg})`} textAnchor="middle" dominantBaseline="middle" fontSize={store ? (s.type === 'island' ? 0.62 : 1.05) : 0.9} fontWeight={800} fill={store ? '#fff' : zone.color}>
                  {store ? store.logoText : '+'}
                </text>
                {offer && (
                  <g transform={`rotate(${-deg}) translate(0 ${-(Math.max(w, d) / 2 + 1.1)})`}>
                    <rect x={-1.9} y={-0.6} width={3.8} height={1.2} rx={0.6} fill="#f5b544" />
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={0.75} fontWeight={800} fill="#2a1d05">
                      −{offer.discount}%
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-semibold">
          {floor.zones.map((z) => (
            <span key={z.id} className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1">
              <span className="size-2.5 rounded-full" style={{ background: z.color }} /> {z.id} · {z.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Medio lado del plano 2D (en unidades del mundo): el viewBox va de −PLAN_EXTENT a +PLAN_EXTENT. */
export const PLAN_EXTENT = LAYOUT.wingEnd + 1

/** Fondo del plano de un piso: planta en cruz (piso 1) o terraza gastronómica (piso 2). */
export function FloorPlanBase({ floor }: { floor: FloorConfig }) {
  const E = PLAN_EXTENT
  const P = LAYOUT.plazaHalf
  const W = LAYOUT.wingHalfWidth
  const FH = FOOD_LAYOUT.half
  const TR = FOOD_LAYOUT.terrace
  return (
    <>
      <circle r={E} fill="#ead9bb" />
      {floor.layout === 'cross' ? (
        <>
          {/* planta en cruz */}
          <rect x={-P} y={-P} width={P * 2} height={P * 2} fill="#eadcc4" />
          {floor.zones.map((z) => {
            const vertical = Math.abs(Math.sin(z.angle)) < 0.5
            const sign = vertical ? Math.cos(z.angle) : Math.sin(z.angle)
            const rect = vertical
              ? { x: -W, y: sign > 0 ? P : -E + 1, width: W * 2, height: E - 1 - P }
              : { x: sign > 0 ? P : -E + 1, y: -W, width: E - 1 - P, height: W * 2 }
            const lx = vertical ? 0 : sign * (P + 9)
            const ly = vertical ? sign * (P + 9) : 0
            return (
              <g key={z.id}>
                <rect {...rect} fill="#f7f2e8" stroke="#dcc8a6" strokeWidth={0.4} />
                <text x={lx} y={ly} textAnchor="middle" fontSize={1.6} fontWeight={800} fill={z.color} opacity={0.35}>
                  {z.id}
                </text>
              </g>
            )
          })}
          <circle r={2.7} fill="#7cc4c9" />
        </>
      ) : (
        <>
          {/* terraza gastronómica: losa, terraza con pérgola y llegada de las escaleras */}
          <rect x={-FH} y={-FH} width={FH * 2} height={FH * 2} fill="#f7f2e8" stroke="#dcc8a6" strokeWidth={0.4} />
          <rect x={TR.x0} y={TR.z0} width={TR.x1 - TR.x0} height={TR.z1 - TR.z0} fill="#dcb78c" opacity={0.7} />
          <text x={(TR.x0 + TR.x1) / 2} y={(TR.z0 + TR.z1) / 2 + 0.4} textAnchor="middle" fontSize={1.1} fontWeight={800} fill="#8a6340">
            TERRAZA
          </text>
          <rect x={FH - 3.4} y={FH - 3.4} width={3.4} height={3.4} fill="#cfd6da" />
          <text x={FH - 1.7} y={FH - 1.5} textAnchor="middle" fontSize={0.7} fontWeight={700} fill="#5b6670">
            Escaleras
          </text>
        </>
      )}
    </>
  )
}
