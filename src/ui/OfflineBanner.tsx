import { AnimatePresence, motion } from 'framer-motion'
import { Gamepad2, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useArcadeUi } from '../arcade/store'
import { useOnline } from '../lib/online'

/**
 * Aviso de «Sin conexión»: una cápsula pequeña sobre la barra de abajo. Sin internet la app sigue abriendo (service worker) y el Arcade se
 * puede jugar igual: la cápsula lo ofrece. Al volver la conexión, avisa un par de segundos y se va. Con el Arcade abierto no estorba.
 */
export function OfflineBanner() {
  const online = useOnline()
  const arcadeOpen = useArcadeUi((s) => s.open)
  const [back, setBack] = useState(false)
  const wasOffline = useRef(!online)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      setBack(false)
      return
    }
    if (!wasOffline.current) return
    wasOffline.current = false
    setBack(true)
    const t = window.setTimeout(() => setBack(false), 2600)
    return () => clearTimeout(t)
  }, [online])

  const show = (!online || back) && !arcadeOpen
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={online ? 'back' : 'off'}
          role="status"
          aria-live="polite"
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 14, opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--chrome-bottom)+10px)] z-[44] flex justify-center px-3"
        >
          {online ? (
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-teal px-3.5 py-2 text-[13px] font-semibold text-white shadow-[var(--shadow-float)]">
              <Wifi className="size-4" strokeWidth={2} />
              Conexión recuperada
            </div>
          ) : (
            <div className="glass-strong pointer-events-auto flex max-w-[min(420px,100%)] items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3.5 text-[13px] font-semibold text-ink">
              <WifiOff className="size-4 shrink-0 text-ink-soft" strokeWidth={2} />
              <span className="min-w-0 truncate">Sin conexión</span>
              <button
                onClick={() => useArcadeUi.getState().setOpen(true)}
                className="touch-hit relative flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#0b1448] px-3 text-[12.5px] font-bold text-[#4de1ff] transition active:scale-95"
              >
                <Gamepad2 className="size-4" strokeWidth={2} />
                Jugar un rato
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
