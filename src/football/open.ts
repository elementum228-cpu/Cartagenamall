import { COURT_SPACE } from '../config/mall'
import { useCatalog } from '../state/catalog'
import { useUI } from '../state/ui'

/** Color de la cancha (cartel, ficha y botón). */
export const COURT_COLOR = '#1f7a3d'

/** Tienda que opera la cancha (asignada por el administrador), o null si está libre para reclamar. */
export function useCourtOperator() {
  return useCatalog((s) => {
    const id = s.assignments[COURT_SPACE.id]
    return id ? (s.stores.find((st) => st.id === id) ?? null) : null
  })
}

/** Abre la cancha: con un negocio que la opera, el panel de reservas; libre, la ficha para reclamarla. */
export function openCourtOrClaim(focus = true) {
  const ui = useUI.getState()
  if (ui.overview || ui.activeFloor !== 'P1') ui.setFloor('P1')
  if (useCatalog.getState().assignments[COURT_SPACE.id]) ui.openCourt(true)
  else ui.selectSpace(COURT_SPACE.id)
  if (focus) ui.requestFocus({ kind: 'court' })
}
