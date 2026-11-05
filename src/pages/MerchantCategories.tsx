import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { Store } from '../domain/types'
import { categoryWords, newCategoryId, storeCategories, suggestedCategories } from '../lib/storeCategories'
import { useCatalog } from '../state/catalog'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'

/**
 * Categorías propias de la tienda (menú, productos o servicios): el dueño las crea y las ordena, y las
 * personas filtran por ellas en la ficha y en el catálogo completo.
 */
export function CategoriesManager({ store }: { store: Store }) {
  const upsertStore = useCatalog((s) => s.upsertStore)
  const upsertProduct = useCatalog((s) => s.upsertProduct)
  const products = useCatalog((s) => s.products)
  const toast = useUI((s) => s.toast)
  const words = categoryWords(store)
  const cats = storeCategories(store)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [armed, setArmed] = useState<string | null>(null)
  const countOf = (id: string) => products.filter((p) => p.storeId === store.id && p.shopCategory === id).length
  const save = (next: { id: string; name: string }[]) => upsertStore({ ...store, categories: next })
  const taken = cats.map((c) => c.id)
  const names = cats.map((c) => c.name.toLowerCase())

  const add = (raw: string) => {
    const n = raw.trim().slice(0, 30)
    if (n.length < 2) return
    if (names.includes(n.toLowerCase())) return toast('Ya tienes una categoría con ese nombre.', 'error')
    save([...cats, { id: newCategoryId(n, taken), name: n }])
    setName('')
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= cats.length) return
    const next = [...cats]
    ;[next[i], next[j]] = [next[j], next[i]]
    save(next)
  }
  const remove = (id: string) => {
    // los productos de esa categoría quedan sin categoría propia (se agrupan por su rubro)
    for (const p of products) if (p.storeId === store.id && p.shopCategory === id) upsertProduct({ ...p, shopCategory: undefined })
    save(cats.filter((c) => c.id !== id))
    setArmed(null)
    toast('Categoría eliminada. Sus artículos quedan sin categoría.', 'success')
  }
  const suggestions = suggestedCategories(store).filter((s) => !names.includes(s.toLowerCase()))

  return (
    <section className="rounded-3xl border border-line bg-card p-4" aria-label={words.title}>
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: store.brandColor }}>
          <Tags className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">{words.title}</p>
          <p className="text-[12px] text-ink-soft">Así las personas filtran tu tienda: crea las que necesites y asígnalas a cada artículo.</p>
        </div>
      </div>

      {cats.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {cats.map((c, i) => (
            <li key={c.id} className="flex items-center gap-0.5 rounded-full border border-line bg-white py-1 pr-1 pl-3 text-sm font-bold">
              {editing === c.id ? (
                <>
                  <input
                    autoFocus
                    className="h-7 w-32 rounded-lg border border-line px-2 text-sm font-semibold outline-none focus:border-teal"
                    value={draft}
                    maxLength={30}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draft.trim().length > 1) {
                        save(cats.map((x) => (x.id === c.id ? { ...x, name: draft.trim() } : x)))
                        setEditing(null)
                      }
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                  <button
                    className="grid size-7 place-items-center rounded-full text-brand"
                    aria-label="Guardar nombre"
                    onClick={() => {
                      if (draft.trim().length < 2) return
                      save(cats.map((x) => (x.id === c.id ? { ...x, name: draft.trim() } : x)))
                      setEditing(null)
                    }}
                  >
                    <Check className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  <span>{c.name}</span>
                  <span className="ml-1 rounded-full bg-ink/[0.07] px-1.5 text-[11px] font-bold text-ink-soft">{countOf(c.id)}</span>
                  <button className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-ink/5 disabled:opacity-25" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Mover ${c.name} a la izquierda`}>
                    <ChevronLeft className="size-4" />
                  </button>
                  <button className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-ink/5 disabled:opacity-25" disabled={i === cats.length - 1} onClick={() => move(i, 1)} aria-label={`Mover ${c.name} a la derecha`}>
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-ink/5"
                    onClick={() => {
                      setEditing(c.id)
                      setDraft(c.name)
                    }}
                    aria-label={`Renombrar ${c.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  {armed === c.id ? (
                    <button className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white" onClick={() => remove(c.id)} onBlur={() => setArmed(null)} autoFocus>
                      ¿Eliminar?
                    </button>
                  ) : (
                    <button className="grid size-7 place-items-center rounded-full text-red-600 hover:bg-red-50" onClick={() => setArmed(c.id)} aria-label={`Eliminar ${c.name}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add(name)
        }}
      >
        <input className={`${input} flex-1`} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={words.placeholder} aria-label={`Nombre de la ${words.one}`} />
        <button type="submit" className={btn.primary} disabled={name.trim().length < 2}>
          <Plus className="size-4" /> Agregar
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-soft uppercase">Ideas para tu negocio</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => add(s)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition hover:border-teal hover:text-teal active:scale-95">
                <Plus className="size-3.5" /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {cats.length === 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-soft">
          <X className="size-3.5 opacity-0" /> Aún no tienes categorías: toca una idea o escribe la tuya.
        </p>
      )}
    </section>
  )
}

/** Elegir la categoría de un artículo y crear una nueva ahí mismo, sin salir del formulario. */
export function CategoryPicker({ store, value, onChange }: { store: Store; value: string; onChange: (id: string) => void }) {
  const upsertStore = useCatalog((s) => s.upsertStore)
  const words = categoryWords(store)
  const cats = storeCategories(store)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const names = cats.map((c) => c.name.toLowerCase())
  const create = (raw: string) => {
    const n = raw.trim().slice(0, 30)
    if (n.length < 2) return
    const existing = cats.find((c) => c.name.toLowerCase() === n.toLowerCase())
    if (existing) {
      onChange(existing.id)
    } else {
      const id = newCategoryId(n, cats.map((c) => c.id))
      upsertStore({ ...store, categories: [...cats, { id, name: n }] })
      onChange(id)
    }
    setName('')
    setCreating(false)
  }
  const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-[13px] font-bold transition active:scale-95 ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft hover:border-ink/40'}`
  const ideas = suggestedCategories(store).filter((s) => !names.includes(s.toLowerCase()))

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={words.title}>
        <button type="button" role="radio" aria-checked={value === ''} className={chip(value === '')} onClick={() => onChange('')}>
          Sin categoría
        </button>
        {cats.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={value === c.id} className={chip(value === c.id)} onClick={() => onChange(c.id)}>
            {c.name}
          </button>
        ))}
        <button type="button" onClick={() => setCreating((v) => !v)} aria-expanded={creating} className="inline-flex items-center gap-1 rounded-full border border-dashed border-teal px-3.5 py-2 text-[13px] font-bold text-teal transition hover:bg-teal/8 active:scale-95">
          <Plus className="size-3.5" /> Nueva categoría
        </button>
      </div>
      {creating && (
        <div className="mt-3 rounded-2xl border border-line bg-sand/60 p-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              create(name)
            }}
          >
            <input autoFocus className={`${input} flex-1`} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={words.placeholder} aria-label="Nombre de la nueva categoría" />
            <button type="submit" className={btn.primary} disabled={name.trim().length < 2}>
              Crear
            </button>
          </form>
          {ideas.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ideas.map((s) => (
                <button key={s} type="button" onClick={() => create(s)} className="rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft ring-1 ring-line transition hover:text-teal active:scale-95">
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
