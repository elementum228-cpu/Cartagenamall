import { Check, Eraser, Hand, Minus, Plus, RotateCcw, Undo2, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { loadImage } from '../lib/studio'
import { btn } from '../ui/bits'

type Tool = 'erase' | 'restore' | 'move'

const CHECKER = 'repeating-conic-gradient(#e7e5e0 0% 25%, #ffffff 0% 50%) 0 0 / 18px 18px'

/**
 * Retoque del recorte: se ve el producto sobre cuadros (así se nota lo transparente) y se corrige con un pincel.
 * Borrar quita lo que sobra (restos del fondo); Restaurar devuelve partes de la foto original.
 */
export function RetouchCutout({ cutout, original, onDone, onCancel }: { cutout: HTMLCanvasElement | HTMLImageElement; original?: string; onDone: (c: HTMLCanvasElement) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const orig = useRef<HTMLCanvasElement | null>(null)
  const auto = useRef<ImageData | null>(null)
  const history = useRef<ImageData[]>([])
  const last = useRef<{ x: number; y: number } | null>(null)
  const [tool, setTool] = useState<Tool>('erase')
  const [size, setSize] = useState(28)
  const [zoom, setZoom] = useState(1)
  const [canRestore, setCanRestore] = useState(false)
  const [undoable, setUndoable] = useState(false)
  const [ready, setReady] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const w = 'naturalWidth' in cutout ? cutout.naturalWidth : cutout.width
  const h = 'naturalHeight' in cutout ? cutout.naturalHeight : cutout.height

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(cutout, 0, 0)
    auto.current = ctx.getImageData(0, 0, w, h)
    setReady(true)
    if (!original) return
    let live = true
    loadImage(original)
      .then((img) => {
        if (!live) return
        const ow = img.naturalWidth
        const oh = img.naturalHeight
        // Recortes guardados antes del retoque venían recortados al contorno: no coinciden con la original.
        if (Math.abs(ow / oh - w / h) > 0.02) return
        const oc = document.createElement('canvas')
        oc.width = w
        oc.height = h
        oc.getContext('2d')!.drawImage(img, 0, 0, w, h)
        orig.current = oc
        setCanRestore(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
    // solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h, px: e.clientX - r.left, py: e.clientY - r.top }
  }

  const snapshot = () => {
    const ctx = canvas.current!.getContext('2d')!
    history.current.push(ctx.getImageData(0, 0, w, h))
    if (history.current.length > 20) history.current.shift()
    setUndoable(true)
  }

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvas.current!.getContext('2d')!
    // el tamaño del pincel se mide en píxeles de pantalla; aquí se pasa a píxeles de la imagen
    const k = w / canvas.current!.getBoundingClientRect().width
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * k
    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = '#000'
    } else if (orig.current) {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = ctx.createPattern(orig.current, 'no-repeat')!
    }
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x + 0.01, to.y)
    ctx.stroke()
    ctx.restore()
  }

  const onDown = (e: React.PointerEvent) => {
    if (tool === 'move' || !ready) return
    e.currentTarget.setPointerCapture(e.pointerId)
    snapshot()
    const p = point(e)
    last.current = p
    stroke(p, p)
  }
  const onMove = (e: React.PointerEvent) => {
    const p = point(e)
    setCursor({ x: p.px, y: p.py })
    if (!last.current || tool === 'move') return
    stroke(last.current, p)
    last.current = p
  }
  const onUp = () => (last.current = null)

  const undo = () => {
    const prev = history.current.pop()
    if (prev) canvas.current!.getContext('2d')!.putImageData(prev, 0, 0)
    setUndoable(history.current.length > 0)
  }
  const reset = () => {
    if (!auto.current) return
    snapshot()
    canvas.current!.getContext('2d')!.putImageData(auto.current, 0, 0)
  }

  const tools: { id: Tool; label: string; icon: typeof Eraser; off?: boolean }[] = [
    { id: 'erase', label: 'Borrar', icon: Eraser },
    { id: 'restore', label: 'Restaurar', icon: Wand2, off: !canRestore },
    { id: 'move', label: 'Mover', icon: Hand, off: zoom <= 1 },
  ]

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold">Retocar recorte</p>
        <p className="text-[12px] text-ink-soft">
          Los cuadros son lo que quedó transparente. <b>Borra</b> lo que sobre (restos del fondo) y <b>restaura</b> lo que se haya ido de más.
        </p>
      </div>

      <div className="mx-auto w-full max-w-[340px] overflow-auto rounded-2xl ring-1 ring-line" style={{ maxHeight: 340, background: CHECKER }}>
        <div className="relative" style={{ width: `${zoom * 100}%` }}>
          <canvas
            ref={canvas}
            className={`block w-full ${tool === 'move' ? 'cursor-grab' : 'cursor-none touch-none'}`}
            style={{ aspectRatio: `${w} / ${h}` }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setCursor(null)}
            aria-label="Recorte del producto"
          />
          {cursor && tool !== 'move' && (
            <span className="pointer-events-none absolute rounded-full border-2 border-white bg-brand/25 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" style={{ width: size, height: size, left: cursor.x - size / 2, top: cursor.y - size / 2 }} />
          )}
        </div>
      </div>

      <div role="group" aria-label="Herramienta" className="mx-auto grid max-w-[420px] grid-cols-3 gap-1 rounded-full bg-white p-1 ring-1 ring-line">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={t.off}
            aria-pressed={tool === t.id}
            onClick={() => setTool(t.id)}
            className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[12.5px] font-bold transition disabled:opacity-35 ${tool === t.id ? 'bg-ink text-white' : 'text-ink-soft'}`}
          >
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {!canRestore && <p className="text-center text-[11px] text-ink-soft">Restaurar solo está disponible en recortes hechos con esta versión: sube la foto otra vez para usarlo.</p>}

      <div className="mx-auto grid max-w-[420px] gap-2">
        <label className="flex items-center gap-3 text-xs font-bold text-ink-soft">
          <span className="w-14 shrink-0">Pincel</span>
          <input type="range" className="w-full accent-brand" min={8} max={90} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Tamaño del pincel" />
        </label>
        <div className="flex items-center gap-3 text-xs font-bold text-ink-soft">
          <span className="w-14 shrink-0">Zoom</span>
          <button type="button" className={`${btn.icon} !size-8`} aria-label="Alejar" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}>
            <Minus className="size-4" />
          </button>
          <input type="range" className="w-full accent-brand" min={100} max={400} value={zoom * 100} onChange={(e) => setZoom(Number(e.target.value) / 100)} aria-label="Zoom" />
          <button type="button" className={`${btn.icon} !size-8`} aria-label="Acercar" onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(1)))}>
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className={btn.ghost} disabled={!undoable} onClick={undo}>
          <Undo2 className="size-4" /> Deshacer
        </button>
        <button type="button" className={btn.ghost} onClick={reset}>
          <RotateCcw className="size-4" /> Volver al recorte automático
        </button>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={btn.secondary} onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={btn.primary} onClick={() => onDone(canvas.current!)}>
          <Check className="size-4" /> Listo
        </button>
      </div>
    </div>
  )
}
