// Lectura de menús con IA (función «leer-menu»): el prompt, el esquema de la respuesta y la limpieza de lo que vuelve del modelo.
// Es lógica pura (sin Deno ni red) para poder probarla con vitest.

export const MAX_IMAGES = 6
/** Tamaño máximo de cada imagen ya en base64 (el navegador las reduce antes de enviarlas, así que esto es solo un tope). */
export const MAX_IMAGE_B64 = 5_500_000
export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

export interface AiImage {
  media_type: MediaType
  data: string
}

export interface AiItem {
  name: string
  /** Pesos colombianos enteros; null si no se pudo leer. */
  price: number | null
  description: string
  /** El precio venía en miles abreviados («20») y se multiplicó: conviene revisarlo. */
  dubious?: boolean
}
export interface AiSection {
  name: string
  items: AiItem[]
}
export interface AiMenu {
  sections: AiSection[]
}

export const MENU_SYSTEM = `Eres un asistente que digitaliza menús de restaurantes de Colombia. Recibes una o varias imágenes del mismo menú (fotos, capturas o páginas de un PDF) y devuelves TODOS los platos y bebidas que se ven, ordenados por las secciones que trae el menú.

Reglas:
- Sección: usa los títulos tal como aparecen en el menú (Entradas, Mariscos, Cocteles, Sancochos…). Escríbelos en minúsculas con la primera letra en mayúscula, sin adornos.
- Plato: el nombre tal como se lee (con la primera letra en mayúscula, no todo en mayúsculas). Si varias líneas comparten un título y un precio (por ejemplo «Tacos de Pollo / Cerdo / Res $25.000»), crea un plato por cada línea con ese precio.
- Descripción: lo que el menú diga en letra pequeña debajo o al lado del plato (ingredientes, acompañantes). Vacía si no hay nada.
- Precio: pesos colombianos como número entero, sin signo ni puntos: «$ 28.000» → 28000, «$12.5» no existe en este país. Si un plato tiene varios precios (tamaños), usa el primero y deja los demás dentro de la descripción («Pequeña 18.000 · Grande 36.000»). Si el precio no se alcanza a leer, usa null: nunca inventes ni adivines un precio.
- Si una sección entera tiene un solo precio (por ejemplo «Almuerzos ejecutivos $20.000 · pregunta por el menú del día»), crea un plato con ese nombre y ese precio y pon la nota en la descripción.
- Ignora logotipos, direcciones, teléfonos, redes sociales, horarios, textos de publicidad y dibujos.
- Si hay varias imágenes, son partes del mismo menú: no repitas platos.
- No traduzcas ni corrijas la ortografía de los nombres propios (Margarita Frozen Blue, Buchanan's Master…).
- Si la imagen no es un menú, devuelve una lista de secciones vacía.`

export const MENU_USER = 'Extrae todos los platos y bebidas de este menú con su precio.'

/** Esquema de la respuesta estructurada (output_config.format). */
export const MENU_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                price: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
                description: { type: 'string' },
              },
              required: ['name', 'price', 'description'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'items'],
        additionalProperties: false,
      },
    },
  },
  required: ['sections'],
  additionalProperties: false,
} as const

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Valida las imágenes que manda el navegador. null si algo no cuadra. */
export function cleanImages(raw: unknown): AiImage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IMAGES) return null
  const out: AiImage[] = []
  for (const r of raw) {
    const o = r as Record<string, unknown> | null
    if (!o || typeof o.data !== 'string' || !(MEDIA_TYPES as readonly string[]).includes(String(o.media_type))) return null
    if (o.data.length < 100 || o.data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(o.data)) return null
    out.push({ media_type: o.media_type as MediaType, data: o.data })
  }
  return out
}

/** Limpia la respuesta del modelo: nombres cortos, precios enteros razonables, sin secciones ni platos vacíos ni repetidos. */
export function cleanAiMenu(raw: unknown): AiMenu {
  const sections: AiSection[] = []
  const list = (raw as { sections?: unknown } | null)?.sections
  if (!Array.isArray(list)) return { sections }
  const seen = new Set<string>()
  for (const s of list.slice(0, 40)) {
    const so = s as { name?: unknown; items?: unknown } | null
    const items: AiItem[] = []
    for (const it of (Array.isArray(so?.items) ? so.items : []).slice(0, 200)) {
      const io = it as { name?: unknown; price?: unknown; description?: unknown } | null
      const name = str(io?.name, 80)
      if (!name) continue
      const key = `${str(so?.name, 60).toLowerCase()}|${name.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      let price: number | null = typeof io?.price === 'number' && Number.isFinite(io.price) ? Math.round(io.price) : null
      let dubious = false
      if (price !== null && price <= 0) price = null
      // «20» en un menú casi siempre son 20 mil: se corrige y se marca para revisar
      if (price !== null && price < 500) {
        price = price * 1000
        dubious = true
      }
      if (price !== null && price > 2_000_000) price = null
      items.push({ name, price, description: str(io?.description, 240), ...(dubious ? { dubious } : {}) })
    }
    if (items.length) sections.push({ name: str(so?.name, 60) || 'Menú', items })
  }
  return { sections }
}
