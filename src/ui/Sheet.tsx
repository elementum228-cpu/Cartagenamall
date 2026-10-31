import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useIsDesktop } from '../lib/useMedia'

/**
 * Panel responsive: bottom sheet arrastrable en móvil, panel lateral en escritorio.
 * `modal` agrega fondo oscuro (detalle de producto). En móvil el panel ocupa casi toda la pantalla (86 %) y
 * difumina todo lo de atrás (barra superior y mundo 3D); tocar el fondo lo cierra. En escritorio,
 * sin `modal`, el mundo sigue usable a la izquierda del panel.
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
          {(modal || !desktop) && (
            <motion.div
              className={`fixed inset-0 ${modal ? 'bg-deep/40 backdrop-blur-[4px]' : 'bg-deep/20 backdrop-blur-[8px]'}`}
              style={{ zIndex: z }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              // en móvil el difuminado llega un instante después: se alcanza a ver el «zoom y vuelta» al local
              transition={modal ? undefined : { duration: 0.5, delay: 0.55 }}
              onClick={onClose}
            />
          )}
          <motion.section
            role="dialog"
            aria-modal={modal}
            aria-label={title}
            className={
              desktop
                ? 'glass-sheet fixed top-[var(--chrome-top)] right-5 bottom-4 flex flex-col overflow-hidden rounded-[28px]'
                : `glass-sheet fixed inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[32px] ${modal ? 'max-h-[92dvh]' : 'h-[86dvh]'}`
            }
            style={{ zIndex: z + 1, width: desktop ? desktopWidth : undefined }}
            initial={desktop ? { x: desktopWidth + 40, opacity: 0.6 } : { y: '100%' }}
            animate={desktop ? { x: 0, opacity: 1 } : { y: 0 }}
            exit={desktop ? { x: desktopWidth + 40, opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 360 }}
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
