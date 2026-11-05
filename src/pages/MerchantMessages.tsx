import type { Store } from '../domain/types'
import { MESSAGE_DEFAULTS, MESSAGE_FIELDS, type MessageKey } from '../lib/messages'
import { input } from '../ui/bits'

type Messages = NonNullable<Store['messages']>

/** Editor de los mensajes de WhatsApp del negocio. Vacío = se usa el texto de MallPlay. */
export function MessagesEditor({ store, onChange }: { store: Store; onChange: (m: Messages) => void }) {
  const msgs: Messages = store.messages ?? {}
  const set = (key: MessageKey, value: string) => onChange({ ...msgs, [key]: value })
  const reset = (key: MessageKey) => {
    const next = { ...msgs }
    delete next[key]
    onChange(next)
  }
  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <h3 className="text-sm font-bold text-ink">Mensajes de WhatsApp</h3>
        <p className="text-[12px] text-ink-soft">
          Así le escriben tus clientes y así les escribes tú. Puedes cambiar el texto; las palabras entre llaves, como {'{tienda}'}, se llenan solas.
        </p>
      </div>
      {MESSAGE_FIELDS.map((f) => {
        const value = msgs[f.key] ?? ''
        return (
          <label key={f.key} className="block">
            <span className="mb-1 flex items-center justify-between gap-2 text-xs font-bold text-ink-soft">
              {f.label}
              {value.trim() && (
                <button type="button" className="text-[11px] font-bold text-brand" onClick={() => reset(f.key)}>
                  Usar el de MallPlay
                </button>
              )}
            </span>
            <textarea
              className={`${input} min-h-0 resize-y`}
              rows={f.rows}
              value={value}
              placeholder={MESSAGE_DEFAULTS[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            />
            <span className="mt-1 block text-[11px] text-ink-soft">
              {f.hint} Puedes usar: {f.vars.map((v) => `{${v}}`).join(', ')}.
            </span>
          </label>
        )
      })}
      <p className="text-[11px] text-ink-soft">Si dejas un campo vacío, se envía el texto de MallPlay (lo ves en gris).</p>
    </div>
  )
}
