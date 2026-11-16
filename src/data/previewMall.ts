import type { FacadeStyle, Product, ProductIcon, SpaceSlot, Store, ZoneConfig } from '../domain/types'

// Modo «mall lleno» (prueba de la administración): inventa un negocio con algunos productos en cada espacio que está libre, solo para
// MIRAR cómo se ve el mall completo. Nada de esto se guarda en el catálogo ni en la base de datos: vive en este dispositivo y se
// calcula al dibujar (ver state/previewMall.ts). Es una función pura para poder probarla.

export const PREVIEW_PREFIX = 'PREVIEW-'
export const isPreviewStoreId = (id: string | undefined) => !!id && id.startsWith(PREVIEW_PREFIX)

const NAMES: Record<string, string[]> = {
  A: ['Lino y Sol', 'Brisa Caribe', 'Moda Bahía', 'Trama Costeña', 'Costa Azul', 'Ola Viva', 'Palmar', 'Coral Chic', 'Sal & Mar', 'Tejidos Rosa'],
  B: ['Nodo Móvil', 'Byte Caribe', 'Pixel Puerto', 'Circuito Plus', 'Voltio', 'Gadget Bay', 'Cable & Co', 'Techo Rojo', 'Zona Ciber', 'Ondas', 'Smart Muralla', 'Chip Azul'],
  C: ['Piel Dorada', 'Aroma Mar', 'Coral Glow', 'Esencia', 'Brillo Tropical', 'Nácar'],
  D: ['Casa Palmera', 'Regalos del Puerto', 'Hogar Caribe', 'Artesanías Getsemaní', 'Deporte Total', 'Manos de Mar'],
  E: ['El Fogón', 'Sabor Costeño', 'Mar y Sal', 'Arepa Real', 'La Cevichería', 'Brasa Viva', 'Dulce Ola', 'Café Muralla', 'Pescado Fresco', 'Sazón de Abuela', 'Wok Caribe', 'Postres del Puerto'],
  F: ['Barbería Don Lucho', 'Fix Rápido', 'Lavandería Express', 'Sastrería Centro', 'Relojería Bahía', 'Uñas & Co', 'Foto Express', 'Cerrajería 24h'],
  G: ['VR Zone', 'Pixel Arena', 'Kart Rush', 'Esports Hub', 'Mesa Libre', 'Arcade Retro'],
}
const FALLBACK = ['Local de prueba']

const PALETTE: [string, string][] = [
  ['#d9826a', '#fbe4dc'], ['#7a5aa6', '#e9e0f5'], ['#2f6f8f', '#dcecf5'], ['#d14f7a', '#fbdde7'], ['#4f8a5e', '#dff0e3'], ['#d98a2b', '#fbe9d0'],
  ['#2a8f8a', '#d9f0ee'], ['#8c5e3c', '#efe1d4'], ['#5a6bd1', '#e0e4fb'], ['#c0453a', '#f9dedb'], ['#3a9a6f', '#d8f1e6'], ['#7d7d2e', '#efefd2'],
]
const FACADES: FacadeStyle[] = ['awning', 'arch', 'minimal']

const ICONS: Record<string, { icon: ProductIcon; name: string; price: number }[]> = {
  A: [{ icon: 'shirt', name: 'Camisa de lino', price: 89_900 }, { icon: 'dress', name: 'Vestido fresco', price: 139_900 }, { icon: 'pants', name: 'Pantalón playero', price: 109_900 }, { icon: 'hat', name: 'Sombrero', price: 59_900 }],
  B: [{ icon: 'headphones', name: 'Audífonos inalámbricos', price: 149_900 }, { icon: 'phone', name: 'Celular 128 GB', price: 899_000 }, { icon: 'charger', name: 'Cargador rápido', price: 49_900 }, { icon: 'laptop', name: 'Portátil', price: 2_100_000 }, { icon: 'watch', name: 'Reloj inteligente', price: 259_000 }, { icon: 'speaker', name: 'Parlante bluetooth', price: 119_900 }],
  C: [{ icon: 'perfume', name: 'Perfume floral', price: 189_000 }, { icon: 'lipstick', name: 'Labial mate', price: 39_900 }, { icon: 'serum', name: 'Sérum facial', price: 79_900 }, { icon: 'brush', name: 'Set de brochas', price: 64_900 }],
  D: [{ icon: 'candle', name: 'Vela aromática', price: 34_900 }, { icon: 'gift', name: 'Caja de regalo', price: 59_900 }, { icon: 'hammock', name: 'Hamaca tejida', price: 179_000 }, { icon: 'coffee', name: 'Café de origen', price: 24_900 }],
  E: [{ icon: 'plate', name: 'Plato del día', price: 28_000 }, { icon: 'fish', name: 'Pescado frito', price: 38_000 }, { icon: 'dessert', name: 'Postre de la casa', price: 14_000 }, { icon: 'drink', name: 'Limonada de coco', price: 9_000 }, { icon: 'meat', name: 'Parrilla mixta', price: 45_000 }, { icon: 'noodles', name: 'Sopa de fideos', price: 22_000 }],
  F: [{ icon: 'gift', name: 'Servicio express', price: 25_000 }, { icon: 'brush', name: 'Corte y arreglo', price: 30_000 }, { icon: 'watch', name: 'Revisión', price: 20_000 }],
  G: [{ icon: 'gift', name: 'Ficha de juego', price: 8_000 }, { icon: 'gift', name: 'Pase de 1 hora', price: 25_000 }],
}

/** Espacios que ya tienen una tienda propia en el diseño (no se tocan). */
const SKIP_LABELS = new Set(['D-05'])

export interface PreviewFill {
  stores: Store[]
  products: Product[]
  /** spaceId → storeId, solo de los espacios que estaban libres. */
  assignments: Record<string, string>
}

/** Un negocio de prueba por cada espacio libre. `stores`/`assignments` son lo real: no se modifican. */
export function buildPreviewFill(spaces: SpaceSlot[], zones: ZoneConfig[], realStores: Pick<Store, 'id'>[], realAssignments: Record<string, string>): PreviewFill {
  const known = new Set(realStores.map((s) => s.id))
  const zoneById = new Map(zones.map((z) => [z.id, z]))
  const used: Record<string, number> = {}
  const out: PreviewFill = { stores: [], products: [], assignments: {} }
  spaces.forEach((sp, i) => {
    if (SKIP_LABELS.has(sp.label) || (realAssignments[sp.id] && known.has(realAssignments[sp.id]))) return
    const zone = zoneById.get(sp.zoneId)
    const names = NAMES[sp.zoneId] ?? FALLBACK
    const n = (used[sp.zoneId] = (used[sp.zoneId] ?? -1) + 1)
    const name = n < names.length ? names[n] : `${names[n % names.length]} ${Math.floor(n / names.length) + 1}`
    const [brandColor, accentColor] = PALETTE[(i * 5 + n) % PALETTE.length]
    const cats = zone?.categories ?? []
    const categoryId = cats.length ? cats[n % cats.length].id : 'servicios'
    const id = `${PREVIEW_PREFIX}${sp.id}`
    const kind: Store['businessType'] = sp.zoneId === 'E' ? 'restaurant' : sp.zoneId === 'F' || sp.zoneId === 'G' ? 'service' : 'shop'
    out.stores.push({
      id,
      name,
      logoText: name.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, '').split(' ')[0].toUpperCase().slice(0, 8) || 'LOCAL',
      tagline: 'Local de prueba',
      description: 'Negocio inventado para ver el mall completo. No existe de verdad.',
      categoryId,
      zoneId: sp.zoneId,
      brandColor,
      accentColor,
      facade: FACADES[(i + n) % FACADES.length],
      instagram: '',
      whatsapp: '',
      status: 'open',
      businessType: kind,
      setup: 'done',
    })
    out.assignments[sp.id] = id
    const items = ICONS[sp.zoneId] ?? ICONS.F
    for (let k = 0; k < Math.min(4, items.length); k++) {
      const it = items[(n + k) % items.length]
      out.products.push({
        id: `${PREVIEW_PREFIX}P-${sp.id}-${k}`,
        storeId: id,
        name: it.name,
        description: 'Producto de prueba.',
        price: it.price,
        image: null,
        icon: it.icon,
        categoryId,
        tags: [],
        variants: [],
        sizes: [],
        inventory: { '_|_': 20 },
        featured: k === 0,
        active: true,
      })
    }
  })
  return out
}
