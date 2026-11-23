import { AlertTriangle, Check, FileText, Loader2, Trash2, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { Product, Store } from '../domain/types'
import { uniqueId } from '../lib/ids'
import { stockKey } from '../lib/inventory'
import { iconFor, parseMenuText, type ItemFlag, type ParsedMenu } from '../lib/menuParser'
import { formatCOP } from '../lib/format'
import { newCategoryId, storeCategories } from '../lib/storeCategories'
import { remoteEnabled } from '../remote/client'
import { useCatalog } from '../state/catalog'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'

// Importar el menú de un restaurante desde un PDF (o texto pegado): se lee, se muestra para revisar y recién entonces se crean los platos y
// sus categorías. Nada se crea sin que la persona lo confirme. Los platos que ya existen (mismo nombre) se saltan.

interface Row {
  key: string
  name: string
  price: string
  description: string
  on: boolean
  flag?: ItemFlag
  dup: boolean
}
interface Sec {
  key: string
  name: string
  rows: Row[]
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const FLAG_TEXT: Record<ItemFlag, string> = {
  'sin-precio': 'No encontré el precio: escríbelo',
  'precio-dudoso': 'Precio corto, lo leí en miles: revísalo',
  'varios-precios': 'Tiene varios precios (tamaños): dejé el primero',
}

export function MenuImport({ store, onClose }: { store: Store; onClose: () => void }) {
  const products = useCatalog((s) => s.products)
  const toast = useUI((s) => s.toast)
  const file = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<'pick' | 'reading' | 'review'>('pick')
  const [error, setError] = useState('')
  const [pasted, setPasted] = useState('')
  const [secs, setSecs] = useState<Sec[]>([])
  const [skipDup, setSkipDup] = useState(true)
  const existing = useMemo(() => new Set(products.filter((p) => p.storeId === store.id).map((p) => norm(p.name))), [products, store.id])

  const load = (menu: ParsedMenu) => {
    if (!menu.items) {
      setError('No encontré platos con precio en ese texto. Revisa que sea el menú, o pega el texto a mano.')
      setPhase('pick')
      return
    }
    setSecs(
      menu.sections.map((s, si) => ({
        key: `s${si}`,
        name: s.name,
        rows: s.items.map((it, ii) => ({ key: `s${si}i${ii}`, name: it.name, price: it.price !== null ? String(it.price) : '', description: it.description, on: true, flag: it.flag, dup: existing.has(norm(it.name)) })),
      })),
    )
    setPhase('review')
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setError('')
    if (f.size > 15 * 1024 * 1024) return setError('El PDF pesa más de 15 MB. Prueba con uno más liviano.')
    setPhase('reading')
    try {
      const { pdfToLines } = await import('../lib/pdfText')
      const read = await pdfToLines(f)
      if (read.scanned) {
        setError('Este PDF es una imagen (escaneado o foto) y no tiene texto que pueda leer. Si tienes el menú en Word o en un PDF descargado de la web, sirve; o pega el texto a mano aquí abajo.')
        setPhase('pick')
        return
      }
      load(parseMenuText(read.lines))
    } catch (e) {
      console.error('[menú] no se pudo leer el PDF', e)
      setError('No pude abrir ese PDF. Puede estar dañado o protegido con contraseña.')
      setPhase('pick')
    }
  }

  const setRow = (si: number, ri: number, patch: Partial<Row>) => setSecs((all) => all.map((s, i) => (i !== si ? s : { ...s, rows: s.rows.map((r, j) => (j !== ri ? r : { ...r, ...patch })) })))
  const chosen = secs.flatMap((s) => s.rows.map((r) => ({ s, r }))).filter(({ r }) => r.on && !(skipDup && r.dup))
  const invalid = chosen.filter(({ r }) => !r.name.trim() || !(Number(r.price) > 0))
  const dupCount = secs.reduce((n, s) => n + s.rows.filter((r) => r.dup).length, 0)

  const create = () => {
    const state = useCatalog.getState()
    let cur = state.stores.find((s) => s.id === store.id) ?? store
    const cats = [...storeCategories(cur)]
    const catOf = (name: string) => {
      const n = norm(name)
      const found = cats.find((c) => norm(c.name) === n)
      if (found) return found.id
      const id = newCategoryId(name, cats.map((c) => c.id))
      cats.push({ id, name })
      return id
    }
    const byCat = new Map<string, string>()
    for (const { s } of chosen) if (!byCat.has(s.key)) byCat.set(s.key, catOf(s.name.trim() || 'Menú'))
    if (cats.length !== storeCategories(cur).length) {
      cur = { ...cur, categories: cats }
      state.upsertStore(cur)
    }
    let max = state.products.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0)
    for (const { s, r } of chosen) {
      const name = r.name.trim()
      const p: Product = {
        id: remoteEnabled() ? uniqueId('P') : `P-${++max}`,
        storeId: store.id,
        name,
        description: r.description.trim(),
        price: Math.round(Number(r.price)),
        image: null,
        icon: iconFor(name, s.name),
        categoryId: cur.categoryId,
        shopCategory: byCat.get(s.key),
        tags: name.toLowerCase().split(/\s+/),
        variants: [],
        sizes: [],
        inventory: { [stockKey(null, null)]: 99 },
        featured: false,
        active: true,
      }
      state.upsertProduct(p)
    }
    toast(`Listo: creé ${chosen.length} ${chosen.length === 1 ? 'plato' : 'platos'} en tu menú`, 'success')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-sand" role="dialog" aria-modal="true" aria-label="Importar menú desde PDF">
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-brand/10 text-brand">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-extrabold">Importar menú</p>
          <p className="truncate text-xs text-ink-soft">{store.name}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className={btn.icon}>
          <X className="size-5" />
        </button>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-4">
        {phase !== 'review' && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-line bg-card p-5 text-center">
              <p className="text-lg font-extrabold">Sube el menú en PDF</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">Leo los platos, sus precios y las categorías, y te los muestro para que los revises antes de crearlos.</p>
              <input ref={file} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
              <button className={`${btn.primary} mt-4 w-full max-w-xs`} disabled={phase === 'reading'} onClick={() => file.current?.click()}>
                {phase === 'reading' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {phase === 'reading' ? 'Leyendo el PDF…' : 'Elegir el PDF'}
              </button>
              <p className="mt-3 text-[11px] text-ink-soft">Funciona con PDFs que tienen texto (los que se exportan de Word, Canva o la web). Un PDF que es solo una foto no se puede leer.</p>
            </div>
            {error && (
              <p className="flex items-start gap-2 rounded-2xl bg-amber-100 p-3 text-sm font-semibold text-amber-900" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}
            <details className="rounded-3xl border border-line bg-card p-4">
              <summary className="cursor-pointer text-sm font-bold">O pega el texto del menú</summary>
              <textarea className={`${input} mt-3 min-h-40 font-mono text-[13px]`} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'ENTRADAS\nEmpanadas ........ $8.500\nPlatos fuertes\nBandeja paisa  32.000'} />
              <button className={`${btn.secondary} mt-2`} disabled={!pasted.trim()} onClick={() => load(parseMenuText(pasted))}>
                Leer este texto
              </button>
            </details>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-4 pb-28">
            <div className="rounded-2xl bg-white p-3.5 text-sm">
              <p className="font-extrabold">
                Encontré {secs.reduce((n, s) => n + s.rows.length, 0)} platos en {secs.length} {secs.length === 1 ? 'categoría' : 'categorías'}
              </p>
              <p className="text-xs text-ink-soft">Corrige lo que haga falta: nombre, precio o descripción. Desmarca lo que no quieras crear.</p>
              {dupCount > 0 && (
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" className="size-4 accent-brand" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} />
                  Saltar los {dupCount} que ya tienes con el mismo nombre
                </label>
              )}
            </div>
            {secs.map((s, si) => (
              <section key={s.key} className="rounded-3xl border border-line bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input className={`${input} !py-2 font-extrabold`} value={s.name} aria-label="Nombre de la categoría" onChange={(e) => setSecs((all) => all.map((x, i) => (i === si ? { ...x, name: e.target.value } : x)))} />
                  <button className={btn.icon} aria-label={`Quitar la categoría ${s.name}`} onClick={() => setSecs((all) => all.filter((_, i) => i !== si))}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <ul className="space-y-2">
                  {s.rows.map((r, ri) => {
                    const skipped = !r.on || (skipDup && r.dup)
                    const bad = r.on && !(skipDup && r.dup) && (!r.name.trim() || !(Number(r.price) > 0))
                    return (
                      <li key={r.key} className={`rounded-2xl border p-2.5 ${bad ? 'border-amber-400 bg-amber-50' : 'border-line bg-white'} ${skipped ? 'opacity-50' : ''}`}>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-3 size-5 accent-brand" checked={r.on} aria-label={`Crear ${r.name}`} onChange={(e) => setRow(si, ri, { on: e.target.checked })} />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex gap-2">
                              <input className={`${input} !py-2`} value={r.name} aria-label="Nombre del plato" onChange={(e) => setRow(si, ri, { name: e.target.value })} />
                              <input className={`${input} !w-28 shrink-0 !py-2 text-right tabular-nums`} inputMode="numeric" value={r.price} placeholder="Precio" aria-label="Precio en pesos" onChange={(e) => setRow(si, ri, { price: e.target.value.replace(/\D/g, ''), flag: undefined })} />
                            </div>
                            <input className={`${input} !py-1.5 !text-[13px]`} value={r.description} placeholder="Descripción (opcional)" aria-label="Descripción" onChange={(e) => setRow(si, ri, { description: e.target.value })} />
                            {r.flag && Number(r.price) > 0 && r.flag !== 'sin-precio' && (
                              <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                                <AlertTriangle className="size-3" /> {FLAG_TEXT[r.flag]} · {formatCOP(Number(r.price))}
                              </p>
                            )}
                            {r.flag === 'sin-precio' && !(Number(r.price) > 0) && (
                              <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                                <AlertTriangle className="size-3" /> {FLAG_TEXT[r.flag]}
                              </p>
                            )}
                            {r.dup && <p className="text-[11px] font-semibold text-ink-soft">Ya tienes un plato con este nombre.</p>}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {phase === 'review' && (
        <footer className="border-t border-line bg-card px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <button className={btn.ghost} onClick={() => setPhase('pick')}>
              Volver
            </button>
            <div className="flex items-center gap-3">
              {invalid.length > 0 && <span className="text-xs font-bold text-amber-800">{invalid.length} sin precio o nombre</span>}
              <button className={btn.primary} disabled={!chosen.length || invalid.length > 0} onClick={create}>
                <Check className="size-4" /> Crear {chosen.length} {chosen.length === 1 ? 'plato' : 'platos'}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
