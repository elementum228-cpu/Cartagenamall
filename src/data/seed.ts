import type { Product, Promotion, Store, Variant } from '../domain/types'

// Datos ficticios de demostración. Ningún negocio, número ni cuenta corresponde a uno real.

export const SEED_STORES: Store[] = [
  {
    id: 'STORE-001',
    name: 'Brisa Textil',
    logoText: 'BRISA',
    tagline: 'Lino y algodón para el calor caribeño',
    description: 'Prendas frescas de confección local: camisas de lino, vestidos ligeros y básicos de algodón pensados para el clima de la costa.',
    categoryId: 'moda-femenina',
    zoneId: 'A',
    brandColor: '#d9826a',
    accentColor: '#fbe3d6',
    facade: 'awning',
    instagram: '@brisatextil.demo',
    whatsapp: '+57 300 000 0001',
    status: 'open',
    categories: [{ id: 'camisas', name: 'Camisas y camisetas' }, { id: 'vestidos', name: 'Vestidos' }, { id: 'pantalones', name: 'Pantalones' }, { id: 'accesorios', name: 'Accesorios' }],
  },
  {
    id: 'STORE-002',
    name: 'Paso Firme',
    logoText: 'PASO',
    tagline: 'Calzado cómodo para caminar la ciudad',
    description: 'Sandalias, tenis y zapatos hechos para recorrer calles empedradas sin perder el estilo.',
    categoryId: 'calzado',
    zoneId: 'A',
    brandColor: '#6b5b95',
    accentColor: '#e7e1f3',
    facade: 'minimal',
    instagram: '@pasofirme.demo',
    whatsapp: '+57 300 000 0002',
    status: 'open',
  },
  {
    id: 'STORE-003',
    name: 'Nodo Tech',
    logoText: 'NODO',
    tagline: 'Accesorios y gadgets que sí duran',
    description: 'Cargadores, audífonos, fundas y pequeños gadgets seleccionados y probados. Garantía directa con la tienda.',
    categoryId: 'accesorios-moviles',
    zoneId: 'B',
    brandColor: '#2f6f8f',
    accentColor: '#dbeef6',
    facade: 'minimal',
    instagram: '@nodotech.demo',
    whatsapp: '+57 300 000 0003',
    status: 'open',
  },
  {
    id: 'STORE-004',
    name: 'Coral Belleza',
    logoText: 'CORAL',
    tagline: 'Cuidado de piel para sol y salitre',
    description: 'Sérums, protectores, labiales y fragancias con fórmulas ligeras para climas cálidos y húmedos.',
    categoryId: 'cosmeticos',
    zoneId: 'C',
    brandColor: '#d46a86',
    accentColor: '#fbe1e8',
    facade: 'arch',
    instagram: '@coralbelleza.demo',
    whatsapp: '+57 300 000 0004',
    status: 'open',
    categories: [{ id: 'champu', name: 'Champú y cabello' }, { id: 'tratamientos', name: 'Tratamientos' }, { id: 'maquillaje', name: 'Maquillaje' }, { id: 'fragancias', name: 'Fragancias' }],
  },
  {
    id: 'STORE-005',
    name: 'Casa Bahía',
    logoText: 'BAHÍA',
    tagline: 'Hogar, regalos y sabores de la costa',
    description: 'Velas, textiles tejidos a mano, café de origen y dulces típicos. Ideal para regalar o llevar a casa.',
    categoryId: 'hogar',
    zoneId: 'D',
    brandColor: '#4f8a64',
    accentColor: '#e1f0e5',
    facade: 'arch',
    instagram: '@casabahia.demo',
    whatsapp: '+57 300 000 0005',
    status: 'open',
  },
]

// ── Piso 2: zona de comida (negocios ficticios) ──
// IDs en la serie 1xx: no chocan con las tiendas que el admin crea al aprobar solicitudes.
SEED_STORES.push(
  {
    id: 'STORE-101',
    name: 'Sabor Caribe',
    logoText: 'SABOR',
    tagline: 'Cocina costeña de toda la vida',
    description: 'Arroz con coco, posta negra, pescado frito y jugos naturales, como en casa de la abuela.',
    categoryId: 'comida-local',
    zoneId: 'E',
    brandColor: '#c8702f',
    accentColor: '#fbe6cf',
    facade: 'awning',
    instagram: '@saborcaribe.demo',
    whatsapp: '+57 300 000 0006',
    status: 'open',
    categories: [{ id: 'fuertes', name: 'Platos fuertes' }, { id: 'bebidas', name: 'Bebidas' }],
  },
  {
    id: 'STORE-102',
    name: 'Mar y Fuego',
    logoText: 'MAR',
    tagline: 'Mariscos frescos a la brasa',
    description: 'Ceviches, cazuelas y arroz de camarón preparados al momento con producto del día.',
    categoryId: 'mariscos',
    zoneId: 'E',
    brandColor: '#2f7f95',
    accentColor: '#d9eef2',
    facade: 'minimal',
    instagram: '@marfuego.demo',
    whatsapp: '+57 300 000 0007',
    status: 'open',
    categories: [{ id: 'entradas', name: 'Entradas' }, { id: 'fuertes', name: 'Platos fuertes' }],
  },
  {
    id: 'STORE-103',
    name: 'Brasa Costeña',
    logoText: 'BRASA',
    tagline: 'Carnes y arepas al carbón',
    description: 'Picadas, chorizos, carne asada y arepas de huevo hechas en parrilla de carbón.',
    categoryId: 'asados',
    zoneId: 'E',
    brandColor: '#a8483a',
    accentColor: '#f6ddd6',
    facade: 'arch',
    instagram: '@brasacostena.demo',
    whatsapp: '+57 300 000 0008',
    status: 'open',
  },
  {
    id: 'STORE-104',
    name: 'Wok del Puerto',
    logoText: 'WOK',
    tagline: 'Fusión asiática con sabor local',
    description: 'Arroces salteados, fideos y bowls con ingredientes del Caribe colombiano.',
    categoryId: 'internacional',
    zoneId: 'E',
    brandColor: '#b8933a',
    accentColor: '#f6edd2',
    facade: 'minimal',
    instagram: '@wokdelpuerto.demo',
    whatsapp: '+57 300 000 0009',
    status: 'open',
  },
  {
    id: 'STORE-105',
    name: 'Café del Centro',
    logoText: 'CAFÉ',
    tagline: 'Café de origen y panadería',
    description: 'Café colombiano de origen, bebidas frías y pan recién horneado.',
    categoryId: 'cafe',
    zoneId: 'E',
    brandColor: '#7a5236',
    accentColor: '#efe2d3',
    facade: 'arch',
    instagram: '@cafedelcentro.demo',
    whatsapp: '+57 300 000 0010',
    status: 'open',
    categories: [{ id: 'cafes', name: 'Cafés' }, { id: 'panaderia', name: 'Panadería' }],
  },
  {
    id: 'STORE-106',
    name: 'Dulce Momento',
    logoText: 'DULCE',
    tagline: 'Postres y helados artesanales',
    description: 'Cocadas, enyucado, helados de frutas y postres de tres leches.',
    categoryId: 'postres',
    zoneId: 'E',
    brandColor: '#d06b8f',
    accentColor: '#fbe3ec',
    facade: 'awning',
    instagram: '@dulcemomento.demo',
    whatsapp: '+57 300 000 0011',
    status: 'open',
    categories: [{ id: 'postres', name: 'Postres' }, { id: 'helados', name: 'Helados' }],
  },
)

/** Asignación inicial espacio → tienda. Los demás espacios quedan disponibles. */
export const SEED_ASSIGNMENTS: Record<string, string> = {
  'P1-A5': 'STORE-001',
  'P1-A1': 'STORE-002',
  'P1-B2': 'STORE-003',
  'P1-C1': 'STORE-004',
  'P1-D5': 'STORE-005',
  'P2-E1': 'STORE-101',
  'P2-E2': 'STORE-102',
  'P2-E4': 'STORE-103',
  'P2-E5': 'STORE-104',
  'P2-E9': 'STORE-105',
  'P2-E10': 'STORE-106',
}

const v = (id: string, name: string, swatch?: string): Variant => ({ id, name, swatch })

/** Llena inventario mock para todas las combinaciones, con algunos agotados a propósito. */
function stock(variants: Variant[], sizes: string[], base: number, soldOut: string[] = []): Record<string, number> {
  const vs = variants.length ? variants.map((x) => x.id) : ['_']
  const ss = sizes.length ? sizes : ['_']
  const out: Record<string, number> = {}
  let i = 0
  for (const a of vs)
    for (const b of ss) {
      const key = `${a}|${b}`
      out[key] = soldOut.includes(key) ? 0 : Math.max(1, base - (i++ % 4))
    }
  return out
}

type ProductInput = Omit<Product, 'inventory' | 'image' | 'active' | 'featured' | 'tags'> & {
  base?: number
  soldOut?: string[]
  featured?: boolean
  tags?: string[]
}

function p(input: ProductInput): Product {
  const { base = 6, soldOut, ...rest } = input
  return {
    image: null,
    active: true,
    featured: false,
    tags: [],
    ...rest,
    inventory: stock(rest.variants, rest.sizes, base, soldOut),
  }
}

const TALLAS = ['S', 'M', 'L', 'XL']
const CALZADO = ['36', '37', '38', '39', '40', '41', '42']

/** Categoría propia de ejemplo por producto (cada dueño crea las suyas desde Mi negocio). */
const SEED_SHOP_CATEGORY: Record<string, string> = {
  'P-101': 'camisas', 'P-102': 'camisas', 'P-103': 'vestidos', 'P-104': 'pantalones', 'P-105': 'accesorios', 'P-106': 'pantalones',
  'P-401': 'tratamientos', 'P-402': 'tratamientos', 'P-403': 'maquillaje', 'P-404': 'fragancias', 'P-405': 'maquillaje', 'P-406': 'fragancias',
  'P-601': 'fuertes', 'P-602': 'fuertes', 'P-603': 'fuertes', 'P-604': 'bebidas',
  'P-701': 'entradas', 'P-702': 'fuertes', 'P-703': 'fuertes', 'P-704': 'entradas',
  'P-1001': 'cafes', 'P-1002': 'cafes', 'P-1003': 'panaderia', 'P-1004': 'cafes',
  'P-1101': 'postres', 'P-1102': 'helados', 'P-1103': 'postres',
}

const RAW_PRODUCTS: Product[] = [
  // ── Brisa Textil ──
  p({ id: 'P-101', storeId: 'STORE-001', name: 'Camiseta básica de algodón', description: 'Algodón peinado 180 g, corte recto. Fresca y resistente al lavado.', price: 60_000, icon: 'shirt', categoryId: 'moda-masculina', compareGroup: 'camiseta', tags: ['camiseta', 'algodón', 'básico'], variants: [v('blanco', 'Blanco', '#f4f1ea'), v('arena', 'Arena', '#d8c3a5'), v('azul', 'Azul mar', '#2f5d7c')], sizes: TALLAS, featured: true, soldOut: ['azul|XL'] }),
  p({ id: 'P-102', storeId: 'STORE-001', name: 'Camisa de lino manga larga', description: 'Lino 100 %, botones de coco. Perfecta para atardeceres en la muralla.', price: 129_000, icon: 'shirt', categoryId: 'moda-masculina', compareGroup: 'camisa', tags: ['camisa', 'lino'], variants: [v('crudo', 'Crudo', '#ece3d0'), v('oliva', 'Oliva', '#7d8461')], sizes: TALLAS, featured: true }),
  p({ id: 'P-103', storeId: 'STORE-001', name: 'Vestido midi Bocagrande', description: 'Viscosa ligera con caída suave y bolsillos laterales.', price: 149_000, icon: 'dress', categoryId: 'moda-femenina', compareGroup: 'vestido', tags: ['vestido', 'verano'], variants: [v('terracota', 'Terracota', '#c4643f'), v('negro', 'Negro', '#222')], sizes: ['S', 'M', 'L'], featured: true }),
  p({ id: 'P-104', storeId: 'STORE-001', name: 'Pantalón palazzo de lino', description: 'Tiro alto, pretina elástica, bota amplia.', price: 95_000, icon: 'pants', categoryId: 'moda-femenina', compareGroup: 'pantalon', tags: ['pantalón', 'lino'], variants: [v('crudo', 'Crudo', '#ece3d0'), v('arena', 'Arena', '#d8c3a5')], sizes: ['S', 'M', 'L'] }),
  p({ id: 'P-105', storeId: 'STORE-001', name: 'Sombrero de paja toquilla', description: 'Tejido artesanal con cinta en algodón.', price: 78_000, icon: 'hat', categoryId: 'accesorios', compareGroup: 'sombrero', tags: ['sombrero', 'sol', 'accesorio'], variants: [], sizes: ['M', 'L'] }),
  p({ id: 'P-106', storeId: 'STORE-001', name: 'Pantalón chino de algodón', description: 'Algodón con elastano, corte slim. Para oficina o fin de semana.', price: 112_000, icon: 'pants', categoryId: 'moda-masculina', compareGroup: 'pantalon', tags: ['pantalón', 'chino'], variants: [v('beige', 'Beige', '#cdb891'), v('azul', 'Azul noche', '#1f2d44')], sizes: ['30', '32', '34', '36'] }),

  // ── Paso Firme ──
  p({ id: 'P-201', storeId: 'STORE-002', name: 'Zapato casual en cuero', description: 'Cuero curtido, suela de caucho cosida. Hecho en Colombia.', price: 120_000, icon: 'shoe', categoryId: 'calzado', compareGroup: 'zapato', tags: ['zapatos', 'cuero'], variants: [v('miel', 'Miel', '#b07a44'), v('cafe', 'Café', '#5b3a22')], sizes: CALZADO, featured: true, soldOut: ['miel|36', 'cafe|42'] }),
  p({ id: 'P-202', storeId: 'STORE-002', name: 'Sandalia de playa acolchada', description: 'Plantilla de memoria, tiras en lona.', price: 58_000, icon: 'sandal', categoryId: 'calzado', compareGroup: 'sandalia', tags: ['sandalias', 'playa'], variants: [v('negro', 'Negro', '#222'), v('arena', 'Arena', '#d8c3a5')], sizes: CALZADO, featured: true }),
  p({ id: 'P-203', storeId: 'STORE-002', name: 'Tenis urbanos en lona', description: 'Lona lavable y suela vulcanizada.', price: 99_000, icon: 'shoe', categoryId: 'calzado', compareGroup: 'tenis', tags: ['tenis', 'lona'], variants: [v('blanco', 'Blanco', '#f4f1ea'), v('verde', 'Verde', '#4f7a5b')], sizes: CALZADO }),
  p({ id: 'P-204', storeId: 'STORE-002', name: 'Camiseta técnica para caminar', description: 'Tela de secado rápido con protección UV 30.', price: 55_000, icon: 'shirt', categoryId: 'moda-masculina', compareGroup: 'camiseta', tags: ['camiseta', 'deporte'], variants: [v('gris', 'Gris', '#8b9096'), v('negro', 'Negro', '#222')], sizes: TALLAS }),

  // ── Nodo Tech ──
  p({ id: 'P-301', storeId: 'STORE-003', name: 'Audífonos inalámbricos Ola', description: 'Bluetooth 5.3, 30 h de batería con estuche, cancelación pasiva.', price: 189_000, icon: 'headphones', categoryId: 'electronica', compareGroup: 'audifonos', tags: ['audífonos', 'bluetooth'], variants: [v('negro', 'Negro', '#222'), v('blanco', 'Blanco', '#f4f1ea')], sizes: [], featured: true, base: 4 }),
  p({ id: 'P-302', storeId: 'STORE-003', name: 'Cargador rápido USB-C 30 W', description: 'Carga un teléfono al 50 % en 30 minutos. Incluye cable.', price: 69_000, icon: 'charger', categoryId: 'accesorios-moviles', compareGroup: 'cargador', tags: ['cargador', 'usb-c'], variants: [], sizes: [], featured: true }),
  p({ id: 'P-303', storeId: 'STORE-003', name: 'Funda antigolpes transparente', description: 'Esquinas reforzadas, compatible con carga inalámbrica.', price: 35_000, icon: 'phone', categoryId: 'accesorios-moviles', compareGroup: 'funda', tags: ['funda', 'celular'], variants: [v('ip15', 'iPhone 15'), v('s24', 'Galaxy S24'), v('a55', 'Galaxy A55')], sizes: [], soldOut: ['s24|_'] }),
  p({ id: 'P-304', storeId: 'STORE-003', name: 'Reloj inteligente Pulso', description: 'Monitoreo de ritmo cardíaco, resistente al agua, 7 días de batería.', price: 249_000, icon: 'watch', categoryId: 'gadgets', compareGroup: 'reloj', tags: ['smartwatch', 'reloj'], variants: [v('negro', 'Negro', '#222'), v('rosa', 'Rosa', '#d9a3a8')], sizes: [], base: 3 }),
  p({ id: 'P-305', storeId: 'STORE-003', name: 'Parlante portátil Marea', description: 'Resistente a salpicaduras, 12 h de música.', price: 139_000, icon: 'speaker', categoryId: 'electronica', compareGroup: 'parlante', tags: ['parlante', 'bluetooth'], variants: [v('azul', 'Azul', '#2f5d7c'), v('coral', 'Coral', '#e0735f')], sizes: [] }),
  p({ id: 'P-306', storeId: 'STORE-003', name: 'Soporte de portátil plegable', description: 'Aluminio, 6 alturas. Mejora la postura.', price: 89_000, icon: 'laptop', categoryId: 'computadores', compareGroup: 'soporte', tags: ['portátil', 'soporte'], variants: [], sizes: [] }),

  // ── Coral Belleza ──
  p({ id: 'P-401', storeId: 'STORE-004', name: 'Sérum de vitamina C', description: '15 % vitamina C estabilizada, textura ligera. 30 ml.', price: 85_000, icon: 'serum', categoryId: 'cuidado-personal', compareGroup: 'serum', tags: ['sérum', 'piel'], variants: [], sizes: [], featured: true }),
  p({ id: 'P-402', storeId: 'STORE-004', name: 'Protector solar toque seco FPS 50', description: 'Sin residuo blanco, resistente al sudor. 50 ml.', price: 62_000, icon: 'serum', categoryId: 'cuidado-personal', compareGroup: 'protector', tags: ['protector', 'sol'], variants: [], sizes: [], featured: true }),
  p({ id: 'P-403', storeId: 'STORE-004', name: 'Labial mate de larga duración', description: 'Fórmula hidratante que no se transfiere.', price: 39_000, icon: 'lipstick', categoryId: 'cosmeticos', compareGroup: 'labial', tags: ['labial', 'maquillaje'], variants: [v('coral', 'Coral', '#e0735f'), v('rojo', 'Rojo', '#a8323e'), v('nude', 'Nude', '#c99b83')], sizes: [] }),
  p({ id: 'P-404', storeId: 'STORE-004', name: 'Eau de parfum Atardecer', description: 'Notas de coco, vainilla y flor de azahar. 50 ml.', price: 165_000, icon: 'perfume', categoryId: 'perfumeria', compareGroup: 'perfume', tags: ['perfume', 'fragancia'], variants: [], sizes: [], base: 3 }),
  p({ id: 'P-405', storeId: 'STORE-004', name: 'Set de brochas de bambú', description: '6 brochas veganas con estuche de algodón.', price: 72_000, icon: 'brush', categoryId: 'accesorios-belleza', compareGroup: 'brochas', tags: ['brochas', 'maquillaje'], variants: [], sizes: [] }),
  p({ id: 'P-406', storeId: 'STORE-004', name: 'Vela aromática de coco', description: 'Cera de soya, 40 h de duración.', price: 48_000, icon: 'candle', categoryId: 'cuidado-personal', compareGroup: 'vela', tags: ['vela', 'aroma'], variants: [], sizes: [] }),

  // ── Casa Bahía ──
  p({ id: 'P-501', storeId: 'STORE-005', name: 'Vela de soya Brisa marina', description: 'Vaso de vidrio reutilizable, mecha de algodón. 45 h.', price: 52_000, icon: 'candle', categoryId: 'hogar', compareGroup: 'vela', tags: ['vela', 'hogar'], variants: [], sizes: [], featured: true }),
  p({ id: 'P-502', storeId: 'STORE-005', name: 'Café de origen Sierra Nevada 340 g', description: 'Tostión media, notas a panela y chocolate. En grano o molido.', price: 38_000, icon: 'coffee', categoryId: 'gastronomia', compareGroup: 'cafe', tags: ['café', 'regalo'], variants: [v('grano', 'En grano'), v('molido', 'Molido')], sizes: [], featured: true }),
  p({ id: 'P-503', storeId: 'STORE-005', name: 'Bolso tejido a mano', description: 'Tejido artesanal en fique teñido natural. Pieza única.', price: 135_000, icon: 'bag', categoryId: 'artesanal', compareGroup: 'bolso', tags: ['bolso', 'artesanal'], variants: [v('natural', 'Natural', '#cfb68a'), v('coral', 'Coral', '#e0735f')], sizes: [], base: 2 }),
  p({ id: 'P-504', storeId: 'STORE-005', name: 'Caja de cocadas surtidas', description: '12 cocadas de panela, leche y maracuyá.', price: 28_000, icon: 'sweet', categoryId: 'gastronomia', compareGroup: 'dulces', tags: ['dulces', 'regalo'], variants: [], sizes: [] }),
  p({ id: 'P-505', storeId: 'STORE-005', name: 'Hamaca de algodón para balcón', description: 'Algodón trenzado, soporta hasta 120 kg.', price: 210_000, icon: 'hammock', categoryId: 'hogar', compareGroup: 'hamaca', tags: ['hamaca', 'hogar'], variants: [v('arena', 'Arena', '#d8c3a5'), v('rayas', 'Rayas caribe', '#3b82a6')], sizes: [], base: 2 }),
  p({ id: 'P-506', storeId: 'STORE-005', name: 'Caja regalo "Sabor a costa"', description: 'Café, cocadas y vela pequeña en caja de cartón reciclado.', price: 95_000, icon: 'gift', categoryId: 'regalos', compareGroup: 'regalo', tags: ['regalo', 'kit'], variants: [], sizes: [] }),

  // ── Piso 2: menús (porciones disponibles hoy como inventario mock) ──
  p({ id: 'P-601', storeId: 'STORE-101', name: 'Posta negra cartagenera', description: 'Con arroz con coco, patacón y ensalada.', price: 38_000, icon: 'meat', categoryId: 'comida-local', compareGroup: 'plato-fuerte', tags: ['almuerzo', 'típico'], variants: [], sizes: [], featured: true, base: 12 }),
  p({ id: 'P-602', storeId: 'STORE-101', name: 'Mojarra frita con patacón', description: 'Mojarra entera, arroz con coco y ensalada de aguacate.', price: 42_000, icon: 'fish', categoryId: 'comida-local', compareGroup: 'pescado', tags: ['pescado', 'típico'], variants: [], sizes: [], featured: true, base: 8 }),
  p({ id: 'P-603', storeId: 'STORE-101', name: 'Arroz con coco y camarón', description: 'Arroz de coco titoté con camarones salteados.', price: 34_000, icon: 'plate', categoryId: 'comida-local', compareGroup: 'arroz', tags: ['arroz', 'camarón'], variants: [v('personal', 'Personal'), v('compartir', 'Para compartir')], sizes: [], base: 10 }),
  p({ id: 'P-604', storeId: 'STORE-101', name: 'Limonada de coco', description: 'Limón, crema de coco y hielo frappé.', price: 12_000, icon: 'drink', categoryId: 'comida-local', compareGroup: 'bebida', tags: ['bebida', 'jugo'], variants: [], sizes: [], base: 30 }),

  p({ id: 'P-701', storeId: 'STORE-102', name: 'Ceviche de camarón', description: 'Camarón, mango biche, cebolla morada y leche de tigre.', price: 32_000, icon: 'fish', categoryId: 'mariscos', compareGroup: 'ceviche', tags: ['ceviche', 'mariscos'], variants: [], sizes: [], featured: true, base: 10 }),
  p({ id: 'P-702', storeId: 'STORE-102', name: 'Cazuela de mariscos', description: 'Mariscos en salsa de coco, con arroz y patacón.', price: 48_000, icon: 'noodles', categoryId: 'mariscos', compareGroup: 'cazuela', tags: ['cazuela', 'mariscos'], variants: [], sizes: [], featured: true, base: 6 }),
  p({ id: 'P-703', storeId: 'STORE-102', name: 'Arroz de camarón', description: 'Arroz salteado con camarones y vegetales.', price: 36_000, icon: 'plate', categoryId: 'mariscos', compareGroup: 'arroz', tags: ['arroz', 'camarón'], variants: [v('personal', 'Personal'), v('compartir', 'Para compartir')], sizes: [], base: 8 }),
  p({ id: 'P-704', storeId: 'STORE-102', name: 'Patacones con hogao', description: 'Seis patacones con hogao y queso costeño.', price: 16_000, icon: 'plate', categoryId: 'mariscos', compareGroup: 'entrada', tags: ['patacón', 'entrada'], variants: [], sizes: [], base: 15 }),

  p({ id: 'P-801', storeId: 'STORE-103', name: 'Picada costeña', description: 'Carne, chorizo, butifarra, yuca y bollo limpio.', price: 45_000, icon: 'meat', categoryId: 'asados', compareGroup: 'plato-fuerte', tags: ['carne', 'picada'], variants: [v('2p', 'Para 2'), v('4p', 'Para 4')], sizes: [], featured: true, base: 8 }),
  p({ id: 'P-802', storeId: 'STORE-103', name: 'Arepa de huevo', description: 'Arepa frita rellena de huevo y carne molida.', price: 9_000, icon: 'plate', categoryId: 'asados', compareGroup: 'entrada', tags: ['arepa', 'fritos'], variants: [], sizes: [], featured: true, base: 25 }),
  p({ id: 'P-803', storeId: 'STORE-103', name: 'Churrasco al carbón', description: '300 g con papa criolla y chimichurri.', price: 52_000, icon: 'meat', categoryId: 'asados', compareGroup: 'carne', tags: ['carne', 'parrilla'], variants: [], sizes: [], base: 6 }),

  p({ id: 'P-901', storeId: 'STORE-104', name: 'Arroz wok caribeño', description: 'Arroz salteado con pollo, piña y salsa de tamarindo.', price: 29_000, icon: 'noodles', categoryId: 'internacional', compareGroup: 'arroz', tags: ['arroz', 'wok'], variants: [v('pollo', 'Pollo'), v('camaron', 'Camarón')], sizes: [], featured: true, base: 12 }),
  p({ id: 'P-902', storeId: 'STORE-104', name: 'Fideos de la bahía', description: 'Fideos con mariscos, jengibre y coco.', price: 33_000, icon: 'noodles', categoryId: 'internacional', compareGroup: 'pasta', tags: ['fideos', 'mariscos'], variants: [], sizes: [], featured: true, base: 10 }),
  p({ id: 'P-903', storeId: 'STORE-104', name: 'Bowl de atún y mango', description: 'Arroz, atún sellado, mango, aguacate y ajonjolí.', price: 31_000, icon: 'plate', categoryId: 'internacional', compareGroup: 'bowl', tags: ['bowl', 'saludable'], variants: [], sizes: [], base: 8 }),

  p({ id: 'P-1001', storeId: 'STORE-105', name: 'Café de origen', description: 'Taza filtrada de café de la Sierra Nevada.', price: 6_500, icon: 'coffee', categoryId: 'cafe', compareGroup: 'cafe-taza', tags: ['café', 'bebida caliente'], variants: [v('pequeno', 'Pequeño'), v('grande', 'Grande')], sizes: [], featured: true, base: 40 }),
  p({ id: 'P-1002', storeId: 'STORE-105', name: 'Capuchino', description: 'Espresso doble y leche texturizada.', price: 9_500, icon: 'coffee', categoryId: 'cafe', compareGroup: 'cafe-taza', tags: ['café', 'leche'], variants: [], sizes: [], base: 30 }),
  p({ id: 'P-1003', storeId: 'STORE-105', name: 'Croissant de queso costeño', description: 'Hojaldre recién horneado con queso costeño.', price: 7_500, icon: 'croissant', categoryId: 'cafe', compareGroup: 'pan', tags: ['pan', 'desayuno'], variants: [], sizes: [], featured: true, base: 18 }),
  p({ id: 'P-1004', storeId: 'STORE-105', name: 'Café frío de panela', description: 'Cold brew endulzado con panela y hielo.', price: 11_000, icon: 'drink', categoryId: 'cafe', compareGroup: 'bebida', tags: ['café', 'frío'], variants: [], sizes: [], base: 20 }),

  p({ id: 'P-1101', storeId: 'STORE-106', name: 'Tres leches de coco', description: 'Porción individual con coco tostado.', price: 12_000, icon: 'dessert', categoryId: 'postres', compareGroup: 'postre', tags: ['postre', 'tres leches'], variants: [], sizes: [], featured: true, base: 14 }),
  p({ id: 'P-1102', storeId: 'STORE-106', name: 'Helado artesanal de corozo', description: 'Dos bolas en vaso o cono.', price: 9_000, icon: 'dessert', categoryId: 'postres', compareGroup: 'helado', tags: ['helado', 'frutas'], variants: [v('vaso', 'Vaso'), v('cono', 'Cono')], sizes: [], featured: true, base: 25 }),
  p({ id: 'P-1103', storeId: 'STORE-106', name: 'Enyucado', description: 'Postre de yuca, coco y queso, horneado.', price: 8_000, icon: 'dessert', categoryId: 'postres', compareGroup: 'postre', tags: ['postre', 'típico'], variants: [], sizes: [], base: 16 }),
]

export const SEED_PRODUCTS: Product[] = RAW_PRODUCTS.map((pr) => (SEED_SHOP_CATEGORY[pr.id] ? { ...pr, shopCategory: SEED_SHOP_CATEGORY[pr.id] } : pr))

const HOUR = 3_600_000

export function createSeedPromotions(now: number): Promotion[] {
  const iso = (t: number) => new Date(t).toISOString()
  return [
    // Normales
    { id: 'PROMO-N1', type: 'normal', storeId: 'STORE-001', productId: 'P-102', title: 'Temporada de lino', description: '15 % en camisas de lino.', discountPercent: 15, startsAt: iso(now - HOUR), endsAt: null, active: true },
    { id: 'PROMO-N2', type: 'normal', storeId: 'STORE-004', productId: 'P-402', title: 'Protégete del sol', description: '10 % en protector FPS 50.', discountPercent: 10, startsAt: iso(now - HOUR), endsAt: null, active: true },
    { id: 'PROMO-N3', type: 'normal', storeId: 'STORE-005', productId: 'P-506', title: 'Regala costa', description: '12 % en la caja regalo.', discountPercent: 12, startsAt: iso(now - HOUR), endsAt: null, active: true },
    // Relámpago
    { id: 'PROMO-F1', type: 'flash', storeId: 'STORE-003', productId: 'P-301', title: 'Relámpago: audífonos Ola', description: 'Solo por unas horas.', discountPercent: 25, startsAt: iso(now - HOUR / 2), endsAt: iso(now + 6 * HOUR), durationHours: 6, active: true },
    { id: 'PROMO-F2', type: 'flash', storeId: 'STORE-002', productId: 'P-202', title: 'Relámpago: sandalias', description: 'Hasta agotar existencias o tiempo.', discountPercent: 30, startsAt: iso(now - HOUR / 2), endsAt: iso(now + 3 * HOUR), durationHours: 3, active: true },
    // Escondidas: solo aparecen al explorar cerca de la tienda en el mundo 3D.
    { id: 'PROMO-S1', type: 'secret', storeId: 'STORE-002', productId: 'P-201', title: 'Oferta secreta de Paso Firme', description: 'Para quien recorre el pasillo de Moda.', discountPercent: 20, code: 'PASO20', startsAt: iso(now - HOUR), endsAt: iso(now + 72 * HOUR), durationHours: 72, active: true },
    { id: 'PROMO-S2', type: 'secret', storeId: 'STORE-003', productId: 'P-304', title: 'Oferta secreta de Nodo Tech', description: 'Encontrada entre los gadgets.', discountPercent: 18, code: 'NODO18', startsAt: iso(now - HOUR), endsAt: iso(now + 72 * HOUR), durationHours: 72, active: true },
    // Piso 2
    { id: 'PROMO-N4', type: 'normal', storeId: 'STORE-102', productId: 'P-701', title: 'Martes de ceviche', description: '10 % en ceviche de camarón.', discountPercent: 10, startsAt: iso(now - HOUR), endsAt: null, active: true },
    { id: 'PROMO-F3', type: 'flash', storeId: 'STORE-106', productId: 'P-1101', title: 'Relámpago: tres leches', description: 'Para la tarde.', discountPercent: 25, startsAt: iso(now - HOUR / 2), endsAt: iso(now + 4 * HOUR), durationHours: 4, active: true },
    { id: 'PROMO-S4', type: 'secret', storeId: 'STORE-105', productId: 'P-1002', title: 'Oferta secreta de Café del Centro', description: 'Escondida en la zona de comida.', discountPercent: 30, code: 'CAFE30', startsAt: iso(now - HOUR), endsAt: iso(now + 72 * HOUR), durationHours: 72, active: true },
    { id: 'PROMO-S3', type: 'secret', storeId: 'STORE-005', productId: 'P-505', title: 'Oferta secreta de Casa Bahía', description: 'Escondida al fondo del pasillo Lifestyle.', discountPercent: 22, code: 'BAHIA22', startsAt: iso(now - HOUR), endsAt: iso(now + 72 * HOUR), durationHours: 72, active: true },
  ]
}
