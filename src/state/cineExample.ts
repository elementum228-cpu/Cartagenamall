import { CHAINS, DAYS_AHEAD, nextDays, withShows, type CineMovie, type CinePoster, type CineShow } from './cine'

// Datos de ejemplo para probar el cine: películas inventadas con carteles generados (sin imágenes ni marcas de terceros) y funciones de toda la
// semana en las tres cadenas. Lo carga el administrador con «Cargar ejemplo».

interface Seed {
  id: string
  title: string
  genre: string
  minutes: number
  rating: string
  synopsis: string
  isNew: boolean
  colors: [string, string, string]
  motif: 'sun' | 'lighthouse' | 'compass' | 'wall' | 'planet' | 'moon'
}

const MOVIES: Seed[] = [
  { id: 'ej-marea', title: 'Marea Roja', genre: 'Acción', minutes: 128, rating: '12+', isNew: true, colors: ['#7f1d1d', '#0b0b14', '#ff6a3d'], motif: 'sun', synopsis: 'Una patrulla costera descubre que la marea esconde algo más que contrabando. Persecuciones, traiciones y una carrera contra el amanecer.' },
  { id: 'ej-faro', title: 'El Faro de Bocagrande', genre: 'Drama', minutes: 112, rating: '15+', isNew: true, colors: ['#0f3d5e', '#0a0f1f', '#ffd27a'], motif: 'lighthouse', synopsis: 'Tres generaciones de una familia de farero se reúnen una noche de tormenta y los secretos salen a la luz.' },
  { id: 'ej-tesoros', title: 'Tesoros del Caribe', genre: 'Aventura', minutes: 96, rating: '7+', isNew: false, colors: ['#0d5c63', '#0a1a2a', '#f4c95d'], motif: 'compass', synopsis: 'Dos hermanos siguen un mapa viejo por las islas y descubren que el verdadero tesoro es volver juntos a casa.' },
  { id: 'ej-muralla', title: 'Noche en la Muralla', genre: 'Terror', minutes: 101, rating: '15+', isNew: false, colors: ['#2b1b4a', '#07070d', '#b79cff'], motif: 'wall', synopsis: 'Un grupo de guías se queda encerrado después del cierre en la fortaleza. Las leyendas de la ciudad no son solo leyendas.' },
  { id: 'ej-isla', title: 'Isla Tecnología', genre: 'Ciencia ficción', minutes: 134, rating: '12+', isNew: true, colors: ['#14385e', '#05060d', '#5fe0ff'], motif: 'planet', synopsis: 'Una ingeniera llega a una isla donde las máquinas aprenden más rápido de lo previsto. Le quedan 24 horas para decidir.' },
  { id: 'ej-cumbia', title: 'Cumbia en la Luna', genre: 'Animación', minutes: 92, rating: '7+', isNew: false, colors: ['#5b2a86', '#0e0a24', '#ffb4e6'], motif: 'moon', synopsis: 'Una niña y su abuelo viajan a la luna para recuperar el ritmo que se llevó el viento. Música, color y mucho corazón.' },
]

/** Muralla almenada que cruza todo el cartel. */
const WALL = (() => {
  let d = 'M-300 700 V400'
  for (let x = -300; x < 900; x += 120) d += ` H${x + 60} V450 H${x + 120} V400`
  return `${d} V700Z`
})()

/** Cartel de ejemplo (SVG 2:3): degradado y un motivo propio de la película, sin texto (el título lo pone la interfaz). Sin imágenes de terceros. */
function poster(m: Seed): string {
  const [c1, c2, accent] = m.colors
  const motif = {
    sun: `<circle cx="300" cy="330" r="150" fill="${accent}" opacity=".95"/><path d="M-300 470 Q-225 430 -150 470 T0 470 T150 470 T300 470 T450 470 T600 470 T750 470 T900 470 V700 H-300Z" fill="#000" opacity=".35"/><path d="M-300 520 Q-225 480 -150 520 T0 520 T150 520 T300 520 T450 520 T600 520 T750 520 T900 520 V700 H-300Z" fill="#000" opacity=".45"/>`,
    lighthouse: `<polygon points="300,140 360,520 240,520" fill="#f3efe6"/><rect x="262" y="250" width="76" height="46" fill="#c0392b"/><rect x="250" y="360" width="100" height="46" fill="#c0392b"/><polygon points="300,140 390,60 390,200" fill="${accent}" opacity=".55"/><rect x="-300" y="520" width="1200" height="180" fill="#000" opacity=".4"/>`,
    compass: `<circle cx="300" cy="330" r="165" fill="none" stroke="${accent}" stroke-width="10"/><polygon points="300,170 330,300 300,330 270,300" fill="${accent}"/><polygon points="300,490 270,360 300,330 330,360" fill="#fff" opacity=".85"/><polygon points="140,330 270,300 300,330 270,360" fill="#fff" opacity=".6"/><polygon points="460,330 330,360 300,330 330,300" fill="${accent}" opacity=".8"/>`,
    wall: `<circle cx="430" cy="190" r="70" fill="${accent}" opacity=".9"/><path d="${WALL}" fill="#000" opacity=".7"/>`,
    planet: `<circle cx="300" cy="320" r="130" fill="${accent}" opacity=".9"/><ellipse cx="300" cy="320" rx="230" ry="46" fill="none" stroke="#fff" stroke-width="8" opacity=".8" transform="rotate(-18 300 320)"/><path d="M-300 560 H900 M-300 600 H900" stroke="${accent}" stroke-width="2" opacity=".5"/>`,
    moon: `<circle cx="300" cy="320" r="150" fill="${accent}"/><circle cx="350" cy="290" r="140" fill="${c1}"/><circle cx="130" cy="150" r="6" fill="#fff"/><circle cx="470" cy="120" r="8" fill="#fff"/><circle cx="90" cy="420" r="5" fill="#fff"/><circle cx="520" cy="440" r="6" fill="#fff"/>`,
  }[m.motif]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/><g transform="translate(60 40) scale(.8)">${motif}</g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const SLOTS = ['11:30', '13:10', '14:30', '15:40', '17:00', '18:20', '19:30', '20:45', '22:00']
/** Formato por película (3D en las de aventura y ciencia ficción) e idioma habitual. */
const FORMAT: Record<string, string> = { 'ej-tesoros': '3D', 'ej-isla': '3D', 'ej-marea': '3D' }
const LANG: Record<string, string> = { 'ej-muralla': 'SUB', 'ej-isla': 'SUB', 'ej-cumbia': 'DOB', 'ej-tesoros': 'DOB' }

/** Número repetible a partir de un texto (para que el ejemplo sea siempre igual). */
function hash(s: string): number {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/** Películas, carteles y funciones de ejemplo: de hoy a los próximos seis días, con variedad entre cadenas. */
export function exampleCine(now = new Date()): { movies: CineMovie[]; posters: [CinePoster, CinePoster, CinePoster, CinePoster]; shows: CineShow[] } {
  const movies: CineMovie[] = MOVIES.map((m) => ({ id: m.id, title: m.title, genre: m.genre, minutes: m.minutes, rating: m.rating, synopsis: m.synopsis, links: {}, release: '', soon: false, isNew: m.isNew, image: poster(m) }))
  let shows: CineShow[] = []
  nextDays(DAYS_AHEAD, now).forEach((day, di) => {
    CHAINS.forEach((chain, ci) => {
      movies.forEach((m, mi) => {
        // no todas las películas están en todas las cadenas todos los días
        if ((mi + ci * 2 + di) % 5 === 0) return
        const h = hash(`${m.id}|${chain.id}|${day}`)
        const count = 2 + (h % 3)
        const start = h % (SLOTS.length - count)
        const times = SLOTS.slice(start, start + count).map((t, k) => {
          const fmt = FORMAT[m.id] && (k + ci) % 2 === 0 ? ` ${FORMAT[m.id]}` : ''
          const lang = LANG[m.id] ? ` ${LANG[m.id]}` : ''
          const vip = k === count - 1 && ci === 0 && !fmt ? ' VIP' : ''
          return `${t}${fmt}${vip}${lang}`
        })
        shows = withShows(shows, m.id, chain.id, day, times.join(', '))
      })
    })
  })
  const posters = movies.slice(0, 4).map((m) => ({ title: m.title, image: m.image })) as [CinePoster, CinePoster, CinePoster, CinePoster]
  return { movies, posters, shows }
}
