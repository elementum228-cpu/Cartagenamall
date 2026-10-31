import {
  Armchair, Briefcase, Cable, Candy, Coffee, Flame, Footprints, Gift, Headphones, Laptop, Palette, Shirt,
  ShoppingBag, Smartphone, Sparkles, Speaker, SprayCan, Watch, Droplet, UtensilsCrossed, Fish, CakeSlice, CupSoda, Beef, Soup, Croissant, type LucideIcon,
} from 'lucide-react'
import type { Product, ProductIcon } from '../domain/types'

const ICONS: Record<ProductIcon, LucideIcon> = {
  shirt: Shirt,
  dress: Sparkles,
  pants: Briefcase,
  hat: Sparkles,
  shoe: Footprints,
  sandal: Footprints,
  bag: ShoppingBag,
  headphones: Headphones,
  charger: Cable,
  phone: Smartphone,
  watch: Watch,
  laptop: Laptop,
  speaker: Speaker,
  perfume: SprayCan,
  lipstick: Palette,
  serum: Droplet,
  brush: Palette,
  candle: Flame,
  coffee: Coffee,
  gift: Gift,
  hammock: Armchair,
  sweet: Candy,
  plate: UtensilsCrossed,
  fish: Fish,
  dessert: CakeSlice,
  drink: CupSoda,
  meat: Beef,
  noodles: Soup,
  croissant: Croissant,
}

/**
 * Imagen del producto. Mientras no haya fotos reales (`image === null`) se usa una ilustración
 * con el color de la tienda y de la primera variante, para que el catálogo no se vea vacío.
 */
export function ProductImage({ product, brandColor, className = '' }: { product: Product; brandColor: string; className?: string }) {
  if (product.image) return <img src={product.image} crossOrigin={product.image.startsWith('data:') ? undefined : 'anonymous'} alt={product.name} loading="lazy" className={`object-cover ${className}`} />
  const Icon = ICONS[product.icon] ?? ShoppingBag
  const swatch = product.variants.find((v) => v.swatch)?.swatch
  return (
    <div
      role="img"
      aria-label={product.name}
      className={`relative grid place-items-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(145deg, ${brandColor}26, ${brandColor}55)` }}
    >
      <div className="absolute -right-6 -bottom-6 size-24 rounded-full opacity-40" style={{ background: swatch ?? brandColor }} />
      <div className="absolute -top-4 -left-4 size-14 rounded-full bg-white/40" />
      <Icon className="relative size-1/3 min-h-6 min-w-6" style={{ color: brandColor }} strokeWidth={1.6} />
    </div>
  )
}
