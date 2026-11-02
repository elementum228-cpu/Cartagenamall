import mark from '../assets/mallplay-mark.png'
import markWhite from '../assets/mallplay-mark-white.png'

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

/** Logo todo en blanco (la «M» de arcos y el nombre), con una sombra suave para leerse sobre cualquier fondo. Para la barra superior. */
export function MallLogoWhite({ height = 30 }: { height?: number }) {
  const shadow = 'drop-shadow(0 1px 5px rgb(0 0 0 / 0.35))'
  return (
    <span className="flex items-center gap-2.5 text-white" style={{ filter: shadow }}>
      <img src={markWhite} alt="" aria-hidden height={height} style={{ height, width: 'auto' }} />
      <span className="text-[19px] font-extrabold tracking-[-0.02em]">MallPlay</span>
    </span>
  )
}
