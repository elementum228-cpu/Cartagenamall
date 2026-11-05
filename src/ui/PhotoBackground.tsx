import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PhotoBackground as Bg, PhotoSlot } from '../domain/types'
import { readImageFile } from '../lib/image'
import { clampSlot, DEFAULT_SLOT, drawComposite, loadImage } from '../lib/studio'
import { remoteEnabled } from '../remote/client'
import { uploadStorePhoto } from '../remote/photos'
import { useUI } from '../state/ui'
import { btn } from '../ui/bits'

/** Producto de ejemplo con fondo transparente, para ver cómo queda la foto sin tener un recorte real. */
function sampleProduct(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 400
  c.height = 520
  const x = c.getContext('2d')!
  x.fillStyle = '#b3323f'
  x.beginPath()
  x.roundRect(60, 120, 280, 380, 36)
  x.fill()
  x.fillStyle = '#d65a66'
  x.beginPath()
  x.roundRect(120, 20, 160, 130, 60)
  x.fill()
  x.fillStyle = 'rgba(255,255,255,0.35)'
  x.fillRect(60, 250, 280, 24)
  return c
}

const SLIDERS: { key: keyof PhotoSlot; label: string; min: number; max: number }[] = [
  { key: 'x', label: 'Posición horizontal', min: 5, max: 95 },
  { key: 'y', label: 'Altura de la superficie (donde se apoya)', min: 20, max: 98 },
  { key: 'w', label: 'Ancho máximo del producto', min: 10, max: 95 },
  { key: 'h', label: 'Alto máximo del producto', min: 10, max: 95 },
]

/** Administración: fondo de fotos de la tienda y el sitio donde se apoyan los productos. */
export function PhotoBackgroundEditor({ storeId, value, onChange }: { storeId: string; value?: Bg; onChange: (v: Bg | undefined) => void }) {
  const toast = useUI((s) => s.toast)
  const input = useRef<HTMLInputElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [busy, setBusy] = useState(false)
  const sample = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!value) return
    let live = true
    loadImage(value.url)
      .then((bg) => {
        const c = canvas.current
        if (!live || !c) return
        sample.current ??= sampleProduct()
        const size = 360
        c.width = size
        c.height = size
        drawComposite(c.getContext('2d')!, size, bg, sample.current, value.slot)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [value])

  const pick = async (file: File) => {
    setBusy(true)
    try {
      const data = await readImageFile(file, 'product-hd')
      let url = data
      if (remoteEnabled()) {
        try {
          url = await uploadStorePhoto(storeId, data)
        } catch {
          toast('No se pudo subir a la nube; el fondo queda solo en este navegador.')
        }
      }
      onChange({ url, slot: value?.slot ?? DEFAULT_SLOT })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo usar la imagen.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-sand/40 p-4 sm:col-span-2">
      <div>
        <p className="text-sm font-bold">Fondo de fotos de la tienda</p>
        <p className="text-[12px] text-ink-soft">Un fondo cuadrado con una superficie (podio, mesa, repisa). Los productos se apoyan ahí para que todo el catálogo se vea igual.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Subir fondo"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void pick(f)
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => input.current?.click()}>
          <ImagePlus className="size-4" /> {busy ? 'Subiendo…' : value ? 'Cambiar fondo' : 'Subir fondo'}
        </button>
        {value && (
          <button type="button" className={btn.ghost} onClick={() => onChange(undefined)}>
            <Trash2 className="size-4" /> Quitar fondo
          </button>
        )}
      </div>
      {value && (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
          <canvas ref={canvas} className="aspect-square w-full rounded-2xl ring-1 ring-line" aria-label="Vista previa con un producto de ejemplo" />
          <div className="space-y-3">
            {SLIDERS.map((s) => (
              <label key={s.key} className="block text-xs font-bold text-ink-soft">
                {s.label}
                <input
                  type="range"
                  className="mt-1 w-full accent-brand"
                  min={s.min}
                  max={s.max}
                  value={Math.round(value.slot[s.key] * 100)}
                  onChange={(e) => onChange({ ...value, slot: clampSlot({ ...value.slot, [s.key]: Number(e.target.value) / 100 }) })}
                />
              </label>
            ))}
            <button type="button" className={btn.ghost} onClick={() => onChange({ ...value, slot: DEFAULT_SLOT })}>
              Restablecer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
