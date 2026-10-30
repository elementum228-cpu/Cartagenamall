// Reloj de la aplicación: toda la vigencia de promociones y eventos se mide con él. En la demo es
// la hora del dispositivo; `setOffset` permite adelantarlo en pruebas sin tocar los datos.

let offset = 0

export const appClock = {
  now: () => Date.now() + offset,
  setOffset: (ms: number) => {
    offset = ms
  },
}
