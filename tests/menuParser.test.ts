import { describe, expect, it } from 'vitest'
import { iconFor, parseMenuText, toCOP } from '../src/lib/menuParser'

describe('precios en pesos', () => {
  it('entiende los formatos colombianos', () => {
    expect(toCOP('$25.000')).toBe(25000)
    expect(toCOP('25,000')).toBe(25000)
    expect(toCOP('25000')).toBe(25000)
    expect(toCOP('12k')).toBe(12000)
    expect(toCOP('12 mil')).toBe(12000)
    expect(toCOP('hola')).toBeNull()
  })
})

describe('lectura de menús', () => {
  it('nombre con precio y puntos guía', () => {
    const m = parseMenuText(['ENTRADAS', 'Empanadas de carne ........ $8.500', 'Patacones con hogao ..... 12.000', 'PLATOS FUERTES', 'Bandeja paisa .......... $32.000'])
    expect(m.sections.map((s) => s.name)).toEqual(['Entradas', 'Platos fuertes'])
    expect(m.sections[0].items.map((i) => [i.name, i.price])).toEqual([['Empanadas de carne', 8500], ['Patacones con hogao', 12000]])
    expect(m.sections[1].items[0]).toMatchObject({ name: 'Bandeja paisa', price: 32000 })
    expect(m.items).toBe(3)
  })

  it('precio en la línea de abajo y descripción', () => {
    const m = parseMenuText(['POSTRES', 'Cheesecake de maracuyá', 'Base de galleta y salsa de fruta', '$14.000', 'Brownie', '9.000'])
    const items = m.sections[0].items
    expect(items[0]).toMatchObject({ name: 'Cheesecake de maracuyá', description: 'Base de galleta y salsa de fruta', price: 14000 })
    expect(items[1]).toMatchObject({ name: 'Brownie', price: 9000 })
  })

  it('descripción en la misma línea y en la siguiente', () => {
    const m = parseMenuText(['HAMBURGUESAS', 'Clásica - carne 150 g, queso, lechuga y tomate $22.000', 'Doble queso $28.000', 'con papas a la francesa'])
    const [a, b] = m.sections[0].items
    expect(a).toMatchObject({ name: 'Clásica', price: 22000 })
    expect(a.description).toContain('carne 150 g')
    expect(b).toMatchObject({ name: 'Doble queso', price: 28000 })
    expect(b.description).toBe('con papas a la francesa')
  })

  it('varios precios por tamaño y precio corto en miles', () => {
    const m = parseMenuText(['PIZZAS', 'Margarita Personal 18.000 Grande 36.000', 'BEBIDAS', 'Limonada 8', 'Gaseosa 5k'])
    expect(m.sections[0].items[0]).toMatchObject({ price: 18000, flag: 'varios-precios' })
    expect(m.sections[0].items[0].prices).toEqual([18000, 36000])
    expect(m.sections[1].items[0]).toMatchObject({ name: 'Limonada', price: 8000, flag: 'precio-dudoso' })
    expect(m.sections[1].items[1]).toMatchObject({ name: 'Gaseosa', price: 5000 })
  })

  it('ignora teléfonos, páginas y encabezados', () => {
    const m = parseMenuText(['MENÚ', 'Restaurante La Esquina', 'Tel: 300 123 4567', 'www.laesquina.com', 'SOPAS', 'Ajiaco 18.000', 'Página 1'])
    expect(m.sections).toHaveLength(1)
    expect(m.items).toBe(1)
  })

  it('un plato sin precio queda marcado para revisar', () => {
    const m = parseMenuText(['SOPAS', 'Sancocho de gallina', 'Ajiaco 18.000'])
    expect(m.sections[0].items[0]).toMatchObject({ name: 'Sancocho de gallina', price: null, flag: 'sin-precio' })
  })

  it('sin títulos todo cae en «Menú»', () => {
    const m = parseMenuText('Arepa de huevo 6.000\nEmpanada 4.500')
    expect(m.sections[0].name).toBe('Menú')
    expect(m.items).toBe(2)
  })
})

describe('íconos', () => {
  it('adivina el ícono por el nombre', () => {
    expect(iconFor('Limonada de coco')).toBe('drink')
    expect(iconFor('Brownie')).toBe('dessert')
    expect(iconFor('Ceviche de camarón')).toBe('fish')
    expect(iconFor('Bandeja paisa')).toBe('plate')
  })
})
