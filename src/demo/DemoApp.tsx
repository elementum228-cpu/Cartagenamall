import { motion } from 'motion/react'
import { ArrowRight, KeyRound, Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { MallMark } from '../ui/MallMark'
import { enterDemo, pendingCode, type DemoAccess } from './access'
import { Landing } from './Landing'

// Presentación privada: una landing con lo que es el proyecto y un recorrido guiado con capturas, detrás
// de un código de invitación. No da acceso a la app. El nombre del invitado va como marca de agua.

const REASON: Record<Exclude<DemoAccess, { ok: true }>['reason'], string> = {
  invalid: 'Ese código no es válido o fue anulado.',
  expired: 'Esta invitación ya venció.',
  full: 'Esta invitación es personal y ya está abierta en otro dispositivo. Pídele a quien te la compartió una propia.',
  offline: 'No pudimos verificar el código. Revisa tu conexión e inténtalo de nuevo.',
  none: 'Escribe tu código de invitación.',
}

export default function DemoApp() {
  const [access, setAccess] = useState<DemoAccess | null>(null)

  useEffect(() => {
    const code = pendingCode()
    if (!code) return setAccess({ ok: false, reason: 'none' })
    void enterDemo(code).then(setAccess)
  }, [])

  if (!access) return <Splash />
  if (!access.ok) return <Gate initialError={access.reason === 'none' ? null : REASON[access.reason]} onEnter={setAccess} />
  return (
    <>
      <Landing guest={access.name} />
      <Watermark guest={access.name} />
    </>
  )
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
        <p className="mt-3 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">Presentación privada</p>
        <h1 className="mt-1 text-[24px] leading-tight font-bold tracking-[-0.02em]">MallPlay</h1>
        <p className="mt-1 text-[14px] text-ink-soft">Escribe el código de invitación que te compartieron para conocer el proyecto.</p>
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

/** Nombre del invitado repetido en diagonal, muy tenue: si circula una captura, se sabe de quién es. */
function Watermark({ guest }: { guest: string }) {
  const text = `${guest} · MallPlay · Vista privada`
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
