import { describe, expect, it } from 'vitest'
import { withPosters } from '../src/state/cineFeed'
import type { CineMovie } from '../src/state/cine'

const movie = (id: string, title: string, over: Partial<CineMovie> = {}): CineMovie => ({ id, title, image: null, genre: '', minutes: null, rating: '', synopsis: '', links: {}, release: '', soon: false, isNew: false, ...over })
const posters = [
  { title: 'Avengers: Doomsday', image: 'a.png', synopsis: 'Héroes', trailer: 'https://youtu.be/dQw4w9WgXcQ' },
  { title: 'Godzilla Minus Zero', image: 'g.png' },
  { title: '', image: null },
  { title: '', image: null },
] as never

describe('carteles de la cartelera + catálogo', () => {
  it('con un catálogo que solo tiene «Próximamente», los carteles siguen siendo la cartelera', () => {
    const r = withPosters({ movies: [movie('m1', 'Minotauro', { soon: true })], shows: [] }, posters)
    expect(r.movies.map((m) => m.title)).toEqual(['Avengers: Doomsday', 'Godzilla Minus Zero', 'Minotauro'])
    expect(r.movies.find((m) => m.title === 'Minotauro')!.soon).toBe(true)
    expect(r.movies.filter((m) => !m.soon).map((m) => m.title)).toEqual(['Avengers: Doomsday', 'Godzilla Minus Zero'])
  })
  it('una película del catálogo con el mismo título que un cartel manda y toma su arte y sinopsis', () => {
    const r = withPosters({ movies: [movie('m2', 'avengers  doomsday', { soon: true })], shows: [] }, posters)
    const a = r.movies.filter((m) => m.title.toLowerCase().includes('avengers'))
    expect(a).toHaveLength(1)
    expect(a[0].soon).toBe(true)
    expect(a[0].image).toBe('a.png')
    expect(a[0].synopsis).toBe('Héroes')
  })
  it('sin catálogo, los carteles son la cartelera', () => {
    expect(withPosters({ movies: [], shows: [] }, posters).movies).toHaveLength(2)
  })
})
