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

import { DISTRICT_PLAZA, SPACES } from '../src/config/mall'
import { SHOWROOMS, SHOWROOM_IDS } from '../src/district/showrooms'

describe('zona de servicios', () => {
  type Box = [number, number, number, number]
  const boxOf = (cx: number, cz: number, w: number, d: number): Box => [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2]
  const overlap = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
  const spaces = SPACES.filter((s) => s.zoneId === 'F').map((s) => {
    const [w, d] = Math.abs(Math.sin(s.rotation)) > 0.5 ? [s.size[1], s.size[0]] : s.size
    return boxOf(s.position[0], s.position[1], w, d)
  })
  const rooms = SHOWROOM_IDS.map((id) => boxOf(SHOWROOMS[id].position[0], SHOWROOMS[id].position[1], ...SHOWROOMS[id].size))
  const plaza = boxOf(DISTRICT_PLAZA.x, DISTRICT_PLAZA.z, DISTRICT_PLAZA.r * 2, DISTRICT_PLAZA.r * 2)
  const harborPath = boxOf(HARBOR.x, HARBOR.wallZ - 3.7, 3.2, 5.2)

  it('nada se pisa: vitrinas, espacios, plaza y paso al muelle', () => {
    const all = [...spaces, ...rooms, plaza, harborPath]
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlap(all[i], all[j]), `${i} vs ${j}`).toBe(false)
  })
  it('todo queda dentro de la esquina, sin tocar los pasillos ni la muralla', () => {
    for (const b of [...spaces, ...rooms, plaza]) {
      expect(b[0]).toBeGreaterThan(-29.9)
      expect(b[2]).toBeLessThan(-9.9)
      expect(b[1]).toBeGreaterThan(9.9)
      expect(b[3]).toBeLessThan(29.9)
    }
  })
})
