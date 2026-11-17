import { describe, expect, it } from 'vitest'
import { cleanRewards } from '../src/arcade/rewards'
import { progressTo } from '../src/arcade/PrizeViews'
import { useArcade } from '../src/arcade/store'

const base = { id: 'r1', title: 'Audífonos', detail: '', cost: 100, active: true, until: '' }

describe('foto del premio', () => {
  it('conserva fotos válidas (enlace seguro o imagen reducida) y descarta lo demás', () => {
    expect(cleanRewards([{ ...base, image: 'https://cdn.example.com/a.jpg' }])[0].image).toBe('https://cdn.example.com/a.jpg')
    expect(cleanRewards([{ ...base, image: 'data:image/jpeg;base64,AAAA' }])[0].image).toBe('data:image/jpeg;base64,AAAA')
    expect(cleanRewards([{ ...base, image: 'http://inseguro.example.com/a.jpg' }])[0].image).toBeUndefined()
    expect(cleanRewards([{ ...base, image: 'javascript:alert(1)' }])[0].image).toBeUndefined()
    expect(cleanRewards([{ ...base, image: 'data:text/html;base64,AAAA' }])[0].image).toBeUndefined()
    expect(cleanRewards([{ ...base, image: 'data:image/jpeg;base64,' + 'A'.repeat(500_000) }])[0].image).toBeUndefined()
    expect('image' in cleanRewards([base])[0]).toBe(false)
  })
  it('el avance hacia un premio', () => {
    expect(progressTo(30, 120)).toEqual({ pct: 25, missing: 90 })
    expect(progressTo(500, 120)).toEqual({ pct: 100, missing: 0 })
  })
  it('la meta se guarda y se limpia al canjear ese premio', () => {
    useArcade.setState({ goal: 's1:p1' })
    useArcade.getState().setGoal(null)
    expect(useArcade.getState().goal).toBeNull()
  })
})
