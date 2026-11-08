import { Music2, Play, Square, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Store } from '../domain/types'
import { musicUrlFor, youtubeId } from '../immersive/logic'
import { startMusic, stopMusic } from '../immersive/music'
import { remoteEnabled } from '../remote/client'
import { MAX_STORE_MUSIC_BYTES, uploadStoreMusic } from '../remote/photos'
import { useUI } from '../state/ui'
import { btn } from '../ui/bits'

type Mode = 'classic' | 'custom' | 'youtube' | 'off'

/** Música de fondo del local al entrar: clásica suave por defecto, la propia del dueño, o ninguna. */
export function MusicEditor({ store, onChange }: { store: Store; onChange: (m: NonNullable<Store['music']>) => void }) {
  const toast = useUI((s) => s.toast)
  const mode: Mode = store.music?.mode ?? 'classic'
  const url = store.music?.url ?? null
  const ytUrl = store.music?.ytUrl ?? ''
  const ytOk = youtubeId(ytUrl) !== null
  const file = useRef<HTMLInputElement>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(false)
  useEffect(() => () => {
    audio.current?.pause()
    stopMusic(true)
  }, [])

  const stop = () => {
    stopMusic(true)
    audio.current?.pause()
    audio.current = null
    setPlaying(false)
  }
  const preview = () => {
    if (playing) return stop()
    const src = musicUrlFor({ music: { mode, url, ytUrl } }, import.meta.env.BASE_URL)
    if (!src) return
    if (src.startsWith('yt:')) {
      startMusic(src, null, true)
      setPlaying(true)
      return
    }
    const a = new Audio(src)
    a.volume = 0.5
    a.onended = () => setPlaying(false)
    audio.current = a
    void a.play().then(() => setPlaying(true)).catch(() => toast('No se pudo reproducir el audio.', 'error'))
  }
  const pick = (m: Mode) => {
    stop()
    onChange({ mode: m, url, ytUrl })
  }
  const upload = async (f: File) => {
    if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|wav|ogg|mp4)$/i.test(f.name)) return toast('Elige un archivo de audio (mp3, m4a, wav…).', 'error')
    if (f.size > MAX_STORE_MUSIC_BYTES) return toast('El audio pesa más de 8 MB. Prueba con uno más corto o comprimido.', 'error')
    setBusy(true)
    stop()
    try {
      let next: string
      if (remoteEnabled()) next = await uploadStoreMusic(store.id, f)
      else {
        next = URL.createObjectURL(f)
        toast('Sin conexión a la base de datos: la música solo suena en este navegador.')
      }
      onChange({ mode: 'custom', url: next, ytUrl })
      toast('Música cargada. Ya suena cuando entran a tu local.', 'success')
    } catch (e) {
      toast(e instanceof Error ? `No se pudo subir: ${e.message}` : 'No se pudo subir la música.', 'error')
    } finally {
      setBusy(false)
    }
  }
  const opt = (m: Mode, title: string, hint: string, disabled = false) => (
    <label key={m} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${mode === m ? 'border-ink bg-sand' : 'border-line bg-white'} ${disabled ? 'opacity-50' : ''}`}>
      <input type="radio" name="musica" className="mt-1 size-5 accent-brand" checked={mode === m} disabled={disabled} onChange={() => pick(m)} />
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-ink-soft">{hint}</span>
      </span>
    </label>
  )
  return (
    <div className="space-y-2.5 sm:col-span-2">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Music2 className="size-4" /> Música del local
      </p>
      <p className="text-xs text-ink-soft">Suena bajito cuando la gente entra a tu local (con «Entrar al local»). Cada visitante puede silenciarla.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {opt('classic', 'Clásica suave', 'La de siempre: piano tranquilo.')}
        {opt('custom', 'Mi música', url ? 'Tu pista cargada.' : 'Sube tu propia pista.', !url)}
        {opt('youtube', 'Enlace de YouTube', ytOk ? 'Suena la pista de tu enlace.' : 'Pega el enlace de un video.', !ytOk)}
        {opt('off', 'Sin música', 'Tu local en silencio.')}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-ink-soft">Enlace de YouTube</span>
        <input
          className="h-11 w-full rounded-2xl border border-line bg-white px-3.5 text-sm outline-none focus:border-brand"
          value={ytUrl}
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(e) => {
            const v = e.target.value
            stop()
            // un enlace válido se activa solo; si lo borran o no sirve, vuelve a la clásica
            const ok = youtubeId(v) !== null
            onChange({ mode: ok ? 'youtube' : mode === 'youtube' ? 'classic' : mode, url, ytUrl: v })
          }}
        />
        {ytUrl.trim() && !ytOk && <span className="mt-1 block text-xs font-semibold text-red-600">Ese enlace no parece de YouTube.</span>}
      </label>
      <input
        ref={file}
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
        className="hidden"
        aria-label="Subir música del local"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void upload(f)
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => file.current?.click()}>
          <Upload className="size-4" /> {busy ? 'Subiendo…' : url ? 'Cambiar mi música' : 'Subir mi música'}
        </button>
        {mode !== 'off' && (
          <button type="button" className={btn.ghost} onClick={preview}>
            {playing ? <Square className="size-4" /> : <Play className="size-4" />} {playing ? 'Detener' : 'Escuchar'}
          </button>
        )}
        {url && (
          <button
            type="button"
            className={btn.ghost}
            onClick={() => {
              stop()
              onChange({ mode: 'classic', url: null, ytUrl })
            }}
          >
            <Trash2 className="size-4" /> Quitar la mía
          </button>
        )}
      </div>
      <p className="text-[11px] text-ink-soft">Archivo: máximo 8 MB (mp3, m4a, wav). Con YouTube suena el video sin imagen; algunos videos no permiten incrustarse y en ese caso suena la clásica. Usa música que tengas derecho a poner.</p>
    </div>
  )
}
