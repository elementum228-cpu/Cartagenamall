import { ImageUp, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { StadiumEventKind } from '../config/stadium'
import { readImageFile, type ImageKind } from '../lib/image'
import { remoteEnabled } from '../remote/client'
import { uploadStadiumImage } from '../remote/photos'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'
import { DEFAULT_FIT, MAX_ZOOM, MIN_ZOOM, boardWhen, type BoardTeam, type EventBoard, type ImageFit } from './board'
import { BOARD_H, BOARD_W, crestBox, paintBoard } from './boardPaint'

// Editor del cartel del estadio. En un partido se cargan los dos escudos y los nombres de los equipos; en un
// concierto, la imagen del artista o del evento. Abajo se ve cómo quedará el cartel (el mismo dibujo del estadio).

/** Sube la imagen (reducida) a la base de datos o, sin ella (demostración), la deja en este navegador. */
async function storeImage(file: File, kind: ImageKind): Promise<string> {
  const data = await readImageFile(file, kind)
  return remoteEnabled() ? uploadStadiumImage(data) : data
}

function ImagePick({ label, value, kind, aspect, onChange }: { label: string; value: string | null; kind: ImageKind; aspect: string; onChange: (url: string | null) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const toast = useUI((s) => s.toast)
  return (
    <div>
      <p className="text-xs font-bold text-ink-soft">{label}</p>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setBusy(true)
          try {
            onChange(await storeImage(f, kind))
          } catch (err) {
            toast(err instanceof Error ? err.message : 'No se pudo cargar la imagen.', 'error')
          } finally {
            setBusy(false)
          }
        }}
      />
      <div className="mt-1 flex items-center gap-3">
        <div className="grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-sand" style={{ aspectRatio: aspect, height: 72 }}>
          {value ? <img src={value} alt="" className="size-full object-contain" /> : <ImageUp className="size-5 text-ink-soft" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn.secondary} disabled={busy} onClick={() => file.current?.click()}>
            <ImageUp className="size-4" /> {busy ? 'Subiendo…' : value ? 'Cambiar' : 'Subir'}
          </button>
          {value && (
            <button className={btn.ghost} onClick={() => onChange(null)}>
              <Trash2 className="size-4" /> Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TeamFields({ title, team, onChange }: { title: string; team: BoardTeam; onChange: (t: BoardTeam) => void }) {
  return (
    <div className="space-y-2 rounded-2xl bg-sand p-3">
      <p className="text-xs font-bold text-ink-soft uppercase">{title}</p>
      <input
        className={input}
        value={team.name}
        maxLength={40}
        placeholder="Nombre del equipo"
        aria-label={`Nombre del equipo ${title.toLowerCase()}`}
        onChange={(e) => onChange({ ...team, name: e.target.value })}
      />
      <ImagePick label="Escudo (PNG con fondo transparente se ve mejor)" value={team.crest} kind="crest" aspect="0.9" onChange={(crest) => onChange({ ...team, crest })} />
      <label className="block text-xs font-bold text-ink-soft">
        Tamaño del escudo · {Math.round((team.fit?.zoom ?? 1) * 100)} %
        <input
          type="range"
          className="mt-1 w-full accent-brand"
          min={40}
          max={200}
          value={Math.round((team.fit?.zoom ?? 1) * 100)}
          aria-label={`Tamaño del escudo ${title.toLowerCase()}`}
          onChange={(e) => onChange({ ...team, fit: { ...(team.fit ?? DEFAULT_FIT), zoom: Number(e.target.value) / 100 } })}
        />
      </label>
      {team.fit && (team.fit.x !== 0 || team.fit.y !== 0 || team.fit.zoom !== 1) && (
        <button className={btn.ghost} onClick={() => onChange({ ...team, fit: DEFAULT_FIT })}>
          Restablecer escudo
        </button>
      )}
    </div>
  )
}

/** Vista previa en vivo: dibuja el cartel tal como saldrá en el estadio. */
/**
 * Vista previa en vivo: dibuja el cartel tal como saldrá en el estadio. En un concierto con imagen, se puede
 * arrastrar para moverla (con el dedo o el mouse).
 */
function Preview({ kind, board, title, startsAt, onFit }: { kind: StadiumEventKind; board: EventBoard; title: string; startsAt?: string; onFit?: (f: ImageFit, side: 'image' | 'home' | 'away') => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ px: number; py: number; fit: ImageFit; side: 'image' | 'home' | 'away' } | null>(null)
  useEffect(() => {
    if (ref.current)
      void paintBoard(ref.current, {
        kind,
        board,
        title,
        when: boardWhen(startsAt),
      })
  }, [kind, board, title, startsAt])
  const movable = !!onFit && (kind === 'match' || !!board.image)
  return (
    <canvas
      ref={ref}
      width={BOARD_W}
      height={BOARD_H}
      className={`w-full rounded-2xl border border-line bg-black ${movable ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
      aria-label="Vista previa del cartel"
      onPointerDown={(e) => {
        if (!movable) return
        e.currentTarget.setPointerCapture(e.pointerId)
        let side: 'image' | 'home' | 'away' = 'image'
        if (kind === 'match') {
          // se mueve el escudo que esté más cerca del dedo
          const r = e.currentTarget.getBoundingClientRect()
          const x = ((e.clientX - r.left) / r.width) * BOARD_W
          const y = ((e.clientY - r.top) / r.height) * BOARD_H
          const h = crestBox(board.home, 'home')
          const a = crestBox(board.away, 'away')
          side = Math.hypot(x - h.cx, y - h.cy) <= Math.hypot(x - a.cx, y - a.cy) ? 'home' : 'away'
        }
        const base = side === 'image' ? board.fit : board[side].fit
        drag.current = { px: e.clientX, py: e.clientY, fit: base ?? DEFAULT_FIT, side }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || !onFit) return
        const r = e.currentTarget.getBoundingClientRect()
        // arrastrar a la derecha mueve la imagen a la derecha (en fracción del cartel)
        onFit({ ...d.fit, x: d.fit.x + (e.clientX - d.px) / r.width, y: d.fit.y + (e.clientY - d.py) / r.height }, d.side)
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    />
  )
}

export function BoardEditor({
  kind,
  value,
  onChange,
  title,
  startsAt,
}: {
  kind: StadiumEventKind
  value: EventBoard
  onChange: (b: EventBoard) => void
  title: string
  startsAt?: string
}) {
  return (
    <div className="space-y-3">
      {kind === 'match' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <TeamFields title="Local" team={value.home} onChange={(home) => onChange({ ...value, home })} />
          <TeamFields title="Visitante" team={value.away} onChange={(away) => onChange({ ...value, away })} />
        </div>
      ) : (
        <ImagePick
          label="Imagen del artista o del evento (se proyecta en todo el cartel)"
          value={value.image}
          kind="poster"
          aspect="2.28"
          onChange={(image) => onChange({ ...value, image, fit: DEFAULT_FIT })}
        />
      )}
      <label className="block text-xs font-bold text-ink-soft">
        Texto corto bajo el cartel (opcional)
        <input
          className={`${input} mt-1`}
          value={value.caption}
          maxLength={80}
          placeholder={kind === 'match' ? 'Liga BetPlay · Fecha 12' : 'Gira Caribe 2026'}
          onChange={(e) => onChange({ ...value, caption: e.target.value })}
        />
      </label>
      <div>
        <p className="mb-1 text-xs font-bold text-ink-soft">Así se verá en el estadio</p>
        <Preview kind={kind} board={value} title={title} startsAt={startsAt} onFit={(fit, side) => onChange(side === 'image' ? { ...value, fit } : { ...value, [side]: { ...value[side], fit } })} />
        {kind === 'match' && <p className="mt-2 text-[11px] text-ink-soft">Arrastra cada escudo sobre la vista previa para acomodarlo y usa el control de tamaño de cada equipo.</p>}
        {kind === 'concert' && value.image && (
          <div className="mt-2 space-y-2 rounded-2xl bg-sand p-3">
            <p className="text-[11px] text-ink-soft">Arrastra la imagen sobre la vista previa para moverla. Con el control puedes hacerla más pequeña (se rellena con la misma imagen desenfocada) o acercarla.</p>
            <label className="block text-xs font-bold text-ink-soft">
              Tamaño · {Math.round((value.fit?.zoom ?? 1) * 100)} %
              <input
                type="range"
                className="mt-1 w-full accent-brand"
                min={Math.round(MIN_ZOOM * 100)}
                max={MAX_ZOOM * 100}
                value={Math.round((value.fit?.zoom ?? 1) * 100)}
                aria-label="Tamaño de la imagen"
                onChange={(e) => onChange({ ...value, fit: { ...(value.fit ?? DEFAULT_FIT), zoom: Number(e.target.value) / 100 } })}
              />
            </label>
            <button className={btn.ghost} onClick={() => onChange({ ...value, fit: DEFAULT_FIT })}>
              Restablecer encuadre
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
