import { AnimatePresence, motion } from 'motion/react'
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { MallMark } from '../ui/MallMark'
import { installApp, isIOS, useInstall } from './install'

// Instalar la app: hoja con los pasos (iPhone) o el aviso del navegador (Android), un botón para los
// menús y una invitación discreta que aparece una sola vez después de un rato usando el mall.

const BANNER_KEY = 'cm:install-banner'
const BANNER_DELAY_MS = 45_000

/** Botón «Instalar la app» para menús y la página de cuenta. Se oculta si ya está instalada. */
export function InstallButton({ className, onDone }: { className: string; onDone?: () => void }) {
  const installed = useInstall((s) => s.installed)
  // la presentación privada no se puede instalar en el celular
  if (installed || import.meta.env.VITE_DEMO === '1') return null
  return (
    <button
      className={className}
      onClick={() => {
        onDone?.()
        void installApp()
      }}
    >
      <Download className="size-4" /> Instalar la app
    </button>
  )
}

/** Hoja con los pasos para instalar y la invitación que aparece una vez. Va una sola vez en la app. */
export function InstallLayer() {
  // la presentación privada no se puede instalar
  return import.meta.env.VITE_DEMO === '1' ? null : <InstallLayerInner />
}

function InstallLayerInner() {
  const sheet = useInstall((s) => s.sheet)
  const installed = useInstall((s) => s.installed)
  const deferred = useInstall((s) => s.deferred)
  const [banner, setBanner] = useState(false)

  // invitación única: en celular, si no está instalada, tras un rato explorando
  useEffect(() => {
    if (installed) return
    let seen = false
    try {
      seen = localStorage.getItem(BANNER_KEY) === '1'
    } catch {
      /* sin almacenamiento: se invita igual */
    }
    if (seen || !window.matchMedia('(max-width: 767px)').matches) return
    const t = window.setTimeout(() => setBanner(true), BANNER_DELAY_MS)
    return () => clearTimeout(t)
  }, [installed])

  const dismissBanner = () => {
    setBanner(false)
    try {
      localStorage.setItem(BANNER_KEY, '1')
    } catch {
      /* nada */
    }
  }
  const close = () => useInstall.getState().openSheet(false)
  const ios = isIOS()

  return (
    <>
      <AnimatePresence>
        {banner && !installed && !sheet && (
          <motion.div
            className="glass-strong fixed inset-x-3 top-[calc(var(--chrome-top)+8px)] z-[45] flex items-center gap-3 rounded-[24px] p-2.5 pl-3"
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            role="dialog"
            aria-label="Instalar MallPlay"
          >
            <MallMark size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-tight font-semibold">Lleva el mall en tu celular</p>
              <p className="text-[12px] text-ink-soft">Ábrelo desde tu pantalla de inicio, como una app.</p>
            </div>
            <button
              className="glass-teal shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold"
              onClick={() => {
                dismissBanner()
                void installApp()
              }}
            >
              Instalar
            </button>
            <button className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft" onClick={dismissBanner} aria-label="Ahora no">
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-deep/35 p-3 backdrop-blur-[6px] md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
            <motion.div
              role="dialog"
              aria-modal
              aria-label="Instalar la app en tu celular"
              onClick={(e) => e.stopPropagation()}
              className="glass-strong relative w-full max-w-[420px] rounded-[32px] p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
              initial={{ y: 60, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            >
              <button onClick={close} className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-ink/[0.06] text-ink-soft" aria-label="Cerrar">
                <X className="size-4" />
              </button>
              <div className="flex flex-col items-center text-center">
                <motion.div initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.05 }}>
                  <MallMark size={72} />
                </motion.div>
                <h2 className="mt-3 text-[22px] font-bold tracking-[-0.02em]">Instala MallPlay</h2>
                <p className="mt-1 text-[14px] text-ink-soft">Ábrelo desde tu pantalla de inicio, a pantalla completa y más rápido.</p>
              </div>

              {deferred ? (
                <button className="glass-teal mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold" onClick={() => void installApp()}>
                  <Download className="size-5" /> Instalar ahora
                </button>
              ) : ios ? (
                <ol className="mt-5 space-y-2.5">
                  <Step n={1} icon={<Share className="size-5" />}>
                    Toca <b className="font-semibold">Compartir</b> en la barra de Safari (el cuadrado con la flecha).
                  </Step>
                  <Step n={2} icon={<PlusSquare className="size-5" />}>
                    Desliza y elige <b className="font-semibold">Agregar a inicio</b>.
                  </Step>
                  <Step n={3} icon={<Smartphone className="size-5" />}>
                    Toca <b className="font-semibold">Agregar</b>: el ícono del mall queda en tu pantalla.
                  </Step>
                </ol>
              ) : (
                <ol className="mt-5 space-y-2.5">
                  <Step n={1} icon={<Share className="size-5" />}>
                    Abre el menú del navegador (<b className="font-semibold">⋮</b> o Compartir).
                  </Step>
                  <Step n={2} icon={<PlusSquare className="size-5" />}>
                    Elige <b className="font-semibold">Instalar app</b> o <b className="font-semibold">Agregar a pantalla de inicio</b>.
                  </Step>
                </ol>
              )}
              {ios && <p className="mt-3 text-center text-[11.5px] text-ink-soft">En iPhone se instala desde Safari.</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <motion.li
      className="flex items-center gap-3 rounded-[20px] bg-ink/[0.04] p-3 text-left text-[14px] leading-snug"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30, delay: 0.08 + n * 0.06 }}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-teal/10 text-teal">{icon}</span>
      <span>{children}</span>
    </motion.li>
  )
}
