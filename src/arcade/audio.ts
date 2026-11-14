// Música y efectos de «Nave Caribe», sintetizados con WebAudio (sin archivos de audio: no pesan nada y no hay nada que descargar).
// La música es una melodía corta en bucle (arpegio, bajo, bombo y platillo) que se programa unos milisegundos por delante; los efectos
// son pitidos de una fracción de segundo. Todo se puede apagar (ver `useArcade.sound`). El navegador solo deja sonar tras un toque de la
// persona, por eso `unlockArcadeAudio()` se llama desde el botón «Jugar».

let ac: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let timer = 0
let nextAt = 0
let step = 0
let on = true

const STEP_S = 60 / 132 / 4 // semicorchea a 132 BPM
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

// Do menor → La♭ → Mi♭ → Si♭ (cuatro compases de 16 pasos)
const CHORDS: number[][] = [
  [60, 63, 67, 72],
  [56, 60, 63, 68],
  [63, 67, 70, 75],
  [58, 62, 65, 70],
]
const ROOTS = [36, 32, 39, 34]
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2]
const BASS_STEPS = new Set([0, 3, 6, 8, 11, 14])

function context(): AudioContext | null {
  if (ac) return ac
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ac = new AC()
    master = ac.createGain()
    master.gain.value = 0.9
    master.connect(ac.destination)
    musicBus = ac.createGain()
    musicBus.gain.value = 0.5
    musicBus.connect(master)
    sfxBus = ac.createGain()
    sfxBus.gain.value = 0.55
    sfxBus.connect(master)
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.12), ac.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  } catch {
    ac = null
  }
  return ac
}

/** Debe llamarse dentro de un toque de la persona (p. ej. el botón «Jugar»): activa el audio del navegador. */
export function unlockArcadeAudio() {
  const c = context()
  if (c && c.state === 'suspended') void c.resume()
}

export function setArcadeSound(enabled: boolean) {
  on = enabled
  if (!enabled) stopMusic()
}

function tone(type: OscillatorType, freq: number, at: number, peak: number, decay: number, bus: GainNode, glideTo?: number) {
  if (!ac) return
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + decay)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  o.connect(g).connect(bus)
  o.start(at)
  o.stop(at + decay + 0.03)
}

function hat(at: number, peak: number) {
  if (!ac || !noiseBuf || !musicBus) return
  const s = ac.createBufferSource()
  const f = ac.createBiquadFilter()
  const g = ac.createGain()
  s.buffer = noiseBuf
  f.type = 'highpass'
  f.frequency.value = 7000
  g.gain.setValueAtTime(peak, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
  s.connect(f).connect(g).connect(musicBus)
  s.start(at)
  s.stop(at + 0.06)
}

function scheduleStep(i: number, at: number) {
  if (!musicBus) return
  const bar = Math.floor(i / 16) % 4
  const s = i % 16
  const chord = CHORDS[bar]
  // arpegio (cuadrada, corto) y, cada dos compases, una octava arriba para dar variedad
  const note = chord[ARP[s]] + (Math.floor(i / 32) % 2 ? 12 : 0)
  tone('square', midi(note), at, 0.085, 0.11, musicBus)
  if (BASS_STEPS.has(s)) tone('triangle', midi(ROOTS[bar]), at, 0.26, 0.2, musicBus)
  if (s % 4 === 0) tone('sine', 130, at, 0.34, 0.12, musicBus, 42)
  if (s % 4 === 2) hat(at, 0.07)
}

/** Empieza (o reanuda) la música en bucle. No hace nada si el sonido está apagado. */
export function startMusic() {
  const c = context()
  if (!c || !on || timer) return
  if (c.state === 'suspended') void c.resume()
  if (master) {
    master.gain.cancelScheduledValues(c.currentTime)
    master.gain.setValueAtTime(master.gain.value, c.currentTime)
    master.gain.linearRampToValueAtTime(0.9, c.currentTime + 0.15)
  }
  nextAt = c.currentTime + 0.08
  timer = window.setInterval(() => {
    if (!ac) return
    while (nextAt < ac.currentTime + 0.18) {
      scheduleStep(step, nextAt)
      step = (step + 1) % 64
      nextAt += STEP_S
    }
  }, 40)
}

/** Detiene la música (con un apagado suave). */
export function stopMusic() {
  if (timer) {
    window.clearInterval(timer)
    timer = 0
  }
  step = 0
  if (ac && master) {
    master.gain.cancelScheduledValues(ac.currentTime)
    master.gain.setValueAtTime(master.gain.value, ac.currentTime)
    master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.12)
  }
}

/** Pausa del juego o pestaña oculta: se congela todo el audio (no gasta nada). */
export function suspendArcadeAudio() {
  if (timer) {
    window.clearInterval(timer)
    timer = 0
  }
  if (ac && ac.state === 'running') void ac.suspend()
}

export type Sfx = 'pop' | 'power' | 'hurt' | 'over' | 'record'

/** Efectos cortos: destruir un enemigo, recoger un premio, recibir un golpe, fin de la partida y récord. */
export function sfx(kind: Sfx) {
  const c = context()
  if (!c || !on || !sfxBus) return
  if (c.state === 'suspended') return
  const t = c.currentTime
  if (kind === 'pop') tone('triangle', 520, t, 0.3, 0.1, sfxBus, 980)
  else if (kind === 'power') [660, 880, 1320].forEach((f, i) => tone('square', f, t + i * 0.055, 0.2, 0.12, sfxBus!))
  else if (kind === 'hurt') {
    tone('sawtooth', 240, t, 0.35, 0.28, sfxBus, 70)
    hat(t, 0.25)
  } else if (kind === 'over') [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, t + i * 0.13, 0.32, 0.22, sfxBus!))
  else [523, 659, 784, 1046].forEach((f, i) => tone('square', f, t + i * 0.08, 0.2, 0.16, sfxBus!))
}
