import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Conexión a Supabase. Sin VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY la app funciona como antes
// (modo demostración: todo en el navegador).

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// En la presentación privada (VITE_DEMO=1) la app navegable corre sola en el navegador, sin tocar los datos reales:
// la conexión se usa únicamente para validar el código de invitación (demo/access.ts).
export const supabase: SupabaseClient | null =
  import.meta.env.VITE_DEMO !== "1" && url && key
    ? createClient(url, key, {
        auth: { persistSession: true, detectSessionInUrl: true },
      })
    : null;

/** ¿La app guarda en la base de datos compartida? */
export const remoteEnabled = () => supabase !== null;
