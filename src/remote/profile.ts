import { create } from 'zustand'
import { supabase } from './client'
import { useSession } from './session'

/** Perfil de la cuenta: tipo (cliente | negocio) y nombre del negocio. */
export type Role = 'cliente' | 'negocio'
interface ProfileState {
  loading: boolean
  role: Role | null
  businessName: string | null
}

export const useProfile = create<ProfileState>()(() => ({ loading: false, role: null, businessName: null }))

async function load(userId: string | null) {
  if (!supabase || !userId) return useProfile.setState({ loading: false, role: null, businessName: null })
  useProfile.setState({ loading: true })
  const { data } = await supabase.from('profiles').select('role,business_name').eq('id', userId).maybeSingle()
  useProfile.setState({ loading: false, role: (data?.role as Role) ?? 'cliente', businessName: data?.business_name ?? null })
}

let last: string | null | undefined
useSession.subscribe((s) => {
  if (!s.ready || s.userId === last) return
  last = s.userId
  void load(s.userId)
})

/** Estado de compra: sin sesión → debe entrar; cuenta de negocio → no puede comprar. Sin base de datos (demo) no se exige nada. */
export function useBuyer() {
  const s = useSession()
  const role = useProfile((p) => p.role)
  const loading = useProfile((p) => p.loading)
  const on = !!supabase
  return {
    waiting: on && (!s.ready || (!!s.userId && (loading || role === null))),
    needLogin: on && s.ready && !s.userId,
    isBusiness: on && !!s.userId && role === 'negocio',
  }
}
