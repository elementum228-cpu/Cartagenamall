import { motion } from 'motion/react'
import { ArrowRight, KeyRound, Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { DoorIntro } from '../features/DoorIntro'
import { ExploreView } from '../features/ExploreView'
import { GuidedTour } from '../features/GuidedTour'
import { SpaceSheet } from '../features/SpaceSheet'
import { StoreSheet } from '../features/StoreSheet'
import { MallMark } from '../ui/MallMark'
import { Toasts } from '../ui/Toasts'
import { enterDemo, pendingCode, type DemoAccess } from './access'

// Versión de prueba: solo el mall 3D y las fichas de tiendas de ejemplo, detrás de un código de
// invitación. Cada pantalla lleva el nombre del invitado como marca de agua.

const REASON: Record<Exclude<DemoAccess, { ok: true }>['reason'], string> = {
  invalid: 'Ese código no es válido o fue anulado.',
  expired: 'Esta invitación ya venció.',
  full: 'Esta invitación ya se usó en el máximo de dispositivos.',
  offline: 'No pudimos verificar el código. Revisa tu conexión e inténtalo de nuevo.',
  none: 'Escribe tu código de invitación.',
}

export default function DemoApp() {
  const [access, setAccess] = useState<DemoAccess | null>(null)

  useEffect(() => {
    document.documentElement.classList.add('demo')
    const code = pendingCode()
    if (!code) return setAccess({ ok: false, reason: 'none' })
    void enterDemo(code).then(setAccess)
  }, [])

  if (!access) return <Splash />
  if (!access.ok) return <Gate initialError={access.reason === 'none' ? null : REASON[access.reason]} onEnter={setAccess} />
  return <DemoMall guest={access.name} />
}

function Splash() {
  return (
    <div className="world-sky fixed inset-0 grid place-items-center">
      <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
        <MallMark size={64} />
      </motion.div>
    </div>
  )
}

function Gate({ initialError, onEnter }: { initialError: string | null; onEnter: (a: DemoAccess) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const r = await enterDemo(code)
    setBusy(false)
    if (r.ok) onEnter(r)
    else setError(REASON[r.reason])
  }
  return (
    <div className="world-sky fixed inset-0 grid place-items-center overflow-y-auto p-4">
      <motion.form
        onSubmit={submit}
        className="glass-sheet w-full max-w-sm rounded-[32px] p-6 text-center"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="flex justify-center">
          <MallMark size={64} />
        </div>
        <p className="mt-3 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">Versión de prueba privada</p>
        <h1 className="mt-1 text-[24px] leading-tight font-bold tracking-[-0.02em]">Cartagena Mall</h1>
        <p className="mt-1 text-[14px] text-ink-soft">Entra con el código de invitación que te compartieron.</p>
        <label className="mt-5 flex items-center gap-2 rounded-2xl border border-line bg-white px-3.5 focus-within:border-teal focus-within:ring-4 focus-within:ring-teal/15">
          <KeyRound className="size-5 shrink-0 text-ink-soft" />
          <input
            className="h-12 w-full bg-transparent font-mono text-[17px] tracking-[0.12em] uppercase outline-none placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError(null)
            }}
            placeholder="Código de invitación"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Código de invitación"
          />
        </label>
        {error && <p className="mt-2 text-[13px] font-semibold text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={busy || code.trim().length < 4} className="glass-teal mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold disabled:opacity-50">
          {busy ? 'Verificando…' : 'Entrar'} {!busy && <ArrowRight className="size-5" />}
        </button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-soft">
          <Lock className="size-3.5" /> Proyecto confidencial. No compartas tu código.
        </p>
      </motion.form>
    </div>
  )
}

function DemoMall({ guest }: { guest: string }) {
  return (
    <MemoryRouter>
      <div className="fixed inset-0">
        <main className="absolute inset-0">
          <ExploreView active />
        </main>
        <DemoTopBar />
        <StoreSheet />
        <SpaceSheet />
        <GuidedTour />
        <Toasts />
        <DoorIntro auto />
        <Watermark guest={guest} />
      </div>
    </MemoryRouter>
  )
}

function DemoTopBar() {
  return (
    <header className="tour-hide chrome-in-top pointer-events-none fixed inset-x-3 top-[max(10px,env(safe-area-inset-top))] z-30 flex h-14 items-center gap-2 md:inset-x-5 md:top-[max(12px,env(safe-area-inset-top))] md:h-[60px]">
      <span className="flex items-center gap-2.5">
        <MallMark size={40} />
        <span className="chrome-text text-[17px] font-bold tracking-[-0.01em]">Cartagena Mall</span>
      </span>
      <span className="glass ml-auto rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-ink">Versión de prueba</span>
    </header>
  )
}

/** Nombre del invitado repetido en diagonal, muy tenue: si circula una captura, se sabe de quién es. */
function Watermark({ guest }: { guest: string }) {
  const text = `${guest} · Cartagena Mall · Versión de prueba`
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden select-none" aria-hidden>
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-col justify-center gap-24">
        {Array.from({ length: 14 }, (_, i) => (
          <p key={i} className="text-[13px] font-semibold whitespace-nowrap text-[rgb(127_140_149/0.16)]" style={{ marginLeft: (i % 2) * 120 }}>
            {Array.from({ length: 8 }, () => text).join('      ')}
          </p>
        ))}
      </div>
    </div>
  )
}
