// Mezcla del concierto: la canción que sube el administrador suena dentro del estadio, con eco de recinto y el
// ambiente de una hinchada emocionada (murmullo, aplausos y gritos de ánimo, sin cantar). El público se genera en
// el navegador con ruido filtrado: no hay archivos de sonido que descargar y nunca se repite igual.

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Ruido rosado (más natural que el blanco) de `seconds` segundos, en un buffer que puede repetirse. */
export function pinkNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  }
  return buf
}

/** Respuesta de eco de un recinto grande: ruido que se apaga poco a poco. */
export function hallImpulse(ctx: BaseAudioContext, seconds = 2.2, decay = 2.6): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

/** Murmullo continuo de la gente: ruido filtrado cuyo volumen sube y baja despacio y sigue la energía de la canción. */
export function createCrowdBed(ctx: BaseAudioContext, out: AudioNode) {
  const src = ctx.createBufferSource()
  src.buffer = pinkNoise(ctx, 4)
  src.loop = true
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 180
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 950
  bp.Q.value = 0.45
  const gain = ctx.createGain()
  gain.gain.value = 0.1
  // oleaje lento del público
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.11
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.035
  lfo.connect(lfoGain).connect(gain.gain)
  src.connect(hp).connect(bp).connect(gain).connect(out)
  src.start()
  lfo.start()
  return {
    /** Energía de la canción (0–1): el público se anima cuando suena fuerte. */
    setEnergy(e: number, level: number) {
      const t = (ctx as AudioContext).currentTime ?? 0
      gain.gain.setTargetAtTime((0.17 + 0.26 * e) * level, t, 0.25)
    },
    stop() {
      try {
        src.stop()
        lfo.stop()
      } catch {
        /* ya detenido */
      }
    },
  }
}

/** Un aplauso: ráfaga corta de ruido agudo. */
function clap(ctx: BaseAudioContext, out: AudioNode, at: number, peak: number, noise: AudioBuffer) {
  const s = ctx.createBufferSource()
  s.buffer = noise
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1400
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = rand(2000, 3400)
  bp.Q.value = 0.7
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(peak, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + rand(0.05, 0.09))
  const pan = ctx.createStereoPanner()
  pan.pan.value = rand(-0.8, 0.8)
  s.connect(hp).connect(bp).connect(g).connect(pan).connect(out)
  s.start(at, rand(0, 1.5))
  s.stop(at + 0.12)
}

/** Grito de ánimo: «uuuh» de mucha gente, ruido con formantes que sube rápido y se apaga despacio. */
function cheer(ctx: BaseAudioContext, out: AudioNode, at: number, peak: number, noise: AudioBuffer) {
  const s = ctx.createBufferSource()
  s.buffer = noise
  const f1 = ctx.createBiquadFilter()
  f1.type = 'bandpass'
  f1.Q.value = 1.3
  f1.frequency.setValueAtTime(rand(600, 760), at)
  f1.frequency.linearRampToValueAtTime(rand(820, 1000), at + 1.4)
  const f2 = ctx.createBiquadFilter()
  f2.type = 'bandpass'
  f2.Q.value = 1.0
  f2.frequency.value = rand(1250, 1700)
  const g = ctx.createGain()
  const dur = rand(1.6, 2.6)
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(peak, at + 0.35)
  g.gain.setValueAtTime(peak, at + 0.8)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  const pan = ctx.createStereoPanner()
  pan.pan.value = rand(-0.5, 0.5)
  const mix = ctx.createGain()
  s.connect(f1).connect(mix)
  s.connect(f2).connect(mix)
  mix.connect(g).connect(pan).connect(out)
  s.start(at, rand(0, 2))
  s.stop(at + dur + 0.1)
}

/**
 * Programa aplausos y gritos de ánimo entre `from` y `to` (segundos del reloj de audio). Los aplausos llegan en
 * tandas de entusiasmo; los gritos, cada tanto, con más fuerza si la canción va fuerte.
 */
export function scheduleBursts(ctx: BaseAudioContext, out: AudioNode, from: number, to: number, level: number, energy = 0.6) {
  const noise = pinkNoise(ctx, 2)
  let t = from + rand(0, 0.6)
  while (t < to) {
    // tanda de aplausos
    const n = Math.floor(rand(10, 24))
    const speed = rand(0.11, 0.17)
    for (let i = 0; i < n && t < to; i++, t += speed * rand(0.7, 1.3)) clap(ctx, out, t, rand(0.1, 0.22) * level * (0.6 + 0.6 * energy), noise)
    t += rand(0.8, 2.4)
    if (Math.random() < 0.55 && t < to) {
      cheer(ctx, out, t, rand(0.26, 0.42) * level * (0.5 + 0.8 * energy), noise)
      t += rand(1.2, 3)
    }
  }
}

/** Mezcla completa de concierto en tiempo real. */
export class ConcertMix {
  private ctx: AudioContext | null = null
  private song: HTMLAudioElement | null = null
  private timers: number[] = []
  private bed: ReturnType<typeof createCrowdBed> | null = null
  private crowdGain: GainNode | null = null
  private level = 0.8
  private master: GainNode | null = null
  private energy = 0.5

  /** Volumen del público (0–1), en vivo. */
  setCrowd(level: number) {
    this.level = Math.max(0, Math.min(1, level))
    if (this.crowdGain && this.ctx) this.crowdGain.gain.setTargetAtTime(this.level, this.ctx.currentTime, 0.2)
  }

  get playing() {
    return !!this.ctx
  }

  async start(url: string, crowd = 0.8) {
    if (this.ctx) return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    this.ctx = ctx
    await ctx.resume()
    const master = ctx.createGain()
    master.gain.value = 0
    master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.6)
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    master.connect(comp).connect(ctx.destination)
    this.master = master

    // la canción: seca y con eco de estadio
    const song = new Audio(url)
    song.crossOrigin = 'anonymous'
    song.loop = true
    this.song = song
    const songNode = ctx.createMediaElementSource(song)
    const songGain = ctx.createGain()
    songGain.gain.value = 0.95
    const reverb = ctx.createConvolver()
    reverb.buffer = hallImpulse(ctx)
    const wet = ctx.createGain()
    wet.gain.value = 0.22
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    songNode.connect(songGain)
    songGain.connect(master)
    songGain.connect(reverb).connect(wet).connect(master)
    songNode.connect(analyser)
    await song.play()

    // el público
    const crowd$ = ctx.createGain()
    this.crowdGain = crowd$
    crowd$.gain.value = Math.max(0, Math.min(1, crowd))
    this.level = crowd$.gain.value
    const crowdRev = ctx.createGain()
    crowdRev.gain.value = 0.5
    crowd$.connect(master)
    crowd$.connect(reverb)
    void crowdRev
    this.bed = createCrowdBed(ctx, crowd$)
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += Math.pow((buf[i] - 128) / 128, 2)
      const rms = Math.sqrt(sum / buf.length)
      this.energy = Math.min(1, rms * 3.2)
      this.bed?.setEnergy(this.energy, 1)
    }
    this.timers.push(window.setInterval(tick, 80))
    // aplausos y gritos se programan por tramos de 5 s, un poco por adelantado
    let scheduledTo = ctx.currentTime
    const plan = () => {
      if (!this.ctx) return
      const from = Math.max(scheduledTo, ctx.currentTime + 0.05)
      const to = ctx.currentTime + 6
      if (to > from) scheduleBursts(ctx, crowd$, from, to, 1, this.energy)
      scheduledTo = to
    }
    plan()
    this.timers.push(window.setInterval(plan, 4500))
  }

  stop() {
    const ctx = this.ctx
    if (!ctx) return
    this.timers.forEach((t) => window.clearInterval(t))
    this.timers = []
    if (this.master) this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.12)
    const song = this.song
    const bed = this.bed
    this.ctx = null
    this.song = null
    this.bed = null
    this.crowdGain = null
    this.master = null
    window.setTimeout(() => {
      song?.pause()
      bed?.stop()
      void ctx.close()
    }, 500)
  }
}
