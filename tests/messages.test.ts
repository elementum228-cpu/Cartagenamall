import { describe, expect, it } from 'vitest'
import { messageFor, MESSAGE_DEFAULTS } from '../src/lib/messages'

describe('mensajes de WhatsApp del negocio', () => {
  it('usa el texto de MallPlay si no hay personalizado, sin emojis', () => {
    const m = messageFor({ name: 'Lulla' }, 'greeting', {})
    expect(m).toBe('Hola Lulla, vengo de MallPlay.')
    for (const t of Object.values(MESSAGE_DEFAULTS)) expect(/\p{Extended_Pictographic}/u.test(t)).toBe(false)
  })
  it('usa el texto propio y llena las variables', () => {
    const m = messageFor({ name: 'Lulla', messages: { booking: 'Quiero {servicio} por {precio} en {tienda}' } }, 'booking', { servicio: 'Sesión', precio: '$10' })
    expect(m).toBe('Quiero Sesión por $10 en Lulla')
  })
  it('un texto vacío vuelve al de MallPlay', () => {
    expect(messageFor({ name: 'X', messages: { greeting: '   ' } }, 'greeting', {})).toBe('Hola X, vengo de MallPlay.')
  })
})
