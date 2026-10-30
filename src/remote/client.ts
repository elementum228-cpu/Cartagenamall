import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Conexión a Supabase. Sin VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY la app funciona como antes
// (modo demostración: todo en el navegador).

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } }) : null

/** ¿La app guarda en la base de datos compartida? */
export const remoteEnabled = () => supabase !== null
