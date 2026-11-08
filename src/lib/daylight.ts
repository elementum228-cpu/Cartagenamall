// Ciclo del día en Cartagena (cerca del ecuador: casi igual todo el año). El atardecer es gradual: desde las 4 p. m.
// el mall se va poniendo naranja, hacia las 6 anochece y las luces se encienden poco a poco; de madrugada, a las 5,
// empieza a aclarar con un tono rosado y anaranjado hasta que se hace de día hacia las 6:30.

export interface Sky {
  /** 0 = pleno día, 1 = noche cerrada. */
  night: number
  /** 0 a 1: cuánto tono naranja (atardecer o amanecer). */
  warm: number
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export const SKY_DAY: Sky = { night: 0, warm: 0 }
export const SKY_NIGHT: Sky = { night: 1, warm: 0 }
/** El momento más naranja del atardecer (sol bajo, ya casi de noche). */
export const SKY_DUSK: Sky = { night: 0.3, warm: 1 }

/** Zona horaria del mall: Cartagena (Colombia, UTC−5 todo el año). El cielo sigue esta hora, no la del teléfono. */
export const MALL_TIMEZONE = 'America/Bogota'

/** Hora decimal (0 a 24) en Cartagena de un instante dado, venga de la zona horaria que venga el dispositivo. */
export function mallHour(date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: MALL_TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
    return get('hour') + get('minute') / 60 + get('second') / 3600
  } catch {
    // sin Intl con zonas: Colombia no cambia de hora, es UTC−5 fijo
    return (((date.getUTCHours() - 5 + 24) % 24) + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) % 24
  }
}

/** Estado del cielo a una hora dada (hora de Cartagena). */
export function skyAt(date: Date): Sky {
  const h = mallHour(date)
  if (h >= 12) {
    // tarde: de 4 a 6 p. m. se pone naranja; entre 5:30 y 7 p. m. se hace de noche; el naranja se apaga al anochecer
    return { night: smooth(17.5, 19, h), warm: smooth(15.75, 17.75, h) * (1 - smooth(18.1, 19.2, h)) }
  }
  // madrugada: aclara de 5 a 6:30 a. m. con un amanecer anaranjado que se disuelve al salir el día
  return { night: 1 - smooth(5, 6.5, h), warm: smooth(4.9, 5.8, h) * (1 - smooth(6.2, 7.3, h)) }
}

/** Es de noche (más de la mitad del cielo oscuro): para los avisos y las tarjetas que cambian a modo oscuro. */
export function isNightHour(date: Date) {
  return skyAt(date).night > 0.5
}
