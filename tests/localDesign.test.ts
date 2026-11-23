import { describe, expect, it } from 'vitest'
import { ISLAND_MODELS, LOCAL_MODELS, TOPPERS, cleanDesign, designFromModel, readableOn } from '../src/world/localDesign'

describe('Arma tu local', () => {
  it('trae once modelos con identificadores distintos', () => {
    expect(LOCAL_MODELS).toHaveLength(11)
    expect(new Set(LOCAL_MODELS.map((m) => m.id)).size).toBe(11)
  })
  it('trae seis modelos de isla, que quedan marcados como isla', () => {
    expect(ISLAND_MODELS).toHaveLength(6)
    for (const m of ISLAND_MODELS) expect(designFromModel(m.id).form).toBe('island')
    for (const m of LOCAL_MODELS) expect(designFromModel(m.id).form).toBe('local')
  })
  it('el banco de objetos del techo no repite ninguno', () => {
    expect(new Set(TOPPERS.map((t) => t.id)).size).toBe(TOPPERS.length)
    expect(TOPPERS.length).toBeGreaterThanOrEqual(20)
  })
  it('cada modelo es un diseño válido que no cambia al limpiarlo', () => {
    for (const m of [...LOCAL_MODELS, ...ISLAND_MODELS]) expect(cleanDesign(designFromModel(m.id))).toEqual(designFromModel(m.id))
  })
  it('lo desconocido o dañado vuelve a los valores del modelo', () => {
    const d = cleanDesign({ model: 'pizza', wall: 'rojo', roof: 'volcán', tables: 9, topper: 'cohete', planters: 'sí' })!
    const base = designFromModel('pizza')
    expect(d.wall).toBe(base.wall)
    expect(d.roof).toBe(base.roof)
    expect(d.tables).toBe(base.tables)
    expect(d.topper).toBe(base.topper)
    expect(d.planters).toBe(base.planters)
  })
  it('acepta colores válidos y opciones conocidas', () => {
    const d = cleanDesign({ model: 'cafe', wall: '#112233', roof: 'gable', topper: 'burger', tables: 3 })!
    expect(d).toMatchObject({ wall: '#112233', roof: 'gable', topper: 'burger', tables: 3 })
  })
  it('sin diseño devuelve null', () => {
    expect(cleanDesign(undefined)).toBeNull()
    expect(cleanDesign('x')).toBeNull()
  })
  it('el nombre siempre contrasta con el fondo', () => {
    expect(readableOn('#ffffff')).toBe('#1b1410')
    expect(readableOn('#101010')).toBe('#fffaf0')
  })
})
