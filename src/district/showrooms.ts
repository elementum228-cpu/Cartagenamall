// Vitrinas de marcas aliadas en la zona de servicios: locales grandes para promocionar servicios
// (no venden productos del carrito). Contenido editable aquí; los enlaces vacíos muestran
// «Contacto próximamente» hasta que se configuren.

export type ShowroomId = 'planly' | 'growdesk'

export interface ShowroomService {
  title: string
  body: string
  /** Ícono (nombre corto, ver features/ShowroomSheet). */
  icon: 'map' | 'palm' | 'hotel' | 'users' | 'code' | 'cart' | 'bot' | 'chart'
}

export interface Showroom {
  id: ShowroomId
  name: string
  /** Rubro corto bajo el nombre. */
  kind: string
  tagline: string
  description: string
  color: string
  services: ShowroomService[]
  /** Enlace principal (web, WhatsApp o formulario). Vacío = aún sin configurar. */
  ctaLabel: string
  ctaHref: string
  /** Centro (x, z) y tamaño (ancho x, fondo z) del local en el piso 1; la fachada mira a +z. */
  position: [number, number]
  size: [number, number]
}

export const SHOWROOMS: Record<ShowroomId, Showroom> = {
  planly: {
    id: 'planly',
    name: 'Planly',
    kind: 'Turismo',
    tagline: 'Tu viaje a Cartagena, planeado',
    description: 'Agencia de turismo para descubrir Cartagena y sus islas: planes a medida, tours y experiencias, con todo organizado en un solo lugar.',
    color: '#e0735f',
    services: [
      { icon: 'map', title: 'Planes a medida', body: 'Itinerarios según tus días, tu presupuesto y lo que te gusta.' },
      { icon: 'palm', title: 'Islas y playas', body: 'Pasadías a Barú, Islas del Rosario y Tierra Bomba.' },
      { icon: 'hotel', title: 'Paquetes completos', body: 'Hospedaje, traslados y tours coordinados.' },
      { icon: 'users', title: 'Grupos y empresas', body: 'Viajes de incentivo, eventos y celebraciones.' },
    ],
    ctaLabel: 'Planear mi viaje',
    ctaHref: '',
    position: [-24.3, 14.4],
    size: [8.4, 6],
  },
  growdesk: {
    id: 'growdesk',
    name: 'GrowDesk',
    kind: 'Software',
    tagline: 'Tecnología para que tu negocio crezca',
    description: 'Estudio de software: creamos las herramientas digitales que tu negocio necesita para vender más y trabajar mejor.',
    color: '#2b3f73',
    services: [
      { icon: 'code', title: 'Apps y sitios web', body: 'Productos digitales a la medida, del diseño al lanzamiento.' },
      { icon: 'cart', title: 'Tiendas en línea', body: 'Catálogo, pedidos y pagos para vender por internet.' },
      { icon: 'bot', title: 'Automatización e IA', body: 'Procesos y atención que funcionan solos.' },
      { icon: 'chart', title: 'Datos y crecimiento', body: 'Tableros, métricas y asesoría para decidir mejor.' },
    ],
    ctaLabel: 'Agendar una asesoría',
    ctaHref: '',
    position: [-14.6, 14.4],
    size: [7, 6],
  },
}
export const SHOWROOM_IDS = Object.keys(SHOWROOMS) as ShowroomId[]
