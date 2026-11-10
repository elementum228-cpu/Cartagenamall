import { ImagePlus, Newspaper, Plus, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { sampleEdition, useEdition, type EdPromo, type Edition, type Slot } from '../hoy/edition'
import type { Cat } from '../hoy/data'
import { useHoy } from '../hoy/store'
import { readImageFile } from '../lib/image'
import { remoteEnabled } from '../remote/client'
import { uploadStadiumImage } from '../remote/photos'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'

const CATS: Cat[] = ['Gastronomía', 'Belleza', 'Tecnología', 'Moda', 'Lifestyle', 'Deportes', 'Servicios']

/** Fecha ISO ↔ valor de un <input type="datetime-local"> (hora local). */
const toLocal = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-bold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-soft">{hint}</span>}
    </label>
  )
}

/** Foto profesional: se reduce y, con base de datos, se sube a Storage; si no, queda en este navegador. */
function Photo({ value, onChange, label = 'Foto' }: { value: string | null; onChange: (v: string | null) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const toast = useUI((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const pick = async (f: File) => {
    setBusy(true)
    try {
      const data = await readImageFile(f, 'poster')
      onChange(remoteEnabled() ? await uploadStadiumImage(data) : data)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cargar la imagen.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-sand">{value ? <img src={value} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5 text-ink-soft" />}</div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? 'Subiendo…' : value ? `Cambiar ${label.toLowerCase()}` : `Subir ${label.toLowerCase()}`}
        </button>
        {value && (
          <button type="button" className={btn.ghost} onClick={() => onChange(null)}>
            <X className="size-4" /> Quitar
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void pick(f)
        }}
      />
    </div>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <p className="font-bold">{title}</p>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function SlotEditor({ title, hint, slot, onChange }: { title: string; hint: string; slot: Slot; onChange: (s: Slot) => void }) {
  return (
    <Card title={title} hint={hint}>
      <Field label="Nombre del negocio">
        <input className={input} value={slot.name} maxLength={40} onChange={(e) => onChange({ ...slot, name: e.target.value })} />
      </Field>
      <Field label="Frase">
        <input className={input} value={slot.text} maxLength={90} onChange={(e) => onChange({ ...slot, text: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Photo value={slot.image} onChange={(image) => onChange({ ...slot, image })} label="Imagen" />
      </div>
    </Card>
  )
}

/** Gestión de «MallPlay Hoy»: portada, espacios para negocios y promociones de la edición, con fotos. */
export function HoyAdmin() {
  const saved = useEdition((s) => s.ed)
  const publish = useEdition((s) => s.set)
  const toast = useUI((s) => s.toast)
  const [ed, setEd] = useState<Edition>(() => saved ?? sampleEdition())
  const dirty = JSON.stringify(ed) !== JSON.stringify(saved ?? null)
  const patch = (p: Partial<Edition>) => setEd((e) => ({ ...e, ...p }))
  const setPromo = (id: string, p: Partial<EdPromo>) => setEd((e) => ({ ...e, promos: e.promos.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
  const addPromo = () =>
    setEd((e) => ({
      ...e,
      promos: [{ id: `p${Date.now().toString(36)}`, store: '', cat: 'Gastronomía', big: '20% OFF', title: '', text: '', endsAt: new Date(Date.now() + 6 * 3600_000).toISOString(), flash: false, left: 20, ended: false, image: null }, ...e.promos],
    }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-card p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold">
            <Newspaper className="size-4" /> MallPlay Hoy
          </p>
          <p className="text-xs text-ink-soft">{saved ? 'Edición publicada por la administración.' : 'Se muestra la edición de ejemplo: publica la tuya.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn.secondary} onClick={() => useHoy.getState().read()}>
            Ver la edición
          </button>
          <button
            className={btn.primary}
            disabled={!dirty}
            onClick={() => {
              publish(ed)
              toast('Edición publicada. Ya la ve todo el mundo.', 'success')
            }}
          >
            Publicar cambios
          </button>
        </div>
      </div>

      <Card title="Portada" hint="Titular y evento del día.">
        <Field label="Titular principal" wide>
          <input className={input} value={ed.headline} maxLength={90} onChange={(e) => patch({ headline: e.target.value })} />
        </Field>
        <Field label="Etiqueta del evento">
          <input className={input} value={ed.event.kicker} maxLength={24} onChange={(e) => patch({ event: { ...ed.event, kicker: e.target.value } })} />
        </Field>
        <Field label="Título del evento">
          <input className={input} value={ed.event.title} maxLength={90} onChange={(e) => patch({ event: { ...ed.event, title: e.target.value } })} />
        </Field>
        <Field label="Descripción" wide>
          <textarea className={`${input} min-h-16`} value={ed.event.text} maxLength={200} onChange={(e) => patch({ event: { ...ed.event, text: e.target.value } })} />
        </Field>
        <Field label="Fecha y hora">
          <input className={input} value={ed.event.when} maxLength={40} onChange={(e) => patch({ event: { ...ed.event, when: e.target.value } })} />
        </Field>
        <Field label="Dónde en el mall">
          <input className={input} value={ed.event.where} maxLength={50} onChange={(e) => patch({ event: { ...ed.event, where: e.target.value } })} />
        </Field>
        <div className="sm:col-span-2">
          <Photo value={ed.event.image} onChange={(image) => patch({ event: { ...ed.event, image } })} label="Foto del evento" />
          <p className="mt-1 text-[11px] text-ink-soft">Mejor horizontal (16:9). Sin foto se muestra una ilustración.</p>
        </div>
      </Card>

      <Card title="Última hora y Próximamente">
        <Field label="Última hora: titular">
          <input className={input} value={ed.lastHour.title} maxLength={70} onChange={(e) => patch({ lastHour: { ...ed.lastHour, title: e.target.value } })} />
        </Field>
        <Field label="Última hora: texto">
          <input className={input} value={ed.lastHour.text} maxLength={160} onChange={(e) => patch({ lastHour: { ...ed.lastHour, text: e.target.value } })} />
        </Field>
        <div className="sm:col-span-2">
          <Photo value={ed.lastHour.image} onChange={(image) => patch({ lastHour: { ...ed.lastHour, image } })} label="Foto de fondo" />
        </div>
        <Field label="Próximamente: titular">
          <input className={input} value={ed.soon.title} maxLength={70} onChange={(e) => patch({ soon: { ...ed.soon, title: e.target.value } })} />
        </Field>
        <Field label="Próximamente: texto">
          <input className={input} value={ed.soon.text} maxLength={140} onChange={(e) => patch({ soon: { ...ed.soon, text: e.target.value } })} />
        </Field>
      </Card>

      <SlotEditor title="Patrocinador principal" hint="Espacio de pago en la portada. Vacío, muestra «Tu marca aquí»." slot={ed.sponsor} onChange={(sponsor) => patch({ sponsor })} />
      <SlotEditor title="Recomendado por MallPlay" hint="Local recomendado de la portada." slot={ed.recommended} onChange={(recommended) => patch({ recommended })} />
      <SlotEditor title="Banner inferior" hint="Negocio aliado, al pie de la portada." slot={ed.banner} onChange={(banner) => patch({ banner })} />

      <Card title="Oferta secreta del día" hint="Aparece borrosa hasta que el lector explore locales.">
        <Field label="Texto de la oferta">
          <input className={input} value={ed.secret.title} maxLength={80} onChange={(e) => patch({ secret: { ...ed.secret, title: e.target.value } })} />
        </Field>
        <Field label="Locales a explorar para desbloquearla">
          <input className={input} inputMode="numeric" value={ed.secret.need} onChange={(e) => patch({ secret: { ...ed.secret, need: Math.max(1, Math.min(8, Number(e.target.value.replace(/\D/g, '')) || 1)) } })} />
        </Field>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold">Promociones de la edición ({ed.promos.length})</p>
          <button className={btn.primary} onClick={addPromo}>
            <Plus className="size-4" /> Nueva promoción
          </button>
        </div>
        {ed.promos.map((p) => (
          <div key={p.id} className="rounded-3xl border border-line bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Local">
                <input className={input} value={p.store} maxLength={40} onChange={(e) => setPromo(p.id, { store: e.target.value })} />
              </Field>
              <Field label="Categoría">
                <select className={input} value={p.cat} onChange={(e) => setPromo(p.id, { cat: e.target.value as Cat })}>
                  {CATS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Descuento grande" hint="Ej.: 20% OFF, 2x1, Combo, Regalo">
                <input className={input} value={p.big} maxLength={12} onChange={(e) => setPromo(p.id, { big: e.target.value })} />
              </Field>
              <Field label="Título">
                <input className={input} value={p.title} maxLength={50} onChange={(e) => setPromo(p.id, { title: e.target.value })} />
              </Field>
              <Field label="Descripción corta" wide>
                <input className={input} value={p.text} maxLength={140} onChange={(e) => setPromo(p.id, { text: e.target.value })} />
              </Field>
              <Field label="Termina">
                <input className={input} type="datetime-local" value={toLocal(p.endsAt)} onChange={(e) => e.target.value && setPromo(p.id, { endsAt: new Date(e.target.value).toISOString() })} />
              </Field>
              <Field label="Cupos disponibles">
                <input className={input} inputMode="numeric" value={p.left} onChange={(e) => setPromo(p.id, { left: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
              </Field>
              <div className="sm:col-span-2">
                <Photo value={p.image} onChange={(image) => setPromo(p.id, { image })} label="Foto del local o producto" />
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className="size-5 accent-brand" checked={p.flash} onChange={(e) => setPromo(p.id, { flash: e.target.checked })} /> Oferta relámpago
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className="size-5 accent-brand" checked={p.ended} onChange={(e) => setPromo(p.id, { ended: e.target.checked })} /> Finalizada / agotada
                </label>
                <button className={`${btn.ghost} ml-auto`} onClick={() => setEd((e) => ({ ...e, promos: e.promos.filter((x) => x.id !== p.id) }))}>
                  <Trash2 className="size-4" /> Quitar
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap justify-between gap-2">
        <button
          className={btn.ghost}
          onClick={() => {
            publish(null)
            setEd(sampleEdition())
            toast('Se volvió a la edición de ejemplo.')
          }}
        >
          Volver a la edición de ejemplo
        </button>
        <button className={btn.primary} disabled={!dirty} onClick={() => { publish(ed); toast('Edición publicada. Ya la ve todo el mundo.', 'success') }}>
          Publicar cambios
        </button>
      </div>
    </div>
  )
}
