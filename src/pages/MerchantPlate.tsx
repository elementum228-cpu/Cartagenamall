import { Camera, Crosshair, Loader2, Minus, Move, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { readImageFile } from '../lib/image'
import { PLATE_FIT0, autoPlateFit, clampPlateFit, cropPlate, findFood, plateWindow, type PlateFit } from '../lib/plate'
import { loadImage } from '../lib/studio'
import { remoteEnabled } from '../remote/client'
import { useUI } from '../state/ui'
import { btn } from '../ui/bits'
import type { PhotoState } from './MerchantPhoto'

const PREVIEW = 520

/** Busca la comida en la foto y devuelve el ajuste que la deja centrada y llenando el plato. */
function autoFit(img: HTMLImageElement): PlateFit {
  const k = 96 / Math.max(img.naturalWidth, img.naturalHeight)
  const w = Math.max(8, Math.round(img.naturalWidth * k))
  const h = Math.max(8, Math.round(img.naturalHeight * k))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, w, h)
  return autoPlateFit(findFood(g.getImageData(0, 0, w, h).data, w, h), img.naturalWidth, img.naturalHeight)
}

/**
 * Foto de un plato del menú: la foto se recorta en un círculo (como se ve en el local) y se centra sola sobre la
 * comida. El dueño la mueve arrastrando y la acerca con el control. Siempre puede volver al ajuste automático.
 */
export function PlatePhotoField({ value, onChange, placeholder }: { value: PhotoState; onChange: (v: PhotoState) => void; placeholder: ReactNode }) {
  const toast = useUI((s) => s.toast)
  const file = useRef<HTMLInputElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const src = useRef<HTMLImageElement | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [moved, setMoved] = useState(false)
  const [fit, setFitState] = useState<PlateFit>(value.plate ?? PLATE_FIT0)
  const fitRef = useRef(fit)
  const touched = useRef(false)
  const auto = useRef<PlateFit>(PLATE_FIT0)

  const setFit = (f: PlateFit | ((p: PlateFit) => PlateFit)) => {
    touched.current = true
    setFitState((p) => {
      const n = clampPlateFit(typeof f === 'function' ? f(p) : f)
      fitRef.current = n
      return n
    })
  }

  // foto de partida de un plato que ya existía: la original (o la final, si no se guardó la original)
  const sourceUrl = value.original ?? value.image
  useEffect(() => {
    if (!sourceUrl || src.current) return
    let live = true
    loadImage(sourceUrl)
      .then((img) => {
        if (!live) return
        src.current = img
        auto.current = autoFit(img)
        setReady(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
    // solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // vista previa en vivo
  useEffect(() => {
    const c = canvas.current
    const img = src.current
    if (!c || !img || !ready) return
    c.width = PREVIEW
    c.height = PREVIEW
    const win = plateWindow(img.naturalWidth, img.naturalHeight, fit)
    c.getContext('2d')!.drawImage(img, win.x, win.y, win.side, win.side, 0, 0, PREVIEW, PREVIEW)
  }, [fit, ready])

  // la foto final se recorta en buena calidad cuando el ajuste se detiene
  useEffect(() => {
    if (!touched.current || !ready || !src.current) return
    const t = setTimeout(() => {
      try {
        onChange({ ...valueRef.current, image: cropPlate(src.current!, fit), plate: fit, studio: false })
      } catch {
        toast('No se pudo recortar la foto.', 'error')
      }
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, ready])

  const pick = async (f: File) => {
    try {
      setBusy(true)
      const original = await readImageFile(f, remoteEnabled() ? 'product-hd' : 'product')
      const img = await loadImage(original)
      src.current = img
      const a = autoFit(img)
      auto.current = a
      touched.current = true
      setMoved(false)
      setFitState(a)
      fitRef.current = a
      setReady(true)
      onChange({ image: cropPlate(img, a), original, plate: a, studio: false })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo usar la imagen.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // arrastrar para mover la foto dentro del plato
  const drag = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = drag.current
    if (!p) return
    const r = e.currentTarget.getBoundingClientRect()
    drag.current = { x: e.clientX, y: e.clientY }
    setMoved(true)
    // la foto se mueve con el dedo: el centro de la ventana va al lado contrario
    setFit((f) => ({ ...f, dx: f.dx - ((e.clientX - p.x) / r.width) / f.scale, dy: f.dy - ((e.clientY - p.y) / r.height) / f.scale }))
  }
  const onUp = () => (drag.current = null)
  const onKey = (e: React.KeyboardEvent) => {
    const s = (e.shiftKey ? 0.05 : 0.01) / fitRef.current.scale
    const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key]
    if (d) {
      e.preventDefault()
      setMoved(true)
      setFit((f) => ({ ...f, dx: f.dx + d[0], dy: f.dy + d[1] }))
    }
  }

  const editable = ready && !!src.current
  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-[300px]">
        {/* el plato como se verá en el local: loza, surco y la comida adentro */}
        <div className="relative aspect-square w-full rounded-full p-[7%] shadow-[0_26px_36px_-16px_rgba(0,0,0,0.55)]" style={{ background: 'radial-gradient(circle at 34% 28%, #ffffff 0%, #f6f0e6 45%, #ddd2bf 100%)' }}>
          <span aria-hidden className="absolute inset-[3.5%] rounded-full border border-black/[0.07]" style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.10)' }} />
          <div
            className={`relative size-full overflow-hidden rounded-full bg-sand ${editable ? 'cursor-grab touch-none select-none active:cursor-grabbing' : ''}`}
            style={{ boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.08), inset 0 6px 14px rgba(0,0,0,0.22)' }}
            {...(editable ? { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp, onKeyDown: onKey, tabIndex: 0, role: 'application', 'aria-label': 'Vista previa del plato. Arrastra para mover la foto; con las flechas del teclado también.' } : {})}
          >
            {editable ? (
              <canvas ref={canvas} className="size-full" />
            ) : value.image ? (
              <img src={value.image} alt="Foto del plato" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center [&>*]:size-1/2">{placeholder}</div>
            )}
            {editable && !moved && (
              <span className="pointer-events-none absolute bottom-[14%] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink/75 px-3 py-1.5 text-[11.5px] font-bold whitespace-nowrap text-white backdrop-blur-sm">
                <Move className="size-3.5" /> Arrastra para acomodar
              </span>
            )}
            {busy && (
              <div className="absolute inset-0 grid place-items-center bg-white/85 backdrop-blur-sm">
                <Loader2 className="size-7 animate-spin text-brand" />
              </div>
            )}
          </div>
        </div>
      </div>

      {editable && (
        <div className="mx-auto w-full max-w-[340px] space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" className={`${btn.icon} !size-9`} aria-label="Alejar" onClick={() => setFit((f) => ({ ...f, scale: f.scale - 0.1 }))}>
              <Minus className="size-4" />
            </button>
            <input type="range" aria-label="Acercar la foto" className="w-full accent-brand" min={100} max={300} value={Math.round(fit.scale * 100)} onChange={(e) => setFit((f) => ({ ...f, scale: Number(e.target.value) / 100 }))} />
            <button type="button" className={`${btn.icon} !size-9`} aria-label="Acercar" onClick={() => setFit((f) => ({ ...f, scale: f.scale + 0.1 }))}>
              <Plus className="size-4" />
            </button>
          </div>
          <div className="flex justify-center gap-0.5">
            <button
              type="button"
              className={`${btn.ghost} !px-2.5 !py-1.5 text-[13px] font-bold text-brand`}
              onClick={() => {
                setFit(auto.current)
                setMoved(false)
              }}
            >
              <Crosshair className="size-3.5" /> Centrar en la comida
            </button>
            <button
              type="button"
              className={`${btn.ghost} !px-2.5 !py-1.5 text-[13px]`}
              onClick={() => {
                setFit(PLATE_FIT0)
                setMoved(false)
              }}
            >
              <RotateCcw className="size-3.5" /> Foto completa
            </button>
          </div>
        </div>
      )}

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
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => file.current?.click()}>
          <Camera className="size-4" /> {value.image ? 'Cambiar foto' : 'Subir foto del plato'}
        </button>
        {value.image && (
          <button
            type="button"
            className={btn.ghost}
            onClick={() => {
              touched.current = false
              src.current = null
              setReady(false)
              onChange({ image: null })
            }}
          >
            <X className="size-4" /> Quitar foto
          </button>
        )}
      </div>
      {!value.image && <p className="text-center text-[11px] text-ink-soft">Tip: una foto del plato desde arriba, con la comida al centro, se ve mejor. El resto lo centramos solos.</p>}
    </div>
  )
}
