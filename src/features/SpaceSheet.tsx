import { CheckCircle2, Clock, Store as StoreIcon } from 'lucide-react'
import { useState } from 'react'
import { CATEGORIES, FLOOR_BY_ID, SHOP_SPACE_TYPES, SPACE_BY_ID, SPACE_TYPES, ZONE_BY_ID } from '../config/mall'
import { COURT_COLOR } from '../football/open'
import { typePrice, useSpacePrice, useSpacePricing } from '../state/spacePricing'
import type { SpaceSlot, SpaceType } from '../domain/types'
import { formatCOP } from '../lib/format'
import { useCatalog } from '../state/catalog'
import { useClaims } from '../state/claims'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'
import { Sheet } from '../ui/Sheet'
import { SpacePreview } from './SpacePreview'
import { DEMO } from '../demo/flag'

/** Ficha de un local disponible, con el flujo para reclamarlo. */
export function SpaceSheet() {
  const selectedSpaceId = useUI((s) => (s.peek ? null : s.selectedSpaceId))
  const assignments = useCatalog((s) => s.assignments)
  const space = selectedSpaceId && !assignments[selectedSpaceId] ? SPACE_BY_ID[selectedSpaceId] : undefined
  return (
    <Sheet open={!!space} onClose={() => useUI.getState().selectSpace(null)} title="Espacio disponible" header={space && <Header space={space} />}>
      {space && <Body key={space.id} space={space} />}
    </Sheet>
  )
}

/** Color y ubicación legible del espacio (la cancha tiene los suyos). */
const spaceColor = (space: SpaceSlot) => (space.type === 'court' ? COURT_COLOR : ZONE_BY_ID[space.zoneId].color)
function placeName(space: SpaceSlot) {
  const zone = ZONE_BY_ID[space.zoneId]
  if (space.type === 'court') return `${FLOOR_BY_ID[space.floorId].name} · Jardín de la fortaleza`
  return `${FLOOR_BY_ID[space.floorId].name} · ${zone.id === 'E' ? zone.name : `Pasillo ${zone.id} · ${zone.name}`}`
}

function Header({ space }: { space: SpaceSlot }) {
  const color = spaceColor(space)
  return (
    <div className="px-5 pt-3 pb-2" style={{ background: `linear-gradient(180deg, ${color}18, transparent)` }}>
      <p className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color }}>
        {FLOOR_BY_ID[space.floorId].name} · {space.type === 'court' ? 'Cancha sintética' : `Espacio ${space.label}`} · disponible
      </p>
      <h2 className="mt-1 pr-12 text-2xl font-extrabold tracking-tight">{space.type === 'court' ? '¡Opera la cancha del mall!' : '¡Tu negocio podría estar aquí!'}</h2>
    </div>
  )
}

function Body({ space }: { space: SpaceSlot }) {
  const color = spaceColor(space)
  const info = SPACE_TYPES[space.type]
  const price = useSpacePrice(space.id)
  const pending = useClaims((s) => s.claims.filter((c) => c.spaceId === space.id && c.status === 'pending').length)
  const [step, setStep] = useState<'info' | 'form' | 'done'>('info')
  const [requestId, setRequestId] = useState('')

  if (step === 'done')
    return (
      <div className="px-5 pt-4 pb-10 text-center">
        <CheckCircle2 className="mx-auto size-14 text-brand" />
        <h3 className="mt-3 text-xl font-extrabold">Solicitud enviada</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Tu solicitud <b className="text-ink">{requestId}</b> para {space.type === 'court' ? 'la cancha sintética' : `el espacio ${space.label}`} quedó registrada.
        </p>
        <p className="mx-auto mt-4 max-w-xs rounded-2xl bg-sand p-3 text-[13px] text-ink-soft">
          El local <b>no se activa automáticamente</b>: el equipo de Cartagena Mall revisará la solicitud y te contactará. No se ha realizado ningún cobro.
        </p>
        <button className={`${btn.secondary} mt-6`} onClick={() => useUI.getState().selectSpace(null)}>
          Seguir explorando
        </button>
      </div>
    )

  if (step === 'form')
    return (
      <ClaimForm
        space={space}
        onDone={(id) => {
          setRequestId(id)
          setStep('done')
        }}
        onBack={() => setStep('info')}
      />
    )

  return (
    <div className="space-y-5 px-5 pt-2 pb-8">
      <div className="rounded-3xl border border-line bg-sand/60">
        <SpacePreview type={space.type} color={color} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-sand p-3">
          <dt className="text-xs text-ink-soft">Tipo de espacio</dt>
          <dd className="font-bold">{info.name}</dd>
        </div>
        <div className="rounded-2xl bg-sand p-3">
          <dt className="text-xs text-ink-soft">Ubicación</dt>
          <dd className="font-bold">{placeName(space)}</dd>
        </div>
        {!DEMO && <div className="col-span-2 flex items-end justify-between rounded-2xl p-3 text-white" style={{ background: color }}>
          <div>
            <dt className="text-xs opacity-85">Precio mensual de referencia</dt>
            <dd className="text-2xl font-extrabold">{formatCOP(price)}</dd>
          </div>
          <span className="text-[11px] opacity-85">Precio de ejemplo · sin cobro</span>
        </div>}
      </dl>
      <div>
        <h3 className="mb-2 text-sm font-extrabold">Incluye</h3>
        <ul className="space-y-1.5 text-sm text-ink-soft">
          {info.features.map((f) => (
            <li key={f} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /> {f}
            </li>
          ))}
        </ul>
      </div>
      {!DEMO && pending > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-900">
          <Clock className="size-4 shrink-0" /> Ya hay {pending === 1 ? 'una solicitud' : `${pending} solicitudes`} en revisión para este espacio. Aún puedes enviar la tuya.
        </p>
      )}
      {!DEMO && <button className={`${btn.primary} w-full`} onClick={() => setStep('form')}>
        <StoreIcon className="size-4" /> {space.type === 'court' ? 'Reclamar la cancha' : 'Reclamar este espacio'}
      </button>}
    </div>
  )
}

interface FormState {
  businessName: string
  categoryId: string
  ownerName: string
  whatsapp: string
  email: string
  spaceType: SpaceType
}

function validate(f: FormState) {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (f.businessName.trim().length < 2) e.businessName = 'Escribe el nombre del negocio.'
  if (!f.categoryId) e.categoryId = 'Elige una categoría.'
  if (f.ownerName.trim().length < 3) e.ownerName = 'Escribe tu nombre completo.'
  if (!/^3\d{9}$/.test(f.whatsapp.replace(/\D/g, '').replace(/^57/, ''))) e.whatsapp = 'Número celular colombiano de 10 dígitos (empieza por 3).'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Correo no válido.'
  return e
}

function ClaimForm({ space, onDone, onBack }: { space: SpaceSlot; onDone: (id: string) => void; onBack: () => void }) {
  const zone = ZONE_BY_ID[space.zoneId]
  const submit = useClaims((s) => s.submit)
  const prices = useSpacePricing()
  const [f, setF] = useState<FormState>({
    businessName: '',
    categoryId: space.type === 'court' ? 'deportes' : zone.categories[0].id,
    ownerName: '',
    whatsapp: '',
    email: '',
    spaceType: space.type,
  })
  const [touched, setTouched] = useState(false)
  const errors = validate(f)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))
  const field = (k: keyof FormState) => (touched && errors[k] ? <p className="mt-1 text-xs font-semibold text-red-600">{errors[k]}</p> : null)

  return (
    <form
      className="space-y-4 px-5 pt-2 pb-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (Object.keys(errors).length) return
        const claim = submit({
          spaceId: space.id,
          spaceType: f.spaceType,
          businessName: f.businessName.trim(),
          categoryId: f.categoryId,
          ownerName: f.ownerName.trim(),
          whatsapp: f.whatsapp.trim(),
          email: f.email.trim(),
        })
        onDone(claim.id)
      }}
    >
      <p className="text-sm text-ink-soft">
        Solicitud para {space.type === 'court' ? 'la' : 'el espacio'} <b className="text-ink">{space.type === 'court' ? 'cancha sintética' : space.label}</b> ({placeName(space)}).
      </p>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Nombre del negocio</span>
        <input className={input} value={f.businessName} onChange={(e) => set('businessName', e.target.value)} autoComplete="organization" />
        {field('businessName')}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Categoría</span>
        <select className={input} value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          {ZONE_BY_ID[space.zoneId].categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <optgroup label="Otras zonas">
            {CATEGORIES.filter((c) => c.zoneId !== space.zoneId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
        {field('categoryId')}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Nombre del propietario</span>
        <input className={input} value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} autoComplete="name" />
        {field('ownerName')}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">WhatsApp</span>
          <input className={input} value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} inputMode="tel" placeholder="300 123 4567" autoComplete="tel" />
          {field('whatsapp')}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Correo electrónico</span>
          <input className={input} value={f.email} onChange={(e) => set('email', e.target.value)} inputMode="email" type="email" autoComplete="email" />
          {field('email')}
        </label>
      </div>
      {space.type !== 'court' && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Tipo de espacio</legend>
          <div className="grid grid-cols-3 gap-2">
            {SHOP_SPACE_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => set('spaceType', t)}
                aria-pressed={f.spaceType === t}
                className={`rounded-2xl border p-2.5 text-left text-xs transition ${f.spaceType === t ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : 'border-line bg-white'}`}
              >
                <span className="block font-bold">{SPACE_TYPES[t].name}</span>
                <span className="text-ink-soft">{formatCOP(typePrice(prices, t))}/mes</span>
              </button>
            ))}
          </div>
          {f.spaceType !== space.type && <p className="mt-1.5 text-xs text-ink-soft">Este espacio es un {SPACE_TYPES[space.type].name.toLowerCase()}; el equipo te propondrá uno del tipo elegido.</p>}
        </fieldset>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" className={btn.secondary} onClick={onBack}>
          Volver
        </button>
        <button type="submit" className={`${btn.primary} flex-1`}>
          Enviar solicitud
        </button>
      </div>
      <p className="text-center text-[11px] text-ink-soft">Demo: los datos se guardan solo en este navegador.</p>
    </form>
  )
}
