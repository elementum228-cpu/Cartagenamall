const SWATCHES = ['#e9d9c3', '#f4f1ec', '#dbeafe', '#fce7f3', '#dcfce7', '#fde68a', '#3b2a20', '#1c2a30', '#111111']

/** Color de fondo del local al entrar (se ve detrás de los productos; la foto de fondo, si hay, va encima). */
export function InteriorBgEditor({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm font-bold">Color de fondo del local (al entrar)</p>
      <p className="text-xs text-ink-soft">Es el fondo detrás de tus productos. Si subes una foto de fondo en el estudio de fotos, la foto va encima.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange(undefined)} className={`h-9 rounded-full border px-3 text-xs font-bold ${!value ? 'border-ink bg-sand' : 'border-line bg-white'}`}>
          Automático
        </button>
        {SWATCHES.map((c) => (
          <button key={c} type="button" aria-label={c} onClick={() => onChange(c)} className={`size-9 rounded-full border-2 ${value === c ? 'border-ink' : 'border-white shadow-soft'}`} style={{ background: c }} />
        ))}
        <input type="color" aria-label="Otro color" value={value ?? '#e9d9c3'} onChange={(e) => onChange(e.target.value)} className="size-9 cursor-pointer rounded-full border border-line bg-white p-0.5" />
      </div>
    </div>
  )
}
