import { useId } from 'react'

/** Ícono de Instagram (lucide ya no incluye marcas): cámara con el degradado de la marca. */
export function InstagramIcon({ className = 'size-4', plain = false }: { className?: string; plain?: boolean }) {
  const id = useId()
  const stroke = plain ? 'currentColor' : `url(#${id})`
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {!plain && (
        <defs>
          <linearGradient id={id} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f9a03f" />
            <stop offset="0.45" stopColor="#e1306c" />
            <stop offset="1" stopColor="#7b3fe4" />
          </linearGradient>
        </defs>
      )}
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.3" cy="6.7" r="0.9" fill={stroke} stroke="none" />
    </svg>
  )
}
