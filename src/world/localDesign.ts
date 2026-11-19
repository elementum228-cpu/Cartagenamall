import type { AwningKind, LocalDesign, LogoSide, RoofKind, SideKind, SignKind, TopperKind, WindowKind } from '../domain/types'

// «Arma tu local»: diez modelos de partida y las opciones que la administración puede variar. Todo es dato (va dentro de la tienda),
// y se dibuja en world/CustomStore.tsx. Aquí solo hay lógica pura: modelos, listas de opciones y limpieza de lo que llega guardado.

export interface LocalModel {
  id: string
  name: string
  blurb: string
  design: Omit<LocalDesign, 'v' | 'model'>
}


export const LOCAL_MODELS: LocalModel[] = [
  { id: 'cafe', name: 'Cafetería', blurb: 'Panel calado, letrero y el logo en el pilar', design: { wall: '#f4b820', trim: '#2b1a10', roofColor: '#8a5a12', awningColor: '#ffd34f', roof: 'flat', windows: 'wide', awning: 'flat', side: 'lattice', sign: 'band', logoSide: 'left', topper: 'logo', tables: 2, planters: true, lights: true } },
  { id: 'burger', name: 'Hamburguesería', blurb: 'Ladrillo, toldo rayado y hamburguesa en el techo', design: { wall: '#c9553a', trim: '#2a1a14', roofColor: '#5b2a20', awningColor: '#ffd23f', roof: 'flat', windows: 'panes', awning: 'striped', side: 'brick', sign: 'band', logoSide: 'none', topper: 'burger', tables: 2, planters: false, lights: true } },
  { id: 'pizza', name: 'Pizzería', blurb: 'Techo a dos aguas, arcos y toldo verde', design: { wall: '#f1e3c8', trim: '#8b2f23', roofColor: '#b5472f', awningColor: '#3f8f55', roof: 'gable', windows: 'arched', awning: 'scalloped', side: 'brick', sign: 'band', logoSide: 'none', topper: 'pizza', tables: 3, planters: true, lights: true } },
  { id: 'helados', name: 'Heladería', blurb: 'Colores pastel, toldo con volados y un helado', design: { wall: '#ffd9e6', trim: '#6b3a55', roofColor: '#f08fb3', awningColor: '#7fd6d0', roof: 'flat', windows: 'wide', awning: 'scalloped', side: 'plain', sign: 'board', logoSide: 'none', topper: 'icecream', tables: 1, planters: true, lights: false } },
  { id: 'panaderia', name: 'Panadería', blurb: 'Cálida y de barrio, con una dona gigante', design: { wall: '#f6e7c8', trim: '#6a4326', roofColor: '#c98b4a', awningColor: '#e8651f', roof: 'gable', windows: 'arched', awning: 'striped', side: 'plain', sign: 'band', logoSide: 'right', topper: 'donut', tables: 1, planters: true, lights: true } },
  { id: 'boutique', name: 'Boutique', blurb: 'Elegante: cornisa, vitrinas amplias y una bolsa', design: { wall: '#ece6f5', trim: '#2c2540', roofColor: '#6a5a8a', awningColor: '#ffb3cb', roof: 'cornice', windows: 'wide', awning: 'none', side: 'plain', sign: 'board', logoSide: 'none', topper: 'bag', tables: 0, planters: true, lights: true } },
  { id: 'urbana', name: 'Tienda urbana', blurb: 'Techo inclinado y una gorra gigante', design: { wall: '#2f3a4a', trim: '#101820', roofColor: '#1c242f', awningColor: '#ff5a5f', roof: 'shed', windows: 'panes', awning: 'flat', side: 'brick', sign: 'band', logoSide: 'right', topper: 'cap', tables: 0, planters: false, lights: true } },
  { id: 'cafemoderna', name: 'Café moderno', blurb: 'Líneas limpias, panel calado y una taza', design: { wall: '#3f6b5a', trim: '#16251f', roofColor: '#26443a', awningColor: '#f2e6cd', roof: 'shed', windows: 'wide', awning: 'flat', side: 'lattice', sign: 'band', logoSide: 'left', topper: 'coffee', tables: 3, planters: true, lights: true } },
  { id: 'floreria', name: 'Floristería', blurb: 'Fresca, con volados y una flor en el techo', design: { wall: '#fbe3dc', trim: '#4b6b3a', roofColor: '#7fa86a', awningColor: '#f6a5b8', roof: 'gable', windows: 'arched', awning: 'scalloped', side: 'plain', sign: 'board', logoSide: 'none', topper: 'flower', tables: 0, planters: true, lights: false } },
  { id: 'letrero', name: 'Tienda clásica', blurb: 'Cornisa, vitrinas y el logo grande arriba', design: { wall: '#e9dfcd', trim: '#1f3a52', roofColor: '#4a5f74', awningColor: '#1f6fb5', roof: 'cornice', windows: 'panes', awning: 'none', side: 'brick', sign: 'band', logoSide: 'none', topper: 'logo', tables: 0, planters: false, lights: true } },
]

export const MODEL_BY_ID: Record<string, LocalModel> = Object.fromEntries(LOCAL_MODELS.map((m) => [m.id, m]))

export function designFromModel(id: string): LocalDesign {
  const m = MODEL_BY_ID[id] ?? LOCAL_MODELS[0]
  return { v: 1 as const, model: m.id, ...m.design }
}

/** Primer diseño de una tienda: el modelo base con los colores de su marca. */
export function designForBrand(modelId: string, brand: string): LocalDesign {
  const d = designFromModel(modelId)
  return { ...d, wall: brand || d.wall }
}

export interface Option<T extends string | number> {
  id: T
  label: string
}
export const ROOFS: Option<RoofKind>[] = [
  { id: 'flat', label: 'Plano' },
  { id: 'gable', label: 'Dos aguas' },
  { id: 'shed', label: 'Inclinado' },
  { id: 'cornice', label: 'Con cornisa' },
]
export const WINDOWS: Option<WindowKind>[] = [
  { id: 'wide', label: 'Vitrina amplia' },
  { id: 'panes', label: 'Tres ventanas' },
  { id: 'arched', label: 'Arcos' },
]
export const AWNINGS: Option<AwningKind>[] = [
  { id: 'none', label: 'Sin toldo' },
  { id: 'striped', label: 'Rayas' },
  { id: 'scalloped', label: 'Volados' },
  { id: 'flat', label: 'Marquesina' },
]
export const SIDES: Option<SideKind>[] = [
  { id: 'plain', label: 'Liso' },
  { id: 'lattice', label: 'Calado' },
  { id: 'brick', label: 'Ladrillo' },
]
export const SIGNS: Option<SignKind>[] = [
  { id: 'band', label: 'Franja con nombre' },
  { id: 'board', label: 'Letrero sobre el techo' },
  { id: 'none', label: 'Sin letrero' },
]
export const LOGO_SIDES: Option<LogoSide>[] = [
  { id: 'none', label: 'Sin pilar' },
  { id: 'left', label: 'Pilar izquierdo' },
  { id: 'right', label: 'Pilar derecho' },
]
export const TOPPERS: Option<TopperKind>[] = [
  { id: 'none', label: 'Nada' },
  { id: 'logo', label: 'Logo' },
  { id: 'cap', label: 'Gorra' },
  { id: 'burger', label: 'Hamburguesa' },
  { id: 'pizza', label: 'Pizza' },
  { id: 'coffee', label: 'Taza de café' },
  { id: 'icecream', label: 'Helado' },
  { id: 'donut', label: 'Dona' },
  { id: 'bag', label: 'Bolsa' },
  { id: 'flower', label: 'Flor' },
]

const HEX = /^#[0-9a-f]{6}$/i
const pick = <T extends string>(v: unknown, list: Option<T>[], fallback: T): T => (list.some((o) => o.id === v) ? (v as T) : fallback)
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v : fallback)

/** Limpia un diseño que viene de la base de datos: lo desconocido vuelve al valor del modelo base. */
export function cleanDesign(raw: unknown): LocalDesign | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const d = designFromModel(typeof r.model === 'string' ? r.model : 'cafe')
  const tables = Number(r.tables)
  return {
    v: 1,
    model: d.model,
    wall: color(r.wall, d.wall),
    trim: color(r.trim, d.trim),
    roofColor: color(r.roofColor, d.roofColor),
    awningColor: color(r.awningColor, d.awningColor),
    roof: pick(r.roof, ROOFS, d.roof),
    windows: pick(r.windows, WINDOWS, d.windows),
    awning: pick(r.awning, AWNINGS, d.awning),
    side: pick(r.side, SIDES, d.side),
    sign: pick(r.sign, SIGNS, d.sign),
    logoSide: pick(r.logoSide, LOGO_SIDES, d.logoSide),
    topper: pick(r.topper, TOPPERS, d.topper),
    tables: (Number.isInteger(tables) && tables >= 0 && tables <= 3 ? tables : d.tables) as 0 | 1 | 2 | 3,
    planters: typeof r.planters === 'boolean' ? r.planters : d.planters,
    lights: typeof r.lights === 'boolean' ? r.lights : d.lights,
  }
}

/** Texto casi blanco o casi negro según el fondo, para que el nombre siempre se lea. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#1b1410' : '#fffaf0'
}
