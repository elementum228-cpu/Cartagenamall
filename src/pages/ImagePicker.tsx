import { ImagePlus } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { readImageFile } from '../lib/image'
import { uploadStorePhoto } from '../remote/photos'
import { remoteEnabled } from '../remote/client'
import { useUI } from '../state/ui'
import { btn } from '../ui/bits'

/** Botón que abre el selector de archivos (cámara o galería en móvil) y entrega la imagen reducida. */
export function ImagePicker({ kind, storeId, label, onImage, children }: { kind: 'logo' | 'product'; storeId?: string; label: string; onImage: (dataUrl: string) => void; children?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null)
  const toast = useUI((s) => s.toast)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          try {
            if (kind === 'product' && storeId && remoteEnabled()) {
              // Con base de datos compartida la foto va a Storage (1280 px). Si falla, se guarda reducida como antes.
              try {
                onImage(await uploadStorePhoto(storeId, await readImageFile(file, 'product-hd')))
                return
              } catch {
                toast('No se pudo subir a la nube; se guardó en este dispositivo.')
              }
            }
            onImage(await readImageFile(file, kind))
          } catch (err) {
            toast(err instanceof Error ? err.message : 'No se pudo usar la imagen.', 'error')
          } finally {
            setBusy(false)
          }
        }}
      />
      <button type="button" className={btn.secondary} disabled={busy} onClick={() => ref.current?.click()}>
        {children ?? <ImagePlus className="size-4" />}
        {busy ? 'Procesando…' : label}
      </button>
    </>
  )
}
