import { describe, expect, it } from 'vitest'
import { DPR_CAP, classify, type DeviceSignals } from '../src/lib/deviceProfile'

const base: DeviceSignals = { webgl: true, webgl2: true, reducedMotion: false, shortSide: 390, longSide: 844, dpr: 2, touch: true, ios: false }
const dev = (o: Partial<DeviceSignals>): DeviceSignals => ({ ...base, ...o })

describe('perfil de dispositivo (calidad automática)', () => {
  it('sin WebGL → low y plano 2D', () => {
    expect(classify(dev({ webgl: false, webgl2: false }))).toMatchObject({ tier: 'low', start3D: false })
  })

  it('ahorro de datos o red lenta → low', () => {
    expect(classify(dev({ saveData: true, memory: 8, cores: 8 })).tier).toBe('low')
    for (const t of ['slow-2g', '2g', '3g']) expect(classify(dev({ effectiveType: t, memory: 8, cores: 8 })).tier).toBe('low')
    expect(classify(dev({ effectiveType: '4g', memory: 8, cores: 8, shortSide: 1080, touch: false })).tier).toBe('high')
  })

  it('celulares básicos (poca memoria o pocos núcleos) → low y 2D', () => {
    const p = classify(dev({ memory: 2, cores: 8 }))
    expect(p).toMatchObject({ tier: 'low', start3D: false })
    expect(p.reasons.join()).toMatch(/memoria/)
    expect(classify(dev({ memory: 4, cores: 2 })).tier).toBe('low')
  })

  it('Galaxy A13 / Moto G (4 GB, 8 núcleos) → medium con 3D ligero', () => {
    expect(classify(dev({ memory: 4, cores: 8 }))).toMatchObject({ tier: 'medium', start3D: true })
    expect(classify(dev({ memory: 4, cores: 4 })).tier).toBe('medium')
  })

  it('celular sin datos (Chrome sin deviceMemory) o iPhone → medium', () => {
    expect(classify(dev({})).tier).toBe('medium')
    expect(classify(dev({ ios: true, shortSide: 390 })).tier).toBe('medium')
  })

  it('celular potente (8 GB y 8 núcleos) → high; el iPhone nunca, por su memoria compartida', () => {
    expect(classify(dev({ memory: 8, cores: 8 })).tier).toBe('high')
    expect(classify(dev({ memory: 8, cores: 8, ios: true })).tier).toBe('medium')
  })

  it('escritorio de 1440 px → high; laptop modesta (4 GB o 4 núcleos) → medium', () => {
    const desktop = { touch: false, shortSide: 900, longSide: 1440, dpr: 1 }
    expect(classify(dev({ ...desktop, memory: 8, cores: 12 })).tier).toBe('high')
    expect(classify(dev({ ...desktop })).tier).toBe('high') // sin datos: se asume potente
    expect(classify(dev({ ...desktop, memory: 4, cores: 4 })).tier).toBe('medium')
    expect(classify(dev({ ...desktop, memory: 8, cores: 8, webgl2: false })).tier).toBe('medium')
  })

  it('iPad (pantalla grande y táctil) no se trata como celular', () => {
    expect(classify(dev({ ios: true, shortSide: 820, longSide: 1180, memory: undefined })).tier).toBe('high')
  })

  it('«prefers-reduced-motion» no baja el nivel por sí solo (solo quita animaciones)', () => {
    expect(classify(dev({ reducedMotion: true, touch: false, shortSide: 900, longSide: 1440, memory: 8, cores: 8 })).tier).toBe('high')
  })

  it('el tope de resolución crece con el nivel', () => {
    expect(DPR_CAP.low).toBeLessThan(DPR_CAP.medium)
    expect(DPR_CAP.medium).toBeLessThan(DPR_CAP.high)
    expect(DPR_CAP.high).toBeLessThanOrEqual(2)
  })

  it('siempre explica por qué', () => {
    for (const s of [dev({}), dev({ webgl: false }), dev({ memory: 8, cores: 8 })]) expect(classify(s).reasons.length).toBeGreaterThan(0)
  })
})
