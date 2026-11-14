/** «2026-11-19» → «19 nov». */
export const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '')
/** «2026-11-19» → «jueves 19 de noviembre». */
export const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
