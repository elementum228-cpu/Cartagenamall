/** Identificador único entre navegadores (para lo que se guarda en la base compartida). */
export function uniqueId(prefix: string) {
  const time = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${time}${rand}`
}
