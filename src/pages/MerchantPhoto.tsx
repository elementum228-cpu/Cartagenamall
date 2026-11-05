import { Brush, Camera, Loader2, Minus, Move, Plus, RotateCcw, Wand2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Store } from '../domain/types'
import { removeBackground, trimToContent } from '../lib/cutout'
import { readImageFile } from '../lib/image'
import { clampSlot, composeOnBackground, drawComposite, loadImage } from '../lib/studio'
import { remoteEnabled } from '../remote/client'
import { useUI } from '../state/ui'
import { btn } from '../ui/bits'
import { RetouchCutout } from './MerchantRetouch'

export type Fit = { scale: number; dx: number; dy: number }

export interface PhotoState {
  /** Foto final que se muestra en la tienda (data URL mientras se edita, enlace una vez guardada). */
  image: string | null
  original?: string
  cutout?: string
  fit?: { scale: number; dx: number; dy?: number }
}

type Cut = HTMLImageElement | HTMLCanvasElement

const FIT0: Fit = { scale: 1, dx: 0, dy: 0 }
const clampFit = (f: Fit): Fit => ({ scale: Math.min(1.6, Math.max(0.4, f.scale)), dx: Math.min(0.45, Math.max(-0.45, f.dx)), dy: Math.min(0.14, Math.max(-0.55, f.dy)) })
const PREVIEW = 640

/**
 * Foto del producto con estudio: al subirla se quita el fondo y se coloca sobre el fondo de la tienda.
 * El dueño arrastra el producto sobre la vista previa (y lo agranda con el control o pellizcando).
 * Siempre puede volver a la foto original.
 */
export function ProductPhotoField({ store, value, onChange, placeholder }: { store: Store; value: PhotoState; onChange: (v: PhotoState) => void; placeholder: ReactNode }) {
  const toast = useUI((s) => s.toast)
  const bg = store.photoBg
  const file = useRef<HTMLInputElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const cut = useRef<Cut | null>(null)
  /** Recorte completo (mismo encuadre que la foto original): es el que se retoca. `cut` es el mismo, recortado a su contorno. */
  const full = useRef<Cut | null>(null)
  const [retouching, setRetouching] = useState(false)
  const [rev, setRev] = useState(0)
  const setCut = (c: Cut) => {
    full.current = c
    cut.current = trimToContent(c)
  }
  const bgImg = useRef<HTMLImageElement | null>(null)
  const touched = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const [busy, setBusy] = useState<null | 'model' | 'run'>(null)
  const [studio, setStudio] = useState(!!value.cutout)
  const [fit, setFitState] = useState<Fit>({ ...FIT0, ...value.fit })
  const fitRef = useRef(fit)
  const [ready, setReady] = useState(false)
  const [bgReady, setBgReady] = useState(false)
  const [moved, setMoved] = useState(false)

  const setFit = (f: Fit | ((p: Fit) => Fit)) => {
    touched.current = true
    setFitState((p) => {
      const n = clampFit(typeof f === 'function' ? f(p) : f)
      fitRef.current = n
      return n
    })
  }

  // fondo de la tienda, cargado una vez
  useEffect(() => {
    if (!bg) return
    let live = true
    setBgReady(false)
    loadImage(bg.url)
      .then((img) => {
        if (!live) return
        bgImg.current = img
        setBgReady(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [bg?.url])

  // Producto ya recortado de una sesión anterior: se carga para poder reajustarlo.
  useEffect(() => {
    if (!value.cutout || cut.current) return
    let live = true
    loadImage(value.cutout)
      .then((img) => {
        if (!live) return
        setCut(img)
        setReady(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
    // solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const slotFor = (f: Fit) => (bg ? clampSlot({ ...bg.slot, x: bg.slot.x + f.dx, y: bg.slot.y + f.dy, w: bg.slot.w * f.scale, h: bg.slot.h * f.scale }) : null)

  // Vista previa en vivo (inmediata) mientras se arrastra.
  useEffect(() => {
    const c = canvas.current
    const slot = slotFor(fit)
    if (!c || !slot || !bgReady || !ready || !cut.current || !bgImg.current || !studio) return
    c.width = PREVIEW
    c.height = PREVIEW
    drawComposite(c.getContext('2d')!, PREVIEW, bgImg.current, cut.current as Cut & { width: number; height: number }, slot)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, bgReady, ready, studio, rev, retouching, bg?.slot.x, bg?.slot.y, bg?.slot.w, bg?.slot.h])

  // La foto final (la que se guarda) se recompone en alta calidad cuando el ajuste se detiene.
  useEffect(() => {
    if (!touched.current || !ready || !cut.current) return
    const v = valueRef.current
    if (!studio || !bg) {
      if (v.original) onChange({ ...v, image: v.original, fit })
      return
    }
    let live = true
    const t = setTimeout(async () => {
      try {
        const out = await composeOnBackground(bg.url, cut.current as Cut & { width: number; height: number }, slotFor(fit)!)
        if (live) onChange({ ...valueRef.current, image: out, fit })
      } catch {
        if (live) toast('No se pudo cargar el fondo de la tienda.', 'error')
      }
    }, 350)
    return () => {
      live = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio, fit, ready, rev, bg?.url, bg?.slot.x, bg?.slot.y, bg?.slot.w, bg?.slot.h])

  const pick = async (f: File) => {
    try {
      setBusy('run')
      const original = await readImageFile(f, remoteEnabled() ? 'product-hd' : 'product')
      touched.current = true
      cut.current = null
      full.current = null
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
        setCut(c)
        setFit(FIT0)
        setMoved(false)
        setStudio(true)
        onChange({ image: original, original, cutout: c.toDataURL('image/png'), fit: FIT0 })
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

  // Arrastrar con el dedo o el mouse; con dos dedos se agranda o se achica.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; scale: number } | null>(null)
  const dist = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) pinch.current = { d: dist(), scale: fitRef.current.scale }
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const rect = e.currentTarget.getBoundingClientRect()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setMoved(true)
    if (pointers.current.size >= 2 && pinch.current) {
      const k = dist() / pinch.current.d
      setFit((f) => ({ ...f, scale: pinch.current!.scale * k }))
    } else {
      setFit((f) => ({ ...f, dx: f.dx + (e.clientX - prev.x) / rect.width, dy: f.dy + (e.clientY - prev.y) / rect.height }))
    }
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  const onKey = (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? 0.04 : 0.01
    const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key]
    if (d) {
      e.preventDefault()
      setMoved(true)
      setFit((f) => ({ ...f, dx: f.dx + d[0], dy: f.dy + d[1] }))
    }
  }

  const hasCut = ready && !!value.cutout && !!bg
  const showStudio = hasCut && studio
  const touch = () => (touched.current = true)

  if (retouching && full.current)
    return (
      <RetouchCutout
        cutout={full.current}
        original={value.original}
        onCancel={() => setRetouching(false)}
        onDone={(c) => {
          const copy = document.createElement('canvas')
          copy.width = c.width
          copy.height = c.height
          copy.getContext('2d')!.drawImage(c, 0, 0)
          touched.current = true
          setCut(copy)
          onChange({ ...valueRef.current, cutout: copy.toDataURL('image/png') })
          setRev((r) => r + 1)
          setRetouching(false)
        }}
      />
    )

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-[340px]">
        <div
          className={`relative aspect-square w-full overflow-hidden rounded-3xl ring-1 ring-line ${showStudio ? 'cursor-grab touch-none select-none active:cursor-grabbing' : ''}`}
          {...(showStudio ? { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp, onKeyDown: onKey, tabIndex: 0, role: 'application', 'aria-label': 'Vista previa de la foto. Arrastra para mover el producto; con las flechas del teclado también.' } : {})}
        >
          {showStudio ? (
            <canvas ref={canvas} className="size-full" />
          ) : value.image ? (
            <img src={value.image} alt="Foto del artículo" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center bg-sand/60 [&>*]:size-full">{placeholder}</div>
          )}
          {showStudio && !moved && (
            <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink/75 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm">
              <Move className="size-3.5" /> Arrastra para acomodar
            </span>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-white/85 p-4 text-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-[13px] font-bold text-ink-soft">
                <Loader2 className="size-7 animate-spin text-brand" />
                {busy === 'model' ? 'Preparando el recortador… solo la primera vez' : 'Quitando el fondo…'}
              </div>
            </div>
          )}
        </div>
      </div>

      {showStudio && (
        <div className="mx-auto w-full max-w-[340px] space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" className={`${btn.icon} !size-9`} aria-label="Achicar" onClick={() => setFit((f) => ({ ...f, scale: f.scale - 0.05 }))}>
              <Minus className="size-4" />
            </button>
            <input
              type="range"
              aria-label="Tamaño del producto"
              className="w-full accent-brand"
              min={40}
              max={160}
              value={Math.round(fit.scale * 100)}
              onChange={(e) => setFit((f) => ({ ...f, scale: Number(e.target.value) / 100 }))}
            />
            <button type="button" className={`${btn.icon} !size-9`} aria-label="Agrandar" onClick={() => setFit((f) => ({ ...f, scale: f.scale + 0.05 }))}>
              <Plus className="size-4" />
            </button>
          </div>
          <div className="flex justify-center gap-0.5">
            <button type="button" className={`${btn.ghost} !px-2.5 !py-1.5 text-[13px] font-bold text-brand`} onClick={() => setRetouching(true)}>
              <Brush className="size-3.5" /> Retocar recorte
            </button>
            <button type="button" className={`${btn.ghost} !px-2.5 !py-1.5 text-[13px]`} onClick={() => setFit((f) => ({ ...f, dx: 0 }))}>
              Centrar
            </button>
            <button
              type="button"
              className={`${btn.ghost} !px-2.5 !py-1.5 text-[13px]`}
              onClick={() => {
                setFit(FIT0)
                setMoved(false)
              }}
            >
              <RotateCcw className="size-3.5" /> Restablecer
            </button>
          </div>
        </div>
      )}

      {hasCut && (
        <div role="group" aria-label="Tipo de foto" className="mx-auto grid max-w-[340px] grid-cols-2 gap-1 rounded-full bg-white p-1 ring-1 ring-line">
          {(
            [
              [true, 'Con fondo de la tienda'],
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
              full.current = null
              setReady(false)
              setStudio(false)
              onChange({ image: null })
            }}
          >
            <X className="size-4" /> Quitar foto
          </button>
        )}
      </div>

      {!bg && !value.image && <p className="text-center text-[11px] text-ink-soft">Tip: sube el fondo de tu tienda en Perfil y tus fotos se recortan solas y quedan todas iguales.</p>}
    </div>
  )
}
