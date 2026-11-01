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

/** Un golpe de aldaba (cada toque en la puerta). */
export async function playKnockOnce(strength = 1) {
  const r = await ready()
  if (!r) return
  knockAt(r.ac, r.out, r.t, strength)
}

/** Ruido filtrado con una envolvente por tramos [tiempo, ganancia] (rampas suaves). */
function shapedNoise(ac: AudioContext, out: AudioNode, at: number, seconds: number, filter: BiquadFilterType, freq: [number, number], q: number, points: [number, number][]) {
  const src = noise(ac, seconds)
  const f = ac.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(freq[0], at)
  f.frequency.exponentialRampToValueAtTime(freq[1], at + seconds)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  for (const [t, v] of points) g.gain.linearRampToValueAtTime(v, at + t)
  src.connect(f).connect(g).connect(out)
  src.start(at)
  src.stop(at + seconds)
}

/**
 * Crujido de madera por fricción («stick-slip»): pulsos cortos cuyo ritmo sube y baja, pasados por
 * resonancias de madera. Suena a puerta vieja de verdad, no a un tono continuo.
 */
function woodCreak(ac: AudioContext, out: AudioNode, at: number, dur: number, level: number) {
  const sr = ac.sampleRate
  const buf = ac.createBuffer(1, Math.ceil(sr * dur), sr)
  const d = buf.getChannelData(0)
  let t = 0
  while (t < dur) {
    const p = t / dur
    // ritmo de los roces: arranca lento, se acelera a mitad de camino y vuelve a frenar
    const rate = 18 + 46 * Math.sin(Math.PI * p) + Math.random() * 10
    const amp = Math.sin(Math.PI * Math.min(1, p * 1.15)) * (0.6 + Math.random() * 0.4)
    const n = Math.floor(t * sr)
    for (let k = 0; k < 90 && n + k < d.length; k++) d[n + k] += amp * Math.exp(-k / 14) * (Math.random() * 2 - 1)
    t += 1 / rate
  }
  const src = ac.createBufferSource()
  src.buffer = buf
  const g = ac.createGain()
  g.gain.value = level
  // resonancias de una hoja de madera gruesa
  for (const [f, q, v] of [
    [420, 9, 1],
    [910, 11, 0.7],
    [1650, 8, 0.35],
  ]) {
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = q
    const bg = ac.createGain()
    bg.gain.value = v
    src.connect(bp).connect(bg).connect(g)
  }
  g.connect(out)
  src.start(at)
}

/**
 * La puerta abriéndose (~2,4 s, al ritmo de la animación): clic del pestillo, crujido suave de las
 * bisagras de madera, el aire que mueven las hojas pesadas y un tope suave al quedar abiertas.
 */
export async function playOpen() {
  const r = await ready()
  if (!r) return
  const { ac, out, t } = r
  // pestillo de hierro
  tone(ac, out, t, 'triangle', 2400, 1900, 0.18, 0.05)
  shapedNoise(ac, out, t, 0.06, 'bandpass', [3200, 2600], 3, [
    [0.002, 0.35],
    [0.05, 0],
  ])
  // crujido de las dos hojas (desfasadas, una un poco más grave)
  woodCreak(ac, out, t + 0.12, 1.5, 0.9)
  woodCreak(ac, out, t + 0.35, 1.3, 0.55)
  // aire y peso de la madera en movimiento
  shapedNoise(ac, out, t + 0.1, 2.4, 'lowpass', [220, 900], 0.7, [
    [0.6, 0.22],
    [1.6, 0.28],
    [2.3, 0],
  ])
  shapedNoise(ac, out, t + 0.1, 2.0, 'lowpass', [110, 160], 1, [
    [0.5, 0.25],
    [1.8, 0],
  ])
  // las hojas topan suave contra el muro
  knockAt(ac, out, t + 2.25, 0.35)
  knockAt(ac, out, t + 2.33, 0.25)
}

let welcome: { ac: AudioContext; gain: GainNode } | null = null

/**
 * Apaga la bienvenida con un desvanecimiento suave (curva natural, como bajar una perilla): al
 * aparecer el mall o, rápido, al volver a la puerta.
 */
export function stopCartagena(seconds = 2.4) {
  if (!welcome) return
  const { ac, gain } = welcome
  const now = ac.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now)
  gain.gain.setTargetAtTime(0, now, seconds / 4)
  welcome = null
}

/** Sala con eco suave (respuesta al impulso sintética): da la sensación de un vestíbulo amplio. */
function hall(ac: AudioContext, seconds = 2.6) {
  const len = Math.ceil(ac.sampleRate * seconds)
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
  }
  const conv = ac.createConvolver()
  conv.buffer = buf
  return conv
}

/** Voz de colchón (pad): dos osciladores suaves apenas desafinados, filtro cálido y entrada lenta. */
function padVoice(ac: AudioContext, out: AudioNode, at: number, freq: number, level: number, attack: number, hold: number) {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.linearRampToValueAtTime(level, at + attack)
  g.gain.setValueAtTime(level, at + hold)
  g.gain.setTargetAtTime(0.0001, at + hold, 0.9)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 0.4
  lp.frequency.setValueAtTime(600, at)
  lp.frequency.linearRampToValueAtTime(1500, at + attack + 1)
  lp.connect(g).connect(out)
  for (const [type, cents] of [
    ['triangle', -5],
    ['sine', 6],
  ] as [OscillatorType, number][]) {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = cents
    o.connect(lp)
    o.start(at)
    o.stop(at + hold + 5)
  }
}

/** Nota de piano eléctrico: fundamental redonda con un brillo leve que se apaga primero. */
function keys(ac: AudioContext, out: AudioNode, at: number, freq: number, level: number, dur = 2.4) {
  for (const [m, v, d] of [
    [1, 1, dur],
    [2, 0.22, dur * 0.4],
    [3, 0.06, dur * 0.25],
  ]) {
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq * m
    o.connect(env(ac, at, level * v, d, 0.012)).connect(out)
    o.start(at)
    o.stop(at + d + 0.05)
  }
}

/**
 * Bienvenida al cruzar la puerta (~3 s), con aire de vestíbulo de centro comercial y no de juego:
 * un acorde cálido que crece despacio (Fa mayor con novena), cuatro notas tranquilas de piano
 * eléctrico, el murmullo lejano de gente y una brisa de mar, todo con eco de sala amplia.
 */
export async function playCartagena() {
  const r = await ready()
  if (!r) return
  const { ac, out, t } = r
  const mix = ac.createGain()
  // acompaña solo el cruce de la puerta: al aparecer el mall se desvanece despacio (stopCartagena)
  // y, por si acaso, a los 5,5 s ya no suena; no queda música de fondo.
  mix.gain.setValueAtTime(1, t)
  mix.gain.setValueAtTime(1, t + 3.2)
  mix.gain.linearRampToValueAtTime(0.0001, t + 5.5)
  mix.connect(out)
  welcome = { ac, gain: mix }

  // sala: mezcla directa + eco
  const dry = ac.createGain()
  dry.gain.value = 0.75
  const wet = ac.createGain()
  wet.gain.value = 0.45
  const room = hall(ac)
  dry.connect(mix)
  room.connect(wet).connect(mix)
  const music = ac.createGain()
  // las voces van suaves por separado; aquí se lleva el conjunto a un volumen que se oiga en el celular
  music.gain.value = 0.85
  music.connect(dry)
  music.connect(room)

  // acorde que crece (Fa – Do – La – Mi – Sol): elegante, sin melodía de juego
  for (const [f, v] of [
    [87.31, 0.12],
    [130.81, 0.1],
    [220, 0.07],
    [329.63, 0.055],
    [392, 0.045],
  ])
    padVoice(ac, music, t + 0.05, f, v, 1.1, 3.4)

  // piano eléctrico: cuatro notas espaciadas que suben y se quedan suspendidas
  const notes: [number, number][] = [
    [0.55, 440],
    [1.15, 523.25],
    [1.75, 659.25],
    [2.45, 783.99],
  ]
  for (const [d, f] of notes) keys(ac, music, t + d, f, 0.075, 2.6)

  // murmullo lejano de gente (vestíbulo) y una brisa de mar suave
  shapedNoise(ac, mix, t, 5, 'bandpass', [420, 520], 0.8, [
    [1.6, 0.07],
    [3.4, 0.065],
    [5, 0],
  ])
  shapedNoise(ac, mix, t + 0.2, 4.2, 'lowpass', [500, 900], 0.5, [
    [2, 0.09],
    [4.2, 0],
  ])
}

/** Soplo suave al pasar de un paso a otro del recorrido guiado. */
export async function playWhoosh() {
  const r = await ready()
  if (!r) return
  shapedNoise(r.ac, r.out, r.t, 0.7, 'bandpass', [500, 2600], 1.1, [
    [0.25, 0.16],
    [0.7, 0],
  ])
}

/** Final del recorrido y sellos: dos notas suaves de piano eléctrico (un «listo» sobrio). */
export async function playSparkle() {
  const r = await ready()
  if (!r) return
  keys(r.ac, r.out, r.t, 659.25, 0.07, 1.6)
  keys(r.ac, r.out, r.t + 0.12, 987.77, 0.05, 1.8)
}

/** Para otros sonidos de la app (aeropuerto): mismo contexto, salida y botón de silencio. */
export { ready as soundReady, noise as noiseSource }
