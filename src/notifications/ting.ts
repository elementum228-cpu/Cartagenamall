import { soundReady } from '../lib/doorSound'

/** «¡Ting!»: campanita corta y brillante. Con `twice` suena dos veces (pedido listo). */
export async function playTing(twice = false) {
  const r = await soundReady()
  if (!r) return
  const { ac, out, t } = r
  const ting = (at: number) => {
    for (const [f, level, dur] of [
      [1568, 0.34, 1.1],
      [2093, 0.2, 0.8],
      [3136, 0.07, 0.45],
    ] as const) {
      const o = ac.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ac.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(level, at + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      o.connect(g).connect(out)
      o.start(at)
      o.stop(at + dur + 0.05)
    }
  }
  ting(t)
  if (twice) ting(t + 0.34)
}
