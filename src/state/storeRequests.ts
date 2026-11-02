export type RequestStatus = 'pendiente' | 'aprobada' | 'rechazada'
export interface StoreRequest {
  id: string
  user_id: string
  business_name: string
  category: string
  phone: string
  description: string
  status: RequestStatus
  created_at: string
}
export const REQUEST_CATEGORIES = ['Moda', 'Tecnología', 'Belleza', 'Lifestyle', 'Gastronomía', 'Servicios', 'Otro']
export const STATUS_LABEL: Record<RequestStatus, string> = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' }
export const STATUS_STYLE: Record<RequestStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  aprobada: 'bg-emerald-100 text-emerald-800',
  rechazada: 'bg-red-100 text-red-700',
}
