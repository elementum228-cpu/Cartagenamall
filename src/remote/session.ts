import { create } from 'zustand'
import { supabase } from './client'

/** Sesión del comerciante o administrador (solo con base de datos conectada). */
interface SessionState {
  ready: boolean
  email: string | null
  userId: string | null
  isAdmin: boolean
  storeIds: string[]
  refresh: () => Promise<void>
  signIn: (email: string) => Promise<string | null>
  signInWithPassword: (email: string, password: string) => Promise<string | null>
  setPassword: (password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const useSession = create<SessionState>()((set, get) => ({
  ready: !supabase,
  email: null,
  userId: null,
  isAdmin: false,
  storeIds: [],
  refresh: async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user ?? null
    if (!user) {
      set({ ready: true, email: null, userId: null, isAdmin: false, storeIds: [] })
      return
    }
    const { data: roles } = await supabase.rpc('my_roles')
    set({ ready: true, email: user.email ?? null, userId: user.id, isAdmin: !!roles?.is_admin, storeIds: (roles?.store_ids as string[]) ?? [] })
  },
  signIn: async (email) => {
    if (!supabase) return 'No hay base de datos conectada.'
    const redirect = `${location.origin}${import.meta.env.BASE_URL}${location.pathname.replace(import.meta.env.BASE_URL, '').replace(/^\//, '')}`
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect } })
    return error ? error.message : null
  },
  signInWithPassword: async (email, password) => {
    if (!supabase) return 'No hay base de datos conectada.'
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return /invalid login credentials/i.test(error.message) ? 'Correo o contraseña incorrectos.' : error.message
    await get().refresh()
    return null
  },
  setPassword: async (password) => {
    if (!supabase) return 'No hay base de datos conectada.'
    const { error } = await supabase.auth.updateUser({ password })
    return error ? error.message : null
  },
  signOut: async () => {
    await supabase?.auth.signOut()
    await get().refresh()
  },
}))

if (supabase) {
  supabase.auth.onAuthStateChange(() => {
    void useSession.getState().refresh()
  })
  void useSession.getState().refresh()
}
