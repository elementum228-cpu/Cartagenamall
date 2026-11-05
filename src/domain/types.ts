// Modelo de dominio de MallPlay. Todo lo que la UI y los servicios intercambian pasa por
// estos tipos, de modo que reemplazar los datos mock por Supabase/GrowDesk no toque los componentes.

export type ZoneId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'I'
export type FloorId = string
export type SpaceType = 'island' | 'local' | 'premium' | 'court' | 'booth' | 'track'

export interface Category {
  id: string
  name: string
  zoneId: ZoneId
}

export interface ZoneConfig {
  id: ZoneId
  name: string
  color: string
  /** Rotación (rad) del pasillo alrededor de la plaza central (pisos en cruz). */
  angle: number
  /** Punto (x, z) del piso al que se acerca la cámara al elegir la zona. */
  focus: [number, number]
  categories: Category[]
}

/** Distribución arquitectónica del piso. Agregar un piso 3 = agregar datos con uno de estos tipos. */
export type FloorLayout = 'cross' | 'foodcourt'

export interface FloorConfig {
  id: FloorId
  name: string
  /** Rótulo principal del piso (cartel grande). */
  title: string
  subtitle: string
  level: number
  /** Altura del piso en el mundo 3D. */
  elevation: number
  /** Desplazamiento (x, z) del piso dentro de la fortaleza (el piso 2 es una terraza al fondo). */
  offset: [number, number]
  layout: FloorLayout
  /** Zoom de "volver al centro" relativo al encuadre general. */
  homeZoom: number
  /** Límite de desplazamiento de la cámara (|x|, |z|). */
  bounds: number
  zones: ZoneConfig[]
}

export interface MallConfig {
  id: string
  name: string
  tagline: string
  floors: FloorConfig[]
}

export interface SpaceTypeInfo {
  type: SpaceType
  name: string
  monthlyPriceCOP: number
  features: string[]
  /** [ancho de fachada, profundidad] en unidades del mundo. */
  size: [number, number]
}

/** Un espacio físico del mall. Se genera desde configuración; no se persiste. */
export interface SpaceSlot {
  id: string
  floorId: string
  zoneId: ZoneId
  type: SpaceType
  label: string
  /** Centro en el plano del piso (x, z). */
  position: [number, number]
  /** Rotación en Y: la fachada mira hacia +z local tras rotar. */
  rotation: number
  size: [number, number]
  /** Altura del piso donde está (p. ej. el segundo piso de Isla Tecnología). */
  elevation?: number
}

export type StoreStatus = 'open' | 'paused'
export type FacadeStyle = 'awning' | 'arch' | 'minimal'

/** Categoría propia de una tienda (por ejemplo «Champú» o «Platos fuertes»): la crea el dueño y filtra su catálogo. */
export interface StoreCategory {
  id: string
  name: string
}

/** Dónde se apoya el producto sobre el fondo. Todo en fracciones (0–1) del ancho y alto de la imagen del fondo. */
export interface PhotoSlot {
  /** Centro horizontal. */
  x: number
  /** Línea de apoyo (la base del producto, por ejemplo la superficie del podio). */
  y: number
  /** Ancho y alto máximos que puede ocupar el producto. */
  w: number
  h: number
}

export interface PhotoBackground {
  url: string
  slot: PhotoSlot
}

export interface Store {
  id: string
  name: string
  logoText: string
  /** Logo subido por el comerciante (data URL reducida). Sin logo se usa `logoText`. */
  logo?: string | null
  /** Tienda destacada: cartel grande en el techo y luz propia en el mall. */
  highlight?: boolean
  tagline: string
  description: string
  categoryId: string
  zoneId: ZoneId
  brandColor: string
  accentColor: string
  facade: FacadeStyle
  instagram: string
  /** Fondo de fotos de la tienda: los productos recortados se colocan sobre él (ver lib/studio.ts). */
  photoBg?: PhotoBackground
  /** Mensajes de WhatsApp personalizados del negocio (ver lib/messages.ts). */
  messages?: Partial<Record<'greeting' | 'orderIntro' | 'orderOutro' | 'booking' | 'toCustomer', string>>
  /** Número de demostración, nunca un número real. */
  whatsapp: string
  status: StoreStatus
  /** Tipo de negocio que eligió el dueño al configurar su local. */
  businessType?: 'restaurant' | 'shop' | 'service'
  /** «pending»: local recién aprobado cuyo dueño aún no hizo la configuración inicial. */
  setup?: 'pending' | 'done'
  /** Categorías propias del catálogo, menú o servicios, en el orden que las acomodó el dueño. */
  categories?: StoreCategory[]
  /** Tarjeta de sellos: cada compra da un sello; al llenarla se canjea este premio. */
  loyalty?: { stamps: number; reward: string; active: boolean }
}

export interface Variant {
  id: string
  name: string
  swatch?: string
}

export type ProductIcon =
  | 'shirt' | 'dress' | 'pants' | 'hat' | 'shoe' | 'sandal' | 'bag'
  | 'headphones' | 'charger' | 'phone' | 'watch' | 'laptop' | 'speaker'
  | 'perfume' | 'lipstick' | 'serum' | 'brush'
  | 'candle' | 'coffee' | 'gift' | 'hammock' | 'sweet'
  | 'plate' | 'fish' | 'dessert' | 'drink' | 'meat' | 'noodles' | 'croissant'

export interface Product {
  id: string
  storeId: string
  name: string
  description: string
  /** Precio en COP, sin decimales. */
  price: number
  /** Foto real (URL o data URL subida desde Mi negocio). null mientras se usa el placeholder ilustrado. */
  image: string | null
  /** Foto original sin tratar y recorte (PNG) del producto, para volver atrás o reaplicar el fondo de la tienda. */
  photoOriginal?: string
  cutout?: string
  /** Ajuste del producto sobre el fondo: tamaño relativo y desplazamiento horizontal (fracción del ancho). */
  photoFit?: { scale: number; dx: number; dy?: number }
  icon: ProductIcon
  categoryId: string
  /** Categoría propia dentro de la tienda (id de Store.categories); sin ella se agrupa por rubro. */
  shopCategory?: string
  tags: string[]
  /** Productos "similares" entre tiendas comparten grupo para el comparador. */
  compareGroup?: string
  variants: Variant[]
  sizes: string[]
  /** Inventario mock por combinación: clave `${variantId|_}|${size|_}`. */
  inventory: Record<string, number>
  featured: boolean
  active: boolean
}

export type PromotionType = 'normal' | 'flash' | 'secret'

export interface HideSpot {
  floorId: FloorId
  x: number
  z: number
}

export interface Promotion {
  id: string
  type: PromotionType
  storeId: string
  productId: string
  title: string
  description: string
  discountPercent: number
  /** Código para promociones escondidas. */
  code?: string
  /**
   * Escondite elegido por el comerciante para una promoción escondida (coordenadas del piso). Sin
   * escondite, la gema aparece junto a su local.
   */
  hideAt?: HideSpot
  startsAt: string
  endsAt: string | null
  /** Duración usada al (re)activar una oferta relámpago desde /admin. */
  durationHours?: number
  active: boolean
}

export interface CartItem {
  key: string
  productId: string
  storeId: string
  variantId: string | null
  size: string | null
  qty: number
}

export type OrderStatus =
  | 'received'
  | 'pending_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled'

export interface OrderLine {
  productId: string
  name: string
  variantId: string | null
  variantName: string | null
  size: string | null
  qty: number
  originalUnitPrice: number
  unitPrice: number
  promotionId: string | null
  promoCode: string | null
  lineTotal: number
}

export interface SubOrder {
  id: string
  orderId: string
  storeId: string
  storeName: string
  lines: OrderLine[]
  subtotal: number
  status: OrderStatus
  history: { status: OrderStatus; at: string }[]
  /** Se marca cuando el inventario mock ya se descontó al confirmar. */
  stockCommitted: boolean
  /** El comercio ya quitó este pedido de su lista (entregado o cancelado). */
  archived?: boolean
  /** Pedido que el comercio registró a mano (venta en el local o por WhatsApp), no hecho desde la app. */
  manual?: boolean
}

export type DeliveryMode = 'pickup' | 'delivery'

export interface Customer {
  name: string
  whatsapp: string
}

export interface Order {
  id: string
  createdAt: string
  customer: Customer
  delivery: { mode: DeliveryMode; address: string | null }
  notes: string
  subOrders: SubOrder[]
  /** Total estimado: precios, inventario y entrega se confirman antes de cualquier cobro. */
  estimatedTotal: number
  payment: 'not_charged'
}

export type ClaimStatus = 'pending' | 'approved' | 'rejected'

export interface SpaceClaim {
  id: string
  spaceId: string
  spaceType: SpaceType
  businessName: string
  categoryId: string
  ownerName: string
  whatsapp: string
  email: string
  createdAt: string
  status: ClaimStatus
  /** Tienda creada al aprobar. */
  storeId?: string
}
