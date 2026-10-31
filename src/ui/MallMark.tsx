/** Marca: casa minimalista con la puerta en coral, dentro de un cuadrado turquesa redondeado. */
export function MallMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="mm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#13B9AD" />
          <stop offset="1" stopColor="#008D87" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#mm-g)" />
      <path d="M11 19.5 L20 12 L29 19.5 V28.5 H11 Z" fill="none" stroke="#F7F5F1" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M17.6 28.5 V23.4 A2.4 2.4 0 0 1 22.4 23.4 V28.5" fill="#F27B68" />
    </svg>
  )
}
