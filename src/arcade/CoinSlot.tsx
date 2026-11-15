import { Coins } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { COIN_SOUND_S, coinInsert, unlockArcadeAudio } from './audio'
import { DAILY_COINS, useArcade, useCoinsLeft } from './store'
import './arcade.css'

// «Insertar moneda»: cada día hay 5 monedas gratis y cada una abre una partida. Al tocar el botón la moneda cae girando por la ranura
// (con su sonido) y, al terminar, empieza el juego. Sin monedas, se avisa que mañana habrá nuevas.

export function CoinSlot({ onStart }: { onStart: () => void }) {
  const left = useCoinsLeft()
  const [state, setState] = useState<'idle' | 'drop'>('idle')
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const insert = () => {
    if (state !== 'idle') return
    unlockArcadeAudio()
    if (!useArcade.getState().spendCoin()) return
    coinInsert()
    setState('drop')
    timer.current = window.setTimeout(() => {
      setState('idle')
      onStart()
    }, (reduce ? 0.5 : COIN_SOUND_S + 0.1) * 1000)
  }

  return (
    <div className="mx-auto flex w-full max-w-[300px] flex-col items-center gap-3" aria-live="polite">
      {/* monedas del día */}
      {!Number.isFinite(left) ? (
        <p className="font-arcade flex items-center gap-2 border-[3px] border-[#07031a] bg-[#ffd400] px-3 py-1.5 text-[10px] text-[#07031a] shadow-[3px_3px_0_#ff2bd6]">
          <span className="text-[16px] leading-none">∞</span> MONEDAS · ADMIN
        </p>
      ) : (
      <div className="flex items-center gap-1.5" role="img" aria-label={`Te quedan ${left} de ${DAILY_COINS} monedas hoy`}>
        {Array.from({ length: DAILY_COINS }, (_, i) => (
          <span key={i} className={`grid size-6 place-items-center rounded-full border-2 text-[10px] font-black ${i < left ? 'border-[#07031a] bg-[#ffd400] text-[#7a4a00]' : 'border-[#3a2a70] bg-[#1a0f45] text-transparent'}`}>
            ★
          </span>
        ))}
      </div>
      )}
      {/* ranura con la moneda que cae */}
      <div className="coin-machine relative flex h-[84px] w-[120px] items-end justify-center overflow-hidden">
        <div className={`coin-slot ${state === 'drop' ? 'coin-slot-on' : ''}`} aria-hidden />
        {state === 'drop' && <span className={`coin ${reduce ? 'coin-static' : ''}`} aria-hidden>★</span>}
      </div>
      {left > 0 ? (
        <button onClick={insert} disabled={state !== 'idle'} autoFocus className="arcade-btn font-arcade flex min-h-14 items-center gap-3 px-7 text-[12px] disabled:opacity-80">
          <Coins className="size-5" /> {state === 'drop' ? '¡MONEDA!' : 'INSERTAR MONEDA'}
        </button>
      ) : (
        <p className="font-arcade max-w-[250px] text-center text-[9px] leading-relaxed text-[#ff9aa6]">SIN MONEDAS POR HOY. MAÑANA TENDRÁS {DAILY_COINS} NUEVAS.</p>
      )}
      <p className="text-[11.5px] text-[#9fb3ff]">{Number.isFinite(left) ? `Cada moneda es una partida. Hoy: ${left} de ${DAILY_COINS}.` : 'Cuenta de administrador: partidas ilimitadas para probar.'}</p>
    </div>
  )
}
