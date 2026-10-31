import { describe, expect, it } from 'vitest'
import { BOATS, BOAT_IDS, CATEGORY_LABEL, HARBOR } from '../src/tourism/config'
import { PLACEHOLDER_EXPERIENCES } from '../src/tourism/data'
import { experiencesFor } from '../src/tourism/store'
import type { ExperienceCategory } from '../src/tourism/types'

describe('muelle turístico', () => {
  it('exactamente dos lanchas, separadas y frente al muelle', () => {
    expect(BOAT_IDS).toEqual(['mar', 'bahia'])
    const [a, b] = BOAT_IDS.map((id) => BOATS[id].position)
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(7)
    for (const id of BOAT_IDS) expect(BOATS[id].position[1]).toBeGreaterThan(HARBOR.outerZ)
  })

  it('las seis categorías existen y cada una tiene al menos un plan de ejemplo', () => {
    const cats = Object.keys(CATEGORY_LABEL) as ExperienceCategory[]
    expect(cats).toHaveLength(6)
    for (const c of cats) expect(PLACEHOLDER_EXPERIENCES.some((e) => e.category === c)).toBe(true)
    // ninguna lancha deja una categoría sin mostrar
    const shown = new Set(BOAT_IDS.flatMap((id) => BOATS[id].categories))
    expect(shown.size).toBe(6)
  })

  it('los datos de ejemplo no inventan precios ni contactos', () => {
    for (const e of PLACEHOLDER_EXPERIENCES) {
      expect(e.placeholder).toBe(true)
      expect(e.priceFrom).toBeNull()
      expect(e.contact.whatsapp ?? e.contact.bookingUrl).toBeUndefined()
    }
  })

  it('filtra por lancha y categoría, con las agotadas al final', () => {
    const mar = experiencesFor(PLACEHOLDER_EXPERIENCES, 'mar', null)
    expect(mar.every((e) => BOATS.mar.categories.includes(e.category))).toBe(true)
    const atardecer = experiencesFor(PLACEHOLDER_EXPERIENCES, 'bahia', 'atardecer')
    expect(atardecer.every((e) => e.category === 'atardecer')).toBe(true)
    expect(atardecer.at(-1)?.status).toBe('soldout')
  })
})
