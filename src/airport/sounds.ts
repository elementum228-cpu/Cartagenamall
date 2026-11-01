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
