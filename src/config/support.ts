/**
 * WhatsApp del equipo de MallPlay para dar ayuda a los negocios (solo dígitos con indicativo, ej. 573001234567).
 * Se define al compilar con VITE_SUPPORT_WHATSAPP; mientras esté vacío, el botón de ayuda no se muestra.
 */
export const SUPPORT_WHATSAPP = ((import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) ?? '').replace(/\D/g, '')
