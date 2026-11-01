import { noiseSource, soundReady } from '../lib/doorSound'

// Sonidos del aeropuerto (sintetizados, sin archivos): el «ding-dong» de llamado a la azafata y el
// motor del avión, que sube en el rodaje, ruge en la carrera de despegue y se aleja al elevarse.

/** Campana de cabina: dos tonos suaves (agudo y luego grave) con armónicos de campana. */
export async function playCabinChime() {
  const r = await soundReady()
  if (!r) return
  const { ac, out, t } = r
  const bell = (at: number, f: number) => {
    for (const [mult, level] of [
      [1, 0.32],
      [2.0, 0.1],
      [3.01, 0.05],
    ] as const) {
      const o = ac.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * mult
      const g = ac.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(level, at + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 2.2 / mult)
      o.connect(g).connect(out)
      o.start(at)
      o.stop(at + 2.4)
    }
  }
  bell(t, 1318.5) // Mi6
  bell(t + 0.62, 1046.5) // Do6
}

/**
 * Motor del despegue, sincronizado con la animación: `taxi` segundos rodando (zumbido bajo),
 * luego la carrera (rugido que sube de tono) hasta `total`, y se desvanece al alejarse.
 */
export async function playTakeoffEngine(taxi: number, total: number) {
  const r = await soundReady()
  if (!r) return
  const { ac, out, t } = r
  const end = t + total + 2.5
  // rugido: ruido filtrado que se abre
  const n = noiseSource(ac, total + 3)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 0.7
  lp.frequency.setValueAtTime(220, t)
  lp.frequency.linearRampToValueAtTime(320, t + taxi)
  lp.frequency.linearRampToValueAtTime(1600, t + taxi + 3)
  lp.frequency.linearRampToValueAtTime(900, end)
  const ng = ac.createGain()
  ng.gain.setValueAtTime(0.0001, t)
  ng.gain.exponentialRampToValueAtTime(0.12, t + 0.8)
  ng.gain.setValueAtTime(0.12, t + taxi)
  ng.gain.exponentialRampToValueAtTime(0.55, t + taxi + 2.2)
  ng.gain.setValueAtTime(0.55, t + total - 1.2)
  ng.gain.exponentialRampToValueAtTime(0.0001, end)
  n.connect(lp).connect(ng).connect(out)
  n.start(t)
  n.stop(end)
  // silbido de turbina: dos tonos que suben
  for (const [base, level] of [
    [420, 0.03],
    [633, 0.018],
  ] as const) {
    const o = ac.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(base, t)
    o.frequency.linearRampToValueAtTime(base * 1.15, t + taxi)
    o.frequency.exponentialRampToValueAtTime(base * 2.3, t + taxi + 3.5)
    o.frequency.linearRampToValueAtTime(base * 2.1, end)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(level, t + 1)
    g.gain.exponentialRampToValueAtTime(level * 2.2, t + taxi + 2.5)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(end)
  }
}

/**
 * Aterrizaje: motores en aproximación que van bajando, chirrido de llantas al tocar la pista y el
 * rugido de la reversa al frenar, que se apaga cuando el avión se detiene.
 */
export async function playLanding(total: number, touchdown: number) {
  const r = await soundReady()
  if (!r) return
  const { ac, out, t } = r
  const td = t + total * touchdown
  const end = t + total + 0.8
  // aproximación: ruido grave que se acerca
  const n = noiseSource(ac, total + 1.5)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(500, t)
  lp.frequency.linearRampToValueAtTime(800, td)
  lp.frequency.linearRampToValueAtTime(1700, td + 0.8) // reversa
  lp.frequency.linearRampToValueAtTime(300, end)
  const ng = ac.createGain()
  ng.gain.setValueAtTime(0.0001, t)
  ng.gain.exponentialRampToValueAtTime(0.18, t + 1.5)
  ng.gain.exponentialRampToValueAtTime(0.3, td)
  ng.gain.exponentialRampToValueAtTime(0.6, td + 0.9)
  ng.gain.exponentialRampToValueAtTime(0.0001, end)
  n.connect(lp).connect(ng).connect(out)
  n.start(t)
  n.stop(end)
  // silbido de turbina que baja de tono
  const o = ac.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(950, t)
  o.frequency.exponentialRampToValueAtTime(700, td)
  o.frequency.exponentialRampToValueAtTime(320, end)
  const og = ac.createGain()
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(0.035, t + 1.2)
  og.gain.exponentialRampToValueAtTime(0.0001, end)
  o.connect(og).connect(out)
  o.start(t)
  o.stop(end)
  // chirrido de llantas: dos toques cortos al tocar la pista
  for (const dt of [0, 0.18]) {
    const s = noiseSource(ac, 0.4)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2600
    bp.Q.value = 3
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, td + dt)
    g.gain.exponentialRampToValueAtTime(0.35, td + dt + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, td + dt + 0.3)
    s.connect(bp).connect(g).connect(out)
    s.start(td + dt)
    s.stop(td + dt + 0.4)
  }
  // golpe sordo del tren
  const k = ac.createOscillator()
  k.frequency.setValueAtTime(90, td)
  k.frequency.exponentialRampToValueAtTime(40, td + 0.25)
  const kg = ac.createGain()
  kg.gain.setValueAtTime(0.0001, td)
  kg.gain.exponentialRampToValueAtTime(0.4, td + 0.01)
  kg.gain.exponentialRampToValueAtTime(0.0001, td + 0.3)
  k.connect(kg).connect(out)
  k.start(td)
  k.stop(td + 0.35)
}
