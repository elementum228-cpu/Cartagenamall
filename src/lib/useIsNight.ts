import { usePrefs } from '../state/ui'
import { isNightHour } from './daylight'
import { useMinute } from './useMinute'
import { CAPTURE, CAPTURE_NIGHT } from './captureMode'

/** Noche según la preferencia (auto = hora local del dispositivo). Cambia como mucho una vez por minuto. */
export function useIsNight() {
  const mode = usePrefs((s) => s.timeMode)
  const minute = useMinute()
  if (CAPTURE) return CAPTURE_NIGHT
  if (mode === 'day' || mode === 'dusk') return false
  if (mode === 'night') return true
  return isNightHour(new Date(minute))
}
