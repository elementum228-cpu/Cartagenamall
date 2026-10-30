// Sonidos del portón de bienvenida, sintetizados con Web Audio (sin archivos): dos golpes de
// aldaba sobre madera, el crujido de las bisagras al abrir y un soplo con acorde cálido al cruzar.
//
// Detalles que importan para que de verdad suene:
// - El audio se crea y se desbloquea dentro del toque de la persona (unlockDoorSound), como exigen
//   Safari y Chrome; en iPhone además hace falta reproducir algo en ese mismo instante.
// - Cada sonido se programa cuando el contexto ya corre (await resume): uno recién creado puede
//   tardar en arrancar y lo programado «en el pasado» se perdería.
// - Los parlantes de celular casi no dan graves: el golpe lleva cuerpo en frecuencias medias.
// - Todo pasa por un limitador, así se puede subir el volumen sin distorsión.

const MUTE_KEY = 'cm:door-sound-off'
let ctx: AudioContext | null = null
let master: AudioNode | null = null

export function doorSoundOn() {
  try {
    return localStorage.getItem(MUTE_KEY) !== '1'
  } catch {
    return true
  }
}

export function setDoorSound(on: boolean) {
  try {
    if (on) localStorage.removeItem(MUTE_KEY)
    else localStorage.setItem(MUTE_KEY, '1')
  } catch {
    /* sin almacenamiento: vale solo por esta visita */
  }
}

function context(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctx) {
      ctx = new AC()
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -6
      limiter.knee.value = 4
      limiter.ratio.value = 12
      limiter.attack.value = 0.002
      limiter.release.value = 0.15
      const gain = ctx.createGain()
      gain.gain.value = 0.9
      gain.connect(limiter).connect(ctx.destination)
      master = gain
    }
    return ctx
  } catch {
    return null
  }
}

/** Llamar dentro del toque: crea/reanuda el audio y reproduce un instante de silencio (iOS). */
export function unlockDoorSound() {
  if (!doorSoundOn()) return
  const ac = context()
  if (!ac) return
  if (ac.state !== 'running') void ac.resume().catch(() => {})
  try {
    const src = ac.createBufferSource()
    src.buffer = ac.createBuffer(1, 1, ac.sampleRate)
    src.connect(ac.destination)
    src.start(0)
  } catch {
    /* nada: solo era para desbloquear */
  }
}

/** Contexto listo para programar sonidos (o null si el sonido está apagado o no hay audio). */
async function ready(): Promise<{ ac: AudioContext; out: AudioNode; t: number } | null> {
  if (!doorSoundOn()) return null
  const ac = context()
  if (!ac || !master) return null
  if (ac.state !== 'running') {
    try {
      await ac.resume()
    } catch {
      return null
    }
  }
  return { ac, out: master, t: ac.currentTime + 0.03 }
}

function noise(ac: AudioContext, seconds: number) {
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  return src
}

/** Envolvente: sube rápido a `peak` y cae a casi cero en `decay` segundos. */
function env(ac: AudioContext, at: number, peak: number, decay: number, attack = 0.004) {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  return g
}

function tone(ac: AudioContext, out: AudioNode, at: number, type: OscillatorType, from: number, to: number, peak: number, decay: number) {
  const o = ac.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(from, at)
  o.frequency.exponentialRampToValueAtTime(to, at + decay * 0.8)
  o.connect(env(ac, at, peak, decay)).connect(out)
  o.start(at)
  o.stop(at + decay + 0.02)
}

/** Golpe seco de aldaba sobre madera gruesa: resonancias medias de la madera + chasquido. */
function knockAt(ac: AudioContext, out: AudioNode, at: number, strength = 1) {
  tone(ac, out, at, 'sine', 180, 95, 0.95 * strength, 0.2) // cuerpo (se siente en audífonos)
  tone(ac, out, at, 'triangle', 420, 300, 0.85 * strength, 0.14) // madera: se oye en celulares
  tone(ac, out, at, 'sine', 760, 560, 0.4 * strength, 0.08)
  const click = noise(ac, 0.1)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800
  bp.Q.value = 1.2
  click.connect(bp).connect(env(ac, at, 1.2 * strength, 0.05, 0.001)).connect(out)
  click.start(at)
}

/** Dos golpes de aldaba (el segundo, un poco más suave). */
export async function playKnock() {
  const r = await ready()
  if (!r) return
  knockAt(r.ac, r.out, r.t)
  knockAt(r.ac, r.out, r.t + 0.26, 0.85)
}

/** Crujido de bisagras viejas mientras se abren las hojas (~1,4 s) y el tope al final. */
export async function playCreak() {
  const r = await ready()
  if (!r) return
  const { ac, out, t } = r
  const dur = 1.4
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.15)
  g.gain.setValueAtTime(0.45, t + dur - 0.4)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(800, t)
  bp.frequency.linearRampToValueAtTime(1500, t + dur)
  bp.Q.value = 5
  bp.connect(g).connect(out)
  // dos «voces» de la bisagra, con el tono que tiembla de forma irregular
  for (const [base, gain] of [
    [140, 1],
    [215, 0.6],
  ]) {
    const o = ac.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(base, t)
    for (let k = 1; k <= 14; k++) o.frequency.linearRampToValueAtTime(base * (0.85 + Math.random() * 0.45) * (1 + k * 0.02), t + (k / 14) * dur)
    const og = ac.createGain()
    og.gain.value = gain
    o.connect(og).connect(bp)
    o.start(t)
    o.stop(t + dur)
  }
  knockAt(ac, out, t + dur - 0.05, 0.45)
}

/** Soplo de aire y un acorde cálido al cruzar el umbral. */
export async function playEnter() {
  const r = await ready()
  if (!r) return
  const { ac, out, t } = r
  const air = noise(ac, 1.4)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.8
  bp.frequency.setValueAtTime(400, t)
  bp.frequency.exponentialRampToValueAtTime(3000, t + 1.1)
  const airGain = ac.createGain()
  airGain.gain.setValueAtTime(0.0001, t)
  airGain.gain.exponentialRampToValueAtTime(0.3, t + 0.5)
  airGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.35)
  air.connect(bp).connect(airGain).connect(out)
  air.start(t)
  // acorde mayor (do–mi–sol–do), entrando nota por nota, con un brillo de campana
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const at = t + 0.25 + i * 0.08
    for (const [mult, peak] of [
      [1, 0.24],
      [2, 0.05],
    ]) {
      const o = ac.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * mult
      o.connect(env(ac, at, peak, 2.2, 0.02)).connect(out)
      o.start(at)
      o.stop(at + 2.3)
    }
  })
}
