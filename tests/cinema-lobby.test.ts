import { beforeEach, describe, expect, it } from 'vitest'
import { parseTrailer } from '../src/cinema/trailer'
import { inviteText } from '../src/cinema/invite'
import type { GroupPlan } from '../src/cinema/types'
import { MAX_EVENTS, cleanCine, cleanEvent, cleanMovie, emptyCine, publicEvents, seatsLeft, type CineEvent } from '../src/state/cine'
import { CHALLENGES, MAX_PLANS, progressOf, useCineSocial } from '../src/state/cineSocial'
import { useCineUi } from '../src/state/cineUi'

const NOW = new Date(2026, 10, 13, 12, 0)

describe('tráileres', () => {
  it('acepta YouTube y Vimeo y arma un reproductor incrustado sin cookies', () => {
    const y = parseTrailer('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')!
    expect(y).toMatchObject({ provider: 'youtube', id: 'dQw4w9WgXcQ', watch: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    expect(y.embed.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(true)
    expect(parseTrailer('https://youtu.be/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ')
    expect(parseTrailer('https://m.youtube.com/shorts/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ')
    const v = parseTrailer('https://vimeo.com/76979871')!
    expect(v).toMatchObject({ provider: 'vimeo', id: '76979871' })
    expect(v.embed).toContain('dnt=1')
  })
  it('rechaza todo lo demás: http, otros sitios, ids raros, credenciales, javascript:', () => {
    for (const bad of ['', 'http://youtu.be/dQw4w9WgXcQ', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=corto', 'https://user:pw@youtube.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'https://vimeo.com/abc', 'no es un enlace'])
      expect(parseTrailer(bad), bad).toBeNull()
    expect(parseTrailer(null)).toBeNull()
  })
})

describe('películas: campos nuevos', () => {
  it('guarda imagen horizontal, tráiler válido, año y revisión; descarta lo inválido', () => {
    const m = cleanMovie({ id: 'a', title: 'A', backdrop: 'data:image/png;base64,xx', trailer: 'https://youtu.be/dQw4w9WgXcQ', year: 2026, updatedAt: '2026-11-13' }, 0)
    expect(m).toMatchObject({ backdrop: 'data:image/png;base64,xx', trailer: 'https://youtu.be/dQw4w9WgXcQ', year: 2026, updatedAt: '2026-11-13' })
    const bad = cleanMovie({ id: 'b', title: 'B', trailer: 'https://evil.com/x', year: 1800, updatedAt: 'ayer' }, 1)
    expect(bad.trailer).toBeUndefined()
    expect(bad.year).toBeUndefined()
    expect(bad.updatedAt).toBeUndefined()
  })
})

describe('eventos del cine', () => {
  const ev = (o: Partial<CineEvent>) => cleanEvent({ id: 'e', title: 'Noche', ...o }, 0)
  it('empieza en borrador, sin eventos de ejemplo, y los borradores no se ven', () => {
    expect(emptyCine().events).toEqual([])
    expect(ev({}).status).toBe('draft')
    expect(publicEvents([ev({}), ev({ status: 'open', title: '' })])).toEqual([])
  })
  it('ordena: abiertos, próximos, completos y al final lo terminado o cancelado', () => {
    const list = publicEvents([ev({ id: '1', status: 'finished' }), ev({ id: '2', status: 'soon' }), ev({ id: '3', status: 'open' }), ev({ id: '4', status: 'full' }), ev({ id: '5', status: 'cancelled' })])
    expect(list.map((e) => e.id)).toEqual(['3', '2', '4', '1', '5'])
  })
  it('limpia datos: enlace solo https, hora válida, cupos coherentes, estado y tipo conocidos', () => {
    const e = ev({ url: 'http://x.com', time: '25:00', capacity: 10, taken: 99, status: 'raro' as never, kind: 'otro' as never, date: '13/11' })
    expect(e).toMatchObject({ url: '', time: '', capacity: 10, taken: 10, status: 'draft', kind: 'premiere', date: '' })
    expect(ev({ url: 'https://inscripcion.com/x', time: '19:30', date: '2026-12-01' })).toMatchObject({ url: 'https://inscripcion.com/x', time: '19:30', date: '2026-12-01' })
    expect(seatsLeft(e)).toBe(0)
    expect(seatsLeft({ capacity: null, taken: null })).toBeNull()
  })
  it('viajan dentro de la configuración del cine y tienen tope', () => {
    const many = Array.from({ length: MAX_EVENTS + 5 }, (_, i) => ({ id: `e${i}`, title: `E${i}`, status: 'open' }))
    expect(cleanCine({ events: many }, NOW).events).toHaveLength(MAX_EVENTS)
    expect(cleanCine({}, NOW).events).toEqual([])
  })
})

describe('guardados, planes y retos (en este dispositivo)', () => {
  beforeEach(() => useCineSocial.setState({ favorites: [], seen: [], explored: false, everSaved: false, everPlanned: false, plans: [], done: {} }))
  const plan = (i = 0): GroupPlan => ({ id: `p${i}`, movieId: 'm', movieTitle: 'Marea Roja', chain: 'procinal', venue: '', day: '2026-11-20', time: '', privacy: 'private', maxParticipants: 4, participants: [{ id: 'me', name: 'Ana', role: 'organizer' }], createdAt: NOW.toISOString(), status: 'local' })

  it('guarda y quita películas', () => {
    const s = useCineSocial.getState()
    expect(s.toggleFavorite({ id: 'm1', title: 'Uno' })).toBe(true)
    expect(useCineSocial.getState().isSaved('m1')).toBe(true)
    expect(useCineSocial.getState().toggleFavorite({ id: 'm1', title: 'Uno' })).toBe(false)
    expect(useCineSocial.getState().favorites).toEqual([])
  })
  it('cada reto se completa una sola vez y no se pierde al deshacer la acción', () => {
    const s = () => useCineSocial.getState()
    expect(s().settle()).toEqual([])
    s().markExplored()
    expect(s().settle()).toEqual(['explore'])
    expect(s().settle()).toEqual([]) // no repite
    s().toggleFavorite({ id: 'm1', title: 'Uno' })
    expect(s().settle()).toEqual(['first-save'])
    s().toggleFavorite({ id: 'm1', title: 'Uno' }) // quita la película
    expect(progressOf('first-save', s())).toBe(1) // el progreso no se pierde
    expect(s().settle()).toEqual([])
  })
  it('«descubre cinco» cuenta películas distintas, no la misma varias veces', () => {
    const s = () => useCineSocial.getState()
    for (const id of ['a', 'a', 'a', 'b', 'c', 'd']) s().markSeen(id)
    expect(progressOf('discover5', s())).toBe(4)
    expect(s().settle()).not.toContain('discover5')
    s().markSeen('e')
    expect(s().settle()).toContain('discover5')
  })
  it('los retos que dependen de funciones que aún no existen nunca se completan solos', () => {
    const pending = CHALLENGES.filter((c) => !c.available).map((c) => c.id)
    expect(pending.sort()).toEqual(['invite', 'trivia'])
    useCineSocial.setState({ seen: ['a', 'b', 'c', 'd', 'e'], explored: true, everSaved: true, everPlanned: true })
    const fresh = useCineSocial.getState().settle()
    expect(fresh).not.toContain('trivia')
    expect(fresh).not.toContain('invite')
  })
  it('los planes tienen tope y quedan como locales (nunca «publicados»)', () => {
    for (let i = 0; i < MAX_PLANS; i++) expect(useCineSocial.getState().addPlan(plan(i))).toBe(true)
    expect(useCineSocial.getState().addPlan(plan(99))).toBe(false)
    expect(useCineSocial.getState().plans.every((p) => p.status === 'local')).toBe(true)
    useCineSocial.getState().removePlan('p0')
    expect(useCineSocial.getState().plans).toHaveLength(MAX_PLANS - 1)
    expect(progressOf('plan', useCineSocial.getState())).toBe(1)
  })
  it('el mensaje de invitación no lleva datos personales ni ubicación', () => {
    const t = inviteText(plan())
    expect(t).toContain('Marea Roja')
    expect(t).toContain('Procinal')
    expect(t).toContain('compra su entrada')
    expect(t).not.toMatch(/\d{7,}|ubicaci|ana\b/i)
    expect(inviteText({ ...plan(), chain: null, day: '' })).toContain('cine por definir')
  })
})

describe('navegación del lobby', () => {
  it('recuerda la pestaña y la película al cerrar y volver a abrir; cambiar de pestaña sale del detalle', () => {
    const ui = () => useCineUi.getState()
    ui().open('lobby')
    ui().setTab('plans')
    ui().openMovie('m1')
    ui().close()
    expect(ui().view).toBeNull()
    expect(ui().tab).toBe('plans')
    expect(ui().movieId).toBe('m1')
    ui().open('lobby')
    ui().setTab('events')
    expect(ui().movieId).toBeNull()
    ui().openWizard('m2')
    expect(ui().wizard).toEqual({ movieId: 'm2' })
    ui().close()
    expect(ui().wizard).toBeNull()
  })
})
