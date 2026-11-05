import { uniqueId } from '../lib/ids'
import { supabase } from './client'

// Fotos de productos en Supabase Storage (bucket público `store-photos`, ver migración 0020).
// Sin conexión, o si la subida falla, quien llama conserva la foto como imagen local en los datos del producto.

const BUCKET = 'store-photos'

/** Sube una foto (data URL JPEG/PNG) a la carpeta de la tienda y devuelve su dirección pública. */
export async function uploadStorePhoto(storeId: string, dataUrl: string): Promise<string> {
  if (!supabase) throw new Error('Sin conexión a la base de datos.')
  const blob = await (await fetch(dataUrl)).blob()
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${storeId}/${uniqueId('f')}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
