import { describe, expect, it } from 'vitest'
import type { Product, Store } from '../src/domain/types'
import { canEnter, interiorProducts, interiorTabs, itemsFor, neighbors, sceneOf, wrapIndex } from '../src/immersive/logic'

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
  it('las pestañas salen de las categorías propias con productos', () => {
    const s = store({ categories: [{ id: 'c1', name: 'Superior' }, { id: 'c2', name: 'Inferior' }, { id: 'c3', name: 'Vacía' }] })
    const list = [prod('a', { shopCategory: 'c1' }), prod('b', { shopCategory: 'c2' })]
    expect(interiorTabs(s, list).map((t) => t.id)).toEqual(['all', 'c1', 'c2'])
    // con una sola categoría o ninguna no hace falta barra
    expect(interiorTabs(store({ categories: [{ id: 'c1', name: 'x' }] }), list)).toEqual([])
    expect(interiorTabs(store(), list)).toEqual([])
  })
  it('una pestaña muestra sus productos y los destacados van primero', () => {
    const list = [prod('a', { shopCategory: 'c1' }), prod('b', { shopCategory: 'c1', featured: true }), prod('c', { shopCategory: 'c2' })]
    expect(itemsFor(list, 'all').map((p) => p.id)).toEqual(['b', 'a', 'c'])
    expect(itemsFor(list, 'c1').map((p) => p.id)).toEqual(['b', 'a'])
    expect(itemsFor(list, 'zzz')).toEqual([])
  })
  it('el carrusel da la vuelta', () => {
    expect(wrapIndex(-1, 4)).toBe(3)
    expect(wrapIndex(4, 4)).toBe(0)
    expect(wrapIndex(5, 0)).toBe(0)
    expect(neighbors(0, 4)).toEqual({ prev: 3, next: 1 })
    expect(neighbors(0, 2)).toEqual({ prev: null, next: 1 })
    expect(neighbors(0, 1)).toEqual({ prev: null, next: null })
  })
})
