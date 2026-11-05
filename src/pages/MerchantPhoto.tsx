import { Camera, Loader2, Wand2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Store } from '../domain/types'
import { removeBackground } from '../lib/cutout'
import { readImageFile } from '../lib/image'
import { clampSlot, composeOnBackground, loadImage } from '../lib/studio'
import { remoteEnabled } from '../remote/client'
import { useUI } from '../state/ui'
import { btn } from '../ui/bits'

export interface PhotoState {
  /** Foto final que se muestra en la tienda (data URL mientras se edita, enlace una vez guardada). */
  image: string | null
  original?: string
  cutout?: string
  fit?: { scale: number; dx: number }
}

type Cut = HTMLImageElement | HTMLCanvasElement

/**
 * Foto del producto con estudio: al subirla se quita el fondo y se coloca sobre el fondo de la tienda.
 * Siempre se puede volver a la foto original o ajustar tamaño y posición.
 */
export function ProductPhotoField({ store, value, onChange, placeholder }: { store: Store; value: PhotoState; onChange: (v: PhotoState) => void; placeholder: ReactNode }) {
  const toast = useUI((s) => s.toast)
  const bg = store.photoBg
  const file = useRef<HTMLInputElement>(null)
  const cut = useRef<Cut | null>(null)
  const touched = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const [busy, setBusy] = useState<null | 'model' | 'run'>(null)
  const [studio, setStudio] = useState(!!value.cutout)
  const [fit, setFit] = useState(value.fit ?? { scale: 1, dx: 0 })
  const [ready, setReady] = useState(false)

  // Producto ya recortado de una sesión anterior: se carga para poder reajustarlo.
  useEffect(() => {
    if (!value.cutout || cut.current) return
    let live = true
    loadImage(value.cutout)
      .then((img) => {
        if (!live) return
        cut.current = img
        setReady(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
    // solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recompone la foto cuando cambia el ajuste o se activa/desactiva el fondo.
  useEffect(() => {
    if (!touched.current || !ready || !cut.current) return
    const v = valueRef.current
    if (!studio || !bg) {
      if (v.original) onChange({ ...v, image: v.original, fit })
      return
    }
    let live = true
    const t = setTimeout(async () => {
      const slot = clampSlot({ ...bg.slot, x: bg.slot.x + fit.dx, w: bg.slot.w * fit.scale, h: bg.slot.h * fit.scale })
      try {
        const out = await composeOnBackground(bg.url, cut.current as Cut & { width: number; height: number }, slot)
        if (live) onChange({ ...valueRef.current, image: out, fit })
      } catch {
        if (live) toast('No se pudo cargar el fondo de la tienda.', 'error')
      }
    }, 120)
    return () => {
      live = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio, fit, ready, bg?.url, bg?.slot.x, bg?.slot.y, bg?.slot.w, bg?.slot.h])

  const pick = async (f: File) => {
    try {
      setBusy('run')
      const original = await readImageFile(f, remoteEnabled() ? 'product-hd' : 'product')
      touched.current = true
      cut.current = null
      setReady(false)
      if (!bg) {
        onChange({ image: original })
        setBusy(null)
        return
      }
      onChange({ image: original, original })
      try {
        const img = await loadImage(original)
        const c = await removeBackground(img, setBusy)
        cut.current = c
        setFit({ scale: 1, dx: 0 })
        setStudio(true)
        onChange({ image: original, original, cutout: c.toDataURL('image/png'), fit: { scale: 1, dx: 0 } })
        setReady(true)
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No se pudo quitar el fondo; se usará la foto tal cual.', 'error')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo usar la imagen.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const hasCut = ready && !!value.cutout
  const touch = () => (touched.current = true)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          {value.image ? <img src={value.image} alt="Foto del artículo" className="size-40 rounded-2xl object-cover ring-1 ring-line" /> : placeholder}
          {busy && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/80 p-2 text-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-1 text-[11px] font-bold text-ink-soft">
                <Loader2 className="size-5 animate-spin text-brand" />
                {busy === 'model' ? 'Preparando el recortador (solo la primera vez)…' : 'Quitando el fondo…'}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Subir foto"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void pick(f)
            }}
          />
          <button type="button" className={btn.secondary} disabled={!!busy} onClick={() => file.current?.click()}>
            <Camera className="size-4" /> {value.image ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {value.image && (
            <button
              type="button"
              className={btn.ghost}
              onClick={() => {
                touch()
                cut.current = null
                setReady(false)
                setStudio(false)
                onChange({ image: null })
              }}
            >
              <X className="size-4" /> Quitar foto
            </button>
          )}
        </div>
      </div>

      {!bg && !value.image && <p className="text-[11px] text-ink-soft">Tip: sube el fondo de tu tienda en Perfil y tus fotos se recortan solas y quedan todas iguales.</p>}

      {hasCut && bg && (
        <div className="space-y-3 rounded-2xl border border-line bg-sand/40 p-3">
          <div role="group" aria-label="Tipo de foto" className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 ring-1 ring-line">
            {(
              [
                [true, 'Con el fondo de la tienda'],
                [false, 'Foto original'],
              ] as const
            ).map(([on, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={studio === on}
                onClick={() => {
                  touch()
                  setStudio(on)
                }}
                className={`rounded-full px-3 py-2 text-[12.5px] font-bold transition ${studio === on ? 'bg-ink text-white' : 'text-ink-soft'}`}
              >
                {on && <Wand2 className="mr-1 inline size-3.5" />}
                {label}
              </button>
            ))}
          </div>
          {studio && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-ink-soft">
                Tamaño
                <input
                  type="range"
                  className="mt-1 w-full accent-brand"
                  min={50}
                  max={140}
                  value={Math.round(fit.scale * 100)}
                  onChange={(e) => {
                    touch()
                    setFit({ ...fit, scale: Number(e.target.value) / 100 })
                  }}
                />
              </label>
              <label className="block text-xs font-bold text-ink-soft">
                Mover a los lados
                <input
                  type="range"
                  className="mt-1 w-full accent-brand"
                  min={-25}
                  max={25}
                  value={Math.round(fit.dx * 100)}
                  onChange={(e) => {
                    touch()
                    setFit({ ...fit, dx: Number(e.target.value) / 100 })
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
