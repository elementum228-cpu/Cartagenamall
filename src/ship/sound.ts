import { soundReady } from '../lib/doorSound'

/**
 * Pito del barco de los descuentos: dos bocinazos graves (uno corto y otro largo), como las
 * sirenas de los barcos, con un poco de aire y eco del puerto. Sintetizado, sin archivos.
 */
export async function playShipHorn() {
  const r = await soundReady()
  if (!r) return
  const { ac, out, t } = r
  const echo = ac.createDelay(0.6)
  echo.delayTime.value = 0.28
  const fb = ac.createGain()
  fb.gain.value = 0.28
  const wet = ac.createGain()
  wet.gain.value = 0.35
  echo.connect(fb).connect(echo)
  echo.connect(wet).connect(out)
  const horn = (at: number, dur: number, base: number) => {
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.5, at + 0.07)
    g.gain.setValueAtTime(0.5, at + dur - 0.18)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.25)
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    lp.Q.value = 1.2
    // tres voces desafinadas apenas (bocina de dos tubos): quinta y octava dan el cuerpo
    for (const [mult, level, type] of [
      [1, 0.5, 'sawtooth'],
      [1.5, 0.3, 'sawtooth'],
      [2, 0.2, 'square'],
    ] as const) {
      const o = ac.createOscillator()
      o.type = type
      o.frequency.setValueAtTime(base * mult * 1.03, at)
      o.frequency.exponentialRampToValueAtTime(base * mult, at + 0.12) // arranca un poco arriba y asienta
      const vg = ac.createGain()
      vg.gain.value = level
      o.connect(vg).connect(lp)
      o.start(at)
      o.stop(at + dur + 0.3)
    }
    lp.connect(g)
    g.connect(out)
    g.connect(echo)
  }
  horn(t, 0.55, 110) // corto
  horn(t + 0.85, 1.5, 98) // largo y más grave
}
