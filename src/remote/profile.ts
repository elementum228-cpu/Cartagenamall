import { create } from 'zustand'
import { supabase } from './client'
import { useSession } from './session'

/** Perfil de la cuenta: usuario normal o administrador del sitio. */
export type Role = 'usuario' | 'admin'
interface ProfileState {
  loading: boolean
  role: Role | null
}

export const useProfile = create<ProfileState>()(() => ({ loading: false, role: null }))

async function load(userId: string | null) {
  if (!supabase || !userId) return useProfile.setState({ loading: false, role: null })
  useProfile.setState({ loading: true })
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  useProfile.setState({ loading: false, role: (data?.role as Role) ?? 'usuario' })
}

let last: string | null | undefined
useSession.subscribe((s) => {
  if (!s.ready || s.userId === last) return
  last = s.userId
  void load(s.userId)
})

/** Compra: sin sesión → debe entrar. Sin base de datos (demo) no se exige nada. */
export function useBuyer() {
  const s = useSession()
  const on = !!supabase
  return { waiting: on && !s.ready, needLogin: on && s.ready && !s.userId }
}
