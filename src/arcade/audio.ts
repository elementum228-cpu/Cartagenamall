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

const MUSIC_LEVEL = 0.5
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
    musicBus.gain.value = MUSIC_LEVEL
    musicBus.connect(master)
    sfxBus = ac.createGain()
    sfxBus.gain.value = 0.85
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
  playbackMode()
  if (c && c.state === 'suspended') void c.resume()
}

let silentEl: HTMLAudioElement | null = null
/**
 * En el iPhone el audio del navegador se calla con el interruptor de silencio. Para que el arcade suene igual (es un juego: se espera
 * oírlo), se pide al sistema la categoría de «reproducción» (iOS 17+) y, como respaldo, se mantiene un audio silencioso en marcha,
 * que hace lo mismo en versiones anteriores.
 */
function playbackMode() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
    if (!silentEl && typeof Audio !== 'undefined') {
      // 0,1 s de silencio (WAV mono de 8 kHz)
      silentEl = new Audio('data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgICA')
      silentEl.loop = true
      silentEl.volume = 0.01
      silentEl.setAttribute('playsinline', '')
    }
    void silentEl?.play().catch(() => {})
  } catch {
    /* sin soporte: el audio sigue funcionando donde no hay interruptor de silencio */
  }
}

/**
 * Ejecuta `fn` cuando el audio ya está sonando. En el celular el audio nace «suspendido» y `resume()` tarda un instante: si se
 * programaran los sonidos antes, se perderían (por eso al insertar la moneda no se oía nada).
 */
function whenRunning(fn: (c: AudioContext) => void) {
  const c = context()
  if (!c) return
  if (c.state === 'running') fn(c)
  else
    void c
      .resume()
      .then(() => {
        if (c.state === 'running') fn(c)
      })
      .catch(() => {})
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

/** Chasquido corto de ruido (la cabeza de la impresora al marcar el papel). */
function click(at: number, peak: number) {
  if (!ac || !noiseBuf || !sfxBus) return
  const s = ac.createBufferSource()
  const f = ac.createBiquadFilter()
  const g = ac.createGain()
  s.buffer = noiseBuf
  f.type = 'bandpass'
  f.frequency.value = 2600
  g.gain.setValueAtTime(peak, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03)
  s.connect(f).connect(g).connect(sfxBus)
  s.start(at)
  s.stop(at + 0.04)
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
  // el volumen general nunca se baja (los efectos pasan por ahí); solo se sube/baja el de la música
  if (musicBus) {
    musicBus.gain.cancelScheduledValues(c.currentTime)
    musicBus.gain.setValueAtTime(Math.max(musicBus.gain.value, 0.0001), c.currentTime)
    musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, c.currentTime + 0.15)
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
  // Solo se apaga la música. Antes se bajaba el volumen general y los sonidos de después (recibo de tiquetes, timbre final) quedaban mudos.
  if (ac && musicBus) {
    musicBus.gain.cancelScheduledValues(ac.currentTime)
    musicBus.gain.setValueAtTime(musicBus.gain.value, ac.currentTime)
    musicBus.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.12)
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

/**
 * Sonido de «recibir tiquetes»: una tirita de papel saliendo de la máquina, como en las ferias (clics rápidos de la impresora y un
 * golpecito mecánico por cada paso), y un timbre al final al arrancarla. Devuelve cuánto dura (segundos) para sincronizar la animación.
 */
/**
 * Sonido de insertar una moneda: el «ting» al caer en la ranura, el rodar metálico por dentro, el golpe mecánico y el arpegio de
 * «listo». Devuelve cuánto dura (segundos) para sincronizar la animación.
 */
export const COIN_SOUND_S = 1.05
export function coinInsert(): number {
  if (!on) return COIN_SOUND_S
  whenRunning(playCoin)
  return COIN_SOUND_S
}

function playCoin(c: AudioContext) {
  if (!sfxBus) return
  const t = c.currentTime + 0.02
  tone('sine', 3136, t + 0.28, 0.3, 0.3, sfxBus) // ting al entrar en la ranura
  tone('sine', 4186, t + 0.3, 0.25, 0.14, sfxBus)
  for (let i = 0; i < 7; i++) tone('square', 1500 - i * 110, t + 0.38 + i * 0.035, 0.22, 0.05, sfxBus) // rueda por dentro
  tone('sawtooth', 120, t + 0.66, 0.3, 0.3, sfxBus, 48) // golpe del mecanismo
  ;[784, 988, 1319].forEach((f, i) => tone('square', f, t + 0.78 + i * 0.07, 0.3, 0.14, sfxBus!))
}

/** Cuánto dura la tirita al salir (segundos): más tiquetes, un poco más larga. */
/** Fanfarria de «¡ganaste un premio!»: arpegio ascendente, acorde final y destellos agudos. */
export function celebrate() {
  if (!on) return
  whenRunning((c) => {
    if (!sfxBus) return
    const t = c.currentTime + 0.03
    ;[523, 659, 784, 1047].forEach((f, i) => tone('square', f, t + i * 0.1, 0.22, 0.22, sfxBus!))
    ;[784, 988, 1175, 1568].forEach((f) => tone('triangle', f, t + 0.46, 0.3, 0.9, sfxBus!))
    for (let i = 0; i < 7; i++) tone('sine', 2093 + i * 260, t + 0.55 + i * 0.07, 0.14, 0.25, sfxBus!)
  })
}

/** Cada cuántos segundos sale un tiquete: más tiquetes, más rápido (pero todos se ven y se oyen). */
export const ticketInterval = (count: number) => Math.min(0.2, Math.max(0.06, 2.4 / Math.max(1, count)))
/** Cuánto tarda en salir toda la tanda (segundos). */
export const ticketDuration = (count: number) => count * ticketInterval(count)

/**
 * Sonido de «recibir tiquetes», como en las ferias: por cada tiquete que sale, el «tz» de la impresora y su golpecito mecánico, cada vez
 * un poco más agudo, un «ding» cada cinco y, al final, un arpegio de celebración. Va al ritmo exacto de la animación.
 */
export function ticketPrint(count: number): number {
  const dur = ticketDuration(count)
  if (!on || count < 1) return dur
  whenRunning((c) => playPrint(c, count))
  return dur
}

function playPrint(c: AudioContext, count: number) {
  if (!sfxBus) return
  const gap = ticketInterval(count)
  const t = c.currentTime + 0.12
  // (tone: tipo, frecuencia, momento, VOLUMEN, duración)
  for (let i = 0; i < count; i++) {
    const at = t + i * gap
    const rise = 1 + Math.min(0.5, i * 0.012)
    tone('square', 1000 * rise + ((i * 37) % 5) * 60, at, 0.2, 0.04, sfxBus) // el «tz» de la impresora
    tone('sawtooth', 200, at, 0.22, 0.035, sfxBus, 80) // el golpecito del rodillo
    click(at, 0.4)
    if ((i + 1) % 5 === 0) tone('sine', 1568 * rise, at + 0.01, 0.16, 0.18, sfxBus) // «ding» cada cinco
  }
  const end = t + count * gap + 0.05
  ;[784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, end + i * 0.08, 0.3, 0.45, sfxBus!)) // celebración
  tone('sine', 2093, end + 0.32, 0.16, 0.5, sfxBus)
}

export type Sfx = 'pop' | 'power' | 'hurt' | 'over' | 'record' | 'coin'

/** Efectos cortos: destruir un enemigo, recoger un premio, recibir un golpe, fin de la partida y récord. */
export function sfx(kind: Sfx) {
  if (!on) return
  whenRunning(() => playSfx(kind))
}

function playSfx(kind: Sfx) {
  const c = ac
  if (!c || !sfxBus) return
  const t = c.currentTime
  if (kind === 'coin') [988, 1319].forEach((f, i) => tone('square', f, t + i * 0.07, 0.22, i ? 0.32 : 0.09, sfxBus!))
  else if (kind === 'pop') tone('triangle', 520, t, 0.3, 0.1, sfxBus, 980)
  else if (kind === 'power') [660, 880, 1320].forEach((f, i) => tone('square', f, t + i * 0.055, 0.2, 0.12, sfxBus!))
  else if (kind === 'hurt') {
    tone('sawtooth', 240, t, 0.35, 0.28, sfxBus, 70)
    hat(t, 0.25)
  } else if (kind === 'over') [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, t + i * 0.13, 0.32, 0.22, sfxBus!))
  else [523, 659, 784, 1046].forEach((f, i) => tone('square', f, t + i * 0.08, 0.2, 0.16, sfxBus!))
}
