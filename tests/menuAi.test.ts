import { describe, expect, it } from 'vitest'
import { cleanAiMenu, cleanImages, MAX_IMAGES, MENU_SCHEMA } from '../supabase/functions/_shared/menu/read'
import { fromAi } from '../src/lib/menuAi'

const b64 = 'A'.repeat(200)

describe('imágenes que llegan a la función', () => {
  it('acepta imágenes válidas', () => {
    expect(cleanImages([{ media_type: 'image/jpeg', data: b64 }])).toHaveLength(1)
  })
  it('rechaza tipos raros, vacíos, base64 inválido o demasiadas', () => {
    expect(cleanImages([])).toBeNull()
    expect(cleanImages('x')).toBeNull()
    expect(cleanImages([{ media_type: 'application/pdf', data: b64 }])).toBeNull()
    expect(cleanImages([{ media_type: 'image/png', data: 'no es base64!!' + b64 }])).toBeNull()
    expect(cleanImages(Array.from({ length: MAX_IMAGES + 1 }, () => ({ media_type: 'image/png', data: b64 })))).toBeNull()
  })
})

describe('limpieza de lo que devuelve el modelo', () => {
  it('ordena secciones y platos y descarta lo vacío o repetido', () => {
    const m = cleanAiMenu({
      sections: [
        { name: 'Entradas', items: [{ name: 'Morcilla', price: 20000, description: '' }, { name: 'morcilla', price: 20000, description: '' }, { name: '  ', price: 5000, description: '' }] },
        { name: 'Vacía', items: [] },
      ],
    })
    expect(m.sections).toHaveLength(1)
    expect(m.sections[0].items).toEqual([{ name: 'Morcilla', price: 20000, description: '' }])
  })
  it('corrige precios en miles abreviados y los marca', () => {
    const m = cleanAiMenu({ sections: [{ name: 'Bebidas', items: [{ name: 'Limonada', price: 8, description: '' }, { name: 'Jugo', price: 10000, description: '' }, { name: 'Raro', price: -3, description: '' }, { name: 'Enorme', price: 99999999, description: '' }] }] })
    const [a, b, c, d] = m.sections[0].items
    expect(a).toMatchObject({ price: 8000, dubious: true })
    expect(b).toMatchObject({ price: 10000 })
    expect(c.price).toBeNull()
    expect(d.price).toBeNull()
  })
  it('basura en la entrada no rompe', () => {
    expect(cleanAiMenu(null).sections).toEqual([])
    expect(cleanAiMenu({ sections: 'x' }).sections).toEqual([])
    expect(cleanAiMenu({ sections: [null, { items: 5 }] }).sections).toEqual([])
  })
  it('el esquema pide secciones con platos (nombre, precio, descripción)', () => {
    expect(MENU_SCHEMA.required).toEqual(['sections'])
    expect(MENU_SCHEMA.properties.sections.items.properties.items.items.required).toEqual(['name', 'price', 'description'])
  })
})

describe('de la respuesta de la IA a la pantalla de revisión', () => {
  it('marca los platos sin precio y los precios dudosos', () => {
    const m = fromAi({ sections: [{ name: 'Sopas', items: [{ name: 'Ajiaco', price: 18000, description: 'Con pollo' }, { name: 'Sancocho', price: null, description: '' }, { name: 'Caldo', price: 8000, description: '', dubious: true }] }] })
    expect(m.items).toBe(3)
    const [a, b, c] = m.sections[0].items
    expect(a).toMatchObject({ price: 18000, flag: undefined })
    expect(b).toMatchObject({ price: null, flag: 'sin-precio' })
    expect(c).toMatchObject({ price: 8000, flag: 'precio-dudoso' })
  })
})
