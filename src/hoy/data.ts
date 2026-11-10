// Datos de ejemplo de la edición (fase 1: diseño). En producción salen de los eventos del mall y de las promociones
// que los negocios crean en su panel.

export type Cat = 'Gastronomía' | 'Belleza' | 'Tecnología' | 'Moda' | 'Lifestyle' | 'Deportes' | 'Servicios'

export interface Promo {
  id: string
  store: string
  cat: Cat
  big: string
  title: string
  text: string
  /** Milisegundos hasta que termina (se cuenta desde que se abre la edición). */
  endsInMs: number
  flash?: boolean
  left?: number
  ended?: boolean
  hue: string
}

const H = 3600_000
export const PROMOS: Promo[] = [
  { id: 'fafi', store: "Fafi's Food", cat: 'Gastronomía', big: 'Combo', title: 'Costillas al barril + patacones', text: 'Por $29.900. El plato más pedido de la semana, caliente y al momento.', endsInMs: 3 * H + 24 * 60_000 + 18_000, flash: true, left: 12, hue: '#e8613c' },
  { id: 'lau', store: 'Lau Beauty Studio', cat: 'Belleza', big: '2x1', title: 'Higiene facial', text: 'Llega con una amiga y paga una sola limpieza profunda.', endsInMs: 7 * H, left: 6, hue: '#c2607f' },
  { id: 'tec', store: 'Tienda Tecnología', cat: 'Tecnología', big: '15% OFF', title: 'Accesorios para tu celular', text: 'Cargadores, fundas y audífonos con descuento directo en caja.', endsInMs: 22 * H, left: 40, hue: '#123a5e' },
  { id: 'moda', store: 'Moda Caribe', cat: 'Moda', big: '30% OFF', title: 'Segunda prenda', text: 'Lleva dos prendas de la nueva colección y la segunda cuesta 30% menos.', endsInMs: 11 * H, left: 18, hue: '#e2a72e' },
  { id: 'gym', store: 'Gym Bahía', cat: 'Deportes', big: 'Regalo', title: 'Pase gratis por compra', text: 'Con tu primera mensualidad te regalamos una semana para un amigo.', endsInMs: 30 * H, left: 25, hue: '#0f9e94' },
  { id: 'cafe', store: 'Café del Centro', cat: 'Gastronomía', big: '2x1', title: 'Café de origen', text: 'Dos cafés por el precio de uno, de 3 a 5 de la tarde.', endsInMs: 0, ended: true, left: 0, hue: '#8a5a3b' },
]

export const COVER = {
  headline: 'Cartagena tiene nuevos planes para descubrir hoy.',
  event: { kicker: 'Evento del día', title: 'Este sábado: torneo nocturno en la Isla Deportiva.', text: 'Fútbol 5 y pádel bajo luces, música y comida en las canchas. Cupos limitados.', when: 'Sábado · 7:00 p. m.', where: 'Zona de deportes · Piso 1' },
  lastHour: { title: 'Abrió la Galería de Joyería', text: 'Un salón exclusivo con cuatro boutiques, alfombra roja y vigilantes. Entra por la nueva puerta de vidrio.' },
  soon: { title: 'Nueva zona de entretenimiento', text: 'Más espacio sobre el mar para el 2.º piso y una isla de karts y videojuegos.' },
}

export const SECRET = { need: 3, done: 1 }
