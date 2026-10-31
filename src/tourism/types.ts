// Muelle turístico: lanchas, categorías y experiencias de operadores de Cartagena. Son datos, no
// interfaz: la UI los lee de useTourism, y luego se conectarán agencias reales (base de datos).

export type ExperienceCategory = 'islas' | 'transporte' | 'bahia' | 'atardecer' | 'romantico' | 'yates'
export type ExperienceStatus = 'available' | 'soldout' | 'soon'
export type BoatId = 'mar' | 'bahia'

export interface Experience {
  id: string
  /** Nombre del negocio u operador. */
  businessName: string
  /** Nombre de la experiencia. */
  title: string
  category: ExperienceCategory
  destination: string
  /** Duración legible: «Día completo», «2 horas»… */
  duration: string
  /** Precio desde, en COP. null = por confirmar con el operador. */
  priceFrom: number | null
  /** URL de imagen; sin imagen se muestra una ilustración por categoría. */
  image: string | null
  /** 0–5; null = aún sin calificaciones. */
  rating: number | null
  /** Personas por salida. */
  capacity: number | null
  /** Horarios de salida («8:00 a. m.», «Todos los días 5:00 p. m.»…). */
  schedules: string[]
  contact: { whatsapp?: string; bookingUrl?: string }
  status: ExperienceStatus
  /** Dato de ejemplo mientras no haya operadores reales cargados. */
  placeholder?: boolean
}

export interface BoatConfig {
  id: BoatId
  color: string
  title: string
  subtitle: string
  description: string
  /** Categorías que agrupa esta lancha, en el orden en que se muestran. */
  categories: ExperienceCategory[]
  /** Posición de la lancha en el mundo (x, z) y su giro. */
  position: [number, number]
  rotation: number
}
