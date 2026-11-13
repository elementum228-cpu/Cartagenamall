import { CHAINS, DAYS_AHEAD, nextDays, withShows, type CineMovie, type CinePoster, type CineShow } from './cine'

// Datos de ejemplo para probar el cine: películas inventadas (sin carteles ni marcas reales) y funciones de toda la
// semana en las tres cadenas. Lo carga el administrador con «Cargar ejemplo».

const MOVIES: Omit<CineMovie, 'image' | 'synopsis'>[] = [
  { id: 'ej-marea', title: 'Marea Roja', genre: 'Acción', minutes: 128, rating: '12+' },
  { id: 'ej-faro', title: 'El Faro de Bocagrande', genre: 'Drama', minutes: 112, rating: '15+' },
  { id: 'ej-tesoros', title: 'Tesoros del Caribe', genre: 'Aventura', minutes: 96, rating: '7+' },
  { id: 'ej-muralla', title: 'Noche en la Muralla', genre: 'Terror', minutes: 101, rating: '15+' },
  { id: 'ej-isla', title: 'Isla Tecnología', genre: 'Ciencia ficción', minutes: 134, rating: '12+' },
  { id: 'ej-cumbia', title: 'Cumbia en la Luna', genre: 'Animación', minutes: 92, rating: '7+' },
]

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
  const movies: CineMovie[] = MOVIES.map((m) => ({ ...m, image: null, synopsis: '' }))
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
  const posters = movies.slice(0, 4).map((m) => ({ title: m.title, image: null })) as [CinePoster, CinePoster, CinePoster, CinePoster]
  return { movies, posters, shows }
}
