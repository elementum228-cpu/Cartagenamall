// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { ArcadeRewardsAdmin } from '../src/admin/ArcadeRewardsAdmin'
import { useArcadeRewards } from '../src/arcade/rewards'

describe('administración de premios del Arcade', () => {
  it('se dibuja vacía con los atajos para crear premios', () => {
    useArcadeRewards.setState({ rewards: [] })
    const html = renderToString(createElement(ArcadeRewardsAdmin))
    expect(html).toContain('Premios de las tiendas')
    expect(html).toContain('20 % de descuento')
    expect(html).toContain('Aún no hay premios')
  })
})
