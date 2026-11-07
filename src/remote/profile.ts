import { create } from 'zustand'
import { supabase } from './client'
import { useSession } from './session'

/** Perfil de la cuenta: tipo de cuenta y datos personales (todos opcionales). */
export type Role = 'usuario' | 'admin'
export interface ProfileData {
  fullName: string
  phone: string
  bio: string
  color: string
  avatar: string | null
}
interface ProfileState extends ProfileData {
  loading: boolean
  role: Role | null
}

const EMPTY: ProfileData = { fullName: '', phone: '', bio: '', color: '#2f9e8f', avatar: null }

export const useProfile = create<ProfileState>()(() => ({ loading: false, role: null, ...EMPTY }))

async function load(userId: string | null) {
  if (!supabase || !userId) return useProfile.setState({ loading: false, role: null, ...EMPTY })
  useProfile.setState({ loading: true })
  const { data } = await supabase.from('profiles').select('role, full_name, phone, bio, color, avatar').eq('id', userId).maybeSingle()
  useProfile.setState({
    loading: false,
    role: (data?.role as Role) ?? 'usuario',
    fullName: data?.full_name ?? '',
    phone: data?.phone ?? '',
    bio: data?.bio ?? '',
    color: data?.color ?? EMPTY.color,
    avatar: data?.avatar ?? null,
  })
}

/** Guarda cambios del perfil propio. Devuelve un mensaje de error o null. */
export async function saveProfile(patch: Partial<ProfileData>): Promise<string | null> {
  const userId = useSession.getState().userId
  if (!supabase || !userId) return 'Inicia sesión para guardar tu perfil.'
  const row: Record<string, string | null> = {}
  if (patch.fullName !== undefined) row.full_name = patch.fullName.trim() || null
  if (patch.phone !== undefined) row.phone = patch.phone.trim() || null
  if (patch.bio !== undefined) row.bio = patch.bio.trim() || null
  if (patch.color !== undefined) row.color = patch.color
  if (patch.avatar !== undefined) row.avatar = patch.avatar
  const { error } = await supabase.from('profiles').update(row).eq('id', userId)
  if (error) return 'No pudimos guardar tu perfil. Inténtalo de nuevo.'
  useProfile.setState(patch)
  return null
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

/** Iniciales para el avatar cuando no hay foto. */
export const initialsOf = (name: string, email: string | null) => (name.trim() || email || '?').trim().slice(0, 1).toUpperCase()
