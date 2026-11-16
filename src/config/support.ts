/**
 * WhatsApp del equipo de MallPlay para dar ayuda a los negocios (solo dígitos con indicativo de Colombia).
 * Se puede cambiar al compilar con VITE_SUPPORT_WHATSAPP; si no, se usa el de soporte de MallPlay.
 */
const raw = ((import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) || '3006196013').replace(/\D/g, '')
export const SUPPORT_WHATSAPP = raw.length === 10 && raw.startsWith('3') ? `57${raw}` : raw
