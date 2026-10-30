/** Noche en Cartagena (aprox. todo el año: anochece ~18:00, amanece ~5:45). */
export function isNightHour(date: Date) {
  const h = date.getHours() + date.getMinutes() / 60
  return h >= 18 || h < 5.75
}
