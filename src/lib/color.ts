/** Utilidades de color para elegir los colores de una tienda. */

/** «#abc», «abc» o «#AABBCC» → «#aabbcc». null si no es un color válido. */
export function normalizeHex(raw: string): string | null {
  const m = raw.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(m)) return `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`
  if (/^[0-9a-f]{6}$/.test(m)) return `#${m}`
  return null
}

const rgb = (hex: string): [number, number, number] => {
  const h = normalizeHex(hex) ?? '#000000'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

const toHex = (c: [number, number, number]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`

/** Mezcla un color con blanco (amount 0–1): el tono suave que sirve de fondo. */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex)
  return toHex([r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount])
}

/** Luminosidad percibida 0–1. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Color de texto legible sobre un fondo (blanco u oscuro). */
export const readableOn = (hex: string) => (luminance(hex) > 0.5 ? '#14212b' : '#ffffff')

/** Fondo suave automático a partir del color de marca. */
export const autoAccent = (brand: string) => tint(brand, 0.88)

/** Colores de marca sugeridos: variados y que se ven bien en el mapa y en las fichas. */
export const BRAND_PALETTE: { name: string; hex: string }[] = [
  { name: 'Turquesa', hex: '#0f8f8a' },
  { name: 'Azul', hex: '#2f6fd6' },
  { name: 'Azul noche', hex: '#1f3a6e' },
  { name: 'Celeste', hex: '#3aa3d9' },
  { name: 'Verde', hex: '#2f9e6b' },
  { name: 'Oliva', hex: '#7d8461' },
  { name: 'Mostaza', hex: '#d49a2a' },
  { name: 'Naranja', hex: '#e0782f' },
  { name: 'Coral', hex: '#e0735f' },
  { name: 'Rosa', hex: '#d9668a' },
  { name: 'Rosa bebé', hex: '#f08fb0' },
  { name: 'Vino', hex: '#9c2f4f' },
  { name: 'Morado', hex: '#7a5ea8' },
  { name: 'Lila', hex: '#a98be0' },
  { name: 'Café', hex: '#8a5a3a' },
  { name: 'Grafito', hex: '#2f3a44' },
]
