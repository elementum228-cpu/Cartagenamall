import { AnimatePresence, motion } from 'motion/react'
import { useUI } from '../state/ui'

export function Toasts() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[68px] z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ y: -16, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-float ${
              t.tone === 'error' ? 'bg-red-600 text-white' : t.tone === 'success' ? 'bg-brand text-white' : 'bg-ink text-white'
            }`}
          >
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
