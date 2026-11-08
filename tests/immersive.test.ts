import { describe, expect, it } from 'vitest'
import type { Product, Store } from '../src/domain/types'
import { DEFAULT_MUSIC, canEnter, musicUrlFor, youtubeId, firstTab, interiorProducts, interiorTabs, itemsFor, relPos, sceneOf, wrapIndex } from '../src/immersive/logic'

const store = (p: Partial<Store> = {}) => ({ id: 's1', categoryId: 'moda', zoneId: 'A', ...p }) as Store
const prod = (id: string, p: Partial<Product> = {}) => ({ id, storeId: 's1', active: true, featured: false, ...p }) as Product

describe('entrar al local (beta)', () => {
  it('solo se entra con la beta encendida y el local habilitado', () => {
    expect(canEnter(true, { interior: true })).toBe(true)
    expect(canEnter(false, { interior: true })).toBe(false)
    expect(canEnter(true, { interior: false })).toBe(false)
    expect(canEnter(true, {})).toBe(false)
    expect(canEnter(true, null)).toBe(false)
  })
  it('el escenario depende del tipo de negocio', () => {
    expect(sceneOf(store({ businessType: 'restaurant' }))).toBe('restaurant')
    expect(sceneOf(store({ businessType: 'service' }))).toBe('service')
    expect(sceneOf(store({ businessType: 'shop' }))).toBe('shop')
  })
  it('adentro solo hay productos activos del local', () => {
    const list = [prod('a'), prod('b', { active: false }), prod('c', { storeId: 'otro' })]
    expect(interiorProducts(store(), list).map((p) => p.id)).toEqual(['a'])
  })
  it('las pestañas salen de las categorías del local (propias y del rubro) y empiezan en «Todo»', () => {
    const s = store({ categories: [{ id: 'c1', name: 'Superior' }, { id: 'c2', name: 'Inferior' }, { id: 'c3', name: 'Vacía' }] })
    const list = [prod('a', { shopCategory: 'c1' }), prod('b', { shopCategory: 'c2' })]
    expect(interiorTabs(s, list).map((t) => t.id)).toEqual(['all', 'c1', 'c2'])
    const sin = interiorTabs(store(), [prod('a', { categoryId: 'moda' }), prod('b', { categoryId: 'belleza' })])
    expect(sin.map((t) => t.id)).toEqual(['all', 'g:moda', 'g:belleza'])
    const una = interiorTabs(store(), [prod('a', { categoryId: 'moda' })])
    expect(una.map((t) => t.id)).toEqual(['g:moda'])
    expect(firstTab(una)).toBe('g:moda')
    expect(firstTab(interiorTabs(s, list))).toBe('all')
    expect(interiorTabs(store(), [])).toEqual([])
    expect(firstTab([])).toBe('all')
  })
  it('una pestaña muestra sus productos y los destacados van primero', () => {
    const s = store({ categories: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }] })
    const list = [prod('a', { shopCategory: 'c1' }), prod('b', { shopCategory: 'c1', featured: true }), prod('c', { shopCategory: 'c2' })]
    expect(itemsFor(s, list, 'all').map((p) => p.id)).toEqual(['b', 'a', 'c'])
    expect(itemsFor(s, list, 'c1').map((p) => p.id)).toEqual(['b', 'a'])
    expect(itemsFor(s, list, 'zzz')).toEqual([])
  })
  it('el carrusel da la vuelta y cada tarjeta sabe dónde está respecto al centro', () => {
    expect(wrapIndex(-1, 4)).toBe(3)
    expect(wrapIndex(4, 4)).toBe(0)
    expect(wrapIndex(5, 0)).toBe(0)
    expect([0, 1, 2, 3, 4].map((i) => relPos(i, 0, 5))).toEqual([0, 1, 2, -2, -1])
    expect([0, 1, 2, 3, 4].map((i) => relPos(i, 4, 5))).toEqual([1, 2, -2, -1, 0])
    expect([0, 1].map((i) => relPos(i, 0, 2))).toEqual([0, 1])
    expect(relPos(0, 0, 1)).toBe(0)
  })
  it('la música del local: clásica de entrada, propia si la sube, o apagada', () => {
    expect(musicUrlFor({}, '/')).toBe(`/${DEFAULT_MUSIC}`)
    expect(musicUrlFor({ music: { mode: 'classic' } }, '/app/')).toBe(`/app/${DEFAULT_MUSIC}`)
    expect(musicUrlFor({ music: { mode: 'custom', url: 'https://x/y.mp3' } })).toBe('https://x/y.mp3')
    // «Mi música» sin pista cargada vuelve a la clásica
    expect(musicUrlFor({ music: { mode: 'custom', url: null } }, '/')).toBe(`/${DEFAULT_MUSIC}`)
    expect(musicUrlFor({ music: { mode: 'off', url: 'https://x/y.mp3' } })).toBeNull()
  })
})

describe('música de YouTube', () => {
  it('reconoce los enlaces habituales', () => {
    const id = 'dQw4w9WgXcQ'
    expect(youtubeId(`https://www.youtube.com/watch?v=${id}&t=3`)).toBe(id)
    expect(youtubeId(`https://youtu.be/${id}?si=abc`)).toBe(id)
    expect(youtubeId(`youtube.com/shorts/${id}`)).toBe(id)
    expect(youtubeId(`https://music.youtube.com/watch?v=${id}`)).toBe(id)
    expect(youtubeId(`https://www.youtube.com/embed/${id}`)).toBe(id)
  })
  it('rechaza lo que no es un video', () => {
    expect(youtubeId('')).toBeNull()
    expect(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeId('https://www.youtube.com/watch?v=corto')).toBeNull()
    expect(youtubeId('hola')).toBeNull()
  })
  it('el local con YouTube suena con yt:ID y, sin enlace válido, la clásica', () => {
    expect(musicUrlFor({ music: { mode: 'youtube', ytUrl: 'https://youtu.be/dQw4w9WgXcQ' } })).toBe('yt:dQw4w9WgXcQ')
    expect(musicUrlFor({ music: { mode: 'youtube', ytUrl: 'x' } }, '/')).toBe(`/${DEFAULT_MUSIC}`)
  })
})
