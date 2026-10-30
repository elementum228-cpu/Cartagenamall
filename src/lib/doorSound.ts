// Sonidos del portón de bienvenida, sintetizados con Web Audio (sin archivos): dos golpes de
// aldaba sobre madera, el crujido de las bisagras al abrir y un soplo con acorde cálido al cruzar.
// El contexto de audio se crea en el toque de la persona (los navegadores lo exigen).

const MUTE_KEY = 'cm:door-sound-off'
let ctx: AudioContext | null = null

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

function audio(): AudioContext | null {
  if (!doorSoundOn()) return null
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
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

/** Un golpe seco sobre madera gruesa: cuerpo grave + chasquido filtrado. */
function knockAt(ac: AudioContext, at: number, strength = 1) {
  const out = ac.destination
  const body = ac.createOscillator()
  body.type = 'sine'
  body.frequency.setValueAtTime(150, at)
  body.frequency.exponentialRampToValueAtTime(70, at + 0.12)
  const bodyGain = env(ac, at, 0.6 * strength, 0.18)
  body.connect(bodyGain).connect(out)
  body.start(at)
  body.stop(at + 0.2)

  const click = noise(ac, 0.12)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const clickGain = env(ac, at, 0.38 * strength, 0.08, 0.002)
  click.connect(lp).connect(clickGain).connect(out)
  click.start(at)
}

/** Dos golpes de aldaba (el segundo, un poco más suave). */
export function playKnock() {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + 0.01
  knockAt(ac, t)
  knockAt(ac, t + 0.24, 0.8)
}

/** Crujido de bisagras viejas mientras se abren las hojas (~1,4 s). */
export function playCreak() {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + 0.02
  const dur = 1.4
  const master = ac.createGain()
  master.gain.setValueAtTime(0.0001, t)
  master.gain.exponentialRampToValueAtTime(0.16, t + 0.15)
  master.gain.setValueAtTime(0.16, t + dur - 0.4)
  master.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(700, t)
  bp.frequency.linearRampToValueAtTime(1300, t + dur)
  bp.Q.value = 6
  master.connect(ac.destination)
  bp.connect(master)
  // dos «voces» de la bisagra, con el tono que tiembla de forma irregular
  for (const [base, gain] of [
    [78, 1],
    [121, 0.55],
  ]) {
    const o = ac.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(base, t)
    for (let k = 1; k <= 14; k++) o.frequency.linearRampToValueAtTime(base * (0.85 + Math.random() * 0.45) * (1 + k * 0.02), t + (k / 14) * dur)
    const g = ac.createGain()
    g.gain.value = gain
    o.connect(g).connect(bp)
    o.start(t)
    o.stop(t + dur)
  }
  // golpe suave de las hojas al terminar de abrir
  knockAt(ac, t + dur - 0.05, 0.35)
}

/** Soplo de aire y un acorde cálido al cruzar el umbral. */
export function playEnter() {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + 0.02
  const air = noise(ac, 1.4)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.8
  bp.frequency.setValueAtTime(300, t)
  bp.frequency.exponentialRampToValueAtTime(2600, t + 1.1)
  const airGain = ac.createGain()
  airGain.gain.setValueAtTime(0.0001, t)
  airGain.gain.exponentialRampToValueAtTime(0.12, t + 0.5)
  airGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.35)
  air.connect(bp).connect(airGain).connect(ac.destination)
  air.start(t)
  // acorde mayor (do–mi–sol–do), entrando nota por nota
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const at = t + 0.25 + i * 0.07
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = env(ac, at, 0.07, 2.2, 0.03)
    o.connect(g).connect(ac.destination)
    o.start(at)
    o.stop(at + 2.3)
  })
}
