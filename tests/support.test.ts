import { describe, expect, it } from 'vitest'
import { SUPPORT_WHATSAPP } from '../src/config/support'

describe('soporte', () => {
  it('el WhatsApp de ayuda lleva el indicativo de Colombia', () => {
    expect(SUPPORT_WHATSAPP).toBe('573006196013')
  })
})
