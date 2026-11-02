import { Navigate } from 'react-router-dom'
import { useProfile } from '../remote/profile'
import { useSession } from '../remote/session'

/** Panel del negocio (por ahora vacío). */
export function BusinessPanelPage() {
  const s = useSession()
  const { role, businessName, loading } = useProfile()
  if (!s.ready || (s.userId && (loading || !role))) return <p className="p-6 text-sm text-ink-soft">Cargando…</p>
  if (!s.userId) return <Navigate to="/login?redirect=/panel-negocio" replace />
  if (role !== 'negocio') return <Navigate to="/" replace />
  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-28">
      <div className="glass-strong rounded-[28px] p-5">
        <p className="text-xs font-bold tracking-wider text-brand uppercase">Panel de negocio</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{businessName}</h1>
      </div>
    </div>
  )
}
