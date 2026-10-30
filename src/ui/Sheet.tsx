import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useIsDesktop } from '../lib/useMedia'

/**
 * Panel responsive: bottom sheet arrastrable en móvil, panel lateral en escritorio.
 * `modal` agrega fondo oscuro (detalle de producto); sin él, el mundo 3D sigue usable detrás.
 */
export function Sheet({
  open,
  onClose,
  children,
  title,
  modal = false,
  z = 40,
  desktopWidth = 420,
  header,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title: string
  modal?: boolean
  z?: number
  desktopWidth?: number
  header?: ReactNode
}) {
  const desktop = useIsDesktop()
  const drag = useDragControls()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {modal && (
            <motion.div
              className="fixed inset-0 bg-ink/35 backdrop-blur-[2px]"
              style={{ zIndex: z }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
          )}
          <motion.section
            role="dialog"
            aria-modal={modal}
            aria-label={title}
            className={
              desktop
                ? 'fixed top-[72px] right-3 bottom-3 flex flex-col overflow-hidden rounded-3xl bg-card shadow-float'
                : `fixed inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[28px] bg-card shadow-float ${modal ? 'max-h-[90dvh]' : 'h-[60dvh]'}`
            }
            style={{ zIndex: z + 1, width: desktop ? desktopWidth : undefined }}
            initial={desktop ? { x: desktopWidth + 40, opacity: 0.6 } : { y: '100%' }}
            animate={desktop ? { x: 0, opacity: 1 } : { y: 0 }}
            exit={desktop ? { x: desktopWidth + 40, opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag={desktop ? false : 'y'}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
          >
            {!desktop && (
              <div className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1" onPointerDown={(e) => drag.start(e)}>
                <span className="h-1.5 w-11 rounded-full bg-ink/15" />
              </div>
            )}
            <div className="relative shrink-0" onPointerDown={(e) => !desktop && drag.start(e)}>
              {header}
              <button
                onClick={onClose}
                className="absolute top-2 right-3 grid size-10 place-items-center rounded-full bg-white/85 text-ink shadow-soft backdrop-blur transition hover:bg-white"
                aria-label="Cerrar"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe">{children}</div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}
