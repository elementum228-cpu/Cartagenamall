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

/** Cuerda punteada (Karplus-Strong): suena a tiple o guitarra, sin archivos de audio. */
function pluck(ac: AudioContext, out: AudioNode, at: number, freq: number, level: number, dur = 1.6, damp = 0.996) {
  const sr = ac.sampleRate
  const n = Math.ceil(sr * dur)
  const buf = ac.createBuffer(1, n, sr)
  const d = buf.getChannelData(0)
  const period = Math.max(2, Math.round(sr / freq))
  for (let i = 0; i < period; i++) d[i] = Math.random() * 2 - 1
  for (let i = period; i < n; i++) d[i] = damp * 0.5 * (d[i - period] + d[i - period - 1 >= 0 ? i - period - 1 : 0])
  const src = ac.createBufferSource()
  src.buffer = buf
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = Math.min(5000, freq * 6)
  const g = ac.createGain()
  g.gain.setValueAtTime(level, at)
  g.gain.setTargetAtTime(0, at + dur * 0.7, dur * 0.12)
  src.connect(lp).connect(g).connect(out)
  src.start(at)
}

/** Campana lejana (parciales inarmónicos), como las de la Catedral al fondo. */
function bell(ac: AudioContext, out: AudioNode, at: number, freq: number, level: number) {
  for (const [m, v, dec] of [
    [0.5, 0.5, 4],
    [1, 1, 3.2],
    [2.0, 0.45, 2.2],
    [2.76, 0.35, 1.6],
    [5.4, 0.15, 0.9],
  ]) {
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq * m
    o.connect(env(ac, at, level * v, dec, 0.01)).connect(out)
    o.start(at)
    o.stop(at + dec + 0.05)
  }
}

let welcome: { ac: AudioContext; gain: GainNode } | null = null

/** Apaga la bienvenida con un desvanecimiento corto (al aparecer el mall o al volver a la puerta). */
export function stopCartagena(seconds = 0.5) {
  if (!welcome) return
  const { ac, gain } = welcome
  const now = ac.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now)
  gain.gain.linearRampToValueAtTime(0.0001, now + seconds)
  welcome = null
}

/**
 * Bienvenida a Cartagena al cruzar la puerta (~3 s): el mar Caribe, una campana lejana y una
 * frase corta de cuerdas punteadas con bajo y guacharaca en ritmo de cumbia.
 */
export async function playCartagena() {
  const r = await ready()
  if (!r) return
  const { ac, out, t } = r
  const mix = ac.createGain()
  // acompaña solo el cruce de la puerta: se apaga al aparecer el mall (stopCartagena) y, por si
  // acaso, a los 3,4 s como máximo; no queda música de fondo.
  mix.gain.setValueAtTime(1, t)
  mix.gain.setValueAtTime(1, t + 2.9)
  mix.gain.linearRampToValueAtTime(0.0001, t + 3.4)
  mix.connect(out)
  welcome = { ac, gain: mix }

  // olas: dos marejadas suaves con espuma
  for (const [start, len] of [
    [0, 3.6],
    [2.8, 4],
  ]) {
    shapedNoise(ac, mix, t + start, len, 'lowpass', [380, 1400], 0.6, [
      [len * 0.45, 0.32],
      [len, 0],
    ])
    shapedNoise(ac, mix, t + start + len * 0.35, len * 0.6, 'highpass', [2500, 4200], 0.5, [
      [len * 0.15, 0.08],
      [len * 0.6, 0],
    ])
  }
  // campana lejana
  bell(ac, mix, t + 0.15, 392, 0.07)

  // cumbia en La mayor (~96 pulsos por minuto): bajo, guacharaca y melodía
  const beat = 60 / 96
  const s = t + 0.55
  const bass: [number, number][] = [
    [0, 110],
    [1, 82.41],
    [2, 110],
    [3, 82.41],
    [4, 146.83],
    [5, 110],
    [6, 164.81],
    [7, 110],
  ]
  for (const [b, f] of bass) pluck(ac, mix, s + b * beat, f, 0.42, 1.1, 0.993)
  // guacharaca: «chi-ki-chi» en corcheas, acento en el contratiempo
  for (let k = 0; k < 16; k++)
    shapedNoise(ac, mix, s + k * (beat / 2), 0.09, 'bandpass', [6500, 5200], 1.5, [
      [0.005, k % 2 ? 0.09 : 0.05],
      [0.08, 0],
    ])
  // melodía (do# = 554, mi = 659, fa# = 740, la = 880)
  const melody: [number, number, number][] = [
    [0.5, 659.25, 0.3],
    [1, 554.37, 0.26],
    [1.5, 659.25, 0.3],
    [2, 739.99, 0.32],
    [2.75, 659.25, 0.28],
    [3.5, 554.37, 0.26],
    [4, 587.33, 0.28],
    [4.5, 659.25, 0.3],
    [5, 739.99, 0.3],
    [5.5, 659.25, 0.28],
    [6, 554.37, 0.3],
    [7, 440, 0.34],
  ]
  for (const [b, f, v] of melody) pluck(ac, mix, s + b * beat, f, v * 0.9, 1.6)
}
