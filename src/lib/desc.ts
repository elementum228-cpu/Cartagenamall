/** Descripción de un producto lista para mostrar: vacía si no la tiene (también los datos viejos con «Sin descripción.»). */
export const productDesc = (p: { description?: string }): string => {
  const d = (p.description ?? '').trim()
  return /^sin descripci[oó]n\.?$/i.test(d) ? '' : d
}
