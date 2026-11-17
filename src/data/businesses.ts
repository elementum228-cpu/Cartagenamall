import type { Product, Store } from '../domain/types'

// Negocios propios del mall (los administra el equipo): Planly, GrowDesk, las dos lanchas del muelle y el barco pirata.
// Son negocios de servicios: sus «productos» son servicios que se reservan por WhatsApp (sin carrito). El WhatsApp y los
// precios son iniciales: se editan desde Mi negocio. Archivo sin dependencias para poder generar el SQL de carga.

const base = (o: Pick<Store, 'id' | 'name' | 'logoText' | 'tagline' | 'description' | 'brandColor' | 'accentColor'>): Store => ({
  categoryId: 'servicios',
  zoneId: 'F',
  facade: 'minimal',
  instagram: '',
  whatsapp: '',
  status: 'open',
  businessType: 'service',
  setup: 'done',
  ...o,
})

/** George's: cafetería de especialidad de la zona de comida (Piso 2). Tiene edificio propio en el mapa (world/GeorgesCafe). */
export const GEORGES_STORE_ID = 'STORE-GEORGES'

const georges: Store = {
  id: GEORGES_STORE_ID,
  name: "George's",
  logoText: "GEORGE'S",
  tagline: 'Café de especialidad y panadería',
  description: 'Café de especialidad con granos de la Sierra Nevada, panadería recién hecha y postres de la casa. Una terraza frente a la zona de comida para quedarte un rato.',
  categoryId: 'cafe',
  zoneId: 'E',
  brandColor: '#f4b820',
  accentColor: '#fff3c4',
  facade: 'minimal',
  instagram: '',
  whatsapp: '',
  status: 'open',
  businessType: 'restaurant',
  setup: 'done',
  categories: [
    { id: 'cafes', name: 'Cafés' },
    { id: 'frios', name: 'Fríos' },
    { id: 'panaderia', name: 'Panadería' },
    { id: 'postres', name: 'Postres' },
  ],
}

export const BUSINESS_STORES: Store[] = [
  base({ id: 'STORE-PLANLY', name: 'Planly', logoText: 'PLANLY', tagline: 'Tu viaje a Cartagena, planeado', description: 'Agencia de turismo para descubrir Cartagena y sus islas: planes a medida, tours y experiencias, con todo organizado en un solo lugar.', brandColor: '#e0735f', accentColor: '#fbe3d6' }),
  base({ id: 'STORE-GROWDESK', name: 'GrowDesk', logoText: 'GROWDESK', tagline: 'Tecnología para que tu negocio crezca', description: 'Estudio de software: creamos las herramientas digitales que tu negocio necesita para vender más y trabajar mejor.', brandColor: '#2b3f73', accentColor: '#dfe6f7' }),
  base({ id: 'STORE-LANCHA-MAR', name: 'Escapadas al mar', logoText: 'MAR', tagline: 'Barú, Tierra Bomba e Islas del Rosario', description: 'Pasadías en isla, playas de arena blanca, lanchas privadas y transporte marítimo desde la ciudad.', brandColor: '#13b9ad', accentColor: '#d6f3f0' }),
  base({ id: 'STORE-LANCHA-BAHIA', name: 'La bahía al atardecer', logoText: 'BAHÍA', tagline: 'Tours, cenas y planes románticos', description: 'Recorridos por la bahía, yates, cenas a bordo y el atardecer frente a las murallas.', brandColor: '#f27b68', accentColor: '#fde3dd' }),
  base({ id: 'STORE-PIRATA', name: 'Barco pirata', logoText: 'PIRATA', tagline: 'Fiestas, eventos y paseos por la bahía', description: 'El barco más llamativo del muelle: fiestas con música, cumpleaños, eventos de empresa y lanzamientos de marca navegando frente a las murallas.', brandColor: '#c8963e', accentColor: '#f5e8cf' }),
  georges,
]

const svc = (id: string, storeId: string, name: string, description: string, price: number, featured = false): Product => ({
  id,
  storeId,
  name,
  description,
  price,
  image: null,
  icon: 'gift',
  categoryId: 'servicios',
  tags: ['servicio'],
  variants: [],
  sizes: [],
  inventory: { '_|_': 99 },
  featured,
  active: true,
})

export const BUSINESS_PRODUCTS: Product[] = [
  svc('P-PLANLY-1', 'STORE-PLANLY', 'Plan a medida', 'Itinerario según tus días, tu presupuesto y lo que te gusta.', 150_000, true),
  svc('P-PLANLY-2', 'STORE-PLANLY', 'Islas y playas', 'Pasadía a Barú, Islas del Rosario o Tierra Bomba, con traslados.', 220_000, true),
  svc('P-PLANLY-3', 'STORE-PLANLY', 'Paquete completo', 'Hospedaje, traslados y tours coordinados.', 650_000),
  svc('P-PLANLY-4', 'STORE-PLANLY', 'Grupos y empresas', 'Viajes de incentivo, eventos y celebraciones.', 900_000),
  svc('P-GROWDESK-1', 'STORE-GROWDESK', 'App o sitio web a la medida', 'Del diseño al lanzamiento: el producto digital que tu negocio necesita.', 2_500_000, true),
  svc('P-GROWDESK-2', 'STORE-GROWDESK', 'Tienda en línea', 'Catálogo, pedidos y pagos para vender por internet.', 1_800_000, true),
  svc('P-GROWDESK-3', 'STORE-GROWDESK', 'Automatización e IA', 'Procesos y atención al cliente que funcionan solos.', 1_200_000),
  svc('P-GROWDESK-4', 'STORE-GROWDESK', 'Asesoría de datos y crecimiento', 'Tableros, métricas y asesoría para decidir mejor.', 350_000),
  svc('P-MAR-1', 'STORE-LANCHA-MAR', 'Pasadía en Islas del Rosario', 'Día completo. Salida 8:00 a. m., regreso 4:00 p. m.', 280_000, true),
  svc('P-MAR-2', 'STORE-LANCHA-MAR', 'Día de playa en Barú', 'Día completo en Playa Blanca. Salida 8:30 a. m.', 180_000, true),
  svc('P-MAR-3', 'STORE-LANCHA-MAR', 'Lancha taxi a Tierra Bomba', 'Traslado de 20 minutos, según demanda.', 60_000),
  svc('P-MAR-4', 'STORE-LANCHA-MAR', 'Lancha privada a Barú', 'Día completo, para hasta 10 personas. Desde las 7:30 a. m.', 1_400_000),
  svc('P-BAHIA-1', 'STORE-LANCHA-BAHIA', 'Recorrido por la bahía', '2 horas. Salidas 10:00 a. m. y 3:00 p. m.', 90_000, true),
  svc('P-BAHIA-2', 'STORE-LANCHA-BAHIA', 'Sunset frente a la muralla', '1 h 30 min. Todos los días, 5:00 p. m.', 120_000, true),
  svc('P-BAHIA-3', 'STORE-LANCHA-BAHIA', 'Cena a bordo para dos', '2 h 30 min. 7:00 p. m.', 380_000),
  svc('P-BAHIA-4', 'STORE-LANCHA-BAHIA', 'Yate privado por el día', 'Islas del Rosario, hasta 12 personas. Horario a convenir.', 3_500_000),
  svc('P-PIRATA-1', 'STORE-PIRATA', 'Fiesta a bordo del barco pirata', '3 horas con música. Viernes y sábados, 8:00 p. m.', 150_000, true),
  svc('P-PIRATA-2', 'STORE-PIRATA', 'Cumpleaños y eventos privados', 'Horario a convenir, hasta 120 personas.', 4_500_000, true),
  svc('P-PIRATA-3', 'STORE-PIRATA', 'Lanzamiento de marca a bordo', '2 horas frente a las murallas. Horario a convenir.', 6_000_000),
]

const dish = (id: string, name: string, description: string, price: number, icon: Product['icon'], shopCategory: string, categoryId: string, featured = false): Product => ({
  id: `P-GEORGES-${id}`,
  storeId: GEORGES_STORE_ID,
  name,
  description,
  price,
  image: null,
  icon,
  categoryId,
  shopCategory,
  tags: ['café'],
  variants: [],
  sizes: [],
  inventory: { '_|_': 99 },
  featured,
  active: true,
})

/** Menú inicial de George's: el negocio lo reemplaza desde Mi negocio con sus platos y fotos. */
export const GEORGES_PRODUCTS: Product[] = [
  dish('1', 'Espresso', 'Doble, de granos de la Sierra Nevada.', 6_500, 'coffee', 'cafes', 'cafe'),
  dish('2', 'Americano', 'Espresso largo con agua caliente.', 7_000, 'coffee', 'cafes', 'cafe'),
  dish('3', 'Capuchino', 'Espresso, leche vaporizada y espuma cremosa.', 9_500, 'coffee', 'cafes', 'cafe', true),
  dish('4', 'Latte de vainilla', 'Suave y dulce, con vainilla natural.', 11_000, 'coffee', 'cafes', 'cafe', true),
  dish('5', 'Flat white', 'Doble espresso con leche texturizada.', 10_500, 'coffee', 'cafes', 'cafe'),
  dish('6', 'Mocaccino', 'Espresso, chocolate y crema.', 12_000, 'coffee', 'cafes', 'cafe'),
  dish('7', 'Cold brew', 'Extracción en frío por 18 horas, con hielo.', 12_500, 'drink', 'frios', 'cafe', true),
  dish('8', 'Frappé de caramelo', 'Café frío batido con caramelo y crema.', 15_500, 'drink', 'frios', 'cafe'),
  dish('9', 'Limonada de coco', 'Fresca y cremosa, la favorita del Caribe.', 11_000, 'drink', 'frios', 'cafe'),
  dish('10', 'Té frío de maracuyá', 'Té negro con maracuyá y hielo.', 9_000, 'drink', 'frios', 'cafe'),
  dish('11', 'Croissant de mantequilla', 'Hojaldrado, recién horneado.', 8_500, 'croissant', 'panaderia', 'cafe', true),
  dish('12', 'Croissant de jamón y queso', 'Con queso fundido, calientico.', 13_500, 'croissant', 'panaderia', 'cafe'),
  dish('13', 'Pan de bono (3 unidades)', 'Tibio, con queso costeño.', 7_500, 'croissant', 'panaderia', 'cafe'),
  dish('14', 'Sándwich de pollo', 'Pollo desmechado, aguacate y pan artesanal.', 18_500, 'plate', 'panaderia', 'cafe'),
  dish('15', 'Torta de zanahoria', 'Con crema de queso y nueces.', 12_000, 'dessert', 'postres', 'postres'),
  dish('16', 'Brownie con helado', 'Chocolate tibio y helado de vainilla.', 14_000, 'dessert', 'postres', 'postres', true),
  dish('17', 'Cheesecake de maracuyá', 'Base de galleta y cobertura de maracuyá.', 13_500, 'dessert', 'postres', 'postres'),
]
