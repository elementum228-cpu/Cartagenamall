import mark from '../assets/mallplay-mark.png'

/** Marca de MallPlay: la «M» de arcos (turquesa, coral y arena) sobre un cuadro blanco redondeado. */
export function MallMark({ size = 36 }: { size?: number }) {
  return <img src={mark} width={size} height={size} alt="" aria-hidden className="shrink-0 bg-white" style={{ borderRadius: size * 0.26 }} />
}

/** Nombre de la marca: «Mall» en el color del texto y «Play» en coral. */
export function MallWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      Mall<span style={{ color: '#f27b68' }}>Play</span>
    </span>
  )
}
