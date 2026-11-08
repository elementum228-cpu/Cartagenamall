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
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

const MUSIC_BUCKET = 'store-music'
export const MAX_STORE_MUSIC_BYTES = 8 * 1024 * 1024

/** Sube la música de fondo de un local (carpeta de la tienda) y devuelve su dirección pública. */
export async function uploadStoreMusic(storeId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('Sin conexión a la base de datos.')
  const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${storeId}/${uniqueId('m')}.${ext}`
  const { error } = await supabase.storage.from(MUSIC_BUCKET).upload(path, file, { contentType: file.type || 'audio/mpeg', cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from(MUSIC_BUCKET).getPublicUrl(path).data.publicUrl
}

const IMAGE_BUCKET = 'stadium-images'

/** Sube un escudo o el afiche del cartel del estadio (data URL) y devuelve su dirección pública. */
export async function uploadStadiumImage(dataUrl: string): Promise<string> {
  if (!supabase) throw new Error('Sin conexión a la base de datos.')
  const blob = await (await fetch(dataUrl)).blob()
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `board/${uniqueId('i')}.${ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

const AUDIO_BUCKET = 'stadium-audio'
export const MAX_SONG_BYTES = 10 * 1024 * 1024

/** Sube la canción del concierto (solo la administración puede) y devuelve su dirección pública. */
export async function uploadStadiumSong(file: File): Promise<string> {
  if (!supabase) throw new Error('Sin conexión a la base de datos.')
  const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `songs/${uniqueId('s')}.${ext}`
  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, file, {
    contentType: file.type || 'audio/mpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl
}
