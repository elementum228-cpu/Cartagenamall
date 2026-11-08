import { ImageUp, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { StadiumEventKind } from '../config/stadium'
import { readImageFile, type ImageKind } from '../lib/image'
import { removeWhiteBackground } from '../lib/whiteCutout'
import { remoteEnabled } from '../remote/client'
import { uploadStadiumImage } from '../remote/photos'
import { useUI } from '../state/ui'
import { btn, input } from '../ui/bits'
import { DEFAULT_FIT, MAX_ZOOM, MIN_ZOOM, TEXT_IDS, TEXT_LABELS, TEXT_MAX, TEXT_MIN, boardWhen, type BoardText, type BoardTeam, type EventBoard, type TextId } from './board'
import { BOARD_H, BOARD_W, boardElements, crestBox, paintBoard, textContent, type BoardInput } from './boardPaint'

// Editor del cartel del estadio. En un partido se cargan los dos escudos y los nombres de los equipos; en un
// concierto, la imagen del artista o del evento. Abajo se ve cómo quedará el cartel (el mismo dibujo del estadio).

/** Sube la imagen (reducida) a la base de datos o, sin ella (demostración), la deja en este navegador. */
async function storeImage(file: File, kind: ImageKind): Promise<string> {
  let data = await readImageFile(file, kind)
  // los escudos se suben sin fondo blanco: se ven sin recuadro sobre el cartel
  if (kind === 'crest') data = await removeWhiteBackground(data)
  return remoteEnabled() ? uploadStadiumImage(data) : data
}

/** Quita el fondo blanco de una imagen ya subida y la vuelve a guardar. */
async function cutExisting(url: string): Promise<string> {
  const data = await removeWhiteBackground(url)
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
  const [busy, setBusy] = useState(false)
  const toast = useUI((s) => s.toast)
  return (
    <div className="space-y-2 rounded-2xl bg-sand p-3">
      <p className="text-xs font-bold text-ink-soft uppercase">{title}</p>
      <input
        className={input}
        value={team.name}
        maxLength={40}
        placeholder="Nombre del equipo (solo se usa si no hay escudo)"
        aria-label={`Nombre del equipo ${title.toLowerCase()}`}
        onChange={(e) => onChange({ ...team, name: e.target.value })}
      />
      <ImagePick label="Escudo (se quita el fondo blanco solo)" value={team.crest} kind="crest" aspect="0.9" onChange={(crest) => onChange({ ...team, crest })} />
      {team.crest && (
        <button
          className={btn.ghost}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              onChange({ ...team, crest: await cutExisting(team.crest!) })
            } catch (e) {
              toast(e instanceof Error ? e.message : 'No se pudo quitar el fondo.', 'error')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Quitando el fondo…' : 'Quitar fondo blanco'}
        </button>
      )}
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

type Piece = 'image' | 'home' | 'away' | TextId

/** Aplica un movimiento (en fracción del cartel) a una pieza del cartel. */
function moved(board: EventBoard, piece: Piece, from: { x: number; y: number }, dx: number, dy: number): EventBoard {
  const x = from.x + dx
  const y = from.y + dy
  if (piece === 'image') return { ...board, fit: { ...(board.fit ?? DEFAULT_FIT), x, y } }
  if (piece === 'home' || piece === 'away') return { ...board, [piece]: { ...board[piece], fit: { ...(board[piece].fit ?? DEFAULT_FIT), x, y } } }
  return { ...board, texts: { ...board.texts, [piece]: { ...board.texts?.[piece], x, y } } }
}

/** Posición actual (en fracción del cartel) de una pieza. */
function pieceOffset(board: EventBoard, piece: Piece): { x: number; y: number } {
  if (piece === 'image') return { x: board.fit?.x ?? 0, y: board.fit?.y ?? 0 }
  if (piece === 'home' || piece === 'away') return { x: board[piece].fit?.x ?? 0, y: board[piece].fit?.y ?? 0 }
  return { x: board.texts?.[piece]?.x ?? 0, y: board.texts?.[piece]?.y ?? 0 }
}

/**
 * Vista previa en vivo: dibuja el cartel tal como saldrá en el estadio. Se arrastra lo que esté más cerca del
 * dedo: un escudo, un texto o, si no hay nada cerca, la imagen del concierto.
 */
function Preview({ input: inp, board, onBoard }: { input: BoardInput; board: EventBoard; onBoard: (b: EventBoard) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ px: number; py: number; piece: Piece; from: { x: number; y: number }; base: EventBoard } | null>(null)
  useEffect(() => {
    if (ref.current) void paintBoard(ref.current, inp)
  }, [inp])
  const movable = inp.kind === 'match' || !!board.image || boardElements(inp).length > 0
  return (
    <canvas
      ref={ref}
      width={BOARD_W}
      height={BOARD_H}
      className={`w-full rounded-2xl border border-line bg-black ${movable ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
      aria-label="Vista previa del cartel"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - r.left) / r.width) * BOARD_W
        const y = ((e.clientY - r.top) / r.height) * BOARD_H
        // lo más cercano al dedo; si no hay nada a menos de 140 px, se mueve la imagen del concierto
        let piece: Piece | null = null
        let best = 140
        for (const el of boardElements(inp)) {
          const reach = el.id === 'home' || el.id === 'away' ? crestBox(board[el.id], el.id).size / 2 : 0
          const d = Math.max(0, Math.hypot(x - el.cx, y - el.cy) - reach)
          if (d < best) {
            best = d
            piece = el.id
          }
        }
        if (!piece && inp.kind === 'concert' && board.image) piece = 'image'
        if (!piece) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { px: e.clientX, py: e.clientY, piece, from: pieceOffset(board, piece), base: board }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const r = e.currentTarget.getBoundingClientRect()
        onBoard(moved(d.base, d.piece, d.from, (e.clientX - d.px) / r.width, (e.clientY - d.py) / r.height))
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    />
  )
}

/** Un texto del cartel: su contenido, tamaño y si se muestra. Cada texto es independiente de los demás. */
function TextRow({ id, board, input: inp, onChange }: { id: TextId; board: EventBoard; input: BoardInput; onChange: (b: EventBoard) => void }) {
  const cfg: BoardText = board.texts?.[id] ?? {}
  const set = (patch: Partial<BoardText>) => onChange({ ...board, texts: { ...board.texts, [id]: { ...cfg, ...patch } } })
  // lo que diría si no se escribe nada (sin considerar si está oculto)
  const fallback = textContent(id, { ...inp, board: { ...board, texts: { ...board.texts, [id]: { ...cfg, text: '', hidden: false } } } })
  const own = id === 'caption' ? board.caption : (cfg.text ?? '')
  return (
    <li className="space-y-1.5 rounded-2xl bg-sand p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-ink-soft uppercase">{TEXT_LABELS[id]}</p>
        <label className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
          <input type="checkbox" checked={!cfg.hidden} onChange={(e) => set({ hidden: e.target.checked ? undefined : true })} aria-label={`Mostrar ${TEXT_LABELS[id]}`} /> Mostrar
        </label>
      </div>
      <input
        className={input}
        value={own}
        maxLength={80}
        placeholder={fallback || 'Escribe el texto'}
        aria-label={`Texto: ${TEXT_LABELS[id]}`}
        onChange={(e) => (id === 'caption' ? onChange({ ...board, caption: e.target.value }) : set({ text: e.target.value }))}
      />
      <label className="block text-[11px] font-bold text-ink-soft">
        Tamaño · {Math.round((cfg.zoom ?? 1) * 100)} %
        <input
          type="range"
          className="mt-1 w-full accent-brand"
          min={Math.round(TEXT_MIN * 100)}
          max={TEXT_MAX * 100}
          value={Math.round((cfg.zoom ?? 1) * 100)}
          aria-label={`Tamaño: ${TEXT_LABELS[id]}`}
          onChange={(e) => set({ zoom: Number(e.target.value) / 100 })}
        />
      </label>
      {(cfg.x || cfg.y || cfg.zoom) && (
        <button className={btn.ghost} onClick={() => onChange({ ...board, texts: { ...board.texts, [id]: { ...cfg, x: undefined, y: undefined, zoom: undefined } } })}>
          Restablecer posición y tamaño
        </button>
      )}
    </li>
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
  const inp: BoardInput = { kind, board: value, title, when: boardWhen(startsAt) }
  const ids = TEXT_IDS.filter((id) => id !== 'vs' || kind === 'match')
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
      <div>
        <p className="mb-1 text-xs font-bold text-ink-soft">Así se verá en el estadio</p>
        <Preview input={inp} board={value} onBoard={onChange} />
        <p className="mt-2 text-[11px] text-ink-soft">
          Arrastra sobre la vista previa lo que quieras mover: {kind === 'match' ? 'los escudos y ' : ''}cada texto. {kind === 'concert' && value.image ? 'Si arrastras lejos de los textos, mueves la imagen.' : ''}
        </p>
        {kind === 'concert' && value.image && (
          <div className="mt-2 space-y-2 rounded-2xl bg-sand p-3">
            <label className="block text-xs font-bold text-ink-soft">
              Tamaño de la imagen · {Math.round((value.fit?.zoom ?? 1) * 100)} %
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
      <div>
        <p className="mb-1 text-xs font-bold text-ink-soft">Textos del cartel</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ids.map((id) => (
            <TextRow key={id} id={id} board={value} input={inp} onChange={onChange} />
          ))}
        </ul>
      </div>
    </div>
  )
}
