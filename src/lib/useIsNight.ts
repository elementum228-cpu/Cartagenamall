import { usePrefs } from '../state/ui'
import { isNightHour } from './daylight'
import { useMinute } from './useMinute'

/** Noche según la preferencia (auto = hora local del dispositivo). Cambia como mucho una vez por minuto. */
export function useIsNight() {
  const mode = usePrefs((s) => s.timeMode)
  const minute = useMinute()
  if (mode === 'day') return false
  if (mode === 'night') return true
  return isNightHour(new Date(minute))
}
