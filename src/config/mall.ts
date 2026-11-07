import { COURT, SPORTS_HALF } from '../football/config'
import { ENT_CENTER, ENT_COLOR, ENT_SLOTS, ENT_SUGGESTED, ENT_TRACK, ENT_UNIT } from '../entertainment/config'
import type { FloorConfig, FloorId, MallConfig, SpaceSlot, SpaceType, SpaceTypeInfo, ZoneConfig, ZoneId } from '../domain/types'

// ── Geometría base ──────────────────────────────────────────────────────────────
// Planta en cruz: plaza central cuadrada y cuatro pasillos que salen de ella. Cada pasillo se
// describe en un marco local (eje +z = hacia afuera de la plaza) y se rota con `zone.angle`.
export const LAYOUT = {
  plazaHalf: 9.5,
  corridorHalfWidth: 4.5,
  wingHalfWidth: 9.5,
  wingEnd: 29,
  baseRadius: 44,
} as const

export const SPACE_TYPES: Record<SpaceType, SpaceTypeInfo> = {
  island: {
    type: 'island',
    name: 'Isla comercial',
    monthlyPriceCOP: 29_900,
    size: [2.6, 2.6],
    features: ['Estructura compacta en pasillo', 'Mostrador con logo', 'Pequeña vitrina', 'Hasta 6 productos destacados'],
  },
  local: {
    type: 'local',
    name: 'Local comercial',
    monthlyPriceCOP: 69_900,
    size: [6, 5],
    features: ['Fachada con letrero', 'Vitrina frontal', 'Decoración de marca', 'Catálogo completo', 'Promociones'],
  },
  premium: {
    type: 'premium',
    name: 'Local premium',
    monthlyPriceCOP: 180_000,
    size: [11, 7],
    features: ['Fachada personalizable', 'Mayor presencia visual', 'Vitrinas amplias', 'Promociones y ofertas relámpago', 'Preparado para GrowDesk (integración futura)'],
  },
  court: {
    type: 'court',
    name: 'Zona de deportes',
    monthlyPriceCOP: 450_000,
    size: [2 * SPORTS_HALF[0], 2 * SPORTS_HALF[1]],
    features: ['Una cancha de fútbol 5 y una de pádel con paredes de vidrio', 'Iluminación nocturna y bancas', 'Reservas por hora desde el mall', 'Cartel con tu marca sobre la malla', 'Precio por hora definido por ti'],
  },
  booth: {
    type: 'booth',
    name: 'Local de entretenimiento',
    monthlyPriceCOP: 49_900,
    size: ENT_UNIT,
    features: ['Local abierto con fachada y letrero', 'Vitrina y mostrador', 'En la isla de entretenimiento, junto a la pista', 'Catálogo y promociones'],
  },
  track: {
    type: 'track',
    name: 'Pista de karts',
    monthlyPriceCOP: 150_000,
    size: [2 * (ENT_TRACK.a + ENT_TRACK.r + ENT_TRACK.w / 2), 2 * (ENT_TRACK.r + ENT_TRACK.w / 2)],
    features: ['Pista de karts con luces nocturnas y karts en carrera', 'Arco de salida con tu marca', 'Reservas y boletas desde el mall', 'Eventos y torneos', 'Precio por vuelta definido por ti'],
  },
}

/** Tipos que se pueden pedir en el formulario de cualquier local (la cancha es un espacio único). */
export const SHOP_SPACE_TYPES: SpaceType[] = ['island', 'local', 'premium']

/** Plantilla de espacios por pasillo, en coordenadas locales. Igual para las cuatro zonas. */
interface SlotTemplate {
  n: number
  type: SpaceType
  /** [x, z] locales */
  at: [number, number]
  /** rotación local: la fachada mira hacia +z local tras rotar */
  facing: number
}

const WING_TEMPLATE: SlotTemplate[] = [
  { n: 1, type: 'island', at: [0, 12.5], facing: Math.PI },
  { n: 2, type: 'local', at: [-7, 16], facing: Math.PI / 2 },
  { n: 3, type: 'local', at: [7, 16], facing: -Math.PI / 2 },
  { n: 4, type: 'island', at: [0, 19.5], facing: Math.PI },
  { n: 5, type: 'premium', at: [0, 25.3], facing: Math.PI },
]

const ZONES_P1: Omit<ZoneConfig, 'focus'>[] = [
  {
    id: 'A',
    name: 'Moda',
    color: '#e0735f',
    angle: Math.PI,
    categories: [
      { id: 'moda-femenina', name: 'Ropa femenina', zoneId: 'A' },
      { id: 'moda-masculina', name: 'Ropa masculina', zoneId: 'A' },
      { id: 'moda-infantil', name: 'Ropa infantil y bebé', zoneId: 'A' },
      { id: 'accesorios', name: 'Accesorios', zoneId: 'A' },
      { id: 'calzado', name: 'Calzado', zoneId: 'A' },
    ],
  },
  {
    id: 'B',
    name: 'Tecnología',
    color: '#3b82a6',
    angle: Math.PI / 2,
    categories: [
      { id: 'accesorios-moviles', name: 'Accesorios móviles', zoneId: 'B' },
      { id: 'electronica', name: 'Electrónica', zoneId: 'B' },
      { id: 'computadores', name: 'Computadores', zoneId: 'B' },
      { id: 'gadgets', name: 'Gadgets', zoneId: 'B' },
    ],
  },
  {
    id: 'C',
    name: 'Belleza',
    color: '#c2607f',
    angle: 0,
    categories: [
      { id: 'cosmeticos', name: 'Cosméticos', zoneId: 'C' },
      { id: 'perfumeria', name: 'Perfumería', zoneId: 'C' },
      { id: 'cuidado-personal', name: 'Cuidado personal', zoneId: 'C' },
      { id: 'accesorios-belleza', name: 'Accesorios de belleza', zoneId: 'C' },
    ],
  },
  {
    id: 'D',
    name: 'Lifestyle',
    color: '#5f9a6e',
    angle: -Math.PI / 2,
    categories: [
      { id: 'regalos', name: 'Regalos', zoneId: 'D' },
      { id: 'hogar', name: 'Hogar', zoneId: 'D' },
      { id: 'artesanal', name: 'Productos artesanales', zoneId: 'D' },
      { id: 'gastronomia', name: 'Gastronomía', zoneId: 'D' },
      { id: 'deportes', name: 'Deportes', zoneId: 'D' },
    ],
  },
]

/** Rota un punto local del pasillo al marco del mundo. */
export function toWorld(local: [number, number], angle: number): [number, number] {
  const [x, z] = local
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x * c + z * s, -x * s + z * c]
}

/**
 * Puntos transitables frente a cada espacio del pasillo (coordenadas locales de la plantilla), para
 * que los visitantes se detengan a mirar una vitrina. Están en filas libres de islas, jardineras,
 * bancas y faroles; `row` es la fila por la que se llega desde el carril de caminata.
 */
export const VIEWING_SPOTS: Record<number, { spots: [number, number][]; lookAt: [number, number] }> = {
  1: { spots: [[-2.8, 10.5], [-1.4, 10.5], [0, 10.5], [1.4, 10.5], [2.8, 10.5], [-2.1, 9.7], [-0.7, 9.7], [0.7, 9.7], [2.1, 9.7], [-3.2, 9.7], [-2.8, 8.9], [-1.4, 8.9], [0, 8.9], [1.4, 8.9], [2.8, 8.9]], lookAt: [0, 12.5] },
  2: { spots: [[-3.7, 13.3], [-3.7, 14.1], [-3.7, 14.9], [-3.7, 15.7], [-3.7, 16.5], [-3.7, 17.3], [-3.7, 18.1], [-3.7, 18.9], [-2.9, 13.7], [-2.9, 14.5], [-2.9, 15.3], [-2.9, 16.1], [-2.9, 16.9], [-2.9, 17.7], [-2.9, 18.5]], lookAt: [-7, 16] },
  3: { spots: [[3.7, 13.3], [3.7, 14.1], [3.7, 14.9], [3.7, 15.7], [3.7, 16.5], [3.7, 17.3], [3.7, 18.1], [3.7, 18.9], [2.9, 13.7], [2.9, 14.5], [2.9, 15.3], [2.9, 16.1], [2.9, 16.9], [2.9, 17.7], [2.9, 18.5]], lookAt: [7, 16] },
  4: { spots: [[-0.9, 17.75], [0.9, 17.75], [0, 17.8], [-1.9, 17.6], [-2.1, 18.5], [-2.1, 19.4], [-2.1, 20.3], [-3, 18.05], [-3, 18.95], [1.9, 17.6], [2.1, 18.5], [2.1, 19.4], [2.1, 20.3], [3, 18.05], [3, 18.95]], lookAt: [0, 19.5] },
  5: { spots: [[-3.2, 21.3], [-2.4, 21.3], [-1.6, 21.3], [-0.8, 21.3], [0, 21.3], [0.8, 21.3], [1.6, 21.3], [2.4, 21.3], [3.2, 21.3], [-3.4, 20.5], [-2.6, 20.5], [-1.8, 20.5], [1.8, 20.5], [2.6, 20.5], [3.4, 20.5]], lookAt: [0, 25.3] },
}

/**
 * Lugares dentro de un local (coordenadas del local: fachada hacia +z) donde se paran los visitantes
 * que entran a comprar durante una promoción, libres de vitrinas, mostrador, mesa y estantería. Las
 * islas no tienen interior: ahí todo el grupo espera afuera.
 */
export const INTERIOR_SPOTS: Partial<Record<SpaceType, [number, number][]>> = {
  local: [[-1.2, 0.7], [-1.1, -0.9], [0.15, -1.15], [0.2, 0.5]],
  premium: [[1.4, 1.3], [2.6, 0.3], [1.2, -1.1], [2.3, -1.9]],
}

/** Carriles por los que caminan los visitantes de cada pasillo (x local) y fila libre para cruzar. */
export const WALK_LANES = { x: 2.4, crossZ: 10, z0: 8, z1: 21.3 }
/** Desvíos laterales de los carriles (cada visitante camina un poco a un lado: no van en fila india). */
export const LANE_SPREAD = [-0.45, -0.15, 0.15, 0.45]

// ── Piso 2: terraza gastronómica ──────────────────────────────────────────────
// Plataforma elevada en el cuadrante del fondo de la fortaleza (detrás de la plaza, entre
// Lifestyle y Moda). Coordenadas del piso: centro de la losa = origen del piso.
export const FOOD_LAYOUT = {
  half: 14,
  /** Terraza con pérgola en la esquina del fondo. */
  terrace: { x0: -14, x1: -7.4, z0: -14, z1: -7.4 },
  /** Donde llegan las escaleras: la esquina del frente de la terraza (hacia la plaza). */
  arrival: { x: 11.2, z: 11.2 },
  /** Esa esquina va recortada en diagonal (chaflán): la escalera llega derecho a un borde recto. */
  arrivalCut: 4,
} as const

/**
 * El piso 2 va sobre la esquina del fondo de la fortaleza, entre los pasillos de Moda y Lifestyle
 * sin taparlos: su losa empieza justo donde terminan esos locales (|x|, |z| > 9.5) y se apoya,
 * hacia afuera, en un torreón que agranda el castillo sobre el baluarte del fondo.
 */
const P2_OFFSET: [number, number] = [-23.75, -23.75]
const P2_ELEVATION = 7.2

/**
 * Escaleras eléctricas, en su propio marco: dos carriles a lo largo de z local que suben hacia −z
 * (del pie, en la plaza, a la esquina de la terraza). El marco gira 45°: suben en diagonal entre
 * Moda y Lifestyle, sin pasar sobre ningún local.
 */
export const ESCALATOR = { lanesX: [-0.75, 0.75], bottomZ: 9.8, topZ: 0, width: 1.5 } as const
/** Marco de las escaleras: arriba (z local 0) en (x, z) del piso 1, girado `angle` en y. */
export const ESCALATOR_FRAME = { x: -11.75, z: -11.75, angle: Math.PI / 4 } as const
/** De coordenadas de las escaleras a coordenadas del piso 1. */
export function escToWorld(lx: number, lz: number): [number, number] {
  const c = Math.cos(ESCALATOR_FRAME.angle)
  const s = Math.sin(ESCALATOR_FRAME.angle)
  return [ESCALATOR_FRAME.x + lx * c + lz * s, ESCALATOR_FRAME.z - lx * s + lz * c]
}
/** De coordenadas del piso 1 a coordenadas de las escaleras. */
export function worldToEsc(x: number, z: number): [number, number] {
  const c = Math.cos(ESCALATOR_FRAME.angle)
  const s = Math.sin(ESCALATOR_FRAME.angle)
  const dx = x - ESCALATOR_FRAME.x
  const dz = z - ESCALATOR_FRAME.z
  return [dx * c - dz * s, dx * s + dz * c]
}
/** Marcha de las escaleras: escalones por segundo y cantidad de escalones por carril (carril 0 sube). */
export const ESCALATOR_STEP_RATE = 0.9
export const ESCALATOR_STEPS = 16

const FOOD_ZONE: ZoneConfig = {
  id: 'E',
  name: 'Gastronomía',
  color: '#d4842e',
  angle: 0,
  focus: [2, 2],
  categories: [
    { id: 'comida-local', name: 'Comida local', zoneId: 'E' },
    { id: 'mariscos', name: 'Mariscos', zoneId: 'E' },
    { id: 'asados', name: 'Asados', zoneId: 'E' },
    { id: 'internacional', name: 'Internacional', zoneId: 'E' },
    { id: 'cafe', name: 'Café', zoneId: 'E' },
    { id: 'postres', name: 'Postres', zoneId: 'E' },
  ],
}

interface SlotDef {
  n: number
  type: SpaceType
  at: [number, number]
  facing: number
}

/**
 * Espacios de la terraza: locales en los dos bordes del fondo (mirando hacia la plaza) e islas
 * en el patio. Se conservan los IDs E1–E10: las asignaciones guardadas siguen valiendo.
 */
const FOOD_SLOTS: SlotDef[] = [
  { n: 1, type: 'local', at: [-4, -11.3], facing: 0 },
  { n: 2, type: 'local', at: [3, -11.3], facing: 0 },
  { n: 3, type: 'local', at: [10, -11.3], facing: 0 },
  { n: 4, type: 'local', at: [-11.3, -4], facing: Math.PI / 2 },
  { n: 5, type: 'local', at: [-11.3, 3], facing: Math.PI / 2 },
  { n: 6, type: 'local', at: [-11.3, 10], facing: Math.PI / 2 },
  { n: 7, type: 'island', at: [-3, 10], facing: Math.PI / 4 },
  { n: 8, type: 'island', at: [10, -3], facing: Math.PI / 4 },
  { n: 9, type: 'island', at: [-2, 2], facing: Math.PI / 4 },
  { n: 10, type: 'island', at: [5.5, 5.5], facing: Math.PI / 4 },
]

export const MALL: MallConfig = {
  id: 'cartagena-mall',
  name: 'MallPlay',
  tagline: 'Cartagena · Tu mall, tu mundo',
  floors: [
    {
      id: 'P1',
      name: 'Piso 1',
      title: 'PISO 1',
      subtitle: 'Plaza central',
      level: 1,
      elevation: 0,
      offset: [0, 0],
      layout: 'cross',
      homeZoom: 1,
      bounds: 27,
      zones: ZONES_P1.map((z) => ({ ...z, focus: toWorld([0, 18], z.angle) })),
    },
    {
      id: 'P2',
      name: 'Piso 2',
      title: 'PISO 2',
      subtitle: 'Zona de comida',
      level: 2,
      elevation: P2_ELEVATION,
      offset: P2_OFFSET,
      layout: 'foodcourt',
      homeZoom: 1.7,
      bounds: 14,
      zones: [FOOD_ZONE],
    },
  ],
}

function spaceFrom(floor: FloorConfig, zoneId: ZoneId, t: SlotDef, at: [number, number], rotation: number): SpaceSlot {
  return {
    id: `${floor.id}-${zoneId}${t.n}`,
    floorId: floor.id,
    zoneId,
    type: t.type,
    label: `${zoneId}-${String(t.n).padStart(2, '0')}`,
    position: at,
    rotation,
    size: SPACE_TYPES[t.type].size,
  }
}

/** Genera los espacios de un piso a partir de su distribución. Las posiciones son del piso (sin elevación). */
export function generateSpaces(floor: FloorConfig): SpaceSlot[] {
  if (floor.layout === 'cross')
    return floor.zones.flatMap((zone) => WING_TEMPLATE.map((t) => spaceFrom(floor, zone.id, t, toWorld(t.at, zone.angle), zone.angle + t.facing)))
  const zone = floor.zones[0]
  return FOOD_SLOTS.map((t) => spaceFrom(floor, zone.id, t, t.at, t.facing))
}

/**
 * Zona de negocios y servicios (piso 1): la esquina entre Lifestyle y Belleza, junto al baluarte.
 * No es un pasillo: tiene su propia plaza, dos vitrinas grandes de marcas aliadas (Planly y
 * GrowDesk, ver district/showrooms.ts) y espacios para barberías y servicios.
 */
export const DISTRICT_ZONE: ZoneConfig = {
  id: 'F',
  name: 'Soporte',
  color: '#7a6ff0',
  angle: -Math.PI / 4,
  focus: [-19.5, 18.5],
  categories: [
    { id: 'barberias', name: 'Barberías', zoneId: 'F' },
    { id: 'servicios', name: 'Servicios profesionales', zoneId: 'F' },
  ],
}

/** Plaza central de la zona de servicios (x, z) y su radio. */
export const DISTRICT_PLAZA = { x: -19.8, z: 22.6, r: 3 }

/** Espacios para barberías y servicios (se reclaman como cualquier local). */
const DISTRICT_SPACES: SpaceSlot[] = (
  [
    { n: 1, type: 'local', at: [-27, 22.8], rotation: Math.PI / 2 },
    { n: 2, type: 'island', at: [-24.8, 27.6], rotation: 0 },
    { n: 3, type: 'island', at: [-12.2, 21.8], rotation: 0 },
    { n: 4, type: 'island', at: [-11.9, 27.3], rotation: 0 },
  ] as { n: number; type: SpaceType; at: [number, number]; rotation: number }[]
).map((t) => ({
  id: `P1-F${t.n}`,
  floorId: 'P1',
  zoneId: 'F',
  type: t.type,
  label: `F-${String(t.n).padStart(2, '0')}`,
  position: t.at,
  rotation: t.rotation,
  size: SPACE_TYPES[t.type].size,
}))

/**
 * Zona de entretenimiento: isla-castillo al oeste de la fortaleza (se cruza por un puente frente a
 * Planly). 11 locales abiertos y una pista de karts, todos reclamables.
 */
export const ENTERTAINMENT_ZONE: ZoneConfig = {
  id: 'G',
  name: 'Entretenimiento',
  color: ENT_COLOR,
  angle: 0,
  focus: [ENT_CENTER[0] + 2, ENT_CENTER[1]],
  categories: [
    { id: 'videojuegos', name: 'Videojuegos y arcade', zoneId: 'G' },
    { id: 'realidad-virtual', name: 'Realidad virtual y simuladores', zoneId: 'G' },
    { id: 'esports', name: 'Esports y gaming', zoneId: 'G' },
    { id: 'karts', name: 'Karts y pista', zoneId: 'G' },
    { id: 'comida-diversion', name: 'Comida y helados', zoneId: 'G' },
    { id: 'juegos-mesa', name: 'Juegos de mesa y tienda gamer', zoneId: 'G' },
  ],
}

/** Los 11 locales de la isla de entretenimiento (se reclaman como cualquier local). */
const ENTERTAINMENT_SPACES: SpaceSlot[] = ENT_SLOTS.map((t, k) => ({
  id: `P1-G${k + 1}`,
  floorId: 'P1',
  zoneId: 'G' as ZoneId,
  type: 'booth' as SpaceType,
  label: `EN-${String(k + 1).padStart(2, '0')}`,
  position: t.at,
  rotation: t.rot,
  size: ENT_UNIT,
}))
/** Rubro sugerido por local (solo orienta; cada negocio elige el suyo). */
export const ENTERTAINMENT_SUGGESTED: Record<string, string> = Object.fromEntries(ENT_SLOTS.map((_, k) => [`P1-G${k + 1}`, ENT_SUGGESTED[k]]))

/**
 * Isla Tecnología: un castillo-isla de una sola planta, lejos en el mar (se llega en avión
 * desde el aeropuerto). Murallas con torres, puerta hacia la pista, plaza con fuente y locales
 * outlet repartidos alrededor. Usa las coordenadas del piso 1 (al nivel del mar).
 */
export const ISLAND = { x: 160, z: -160, r: 26, half: 21 } as const
/**
 * Locales de Isla Tecnología: una isla de una sola categoría (tecnología, como el pasillo B), que
 * usa toda la isla. Planta baja: un anillo interior alrededor de la plaza holográfica y otro junto a
 * las murallas, con un paseo entre los dos; todos miran al centro. Segundo piso: una terraza en la
 * esquina del fondo (sin tapar locales), con escaleras eléctricas desde la plaza. Cada local sugiere
 * un rubro, pero se rentan como cualquier local del mall. (Posiciones calculadas para no chocar
 * entre sí, con la terraza ni con las murallas.)
 */
export const ISLAND_SECTORS = ['Celulares', 'Gaming', 'Smart Home', 'Servicio técnico', 'Audio', 'Realidad virtual', 'Drones y cámaras', 'Computación', 'Accesorios', 'Wearables'] as const
/** Radios de los dos anillos de la planta baja y del paseo entre ellos. */
export const ISLAND_RING = 11.5
export const ISLAND_OUTER = 19.5
export const ISLAND_WALK = 15.5
/** Segundo piso: terraza cuadrada (centro, medio lado, altura). */
export const ISLAND_DECK = { x: -13.8, z: -13.8, half: 5.8, elevation: 5 } as const
const ISLAND_GROUND: [number, number, number][] = [
  [0.92, 11.46, 3.2216], [11.45, 1.09, 4.6179], [9.47, -6.53, 5.316], [3.06, -11.09, 6.0141], [-11.13, 2.9, 8.1085], [-6.66, 9.37, 8.8066],
  [6.69, 18.32, 3.4916], [18.09, 7.29, 4.3294], [19.49, -0.7, 4.7482], [17.52, -8.56, 5.1671], [12.52, -14.95, 5.586], [5.36, -18.75, 6.0049],
  [-18.92, 4.74, 8.0993], [-15.35, 12.02, 8.5181], [-9.14, 17.23, 8.937], [-1.34, 19.45, 9.3559],
]
const D = ISLAND_DECK
const ISLAND_UPPER: { type: SpaceType; at: [number, number]; rot: number }[] = [
  { type: 'local', at: [D.x + 2.8, D.z - D.half + 2.8], rot: 0 },
  { type: 'local', at: [D.x - D.half + 2.8, D.z + 2.8], rot: Math.PI / 2 },
  { type: 'island', at: [D.x - D.half + 2.3, D.z - D.half + 2.3], rot: Math.PI / 4 },
  { type: 'island', at: [D.x + 1.3, D.z + 1.3], rot: Math.PI / 4 },
]
const ISLAND_SPACES: SpaceSlot[] = [
  ...ISLAND_GROUND.map(([dx, dz, rot]) => ({ type: 'local' as SpaceType, at: [dx, dz] as [number, number], rot, elevation: 0 })),
  ...ISLAND_UPPER.map((u) => ({ ...u, elevation: D.elevation })),
].map((t, k) => ({
  id: `P1-I${k + 1}`,
  floorId: 'P1',
  zoneId: 'B' as ZoneId,
  type: t.type,
  label: `IT-${String(k + 1).padStart(2, '0')}`,
  position: [ISLAND.x + t.at[0], ISLAND.z + t.at[1]] as [number, number],
  rotation: t.rot,
  size: SPACE_TYPES[t.type].size,
  ...(t.elevation ? { elevation: t.elevation } : {}),
}))

/** Pista de la isla: centro (x, z), giro del marco (z local = a lo largo de la pista) y medidas. */
export const ISLAND_RUNWAY = (() => {
  const [dx, dz] = toWorld([0, 40], Math.PI / 4)
  return { x: ISLAND.x + dx, z: ISLAND.z + dz, rot: Math.PI / 4 + Math.PI / 2, len: 30, w: 4 }
})()

/** ¿Es un local de Isla Tecnología? */
export const isIslandSpace = (sp: Pick<SpaceSlot, 'id'>) => sp.id.startsWith('P1-I')

export const FLOORS = MALL.floors
export const FLOOR_BY_ID: Record<FloorId, FloorConfig> = Object.fromEntries(FLOORS.map((f) => [f.id, f]))
/** Piso 1 (en cruz): lo usan la estructura, decoración y ambiente específicos de esa planta. */
export const P1 = FLOORS[0]
export const SPACES: SpaceSlot[] = [...FLOORS.flatMap(generateSpaces), ...DISTRICT_SPACES, ...ISLAND_SPACES, ...ENTERTAINMENT_SPACES]

/**
 * ¿El punto (x, z) cae dentro de un local o isla (más `margin` alrededor)? Las zonas de locales
 * se dejan limpias: ni palmeras, ni matas, ni bancas dentro; la decoración va en los recorridos.
 */
export function insideSpace(x: number, z: number, margin = 0, floorId: FloorId = 'P1'): boolean {
  for (const sp of SPACES) {
    if (sp.floorId !== floorId) continue
    const c = Math.cos(sp.rotation)
    const s = Math.sin(sp.rotation)
    const dx = x - sp.position[0]
    const dz = z - sp.position[1]
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    if (Math.abs(lx) < sp.size[0] / 2 + margin && Math.abs(lz) < sp.size[1] / 2 + margin) return true
  }
  return false
}
/**
 * La cancha sintética es un espacio más (se reclama y el administrador le asigna el negocio que la
 * opera), pero no está en SPACES: tiene su propio mundo 3D y no entra en pasillos ni recorridos.
 */
export const COURT_SPACE: SpaceSlot = {
  id: 'CANCHA',
  floorId: 'P1',
  zoneId: 'B',
  type: 'court',
  label: 'Deportes',
  position: COURT.center,
  rotation: 0,
  size: SPACE_TYPES.court.size,
}
/** La pista de karts: como la cancha, un espacio único con su propio dibujo (no está en SPACES). */
export const TRACK_SPACE: SpaceSlot = {
  id: 'PISTA',
  floorId: 'P1',
  zoneId: 'G',
  type: 'track',
  label: 'Pista de karts',
  position: ENT_CENTER,
  rotation: 0,
  size: SPACE_TYPES.track.size,
}
export const SPACE_BY_ID: Record<string, SpaceSlot> = Object.fromEntries([...SPACES, COURT_SPACE, TRACK_SPACE].map((s) => [s.id, s]))
export const ZONES: ZoneConfig[] = [...FLOORS.flatMap((f) => f.zones), DISTRICT_ZONE, ENTERTAINMENT_ZONE]
export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z])) as Record<ZoneId, ZoneConfig>
export const FLOOR_OF_ZONE = Object.fromEntries([...FLOORS.flatMap((f) => f.zones.map((z) => [z.id, f.id])), [DISTRICT_ZONE.id, 'P1'], [ENTERTAINMENT_ZONE.id, 'P1']]) as Record<ZoneId, FloorId>
export const CATEGORIES = ZONES.flatMap((z) => z.categories)
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

/** Punto frente a la fachada de un espacio (donde aparecen señales y ofertas). */
export function spaceFrontPoint(space: SpaceSlot, distance: number): [number, number] {
  const depth = space.size[1] / 2 + distance
  return [space.position[0] + Math.sin(space.rotation) * depth, space.position[1] + Math.cos(space.rotation) * depth]
}

// ── Fortaleza ──────────────────────────────────────────────────────────────────
// Planta cuadrada alineada con los ejes (en isométrico se ve como rombo). La esquina del frente
// (+x, +z) es la entrada monumental; las otras tres esquinas son baluartes.
export const FORTRESS = {
  /** Mitad del lado (eje de la muralla). */
  half: 31,
  wallThickness: 2.2,
  wallHeight: 5,
  /** La esquina del frente se recorta en diagonal para la puerta. */
  gateCut: 8,
  /** Baluartes: esquina (signo x, signo z) y cuánto sobresalen. */
  bastions: [
    { corner: [-1, 1], reach: 6 },
    { corner: [1, -1], reach: 6 },
    { corner: [-1, -1], reach: 6 },
  ] as { corner: [number, number]; reach: number }[],
  /** Garitas (x, z) y cañones (x, z, giro: el cañón apunta a su +z local, hacia afuera). */
  garitas: [
    [-34.6, 34.6],
    [34.6, -34.6],
    [-31, 6],
  ] as [number, number][],
  cannons: [
    [-31.6, 31.6, -Math.PI / 4],
    [31.6, -31.6, (3 * Math.PI) / 4],
    [-31, -12, -Math.PI / 2],
    [14, 31, 0],
    [31, 14, Math.PI / 2],
  ] as [number, number, number][],
} as const

/** Centro de la puerta (en el recorte diagonal de la esquina del frente). */
export const GATE = (() => {
  const c = FORTRESS.half - FORTRESS.gateCut / 2
  return { x: c, z: c, width: FORTRESS.gateCut * Math.SQRT2, facing: Math.PI / 4 }
})()

/** ¿El punto (coordenadas del piso 1) está sobre la plaza o un pasillo, donde camina la gente? */
export function onP1Walkway(x: number, z: number, margin = 0): boolean {
  const P = LAYOUT.plazaHalf + margin
  if (Math.abs(x) <= P && Math.abs(z) <= P) return true
  for (const zone of FLOORS[0].zones) {
    const c = Math.cos(zone.angle)
    const s = Math.sin(zone.angle)
    const lx = x * c - z * s
    const lz = x * s + z * c
    if (Math.abs(lx) <= LAYOUT.corridorHalfWidth + margin && lz >= LAYOUT.plazaHalf - 0.5 && lz <= 22 + margin) return true
  }
  return false
}
