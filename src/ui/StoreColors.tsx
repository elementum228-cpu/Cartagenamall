import { Check, Pipette, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BRAND_PALETTE, autoAccent, normalizeHex, readableOn, tint } from '../lib/color'
import type { Store } from '../domain/types'
import { StoreLogo } from './bits'

/** Campo de color: círculos de la paleta, código hexadecimal y selector libre del sistema. */
function ColorPicker({ value, onChange, palette, label }: { value: string; onChange: (hex: string) => void; palette: { name: string; hex: string }[]; label: string }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const valid = normalizeHex(text) !== null
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {palette.map((c) => {
          const on = normalizeHex(value) === c.hex
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={c.name}
              title={c.name}
              onClick={() => onChange(c.hex)}
              className={`grid size-9 place-items-center rounded-full ring-offset-2 transition active:scale-90 ${on ? 'ring-[3px] ring-ink' : 'ring-1 ring-black/10 hover:scale-110'}`}
              style={{ background: c.hex }}
            >
              {on && <Check className="size-4" strokeWidth={3} style={{ color: readableOn(c.hex) }} />}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="size-11 shrink-0 rounded-xl ring-1 ring-black/10" style={{ background: normalizeHex(value) ?? '#ffffff' }} aria-hidden />
        <label className="flex h-11 min-w-0 flex-1 items-center rounded-xl border bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15" style={{ borderColor: valid ? undefined : '#dc2626' }}>
          <span className="mr-1 font-mono text-[15px] text-ink-soft">#</span>
          <input
            className="w-full bg-transparent font-mono text-[15px] tracking-wider uppercase outline-none"
            value={text.replace(/^#/, '')}
            maxLength={7}
            spellCheck={false}
            autoCapitalize="characters"
            aria-label={`${label}: código hexadecimal`}
            placeholder="0F8F8A"
            onChange={(e) => {
              setText(e.target.value)
              const hex = normalizeHex(e.target.value)
              if (hex) onChange(hex)
            }}
            onBlur={() => setText(normalizeHex(text) ?? value)}
          />
        </label>
        <label className="relative flex h-11 shrink-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-xl border border-line bg-card px-3 text-[13px] font-bold transition hover:bg-sand">
          <Pipette className="size-4" /> Otro
          <input type="color" className="absolute inset-0 size-full cursor-pointer opacity-0" value={normalizeHex(value) ?? '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: elegir cualquier color`} />
        </label>
      </div>
      {!valid && <p className="mt-1 text-xs font-semibold text-red-600">Escribe 3 o 6 letras y números, como 0F8F8A.</p>}
    </div>
  )
}

/**
 * Colores de la tienda: color de marca (paleta, hexadecimal o cualquiera) y fondo suave que puede ser
 * automático a partir del color de marca. Con vista previa de cómo se ve la ficha.
 */
export function StoreColors({ store, onChange }: { store: Pick<Store, 'name' | 'logoText' | 'logo' | 'brandColor' | 'accentColor' | 'tagline'>; onChange: (c: { brandColor: string; accentColor: string }) => void }) {
  const auto = normalizeHex(store.accentColor) === autoAccent(store.brandColor)
  const [manual, setManual] = useState(!auto)
  const brand = normalizeHex(store.brandColor) ?? '#0f8f8a'
  const accent = normalizeHex(store.accentColor) ?? autoAccent(brand)
  const softPalette = [0.9, 0.82, 0.7].map((a) => ({ name: `Suave ${Math.round(a * 100)}%`, hex: tint(brand, a) })).concat([{ name: 'Blanco cálido', hex: '#f7f2e8' }, { name: 'Gris claro', hex: '#eef0f2' }, { name: 'Crema', hex: '#fbf3e4' }])

  return (
    <div className="space-y-4 sm:col-span-2">
      <div>
        <p className="mb-2 text-sm font-semibold">Color de marca</p>
        <ColorPicker
          value={brand}
          label="Color de marca"
          palette={BRAND_PALETTE}
          onChange={(hex) => onChange({ brandColor: hex, accentColor: manual ? accent : autoAccent(hex) })}
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Color de fondo</p>
          <button
            type="button"
            onClick={() => {
              const next = !manual
              setManual(next)
              if (!next) onChange({ brandColor: brand, accentColor: autoAccent(brand) })
            }}
            aria-pressed={!manual}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${!manual ? 'bg-teal/12 text-teal' : 'bg-ink/[0.06] text-ink-soft'}`}
          >
            <Wand2 className="size-3.5" /> {manual ? 'Usar automático' : 'Automático'}
          </button>
        </div>
        {manual ? (
          <ColorPicker value={accent} label="Color de fondo" palette={softPalette} onChange={(hex) => onChange({ brandColor: brand, accentColor: hex })} />
        ) : (
          <p className="text-[13px] text-ink-soft">Se calcula solo a partir de tu color de marca para que combinen. Si quieres otro, desactiva «Automático».</p>
        )}
      </div>

      {/* vista previa */}
      <div>
        <p className="mb-2 text-sm font-semibold">Así se verá</p>
        <div className="overflow-hidden rounded-3xl border border-line" style={{ background: accent }}>
          <div className="flex items-center gap-3.5 p-4" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${brand} 12%, ${accent}), ${accent})` }}>
            <StoreLogo store={{ logoText: store.logoText, logo: store.logo, brandColor: brand }} size={52} />
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold tracking-tight text-ink">{store.name || 'Tu negocio'}</p>
              <p className="truncate text-[13px] text-ink-soft">{store.tagline || 'Tu frase aparece aquí'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
            <span className="rounded-full px-3.5 py-2 text-[13px] font-bold" style={{ background: brand, color: readableOn(brand) }}>
              Agregar
            </span>
            <span className="rounded-full border px-3.5 py-2 text-[13px] font-bold" style={{ borderColor: brand, color: brand }}>
              Ver catálogo
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-ink-soft">Abierto</span>
          </div>
        </div>
      </div>
    </div>
  )
}
