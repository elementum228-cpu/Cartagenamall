/** Identificador único entre navegadores (para lo que se guarda en la base compartida). */
export function uniqueId(prefix: string) {
  const time = Date.now().toString(36).toUpperCase()
  // aleatorio criptográfico: el número de pedido también protege su seguimiento
  const bytes = new Uint8Array(6)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  const rand = [...bytes].map((b) => (b % 36).toString(36)).join('').toUpperCase()
  return `${prefix}-${time}${rand}`
}
