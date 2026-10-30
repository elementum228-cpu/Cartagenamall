import type { SpaceType } from '../domain/types'

/** Vista previa ilustrada (isométrica) de cada tipo de espacio. */
export function SpacePreview({ type, color }: { type: SpaceType; color: string }) {
  const w = type === 'premium' ? 150 : type === 'local' ? 110 : 64
  const h = type === 'premium' ? 70 : type === 'local' ? 58 : 46
  return (
    <svg viewBox="0 0 220 140" className="h-36 w-full" role="img" aria-label="Vista previa del espacio">
      <defs>
        <linearGradient id="floor" x1="0" x2="1">
          <stop offset="0" stopColor="#f7f2e8" />
          <stop offset="1" stopColor="#ebe1cf" />
        </linearGradient>
      </defs>
      <g transform="translate(110 92)">
        <polygon points={`0,${-w / 3.2} ${w / 1.7},0 0,${w / 3.2} ${-w / 1.7},0`} fill="url(#floor)" stroke={color} strokeDasharray="5 4" strokeWidth="2" />
        {type !== 'island' ? (
          <>
            <polygon points={`${-w / 1.7},0 0,${-w / 3.2} 0,${-w / 3.2 - h} ${-w / 1.7},${-h}`} fill="#fbf7f0" stroke="#e3d6bf" />
            <polygon points={`0,${-w / 3.2} ${w / 1.7},0 ${w / 1.7},${-h} 0,${-w / 3.2 - h}`} fill="#f2ebde" stroke="#e3d6bf" />
            <polygon points={`${-w / 1.7},${-h} 0,${-w / 3.2 - h} 0,${-w / 3.2 - h + 14} ${-w / 1.7},${-h + 14}`} fill={color} />
            <polygon points={`0,${-w / 3.2 - h} ${w / 1.7},${-h} ${w / 1.7},${-h + 14} 0,${-w / 3.2 - h + 14}`} fill={color} opacity="0.8" />
          </>
        ) : (
          <>
            <rect x={-18} y={-34} width={36} height={22} rx={5} fill="#fbf7f0" stroke="#e3d6bf" />
            <rect x={-3} y={-64} width={6} height={30} fill="#e3d6bf" />
            <rect x={-20} y={-74} width={40} height={14} rx={4} fill={color} />
          </>
        )}
        <text x="0" y={type === 'island' ? 30 : 18} textAnchor="middle" fontSize="12" fontWeight="800" fill={color}>
          + TU MARCA
        </text>
      </g>
    </svg>
  )
}
